/**
 * ASC 718 Expense Forecaster engine. Pure functions only — no React,
 * no I/O, no AI. Forecasts stock-based compensation expense by
 * reporting period from a population of awards (RSU / PSU / ISO / NSO
 * / SAR / RSA), grant-date fair values, and forfeiture / vesting /
 * probability assumptions.
 *
 * Calculation approach (intentionally directional, not GAAP-final):
 *   - Each award has a service period defined by [serviceStart,
 *     serviceEnd]. Default: serviceStart = grantDate, serviceEnd =
 *     grantDate + vestingTermYears.
 *   - Total expense for the award = sharesGranted × grantDateFairValue
 *     × performance probability factor (default 1.0; PSU < 1.0
 *     when probability is below target).
 *   - Total expense net of forfeitures = expense × (1 − forfeitureRate).
 *     Forfeiture rate is the user-supplied award-level rate (or the
 *     scenario-default fallback). The engine does not separately
 *     amortize over service-period forfeiture timing — directional only.
 *   - Recognition: straight-line attributes the expense uniformly
 *     across the service period; graded vesting uses an
 *     accelerated-attribution shortcut where each tranche is treated
 *     as if it has its own grant-date fair value pro-rata across the
 *     award (front-loaded recognition vs straight-line, common
 *     simplification practitioners use for planning).
 *   - Period buckets are calendar quarters or years (configurable).
 *     Each award contributes a per-day expense over its service
 *     period; the bucketizer sums per-day expense × days-in-period.
 *
 * What this is NOT:
 *   - Not a full ASC 718 expense engine. The defaults are
 *     directional. Real GAAP expense involves modification accounting,
 *     forfeiture true-ups, performance-condition probability changes,
 *     market-condition Monte Carlo valuation, and the company's
 *     accounting policy (true-up vs estimate).
 *   - Not Black-Scholes. The user supplies grant-date fair value;
 *     the engine treats it as the calibrated input.
 *   - Not the company's audited expense. This is a planning forecast
 *     for TR / finance / accounting partners; accounting policy and
 *     external auditor controls the final number.
 */

// ───────── Types ─────────

export type AwardType =
  | "RSU"
  | "PSU"
  | "ISO"
  | "NSO"
  | "SAR"
  | "RSA"
  | "OTHER";

export type VestingPattern =
  | "STRAIGHT_LINE"
  | "GRADED_4_YEAR_25_25_25_25"
  | "GRADED_4_YEAR_1_CLIFF_EQUAL"
  | "GRADED_3_YEAR_33_33_34"
  | "GRADED_5_YEAR_20_EACH";

export type AwardRow = {
  rowId: string;
  awardId?: string;
  awardType: AwardType;
  /** ISO YYYY-MM-DD. Required for service-period default. */
  grantDate?: string;
  shares: number;
  /** Per-share grant-date fair value (the calibrated ASC 718 input). */
  grantDateFairValue: number;
  /** Vesting term in years. Required when serviceStart/End absent. */
  vestingTermYears: number;
  vestingPattern: VestingPattern;
  /** Optional per-award forfeiture rate override (decimal). Default = scenario default. */
  forfeitureRateOverride?: number;
  /** Optional explicit service start (ISO YYYY-MM-DD). */
  serviceStart?: string;
  /** Optional explicit service end (ISO YYYY-MM-DD). */
  serviceEnd?: string;
  /**
   * For PSUs: probability factor 0..1 (or above 1 if max payout is
   * higher than target, capped at the supplied scenario max).
   * Required for PSU; missing → exception. Ignored for non-PSU.
   */
  performanceProbability?: number;
  notes?: string;
};

export type ReportingFrequency = "QUARTERLY" | "ANNUAL";

export type Asc718Settings = {
  /** ISO YYYY-MM-DD. The forecast spans periodStart..periodEnd. */
  periodStart: string;
  periodEnd: string;
  reportingFrequency: ReportingFrequency;
  /** Default forfeiture rate (decimal). Used when an award has no override. */
  defaultForfeitureRate: number;
  /** Cap on PSU performance probability (e.g., 2.0 for max payout). */
  performanceProbabilityCap: number;
};

