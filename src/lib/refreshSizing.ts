/**
 * Refresh Grant Sizing engine. Pure functions only — no React, no I/O,
 * no AI. Takes an employee population, a refresh-guideline matrix
 * (level × performance tier), and global settings, and returns a
 * deterministic per-employee recommendation, a budget summary, and an
 * exception list.
 *
 * The engine is intentionally conservative. Where data is missing or
 * inconsistent, the row is flagged as NEEDS_MANUAL_REVIEW with a
 * specific exception. It never invents a guideline, an FMV, or a
 * proposed amount.
 *
 * Vocabulary is the same vocabulary a Total Rewards practitioner
 * already uses in Excel:
 *   - Level / job band
 *   - Performance tier (Top, High, Meets, Emerging, Below)
 *   - Retention risk (High / Medium / Low)
 *   - Critical role flag (binary)
 *   - Refresh guideline matrix (level × tier → target dollars + band)
 *   - Proposed refresh dollars (manager / TR override)
 *   - FMV per share (used to translate dollars → share count)
 *
 * What this is NOT:
 *   - Not a system of record. Nothing is persisted. The practitioner's
 *     stock administration platform owns the source of truth.
 *   - Not legal, tax, accounting, or compensation advice. Plan
 *     documents, accounting guidance, and qualified counsel control.
 *   - Not an opinion on individual pay. The engine reports the math;
 *     the human approves the action.
 */

// ───────── Types ─────────

export type PerformanceTier =
  | "TOP"
  | "HIGH"
  | "MEETS"
  | "EMERGING"
  | "BELOW"
  | "UNKNOWN";

export type RetentionRisk = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type EmployeeRow = {
  /** Stable client-side row id (not an HRIS id). */
  rowId: string;
  /** Optional HRIS id from the user's data. */
  employeeId?: string;
  /** Optional name. Free text — never displayed in totals. */
  employeeName?: string;
  /** Job level / band. Free text. Required to look up a guideline. */
  level: string;
  /** ISO country (free text). Display only. */
  country?: string;
  /** Total current grant value at FMV. Display only — context. */
  currentEquityValue: number;
  /** Unvested portion at FMV. Display only — context. */
  unvestedValue: number;
  /** ISO YYYY-MM-DD. Used for the stale-grant exception. */
  lastGrantDate?: string;
  /** Last refresh dollars. Display only. */
  priorRefreshDollars: number;
  performanceTier: PerformanceTier;
  retentionRisk: RetentionRisk;
  criticalRoleFlag: boolean;
  /**
   * Practitioner's proposed refresh in dollars, before guideline check.
   * If undefined, the engine seeds it from the matrix target. If the
   * matrix has no target either, the row is flagged MISSING_GUIDELINE.
   */
  proposedRefreshDollars?: number;
  /** Optional per-row FMV override. Falls back to settings.fmvPerShare. */
  fmvPerShare?: number;
  /** Free-text vesting pattern label (e.g., "4yr 25/25/25/25"). Display only. */
  vestingPattern?: string;
  /** Free-text manager / TR notes. Display only. */
  notes?: string;
};

/** A single cell in the refresh guideline matrix. */
export type GuidelineCell = {
  /** Target refresh dollars at this level + tier. */
  targetDollars: number;
  /** Lower bound for "in band". Defaults to bandLowMultiple × target. */
  minDollars?: number;
  /** Upper bound for "in band". Defaults to bandHighMultiple × target. */
  maxDollars?: number;
};

/** Matrix of refresh guidelines. */
export type RefreshGuidelines = {
  /** Ordered level keys (controls the level facet ordering). */
  levels: string[];
  /** Map: level → tier → cell. Missing cells = no guideline for that combo. */
  byLevelByTier: Record<string, Partial<Record<PerformanceTier, GuidelineCell>>>;
  /**
   * Optional band defaults. If a cell omits min/max, the engine uses
   * (target × bandLowMultiple, target × bandHighMultiple).
   */
  bandLowMultiple: number;
  bandHighMultiple: number;
};

