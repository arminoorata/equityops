/**
 * Hire Range Equity Calculator engine. Pure functions only — no
 * React, no I/O, no AI. Takes a hire scenario (level, function, geo,
 * target dollar value, FMV, vesting pattern, range philosophy) and
 * returns a deterministic share count, a low / mid / high offer
 * range, a vesting schedule table, an annualized vest value, and an
 * offer memo / recruiter talking-points block.
 *
 * What this is NOT:
 *   - Not a system of record. Nothing is persisted.
 *   - Not employee financial advice. The output is internal recruiter /
 *     TR partner work product, not a personalized investment opinion.
 *   - Not an offer. Real offers are governed by the company plan
 *     document, level + geo guidelines, comp committee authority, and
 *     legal review.
 *   - Not a forward-looking valuation. Annualized vest value uses the
 *     current FMV; it does not project share-price growth.
 */

// ───────── Types ─────────

export type VestingPattern =
  | "FOUR_YEAR_25_25_25_25"
  | "FOUR_YEAR_1_CLIFF_EQUAL"
  | "FOUR_YEAR_BACK_LOADED_10_20_30_40"
  | "FOUR_YEAR_FRONT_LOADED_40_30_20_10"
  | "THREE_YEAR_33_33_34"
  | "FIVE_YEAR_20_EACH";

export type RangePhilosophy =
  /** Mid = target; low = target × lowMult; high = target × highMult. */
  | "MULTIPLIER"
  /** Mid = target; low/high are absolute dollar deltas. */
  | "ABSOLUTE_BAND";

export type RangeSettings =
  | {
      kind: "MULTIPLIER";
      lowMult: number;
      highMult: number;
    }
  | {
      kind: "ABSOLUTE_BAND";
      lowDelta: number;
      highDelta: number;
    };

export type HireScenario = {
  /** Display only. */
  candidateName?: string;
  level: string;
  function?: string;
  /** ISO country, free text. */
  country?: string;
  /** Target equity value in dollars (mid of the range). */
  targetEquityValue: number;
  /** FMV per share at the time of the offer. */
  fmvPerShare: number;
  /** ISO YYYY-MM-DD when the FMV reference was last updated. */
  fmvAsOfDate?: string;
  /** Vesting pattern (one of the supported labels). */
  vestingPattern: VestingPattern;
  /** Range philosophy. */
  range: RangeSettings;
  /** Round share counts to nearest multiple. Common: 1, 10, 50, 100. */
  shareRoundingIncrement: number;
};

export type HireSettings = {
  /** Stale-FMV threshold in days. Triggers a STALE_FMV exception. */
  staleFmvThresholdDays: number;
  /**
   * Out-of-range guardrails. The TR partner sets a sensible window
   * for the level; values outside trigger an OUT_OF_RANGE exception
   * (info, not blocking).
   */
  guardrailLowDollars?: number;
  guardrailHighDollars?: number;
  /** ISO YYYY-MM-DD; defaults to today. */
  asOfDate?: string;
};

export type HireException =
  | "MISSING_FMV"
  | "STALE_FMV"
  | "OUT_OF_RANGE"
  | "UNSUPPORTED_VESTING"
  | "ZERO_TARGET";

export type HireExceptionFlag = {
  type: HireException;
  message: string;
};

export type RangeQuote = {
  /** Dollar value of this point on the range. */
  dollars: number;
  /** Whole-share count after rounding. */
  shares: number;
};

export type VestingScheduleRow = {
  /** Year index (1-based). */
  year: number;
  /** Cumulative shares vested through this year. */
  cumulativeShares: number;
  /** Shares vesting during this year (delta). */
  yearShares: number;
  /** Year vest value at current FMV (yearShares × FMV). */
  yearValue: number;
  /** Cumulative value through this year. */
  cumulativeValue: number;
};

