/**
 * Grant Distribution Auditor engine. Pure functions only — no React,
 * no I/O, no AI. Takes a population of granted-equity rows and returns
 * a deterministic distribution view across level, function, country,
 * grant year, award type, performance tier, and any optional
 * demographic dimensions the user supplies.
 *
 * What this is NOT:
 *   - Not a system of record. Nothing is persisted.
 *   - Not legal, tax, accounting, financial, compensation, or DEIB
 *     advice. The company plan document, qualified counsel, and the
 *     People / DEIB function control any action taken on the output.
 *   - Not a proxy of disparate-impact analysis. Counts and averages by
 *     cohort do not, on their own, establish or refute pay equity.
 *     The distribution view is a starting point for the conversation
 *     with TR leadership, DEIB, finance, legal, and the comp committee.
 *
 * Demographic fields are intentionally OPTIONAL and treated as
 * sensitive inputs. The tool is client-side only: nothing the user
 * pastes or uploads ever leaves the browser tab.
 */

// ───────── Types ─────────

export type AwardType =
  | "RSU"
  | "PSU"
  | "ISO"
  | "NSO"
  | "RSA"
  | "SAR"
  | "OTHER";

export type GrantRow = {
  rowId: string;
  /** Optional HRIS id from the user's data. */
  employeeId?: string;
  /** Optional name. Free text; never displayed in totals. */
  employeeName?: string;
  /** Job level / band. Required to anchor the distribution view. */
  level: string;
  /** Job family / function. Free text. */
  function?: string;
  country?: string;
  /** Free-text performance tier (Top, High, Meets, etc.). */
  performanceTier?: string;
  /** Award number from the stock administration platform. */
  grantId?: string;
  awardType: AwardType;
  /** ISO YYYY-MM-DD. */
  grantDate?: string;
  shares: number;
  /** FMV at the time of grant. */
  fmvAtGrant?: number;
  /** Current FMV. Used for valuation when row's currentValue is absent. */
  currentFmv?: number;
  /**
   * Override valuation. If undefined, the engine computes
   * shares × (currentFmv ?? settings.defaultFmvPerShare ?? fmvAtGrant).
   */
  currentValue?: number;
  vestingPattern?: string;
  /**
   * Optional demographic dimensions. Free-text dimension name (e.g.,
   * "Gender", "Ethnicity Group", "Generation", "Tenure Band") mapped
   * to the row's bucket value (e.g., "Women", "Asian", "Gen X",
   * "5–10 yrs"). The tool produces a distribution view per dimension
   * the user provides. It does not invent dimensions or buckets.
   */
  demographics?: Record<string, string>;
  notes?: string;
};

export type GrantSettings = {
  /** Default FMV per share. Used when neither currentFmv nor fmvAtGrant is set. */
  defaultFmvPerShare: number;
  /** A grant older than this many years (since grantDate) is "stale" for the audit. */
  staleGrantThresholdYears: number;
  /**
   * Within a (level, function) cohort, a grant whose value exceeds the
   * cohort median × this multiple is flagged UNUSUALLY_HIGH_VALUE.
   * Common starter: 3.0× cohort median.
   */
  outlierValueMultiple: number;
  /**
   * Tiny grants (shares ≤ this number) are not flagged as exceptions
   * even if their per-grant value is very low — they're often
   * legitimate seed grants for new joiners.
   */
  tinyGrantSharesThreshold: number;
  /** ISO YYYY-MM-DD; used for stale-grant calc. Defaults to today. */
  asOfDate?: string;
  /**
   * Concentration analysis: what fraction of the population sits at
   * the top of the value distribution (e.g., 0.10 = top 10%).
   */
  concentrationTopPct: number;
  /**
   * Demographic dimensions the user wants the audit to require. If a
   * row is missing one of these, it gets a MISSING_DEMOGRAPHIC_FIELD
   * exception. Empty array = demographic completeness is not audited.
   */
  requireDemographicDimensions: string[];
};

export type GrantException =
  | "MISSING_LEVEL"
  | "MISSING_GRANT_DATE"
  | "MISSING_FMV"
  | "MISSING_AWARD_TYPE"
  | "ZERO_SHARES"
  | "UNUSUALLY_HIGH_VALUE"
  | "MISSING_DEMOGRAPHIC_FIELD"
  | "STALE_GRANT"
  | "NEEDS_MANUAL_REVIEW";

