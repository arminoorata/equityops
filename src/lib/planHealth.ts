/**
 * Stock plan health math. Pure functions only — no React, no state,
 * no I/O. The UI imports from here so the formulas can be unit-tested
 * table-style.
 *
 * Educational diagnostic. Not a replication of ISS, Glass Lewis, or
 * any other proprietary scoring framework. Outputs are inputs to a
 * conversation with legal, finance, and the Compensation Committee.
 *
 * References (general industry practice as of 2026):
 * - Burn rate: gross shares granted in a fiscal year / weighted-average
 *   common shares outstanding for the year. ISS applies size-weighting
 *   factors to options vs full-value awards in EPSC; the lite model
 *   surfaces the unweighted figure and notes the delta in the memo.
 * - Overhang: (outstanding awards + shares available for grant) /
 *   (outstanding awards + shares available for grant + common shares
 *   outstanding). Sometimes shown as fully-diluted percentage.
 * - Reserve runway: shares available / trailing-year grants. A simple
 *   "how many more years can we grant at this rate" measure.
 */

export type PlanHealthInputs = {
  // Annual gross grants in shares (most recent first). Need 3 years
  // for a 3-year average. Year[0] = trailing year, Year[1] = -1,
  // Year[2] = -2.
  annualGrants: [number, number, number];
  // Weighted-average common shares outstanding for the same three
  // years (most recent first). Used as the burn-rate denominator.
  weightedAverageSharesOutstanding: [number, number, number];
  // Common shares outstanding on the balance-sheet date (today's
  // basis for overhang denominator).
  sharesOutstanding: number;
  // Total awards outstanding: unvested options + unvested RSUs/PSUs +
  // vested-but-unexercised options. Used for overhang numerator.
  awardsOutstanding: number;
  // Shares left in the plan reserve, available for future grants.
  sharesAvailableForGrant: number;
  // Plan feature flags. Each affects the narrative and the questions
  // surfaced to legal/finance.
  features: PlanFeatures;
  companyStage: "private" | "public";
  // Optional: company name for the memo. If omitted, the memo uses
  // "the company" generically.
  companyName?: string;
};

export type PlanFeatures = {
  singleTriggerAcceleration: boolean;
  evergreenReserve: boolean;
  repricingWithoutShareholderApproval: boolean;
  // Share recycling = shares tendered for tax withholding or option
  // exercise return to the plan reserve. Considered favorable to the
  // company, less favorable to investors.
  shareRecyclingPermitted: boolean;
  dividendEquivalentsOnUnvested: boolean;
  liberalChangeInControlDefinition: boolean;
  discountedStockOptionsPermitted: boolean;
};

export type BurnRateResult = {
  trailingYear: number; // as a fraction, e.g., 0.012 = 1.2%
  threeYearAverage: number;
};

export type OverhangResult = {
  // (outstanding + available) / (outstanding + available + shares
  // outstanding). Standard "fully-diluted percentage" framing.
  fullyDilutedPct: number;
  // (outstanding + available) / shares outstanding. The looser
  // "investor view" framing.
  investorViewPct: number;
};

export type ReserveRunwayResult = {
  // Years of granting capacity remaining at the trailing-year rate.
  yearsAtTrailingRate: number;
  // Years at the 3-year average rate.
  yearsAtAverageRate: number;
};

export type PlanFeatureFinding = {
  feature: keyof PlanFeatures;
  flagged: boolean;
  // "favorable", "neutral", or "concern" from a typical institutional
  // investor lens.
  toneFromInvestorView: "favorable" | "neutral" | "concern";
  shortLabel: string;
  whyItMatters: string;
};

export type LegalQuestion = {
  triggeredBy: string;
  question: string;
};

export type PlanHealthOutputs = {
  burnRate: BurnRateResult;
  overhang: OverhangResult;
  runway: ReserveRunwayResult;
  featureFindings: PlanFeatureFinding[];
  questionsToAsk: LegalQuestion[];
};

// ───────── Burn rate ─────────

export function computeBurnRate(inputs: PlanHealthInputs): BurnRateResult {
  const trailingYear = safeRatio(
    inputs.annualGrants[0],
    inputs.weightedAverageSharesOutstanding[0],
  );
  const numerator = inputs.annualGrants[0] + inputs.annualGrants[1] + inputs.annualGrants[2];
  const denominator =
    inputs.weightedAverageSharesOutstanding[0] +
    inputs.weightedAverageSharesOutstanding[1] +
    inputs.weightedAverageSharesOutstanding[2];
  return {
    trailingYear,
    threeYearAverage: safeRatio(numerator, denominator),
  };
}

