/**
 * AMT Scenario Modeler engine. Pure functions only — no React, no
 * I/O, no AI. Models the AMT exposure of a proposed ISO exercise at a
 * planning level using the deterministic 2024/2025-style AMT formula
 * the user typically sees referenced in TR / equity-ops conversations.
 *
 * What this is NOT:
 *   - Not tax advice. This is a planning model for TR / equity-ops /
 *     comp-committee conversations. The employee needs a qualified
 *     tax advisor for any actual filing decision.
 *   - Not a replacement for a tax projection. State tax is referenced
 *     but not modeled. Multi-year carry-forward AMT credit is not
 *     modeled. Capital gains on a subsequent sale are not modeled
 *     beyond the optional sale-price scenario, which intentionally
 *     stays at a planning-grade granularity.
 *   - Not a regular-tax engine. The "ordinary income estimate" the
 *     user provides is treated as the regular-taxable income at the
 *     comparison point; the engine compares that against the
 *     tentative minimum tax (TMT). It does not invent ordinary
 *     income, deductions, or filing-status-specific credits.
 *
 * Calculation contract:
 *   - For each ISO grant, bargain element = max(0, FMV - strike) ×
 *     proposed exercise shares.
 *   - Total bargain element across all grants is added to the user-
 *     supplied ordinary-income estimate to form an "AMT income"
 *     reference (AMTI proxy at planning-grade).
 *   - AMTI is reduced by the user-editable AMT exemption, which is
 *     phased out per the user-editable phaseout schedule.
 *   - TMT = AMTI-after-exemption × bracket schedule (the engine ships
 *     the standard AMT 26% / 28% bracket structure with the user-
 *     editable bracket break point).
 *   - Regular tax estimate = ordinary income × user-editable
 *     effective regular rate (planning slider).
 *   - AMT exposure = max(0, TMT - regularTax).
 *   - Exception flags surface anything the engine could not infer
 *     cleanly (missing strike, missing FMV, exercise > exercisable,
 *     stale FMV, zero shares, unsupported assumption).
 */

// ───────── Types ─────────

export type FilingStatus =
  | "SINGLE"
  | "MARRIED_JOINT"
  | "MARRIED_SEPARATE"
  | "HEAD_OF_HOUSEHOLD";

export type IsoGrantRow = {
  rowId: string;
  grantId?: string;
  /** ISO YYYY-MM-DD. */
  grantDate?: string;
  /** Vested / exercisable shares. */
  sharesExercisable: number;
  /** Strike price per share. */
  strike: number;
  /** Current FMV per share at the proposed exercise. */
  currentFmv: number;
  /** Proposed exercise shares for this grant. */
  proposedExerciseShares: number;
  /** Notes free text. */
  notes?: string;
};

export type AmtAssumptions = {
  /** Filing status. Drives the exemption + bracket defaults. */
  filingStatus: FilingStatus;
  /** Editable AMT exemption amount. */
  amtExemption: number;
  /**
   * Phaseout starts at this AMTI level. For each $X above, exemption
   * is reduced by 25¢ (the ratio is editable below).
   */
  exemptionPhaseoutStart: number;
  /** Phaseout rate (default 0.25 = 25¢ reduction per $1 over start). */
  exemptionPhaseoutRate: number;
  /**
   * AMT bracket structure: 26% on AMTI-after-exemption up to the
   * break point, 28% above. The break point and the two rates are
   * editable so a practitioner can pressure-test.
   */
  amtBracketBreakpoint: number;
  amtRateLow: number;
  amtRateHigh: number;
  /**
   * Effective regular-tax rate the user thinks applies to their
   * ordinary income. Planning-grade slider, intentionally simple.
   */
  effectiveRegularRate: number;
  /**
   * Ordinary income estimate (W-2-style) excluding the ISO bargain
   * element. The bargain element is added separately by the engine.
   */
  ordinaryIncomeEstimate: number;
  /**
   * Optional sale price per share. When set, the engine surfaces a
   * planning-grade sale view (not a cap-gains tax model — it just
   * shows the spread between FMV at exercise and the sale price).
   */
  salePricePerShare?: number;
  /** Holding period planning note (e.g., "long-term qualifying"). */
  holdingPeriodNote?: string;
  /** Free-text state tax note (we explicitly do not model state). */
  stateTaxNote?: string;
};