export type GrantExceptionFlag = {
  type: GrantException;
  message: string;
};

export type GrantWithExceptions = GrantRow & {
  /** shares × FMV (current → fmvAtGrant → settings.defaultFmvPerShare). */
  computedValue: number;
  /** The FMV actually applied for the value calc. Undefined when none usable. */
  fmvUsed?: number;
  exceptions: GrantExceptionFlag[];
  needsManualReview: boolean;
};

export type DistributionBucket = {
  key: string;
  /** Number of grants in this bucket. */
  grantCount: number;
  /** Distinct employees represented by these grants (uses employeeId). */
  employeeCount: number;
  totalShares: number;
  totalValue: number;
  averageValue: number;
  medianValue: number;
  /** Share of total population value held by this bucket. 0..1. */
  shareOfTotalValue: number;
};

export type ConcentrationView = {
  /** Number of employees in the top-N% bucket. */
  topPctEmployeeCount: number;
  /** Total population employee count (for reference). */
  totalEmployeeCount: number;
  /** Share of total population value held by the top-N% bucket. */
  topPctShareOfValue: number;
  /** Gini coefficient on per-employee total value. 0 = even, 1 = perfectly unequal. */
  giniCoefficient: number;
  /** Per-level concentration: share of total value held by each level. */
  byLevelConcentration: Array<{
    level: string;
    employees: number;
    shareOfValue: number;
  }>;
};

export type GrantDistributionAnalysis = {
  rows: GrantWithExceptions[];
  byLevel: DistributionBucket[];
  byFunction: DistributionBucket[];
  byCountry: DistributionBucket[];
  byGrantYear: DistributionBucket[];
  byAwardType: DistributionBucket[];
  byPerformanceTier: DistributionBucket[];
  /** Dimension name → buckets. Empty if no demographic data supplied. */
  byDemographic: Record<string, DistributionBucket[]>;
  summary: {
    grantCount: number;
    employeeCount: number;
    totalShares: number;
    totalValue: number;
    averageValue: number;
    medianValue: number;
    countByException: Record<GrantException, number>;
    rowsWithExceptions: number;
    /** Detected demographic dimensions across the population. */
    demographicDimensions: string[];
  };
  concentration: ConcentrationView;
  settings: GrantSettings;
};

// ───────── Constants & defaults ─────────

export const AWARD_TYPES: AwardType[] = [
  "RSU",
  "PSU",
  "ISO",
  "NSO",
  "RSA",
  "SAR",
  "OTHER",
];

export const EXCEPTION_LABEL: Record<GrantException, string> = {
  MISSING_LEVEL: "Missing level",
  MISSING_GRANT_DATE: "Missing grant date",
  MISSING_FMV: "Missing FMV",
  MISSING_AWARD_TYPE: "Missing award type",
  ZERO_SHARES: "Zero shares",
  UNUSUALLY_HIGH_VALUE: "Unusually high value",
  MISSING_DEMOGRAPHIC_FIELD: "Missing demographic field",
  STALE_GRANT: "Stale grant",
  NEEDS_MANUAL_REVIEW: "Needs manual review",
};

export function defaultGrantSettings(): GrantSettings {
  return {
    defaultFmvPerShare: 50,
    staleGrantThresholdYears: 5,
    outlierValueMultiple: 3,
    tinyGrantSharesThreshold: 50,
    asOfDate: undefined,
    concentrationTopPct: 0.1,
    requireDemographicDimensions: [],
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

export function yearsBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  let years = to.getFullYear() - from.getFullYear();
  const mDiff = to.getMonth() - from.getMonth();
  if (mDiff < 0 || (mDiff === 0 && to.getDate() < from.getDate())) years -= 1;
  return Math.max(0, years);
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ───────── Statistics helpers ─────────

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n % 2 === 1) return sorted[(n - 1) / 2];
  return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

/**
 * Gini coefficient on a non-negative values array. Returns 0 for an
 * even distribution and approaches 1 as concentration rises. Returns 0
 * for empty input or all-zero input. Uses the brute-force formula:
 *   G = (Σ_i Σ_j |x_i - x_j|) / (2 * n^2 * mean)
 * Suitable for the audit-population sizes practitioners will work with
 * here (low thousands; one-off browser sessions).
 */
export function giniCoefficient(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  let sum = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (values[i] < 0) {
      throw new Error("giniCoefficient: negative values are not supported.");
    }
    total += values[i];
    for (let j = 0; j < n; j++) {
      sum += Math.abs(values[i] - values[j]);
    }
  }
  if (total === 0) return 0;
  const mean = total / n;
  return sum / (2 * n * n * mean);
}