export type RefreshSettings = {
  /** Default FMV per share. Used when a row has no per-row override. */
  fmvPerShare: number;
  /** Optional total budget (in dollars). Triggers budget summary. */
  totalBudget?: number;
  /** A "stale grant" is older than this many months from asOfDate. */
  staleGrantThresholdMonths: number;
  /** proposed > target × highOutlierMultiple → WAY_ABOVE_GUIDELINE. */
  highOutlierMultiple: number;
  /** proposed < target × lowOutlierMultiple → WAY_BELOW_GUIDELINE. */
  lowOutlierMultiple: number;
  /** ISO YYYY-MM-DD. Defaults to today. Used for stale-grant calc. */
  asOfDate?: string;
  /** Round share counts to the nearest multiple. Common: 1, 10, 50, 100. */
  shareRoundingIncrement: number;
};

export type ExceptionType =
  | "ABOVE_GUIDELINE"
  | "BELOW_GUIDELINE"
  | "WAY_ABOVE_GUIDELINE"
  | "WAY_BELOW_GUIDELINE"
  | "MISSING_FMV"
  | "MISSING_LEVEL"
  | "MISSING_GUIDELINE"
  | "STALE_LAST_GRANT"
  | "RETENTION_OVERRIDE"
  | "ZERO_VALUE_PROPOSED"
  | "NEEDS_MANUAL_REVIEW";

export type ExceptionFlag = {
  type: ExceptionType;
  /** Human-readable, ready to render in the table or the memo. */
  message: string;
};

export type EmployeeRecommendation = {
  rowId: string;
  employeeId?: string;
  employeeName?: string;
  level: string;
  performanceTier: PerformanceTier;
  retentionRisk: RetentionRisk;
  isCriticalRole: boolean;
  /** The matrix target for this row, if any. */
  guidelineTargetDollars?: number;
  guidelineMinDollars?: number;
  guidelineMaxDollars?: number;
  /** What the engine landed on (could equal proposed or the seeded target). */
  proposedRefreshDollars: number;
  /** True if proposed was seeded from the matrix because input was empty. */
  proposedSeededFromGuideline: boolean;
  /** FMV used for the share-count translation. Undefined when missing. */
  fmvUsed?: number;
  /** Share count = round(proposed / fmv) using settings rounding. Undefined when missing. */
  proposedShareCount?: number;
  /** proposed / target as a percent (e.g., 1.10 = 110%). Undefined when no guideline. */
  pctOfGuideline?: number;
  exceptions: ExceptionFlag[];
  /** Convenience rollup: any exception of severity NEEDS_MANUAL_REVIEW. */
  needsManualReview: boolean;
};

export type LevelSummary = {
  level: string;
  headcount: number;
  totalDollars: number;
  totalShares: number;
  averageDollars: number;
};

export type TierSummary = {
  tier: PerformanceTier;
  headcount: number;
  totalDollars: number;
};

export type RefreshAnalysis = {
  recommendations: EmployeeRecommendation[];
  summary: {
    headcount: number;
    headcountWithExceptions: number;
    totalProposedDollars: number;
    totalProposedShares: number;
    averageProposedDollars: number;
    countByException: Record<ExceptionType, number>;
    byLevel: LevelSummary[];
    byTier: TierSummary[];
    /** Optional, only when settings.totalBudget is set. */
    budgetUsedPct?: number;
    /** proposed - budget. Negative = under budget. */
    budgetVariance?: number;
  };
  settings: RefreshSettings;
};

// ───────── Defaults & helpers ─────────

export const PERFORMANCE_TIER_ORDER: PerformanceTier[] = [
  "TOP",
  "HIGH",
  "MEETS",
  "EMERGING",
  "BELOW",
  "UNKNOWN",
];

export const PERFORMANCE_TIER_LABEL: Record<PerformanceTier, string> = {
  TOP: "Top",
  HIGH: "High",
  MEETS: "Meets",
  EMERGING: "Emerging",
  BELOW: "Below",
  UNKNOWN: "Unknown",
};

export const RETENTION_RISK_LABEL: Record<RetentionRisk, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  UNKNOWN: "Unknown",
};