export type AmtSettings = {
  /** ISO YYYY-MM-DD. Defaults to today. Used for stale-FMV detection. */
  asOfDate?: string;
  /** A grant whose FMV is older than this many days triggers STALE_FMV. */
  staleFmvThresholdDays: number;
  /** Date the FMV was last validated. ISO YYYY-MM-DD. */
  fmvAsOfDate?: string;
};

export type AmtException =
  | "MISSING_STRIKE"
  | "MISSING_FMV"
  | "EXERCISE_EXCEEDS_EXERCISABLE"
  | "STALE_FMV"
  | "ZERO_PROPOSED_SHARES"
  | "UNSUPPORTED_ASSUMPTION";

export type AmtExceptionFlag = {
  type: AmtException;
  /** Optional row reference — undefined for scenario-level flags. */
  rowId?: string;
  message: string;
};

export type GrantWithBargain = IsoGrantRow & {
  /** Per-share bargain element = max(0, FMV - strike). */
  bargainPerShare: number;
  /** Total bargain element on proposed exercise. */
  bargainElement: number;
  /** Total exercise cost = strike × proposed exercise shares. */
  exerciseCost: number;
  exceptions: AmtExceptionFlag[];
};

export type AmtAnalysis = {
  rows: GrantWithBargain[];
  totals: {
    proposedExerciseShares: number;
    totalExerciseCost: number;
    totalBargainElement: number;
  };
  computation: {
    amtIncome: number;
    exemptionAfterPhaseout: number;
    amtiAfterExemption: number;
    tentativeMinimumTax: number;
    regularTaxEstimate: number;
    amtExposure: number;
    /** Breakeven exercise shares — the largest planning-grade number of
     *  shares the user could exercise across the population at the same
     *  ratio of bargain to total bargain before AMT exposure pushes
     *  past zero. Returns 0 if exposure is already 0 with zero shares,
     *  or if the math is degenerate (no bargain at planning point). */
    breakevenExerciseShares: number;
    breakevenNote: string;
  };
  saleScenario?: {
    salePricePerShare: number;
    /** Spread between sale price and FMV at exercise on the proposed shares. */
    saleSpreadValue: number;
    /** Cash needed to cover the AMT exposure (informational, planning-level). */
    cashLiquidityForAmt: number;
    note: string;
  };
  exceptions: AmtExceptionFlag[];
  assumptions: AmtAssumptions;
  settings: AmtSettings;
};

// ───────── Constants & defaults ─────────

export const FILING_STATUS_LABEL: Record<FilingStatus, string> = {
  SINGLE: "Single",
  MARRIED_JOINT: "Married filing jointly",
  MARRIED_SEPARATE: "Married filing separately",
  HEAD_OF_HOUSEHOLD: "Head of household",
};

/** Editable defaults; the user is expected to confirm against the latest IRS guidance. */
export const FILING_STATUS_EXEMPTION_DEFAULTS: Record<FilingStatus, number> = {
  SINGLE: 88100,
  MARRIED_JOINT: 137000,
  MARRIED_SEPARATE: 68500,
  HEAD_OF_HOUSEHOLD: 88100,
};

/** Editable defaults; the user is expected to confirm against the latest IRS guidance. */
export const FILING_STATUS_PHASEOUT_START_DEFAULTS: Record<FilingStatus, number> = {
  SINGLE: 626350,
  MARRIED_JOINT: 1252700,
  MARRIED_SEPARATE: 626350,
  HEAD_OF_HOUSEHOLD: 626350,
};

export const EXCEPTION_LABEL: Record<AmtException, string> = {
  MISSING_STRIKE: "Missing strike",
  MISSING_FMV: "Missing FMV",
  EXERCISE_EXCEEDS_EXERCISABLE: "Exercise exceeds exercisable",
  STALE_FMV: "Stale FMV",
  ZERO_PROPOSED_SHARES: "Zero proposed shares",
  UNSUPPORTED_ASSUMPTION: "Unsupported assumption",
};