// ───────── Per-row evaluation ─────────

/** Resolve the FMV that should be used for a single row's valuation. */
function resolveFmv(
  row: GrantRow,
  settings: GrantSettings,
): number | undefined {
  const candidates = [row.currentFmv, row.fmvAtGrant, settings.defaultFmvPerShare];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c) && c > 0) return c;
  }
  return undefined;
}

export function evaluateRow(
  row: GrantRow,
  settings: GrantSettings,
  asOfDate: Date,
): GrantWithExceptions {
  const exceptions: GrantExceptionFlag[] = [];
  const level = row.level?.trim() ?? "";
  const shares = Math.max(0, Math.round(row.shares));
  const fmv = resolveFmv(row, settings);
  const computedValue =
    typeof row.currentValue === "number" && Number.isFinite(row.currentValue)
      ? Math.max(0, row.currentValue)
      : fmv !== undefined
        ? shares * fmv
        : 0;

  if (!level) {
    exceptions.push({
      type: "MISSING_LEVEL",
      message:
        "Level is missing. Distribution by level cannot include this row; it will appear in a separate (missing) bucket.",
    });
  }
  if (!row.grantDate || !parseISODate(row.grantDate)) {
    exceptions.push({
      type: "MISSING_GRANT_DATE",
      message:
        "Grant date is missing or unparseable. The grant-year distribution and stale-grant check will skip this row.",
    });
  }
  if (fmv === undefined) {
    exceptions.push({
      type: "MISSING_FMV",
      message:
        "FMV is missing for this row and no default is set. Value-based aggregation defaults to $0 for this row.",
    });
  }
  if (!row.awardType) {
    exceptions.push({
      type: "MISSING_AWARD_TYPE",
      message:
        "Award type is missing. Award-type distribution will exclude this row.",
    });
  }
  if (shares === 0) {
    exceptions.push({
      type: "ZERO_SHARES",
      message:
        "Zero shares granted. Confirm whether this is a placeholder row, a forfeiture, or genuine zero.",
    });
  }
  if (row.grantDate) {
    const gd = parseISODate(row.grantDate);
    if (gd) {
      const age = yearsBetween(gd, asOfDate);
      if (age >= settings.staleGrantThresholdYears) {
        exceptions.push({
          type: "STALE_GRANT",
          message: `Grant is ${age} years old (threshold: ${settings.staleGrantThresholdYears}). Confirm whether this grant is still in scope for the audit.`,
        });
      }
    }
  }
  // Required demographic dimensions.
  for (const dim of settings.requireDemographicDimensions) {
    const value = row.demographics?.[dim];
    if (!value || !value.trim()) {
      exceptions.push({
        type: "MISSING_DEMOGRAPHIC_FIELD",
        message: `Demographic dimension "${dim}" is missing. Distribution by ${dim} will exclude this row.`,
      });
    }
  }

  // Manual-review escalation: missing level OR missing award type.
  const needsManualReview = exceptions.some(
    (e) => e.type === "MISSING_LEVEL" || e.type === "MISSING_AWARD_TYPE",
  );

  return {
    ...row,
    shares,
    computedValue,
    fmvUsed: fmv,
    exceptions,
    needsManualReview,
  };
}

// ───────── Aggregation ─────────

