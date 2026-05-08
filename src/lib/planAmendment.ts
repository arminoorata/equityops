/**
 * Plan Amendment Impact Modeler engine. Pure functions only — no
 * React, no I/O, no AI. Models how a proposed plan-amendment package
 * (additional shares, evergreen, share recycling, repricing
 * provisions) affects share reserve, overhang, runway, and dilution
 * across a forecast horizon.
 *
 * What this is NOT:
 *   - Not an ISS or Glass Lewis scoring engine. The output is
 *     ISS-aware (we surface investor concern flags using public
 *     guidance) but does not reproduce any proprietary score.
 *   - Not legal or accounting advice. The plan document, listing
 *     rules (NYSE/Nasdaq), shareholder approval requirements, and
 *     the comp committee charter control any actual amendment.
 *   - Not a forward-looking valuation. Dilution math uses share
 *     counts; share-price growth is not modeled.
 *
 * Calculation contract (deterministic, transparent):
 *   - Burn rate = annualBurnRateShares (current); the engine respects
 *     a hiring growth multiplier so the user can stress-test "what if
 *     we add 200 hires next year?".
 *   - Runway (years) = available reserve / annual gross burn (after
 *     evergreen replenishment if enabled).
 *   - Overhang = (outstanding + reserve) / shares outstanding. The
 *     engine reports the before/after ratio AND the absolute share
 *     count delta from the amendment.
 *   - Evergreen replenishment is applied at the start of each
 *     forecast year as a percent of shares outstanding at that point.
 *   - Investor concern flags fire on user-visible thresholds (high
 *     overhang increment, high evergreen rate, repricing without
 *     shareholder approval, very long runway, no recycling on options
 *     with full recycling on full-value awards, etc.).
 */

// ───────── Types ─────────

export type ShareRecyclingMode =
  /** Recycle all forfeited / cancelled / expired shares back into the pool. */
  | "FULL"
  /** Recycle only forfeited / cancelled (not expired underwater options). */
  | "FORFEIT_ONLY"
  /** Do not recycle. */
  | "NONE";

export type CurrentPlanState = {
  /** Total shares outstanding (basic count). */
  sharesOutstanding: number;
  /** Total shares currently outstanding under awards (vested + unvested). */
  awardsOutstanding: number;
  /** Available shares left in the plan reserve. */
  availableReserve: number;
  /** Annual gross burn rate (shares granted / shares outstanding × 100). */
  annualBurnRateShares: number;
  /** Forecast horizon in years for runway / dilution. */
  forecastYears: number;
  /**
   * Hiring growth multiplier applied to annualBurnRateShares each year.
   * 1.0 = flat, 1.2 = 20% YoY growth (default 1.0).
   */
  hiringGrowthMultiplier: number;
};

export type AmendmentProposal = {
  /** Additional shares to add to the reserve. Can be 0. */
  additionalReserveShares: number;
  /**
   * Evergreen provision: if true, replenish reserve each year at
   * `evergreenPercent` × sharesOutstanding (start of year).
   */
  evergreenEnabled: boolean;
  /** Evergreen replenishment percent of shares outstanding. */
  evergreenPercent: number;
  /** Repricing of outstanding underwater options allowed under the plan. */
  repricingAllowed: boolean;
  /** Repricing requires shareholder approval. */
  repricingRequiresShareholderApproval: boolean;
  /**
   * Share recycling mode. Some plans recycle all forfeited /
   * cancelled / withheld for taxes; some only forfeitures.
   */
  shareRecyclingFullValue: ShareRecyclingMode;
  shareRecyclingOptions: ShareRecyclingMode;
};

export type PlanAmendmentInputs = {
  current: CurrentPlanState;
  proposal: AmendmentProposal;
};

export type PlanAmendmentException =
  | "INVALID_INPUT"
  | "HIGH_EVERGREEN"
  | "HIGH_OVERHANG_INCREMENT"
  | "REPRICING_WITHOUT_APPROVAL"
  | "ASYMMETRIC_RECYCLING"
  | "VERY_SHORT_RUNWAY"
  | "VERY_LONG_RUNWAY";

export type PlanAmendmentExceptionFlag = {
  type: PlanAmendmentException;
  message: string;
};

export type ForecastYearRow = {
  year: number;
  /** Shares outstanding at start of year. */
  sharesOutstandingStart: number;
  /** Reserve at start of year (after evergreen if enabled). */
  reserveStart: number;
  /** Annual burn (shares granted) for the year. */
  annualBurn: number;
  /** Reserve at end of year (clamped at 0). */
  reserveEnd: number;
  /** Cumulative dilution % from the amendment so far. */
  cumulativeDilutionPct: number;
};