// ───────── Overhang ─────────

export function computeOverhang(inputs: PlanHealthInputs): OverhangResult {
  const totalEquityPool = inputs.awardsOutstanding + inputs.sharesAvailableForGrant;
  const fullyDilutedDenominator = totalEquityPool + inputs.sharesOutstanding;
  return {
    fullyDilutedPct: safeRatio(totalEquityPool, fullyDilutedDenominator),
    investorViewPct: safeRatio(totalEquityPool, inputs.sharesOutstanding),
  };
}

// ───────── Reserve runway ─────────

export function computeReserveRunway(inputs: PlanHealthInputs): ReserveRunwayResult {
  const trailing = inputs.annualGrants[0];
  const avg =
    (inputs.annualGrants[0] + inputs.annualGrants[1] + inputs.annualGrants[2]) / 3;
  return {
    yearsAtTrailingRate: trailing > 0
      ? inputs.sharesAvailableForGrant / trailing
      : Number.POSITIVE_INFINITY,
    yearsAtAverageRate: avg > 0
      ? inputs.sharesAvailableForGrant / avg
      : Number.POSITIVE_INFINITY,
  };
}

// ───────── Plan feature evaluation ─────────

const FEATURE_DEFINITIONS: Record<
  keyof PlanFeatures,
  Pick<PlanFeatureFinding, "shortLabel" | "whyItMatters" | "toneFromInvestorView">
> = {
  singleTriggerAcceleration: {
    shortLabel: "Single-trigger acceleration",
    toneFromInvestorView: "concern",
    whyItMatters:
      "Vesting accelerates on a change of control regardless of whether the executive is terminated. Institutional investors generally prefer double-trigger (acquisition + qualifying termination). Single-trigger is a common red flag in shareholder votes.",
  },
  evergreenReserve: {
    shortLabel: "Evergreen plan reserve",
    toneFromInvestorView: "concern",
    whyItMatters:
      "The plan reserve auto-replenishes each year (commonly 4-5% of shares outstanding). This eliminates the periodic shareholder vote on plan amendments. Public-company shareholders typically vote against evergreen provisions; many private companies use them, then convert at IPO.",
  },
  repricingWithoutShareholderApproval: {
    shortLabel: "Repricing without shareholder approval",
    toneFromInvestorView: "concern",
    whyItMatters:
      "Allows underwater options to be repriced or exchanged without a shareholder vote. ISS and Glass Lewis flag this, and it can drive negative recommendations on the plan and on say-on-pay.",
  },
  shareRecyclingPermitted: {
    shortLabel: "Share recycling permitted",
    toneFromInvestorView: "concern",
    whyItMatters:
      "Shares tendered for tax withholding or option exercise return to the plan reserve. Effectively grows the reserve without a shareholder vote. Considered investor-unfavorable.",
  },
  dividendEquivalentsOnUnvested: {
    shortLabel: "Dividend equivalents paid on unvested awards",
    toneFromInvestorView: "concern",
    whyItMatters:
      "Dividends accrue and pay out before the underlying award vests. Investors generally prefer dividend equivalents only on shares that ultimately vest. ISS counts this in qualitative factors.",
  },
  liberalChangeInControlDefinition: {
    shortLabel: "Liberal change-in-control definition",
    toneFromInvestorView: "concern",
    whyItMatters:
      "Defines change of control loosely (e.g., a small percentage threshold for acquisition, or contested elections that don't change board control). Pairs poorly with single-trigger acceleration.",
  },
  discountedStockOptionsPermitted: {
    shortLabel: "Discounted stock options permitted",
    toneFromInvestorView: "concern",
    whyItMatters:
      "Plan permits options to be granted below fair market value. Creates Section 409A exposure for grantees and is investor-unfavorable.",
  },
};

export function evaluatePlanFeatures(features: PlanFeatures): PlanFeatureFinding[] {
  return (Object.keys(FEATURE_DEFINITIONS) as Array<keyof PlanFeatures>).map(
    (key) => {
      const def = FEATURE_DEFINITIONS[key];
      return {
        feature: key,
        flagged: features[key],
        toneFromInvestorView: def.toneFromInvestorView,
        shortLabel: def.shortLabel,
        whyItMatters: def.whyItMatters,
      };
    },
  );
}