function bucketize(
  rows: GrantWithExceptions[],
  keyOf: (r: GrantWithExceptions) => string,
  totalValue: number,
): DistributionBucket[] {
  const map = new Map<
    string,
    {
      values: number[];
      shares: number;
      employees: Set<string>;
      grantCount: number;
    }
  >();
  for (const r of rows) {
    const k = keyOf(r);
    const entry = map.get(k) ?? {
      values: [],
      shares: 0,
      employees: new Set<string>(),
      grantCount: 0,
    };
    entry.values.push(r.computedValue);
    entry.shares += r.shares;
    entry.grantCount += 1;
    if (r.employeeId) entry.employees.add(r.employeeId);
    map.set(k, entry);
  }
  const out: DistributionBucket[] = [];
  map.forEach((v, k) => {
    const total = v.values.reduce((s, x) => s + x, 0);
    out.push({
      key: k,
      grantCount: v.grantCount,
      employeeCount: v.employees.size > 0 ? v.employees.size : v.grantCount,
      totalShares: v.shares,
      totalValue: total,
      averageValue: v.grantCount > 0 ? total / v.grantCount : 0,
      medianValue: median(v.values),
      shareOfTotalValue: totalValue > 0 ? total / totalValue : 0,
    });
  });
  return out.sort((a, b) => b.totalValue - a.totalValue);
}

/**
 * Detect every demographic dimension that appears in the population.
 * Used to drive the demographic distribution views even when the
 * user has not declared which dimensions to require.
 */
function detectDemographicDimensions(rows: GrantRow[]): string[] {
  const dims = new Set<string>();
  for (const r of rows) {
    if (!r.demographics) continue;
    for (const k of Object.keys(r.demographics)) {
      const v = r.demographics[k];
      if (v && v.trim()) dims.add(k);
    }
  }
  return Array.from(dims).sort();
}

/** Apply the cohort outlier flag in a second pass once the distribution is known. */
function applyCohortOutlierFlag(
  rows: GrantWithExceptions[],
  settings: GrantSettings,
): void {
  const cohortMap = new Map<string, number[]>();
  for (const r of rows) {
    if (r.shares <= settings.tinyGrantSharesThreshold) continue;
    const key = `${r.level || "(missing)"}|${r.function || "(missing)"}`;
    const arr = cohortMap.get(key) ?? [];
    arr.push(r.computedValue);
    cohortMap.set(key, arr);
  }
  const cohortMedian = new Map<string, number>();
  cohortMap.forEach((vals, k) => cohortMedian.set(k, median(vals)));
  for (const r of rows) {
    if (r.shares <= settings.tinyGrantSharesThreshold) continue;
    if (r.computedValue <= 0) continue;
    const key = `${r.level || "(missing)"}|${r.function || "(missing)"}`;
    const med = cohortMedian.get(key) ?? 0;
    if (med <= 0) continue;
    const threshold = med * settings.outlierValueMultiple;
    if (r.computedValue > threshold) {
      // Don't double-flag if we somehow already added it.
      if (!r.exceptions.some((e) => e.type === "UNUSUALLY_HIGH_VALUE")) {
        r.exceptions.push({
          type: "UNUSUALLY_HIGH_VALUE",
          message: `Grant value ${formatUSD(r.computedValue)} exceeds ${settings.outlierValueMultiple.toFixed(1)}× the cohort median (${formatUSD(med)}) for ${r.level || "(missing)"} / ${r.function || "(missing)"}. Confirm whether the grant reflects an off-cycle approval, a make-whole, or an outlier worth documenting.`,
        });
      }
    }
  }
}

function computeConcentration(
  rows: GrantWithExceptions[],
  settings: GrantSettings,
): ConcentrationView {
  const perEmployee = new Map<string, { value: number; level: string }>();
  for (const r of rows) {
    const id = r.employeeId || r.rowId; // fall back to grant id grouping when no ee id
    const prev = perEmployee.get(id) ?? { value: 0, level: r.level || "(missing)" };
    prev.value += r.computedValue;
    perEmployee.set(id, prev);
  }
  const employees = Array.from(perEmployee.values());
  const totalValue = employees.reduce((s, e) => s + e.value, 0);
  const sortedDesc = [...employees].sort((a, b) => b.value - a.value);
  const topN = Math.max(1, Math.ceil(employees.length * settings.concentrationTopPct));
  const topSlice = sortedDesc.slice(0, topN);
  const topValue = topSlice.reduce((s, e) => s + e.value, 0);
  const topPctShareOfValue = totalValue > 0 ? topValue / totalValue : 0;

  // By-level concentration.
  const byLevelMap = new Map<string, { employees: number; value: number }>();
  for (const e of employees) {
    const cur = byLevelMap.get(e.level) ?? { employees: 0, value: 0 };
    cur.employees += 1;
    cur.value += e.value;
    byLevelMap.set(e.level, cur);
  }
  const byLevelConcentration = Array.from(byLevelMap.entries())
    .map(([level, v]) => ({
      level,
      employees: v.employees,
      shareOfValue: totalValue > 0 ? v.value / totalValue : 0,
    }))
    .sort((a, b) => b.shareOfValue - a.shareOfValue);

  // Gini.
  const giniValues = employees.map((e) => Math.max(0, e.value));
  const gini = giniCoefficient(giniValues);

  return {
    topPctEmployeeCount: topSlice.length,
    totalEmployeeCount: employees.length,
    topPctShareOfValue,
    giniCoefficient: gini,
    byLevelConcentration,
  };
}