export type Asc718Exception =
  | "MISSING_FAIR_VALUE"
  | "MISSING_VESTING_TERM"
  | "ZERO_SHARES"
  | "UNSUPPORTED_VESTING"
  | "PSU_MISSING_PROBABILITY"
  | "MISSING_GRANT_DATE"
  | "INVERTED_SERVICE_PERIOD";

export type Asc718ExceptionFlag = {
  type: Asc718Exception;
  rowId?: string;
  message: string;
};

export type AwardWithRecognition = AwardRow & {
  /** Service-period start date the engine actually used. */
  serviceStartUsed?: string;
  /** Service-period end date the engine actually used. */
  serviceEndUsed?: string;
  /** Forfeiture rate the engine actually applied. */
  forfeitureRateUsed: number;
  /** Probability factor the engine actually applied (post-cap). */
  probabilityUsed: number;
  /** Total expected expense over the award's service period. */
  totalExpectedExpense: number;
  /** Expense recognized in the forecast window. */
  expenseInWindow: number;
  /** Remaining unrecognized expense after the window end. */
  remainingExpense: number;
  exceptions: Asc718ExceptionFlag[];
};

export type PeriodBucket = {
  /** ISO YYYY-MM-DD start of the period (inclusive). */
  start: string;
  /** ISO YYYY-MM-DD end of the period (inclusive). */
  end: string;
  /** Display label, e.g. "2026 Q1" or "2026". */
  label: string;
  totalExpense: number;
  /** Expense by award type. */
  byAwardType: Record<AwardType, number>;
};

export type Asc718Analysis = {
  rows: AwardWithRecognition[];
  periods: PeriodBucket[];
  summary: {
    awardCount: number;
    totalExpectedExpense: number;
    totalExpenseInWindow: number;
    totalRemainingExpense: number;
    countByException: Record<Asc718Exception, number>;
    rowsWithExceptions: number;
    byAwardType: Record<AwardType, number>;
    byGrantYear: Array<{ year: number; expense: number }>;
  };
  settings: Asc718Settings;
};

// ───────── Constants & defaults ─────────

export const AWARD_TYPES: AwardType[] = [
  "RSU",
  "PSU",
  "ISO",
  "NSO",
  "SAR",
  "RSA",
  "OTHER",
];

export const VESTING_PATTERN_LABEL: Record<VestingPattern, string> = {
  STRAIGHT_LINE: "Straight-line",
  GRADED_4_YEAR_25_25_25_25: "Graded, 4-year 25/25/25/25",
  GRADED_4_YEAR_1_CLIFF_EQUAL: "Graded, 4-year 1-yr cliff then equal",
  GRADED_3_YEAR_33_33_34: "Graded, 3-year 33/33/34",
  GRADED_5_YEAR_20_EACH: "Graded, 5-year 20/20/20/20/20",
};

export const VESTING_PATTERN_BREAKDOWN: Record<VestingPattern, number[]> = {
  STRAIGHT_LINE: [],
  GRADED_4_YEAR_25_25_25_25: [0.25, 0.25, 0.25, 0.25],
  GRADED_4_YEAR_1_CLIFF_EQUAL: [0.25, 0.25, 0.25, 0.25],
  GRADED_3_YEAR_33_33_34: [0.33, 0.33, 0.34],
  GRADED_5_YEAR_20_EACH: [0.2, 0.2, 0.2, 0.2, 0.2],
};

export const EXCEPTION_LABEL: Record<Asc718Exception, string> = {
  MISSING_FAIR_VALUE: "Missing fair value",
  MISSING_VESTING_TERM: "Missing vesting term",
  ZERO_SHARES: "Zero shares",
  UNSUPPORTED_VESTING: "Unsupported vesting pattern",
  PSU_MISSING_PROBABILITY: "PSU missing probability",
  MISSING_GRANT_DATE: "Missing grant date",
  INVERTED_SERVICE_PERIOD: "Inverted service period",
};

export function defaultAsc718Settings(): Asc718Settings {
  return {
    periodStart: "",
    periodEnd: "",
    reportingFrequency: "QUARTERLY",
    defaultForfeitureRate: 0.05,
    performanceProbabilityCap: 2.0,
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
  )
    return null;
  return dt;
}

function formatISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addYears(d: Date, years: number): Date {
  const out = new Date(d);
  out.setFullYear(out.getFullYear() + years);
  return out;
}

/** Inclusive day count between two ISO dates. */
function daysInclusive(from: Date, to: Date): number {
  if (to.getTime() < from.getTime()) return 0;
  return (
    Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
}

/** Overlap of [a, b] with [c, d], inclusive on both ends. */
function overlapDays(a: Date, b: Date, c: Date, d: Date): number {
  const start = a.getTime() > c.getTime() ? a : c;
  const end = b.getTime() < d.getTime() ? b : d;
  return daysInclusive(start, end);
}

// ───────── Period bucketization ─────────

export function buildPeriods(
  start: Date,
  end: Date,
  freq: ReportingFrequency,
): PeriodBucket[] {
  const out: PeriodBucket[] = [];
  if (end.getTime() < start.getTime()) return out;
  if (freq === "ANNUAL") {
    let y = start.getFullYear();
    const lastY = end.getFullYear();
    while (y <= lastY) {
      const periodStart = new Date(y, 0, 1, 12, 0, 0, 0);
      const periodEnd = new Date(y, 11, 31, 12, 0, 0, 0);
      const clampedStart =
        periodStart.getTime() < start.getTime() ? start : periodStart;
      const clampedEnd = periodEnd.getTime() > end.getTime() ? end : periodEnd;
      out.push({
        start: formatISO(clampedStart),
        end: formatISO(clampedEnd),
        label: String(y),
        totalExpense: 0,
        byAwardType: emptyTypeBucket(),
      });
      y += 1;
    }
    return out;
  }
  // Quarterly.
  let y = start.getFullYear();
  let q = Math.floor(start.getMonth() / 3);
  while (true) {
    const qStart = new Date(y, q * 3, 1, 12, 0, 0, 0);
    const qEnd = new Date(y, q * 3 + 3, 0, 12, 0, 0, 0); // last day of quarter
    if (qStart.getTime() > end.getTime()) break;
    const clampedStart = qStart.getTime() < start.getTime() ? start : qStart;
    const clampedEnd = qEnd.getTime() > end.getTime() ? end : qEnd;
    out.push({
      start: formatISO(clampedStart),
      end: formatISO(clampedEnd),
      label: `${y} Q${q + 1}`,
      totalExpense: 0,
      byAwardType: emptyTypeBucket(),
    });
    q += 1;
    if (q > 3) {
      q = 0;
      y += 1;
    }
  }
  return out;
}

function emptyTypeBucket(): Record<AwardType, number> {
  const r: Record<AwardType, number> = {
    RSU: 0,
    PSU: 0,
    ISO: 0,
    NSO: 0,
    SAR: 0,
    RSA: 0,
    OTHER: 0,
  };
  return r;
}

// ───────── Per-award evaluation ─────────

/**
 * For a graded vesting award, return the per-tranche schedule in
 * absolute dates: [start, end, fraction][].
 *
 * Engine treats each tranche as having its own service sub-period
 * starting at the award's serviceStart and ending at the tranche's
 * vest date (i.e., accelerated attribution / front-loaded recognition).
 * This is a planning-grade approximation; the company's accounting
 * policy may use straight-line or its own attribution method.
 */
function gradedTrancheSchedule(
  serviceStart: Date,
  serviceEnd: Date,
  pattern: VestingPattern,
): Array<{ start: Date; end: Date; fraction: number }> {
  const breakdown = VESTING_PATTERN_BREAKDOWN[pattern];
  if (!breakdown.length) return [];
  const totalSpan = daysInclusive(serviceStart, serviceEnd);
  if (totalSpan <= 1) {
    return [{ start: serviceStart, end: serviceEnd, fraction: 1 }];
  }
  // Each tranche vests at year boundary k of N.
  const N = breakdown.length;
  const out: Array<{ start: Date; end: Date; fraction: number }> = [];
  for (let k = 0; k < N; k++) {
    const trancheEnd = new Date(serviceStart);
    trancheEnd.setFullYear(serviceStart.getFullYear() + (k + 1));
    // Don't run past the service end.
    const cappedEnd =
      trancheEnd.getTime() > serviceEnd.getTime() ? serviceEnd : trancheEnd;
    out.push({
      start: serviceStart,
      end: cappedEnd,
      fraction: breakdown[k],
    });
  }
  return out;
}

export function evaluateAward(
  award: AwardRow,
  settings: Asc718Settings,
): AwardWithRecognition {
  const exceptions: Asc718ExceptionFlag[] = [];
  const shares = Math.max(0, Math.round(award.shares));
  const fairValue = Math.max(0, award.grantDateFairValue);
  const term = Math.max(0, award.vestingTermYears);

  if (fairValue <= 0) {
    exceptions.push({
      type: "MISSING_FAIR_VALUE",
      rowId: award.rowId,
      message:
        "Grant-date fair value is missing or zero. Award contributes $0 to the forecast.",
    });
  }
  if (term <= 0 && !award.serviceStart && !award.serviceEnd) {
    exceptions.push({
      type: "MISSING_VESTING_TERM",
      rowId: award.rowId,
      message:
        "Vesting term is missing and explicit service period not supplied. Cannot place expense; row excluded.",
    });
  }
  if (shares <= 0) {
    exceptions.push({
      type: "ZERO_SHARES",
      rowId: award.rowId,
      message:
        "Zero shares. Award contributes $0 to the forecast; confirm whether it is a placeholder or genuine zero.",
    });
  }
  if (
    award.awardType === "PSU" &&
    (award.performanceProbability === undefined ||
      !Number.isFinite(award.performanceProbability))
  ) {
    exceptions.push({
      type: "PSU_MISSING_PROBABILITY",
      rowId: award.rowId,
      message:
        "PSU is missing a performance probability factor. Defaulting to 1.0 for the forecast; confirm with accounting.",
    });
  }
  if (!award.grantDate || !parseISODate(award.grantDate)) {
    exceptions.push({
      type: "MISSING_GRANT_DATE",
      rowId: award.rowId,
      message:
        "Grant date missing. Service-period default unavailable; supply explicit serviceStart and serviceEnd.",
    });
  }
  if (!VESTING_PATTERN_BREAKDOWN[award.vestingPattern]) {
    exceptions.push({
      type: "UNSUPPORTED_VESTING",
      rowId: award.rowId,
      message:
        "Unsupported vesting pattern. Falling back to straight-line for the forecast.",
    });
  }

  // Resolve service period.
  const grant = parseISODate(award.grantDate ?? null);
  const startDate = parseISODate(award.serviceStart ?? null) ?? grant;
  const endDate =
    parseISODate(award.serviceEnd ?? null) ??
    (startDate ? addYears(startDate, term) : null);
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    exceptions.push({
      type: "INVERTED_SERVICE_PERIOD",
      rowId: award.rowId,
      message:
        "Service end is before service start. Confirm the dates.",
    });
  }

  const forfeitureRateUsed =
    typeof award.forfeitureRateOverride === "number" &&
    Number.isFinite(award.forfeitureRateOverride)
      ? Math.max(0, Math.min(1, award.forfeitureRateOverride))
      : Math.max(0, Math.min(1, settings.defaultForfeitureRate));

  const probabilityRaw =
    award.awardType === "PSU"
      ? typeof award.performanceProbability === "number" &&
        Number.isFinite(award.performanceProbability)
        ? award.performanceProbability
        : 1.0
      : 1.0;
  const probabilityUsed = Math.max(
    0,
    Math.min(settings.performanceProbabilityCap, probabilityRaw),
  );

  const totalExpectedExpense =
    shares * fairValue * probabilityUsed * (1 - forfeitureRateUsed);

  // Place expense in the forecast window.
  let expenseInWindow = 0;
  let remainingExpense = totalExpectedExpense;
  const windowStart = parseISODate(settings.periodStart);
  const windowEnd = parseISODate(settings.periodEnd);
  if (
    startDate &&
    endDate &&
    windowStart &&
    windowEnd &&
    totalExpectedExpense > 0 &&
    endDate.getTime() >= startDate.getTime()
  ) {
    expenseInWindow = recognitionInWindow(
      startDate,
      endDate,
      windowStart,
      windowEnd,
      totalExpectedExpense,
      award.vestingPattern,
    );
    const recognizedToWindowEnd = recognitionInWindow(
      startDate,
      endDate,
      startDate,
      windowEnd,
      totalExpectedExpense,
      award.vestingPattern,
    );
    remainingExpense = Math.max(0, totalExpectedExpense - recognizedToWindowEnd);
  }

  return {
    ...award,
    shares,
    grantDateFairValue: fairValue,
    vestingTermYears: term,
    serviceStartUsed: startDate ? formatISO(startDate) : undefined,
    serviceEndUsed: endDate ? formatISO(endDate) : undefined,
    forfeitureRateUsed,
    probabilityUsed,
    totalExpectedExpense,
    expenseInWindow,
    remainingExpense,
    exceptions,
  };
}

