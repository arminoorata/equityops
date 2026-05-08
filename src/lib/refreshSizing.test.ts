import { describe, expect, it } from "vitest";
import {
  analyzeRefresh,
  coerceBoolean,
  coercePerformanceTier,
  coerceRetentionRisk,
  composeRefreshMemo,
  defaultGuidelines,
  defaultSettings,
  evaluateEmployee,
  monthsBetween,
  parseISODate,
  recommendationsToCsv,
  resolveGuideline,
  type EmployeeRow,
  type RefreshGuidelines,
  type RefreshSettings,
} from "./refreshSizing";

const baseSettings = (): RefreshSettings => ({
  ...defaultSettings(),
  asOfDate: "2026-05-08",
});

const baseRow = (overrides: Partial<EmployeeRow> = {}): EmployeeRow => ({
  rowId: "r1",
  employeeId: "E001",
  employeeName: "Sample",
  level: "L5",
  country: "US",
  currentEquityValue: 200000,
  unvestedValue: 100000,
  lastGrantDate: "2025-02-01",
  priorRefreshDollars: 30000,
  performanceTier: "MEETS",
  retentionRisk: "MEDIUM",
  criticalRoleFlag: false,
  proposedRefreshDollars: undefined,
  fmvPerShare: undefined,
  vestingPattern: "4yr 25/25/25/25",
  ...overrides,
});

// ───────── Coercers ─────────

describe("coercePerformanceTier", () => {
  it("maps numeric scale 5 → TOP, 1 → BELOW", () => {
    expect(coercePerformanceTier("5")).toBe("TOP");
    expect(coercePerformanceTier("4")).toBe("HIGH");
    expect(coercePerformanceTier("3")).toBe("MEETS");
    expect(coercePerformanceTier("2")).toBe("EMERGING");
    expect(coercePerformanceTier("1")).toBe("BELOW");
  });
  it("maps common labels case-insensitively", () => {
    expect(coercePerformanceTier("Top")).toBe("TOP");
    expect(coercePerformanceTier("Outstanding")).toBe("TOP");
    expect(coercePerformanceTier("exceeds expectations")).toBe("HIGH");
    expect(coercePerformanceTier("Meets Expectations")).toBe("MEETS");
    expect(coercePerformanceTier("developing")).toBe("EMERGING");
    expect(coercePerformanceTier("below")).toBe("BELOW");
  });
  it("returns UNKNOWN for empty / unrecognized", () => {
    expect(coercePerformanceTier(undefined)).toBe("UNKNOWN");
    expect(coercePerformanceTier("")).toBe("UNKNOWN");
    expect(coercePerformanceTier("alien")).toBe("UNKNOWN");
  });
});

describe("coerceRetentionRisk", () => {
  it("maps H/M/L and full words", () => {
    expect(coerceRetentionRisk("H")).toBe("HIGH");
    expect(coerceRetentionRisk("medium")).toBe("MEDIUM");
    expect(coerceRetentionRisk("low")).toBe("LOW");
  });
  it("returns UNKNOWN otherwise", () => {
    expect(coerceRetentionRisk("")).toBe("UNKNOWN");
    expect(coerceRetentionRisk("???")).toBe("UNKNOWN");
  });
});

describe("coerceBoolean", () => {
  it("treats truthy strings as true", () => {
    expect(coerceBoolean("yes")).toBe(true);
    expect(coerceBoolean("Y")).toBe(true);
    expect(coerceBoolean("1")).toBe(true);
    expect(coerceBoolean("true")).toBe(true);
    expect(coerceBoolean("X")).toBe(true);
    expect(coerceBoolean("critical")).toBe(true);
  });
  it("treats anything else as false", () => {
    expect(coerceBoolean("no")).toBe(false);
    expect(coerceBoolean("0")).toBe(false);
    expect(coerceBoolean("")).toBe(false);
    expect(coerceBoolean(undefined)).toBe(false);
  });
});

// ───────── Date helpers ─────────