export function analyzeGrantDistribution(
  rows: GrantRow[],
  settings: GrantSettings,
): GrantDistributionAnalysis {
  const asOf = parseISODate(settings.asOfDate ?? todayISO()) ?? new Date();
  const evaluated = rows.map((r) => evaluateRow(r, settings, asOf));
  const totalValue = evaluated.reduce((s, r) => s + r.computedValue, 0);
  applyCohortOutlierFlag(evaluated, settings);

  const byLevel = bucketize(evaluated, (r) => r.level || "(missing)", totalValue);
  const byFunction = bucketize(
    evaluated.filter((r) => r.function && r.function.trim()),
    (r) => r.function!.trim(),
    totalValue,
  );
  const byCountry = bucketize(
    evaluated.filter((r) => r.country && r.country.trim()),
    (r) => r.country!.trim(),
    totalValue,
  );
  const byGrantYear = bucketize(
    evaluated.filter((r) => r.grantDate && parseISODate(r.grantDate)),
    (r) => String(parseISODate(r.grantDate!)!.getFullYear()),
    totalValue,
  ).sort((a, b) => Number(a.key) - Number(b.key));
  const byAwardType = bucketize(
    evaluated.filter((r) => r.awardType),
    (r) => r.awardType,
    totalValue,
  );
  const byPerformanceTier = bucketize(
    evaluated.filter((r) => r.performanceTier && r.performanceTier.trim()),
    (r) => r.performanceTier!.trim(),
    totalValue,
  );

  const dims = detectDemographicDimensions(rows);
  const byDemographic: Record<string, DistributionBucket[]> = {};
  for (const dim of dims) {
    byDemographic[dim] = bucketize(
      evaluated.filter((r) => r.demographics?.[dim] && r.demographics[dim].trim()),
      (r) => r.demographics![dim].trim(),
      totalValue,
    );
  }

  // Aggregate exception counts.
  const countByException: Record<GrantException, number> = {
    MISSING_LEVEL: 0,
    MISSING_GRANT_DATE: 0,
    MISSING_FMV: 0,
    MISSING_AWARD_TYPE: 0,
    ZERO_SHARES: 0,
    UNUSUALLY_HIGH_VALUE: 0,
    MISSING_DEMOGRAPHIC_FIELD: 0,
    STALE_GRANT: 0,
    NEEDS_MANUAL_REVIEW: 0,
  };
  let rowsWithExceptions = 0;
  for (const r of evaluated) {
    if (r.exceptions.length > 0) rowsWithExceptions += 1;
    if (r.needsManualReview) countByException.NEEDS_MANUAL_REVIEW += 1;
    for (const e of r.exceptions) countByException[e.type] += 1;
  }

  const employeeIds = new Set<string>();
  for (const r of evaluated) {
    if (r.employeeId) employeeIds.add(r.employeeId);
  }
  const employeeCount = employeeIds.size > 0 ? employeeIds.size : evaluated.length;
  const grantCount = evaluated.length;
  const totalShares = evaluated.reduce((s, r) => s + r.shares, 0);
  const allValues = evaluated.map((r) => r.computedValue);
  const averageValue = grantCount > 0 ? totalValue / grantCount : 0;
  const medianValue = median(allValues);

  const concentration = computeConcentration(evaluated, settings);

  return {
    rows: evaluated,
    byLevel,
    byFunction,
    byCountry,
    byGrantYear,
    byAwardType,
    byPerformanceTier,
    byDemographic,
    summary: {
      grantCount,
      employeeCount,
      totalShares,
      totalValue,
      averageValue,
      medianValue,
      countByException,
      rowsWithExceptions,
      demographicDimensions: dims,
    },
    concentration,
    settings,
  };
}