/**
 * Recognize the award's expense between [windowStart, windowEnd]
 * inclusive. Straight-line and graded both decompose into per-tranche
 * straight-line; the bucketizer then sums.
 */
function recognitionInWindow(
  serviceStart: Date,
  serviceEnd: Date,
  windowStart: Date,
  windowEnd: Date,
  totalExpense: number,
  pattern: VestingPattern,
): number {
  if (pattern === "STRAIGHT_LINE" || !VESTING_PATTERN_BREAKDOWN[pattern]?.length) {
    const totalSpan = daysInclusive(serviceStart, serviceEnd);
    if (totalSpan <= 0) return 0;
    const overlap = overlapDays(serviceStart, serviceEnd, windowStart, windowEnd);
    return totalExpense * (overlap / totalSpan);
  }
  // Graded — accelerated attribution per tranche.
  const tranches = gradedTrancheSchedule(serviceStart, serviceEnd, pattern);
  let sum = 0;
  for (const t of tranches) {
    const trancheTotal = totalExpense * t.fraction;
    const span = daysInclusive(t.start, t.end);
    if (span <= 0) continue;
    const overlap = overlapDays(t.start, t.end, windowStart, windowEnd);
    sum += trancheTotal * (overlap / span);
  }
  return sum;
}

// ───────── Aggregate analysis ─────────