// ───────── Questions to ask legal / finance ─────────

export function buildLegalQuestions(inputs: PlanHealthInputs): LegalQuestion[] {
  const questions: LegalQuestion[] = [];

  if (inputs.features.singleTriggerAcceleration) {
    questions.push({
      triggeredBy: "Single-trigger acceleration",
      question:
        "Confirm with legal whether the change-in-control acceleration is single-trigger or double-trigger across all award agreements (CEO, NEOs, broader population). Investor-facing materials should make this explicit.",
    });
  }
  if (inputs.features.evergreenReserve) {
    questions.push({
      triggeredBy: "Evergreen plan reserve",
      question:
        "Ask legal what the evergreen formula is (percentage of shares outstanding, capped or uncapped, sunset clause). For public companies, plan to convert to a fixed-share reserve at the next plan amendment.",
    });
  }
  if (inputs.features.repricingWithoutShareholderApproval) {
    questions.push({
      triggeredBy: "Repricing without shareholder approval",
      question:
        "Ask legal whether the plan can be amended to require shareholder approval for option repricings or exchange programs. This is a common ISS Equity Plan Scorecard issue.",
    });
  }
  if (inputs.features.shareRecyclingPermitted) {
    questions.push({
      triggeredBy: "Share recycling",
      question:
        "Ask finance to quantify the annual share-recycling impact (shares returning to the reserve from tax withholding or option exercises). This understates the true grant rate.",
    });
  }
  if (inputs.features.liberalChangeInControlDefinition) {
    questions.push({
      triggeredBy: "Liberal change-in-control definition",
      question:
        "Ask legal to walk through the change-in-control trigger thresholds. If the definition is unusually broad, consider tightening at the next plan amendment.",
    });
  }
  if (inputs.features.discountedStockOptionsPermitted) {
    questions.push({
      triggeredBy: "Discounted stock options",
      question:
        "Confirm with legal whether the plan permits discounted options. If yes, ask whether any have been granted, and whether Section 409A documentation is in order. Most modern plans prohibit discounted options outright.",
    });
  }

  // Universal questions (independent of feature flags).
  questions.push({
    triggeredBy: "Burn rate trajectory",
    question:
      "Ask finance for the projected burn rate over the next two fiscal years given hiring plans and refresh cadence. A rising trajectory is a separate concern from the historical figure.",
  });
  questions.push({
    triggeredBy: "Reserve runway",
    question:
      "Ask the equity team how many quarters of granting capacity remain in the plan reserve. If under six quarters, plan amendment timing should be on the next Comp Committee agenda.",
  });

  return questions;
}

// ───────── Top-level health ─────────

export function evaluatePlanHealth(inputs: PlanHealthInputs): PlanHealthOutputs {
  return {
    burnRate: computeBurnRate(inputs),
    overhang: computeOverhang(inputs),
    runway: computeReserveRunway(inputs),
    featureFindings: evaluatePlanFeatures(inputs.features),
    questionsToAsk: buildLegalQuestions(inputs),
  };
}

// ───────── Board memo narrative ─────────