describe("parseISODate / monthsBetween", () => {
  it("parses valid ISO and computes whole-month spans", () => {
    const a = parseISODate("2024-05-08")!;
    const b = parseISODate("2026-05-08")!;
    expect(monthsBetween(a, b)).toBe(24);
  });
  it("returns 0 when to <= from", () => {
    const a = parseISODate("2026-05-08")!;
    const b = parseISODate("2024-05-08")!;
    expect(monthsBetween(a, b)).toBe(0);
  });
  it("rejects malformed dates", () => {
    expect(parseISODate("2026/05/08")).toBeNull();
    expect(parseISODate("not a date")).toBeNull();
    expect(parseISODate("2026-13-01")).toBeNull();
  });
});

// ───────── Guideline resolution ─────────

describe("resolveGuideline", () => {
  it("returns null if level not in matrix", () => {
    const g = defaultGuidelines();
    expect(resolveGuideline("L99", "MEETS", g)).toBeNull();
  });
  it("returns null if tier missing for the level", () => {
    const g: RefreshGuidelines = {
      levels: ["L5"],
      byLevelByTier: { L5: { TOP: { targetDollars: 100000 } } },
      bandLowMultiple: 0.8,
      bandHighMultiple: 1.25,
    };
    expect(resolveGuideline("L5", "MEETS", g)).toBeNull();
  });
  it("applies band defaults from the matrix when cell omits min/max", () => {
    const g: RefreshGuidelines = {
      levels: ["L5"],
      byLevelByTier: { L5: { MEETS: { targetDollars: 40000 } } },
      bandLowMultiple: 0.75,
      bandHighMultiple: 1.5,
    };
    const res = resolveGuideline("L5", "MEETS", g)!;
    expect(res.targetDollars).toBe(40000);
    expect(res.minDollars).toBe(30000);
    expect(res.maxDollars).toBe(60000);
  });
  it("honors explicit min/max on the cell", () => {
    const g: RefreshGuidelines = {
      levels: ["L5"],
      byLevelByTier: {
        L5: {
          MEETS: {
            targetDollars: 40000,
            minDollars: 25000,
            maxDollars: 70000,
          },
        },
      },
      bandLowMultiple: 0.8,
      bandHighMultiple: 1.25,
    };
    const res = resolveGuideline("L5", "MEETS", g)!;
    expect(res.minDollars).toBe(25000);
    expect(res.maxDollars).toBe(70000);
  });
});

// ───────── Per-employee evaluation ─────────

describe("evaluateEmployee — seeding & share count", () => {
  it("seeds proposed from guideline target when row leaves it blank", () => {
    const g = defaultGuidelines();
    const s = baseSettings();
    const r = evaluateEmployee(
      baseRow({ proposedRefreshDollars: undefined }),
      g,
      s,
      parseISODate(s.asOfDate!)!,
    );
    expect(r.proposedSeededFromGuideline).toBe(true);
    expect(r.proposedRefreshDollars).toBe(g.byLevelByTier.L5.MEETS!.targetDollars);
    // L5 MEETS = 38000, FMV 50 → 760 shares.
    expect(r.proposedShareCount).toBe(760);
    expect(r.fmvUsed).toBe(50);
  });
  it("uses the row's proposed when supplied", () => {
    const g = defaultGuidelines();
    const s = baseSettings();
    const r = evaluateEmployee(
      baseRow({ proposedRefreshDollars: 45000 }),
      g,
      s,
      parseISODate(s.asOfDate!)!,
    );
    expect(r.proposedSeededFromGuideline).toBe(false);
    expect(r.proposedRefreshDollars).toBe(45000);
    expect(r.proposedShareCount).toBe(900);
  });
  it("applies share rounding increment", () => {
    const g = defaultGuidelines();
    const s: RefreshSettings = {
      ...baseSettings(),
      fmvPerShare: 100,
      shareRoundingIncrement: 50,
    };
    // 50000 / 100 = 500 raw, already a multiple of 50.
    const r = evaluateEmployee(
      baseRow({ proposedRefreshDollars: 50000 }),
      g,
      s,
      parseISODate(s.asOfDate!)!,
    );
    expect(r.proposedShareCount).toBe(500);
    // 53000 / 100 = 530 raw → nearest 50 is 550 (diff 20 vs 30).
    const r2 = evaluateEmployee(
      baseRow({ proposedRefreshDollars: 53000 }),
      g,
      s,
      parseISODate(s.asOfDate!)!,
    );
    expect(r2.proposedShareCount).toBe(550);
  });
  it("flags MISSING_FMV when neither row nor settings provide one", () => {
    const g = defaultGuidelines();
    const s: RefreshSettings = { ...baseSettings(), fmvPerShare: 0 };
    const r = evaluateEmployee(
      baseRow({ proposedRefreshDollars: 30000 }),
      g,
      s,
      parseISODate(s.asOfDate!)!,
    );
    expect(r.proposedShareCount).toBeUndefined();
    expect(r.fmvUsed).toBeUndefined();
    expect(r.exceptions.some((e) => e.type === "MISSING_FMV")).toBe(true);
  });
  it("honors per-row FMV override", () => {
    const g = defaultGuidelines();
    const s: RefreshSettings = { ...baseSettings(), fmvPerShare: 50 };
    const r = evaluateEmployee(
      baseRow({ proposedRefreshDollars: 25000, fmvPerShare: 100 }),
      g,
      s,
      parseISODate(s.asOfDate!)!,
    );
    expect(r.fmvUsed).toBe(100);
    expect(r.proposedShareCount).toBe(250);
  });
});