export function analyzeAsc718(
  awards: AwardRow[],
  settings: Asc718Settings,
): Asc718Analysis {
  const evaluated = awards.map((a) => evaluateAward(a, settings));
  const periodStart = parseISODate(settings.periodStart);
  const periodEnd = parseISODate(settings.periodEnd);
  const periods =
    periodStart && periodEnd && periodEnd.getTime() >= periodStart.getTime()
      ? buildPeriods(periodStart, periodEnd, settings.reportingFrequency)
      : [];

  // Place each award's expense across periods.
  for (const r of evaluated) {
    if (r.totalExpectedExpense <= 0) continue;
    const sStart = parseISODate(r.serviceStartUsed ?? null);
    const sEnd = parseISODate(r.serviceEndUsed ?? null);
    if (!sStart || !sEnd) continue;
    for (const p of periods) {
      const pStart = parseISODate(p.start);
      const pEnd = parseISODate(p.end);
      if (!pStart || !pEnd) continue;
      const exp = recognitionInWindow(
        sStart,
        sEnd,
        pStart,
        pEnd,
        r.totalExpectedExpense,
        r.vestingPattern,
      );
      p.totalExpense += exp;
      p.byAwardType[r.awardType] += exp;
    }
  }

  // Aggregations.
  const countByException: Record<Asc718Exception, number> = {
    MISSING_FAIR_VALUE: 0,
    MISSING_VESTING_TERM: 0,
    ZERO_SHARES: 0,
    UNSUPPORTED_VESTING: 0,
    PSU_MISSING_PROBABILITY: 0,
    MISSING_GRANT_DATE: 0,
    INVERTED_SERVICE_PERIOD: 0,
  };
  let rowsWithExceptions = 0;
  const byAwardType: Record<AwardType, number> = emptyTypeBucket();
  const byGrantYearMap = new Map<number, number>();
  let totalExpected = 0;
  let totalInWindow = 0;
  let totalRemaining = 0;
  for (const r of evaluated) {
    if (r.exceptions.length > 0) rowsWithExceptions += 1;
    r.exceptions.forEach((e) => (countByException[e.type] += 1));
    byAwardType[r.awardType] += r.totalExpectedExpense;
    const gy = parseISODate(r.grantDate ?? null);
    if (gy) {
      byGrantYearMap.set(
        gy.getFullYear(),
        (byGrantYearMap.get(gy.getFullYear()) ?? 0) + r.totalExpectedExpense,
      );
    }
    totalExpected += r.totalExpectedExpense;
    totalInWindow += r.expenseInWindow;
    totalRemaining += r.remainingExpense;
  }
  const byGrantYear = Array.from(byGrantYearMap.entries())
    .map(([year, expense]) => ({ year, expense }))
    .sort((a, b) => a.year - b.year);

  return {
    rows: evaluated,
    periods,
    summary: {
      awardCount: evaluated.length,
      totalExpectedExpense: totalExpected,
      totalExpenseInWindow: totalInWindow,
      totalRemainingExpense: totalRemaining,
      countByException,
      rowsWithExceptions,
      byAwardType,
      byGrantYear,
    },
    settings,
  };
}

