/**
 * Underwater Options Analyzer engine. Pure functions only — no React,
 * no I/O, no AI. Takes a population of option grants (ISO / NSO /
 * SAR), a current FMV, and threshold settings, and produces a
 * deterministic underwater exposure view: percent of shares and
 * holders that sit underwater, intrinsic and spread values, depth-
 * band distribution, and tranches by grant year + strike.
 *
 * What this is NOT:
 *   - Not a system of record. Nothing is persisted.
 *   - Not legal, tax, accounting, or compensation advice.
 *   - Not a recommendation to reprice, exchange, or otherwise modify
 *     awards. Those decisions are governed by the plan document, ISS
 *     / Glass Lewis frameworks, shareholder approval, and qualified
 *     counsel. The analyzer reports the math and lets the comp
 *     committee decide.
 *   - Not a Black-Scholes engine. Spread = max(0, FMV - strike) ×
 *     shares. The tool surfaces intrinsic value, not fair value.
 */

// ───────── Types ─────────

export type OptionAwardType = "ISO" | "NSO" | "SAR" | "OTHER";

export type OptionGrant = {
  rowId: string;
  employeeId?: string;
  employeeName?: string;
  /** Job level / band. Optional but useful for slicing. */
  level?: string;
  function?: string;
  country?: string;
  grantId?: string;
  awardType: OptionAwardType;
  /** ISO YYYY-MM-DD. */
  grantDate?: string;
  /** Strike / exercise price per share. */
  strike: number;
  /** Total shares granted. */
  sharesGranted: number;
  /** Shares vested as of as-of date. Used to bucket vested vs unvested exposure. */
  sharesVested: number;
  /** Shares already exercised. Subtracted from outstanding. */
  sharesExercised: number;
  /** Shares forfeited / cancelled. Subtracted from outstanding. */
  sharesForfeited: number;
  /**
   * Outstanding shares override (granted minus exercised minus
   * forfeited). If undefined, the engine derives it.
   */
  sharesOutstanding?: number;
  /** Optional per-row FMV override. Falls back to settings.currentFmv. */
  fmvOverride?: number;
  /** ISO YYYY-MM-DD. Used for stale / expired flags. */
  expirationDate?: string;
  notes?: string;
};

export type UnderwaterSettings = {
  /** Current FMV / trading-day reference per share. */
  currentFmv: number;
  /** ISO YYYY-MM-DD. Defaults to today. Used for expired-grant detection. */
  asOfDate?: string;
  /**
   * Depth bands, in order of severity. Each entry: lower bound
   * (inclusive) and label. Strike-vs-FMV ratio: e.g., 0.5 = strike is
   * 200% of FMV (deep underwater). 1.0 = at the money.
   *
   * The engine bins each underwater grant into the first band whose
   * lower bound is ≤ the grant's FMV/strike ratio.
   */
  depthBands: Array<{
    /** Inclusive lower bound on FMV/strike ratio. */
    minRatio: number;
    label: string;
  }>;
  /**
   * If true, expired grants (past expiration date as of the as-of
   * date) are excluded from the analysis. Default: true.
   */
  excludeExpired: boolean;
};

export type UnderwaterException =
  | "MISSING_STRIKE"
  | "MISSING_FMV"
  | "ZERO_SHARES"
  | "NEGATIVE_VALUE"
  | "EXPIRED_GRANT"
  | "NEEDS_MANUAL_REVIEW";

export type UnderwaterExceptionFlag = {
  type: UnderwaterException;
  message: string;
};

export type GrantStatus = "UNDERWATER" | "AT_THE_MONEY" | "IN_THE_MONEY" | "EXPIRED" | "EXCLUDED";