export const EXCEPTION_LABEL: Record<ExceptionType, string> = {
  ABOVE_GUIDELINE: "Above guideline",
  BELOW_GUIDELINE: "Below guideline",
  WAY_ABOVE_GUIDELINE: "Way above guideline",
  WAY_BELOW_GUIDELINE: "Way below guideline",
  MISSING_FMV: "Missing FMV",
  MISSING_LEVEL: "Missing level",
  MISSING_GUIDELINE: "No guideline for level/tier",
  STALE_LAST_GRANT: "Stale last grant",
  RETENTION_OVERRIDE: "Retention override (justified)",
  ZERO_VALUE_PROPOSED: "Zero-value proposed",
  NEEDS_MANUAL_REVIEW: "Needs manual review",
};

export function defaultSettings(): RefreshSettings {
  return {
    fmvPerShare: 50,
    totalBudget: undefined,
    staleGrantThresholdMonths: 24,
    highOutlierMultiple: 1.5,
    lowOutlierMultiple: 0.5,
    asOfDate: undefined,
    shareRoundingIncrement: 1,
  };
}

/**
 * A reasonable starter matrix for a tech-style company. Practitioners
 * will replace it; this exists so the tool produces a usable result on
 * first paint with sample data.
 */
export function defaultGuidelines(): RefreshGuidelines {
  const levels = ["L3", "L4", "L5", "L6", "L7", "M5", "M6", "M7"];
  const cellFor = (
    target: number,
  ): GuidelineCell => ({ targetDollars: target });
  // Multipliers off MEETS by tier, applied to a level base.
  const tierMultiplier: Record<PerformanceTier, number | null> = {
    TOP: 1.4,
    HIGH: 1.15,
    MEETS: 1.0,
    EMERGING: 0.6,
    BELOW: 0,
    UNKNOWN: null,
  };
  const baseByLevel: Record<string, number> = {
    L3: 12000,
    L4: 22000,
    L5: 38000,
    L6: 65000,
    L7: 110000,
    M5: 50000,
    M6: 90000,
    M7: 160000,
  };
  const byLevelByTier: RefreshGuidelines["byLevelByTier"] = {};
  for (const level of levels) {
    byLevelByTier[level] = {};
    const base = baseByLevel[level];
    for (const tier of PERFORMANCE_TIER_ORDER) {
      const m = tierMultiplier[tier];
      if (m === null) continue; // UNKNOWN has no guideline
      byLevelByTier[level][tier] = cellFor(Math.round(base * m));
    }
  }
  return {
    levels,
    byLevelByTier,
    bandLowMultiple: 0.8,
    bandHighMultiple: 1.25,
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

export function monthsBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  let total = years * 12 + months;
  if (to.getDate() < from.getDate()) total -= 1;
  return Math.max(0, total);
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ───────── Coercion helpers ─────────

export function coercePerformanceTier(raw: string | undefined): PerformanceTier {
  if (!raw) return "UNKNOWN";
  const s = raw.trim().toLowerCase();
  if (!s) return "UNKNOWN";
  // Numeric scales: 5 = top, 1 = below. Also handle 1–5 string forms.
  if (/^[1-5]$/.test(s)) {
    switch (s) {
      case "5":
        return "TOP";
      case "4":
        return "HIGH";
      case "3":
        return "MEETS";
      case "2":
        return "EMERGING";
      case "1":
        return "BELOW";
    }
  }
  if (
    s === "top" ||
    s === "outstanding" ||
    s === "exceptional" ||
    s === "exceeds significantly" ||
    s === "exceeds" ||
    s.startsWith("top ")
  ) {
    return "TOP";
  }
  if (
    s === "high" ||
    s === "high performer" ||
    s === "exceeds expectations" ||
    s === "above"
  ) {
    return "HIGH";
  }
  if (
    s === "meets" ||
    s === "meets expectations" ||
    s === "solid" ||
    s === "achieves" ||
    s === "on track"
  ) {
    return "MEETS";
  }
  if (
    s === "emerging" ||
    s === "developing" ||
    s === "partially meets" ||
    s === "needs improvement"
  ) {
    return "EMERGING";
  }
  if (
    s === "below" ||
    s === "below expectations" ||
    s === "underperforming" ||
    s === "pip"
  ) {
    return "BELOW";
  }
  return "UNKNOWN";
}

export function coerceRetentionRisk(raw: string | undefined): RetentionRisk {
  if (!raw) return "UNKNOWN";
  const s = raw.trim().toLowerCase();
  if (!s) return "UNKNOWN";
  if (s === "high" || s === "h" || s === "critical") return "HIGH";
  if (s === "medium" || s === "med" || s === "m" || s === "moderate") {
    return "MEDIUM";
  }
  if (s === "low" || s === "l") return "LOW";
  return "UNKNOWN";
}

export function coerceBoolean(raw: string | undefined | boolean): boolean {
  if (typeof raw === "boolean") return raw;
  if (!raw) return false;
  const s = raw.trim().toLowerCase();
  return (
    s === "y" ||
    s === "yes" ||
    s === "true" ||
    s === "1" ||
    s === "x" ||
    s === "critical" ||
    s === "flag"
  );
}

// ───────── Per-employee evaluation ─────────

/**
 * Resolve a guideline cell for a row, applying band defaults from the
 * matrix when the cell omits min/max.
 */
export function resolveGuideline(
  level: string,
  tier: PerformanceTier,
  guidelines: RefreshGuidelines,
):
  | {
      targetDollars: number;
      minDollars: number;
      maxDollars: number;
    }
  | null {
  const levelMap = guidelines.byLevelByTier[level];
  if (!levelMap) return null;
  const cell = levelMap[tier];
  if (!cell) return null;
  const min =
    cell.minDollars ?? cell.targetDollars * guidelines.bandLowMultiple;
  const max =
    cell.maxDollars ?? cell.targetDollars * guidelines.bandHighMultiple;
  return {
    targetDollars: cell.targetDollars,
    minDollars: min,
    maxDollars: max,
  };
}

function roundShareCount(rawShares: number, increment: number): number {
  if (!Number.isFinite(rawShares)) return 0;
  if (increment <= 1) return Math.round(rawShares);
  return Math.round(rawShares / increment) * increment;
}

export function evaluateEmployee(
  row: EmployeeRow,
  guidelines: RefreshGuidelines,
  settings: RefreshSettings,
  asOfDate: Date,
): EmployeeRecommendation {
  const exceptions: ExceptionFlag[] = [];
  const level = row.level?.trim() ?? "";
  const tier = row.performanceTier;
  const guideline = level ? resolveGuideline(level, tier, guidelines) : null;

  if (!level) {
    exceptions.push({
      type: "MISSING_LEVEL",
      message:
        "Level is missing. Cannot look up a guideline; defaulting proposed refresh to 0. Add a level to score this row.",
    });
  } else if (!guideline) {
    exceptions.push({
      type: "MISSING_GUIDELINE",
      message: `No guideline cell for level "${level}" + tier "${PERFORMANCE_TIER_LABEL[tier]}". Add a row to the guideline matrix or change the level/tier on this row.`,
    });
  }

  // Seed proposed from input or from the matrix target.
  let proposed = row.proposedRefreshDollars;
  let seeded = false;
  if (proposed === undefined || proposed === null || Number.isNaN(proposed)) {
    if (guideline) {
      proposed = guideline.targetDollars;
      seeded = true;
    } else {
      proposed = 0;
      seeded = false;
    }
  }
  proposed = Math.max(0, Math.round(proposed));

  // FMV resolution.
  const fmv = row.fmvPerShare ?? settings.fmvPerShare;
  let fmvUsed: number | undefined = fmv;
  let proposedShareCount: number | undefined;
  if (!fmv || fmv <= 0) {
    fmvUsed = undefined;
    proposedShareCount = undefined;
    if (proposed > 0) {
      exceptions.push({
        type: "MISSING_FMV",
        message:
          "FMV per share is missing or zero. Share count is omitted; supply an FMV to translate dollars into shares.",
      });
    }
  } else {
    proposedShareCount = roundShareCount(
      proposed / fmv,
      settings.shareRoundingIncrement,
    );
  }

  // Zero-value proposed (only flag if there's no MISSING_LEVEL/GUIDELINE
  // already explaining it — those are the real cause).
  if (
    proposed === 0 &&
    !exceptions.some(
      (e) => e.type === "MISSING_LEVEL" || e.type === "MISSING_GUIDELINE",
    )
  ) {
    exceptions.push({
      type: "ZERO_VALUE_PROPOSED",
      message:
        "Proposed refresh is zero. Confirm that no refresh is intended, or supply an amount.",
    });
  }

  // Guideline-band exceptions.
  let pctOfGuideline: number | undefined;
  if (guideline) {
    pctOfGuideline =
      guideline.targetDollars > 0 ? proposed / guideline.targetDollars : undefined;
    const wayHigh = guideline.targetDollars * settings.highOutlierMultiple;
    const wayLow = guideline.targetDollars * settings.lowOutlierMultiple;
    if (proposed > guideline.maxDollars) {
      if (proposed > wayHigh) {
        exceptions.push({
          type: "WAY_ABOVE_GUIDELINE",
          message: `Proposed ${formatUSD(proposed)} is more than ${settings.highOutlierMultiple.toFixed(2)}× the target (${formatUSD(guideline.targetDollars)}). Confirm intent before approval.`,
        });
      } else {
        exceptions.push({
          type: "ABOVE_GUIDELINE",
          message: `Proposed ${formatUSD(proposed)} exceeds the upper band (${formatUSD(guideline.maxDollars)}). Document the rationale.`,
        });
      }
      if (row.criticalRoleFlag || row.retentionRisk === "HIGH") {
        exceptions.push({
          type: "RETENTION_OVERRIDE",
          message:
            row.criticalRoleFlag && row.retentionRisk === "HIGH"
              ? "Above-band amount aligns with a critical role + high retention risk. Likely a justified override; capture the rationale in the manager's note."
              : row.criticalRoleFlag
                ? "Above-band amount aligns with a critical role flag. Likely a justified override; capture the rationale in the manager's note."
                : "Above-band amount aligns with a high retention risk. Likely a justified override; capture the rationale in the manager's note.",
        });
      }
    } else if (proposed > 0 && proposed < guideline.minDollars) {
      if (proposed < wayLow) {
        exceptions.push({
          type: "WAY_BELOW_GUIDELINE",
          message: `Proposed ${formatUSD(proposed)} is less than ${settings.lowOutlierMultiple.toFixed(2)}× the target (${formatUSD(guideline.targetDollars)}). Confirm intent before approval.`,
        });
      } else {
        exceptions.push({
          type: "BELOW_GUIDELINE",
          message: `Proposed ${formatUSD(proposed)} is below the lower band (${formatUSD(guideline.minDollars)}). Document the rationale.`,
        });
      }
    }
  }

  // Stale grant exception.
  if (row.lastGrantDate) {
    const lastGrant = parseISODate(row.lastGrantDate);
    if (lastGrant) {
      const months = monthsBetween(lastGrant, asOfDate);
      if (months >= settings.staleGrantThresholdMonths) {
        exceptions.push({
          type: "STALE_LAST_GRANT",
          message: `Last grant is ${months} months old (threshold: ${settings.staleGrantThresholdMonths}). Confirm refresh has not been missed in a prior cycle.`,
        });
      }
    }
  }

  // Manual-review rollup. We promote MISSING_LEVEL / MISSING_GUIDELINE
  // and the way-* outliers to NEEDS_MANUAL_REVIEW.
  const manualReviewTypes = new Set<ExceptionType>([
    "MISSING_LEVEL",
    "MISSING_GUIDELINE",
    "WAY_ABOVE_GUIDELINE",
    "WAY_BELOW_GUIDELINE",
  ]);
  const needsManualReview = exceptions.some((e) =>
    manualReviewTypes.has(e.type),
  );

  return {
    rowId: row.rowId,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    level,
    performanceTier: tier,
    retentionRisk: row.retentionRisk,
    isCriticalRole: row.criticalRoleFlag,
    guidelineTargetDollars: guideline?.targetDollars,
    guidelineMinDollars: guideline?.minDollars,
    guidelineMaxDollars: guideline?.maxDollars,
    proposedRefreshDollars: proposed,
    proposedSeededFromGuideline: seeded,
    fmvUsed,
    proposedShareCount,
    pctOfGuideline,
    exceptions,
    needsManualReview,
  };
}

// ───────── Aggregate analysis ─────────

export function analyzeRefresh(
  rows: EmployeeRow[],
  guidelines: RefreshGuidelines,
  settings: RefreshSettings,
): RefreshAnalysis {
  const asOf = parseISODate(settings.asOfDate ?? todayISO()) ?? new Date();
  const recommendations = rows.map((r) =>
    evaluateEmployee(r, guidelines, settings, asOf),
  );

  // Aggregations.
  const countByException: Record<ExceptionType, number> = {
    ABOVE_GUIDELINE: 0,
    BELOW_GUIDELINE: 0,
    WAY_ABOVE_GUIDELINE: 0,
    WAY_BELOW_GUIDELINE: 0,
    MISSING_FMV: 0,
    MISSING_LEVEL: 0,
    MISSING_GUIDELINE: 0,
    STALE_LAST_GRANT: 0,
    RETENTION_OVERRIDE: 0,
    ZERO_VALUE_PROPOSED: 0,
    NEEDS_MANUAL_REVIEW: 0,
  };

  const byLevelMap = new Map<string, LevelSummary>();
  const byTierMap = new Map<PerformanceTier, TierSummary>();
  let totalProposedDollars = 0;
  let totalProposedShares = 0;
  let headcountWithExceptions = 0;

  recommendations.forEach((r) => {
    totalProposedDollars += r.proposedRefreshDollars;
    if (r.proposedShareCount !== undefined) {
      totalProposedShares += r.proposedShareCount;
    }
    if (r.exceptions.length > 0) headcountWithExceptions += 1;
    if (r.needsManualReview) countByException.NEEDS_MANUAL_REVIEW += 1;
    r.exceptions.forEach((e) => {
      countByException[e.type] = (countByException[e.type] ?? 0) + 1;
    });

    const lvlKey = r.level || "(missing level)";
    const lvl = byLevelMap.get(lvlKey) ?? {
      level: lvlKey,
      headcount: 0,
      totalDollars: 0,
      totalShares: 0,
      averageDollars: 0,
    };
    lvl.headcount += 1;
    lvl.totalDollars += r.proposedRefreshDollars;
    if (r.proposedShareCount !== undefined) {
      lvl.totalShares += r.proposedShareCount;
    }
    byLevelMap.set(lvlKey, lvl);

    const tier = byTierMap.get(r.performanceTier) ?? {
      tier: r.performanceTier,
      headcount: 0,
      totalDollars: 0,
    };
    tier.headcount += 1;
    tier.totalDollars += r.proposedRefreshDollars;
    byTierMap.set(r.performanceTier, tier);
  });

  byLevelMap.forEach((lvl) => {
    lvl.averageDollars = lvl.headcount > 0 ? lvl.totalDollars / lvl.headcount : 0;
  });

  // Sort: levels in matrix order, then any leftover alphabetically;
  // tiers in PERFORMANCE_TIER_ORDER.
  const orderedLevels = guidelines.levels.slice();
  byLevelMap.forEach((_, key) => {
    if (!orderedLevels.includes(key)) orderedLevels.push(key);
  });
  const byLevel: LevelSummary[] = orderedLevels
    .filter((k) => byLevelMap.has(k))
    .map((k) => byLevelMap.get(k)!);
  const byTier: TierSummary[] = PERFORMANCE_TIER_ORDER.filter((t) =>
    byTierMap.has(t),
  ).map((t) => byTierMap.get(t)!);

  let budgetUsedPct: number | undefined;
  let budgetVariance: number | undefined;
  if (settings.totalBudget && settings.totalBudget > 0) {
    budgetUsedPct = totalProposedDollars / settings.totalBudget;
    budgetVariance = totalProposedDollars - settings.totalBudget;
  }

  const headcount = recommendations.length;
  const averageProposedDollars =
    headcount > 0 ? totalProposedDollars / headcount : 0;

  return {
    recommendations,
    summary: {
      headcount,
      headcountWithExceptions,
      totalProposedDollars,
      totalProposedShares,
      averageProposedDollars,
      countByException,
      byLevel,
      byTier,
      budgetUsedPct,
      budgetVariance,
    },
    settings,
  };
}

// ───────── Memo composition ─────────

/**
 * Compose an executive memo from the analysis. Pure deterministic
 * templating — no AI involved. The user pastes this into the comp
 * committee pre-read or the budget meeting deck.
 */
export function composeRefreshMemo(
  analysis: RefreshAnalysis,
  guidelines: RefreshGuidelines,
): string {
  const { summary, settings, recommendations } = analysis;
  const lines: string[] = [];
  lines.push(`# Refresh grant sizing — planning memo`);
  lines.push("");
  lines.push(
    "Educational diagnostic prepared from typed inputs. Not legal, tax, accounting, financial, or compensation advice. The company plan document, accounting guidance (ASC 718), and qualified counsel control. Bring this memo to TR leadership, finance, accounting, and legal for review before any action.",
  );
  lines.push("");

  lines.push("## Approach");
  lines.push(
    `- Population: ${summary.headcount.toLocaleString()} employee${summary.headcount === 1 ? "" : "s"} in scope.`,
  );
  lines.push(
    `- Guidelines: matrix of ${guidelines.levels.length} level${guidelines.levels.length === 1 ? "" : "s"} × ${PERFORMANCE_TIER_ORDER.filter((t) => t !== "UNKNOWN").length} performance tiers.`,
  );
  lines.push(
    `- Band tolerance: in-band = target × ${guidelines.bandLowMultiple.toFixed(2)} to target × ${guidelines.bandHighMultiple.toFixed(2)}.`,
  );
  lines.push(
    `- Outlier thresholds: way-low < ${settings.lowOutlierMultiple.toFixed(2)}× target, way-high > ${settings.highOutlierMultiple.toFixed(2)}× target.`,
  );
  lines.push(
    `- FMV per share (default): ${formatUSD(settings.fmvPerShare)}. Per-row overrides honored where supplied.`,
  );
  lines.push(
    `- Stale-grant threshold: ${settings.staleGrantThresholdMonths} months (computed against ${settings.asOfDate ?? todayISO()}).`,
  );
  lines.push(
    `- Share rounding increment: ${settings.shareRoundingIncrement.toLocaleString()}.`,
  );
  if (settings.totalBudget && settings.totalBudget > 0) {
    lines.push(`- Total budget reference: ${formatUSD(settings.totalBudget)}.`);
  }
  lines.push("");

  lines.push("## Totals");
  lines.push(
    `- Proposed dollars: ${formatUSD(summary.totalProposedDollars)}`,
  );
  lines.push(
    `- Proposed shares: ${summary.totalProposedShares.toLocaleString()}`,
  );
  lines.push(
    `- Average dollars per employee: ${formatUSD(Math.round(summary.averageProposedDollars))}`,
  );
  if (summary.budgetUsedPct !== undefined) {
    const variance = summary.budgetVariance ?? 0;
    lines.push(
      `- Budget utilization: ${(summary.budgetUsedPct * 100).toFixed(1)}% (${variance >= 0 ? "over" : "under"} by ${formatUSD(Math.abs(variance))}).`,
    );
  }
  lines.push("");

  lines.push("## Distribution by level");
  if (summary.byLevel.length === 0) {
    lines.push("- (none)");
  } else {
    summary.byLevel.forEach((lvl) => {
      lines.push(
        `- **${lvl.level}** — ${lvl.headcount.toLocaleString()} employees · ${formatUSD(lvl.totalDollars)} total · ${formatUSD(Math.round(lvl.averageDollars))} avg · ${lvl.totalShares.toLocaleString()} shares`,
      );
    });
  }
  lines.push("");

  lines.push("## Distribution by performance tier");
  if (summary.byTier.length === 0) {
    lines.push("- (none)");
  } else {
    summary.byTier.forEach((t) => {
      lines.push(
        `- **${PERFORMANCE_TIER_LABEL[t.tier]}** — ${t.headcount.toLocaleString()} employees · ${formatUSD(t.totalDollars)}`,
      );
    });
  }
  lines.push("");

  lines.push("## Exceptions");
  const exceptionEntries = (
    Object.entries(summary.countByException) as Array<[ExceptionType, number]>
  )
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (exceptionEntries.length === 0) {
    lines.push("- No exceptions flagged.");
  } else {
    exceptionEntries.forEach(([type, n]) => {
      lines.push(`- ${EXCEPTION_LABEL[type]}: ${n}`);
    });
  }
  lines.push("");

  // Top rows needing manual review (cap at 12 to keep memo readable).
  const reviewRows = recommendations.filter((r) => r.needsManualReview);
  if (reviewRows.length > 0) {
    lines.push("## Rows needing manual review (top 12)");
    reviewRows.slice(0, 12).forEach((r) => {
      const id = r.employeeId || r.employeeName || r.rowId;
      lines.push(
        `- **${id}** (${r.level || "—"} · ${PERFORMANCE_TIER_LABEL[r.performanceTier]}) — proposed ${formatUSD(r.proposedRefreshDollars)}${
          r.guidelineTargetDollars !== undefined
            ? ` vs target ${formatUSD(r.guidelineTargetDollars)}`
            : ""
        }`,
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

  lines.push("## Disclaimer");
  lines.push(
    "Outputs reflect the guidelines, settings, and inputs typed above. Real refresh decisions are governed by the company's plan document, the comp committee's authority, accounting expense considerations (ASC 718), share-pool runway, dilution targets, and applicable employment and securities law. This memo is a planning aid, not an approval. Bring it to TR leadership, finance, accounting, and legal before any action.",
  );

  return lines.join("\n");
}

// ───────── CSV output ─────────

export function recommendationsToCsv(
  recommendations: EmployeeRecommendation[],
): string {
  const header = [
    "Row ID",
    "Employee ID",
    "Employee Name",
    "Level",
    "Performance Tier",
    "Retention Risk",
    "Critical Role",
    "Guideline Target Dollars",
    "Guideline Min Dollars",
    "Guideline Max Dollars",
    "Proposed Refresh Dollars",
    "Pct Of Guideline",
    "FMV Used",
    "Proposed Share Count",
    "Seeded From Guideline",
    "Needs Manual Review",
    "Exception Count",
    "Exceptions",
  ].join(",");
  const rows = recommendations.map((r) =>
    [
      csvEscape(r.rowId),
      csvEscape(r.employeeId ?? ""),
      csvEscape(r.employeeName ?? ""),
      csvEscape(r.level),
      PERFORMANCE_TIER_LABEL[r.performanceTier],
      RETENTION_RISK_LABEL[r.retentionRisk],
      r.isCriticalRole ? "Yes" : "No",
      r.guidelineTargetDollars ?? "",
      r.guidelineMinDollars !== undefined
        ? Math.round(r.guidelineMinDollars)
        : "",
      r.guidelineMaxDollars !== undefined
        ? Math.round(r.guidelineMaxDollars)
        : "",
      r.proposedRefreshDollars,
      r.pctOfGuideline !== undefined ? r.pctOfGuideline.toFixed(3) : "",
      r.fmvUsed ?? "",
      r.proposedShareCount ?? "",
      r.proposedSeededFromGuideline ? "Yes" : "No",
      r.needsManualReview ? "Yes" : "No",
      r.exceptions.length,
      csvEscape(
        r.exceptions
          .map((e) => `${EXCEPTION_LABEL[e.type]}: ${e.message}`)
          .join(" | "),
      ),
    ].join(","),
  );
  return [header, ...rows].join("\n");
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