export type PlanAmendmentAnalysis = {
  inputs: PlanAmendmentInputs;
  before: {
    overhangPct: number;
    runwayYears: number;
    annualBurnPct: number;
  };
  after: {
    overhangPct: number;
    runwayYears: number;
    annualBurnPct: number;
    additionalReserveShares: number;
    additionalDilutionPct: number;
  };
  forecast: ForecastYearRow[];
  exceptions: PlanAmendmentExceptionFlag[];
};

// ───────── Constants & defaults ─────────

export const SHARE_RECYCLING_LABEL: Record<ShareRecyclingMode, string> = {
  FULL: "Full recycling",
  FORFEIT_ONLY: "Forfeit only",
  NONE: "No recycling",
};

export const EXCEPTION_LABEL: Record<PlanAmendmentException, string> = {
  INVALID_INPUT: "Invalid input",
  HIGH_EVERGREEN: "High evergreen rate",
  HIGH_OVERHANG_INCREMENT: "High overhang increment",
  REPRICING_WITHOUT_APPROVAL: "Repricing without shareholder approval",
  ASYMMETRIC_RECYCLING: "Asymmetric recycling rules",
  VERY_SHORT_RUNWAY: "Very short runway",
  VERY_LONG_RUNWAY: "Very long runway",
};

/** Practitioner-common thresholds for investor-concern flags. */
export const FLAG_THRESHOLDS = {
  highEvergreenPercent: 5, // >= 5% annual evergreen is investor-sensitive
  highOverhangIncrementPct: 5, // >= 5pp jump in overhang from the amendment
  veryShortRunwayYears: 1.5,
  veryLongRunwayYears: 8,
};

export function defaultCurrentPlanState(): CurrentPlanState {
  return {
    sharesOutstanding: 100_000_000,
    awardsOutstanding: 8_000_000,
    availableReserve: 4_000_000,
    annualBurnRateShares: 2_500_000,
    forecastYears: 5,
    hiringGrowthMultiplier: 1.0,
  };
}

export function defaultAmendmentProposal(): AmendmentProposal {
  return {
    additionalReserveShares: 0,
    evergreenEnabled: false,
    evergreenPercent: 0,
    repricingAllowed: false,
    repricingRequiresShareholderApproval: true,
    shareRecyclingFullValue: "FORFEIT_ONLY",
    shareRecyclingOptions: "FORFEIT_ONLY",
  };
}

// ───────── Math helpers ─────────

function safeDiv(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
  return a / b;
}

function pct(numerator: number, denominator: number): number {
  return safeDiv(numerator, denominator) * 100;
}

// ───────── Analysis ─────────