export function buildBoardMemo(
  inputs: PlanHealthInputs,
  outputs: PlanHealthOutputs,
): string {
  const company = inputs.companyName?.trim() || "the company";
  const stage = inputs.companyStage === "public" ? "public" : "private";
  const flagged = outputs.featureFindings.filter((f) => f.flagged);
  const concernsCount = flagged.filter(
    (f) => f.toneFromInvestorView === "concern",
  ).length;

  const lines: string[] = [];
  lines.push(`# Stock Plan Health — ${company}`);
  lines.push("");
  lines.push(
    `Educational diagnostic prepared for the Compensation Committee. Not a proxy advisor model and not a replacement for ISS, Glass Lewis, or any other proprietary scoring framework. Inputs and outputs reflect ${stage}-company practice as of the date the model was run.`,
  );
  lines.push("");

  lines.push("## Headline metrics");
  lines.push("");
  lines.push(
    `- **Trailing-year burn rate:** ${formatPct(outputs.burnRate.trailingYear)}`,
  );
  lines.push(
    `- **3-year average burn rate:** ${formatPct(outputs.burnRate.threeYearAverage)}`,
  );
  lines.push(
    `- **Overhang (fully-diluted view):** ${formatPct(outputs.overhang.fullyDilutedPct)}`,
  );
  lines.push(
    `- **Overhang (investor view):** ${formatPct(outputs.overhang.investorViewPct)}`,
  );
  lines.push(
    `- **Share reserve runway:** ${formatYears(outputs.runway.yearsAtTrailingRate)} at trailing-year rate, ${formatYears(outputs.runway.yearsAtAverageRate)} at 3-year average rate`,
  );
  lines.push("");
  lines.push(
    "Burn rate is the simple unweighted figure (gross shares granted divided by weighted-average common shares outstanding). ISS Equity Plan Scorecard applies size-weighting factors to options vs full-value awards; the figure here is intentionally before that adjustment so the numbers map cleanly to what you'd report internally.",
  );
  lines.push("");

  lines.push("## Plan feature review");
  lines.push("");
  if (flagged.length === 0) {
    lines.push(
      "No flagged plan features. The plan does not include any of the seven investor-concern features the diagnostic checks (single-trigger acceleration, evergreen reserve, repricing without shareholder approval, share recycling, dividend equivalents on unvested awards, liberal change-in-control definition, discounted stock options).",
    );
  } else {
    lines.push(
      `${flagged.length} flagged feature${flagged.length === 1 ? "" : "s"} (${concernsCount} of investor-concern severity):`,
    );
    lines.push("");
    flagged.forEach((finding) => {
      lines.push(`- **${finding.shortLabel}** — ${finding.whyItMatters}`);
    });
  }
  lines.push("");

  lines.push("## Questions for legal and finance");
  lines.push("");
  outputs.questionsToAsk.forEach((q, idx) => {
    lines.push(`${idx + 1}. **${q.triggeredBy}:** ${q.question}`);
  });
  lines.push("");

  lines.push("## Disclaimer");
  lines.push("");
  lines.push(
    "ISS-aware, board-ready diagnostic. Not a proxy advisor model. Inputs are typed; the model does not connect to any system of record. Outputs are starting points for conversations with legal, finance, and external advisors. Not legal, tax, or financial advice.",
  );

  return lines.join("\n");
}

// ───────── Helpers ─────────

function safeRatio(num: number, den: number): number {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;
  return num / den;
}

function formatPct(fraction: number): string {
  if (!Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(2)}%`;
}

function formatYears(years: number): string {
  if (!Number.isFinite(years)) return "indefinite (no recent grants modeled)";
  return `${years.toFixed(1)} years`;
}

// ───────── Sample-company demo ─────────

/**
 * Demo inputs for the "show me what this looks like" path. Modeled on a
 * representative growth-stage public company: ~$2B market cap, 1000-1500
 * employees, plan adopted at IPO, evergreen reserve common at this stage.
 *
 * Numbers are synthetic and rounded for legibility. Don't read into them.
 */
export const SAMPLE_COMPANY: PlanHealthInputs = {
  companyName: "Acme Public Co. (sample)",
  companyStage: "public",
  annualGrants: [3_500_000, 3_000_000, 2_500_000],
  weightedAverageSharesOutstanding: [120_000_000, 115_000_000, 110_000_000],
  sharesOutstanding: 122_000_000,
  awardsOutstanding: 9_500_000,
  sharesAvailableForGrant: 6_000_000,
  features: {
    singleTriggerAcceleration: false,
    evergreenReserve: true,
    repricingWithoutShareholderApproval: false,
    shareRecyclingPermitted: true,
    dividendEquivalentsOnUnvested: false,
    liberalChangeInControlDefinition: false,
    discountedStockOptionsPermitted: false,
  },
};

export const EMPTY_INPUTS: PlanHealthInputs = {
  companyName: "",
  companyStage: "public",
  annualGrants: [0, 0, 0],
  weightedAverageSharesOutstanding: [0, 0, 0],
  sharesOutstanding: 0,
  awardsOutstanding: 0,
  sharesAvailableForGrant: 0,
  features: {
    singleTriggerAcceleration: false,
    evergreenReserve: false,
    repricingWithoutShareholderApproval: false,
    shareRecyclingPermitted: false,
    dividendEquivalentsOnUnvested: false,
    liberalChangeInControlDefinition: false,
    discountedStockOptionsPermitted: false,
  },
};
