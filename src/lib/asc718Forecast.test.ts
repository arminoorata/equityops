import { describe, expect, it } from "vitest";
import {
  addYears,
  analyzeAsc718,
  buildPeriods,
  composeAsc718Memo,
  defaultAsc718Settings,
  evaluateAward,
  parseISODate,
  rowsToCsv,
  type Asc718Settings,
  type AwardRow,
} from "./asc718Forecast";

const settings = (overrides: Partial<Asc718Settings> = {}): Asc718Settings => ({
  ...defaultAsc718Settings(),
  periodStart: "2026-01-01",
  periodEnd: "2027-12-31",
  reportingFrequency: "QUARTERLY",
  defaultForfeitureRate: 0.05,
  performanceProbabilityCap: 2.0,
  ...overrides,
});

const award = (overrides: Partial<AwardRow> = {}): AwardRow => ({
  rowId: "r1",
  awardId: "G-1",
  awardType: "RSU",
  grantDate: "2025-01-01",
  shares: 1000,
  grantDateFairValue: 50,
  vestingTermYears: 4,
  vestingPattern: "STRAIGHT_LINE",
  ...overrides,
});

// ───────── Period bucketization ─────────

describe("buildPeriods", () => {
  it("emits one annual bucket per year (inclusive)", () => {
    const start = parseISODate("2026-01-01")!;
    const end = parseISODate("2028-12-31")!;
    const periods = buildPeriods(start, end, "ANNUAL");
    expect(periods.map((p) => p.label)).toEqual(["2026", "2027", "2028"]);
  });
  it("emits quarterly buckets aligned to calendar quarters", () => {
    const start = parseISODate("2026-02-15")!;
    const end = parseISODate("2026-12-31")!;
    const periods = buildPeriods(start, end, "QUARTERLY");
    expect(periods.map((p) => p.label)).toEqual([
      "2026 Q1",
      "2026 Q2",
      "2026 Q3",
      "2026 Q4",
    ]);
    // First bucket clamps start to 2026-02-15, not 2026-01-01.
    expect(periods[0].start).toBe("2026-02-15");
  });
  it("returns no periods when end < start", () => {
    const start = parseISODate("2026-12-31")!;
    const end = parseISODate("2026-01-01")!;
    expect(buildPeriods(start, end, "ANNUAL")).toEqual([]);
  });
});

// ───────── Per-award evaluation ─────────

describe("evaluateAward", () => {
  it("computes total expected expense net of forfeitures with default rate", () => {
    const r = evaluateAward(award(), settings());
    // 1000 × 50 × 1 × (1 − 0.05) = 47500
    expect(r.totalExpectedExpense).toBe(47500);
    expect(r.forfeitureRateUsed).toBe(0.05);
  });
  it("honors per-award forfeiture override", () => {
    const r = evaluateAward(award({ forfeitureRateOverride: 0.1 }), settings());
    expect(r.forfeitureRateUsed).toBe(0.1);
    expect(r.totalExpectedExpense).toBe(45000);
  });
  it("clamps forfeiture rate to [0, 1]", () => {
    const r = evaluateAward(
      award({ forfeitureRateOverride: 1.5 }),
      settings(),
    );
    expect(r.forfeitureRateUsed).toBe(1);
    expect(r.totalExpectedExpense).toBe(0);
  });
  it("flags MISSING_FAIR_VALUE", () => {
    const r = evaluateAward(award({ grantDateFairValue: 0 }), settings());
    expect(r.exceptions.some((e) => e.type === "MISSING_FAIR_VALUE")).toBe(true);
    expect(r.totalExpectedExpense).toBe(0);
  });
  it("flags MISSING_VESTING_TERM only when service period is also missing", () => {
    const r = evaluateAward(award({ vestingTermYears: 0 }), settings());
    expect(r.exceptions.some((e) => e.type === "MISSING_VESTING_TERM")).toBe(
      true,
    );
  });
  it("does not flag MISSING_VESTING_TERM when explicit service period supplied", () => {
    const r = evaluateAward(
      award({
        vestingTermYears: 0,
        serviceStart: "2025-01-01",
        serviceEnd: "2029-01-01",
      }),
      settings(),
    );
    expect(r.exceptions.some((e) => e.type === "MISSING_VESTING_TERM")).toBe(
      false,
    );
  });
  it("flags PSU_MISSING_PROBABILITY when PSU has no factor", () => {
    const r = evaluateAward(
      award({ awardType: "PSU", performanceProbability: undefined }),
      settings(),
    );
    expect(
      r.exceptions.some((e) => e.type === "PSU_MISSING_PROBABILITY"),
    ).toBe(true);
    // Defaults probability to 1.0 so the forecast still renders.
    expect(r.probabilityUsed).toBe(1);
  });
  it("caps PSU performance probability at the scenario cap", () => {
    const r = evaluateAward(
      award({ awardType: "PSU", performanceProbability: 5 }),
      settings({ performanceProbabilityCap: 2 }),
    );
    expect(r.probabilityUsed).toBe(2);
  });
  it("flags INVERTED_SERVICE_PERIOD when service end < start", () => {
    const r = evaluateAward(
      award({
        serviceStart: "2026-01-01",
        serviceEnd: "2025-01-01",
      }),
      settings(),
    );
    expect(
      r.exceptions.some((e) => e.type === "INVERTED_SERVICE_PERIOD"),
    ).toBe(true);
  });
  it("uses serviceStart override when supplied", () => {
    const r = evaluateAward(
      award({
        grantDate: "2025-01-01",
        serviceStart: "2025-06-01",
        vestingTermYears: 4,
      }),
      settings(),
    );
    expect(r.serviceStartUsed).toBe("2025-06-01");
    // Default end = serviceStart + term.
    expect(r.serviceEndUsed).toBe("2029-06-01");
  });
});