export function analyzePlanAmendment(
  inputs: PlanAmendmentInputs,
): PlanAmendmentAnalysis {
  const exceptions: PlanAmendmentExceptionFlag[] = [];
  const c = inputs.current;
  const p = inputs.proposal;

  // Validate.
  if (c.sharesOutstanding <= 0) {
    exceptions.push({
      type: "INVALID_INPUT",
      message:
        "Shares outstanding must be greater than zero. Cannot compute overhang or dilution.",
    });
  }
  if (c.forecastYears <= 0 || c.forecastYears > 25) {
    exceptions.push({
      type: "INVALID_INPUT",
      message: `Forecast years must be in [1, 25]. Got ${c.forecastYears}.`,
    });
  }
  if (c.hiringGrowthMultiplier < 0) {
    exceptions.push({
      type: "INVALID_INPUT",
      message:
        "Hiring growth multiplier cannot be negative. Use 1.0 for flat, 1.2 for 20% YoY growth.",
    });
  }

  // Before snapshot.
  const beforeOverhangShares = c.awardsOutstanding + c.availableReserve;
  const beforeOverhang = pct(beforeOverhangShares, c.sharesOutstanding);
  const beforeRunway = safeDiv(c.availableReserve, c.annualBurnRateShares);
  const beforeBurnPct = pct(c.annualBurnRateShares, c.sharesOutstanding);

  // After (immediate, before forecast walk).
  const afterReserveStart = Math.max(
    0,
    c.availableReserve + p.additionalReserveShares,
  );
  const afterOverhangShares = c.awardsOutstanding + afterReserveStart;
  const afterOverhang = pct(afterOverhangShares, c.sharesOutstanding);
  const additionalDilution = pct(
    p.additionalReserveShares,
    c.sharesOutstanding,
  );

  // Forecast walk.
  const forecast: ForecastYearRow[] = [];
  const outstanding = c.sharesOutstanding; // dilution forecast holds basic share count flat
  let reserve = afterReserveStart;
  let burn = c.annualBurnRateShares;
  for (let y = 1; y <= Math.max(0, Math.min(25, c.forecastYears)); y++) {
    const sStart = outstanding;
    let rStart = reserve;
    if (p.evergreenEnabled && p.evergreenPercent > 0) {
      const evergreenAdd = (p.evergreenPercent / 100) * sStart;
      rStart += evergreenAdd;
      // Evergreen is treated as a fresh issuance for dilution purposes;
      // shares outstanding are not increased here because evergreen tops
      // up the reserve. The actual dilution shows up as the burn is
      // granted out of the reserve.
    }
    const annualBurn = burn;
    const rEnd = Math.max(0, rStart - annualBurn);
    // Dilution proxy: cumulative shares granted / shares outstanding.
    const cumulativeBurnSoFar = forecast.reduce(
      (s, r) => s + r.annualBurn,
      0,
    ) + annualBurn;
    const cumulativeDilutionPct = pct(cumulativeBurnSoFar, c.sharesOutstanding);
    forecast.push({
      year: y,
      sharesOutstandingStart: sStart,
      reserveStart: rStart,
      annualBurn,
      reserveEnd: rEnd,
      cumulativeDilutionPct,
    });
    reserve = rEnd;
    burn = burn * c.hiringGrowthMultiplier;
  }
  // Post-amendment runway accounting for evergreen replenishment (use
  // year 1 of the forecast walk as the projected baseline).
  const projectedAnnualBurn = forecast[0]?.annualBurn ?? c.annualBurnRateShares;
  const evergreenAddPerYear = p.evergreenEnabled
    ? (p.evergreenPercent / 100) * c.sharesOutstanding
    : 0;
  const netAnnualBurnAfter = Math.max(
    0,
    projectedAnnualBurn - evergreenAddPerYear,
  );
  const afterRunway =
    netAnnualBurnAfter > 0
      ? safeDiv(afterReserveStart, netAnnualBurnAfter)
      : afterReserveStart > 0
        ? Number.POSITIVE_INFINITY
        : 0;

  // Investor concern flags.
  if (p.evergreenEnabled && p.evergreenPercent >= FLAG_THRESHOLDS.highEvergreenPercent) {
    exceptions.push({
      type: "HIGH_EVERGREEN",
      message: `Evergreen ${p.evergreenPercent.toFixed(2)}% / year is at or above the ${FLAG_THRESHOLDS.highEvergreenPercent}% threshold investors typically scrutinize. Confirm against ISS / Glass Lewis posture and recent shareholder feedback.`,
    });
  }
  const overhangIncrement = afterOverhang - beforeOverhang;
  if (overhangIncrement >= FLAG_THRESHOLDS.highOverhangIncrementPct) {
    exceptions.push({
      type: "HIGH_OVERHANG_INCREMENT",
      message: `Amendment increases overhang by ${overhangIncrement.toFixed(2)} percentage points (from ${beforeOverhang.toFixed(2)}% to ${afterOverhang.toFixed(2)}%). A jump of ${FLAG_THRESHOLDS.highOverhangIncrementPct}pp+ typically triggers detailed investor review.`,
    });
  }
  if (p.repricingAllowed && !p.repricingRequiresShareholderApproval) {
    exceptions.push({
      type: "REPRICING_WITHOUT_APPROVAL",
      message:
        "Repricing without shareholder approval is generally viewed unfavorably by ISS / Glass Lewis and is restricted by most NYSE / Nasdaq listing rules. Confirm with legal before scoping.",
    });
  }
  if (p.shareRecyclingFullValue !== p.shareRecyclingOptions) {
    exceptions.push({
      type: "ASYMMETRIC_RECYCLING",
      message: `Recycling rules differ between full-value (${SHARE_RECYCLING_LABEL[p.shareRecyclingFullValue]}) and options (${SHARE_RECYCLING_LABEL[p.shareRecyclingOptions]}). Investors and proxy advisors typically expect a single transparent rule; confirm the rationale.`,
    });
  }
  if (
    Number.isFinite(afterRunway) &&
    afterRunway < FLAG_THRESHOLDS.veryShortRunwayYears
  ) {
    exceptions.push({
      type: "VERY_SHORT_RUNWAY",
      message: `Post-amendment runway is ${afterRunway.toFixed(2)} years, below the ${FLAG_THRESHOLDS.veryShortRunwayYears}-year practitioner threshold. Consider increasing the additional reserve.`,
    });
  }
  if (
    Number.isFinite(afterRunway) &&
    afterRunway > FLAG_THRESHOLDS.veryLongRunwayYears
  ) {
    exceptions.push({
      type: "VERY_LONG_RUNWAY",
      message: `Post-amendment runway is ${afterRunway.toFixed(2)} years, above the ${FLAG_THRESHOLDS.veryLongRunwayYears}-year practitioner threshold. Investors and proxy advisors may scrutinize an oversized request; consider sizing for 3-5 years instead.`,
    });
  }

  return {
    inputs,
    before: {
      overhangPct: beforeOverhang,
      runwayYears: beforeRunway,
      annualBurnPct: beforeBurnPct,
    },
    after: {
      overhangPct: afterOverhang,
      runwayYears: afterRunway,
      annualBurnPct: beforeBurnPct, // unchanged at the amendment moment
      additionalReserveShares: p.additionalReserveShares,
      additionalDilutionPct: additionalDilution,
    },
    forecast,
    exceptions,
  };
}