describe("evaluateEmployee — exceptions", () => {
  it("flags MISSING_LEVEL and routes to manual review", () => {
    const r = evaluateEmployee(
      baseRow({ level: "" }),
      defaultGuidelines(),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "MISSING_LEVEL")).toBe(true);
    expect(r.needsManualReview).toBe(true);
    expect(r.proposedRefreshDollars).toBe(0);
  });
  it("flags MISSING_GUIDELINE when level is unknown", () => {
    const r = evaluateEmployee(
      baseRow({ level: "L99" }),
      defaultGuidelines(),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "MISSING_GUIDELINE")).toBe(true);
    expect(r.needsManualReview).toBe(true);
  });
  it("flags ABOVE_GUIDELINE without retention override when not critical", () => {
    const g = defaultGuidelines();
    // L5 MEETS target = 38000, max = 47500.
    const r = evaluateEmployee(
      baseRow({ proposedRefreshDollars: 50000 }),
      g,
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "ABOVE_GUIDELINE")).toBe(true);
    expect(r.exceptions.some((e) => e.type === "RETENTION_OVERRIDE")).toBe(
      false,
    );
    expect(r.needsManualReview).toBe(false);
  });
  it("adds RETENTION_OVERRIDE when above guideline AND critical role", () => {
    const g = defaultGuidelines();
    const r = evaluateEmployee(
      baseRow({
        proposedRefreshDollars: 50000,
        criticalRoleFlag: true,
      }),
      g,
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "RETENTION_OVERRIDE")).toBe(
      true,
    );
  });
  it("flags WAY_ABOVE_GUIDELINE and routes to manual review", () => {
    const g = defaultGuidelines();
    // L5 MEETS target 38000 × 1.5 = 57000 → 60000 trips it.
    const r = evaluateEmployee(
      baseRow({ proposedRefreshDollars: 60000 }),
      g,
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "WAY_ABOVE_GUIDELINE")).toBe(
      true,
    );
    expect(r.needsManualReview).toBe(true);
  });
  it("flags BELOW_GUIDELINE", () => {
    const g = defaultGuidelines();
    // L5 MEETS min = 30400; 25000 is below.
    const r = evaluateEmployee(
      baseRow({ proposedRefreshDollars: 25000 }),
      g,
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "BELOW_GUIDELINE")).toBe(true);
  });
  it("flags WAY_BELOW_GUIDELINE", () => {
    const g = defaultGuidelines();
    // L5 MEETS target 38000 × 0.5 = 19000 → 5000 is way below.
    const r = evaluateEmployee(
      baseRow({ proposedRefreshDollars: 5000 }),
      g,
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "WAY_BELOW_GUIDELINE")).toBe(
      true,
    );
    expect(r.needsManualReview).toBe(true);
  });
  it("flags ZERO_VALUE_PROPOSED only when no MISSING_LEVEL/GUIDELINE explains it", () => {
    const g = defaultGuidelines();
    const r = evaluateEmployee(
      baseRow({ proposedRefreshDollars: 0 }),
      g,
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    // L5 MEETS resolved a guideline, but the user explicitly set 0.
    expect(r.exceptions.some((e) => e.type === "ZERO_VALUE_PROPOSED")).toBe(
      true,
    );
    const r2 = evaluateEmployee(
      baseRow({ level: "L99", proposedRefreshDollars: undefined }),
      g,
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    // MISSING_GUIDELINE explains the zero; no ZERO_VALUE_PROPOSED on top.
    expect(r2.exceptions.some((e) => e.type === "ZERO_VALUE_PROPOSED")).toBe(
      false,
    );
  });
  it("flags STALE_LAST_GRANT when last grant exceeds threshold", () => {
    const g = defaultGuidelines();
    const r = evaluateEmployee(
      baseRow({ lastGrantDate: "2023-01-01" }),
      g,
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "STALE_LAST_GRANT")).toBe(true);
  });
  it("does not flag STALE_LAST_GRANT when grant is recent", () => {
    const g = defaultGuidelines();
    const r = evaluateEmployee(
      baseRow({ lastGrantDate: "2025-06-01" }),
      g,
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "STALE_LAST_GRANT")).toBe(
      false,
    );
  });
});