export function defaultAmtAssumptions(): AmtAssumptions {
  return {
    filingStatus: "MARRIED_JOINT",
    amtExemption: FILING_STATUS_EXEMPTION_DEFAULTS.MARRIED_JOINT,
    exemptionPhaseoutStart:
      FILING_STATUS_PHASEOUT_START_DEFAULTS.MARRIED_JOINT,
    exemptionPhaseoutRate: 0.25,
    amtBracketBreakpoint: 232600,
    amtRateLow: 0.26,
    amtRateHigh: 0.28,
    effectiveRegularRate: 0.27,
    ordinaryIncomeEstimate: 350000,
    salePricePerShare: undefined,
    holdingPeriodNote:
      "Held > 1 year from exercise AND > 2 years from grant for long-term ISO qualifying disposition.",
    stateTaxNote:
      "State tax not modeled. Confirm with a qualified tax advisor.",
  };
}

export function defaultAmtSettings(): AmtSettings {
  return {
    asOfDate: undefined,
    staleFmvThresholdDays: 90,
    fmvAsOfDate: undefined,
  };
}

// ───────── Date utilities ─────────

export function parseISODate(s: string | undefined | null): Date | null {
  if (!s || typeof s !== "string") return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

export function daysBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ───────── Per-grant evaluation ─────────

export function evaluateGrant(grant: IsoGrantRow): GrantWithBargain {
  const exceptions: AmtExceptionFlag[] = [];
  const strike = Math.max(0, grant.strike);
  const fmv = Math.max(0, grant.currentFmv);
  const exercisable = Math.max(0, Math.round(grant.sharesExercisable));
  const proposed = Math.max(0, Math.round(grant.proposedExerciseShares));
  if (strike <= 0) {
    exceptions.push({
      type: "MISSING_STRIKE",
      rowId: grant.rowId,
      message:
        "Strike price is missing or zero. Bargain element cannot be computed; row excluded from totals.",
    });
  }
  if (fmv <= 0) {
    exceptions.push({
      type: "MISSING_FMV",
      rowId: grant.rowId,
      message:
        "FMV is missing or zero. Bargain element cannot be computed; row excluded from totals.",
    });
  }
  if (proposed <= 0) {
    exceptions.push({
      type: "ZERO_PROPOSED_SHARES",
      rowId: grant.rowId,
      message:
        "Proposed exercise shares is zero. Confirm intent; row contributes $0 to totals.",
    });
  }
  if (exercisable > 0 && proposed > exercisable) {
    exceptions.push({
      type: "EXERCISE_EXCEEDS_EXERCISABLE",
      rowId: grant.rowId,
      message: `Proposed exercise shares (${proposed.toLocaleString()}) exceeds exercisable (${exercisable.toLocaleString()}). Cap or confirm.`,
    });
  }
  const bargainPerShare = strike > 0 && fmv > 0 ? Math.max(0, fmv - strike) : 0;
  const bargainElement = bargainPerShare * proposed;
  const exerciseCost = strike * proposed;
  return {
    ...grant,
    sharesExercisable: exercisable,
    strike,
    currentFmv: fmv,
    proposedExerciseShares: proposed,
    bargainPerShare,
    bargainElement,
    exerciseCost,
    exceptions,
  };
}

// ───────── Aggregate analysis ─────────

/** Apply phaseout to the AMT exemption. */
export function applyExemptionPhaseout(
  amtIncome: number,
  exemption: number,
  phaseoutStart: number,
  phaseoutRate: number,
): number {
  if (amtIncome <= phaseoutStart) return Math.max(0, exemption);
  const reduction = (amtIncome - phaseoutStart) * phaseoutRate;
  return Math.max(0, exemption - reduction);
}

/** Tentative minimum tax = bracket-rate AMTI-after-exemption. */
export function tentativeMinimumTax(
  amtiAfterExemption: number,
  bracketBreakpoint: number,
  rateLow: number,
  rateHigh: number,
): number {
  if (amtiAfterExemption <= 0) return 0;
  if (amtiAfterExemption <= bracketBreakpoint) {
    return amtiAfterExemption * rateLow;
  }
  return (
    bracketBreakpoint * rateLow +
    (amtiAfterExemption - bracketBreakpoint) * rateHigh
  );
}

/**
 * Compute a planning-grade breakeven: how many of the proposed
 * exercise shares could be exercised before AMT exposure would push
 * above $0. Uses the same proportional bargain ratio across the row
 * set as the user supplied; not a per-row optimization. Returns 0
 * when there is no bargain, when exposure is already zero with zero
 * shares, or when the math would require negative shares.
 */
export function planningBreakevenShares(
  rows: GrantWithBargain[],
  ordinaryIncome: number,
  exemption: number,
  phaseoutStart: number,
  phaseoutRate: number,
  bracketBreakpoint: number,
  rateLow: number,
  rateHigh: number,
  regularRate: number,
): { shares: number; note: string } {
  const totalProposedShares = rows.reduce(
    (s, r) => s + r.proposedExerciseShares,
    0,
  );
  if (totalProposedShares <= 0) {
    return { shares: 0, note: "No proposed exercise shares to evaluate." };
  }
  const totalBargain = rows.reduce((s, r) => s + r.bargainElement, 0);
  if (totalBargain <= 0) {
    return {
      shares: 0,
      note: "No bargain element across the population (FMV ≤ strike on every grant). AMT is not the binding constraint.",
    };
  }
  // Binary-search for the largest multiplier m in [0, 1] where
  // exposure(m × shares) <= 0. Coarse to keep the engine deterministic
  // and fast; planning-grade only.
  const eps = 1; // 1 share resolution
  let lo = 0;
  let hi = totalProposedShares;
  // Quick sanity: if exposure at 0 shares already > 0, breakeven is 0.
  const exposureAtZero = exposureFor(
    0,
    totalProposedShares,
    totalBargain,
    ordinaryIncome,
    exemption,
    phaseoutStart,
    phaseoutRate,
    bracketBreakpoint,
    rateLow,
    rateHigh,
    regularRate,
  );
  if (exposureAtZero > 0) {
    return {
      shares: 0,
      note: "AMT exposure is already positive on ordinary income alone; the proposed exercise can only widen the gap. Confirm the regular tax rate slider against an actual projection.",
    };
  }
  // If exposure at the full proposed shares is still <= 0, the entire
  // proposed amount is breakeven-safe.
  const exposureAtFull = exposureFor(
    totalProposedShares,
    totalProposedShares,
    totalBargain,
    ordinaryIncome,
    exemption,
    phaseoutStart,
    phaseoutRate,
    bracketBreakpoint,
    rateLow,
    rateHigh,
    regularRate,
  );
  if (exposureAtFull <= 0) {
    return {
      shares: totalProposedShares,
      note: "AMT exposure stays at $0 across the full proposed exercise. The regular-tax estimate dominates the tentative minimum tax at this assumption set.",
    };
  }
  // Standard binary search (O(log totalProposedShares)).
  while (hi - lo > eps) {
    const mid = Math.floor((lo + hi) / 2);
    const exposure = exposureFor(
      mid,
      totalProposedShares,
      totalBargain,
      ordinaryIncome,
      exemption,
      phaseoutStart,
      phaseoutRate,
      bracketBreakpoint,
      rateLow,
      rateHigh,
      regularRate,
    );
    if (exposure <= 0) lo = mid;
    else hi = mid;
  }
  return {
    shares: lo,
    note: `Planning-grade breakeven assumes proportional scale-down across grants. Above this share count the tentative minimum tax exceeds the regular-tax estimate.`,
  };
}

function exposureFor(
  shares: number,
  totalProposedShares: number,
  totalBargain: number,
  ordinaryIncome: number,
  exemption: number,
  phaseoutStart: number,
  phaseoutRate: number,
  bracketBreakpoint: number,
  rateLow: number,
  rateHigh: number,
  regularRate: number,
): number {
  const fraction = totalProposedShares > 0 ? shares / totalProposedShares : 0;
  const bargain = totalBargain * fraction;
  const amti = ordinaryIncome + bargain;
  const ex = applyExemptionPhaseout(amti, exemption, phaseoutStart, phaseoutRate);
  const after = Math.max(0, amti - ex);
  const tmt = tentativeMinimumTax(after, bracketBreakpoint, rateLow, rateHigh);
  const regularTax = ordinaryIncome * regularRate;
  return tmt - regularTax;
}

export function analyzeAmt(
  grants: IsoGrantRow[],
  assumptions: AmtAssumptions,
  settings: AmtSettings,
): AmtAnalysis {
  const evaluated = grants.map((g) => evaluateGrant(g));
  const totals = {
    proposedExerciseShares: evaluated.reduce(
      (s, r) => s + r.proposedExerciseShares,
      0,
    ),
    totalExerciseCost: evaluated.reduce((s, r) => s + r.exerciseCost, 0),
    totalBargainElement: evaluated.reduce((s, r) => s + r.bargainElement, 0),
  };
  const amti = assumptions.ordinaryIncomeEstimate + totals.totalBargainElement;
  const exemptionAfterPhaseout = applyExemptionPhaseout(
    amti,
    assumptions.amtExemption,
    assumptions.exemptionPhaseoutStart,
    assumptions.exemptionPhaseoutRate,
  );
  const amtiAfterExemption = Math.max(0, amti - exemptionAfterPhaseout);
  const tmt = tentativeMinimumTax(
    amtiAfterExemption,
    assumptions.amtBracketBreakpoint,
    assumptions.amtRateLow,
    assumptions.amtRateHigh,
  );
  const regularTaxEstimate =
    assumptions.ordinaryIncomeEstimate * assumptions.effectiveRegularRate;
  const amtExposure = Math.max(0, tmt - regularTaxEstimate);

  const breakeven = planningBreakevenShares(
    evaluated,
    assumptions.ordinaryIncomeEstimate,
    assumptions.amtExemption,
    assumptions.exemptionPhaseoutStart,
    assumptions.exemptionPhaseoutRate,
    assumptions.amtBracketBreakpoint,
    assumptions.amtRateLow,
    assumptions.amtRateHigh,
    assumptions.effectiveRegularRate,
  );

  // Scenario-level exceptions.
  const exceptions: AmtExceptionFlag[] = evaluated.flatMap((r) => r.exceptions);
  if (settings.fmvAsOfDate) {
    const fmvDate = parseISODate(settings.fmvAsOfDate);
    const asOf = parseISODate(settings.asOfDate ?? todayISO()) ?? new Date();
    if (fmvDate) {
      const age = daysBetween(fmvDate, asOf);
      if (age >= settings.staleFmvThresholdDays) {
        exceptions.push({
          type: "STALE_FMV",
          message: `FMV reference is ${age} days old (threshold: ${settings.staleFmvThresholdDays}). Confirm against the most recent 409A or trading-day close.`,
        });
      }
    }
  }
  if (assumptions.amtRateLow > assumptions.amtRateHigh) {
    exceptions.push({
      type: "UNSUPPORTED_ASSUMPTION",
      message:
        "Low AMT bracket rate exceeds the high bracket rate. Bracket math will produce a non-monotonic curve; confirm the inputs.",
    });
  }
  if (
    assumptions.effectiveRegularRate < 0 ||
    assumptions.effectiveRegularRate > 1
  ) {
    exceptions.push({
      type: "UNSUPPORTED_ASSUMPTION",
      message:
        "Effective regular rate is outside [0, 1]. Re-enter as a decimal (0.27 = 27%).",
    });
  }

  // Optional sale scenario.
  let saleScenario: AmtAnalysis["saleScenario"];
  if (
    typeof assumptions.salePricePerShare === "number" &&
    assumptions.salePricePerShare > 0
  ) {
    const totalSpread = evaluated.reduce(
      (s, r) =>
        s +
        Math.max(0, assumptions.salePricePerShare! - r.currentFmv) *
          r.proposedExerciseShares,
      0,
    );
    saleScenario = {
      salePricePerShare: assumptions.salePricePerShare,
      saleSpreadValue: totalSpread,
      cashLiquidityForAmt: amtExposure,
      note:
        "Planning-grade only. Tax on a subsequent sale (qualifying vs disqualifying disposition) is not modeled. Bring to a qualified tax advisor.",
    };
  }

  return {
    rows: evaluated,
    totals,
    computation: {
      amtIncome: amti,
      exemptionAfterPhaseout,
      amtiAfterExemption,
      tentativeMinimumTax: tmt,
      regularTaxEstimate,
      amtExposure,
      breakevenExerciseShares: breakeven.shares,
      breakevenNote: breakeven.note,
    },
    saleScenario,
    exceptions,
    assumptions,
    settings,
  };
}

// ───────── Memo composition ─────────

export function composeAmtMemo(analysis: AmtAnalysis): string {
  const { rows, totals, computation, assumptions, settings, saleScenario, exceptions } = analysis;
  const lines: string[] = [];
  lines.push("# AMT scenario — planning memo");
  lines.push("");
  lines.push(
    "Educational planning model. Not legal, tax, accounting, or financial advice. State tax is not modeled. AMT credit carryforward is not modeled. The employee needs a qualified tax advisor for any actual filing decision. The output below is a starting point for the conversation between the equity holder, TR, and the tax advisor.",
  );
  lines.push("");

  // 1. Inputs and assumptions
  lines.push("## 1. Inputs and assumptions");
  lines.push(`- Filing status: ${FILING_STATUS_LABEL[assumptions.filingStatus]}`);
  lines.push(`- AMT exemption: ${formatUSD(assumptions.amtExemption)}`);
  lines.push(
    `- Exemption phaseout: starts at AMTI ${formatUSD(assumptions.exemptionPhaseoutStart)}, ${(assumptions.exemptionPhaseoutRate * 100).toFixed(1)}¢ reduction per $1 above`,
  );
  lines.push(
    `- AMT brackets: ${(assumptions.amtRateLow * 100).toFixed(1)}% up to AMTI-after-exemption ${formatUSD(assumptions.amtBracketBreakpoint)}, then ${(assumptions.amtRateHigh * 100).toFixed(1)}%`,
  );
  lines.push(
    `- Effective regular tax rate (planning slider): ${(assumptions.effectiveRegularRate * 100).toFixed(1)}%`,
  );
  lines.push(
    `- Ordinary income estimate (excludes ISO bargain): ${formatUSD(assumptions.ordinaryIncomeEstimate)}`,
  );
  if (settings.fmvAsOfDate) {
    lines.push(`- FMV as-of: ${settings.fmvAsOfDate}`);
  }
  lines.push(
    `- Holding period note: ${assumptions.holdingPeriodNote ?? "(none)"}`,
  );
  lines.push(
    `- State tax note: ${assumptions.stateTaxNote ?? "State tax not modeled."}`,
  );
  lines.push("");

  // 2. Per-grant bargain
  lines.push("## 2. Per-grant bargain element");
  if (rows.length === 0) {
    lines.push("- (no grants in scope)");
  } else {
    rows.forEach((r) => {
      const id = r.grantId || r.rowId;
      lines.push(
        `- **${id}** — proposed ${r.proposedExerciseShares.toLocaleString()} shares · strike ${formatUSD(r.strike)} · FMV ${formatUSD(r.currentFmv)} · bargain/share ${formatUSD(r.bargainPerShare)} · bargain ${formatUSD(r.bargainElement)} · exercise cost ${formatUSD(r.exerciseCost)}`,
      );
    });
  }
  lines.push("");

  // 3. Totals
  lines.push("## 3. Totals at the proposed exercise");
  lines.push(
    `- Proposed exercise shares: ${totals.proposedExerciseShares.toLocaleString()}`,
  );
  lines.push(
    `- Total exercise cost (cash to the company): ${formatUSD(totals.totalExerciseCost)}`,
  );
  lines.push(
    `- Total bargain element (added to AMTI): ${formatUSD(totals.totalBargainElement)}`,
  );
  lines.push("");

  // 4. AMT computation
  lines.push("## 4. Regular vs tentative minimum tax (planning)");
  lines.push(`- AMTI proxy = ordinary income + bargain element: ${formatUSD(computation.amtIncome)}`);
  lines.push(
    `- AMT exemption after phaseout: ${formatUSD(computation.exemptionAfterPhaseout)}`,
  );
  lines.push(
    `- AMTI after exemption: ${formatUSD(computation.amtiAfterExemption)}`,
  );
  lines.push(
    `- Tentative minimum tax (TMT): ${formatUSD(computation.tentativeMinimumTax)}`,
  );
  lines.push(
    `- Regular tax estimate (planning slider × ordinary income): ${formatUSD(computation.regularTaxEstimate)}`,
  );
  lines.push(
    `- **AMT exposure = max(0, TMT − regular): ${formatUSD(computation.amtExposure)}**`,
  );
  lines.push("");

  // 5. Breakeven / liquidity
  lines.push("## 5. Breakeven and liquidity (planning-grade)");
  lines.push(
    `- Planning breakeven shares (proportional scale across grants): ${computation.breakevenExerciseShares.toLocaleString()}`,
  );
  lines.push(`- ${computation.breakevenNote}`);
  lines.push(
    `- Cash needed to cover the AMT exposure (informational): ${formatUSD(computation.amtExposure)}`,
  );
  if (saleScenario) {
    lines.push("");
    lines.push("### Sale scenario");
    lines.push(
      `- Sale price per share: ${formatUSD(saleScenario.salePricePerShare)}`,
    );
    lines.push(
      `- Sale spread vs FMV at exercise on proposed shares: ${formatUSD(saleScenario.saleSpreadValue)}`,
    );
    lines.push(`- Note: ${saleScenario.note}`);
  }
  lines.push("");

  // 6. Exceptions
  if (exceptions.length > 0) {
    lines.push("## 6. Exceptions");
    exceptions.forEach((e) => {
      const ref = e.rowId ? ` (${e.rowId})` : "";
      lines.push(`- ${EXCEPTION_LABEL[e.type]}${ref}: ${e.message}`);
    });
    lines.push("");
  }

  // Recommended next steps
  lines.push("## Recommended next steps");
  lines.push(
    "1. **Qualified tax advisor.** This is a planning model, not a filing recommendation. Bring the assumption set + the per-grant bargain table to the advisor.",
  );
  lines.push(
    "2. **State tax.** Model the state surcharge against the full bargain element for the year of exercise.",
  );
  lines.push(
    "3. **Liquidity plan.** If the AMT exposure exceeds available cash, walk options (sell-to-cover the next vest, exercise less, exercise across two tax years).",
  );
  lines.push(
    "4. **Holding period.** Confirm the long-term ISO qualifying-disposition criteria (held > 1 year from exercise AND > 2 years from grant) and the disqualifying-disposition implications.",
  );
  lines.push(
    "5. **Document the assumption set.** Save the assumption sheet alongside the memo so the advisor can stress-test the same scenario against their own projection.",
  );
  lines.push("");

  // Disclaimer
  lines.push("## Disclaimer");
  lines.push(
    "This is a deterministic planning model. AMT credit carryforward, capital gains tax on a subsequent sale, state and local tax, AMT preference items beyond the ISO bargain element, and any individual deduction or credit are out of scope. The employee needs a qualified tax advisor.",
  );

  return lines.join("\n");
}

// ───────── CSV ─────────

export function rowsToCsv(rows: GrantWithBargain[]): string {
  const header = [
    "Row ID",
    "Grant ID",
    "Grant Date",
    "Shares Exercisable",
    "Strike",
    "Current FMV",
    "Proposed Exercise Shares",
    "Bargain Per Share",
    "Bargain Element",
    "Exercise Cost",
    "Exception Count",
    "Exceptions",
  ].join(",");
  const out = rows.map((r) =>
    [
      csvEscape(r.rowId),
      csvEscape(r.grantId ?? ""),
      csvEscape(r.grantDate ?? ""),
      r.sharesExercisable,
      r.strike,
      r.currentFmv,
      r.proposedExerciseShares,
      Number(r.bargainPerShare.toFixed(4)),
      Math.round(r.bargainElement),
      Math.round(r.exerciseCost),
      r.exceptions.length,
      csvEscape(
        r.exceptions
          .map((e) => `${EXCEPTION_LABEL[e.type]}: ${e.message}`)
          .join(" | "),
      ),
    ].join(","),
  );
  return [header, ...out].join("\n");
}

// ───────── Helpers ─────────

function csvEscape(s: string | number): string {
  const str = String(s);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export { formatUSD as formatUsd };