export type HireQuote = {
  scenario: HireScenario;
  /** Mid (target) point of the range. */
  mid: RangeQuote;
  low: RangeQuote;
  high: RangeQuote;
  /** Vesting schedule based on the MID share count. */
  vestingSchedule: VestingScheduleRow[];
  /** Total years in the schedule. */
  totalYears: number;
  /** Mid-share total value at FMV (sanity-check; equals mid.shares × FMV). */
  midValueAtFmv: number;
  /** Mid annualized vest value (mid total ÷ years). */
  midAnnualizedValue: number;
  /** Days since FMV as-of date (undefined when no asOfDate provided). */
  fmvAgeDays?: number;
  exceptions: HireExceptionFlag[];
};

// ───────── Constants & defaults ─────────

export const VESTING_PATTERN_LABEL: Record<VestingPattern, string> = {
  FOUR_YEAR_25_25_25_25: "4-year, 25/25/25/25",
  FOUR_YEAR_1_CLIFF_EQUAL: "4-year, 1-year cliff then monthly",
  FOUR_YEAR_BACK_LOADED_10_20_30_40: "4-year back-loaded (10/20/30/40)",
  FOUR_YEAR_FRONT_LOADED_40_30_20_10: "4-year front-loaded (40/30/20/10)",
  THREE_YEAR_33_33_34: "3-year, 33/33/34",
  FIVE_YEAR_20_EACH: "5-year, 20/20/20/20/20",
};

export const VESTING_PATTERN_BREAKDOWN: Record<VestingPattern, number[]> = {
  // Each array sums to 1.0 and represents the year-by-year vesting fraction.
  FOUR_YEAR_25_25_25_25: [0.25, 0.25, 0.25, 0.25],
  FOUR_YEAR_1_CLIFF_EQUAL: [0.25, 0.25, 0.25, 0.25],
  FOUR_YEAR_BACK_LOADED_10_20_30_40: [0.1, 0.2, 0.3, 0.4],
  FOUR_YEAR_FRONT_LOADED_40_30_20_10: [0.4, 0.3, 0.2, 0.1],
  THREE_YEAR_33_33_34: [0.33, 0.33, 0.34],
  FIVE_YEAR_20_EACH: [0.2, 0.2, 0.2, 0.2, 0.2],
};

export const EXCEPTION_LABEL: Record<HireException, string> = {
  MISSING_FMV: "Missing FMV",
  STALE_FMV: "Stale FMV reference",
  OUT_OF_RANGE: "Out of guardrail range",
  UNSUPPORTED_VESTING: "Unsupported vesting pattern",
  ZERO_TARGET: "Zero target value",
};

export function defaultHireSettings(): HireSettings {
  return {
    staleFmvThresholdDays: 90,
    guardrailLowDollars: undefined,
    guardrailHighDollars: undefined,
    asOfDate: undefined,
  };
}