// ───────── Aggregation ─────────

describe("analyzeRefresh", () => {
  it("aggregates totals, by-level, by-tier and budget variance", () => {
    const g = defaultGuidelines();
    const s: RefreshSettings = { ...baseSettings(), totalBudget: 200000 };
    const rows: EmployeeRow[] = [
      baseRow({ rowId: "1", level: "L5", performanceTier: "MEETS" }), // 38000
      baseRow({
        rowId: "2",
        level: "L5",
        performanceTier: "TOP",
        proposedRefreshDollars: 60000,
      }),
      baseRow({
        rowId: "3",
        level: "L6",
        performanceTier: "HIGH",
        proposedRefreshDollars: 80000,
      }),
    ];
    const a = analyzeRefresh(rows, g, s);
    expect(a.recommendations).toHaveLength(3);
    expect(a.summary.headcount).toBe(3);
    expect(a.summary.totalProposedDollars).toBe(38000 + 60000 + 80000);
    expect(a.summary.byLevel.find((l) => l.level === "L5")?.headcount).toBe(2);
    expect(a.summary.byLevel.find((l) => l.level === "L6")?.headcount).toBe(1);
    expect(a.summary.byTier.find((t) => t.tier === "MEETS")?.headcount).toBe(1);
    expect(a.summary.byTier.find((t) => t.tier === "TOP")?.headcount).toBe(1);
    expect(a.summary.budgetUsedPct).toBeCloseTo(178000 / 200000, 5);
    expect(a.summary.budgetVariance).toBe(-22000);
  });

  it("counts NEEDS_MANUAL_REVIEW separately from raw exception types", () => {
    const g = defaultGuidelines();
    const rows: EmployeeRow[] = [
      baseRow({ rowId: "1", level: "" }), // MISSING_LEVEL → manual review
      baseRow({ rowId: "2", proposedRefreshDollars: 25000 }), // BELOW_GUIDELINE only
    ];
    const a = analyzeRefresh(rows, g, baseSettings());
    expect(a.summary.countByException.MISSING_LEVEL).toBe(1);
    expect(a.summary.countByException.BELOW_GUIDELINE).toBe(1);
    expect(a.summary.countByException.NEEDS_MANUAL_REVIEW).toBe(1);
    expect(a.summary.headcountWithExceptions).toBe(2);
  });

  it("preserves matrix level order in byLevel summary", () => {
    const g = defaultGuidelines();
    const rows: EmployeeRow[] = [
      baseRow({ rowId: "1", level: "L7", performanceTier: "MEETS" }),
      baseRow({ rowId: "2", level: "L3", performanceTier: "MEETS" }),
      baseRow({ rowId: "3", level: "L5", performanceTier: "MEETS" }),
    ];
    const a = analyzeRefresh(rows, g, baseSettings());
    expect(a.summary.byLevel.map((l) => l.level)).toEqual(["L3", "L5", "L7"]);
  });

  it("places leftover (off-matrix) levels at the end of byLevel", () => {
    const g = defaultGuidelines();
    const rows: EmployeeRow[] = [
      baseRow({ rowId: "1", level: "L5", performanceTier: "MEETS" }),
      baseRow({ rowId: "2", level: "L99", performanceTier: "MEETS" }),
    ];
    const a = analyzeRefresh(rows, g, baseSettings());
    expect(a.summary.byLevel.map((l) => l.level)).toEqual(["L5", "L99"]);
  });
});