// ───────── Memo composition ─────────

export function composePlanAmendmentMemo(
  analysis: PlanAmendmentAnalysis,
): string {
  const { inputs, before, after, forecast, exceptions } = analysis;
  const c = inputs.current;
  const p = inputs.proposal;
  const lines: string[] = [];
  lines.push("# Plan amendment impact — board / comp committee memo");
  lines.push("");
  lines.push(
    "Educational diagnostic. ISS-aware framing, not an ISS / Glass Lewis score. Not legal, accounting, or financial advice. The plan document, listing-rule restrictions (NYSE / Nasdaq), shareholder approval requirements, and the comp committee charter control any actual amendment. Bring this memo to TR, finance, accounting, legal, and the comp committee for review before any action.",
  );
  lines.push("");

  // 1. Inputs and assumptions
  lines.push("## 1. Inputs and assumptions");
  lines.push(`- Shares outstanding: ${c.sharesOutstanding.toLocaleString()}`);
  lines.push(
    `- Awards outstanding (vested + unvested): ${c.awardsOutstanding.toLocaleString()}`,
  );
  lines.push(`- Available reserve: ${c.availableReserve.toLocaleString()}`);
  lines.push(
    `- Annual burn (shares granted): ${c.annualBurnRateShares.toLocaleString()}`,
  );
  lines.push(`- Forecast horizon: ${c.forecastYears} years`);
  lines.push(
    `- Hiring growth multiplier: ${c.hiringGrowthMultiplier.toFixed(2)} per year`,
  );
  lines.push("");
  lines.push(
    `- Proposed additional reserve shares: ${p.additionalReserveShares.toLocaleString()}`,
  );
  lines.push(
    `- Evergreen: ${p.evergreenEnabled ? `${p.evergreenPercent.toFixed(2)}% / year` : "not enabled"}`,
  );
  lines.push(
    `- Repricing allowed under plan: ${p.repricingAllowed ? "yes" : "no"}; requires shareholder approval: ${p.repricingRequiresShareholderApproval ? "yes" : "no"}`,
  );
  lines.push(
    `- Share recycling — full-value: ${SHARE_RECYCLING_LABEL[p.shareRecyclingFullValue]}; options: ${SHARE_RECYCLING_LABEL[p.shareRecyclingOptions]}`,
  );
  lines.push("");

  // 2. Before / after snapshot
  lines.push("## 2. Before vs after snapshot");
  lines.push("");
  lines.push("| Metric | Before | After | Δ |");
  lines.push("| --- | --- | --- | --- |");
  lines.push(
    `| Overhang | ${before.overhangPct.toFixed(2)}% | ${after.overhangPct.toFixed(2)}% | ${(after.overhangPct - before.overhangPct).toFixed(2)} pp |`,
  );
  lines.push(
    `| Runway (years) | ${formatRunway(before.runwayYears)} | ${formatRunway(after.runwayYears)} | ${(after.runwayYears - before.runwayYears).toFixed(2)} yrs |`,
  );
  lines.push(
    `| Annual burn | ${before.annualBurnPct.toFixed(2)}% | ${after.annualBurnPct.toFixed(2)}% | — |`,
  );
  lines.push(
    `| Additional dilution from amendment | — | — | ${after.additionalDilutionPct.toFixed(2)}% |`,
  );
  lines.push("");

  // 3. Forecast walk
  lines.push("## 3. Forecast walk");
  lines.push("");
  lines.push(
    "| Year | Outstanding (start) | Reserve (start, after evergreen) | Annual burn | Reserve (end) | Cumulative dilution |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- |");
  forecast.forEach((y) => {
    lines.push(
      `| ${y.year} | ${y.sharesOutstandingStart.toLocaleString()} | ${y.reserveStart.toLocaleString()} | ${y.annualBurn.toLocaleString()} | ${y.reserveEnd.toLocaleString()} | ${y.cumulativeDilutionPct.toFixed(2)}% |`,
    );
  });
  lines.push("");

  // 4. Investor concerns
  lines.push("## 4. Investor concern flags");
  if (exceptions.length === 0) {
    lines.push("- No investor concern flags fired at the current thresholds.");
  } else {
    exceptions.forEach((e) => {
      lines.push(`- **${EXCEPTION_LABEL[e.type]}**: ${e.message}`);
    });
  }
  lines.push("");

  // 5. Legal / finance question list
  lines.push("## 5. Legal and finance question list");
  lines.push(
    "- **Listing rule check.** Does the proposed amendment require shareholder approval under NYSE Listed Company Manual Rule 303A.08 or Nasdaq Listing Rule 5635(c)? Confirm with outside counsel.",
  );
  lines.push(
    "- **ISS posture.** Does the proposed amendment fall inside the ISS Equity Plan Scorecard 'pass' range for the company's stage? Pull the latest ISS U.S. policy guidance.",
  );
  lines.push(
    "- **Glass Lewis posture.** Does the amendment trigger any Glass Lewis red flags (high cost, repricing without approval, evergreen)?",
  );
  lines.push(
    "- **ASC 718 expense impact.** What is the incremental fair-value expense from the amendment under the company's accounting policy? Pair with the ASC 718 Expense Forecaster in the workbench.",
  );
  lines.push(
    "- **Plan doc consistency.** Does the proposed amendment require updating the plan-document share reserve language, individual-grant limits, or country-specific sub-plans?",
  );
  lines.push(
    "- **Disclosure timeline.** Confirm the proxy-disclosure timeline and the comp committee charter language that supports the amendment.",
  );
  lines.push("");

  // 6. Recommended next steps
  lines.push("## 6. Recommended next steps");
  lines.push(
    "1. **Comp committee.** Walk the before / after snapshot and the investor concern flags with the comp committee. Confirm the size of the request against the company's 3–5 year hiring plan.",
  );
  lines.push(
    "2. **Legal.** Confirm listing-rule + plan-doc + sub-plan implications. Document the rationale for any deviation from prior amendment language.",
  );
  lines.push(
    "3. **Finance.** Reconcile the dilution forecast to the FY budget and the burn-rate model. Confirm investor-relations talking points.",
  );
  lines.push(
    "4. **Accounting.** Pair this memo with the ASC 718 expense forecast for the post-amendment award population.",
  );
  lines.push(
    "5. **TR.** Stress-test runway under the hiring growth multiplier; consider scenario sensitivity on +/- 25% headcount growth.",
  );
  lines.push("");

  // Disclaimer
  lines.push("## Disclaimer");
  lines.push(
    "Outputs reflect the inputs and thresholds typed above. Investor concern flags use practitioner-common reference points and are not a substitute for ISS / Glass Lewis modeling. Repricing, listing-rule, and shareholder-approval analysis is jurisdiction-specific; confirm with qualified counsel.",
  );
  return lines.join("\n");
}

function formatRunway(y: number): string {
  if (!Number.isFinite(y)) return "∞ (no net burn)";
  return y.toFixed(2);
}

// ───────── CSV ─────────

export function forecastToCsv(forecast: ForecastYearRow[]): string {
  const header = [
    "Year",
    "Outstanding Start",
    "Reserve Start (after evergreen)",
    "Annual Burn",
    "Reserve End",
    "Cumulative Dilution %",
  ].join(",");
  const lines = forecast.map((y) =>
    [
      y.year,
      y.sharesOutstandingStart,
      Math.round(y.reserveStart),
      y.annualBurn,
      Math.round(y.reserveEnd),
      Number(y.cumulativeDilutionPct.toFixed(4)),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}