export type GrantWithStatus = OptionGrant & {
  status: GrantStatus;
  /** sharesGranted - sharesExercised - sharesForfeited (or override). */
  sharesOutstandingComputed: number;
  /** Shares unvested = max(0, outstanding - vested). */
  sharesUnvested: number;
  /** Spread per share = max(0, FMV - strike). */
  spreadPerShare: number;
  /** Spread value = max(0, FMV - strike) × outstanding shares. */
  spreadValue: number;
  /** FMV/strike ratio. < 1 = underwater, = 1 = at the money, > 1 = ITM. */
  fmvStrikeRatio?: number;
  /** Depth-band label (only when underwater). */
  depthBandLabel?: string;
  /** FMV used (override → settings). */
  fmvUsed?: number;
  exceptions: UnderwaterExceptionFlag[];
  needsManualReview: boolean;
};

export type DepthBucket = {
  label: string;
  /** Inclusive lower bound on FMV/strike ratio for this band. */
  minRatio: number;
  grantCount: number;
  holderCount: number;
  totalShares: number;
  /** Total spread value (positive when ITM; for underwater bands this is 0). */
  totalSpreadValue: number;
};

export type TrancheBucket = {
  /** "YYYY @ $strike" composite key. */
  key: string;
  grantYear: number | null;
  strike: number;
  grantCount: number;
  totalShares: number;
  totalSpreadValue: number;
  averageStrike: number;
};

export type UnderwaterAnalysis = {
  rows: GrantWithStatus[];
  summary: {
    /** Total grants in scope (after expired-exclusion if enabled). */
    grantCount: number;
    holderCount: number;
    /** Grants flagged as underwater. */
    underwaterGrantCount: number;
    underwaterHolderCount: number;
    /** Total outstanding shares in scope. */
    totalShares: number;
    totalUnderwaterShares: number;
    pctUnderwaterByShares: number;   // 0..1
    pctUnderwaterByHolders: number;  // 0..1
    /** Aggregate spread value across all in-scope grants. */
    totalSpreadValue: number;
    /** Aggregate spread value across in-the-money grants only. */
    totalIntrinsicValue: number;
    /** Per-status grant counts. */
    countByStatus: Record<GrantStatus, number>;
    countByException: Record<UnderwaterException, number>;
    rowsWithExceptions: number;
    /** Distinct vested vs unvested split among underwater grants. */
    underwaterVestedShares: number;
    underwaterUnvestedShares: number;
    /** Distinct ISO vs NSO/SAR split among underwater grants. */
    underwaterByAwardType: Record<OptionAwardType, number>;
  };
  byDepthBand: DepthBucket[];
  byTranche: TrancheBucket[];
  byGrantYear: Array<{
    year: number;
    grantCount: number;
    totalShares: number;
    totalSpreadValue: number;
    underwaterShares: number;
    pctUnderwater: number;
  }>;
  byLevel: Array<{
    level: string;
    holderCount: number;
    underwaterShares: number;
    totalShares: number;
    pctUnderwater: number;
  }>;
  settings: UnderwaterSettings;
};

// ───────── Constants & defaults ─────────

export const OPTION_AWARD_TYPES: OptionAwardType[] = [
  "ISO",
  "NSO",
  "SAR",
  "OTHER",
];

export const EXCEPTION_LABEL: Record<UnderwaterException, string> = {
  MISSING_STRIKE: "Missing strike",
  MISSING_FMV: "Missing FMV",
  ZERO_SHARES: "Zero outstanding shares",
  NEGATIVE_VALUE: "Negative computed value",
  EXPIRED_GRANT: "Expired grant",
  NEEDS_MANUAL_REVIEW: "Needs manual review",
};

export const STATUS_LABEL: Record<GrantStatus, string> = {
  UNDERWATER: "Underwater",
  AT_THE_MONEY: "At the money",
  IN_THE_MONEY: "In the money",
  EXPIRED: "Expired",
  EXCLUDED: "Excluded",
};

/**
 * Default depth bands. FMV/strike ratio:
 *   - 0.95–1.00  → "At the money" (treated as not-underwater above 1)
 *   - 0.75–0.95  → "Slightly underwater" (5–25% below)
 *   - 0.50–0.75  → "Moderately underwater" (25–50% below)
 *   - 0.25–0.50  → "Deeply underwater" (50–75% below)
 *   - 0.00–0.25  → "Severely underwater" (>75% below)
 */