// ───────── Memo + CSV ─────────

describe("composeRefreshMemo", () => {
  it("renders numbered sections, totals, distribution and disclaimer", () => {
    const g = defaultGuidelines();
    const s: RefreshSettings = { ...baseSettings(), totalBudget: 100000 };
    const rows: EmployeeRow[] = [
      baseRow({ rowId: "1" }),
      baseRow({ rowId: "2", level: "L6", performanceTier: "HIGH" }),
    ];
    const a = analyzeRefresh(rows, g, s);
    const memo = composeRefreshMemo(a, g);
    expect(memo).toContain("# Refresh grant sizing — planning memo");
    expect(memo).toContain("## 1. Inputs and assumptions");
    expect(memo).toContain("## 2. Totals");
    expect(memo).toContain("Proposed dollars:");
    expect(memo).toContain("## 3. Distribution by level");
    expect(memo).toContain("## 4. Distribution by performance tier");
    expect(memo).toContain("## 5. Exceptions");
    expect(memo).toContain("## 7. Recommended next steps");
    expect(memo).toContain("## Disclaimer");
    expect(memo).toContain("Budget utilization");
  });
  it("includes a manual-review section when there are review rows", () => {
    const g = defaultGuidelines();
    const rows: EmployeeRow[] = [baseRow({ rowId: "1", level: "" })];
    const memo = composeRefreshMemo(analyzeRefresh(rows, g, baseSettings()), g);
    expect(memo).toContain("## 6. Rows needing manual review");
  });
  it("renders the guideline matrix as a markdown table", () => {
    const g = defaultGuidelines();
    const memo = composeRefreshMemo(
      analyzeRefresh([baseRow()], g, baseSettings()),
      g,
    );
    expect(memo).toContain("Refresh guideline matrix applied");
    // Header row of the matrix table.
    expect(memo).toMatch(/\| Level \| Top \| High \| Meets \| Emerging \| Below \|/);
    // L5 row exists.
    expect(memo).toMatch(/\| L5 \|/);
  });
  it("notes when budget reference is not set", () => {
    const g = defaultGuidelines();
    const s: RefreshSettings = { ...baseSettings(), totalBudget: undefined };
    const memo = composeRefreshMemo(analyzeRefresh([baseRow()], g, s), g);
    expect(memo).toContain("not set");
  });
});

describe("recommendationsToCsv", () => {
  it("returns a header row plus one row per recommendation", () => {
    const g = defaultGuidelines();
    const rows: EmployeeRow[] = [
      baseRow({ rowId: "1" }),
      baseRow({ rowId: "2", level: "L6", performanceTier: "HIGH" }),
    ];
    const csv = recommendationsToCsv(
      analyzeRefresh(rows, g, baseSettings()).recommendations,
    );
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Row ID");
    expect(lines[0]).toContain("Proposed Refresh Dollars");
  });
  it("escapes commas inside exception messages", () => {
    const g = defaultGuidelines();
    const rows: EmployeeRow[] = [
      baseRow({ rowId: "1", proposedRefreshDollars: 25000 }),
    ];
    const csv = recommendationsToCsv(
      analyzeRefresh(rows, g, baseSettings()).recommendations,
    );
    // The exception message contains commas in formatted dollar amounts;
    // they should appear inside a quoted field, not as extra columns.
    const lines = csv.split("\n");
    const headerCols = lines[0].split(",").length;
    // Naive split on commas would produce more columns than the header
    // when escaping is broken; quoted CSV holds the column count steady.
    // We can't strict-equal because the row has its own quoted exception
    // content, so compare against a tolerance: it should at most equal
    // the header count, never exceed.
    // (parsed CSV would equal exactly; this guards against escape bugs.)
    expect(lines[1].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).length).toBe(
      headerCols,
    );
  });
});