// ───────── Memo composition ─────────

export function composeAsc718Memo(analysis: Asc718Analysis): string {
  const { settings, periods, summary, rows } = analysis;
  const lines: string[] = [];
  lines.push("# ASC 718 expense forecast — planning memo");
  lines.push("");
  lines.push(
    "Educational forecast. Not a GAAP-final accounting estimate. Real ASC 718 expense involves modification accounting, true-up cycles, performance-condition probability changes, market-condition Monte Carlo valuations, and the company's accounting policy. Bring this memo to TR, finance, and accounting; the external auditor controls the final number.",
  );
  lines.push("");

  // 1. Inputs
  lines.push("## 1. Inputs and assumptions");
  lines.push(`- Forecast window: ${settings.periodStart} to ${settings.periodEnd}.`);
  lines.push(
    `- Reporting frequency: ${settings.reportingFrequency === "ANNUAL" ? "Annual" : "Quarterly"}.`,
  );
  lines.push(
    `- Default forfeiture rate: ${(settings.defaultForfeitureRate * 100).toFixed(2)}% (per-award override honored).`,
  );
  lines.push(
    `- PSU probability cap: ${settings.performanceProbabilityCap.toFixed(2)} (caps the user-supplied probability factor).`,
  );
  lines.push(
    `- Recognition: straight-line awards amortize uniformly across service period; graded awards use accelerated attribution per tranche (front-loaded vs straight-line).`,
  );
  lines.push("");

  // 2. Totals
  lines.push("## 2. Totals");
  lines.push(`- Awards in scope: ${summary.awardCount.toLocaleString()}`);
  lines.push(
    `- Total expected expense (net of forfeitures): ${formatUSD(summary.totalExpectedExpense)}`,
  );
  lines.push(
    `- Expense recognized inside the forecast window: ${formatUSD(summary.totalExpenseInWindow)}`,
  );
  lines.push(
    `- Remaining unrecognized after window end: ${formatUSD(summary.totalRemainingExpense)}`,
  );
  lines.push("");

  // 3. By period
  lines.push("## 3. Forecast by period");
  if (periods.length === 0) {
    lines.push("- (no periods — set forecast window in Settings)");
  } else {
    periods.forEach((p) => {
      lines.push(
        `- **${p.label}** (${p.start} to ${p.end}): ${formatUSD(p.totalExpense)}`,
      );
    });
  }
  lines.push("");

  // 4. By award type
  lines.push("## 4. Total expected expense by award type");
  const typeEntries = (
    Object.entries(summary.byAwardType) as Array<[AwardType, number]>
  )
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (typeEntries.length === 0) {
    lines.push("- (none)");
  } else {
    typeEntries.forEach(([t, n]) => {
      lines.push(`- ${t}: ${formatUSD(n)}`);
    });
  }
  lines.push("");

  // 5. By grant year
  lines.push("## 5. Total expected expense by grant year");
  if (summary.byGrantYear.length === 0) {
    lines.push("- (none)");
  } else {
    summary.byGrantYear.forEach((y) => {
      lines.push(`- ${y.year}: ${formatUSD(y.expense)}`);
    });
  }
  lines.push("");

  // 6. Exceptions
  lines.push("## 6. Exceptions");
  const exceptionEntries = (
    Object.entries(summary.countByException) as Array<[Asc718Exception, number]>
  )
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (exceptionEntries.length === 0) {
    lines.push("- No exceptions flagged.");
  } else {
    exceptionEntries.forEach(([t, n]) => {
      lines.push(`- ${EXCEPTION_LABEL[t]}: ${n}`);
    });
  }
  lines.push("");

  // 7. Recommended next steps
  lines.push("## 7. Recommended next steps");
  lines.push(
    "1. **Stock comp accounting.** Reconcile the per-period numbers against the company's accounting policy (true-up vs estimate of forfeiture, attribution method, performance-condition probability re-measurement schedule).",
  );
  lines.push(
    "2. **Finance.** Plug the forecast into the FY budget and the dilution / share-pool model.",
  );
  lines.push(
    "3. **TR.** Reconcile any new grant or modification cycles between this run and the most recent expense schedule from the stock administration platform.",
  );
  lines.push(
    "4. **External auditor review.** The numbers above are directional. Modification accounting (Type I/II/III), market-condition Monte Carlo valuation, and any non-trivial performance-condition probability change is out of scope for this planning forecast.",
  );
  lines.push("");

  // Sample row detail
  if (rows.length > 0) {
    lines.push("## 8. Per-award expected expense (top 20)");
    rows.slice(0, 20).forEach((r) => {
      const id = r.awardId || r.rowId;
      lines.push(
        `- **${id}** (${r.awardType}, ${VESTING_PATTERN_LABEL[r.vestingPattern] ?? r.vestingPattern}) — ${r.shares.toLocaleString()} shares × FV ${formatUSD(r.grantDateFairValue)} × prob ${r.probabilityUsed.toFixed(2)} × (1 − ${r.forfeitureRateUsed.toFixed(2)}) = ${formatUSD(r.totalExpectedExpense)}; in window ${formatUSD(r.expenseInWindow)}; remaining ${formatUSD(r.remainingExpense)}`,
      );
    });
    if (rows.length > 20) {
      lines.push(`- … and ${rows.length - 20} more rows in the results CSV.`);
    }
    lines.push("");
  }

  // Disclaimer
  lines.push("## Disclaimer");
  lines.push(
    "This is a planning forecast, not the company's audited ASC 718 stock-comp expense. Modification accounting, forfeiture true-up cycles, performance-condition probability changes, and market-condition valuation are not modeled. Accounting policy and external auditor review control the final number.",
  );
  return lines.join("\n");
}