export function defaultDepthBands(): UnderwaterSettings["depthBands"] {
  return [
    { minRatio: 0.95, label: "Slightly underwater" },
    { minRatio: 0.75, label: "Moderately underwater" },
    { minRatio: 0.5, label: "Deeply underwater" },
    { minRatio: 0.25, label: "Severely underwater" },
    { minRatio: 0, label: "Severely underwater" },
  ];
}

export function defaultUnderwaterSettings(): UnderwaterSettings {
  return {
    currentFmv: 50,
    asOfDate: undefined,
    depthBands: defaultDepthBands(),
    excludeExpired: true,
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

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ───────── Per-row evaluation ─────────

function depthBandFor(
  ratio: number,
  bands: UnderwaterSettings["depthBands"],
): string | undefined {
  if (ratio >= 1) return undefined;
  // Sort bands descending by minRatio so we hit the tightest band first.
  const sorted = [...bands].sort((a, b) => b.minRatio - a.minRatio);
  for (const b of sorted) {
    if (ratio >= b.minRatio) return b.label;
  }
  return sorted[sorted.length - 1]?.label;
}

export function evaluateGrant(
  grant: OptionGrant,
  settings: UnderwaterSettings,
  asOfDate: Date,
): GrantWithStatus {
  const exceptions: UnderwaterExceptionFlag[] = [];
  const fmv = grant.fmvOverride ?? settings.currentFmv;
  const fmvUsable = typeof fmv === "number" && Number.isFinite(fmv) && fmv > 0;
  const strikeUsable =
    typeof grant.strike === "number" &&
    Number.isFinite(grant.strike) &&
    grant.strike > 0;

  const granted = Math.max(0, Math.round(grant.sharesGranted));
  const exercised = Math.max(0, Math.round(grant.sharesExercised));
  const forfeited = Math.max(0, Math.round(grant.sharesForfeited));
  const vested = Math.max(0, Math.round(grant.sharesVested));
  const outstandingDerived = Math.max(0, granted - exercised - forfeited);
  const outstanding =
    typeof grant.sharesOutstanding === "number" &&
    Number.isFinite(grant.sharesOutstanding) &&
    grant.sharesOutstanding >= 0
      ? Math.round(grant.sharesOutstanding)
      : outstandingDerived;
  const unvested = Math.max(0, outstanding - vested);

  if (!strikeUsable) {
    exceptions.push({
      type: "MISSING_STRIKE",
      message:
        "Strike price is missing or zero. Spread cannot be computed; row excluded from value totals.",
    });
  }
  if (!fmvUsable) {
    exceptions.push({
      type: "MISSING_FMV",
      message:
        "FMV is missing or zero. Spread cannot be computed; row excluded from value totals.",
    });
  }
  if (outstanding === 0) {
    exceptions.push({
      type: "ZERO_SHARES",
      message:
        "Zero outstanding shares (granted minus exercised minus forfeited). Row excluded from share totals.",
    });
  }
  if (
    grant.sharesGranted < 0 ||
    grant.sharesVested < 0 ||
    grant.sharesExercised < 0 ||
    grant.sharesForfeited < 0 ||
    grant.strike < 0
  ) {
    exceptions.push({
      type: "NEGATIVE_VALUE",
      message:
        "One or more numeric fields is negative. Confirm the export; the row will be coerced to non-negative for the calculation.",
    });
  }

  // Expired check.
  let expired = false;
  if (grant.expirationDate) {
    const exp = parseISODate(grant.expirationDate);
    if (exp && exp.getTime() < asOfDate.getTime()) {
      expired = true;
      exceptions.push({
        type: "EXPIRED_GRANT",
        message: `Grant expired on ${grant.expirationDate}; ${
          settings.excludeExpired
            ? "excluded from analysis (per settings)."
            : "included in analysis (per settings)."
        }`,
      });
    }
  }

  // Status decision.
  let status: GrantStatus;
  let spreadPerShare = 0;
  let spreadValue = 0;
  let ratio: number | undefined;
  let depthBandLabel: string | undefined;

  if (expired && settings.excludeExpired) {
    status = "EXCLUDED";
  } else if (!strikeUsable || !fmvUsable || outstanding === 0) {
    status = "EXCLUDED";
  } else if (expired) {
    status = "EXPIRED";
  } else {
    spreadPerShare = Math.max(0, fmv - grant.strike);
    spreadValue = spreadPerShare * outstanding;
    ratio = fmv / grant.strike;
    if (ratio > 1) {
      status = "IN_THE_MONEY";
    } else if (Math.abs(ratio - 1) < 1e-9) {
      status = "AT_THE_MONEY";
    } else {
      status = "UNDERWATER";
      depthBandLabel = depthBandFor(ratio, settings.depthBands);
    }
  }

  // Manual-review escalation.
  const needsManualReview = exceptions.some(
    (e) => e.type === "MISSING_STRIKE" || e.type === "NEGATIVE_VALUE",
  );

  return {
    ...grant,
    sharesGranted: granted,
    sharesExercised: exercised,
    sharesForfeited: forfeited,
    sharesVested: vested,
    sharesOutstandingComputed: outstanding,
    sharesUnvested: unvested,
    spreadPerShare,
    spreadValue,
    fmvStrikeRatio: ratio,
    depthBandLabel,
    fmvUsed: fmvUsable ? fmv : undefined,
    exceptions,
    needsManualReview,
    status,
  };
}

// ───────── Aggregation ─────────

export function analyzeUnderwater(
  grants: OptionGrant[],
  settings: UnderwaterSettings,
): UnderwaterAnalysis {
  const asOf = parseISODate(settings.asOfDate ?? todayISO()) ?? new Date();
  const evaluated = grants.map((g) => evaluateGrant(g, settings, asOf));

  // In-scope = anything not EXCLUDED.
  const inScope = evaluated.filter((g) => g.status !== "EXCLUDED");
  const underwater = inScope.filter((g) => g.status === "UNDERWATER");

  const totalShares = inScope.reduce((s, g) => s + g.sharesOutstandingComputed, 0);
  const totalUnderwaterShares = underwater.reduce(
    (s, g) => s + g.sharesOutstandingComputed,
    0,
  );

  const inScopeHolders = new Set<string>();
  inScope.forEach((g) => {
    inScopeHolders.add(g.employeeId || g.rowId);
  });
  const underwaterHolders = new Set<string>();
  underwater.forEach((g) => {
    underwaterHolders.add(g.employeeId || g.rowId);
  });

  const pctUnderwaterByShares =
    totalShares > 0 ? totalUnderwaterShares / totalShares : 0;
  const pctUnderwaterByHolders =
    inScopeHolders.size > 0 ? underwaterHolders.size / inScopeHolders.size : 0;

  const totalSpreadValue = inScope.reduce((s, g) => s + g.spreadValue, 0);
  const totalIntrinsicValue = inScope
    .filter((g) => g.status === "IN_THE_MONEY")
    .reduce((s, g) => s + g.spreadValue, 0);

  const countByStatus: Record<GrantStatus, number> = {
    UNDERWATER: 0,
    AT_THE_MONEY: 0,
    IN_THE_MONEY: 0,
    EXPIRED: 0,
    EXCLUDED: 0,
  };
  evaluated.forEach((g) => (countByStatus[g.status] += 1));

  const countByException: Record<UnderwaterException, number> = {
    MISSING_STRIKE: 0,
    MISSING_FMV: 0,
    ZERO_SHARES: 0,
    NEGATIVE_VALUE: 0,
    EXPIRED_GRANT: 0,
    NEEDS_MANUAL_REVIEW: 0,
  };
  let rowsWithExceptions = 0;
  for (const g of evaluated) {
    if (g.exceptions.length > 0) rowsWithExceptions += 1;
    if (g.needsManualReview) countByException.NEEDS_MANUAL_REVIEW += 1;
    g.exceptions.forEach((e) => (countByException[e.type] += 1));
  }

  const underwaterVestedShares = underwater.reduce(
    (s, g) => s + Math.min(g.sharesVested, g.sharesOutstandingComputed),
    0,
  );
  const underwaterUnvestedShares = underwater.reduce(
    (s, g) => s + g.sharesUnvested,
    0,
  );

  const underwaterByAwardType: Record<OptionAwardType, number> = {
    ISO: 0,
    NSO: 0,
    SAR: 0,
    OTHER: 0,
  };
  underwater.forEach((g) => {
    underwaterByAwardType[g.awardType] += g.sharesOutstandingComputed;
  });

  // Depth bands — emit a row per declared band, even when empty, so the
  // memo / table read top-down without surprise gaps.
  const byDepthBand = computeDepthBands(underwater, settings);

  // Tranches — group by (grantYear, strike). Only meaningful for
  // in-scope grants (excludes EXCLUDED).
  const tranches = new Map<string, TrancheBucket>();
  inScope.forEach((g) => {
    const year = g.grantDate
      ? parseISODate(g.grantDate)?.getFullYear() ?? null
      : null;
    const strike = g.strike;
    const key = `${year ?? "—"} @ $${strike}`;
    const cur = tranches.get(key) ?? {
      key,
      grantYear: year,
      strike,
      grantCount: 0,
      totalShares: 0,
      totalSpreadValue: 0,
      averageStrike: strike,
    };
    cur.grantCount += 1;
    cur.totalShares += g.sharesOutstandingComputed;
    cur.totalSpreadValue += g.spreadValue;
    tranches.set(key, cur);
  });
  const byTranche = Array.from(tranches.values()).sort((a, b) => {
    if (a.grantYear !== b.grantYear) {
      const ay = a.grantYear ?? 0;
      const by = b.grantYear ?? 0;
      return ay - by;
    }
    return a.strike - b.strike;
  });

  // By grant year.
  const yearMap = new Map<
    number,
    {
      year: number;
      grantCount: number;
      totalShares: number;
      totalSpreadValue: number;
      underwaterShares: number;
    }
  >();
  inScope.forEach((g) => {
    const year = g.grantDate ? parseISODate(g.grantDate)?.getFullYear() : null;
    if (year === null || year === undefined) return;
    const cur = yearMap.get(year) ?? {
      year,
      grantCount: 0,
      totalShares: 0,
      totalSpreadValue: 0,
      underwaterShares: 0,
    };
    cur.grantCount += 1;
    cur.totalShares += g.sharesOutstandingComputed;
    cur.totalSpreadValue += g.spreadValue;
    if (g.status === "UNDERWATER")
      cur.underwaterShares += g.sharesOutstandingComputed;
    yearMap.set(year, cur);
  });
  const byGrantYear = Array.from(yearMap.values())
    .map((y) => ({
      ...y,
      pctUnderwater: y.totalShares > 0 ? y.underwaterShares / y.totalShares : 0,
    }))
    .sort((a, b) => a.year - b.year);

  // By level.
  const levelMap = new Map<
    string,
    { holders: Set<string>; underwaterShares: number; totalShares: number }
  >();
  inScope.forEach((g) => {
    const lvl = g.level && g.level.trim() ? g.level.trim() : "(missing)";
    const cur = levelMap.get(lvl) ?? {
      holders: new Set<string>(),
      underwaterShares: 0,
      totalShares: 0,
    };
    cur.holders.add(g.employeeId || g.rowId);
    cur.totalShares += g.sharesOutstandingComputed;
    if (g.status === "UNDERWATER")
      cur.underwaterShares += g.sharesOutstandingComputed;
    levelMap.set(lvl, cur);
  });
  const byLevel = Array.from(levelMap.entries())
    .map(([level, v]) => ({
      level,
      holderCount: v.holders.size,
      underwaterShares: v.underwaterShares,
      totalShares: v.totalShares,
      pctUnderwater: v.totalShares > 0 ? v.underwaterShares / v.totalShares : 0,
    }))
    .sort((a, b) => b.pctUnderwater - a.pctUnderwater);

  return {
    rows: evaluated,
    summary: {
      grantCount: inScope.length,
      holderCount: inScopeHolders.size,
      underwaterGrantCount: underwater.length,
      underwaterHolderCount: underwaterHolders.size,
      totalShares,
      totalUnderwaterShares,
      pctUnderwaterByShares,
      pctUnderwaterByHolders,
      totalSpreadValue,
      totalIntrinsicValue,
      countByStatus,
      countByException,
      rowsWithExceptions,
      underwaterVestedShares,
      underwaterUnvestedShares,
      underwaterByAwardType,
    },
    byDepthBand,
    byTranche,
    byGrantYear,
    byLevel,
    settings,
  };
}

function computeDepthBands(
  underwater: GrantWithStatus[],
  settings: UnderwaterSettings,
): DepthBucket[] {
  // Build an ordered, de-duplicated list of bands.
  const seen = new Map<string, { minRatio: number; label: string }>();
  for (const b of [...settings.depthBands].sort((a, b) => b.minRatio - a.minRatio)) {
    if (!seen.has(b.label)) seen.set(b.label, b);
  }
  const orderedBands = Array.from(seen.values());
  const out: DepthBucket[] = orderedBands.map((b) => ({
    label: b.label,
    minRatio: b.minRatio,
    grantCount: 0,
    holderCount: 0,
    totalShares: 0,
    totalSpreadValue: 0,
  }));
  const holderSets = orderedBands.map(() => new Set<string>());
  for (const g of underwater) {
    if (!g.depthBandLabel) continue;
    const idx = orderedBands.findIndex((b) => b.label === g.depthBandLabel);
    if (idx === -1) continue;
    out[idx].grantCount += 1;
    out[idx].totalShares += g.sharesOutstandingComputed;
    out[idx].totalSpreadValue += g.spreadValue;
    holderSets[idx].add(g.employeeId || g.rowId);
  }
  out.forEach((b, i) => {
    b.holderCount = holderSets[i].size;
  });
  return out;
}

// ───────── Memo composition ─────────

/**
 * Compose an audit memo from the analysis. Numbered sections matching
 * a typical pre-read packet. Pure deterministic templating — no AI.
 */
export function composeUnderwaterMemo(analysis: UnderwaterAnalysis): string {
  const { summary, settings, byDepthBand, byTranche, byGrantYear, byLevel } =
    analysis;
  const lines: string[] = [];
  lines.push("# Underwater options exposure — planning memo");
  lines.push("");
  lines.push(
    "Educational diagnostic prepared from typed inputs. Not legal, tax, accounting, financial, or compensation advice. The company plan document, ISS / Glass Lewis frameworks, shareholder approval requirements, and qualified counsel control any decision to reprice, exchange, or otherwise modify outstanding awards. Bring this memo to TR leadership, finance, accounting, legal, and the comp committee for review before any action.",
  );
  lines.push("");
  lines.push(
    "Spread is the *intrinsic* value of an option (max(0, FMV − strike) × shares outstanding). It is not a Black-Scholes / ASC 718 fair value. The analyzer reports the math; it does not recommend repricing.",
  );
  lines.push("");

  // 1. Inputs and assumptions
  lines.push("## 1. Inputs and assumptions");
  lines.push(`- Current FMV: ${formatUSD(settings.currentFmv)} per share.`);
  lines.push(`- As-of date: ${settings.asOfDate ?? todayISO()}.`);
  lines.push(
    `- Expired grants: ${settings.excludeExpired ? "excluded from analysis" : "included in analysis"}.`,
  );
  lines.push(
    `- Depth bands (FMV/strike ratio): ${settings.depthBands
      .map((b) => `${b.label} ≥ ${b.minRatio.toFixed(2)}`)
      .join(", ")}.`,
  );
  lines.push("");

  // 2. Headline exposure
  lines.push("## 2. Headline exposure");
  lines.push(
    `- **${(summary.pctUnderwaterByShares * 100).toFixed(1)}%** of outstanding option shares are underwater (${summary.totalUnderwaterShares.toLocaleString()} of ${summary.totalShares.toLocaleString()}).`,
  );
  lines.push(
    `- **${(summary.pctUnderwaterByHolders * 100).toFixed(1)}%** of holders have at least one underwater grant (${summary.underwaterHolderCount.toLocaleString()} of ${summary.holderCount.toLocaleString()}).`,
  );
  lines.push(
    `- Aggregate spread value across in-scope grants: ${formatUSD(summary.totalSpreadValue)} (in-the-money intrinsic only: ${formatUSD(summary.totalIntrinsicValue)}).`,
  );
  lines.push("");

  // 3. Vested vs unvested split
  lines.push("## 3. Vested vs unvested underwater exposure");
  lines.push(
    `- Underwater vested shares: ${summary.underwaterVestedShares.toLocaleString()} (immediately exercisable, currently with no spread).`,
  );
  lines.push(
    `- Underwater unvested shares: ${summary.underwaterUnvestedShares.toLocaleString()} (still time to recover before vest).`,
  );
  lines.push("");

  // 4. By award type
  lines.push("## 4. Underwater by award type");
  (
    Object.entries(summary.underwaterByAwardType) as Array<
      [OptionAwardType, number]
    >
  )
    .filter(([, n]) => n > 0)
    .forEach(([type, n]) => {
      lines.push(`- ${type}: ${n.toLocaleString()} shares`);
    });
  if (
    Object.values(summary.underwaterByAwardType).every((v) => v === 0)
  ) {
    lines.push("- (none)");
  }
  lines.push("");
  lines.push(
    "ISO note: ISO holders face different tax mechanics on exercise (AMT exposure on bargain element). Repricing or exchange of ISOs typically converts them to NSOs and triggers a fresh ISO 100k limit clock; confirm with tax / legal before any modification.",
  );
  lines.push("");

  // 5. Depth bands
  lines.push("## 5. Depth bands");
  if (byDepthBand.every((b) => b.grantCount === 0)) {
    lines.push("- No underwater grants in scope.");
  } else {
    byDepthBand.forEach((b) => {
      lines.push(
        `- **${b.label}** (FMV/strike ≥ ${b.minRatio.toFixed(2)}): ${b.grantCount.toLocaleString()} grants · ${b.holderCount.toLocaleString()} holders · ${b.totalShares.toLocaleString()} shares`,
      );
    });
  }
  lines.push("");

  // 6. By grant year
  lines.push("## 6. By grant year");
  if (byGrantYear.length === 0) {
    lines.push("- (no grants with a parseable grant date)");
  } else {
    byGrantYear.forEach((y) => {
      lines.push(
        `- ${y.year}: ${y.grantCount.toLocaleString()} grants · ${y.totalShares.toLocaleString()} shares · ${y.underwaterShares.toLocaleString()} underwater (${(y.pctUnderwater * 100).toFixed(1)}%)`,
      );
    });
  }
  lines.push("");

  // 7. By level
  lines.push("## 7. By level (sorted by % underwater)");
  if (byLevel.length === 0) {
    lines.push("- (no level data)");
  } else {
    byLevel.forEach((l) => {
      lines.push(
        `- ${l.level} — ${l.holderCount.toLocaleString()} holders · ${l.underwaterShares.toLocaleString()} of ${l.totalShares.toLocaleString()} shares underwater (${(l.pctUnderwater * 100).toFixed(1)}%)`,
      );
    });
  }
  lines.push("");

  // 8. Tranches
  lines.push("## 8. Tranches (grant year × strike)");
  if (byTranche.length === 0) {
    lines.push("- (no tranches in scope)");
  } else {
    const cap = Math.min(20, byTranche.length);
    byTranche.slice(0, cap).forEach((t) => {
      lines.push(
        `- ${t.key} — ${t.grantCount.toLocaleString()} grants · ${t.totalShares.toLocaleString()} shares · spread value ${formatUSD(t.totalSpreadValue)}`,
      );
    });
    if (byTranche.length > cap) {
      lines.push(`- … and ${byTranche.length - cap} more tranches.`);
    }
  }
  lines.push("");

  // 9. Exceptions
  lines.push("## 9. Exceptions");
  const exceptionEntries = (
    Object.entries(summary.countByException) as Array<
      [UnderwaterException, number]
    >
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

  // 10. Recommended next steps
  lines.push("## 10. Recommended next steps");
  lines.push(
    "1. **TR leadership.** Walk the depth-band and by-level views against the company's grant philosophy. Identify cohorts most exposed to retention risk from prolonged underwater positions.",
  );
  lines.push(
    "2. **Finance.** Reconcile in-scope shares against the burn-rate / overhang model (Stock Plan Health Check pairs naturally here). Confirm the FMV reference point against the latest 409A or trading-day close.",
  );
  lines.push(
    "3. **Accounting.** Any modification (repricing, option exchange, accelerated vesting) is a Type III modification under ASC 718 and triggers incremental fair-value expense. Engage the controller before scoping a remediation.",
  );
  lines.push(
    "4. **Legal + governance.** Repricings without shareholder approval are restricted by most plan documents and viewed unfavorably by ISS / Glass Lewis. Confirm plan terms, listing-rule requirements (NYSE / Nasdaq), and any standing comp-committee charter language.",
  );
  lines.push(
    "5. **Comp committee.** Package this memo with the burn-rate / overhang context (Stock Plan Health Check) and the refresh sizing memo. The right next decision is usually 'do nothing yet, monitor next quarter,' a one-time refresh tilt, or a deliberate plan-amendment cycle. The analyzer surfaces the math; the committee decides.",
  );
  lines.push("");

  // Disclaimer
  lines.push("## Disclaimer");
  lines.push(
    "Outputs reflect the inputs and settings typed above. This is intrinsic-value analysis only; it is not a Black-Scholes / ASC 718 fair-value engine and it is not a recommendation to reprice, exchange, or otherwise modify outstanding awards. Real decisions are governed by the company plan document, ISS / Glass Lewis frameworks, shareholder-approval requirements, listing-rule restrictions, and qualified counsel.",
  );

  return lines.join("\n");
}

// ───────── CSV output ─────────

export function rowsToCsv(rows: GrantWithStatus[]): string {
  const header = [
    "Row ID",
    "Employee ID",
    "Employee Name",
    "Level",
    "Function",
    "Country",
    "Grant ID",
    "Award Type",
    "Grant Date",
    "Expiration Date",
    "Strike",
    "FMV Used",
    "FMV/Strike Ratio",
    "Shares Granted",
    "Shares Vested",
    "Shares Exercised",
    "Shares Forfeited",
    "Shares Outstanding",
    "Shares Unvested",
    "Status",
    "Depth Band",
    "Spread Per Share",
    "Spread Value",
    "Needs Manual Review",
    "Exception Count",
    "Exceptions",
  ].join(",");
  const lines = rows.map((r) =>
    [
      csvEscape(r.rowId),
      csvEscape(r.employeeId ?? ""),
      csvEscape(r.employeeName ?? ""),
      csvEscape(r.level ?? ""),
      csvEscape(r.function ?? ""),
      csvEscape(r.country ?? ""),
      csvEscape(r.grantId ?? ""),
      r.awardType,
      csvEscape(r.grantDate ?? ""),
      csvEscape(r.expirationDate ?? ""),
      r.strike,
      r.fmvUsed ?? "",
      r.fmvStrikeRatio !== undefined ? r.fmvStrikeRatio.toFixed(4) : "",
      r.sharesGranted,
      r.sharesVested,
      r.sharesExercised,
      r.sharesForfeited,
      r.sharesOutstandingComputed,
      r.sharesUnvested,
      STATUS_LABEL[r.status],
      csvEscape(r.depthBandLabel ?? ""),
      r.spreadPerShare.toFixed(4),
      Math.round(r.spreadValue),
      r.needsManualReview ? "Yes" : "No",
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