// ───────── Memo composition ─────────

/**
 * Compose an audit memo from the analysis. Pure deterministic
 * templating — no AI involved. Sections numbered to map to a typical
 * pre-read packet.
 */
export function composeDistributionMemo(
  analysis: GrantDistributionAnalysis,
): string {
  const { summary, settings, concentration, rows } = analysis;
  const lines: string[] = [];
  lines.push("# Grant distribution audit — planning memo");
  lines.push("");
  lines.push(
    "Educational diagnostic prepared from typed inputs. Not legal, tax, accounting, financial, compensation, or DEIB advice. Counts and averages by cohort are a starting point for the conversation, not a substitute for qualified analysis. Bring this memo to TR leadership, DEIB, finance, legal, and the comp committee for review before any action.",
  );
  lines.push("");

  // ── 1. Inputs and assumptions ──
  lines.push("## 1. Inputs and assumptions");
  lines.push(
    `- Population: ${summary.grantCount.toLocaleString()} grant${summary.grantCount === 1 ? "" : "s"} across ${summary.employeeCount.toLocaleString()} distinct employee${summary.employeeCount === 1 ? "" : "s"}.`,
  );
  lines.push(
    `- Default FMV per share: ${formatUSD(settings.defaultFmvPerShare)} (per-row currentFmv / fmvAtGrant honored where supplied).`,
  );
  lines.push(
    `- Stale-grant threshold: ${settings.staleGrantThresholdYears} years (computed against ${settings.asOfDate ?? todayISO()}).`,
  );
  lines.push(
    `- Cohort outlier rule: grant value > ${settings.outlierValueMultiple.toFixed(1)}× the median for the (level, function) cohort, ignoring grants with ≤ ${settings.tinyGrantSharesThreshold} shares (treated as seed grants).`,
  );
  lines.push(
    `- Concentration threshold: top ${(settings.concentrationTopPct * 100).toFixed(0)}% of employees by total per-employee value.`,
  );
  if (summary.demographicDimensions.length > 0) {
    lines.push(
      `- Demographic dimensions detected in the population: ${summary.demographicDimensions.join(", ")}.`,
    );
  } else {
    lines.push(
      `- Demographic dimensions detected: none. Demographic distribution view skipped.`,
    );
  }
  if (settings.requireDemographicDimensions.length > 0) {
    lines.push(
      `- Required demographic dimensions for completeness check: ${settings.requireDemographicDimensions.join(", ")}.`,
    );
  }
  lines.push("");

  // ── 2. Population summary ──
  lines.push("## 2. Population summary");
  lines.push(`- Total shares granted: ${summary.totalShares.toLocaleString()}`);
  lines.push(`- Total computed value: ${formatUSD(summary.totalValue)}`);
  lines.push(
    `- Average grant value: ${formatUSD(Math.round(summary.averageValue))}`,
  );
  lines.push(
    `- Median grant value: ${formatUSD(Math.round(summary.medianValue))}`,
  );
  lines.push("");

  // ── 3..8. Distribution sections ──
  pushDistributionSection(lines, "3. Distribution by level", analysis.byLevel);
  pushDistributionSection(
    lines,
    "4. Distribution by function",
    analysis.byFunction,
  );
  pushDistributionSection(
    lines,
    "5. Distribution by country",
    analysis.byCountry,
  );
  pushDistributionSection(
    lines,
    "6. Distribution by grant year",
    analysis.byGrantYear,
  );
  pushDistributionSection(
    lines,
    "7. Distribution by award type",
    analysis.byAwardType,
  );
  if (analysis.byPerformanceTier.length > 0) {
    pushDistributionSection(
      lines,
      "8. Distribution by performance tier",
      analysis.byPerformanceTier,
    );
  }

  // ── Demographic distributions (if present) ──
  if (summary.demographicDimensions.length > 0) {
    lines.push("## 9. Distribution by demographic dimension");
    lines.push("");
    lines.push(
      "Counts and averages by cohort. Use as a starting point only; do not infer disparate impact from an unweighted distribution view.",
    );
    lines.push("");
    for (const dim of summary.demographicDimensions) {
      const buckets = analysis.byDemographic[dim] ?? [];
      if (buckets.length === 0) continue;
      lines.push(`### ${dim}`);
      lines.push("");
      buckets.forEach((b) => {
        lines.push(
          `- **${b.key}** — ${b.grantCount.toLocaleString()} grants · ${b.employeeCount.toLocaleString()} employees · ${formatUSD(b.totalValue)} (${(b.shareOfTotalValue * 100).toFixed(1)}% of value) · avg ${formatUSD(Math.round(b.averageValue))} · median ${formatUSD(Math.round(b.medianValue))}`,
        );
      });
      lines.push("");
    }
  }

  // ── Concentration ──
  lines.push("## 10. Concentration");
  lines.push(
    `- Top ${(settings.concentrationTopPct * 100).toFixed(0)}% of employees (${concentration.topPctEmployeeCount.toLocaleString()} of ${concentration.totalEmployeeCount.toLocaleString()}) hold **${(concentration.topPctShareOfValue * 100).toFixed(1)}%** of total computed value.`,
  );
  lines.push(
    `- Gini coefficient on per-employee total value: **${concentration.giniCoefficient.toFixed(3)}** (0 = even, 1 = perfectly unequal).`,
  );
  if (concentration.byLevelConcentration.length > 0) {
    lines.push("");
    lines.push("By level:");
    concentration.byLevelConcentration.forEach((l) => {
      lines.push(
        `- ${l.level} — ${l.employees.toLocaleString()} employees · ${(l.shareOfValue * 100).toFixed(1)}% of value`,
      );
    });
  }
  lines.push("");
  lines.push(narrativeForConcentration(concentration, settings));
  lines.push("");

  // ── Exceptions ──
  lines.push("## 11. Exceptions");
  const exceptionEntries = (
    Object.entries(summary.countByException) as Array<[GrantException, number]>
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

  // ── Rows needing manual review ──
  const reviewRows = rows.filter((r) => r.needsManualReview);
  if (reviewRows.length > 0) {
    lines.push("## 12. Rows needing manual review (top 12)");
    reviewRows.slice(0, 12).forEach((r) => {
      const id = r.employeeId || r.employeeName || r.grantId || r.rowId;
      lines.push(
        `- **${id}** (${r.level || "—"} · ${r.function || "—"} · ${r.awardType || "—"}) — ${r.shares.toLocaleString()} shares · ${formatUSD(r.computedValue)}`,
      );
      r.exceptions.forEach((e) => {
        lines.push(`    - ${EXCEPTION_LABEL[e.type]}: ${e.message}`);
      });
    });
    if (reviewRows.length > 12) {
      lines.push(`- … and ${reviewRows.length - 12} more.`);
    }
    lines.push("");
  }

  // ── Recommended next steps ──
  lines.push("## 13. Recommended next steps");
  lines.push(
    "1. **TR leadership.** Walk the by-level and by-function distributions against the company's grant philosophy and refresh framework. Document the rationale for any concentration that diverges from policy.",
  );
  lines.push(
    "2. **DEIB partner.** If demographic dimensions are present, take the by-dimension distribution to the People / DEIB function for a paired analysis. Counts and averages alone are not a disparate-impact study.",
  );
  lines.push(
    "3. **Finance.** Reconcile the population value to the latest 409A or trading-day reference. Confirm fits the dilution and burn-rate forecast.",
  );
  lines.push(
    "4. **Legal.** Confirm consistency with plan-document share reserve, individual-grant limits, and country-specific restrictions. Confirm any sensitive demographic data handling complies with applicable privacy law and corporate policy.",
  );
  lines.push(
    "5. **Comp committee handoff.** Package this memo with the Stock Plan Health Check (burn-rate / overhang) and the refresh sizing memo if applicable.",
  );
  lines.push("");

  // ── Disclaimer ──
  lines.push("## Disclaimer");
  lines.push(
    "Outputs reflect the inputs and settings typed above. Real audit decisions are governed by the company's plan document, comp committee authority, ASC 718 expense considerations, share-pool runway, dilution targets, applicable employment, securities, and privacy law, and the qualified analysis of the People / DEIB function. This memo is a planning aid, not an approval, and not a disparate-impact study.",
  );

  return lines.join("\n");
}

function pushDistributionSection(
  lines: string[],
  heading: string,
  buckets: DistributionBucket[],
): void {
  lines.push(`## ${heading}`);
  if (buckets.length === 0) {
    lines.push("- (none)");
  } else {
    buckets.forEach((b) => {
      lines.push(
        `- **${b.key}** — ${b.grantCount.toLocaleString()} grants · ${b.employeeCount.toLocaleString()} employees · ${formatUSD(b.totalValue)} (${(b.shareOfTotalValue * 100).toFixed(1)}% of value) · avg ${formatUSD(Math.round(b.averageValue))} · median ${formatUSD(Math.round(b.medianValue))}`,
      );
    });
  }
  lines.push("");
}

function narrativeForConcentration(
  c: ConcentrationView,
  settings: GrantSettings,
): string {
  const pct = c.topPctShareOfValue * 100;
  const fairShare = settings.concentrationTopPct * 100;
  if (c.totalEmployeeCount === 0) return "No employees in scope; concentration analysis skipped.";
  // The interpretation is intentionally cautious. We surface the math
  // and let the practitioner judge — concentration is normal at the
  // top of any equity grant program; the question is whether it is
  // higher or lower than expected for this company at this stage.
  const ratio = pct / fairShare;
  if (ratio < 1.5) {
    return `Concentration is broadly even (top ${fairShare.toFixed(0)}% of employees hold ${pct.toFixed(1)}% of value, ratio ${ratio.toFixed(2)}× even-distribution). Confirm against the company's grant philosophy.`;
  }
  if (ratio < 3) {
    return `Concentration is moderate (top ${fairShare.toFixed(0)}% of employees hold ${pct.toFixed(1)}% of value, ratio ${ratio.toFixed(2)}× even-distribution). Common in companies that grant heavier at senior levels; confirm against the company's grant philosophy.`;
  }
  return `Concentration is high (top ${fairShare.toFixed(0)}% of employees hold ${pct.toFixed(1)}% of value, ratio ${ratio.toFixed(2)}× even-distribution). Common in founder-heavy / pre-IPO populations; review against the comp committee's dilution and ownership philosophy.`;
}

// ───────── CSV output ─────────

export function rowsToCsv(rows: GrantWithExceptions[]): string {
  // Collect demographic dimensions across the population so we can
  // emit a stable column for each one.
  const dims = new Set<string>();
  rows.forEach((r) => {
    if (r.demographics) Object.keys(r.demographics).forEach((d) => dims.add(d));
  });
  const dimList = Array.from(dims).sort();
  const header = [
    "Row ID",
    "Employee ID",
    "Employee Name",
    "Level",
    "Function",
    "Country",
    "Performance Tier",
    "Grant ID",
    "Award Type",
    "Grant Date",
    "Shares",
    "FMV at Grant",
    "Current FMV",
    "FMV Used",
    "Computed Value",
    "Vesting Pattern",
    ...dimList.map((d) => `Demographic: ${d}`),
    "Needs Manual Review",
    "Exception Count",
    "Exceptions",
  ].join(",");
  const out = rows.map((r) =>
    [
      csvEscape(r.rowId),
      csvEscape(r.employeeId ?? ""),
      csvEscape(r.employeeName ?? ""),
      csvEscape(r.level),
      csvEscape(r.function ?? ""),
      csvEscape(r.country ?? ""),
      csvEscape(r.performanceTier ?? ""),
      csvEscape(r.grantId ?? ""),
      r.awardType,
      csvEscape(r.grantDate ?? ""),
      r.shares,
      r.fmvAtGrant ?? "",
      r.currentFmv ?? "",
      r.fmvUsed ?? "",
      Math.round(r.computedValue),
      csvEscape(r.vestingPattern ?? ""),
      ...dimList.map((d) => csvEscape(r.demographics?.[d] ?? "")),
      r.needsManualReview ? "Yes" : "No",
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