export function defaultRangeSettings(): RangeSettings {
  return { kind: "MULTIPLIER", lowMult: 0.85, highMult: 1.15 };
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

// ───────── Share rounding ─────────

export function roundShareCount(rawShares: number, increment: number): number {
  if (!Number.isFinite(rawShares)) return 0;
  if (rawShares <= 0) return 0;
  if (increment <= 1) return Math.round(rawShares);
  return Math.round(rawShares / increment) * increment;
}

// ───────── Quote computation ─────────

function quoteFor(
  dollars: number,
  fmv: number,
  rounding: number,
): RangeQuote {
  if (!fmv || fmv <= 0) {
    return { dollars: Math.max(0, Math.round(dollars)), shares: 0 };
  }
  const shares = roundShareCount(dollars / fmv, rounding);
  return { dollars: Math.max(0, Math.round(dollars)), shares };
}

function rangePoints(
  target: number,
  range: RangeSettings,
): { low: number; high: number } {
  if (range.kind === "MULTIPLIER") {
    return { low: target * range.lowMult, high: target * range.highMult };
  }
  return {
    low: Math.max(0, target - range.lowDelta),
    high: target + range.highDelta,
  };
}

// ───────── Vesting schedule ─────────

export function buildVestingSchedule(
  totalShares: number,
  pattern: VestingPattern,
  fmv: number,
): VestingScheduleRow[] {
  const breakdown = VESTING_PATTERN_BREAKDOWN[pattern];
  if (!breakdown) return [];
  const out: VestingScheduleRow[] = [];
  let cumShares = 0;
  let cumValue = 0;
  let allocated = 0;
  // Allocate each year's shares using rounding; ensure the last year
  // absorbs any rounding delta so the total equals totalShares.
  for (let i = 0; i < breakdown.length; i++) {
    const isLast = i === breakdown.length - 1;
    const yearShares = isLast
      ? Math.max(0, totalShares - allocated)
      : Math.round(totalShares * breakdown[i]);
    allocated += yearShares;
    cumShares += yearShares;
    const yearValue = fmv > 0 ? yearShares * fmv : 0;
    cumValue += yearValue;
    out.push({
      year: i + 1,
      yearShares,
      cumulativeShares: cumShares,
      yearValue,
      cumulativeValue: cumValue,
    });
  }
  return out;
}

// ───────── Top-level quote ─────────

export function computeHireQuote(
  scenario: HireScenario,
  settings: HireSettings,
): HireQuote {
  const exceptions: HireExceptionFlag[] = [];
  const fmv = scenario.fmvPerShare;
  const target = scenario.targetEquityValue;
  const rounding = Math.max(1, Math.round(scenario.shareRoundingIncrement));
  const breakdown = VESTING_PATTERN_BREAKDOWN[scenario.vestingPattern];

  if (!fmv || fmv <= 0) {
    exceptions.push({
      type: "MISSING_FMV",
      message:
        "FMV per share is missing or zero. Share counts cannot be computed.",
    });
  }
  if (!target || target <= 0) {
    exceptions.push({
      type: "ZERO_TARGET",
      message:
        "Target equity value is zero. Confirm the offer scope before sharing range output.",
    });
  }
  if (!breakdown) {
    exceptions.push({
      type: "UNSUPPORTED_VESTING",
      message:
        "Unsupported vesting pattern. Defaulting schedule to empty; pick a supported pattern from the list.",
    });
  }
  if (
    typeof settings.guardrailLowDollars === "number" &&
    target < settings.guardrailLowDollars
  ) {
    exceptions.push({
      type: "OUT_OF_RANGE",
      message: `Target ${formatUSD(target)} is below the level guardrail (${formatUSD(settings.guardrailLowDollars)}). Confirm before extending an offer.`,
    });
  }
  if (
    typeof settings.guardrailHighDollars === "number" &&
    target > settings.guardrailHighDollars
  ) {
    exceptions.push({
      type: "OUT_OF_RANGE",
      message: `Target ${formatUSD(target)} is above the level guardrail (${formatUSD(settings.guardrailHighDollars)}). Confirm before extending an offer.`,
    });
  }

  // FMV staleness check.
  const fmvAsOf = parseISODate(scenario.fmvAsOfDate);
  const asOf = parseISODate(settings.asOfDate ?? todayISO()) ?? new Date();
  let fmvAgeDays: number | undefined;
  if (fmvAsOf) {
    fmvAgeDays = daysBetween(fmvAsOf, asOf);
    if (fmvAgeDays >= settings.staleFmvThresholdDays) {
      exceptions.push({
        type: "STALE_FMV",
        message: `FMV reference is ${fmvAgeDays} days old (threshold: ${settings.staleFmvThresholdDays}). Confirm against the most recent 409A or trading-day close before extending the offer.`,
      });
    }
  }

  const points = rangePoints(target, scenario.range);
  const mid = quoteFor(target, fmv, rounding);
  const low = quoteFor(points.low, fmv, rounding);
  const high = quoteFor(points.high, fmv, rounding);

  const vestingSchedule = breakdown
    ? buildVestingSchedule(mid.shares, scenario.vestingPattern, fmv)
    : [];
  const totalYears = breakdown ? breakdown.length : 0;
  const midValueAtFmv = mid.shares * (fmv > 0 ? fmv : 0);
  const midAnnualizedValue = totalYears > 0 ? midValueAtFmv / totalYears : 0;

  return {
    scenario,
    mid,
    low,
    high,
    vestingSchedule,
    totalYears,
    midValueAtFmv,
    midAnnualizedValue,
    fmvAgeDays,
    exceptions,
  };
}

// ───────── Memo composition ─────────

/**
 * Compose a recruiter-facing offer memo from the quote. Pure
 * deterministic templating — no AI involved. The memo is the
 * recruiter's internal talking-points block, not a candidate-facing
 * document. Numbers are calibrated to current FMV; they are not
 * projections.
 */
export function composeOfferMemo(quote: HireQuote): string {
  const { scenario, mid, low, high, vestingSchedule, fmvAgeDays } = quote;
  const lines: string[] = [];
  lines.push(
    `# Offer range — ${scenario.candidateName ? scenario.candidateName + ", " : ""}${scenario.level}${scenario.function ? " · " + scenario.function : ""}${scenario.country ? " · " + scenario.country : ""}`,
  );
  lines.push("");
  lines.push(
    "Internal recruiter / TR partner work product. Not a candidate-facing document. Not personalized investment advice. The actual offer is governed by the company plan document, level + geo guidelines, and the comp committee's authority.",
  );
  lines.push("");

  // 1. Inputs and assumptions
  lines.push("## 1. Inputs and assumptions");
  lines.push(`- FMV per share: ${formatUSD(scenario.fmvPerShare)}`);
  if (scenario.fmvAsOfDate) {
    lines.push(
      `- FMV as-of date: ${scenario.fmvAsOfDate}${
        fmvAgeDays !== undefined ? ` (${fmvAgeDays} days old)` : ""
      }`,
    );
  }
  lines.push(`- Vesting pattern: ${VESTING_PATTERN_LABEL[scenario.vestingPattern] ?? scenario.vestingPattern}`);
  lines.push(
    `- Range philosophy: ${
      scenario.range.kind === "MULTIPLIER"
        ? `mid × ${scenario.range.lowMult.toFixed(2)} to mid × ${scenario.range.highMult.toFixed(2)}`
        : `mid ± ${formatUSD(scenario.range.lowDelta)} (low) / ${formatUSD(scenario.range.highDelta)} (high)`
    }`,
  );
  lines.push(
    `- Share rounding: nearest ${scenario.shareRoundingIncrement.toLocaleString()} share${scenario.shareRoundingIncrement === 1 ? "" : "s"}`,
  );
  lines.push("");

  // 2. Range
  lines.push("## 2. Range");
  lines.push(
    `- **Mid (target):** ${formatUSD(mid.dollars)} → ${mid.shares.toLocaleString()} shares`,
  );
  lines.push(
    `- **Low:** ${formatUSD(low.dollars)} → ${low.shares.toLocaleString()} shares`,
  );
  lines.push(
    `- **High:** ${formatUSD(high.dollars)} → ${high.shares.toLocaleString()} shares`,
  );
  lines.push(
    `- Mid total at FMV: ${formatUSD(quote.midValueAtFmv)} (sanity-check: shares × FMV)`,
  );
  if (quote.totalYears > 0) {
    lines.push(
      `- Mid annualized vest value: ${formatUSD(Math.round(quote.midAnnualizedValue))} per year (mid total ÷ ${quote.totalYears} years)`,
    );
  }
  lines.push("");

  // 3. Vesting schedule
  if (vestingSchedule.length > 0) {
    lines.push("## 3. Vesting schedule (mid share count)");
    lines.push("");
    lines.push("| Year | Shares vesting | Cumulative shares | Year value @ FMV | Cumulative value |");
    lines.push("| --- | --- | --- | --- | --- |");
    vestingSchedule.forEach((r) => {
      lines.push(
        `| ${r.year} | ${r.yearShares.toLocaleString()} | ${r.cumulativeShares.toLocaleString()} | ${formatUSD(r.yearValue)} | ${formatUSD(r.cumulativeValue)} |`,
      );
    });
    lines.push("");
  }

  // 4. Recruiter talking points
  lines.push("## 4. Recruiter talking points");
  lines.push(
    "- Frame the equity component as part of total comp, not as a guaranteed dollar outcome. Share-price movement is uncertain.",
  );
  lines.push(
    `- The schedule above shows shares vesting by year at the current FMV (${formatUSD(scenario.fmvPerShare)}). It is not a projection. The candidate's realized value depends on the share price at vest and at sale.`,
  );
  lines.push(
    "- For options (ISO/NSO/SAR): explain the strike-vs-FMV gap and the exercise tax mechanics. AMT exposure on ISO exercise is the most common candidate question.",
  );
  lines.push(
    "- For RSU/PSU/RSA: confirm whether the candidate's geo has any tax-at-vest withholding nuances (US: ordinary income; many EMEA/APAC: PAYE/payroll withholding requirements).",
  );
  lines.push(
    "- Any range deviation outside the level guardrail requires TR partner sign-off and (depending on level) comp committee review.",
  );
  lines.push("");

  // 5. Exceptions
  if (quote.exceptions.length > 0) {
    lines.push("## 5. Exceptions");
    quote.exceptions.forEach((e) => {
      lines.push(`- ${EXCEPTION_LABEL[e.type]}: ${e.message}`);
    });
    lines.push("");
  }

  // Disclaimer
  lines.push("## Disclaimer");
  lines.push(
    "Outputs reflect the inputs and settings typed above. This is internal recruiter / TR partner work product, not a candidate-facing document and not personalized financial, tax, or legal advice. Real offers are governed by the company plan document, level + geo guidelines, and the comp committee's authority. Numbers use the current FMV at face value; they are not projections.",
  );
  return lines.join("\n");
}

// ───────── CSV (single-row summary) ─────────

export function quoteToSummaryCsv(quote: HireQuote): string {
  const { scenario, mid, low, high, vestingSchedule, midAnnualizedValue, totalYears } = quote;
  const header = [
    "Candidate",
    "Level",
    "Function",
    "Country",
    "Target $",
    "FMV",
    "FMV As-Of",
    "Vesting Pattern",
    "Mid Shares",
    "Low Shares",
    "High Shares",
    "Mid $",
    "Low $",
    "High $",
    "Years",
    "Mid Annualized Value",
    "Mid Total at FMV",
    "Exception Count",
    "Exceptions",
  ].join(",");
  const row = [
    csvEscape(scenario.candidateName ?? ""),
    csvEscape(scenario.level),
    csvEscape(scenario.function ?? ""),
    csvEscape(scenario.country ?? ""),
    scenario.targetEquityValue,
    scenario.fmvPerShare,
    csvEscape(scenario.fmvAsOfDate ?? ""),
    VESTING_PATTERN_LABEL[scenario.vestingPattern],
    mid.shares,
    low.shares,
    high.shares,
    mid.dollars,
    low.dollars,
    high.dollars,
    totalYears,
    Math.round(midAnnualizedValue),
    Math.round(quote.midValueAtFmv),
    quote.exceptions.length,
    csvEscape(
      quote.exceptions.map((e) => `${EXCEPTION_LABEL[e.type]}: ${e.message}`).join(" | "),
    ),
  ].join(",");
  // Vesting schedule, one CSV section underneath.
  const vestHeader = "Year,Year Shares,Cumulative Shares,Year Value @ FMV,Cumulative Value";
  const vestRows = vestingSchedule.map((r) =>
    [r.year, r.yearShares, r.cumulativeShares, Math.round(r.yearValue), Math.round(r.cumulativeValue)].join(","),
  );
  return [header, row, "", vestHeader, ...vestRows].join("\n");
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