// ───────── CSV ─────────

export function rowsToCsv(rows: AwardWithRecognition[]): string {
  const header = [
    "Row ID",
    "Award ID",
    "Award Type",
    "Vesting Pattern",
    "Grant Date",
    "Service Start Used",
    "Service End Used",
    "Shares",
    "Grant Date Fair Value",
    "Forfeiture Rate Used",
    "Probability Used",
    "Total Expected Expense",
    "Expense In Window",
    "Remaining Expense",
    "Exception Count",
    "Exceptions",
  ].join(",");
  const lines = rows.map((r) =>
    [
      csvEscape(r.rowId),
      csvEscape(r.awardId ?? ""),
      r.awardType,
      VESTING_PATTERN_LABEL[r.vestingPattern] ?? r.vestingPattern,
      csvEscape(r.grantDate ?? ""),
      csvEscape(r.serviceStartUsed ?? ""),
      csvEscape(r.serviceEndUsed ?? ""),
      r.shares,
      r.grantDateFairValue,
      r.forfeitureRateUsed,
      r.probabilityUsed,
      Math.round(r.totalExpectedExpense),
      Math.round(r.expenseInWindow),
      Math.round(r.remainingExpense),
      r.exceptions.length,
      csvEscape(
        r.exceptions
          .map((e) => `${EXCEPTION_LABEL[e.type]}: ${e.message}`)
          .join(" | "),
      ),
    ].join(","),
  );
  return [header, ...lines].join("\n");
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