// ───────── Recognition in window ─────────

describe("evaluateAward — recognition", () => {
  it("straight-line: recognizes a proportional slice of the service period inside the window", () => {
    // Award service period 2025-01-01 to 2029-01-01 (4 yrs); window 2026-01-01 to 2027-12-31 (2 yrs).
    const r = evaluateAward(
      award(),
      settings({ periodStart: "2026-01-01", periodEnd: "2027-12-31" }),
    );
    // Total expense = 47500. 2 years out of 4 = 50% → ~23750 (some rounding due to inclusive day count).
    expect(r.expenseInWindow).toBeGreaterThan(23000);
    expect(r.expenseInWindow).toBeLessThan(24500);
  });
  it("graded 4-year 25/25/25/25 front-loads recognition vs straight-line", () => {
    const straight = evaluateAward(
      award(),
      settings({ periodStart: "2025-01-01", periodEnd: "2025-12-31" }),
    );
    const graded = evaluateAward(
      award({ vestingPattern: "GRADED_4_YEAR_25_25_25_25" }),
      settings({ periodStart: "2025-01-01", periodEnd: "2025-12-31" }),
    );
    // First-year recognition under graded > straight-line.
    expect(graded.expenseInWindow).toBeGreaterThan(straight.expenseInWindow);
  });
  it("returns zero in-window expense when window is entirely before service start", () => {
    const r = evaluateAward(
      award({ grantDate: "2025-01-01", vestingTermYears: 4 }),
      settings({ periodStart: "2024-01-01", periodEnd: "2024-12-31" }),
    );
    expect(r.expenseInWindow).toBe(0);
    // Remaining = total (none recognized).
    expect(r.remainingExpense).toBe(r.totalExpectedExpense);
  });
});

// ───────── Aggregate analysis ─────────

describe("analyzeAsc718", () => {
  it("places per-award expense across periods and totals correctly", () => {
    // Two awards both vesting straight-line over 4 years from 2025-01-01.
    const a = analyzeAsc718(
      [award({ rowId: "1" }), award({ rowId: "2" })],
      settings({
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        reportingFrequency: "ANNUAL",
      }),
    );
    expect(a.periods.length).toBe(1);
    expect(a.summary.totalExpenseInWindow).toBeGreaterThan(0);
    expect(a.periods[0].totalExpense).toBeCloseTo(
      a.summary.totalExpenseInWindow,
      2,
    );
  });
  it("sums by award type", () => {
    const a = analyzeAsc718(
      [
        award({ rowId: "1", awardType: "RSU" }),
        award({ rowId: "2", awardType: "ISO" }),
      ],
      settings(),
    );
    expect(a.summary.byAwardType.RSU).toBeGreaterThan(0);
    expect(a.summary.byAwardType.ISO).toBeGreaterThan(0);
  });
  it("sums expense by grant year", () => {
    const a = analyzeAsc718(
      [
        award({ rowId: "1", grantDate: "2024-06-15" }),
        award({ rowId: "2", grantDate: "2025-06-15" }),
      ],
      settings(),
    );
    expect(a.summary.byGrantYear.length).toBe(2);
    expect(a.summary.byGrantYear[0].year).toBe(2024);
    expect(a.summary.byGrantYear[1].year).toBe(2025);
  });
  it("counts exceptions cleanly", () => {
    const a = analyzeAsc718(
      [
        award({ rowId: "1", grantDateFairValue: 0 }),
        award({ rowId: "2", awardType: "PSU", performanceProbability: undefined }),
      ],
      settings(),
    );
    expect(a.summary.countByException.MISSING_FAIR_VALUE).toBe(1);
    expect(a.summary.countByException.PSU_MISSING_PROBABILITY).toBe(1);
  });
});

// ───────── Memo + CSV ─────────

describe("composeAsc718Memo", () => {
  it("renders all numbered sections + disclaimer", () => {
    const a = analyzeAsc718([award()], settings());
    const memo = composeAsc718Memo(a);
    [
      "# ASC 718 expense forecast — planning memo",
      "## 1. Inputs and assumptions",
      "## 2. Totals",
      "## 3. Forecast by period",
      "## 4. Total expected expense by award type",
      "## 5. Total expected expense by grant year",
      "## 6. Exceptions",
      "## 7. Recommended next steps",
      "## Disclaimer",
    ].forEach((s) => expect(memo).toContain(s));
    expect(memo).toMatch(/external auditor/i);
    expect(memo).toMatch(/ASC 718/);
  });
});

describe("rowsToCsv", () => {
  it("emits header + one row per award", () => {
    const a = analyzeAsc718(
      [award({ rowId: "1" }), award({ rowId: "2" })],
      settings(),
    );
    const csv = rowsToCsv(a.rows);
    const lines = csv.split("\n");
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain("Total Expected Expense");
  });
});

describe("addYears", () => {
  it("adds calendar years preserving month/day", () => {
    const d = parseISODate("2025-02-15")!;
    const out = addYears(d, 4);
    expect(out.getFullYear()).toBe(2029);
    expect(out.getMonth()).toBe(1);
    expect(out.getDate()).toBe(15);
  });
});
