import { describe, expect, it } from "vitest";
import {
  buildVestingSchedule,
  composeOfferMemo,
  computeHireQuote,
  defaultHireSettings,
  defaultRangeSettings,
  parseISODate,
  quoteToSummaryCsv,
  roundShareCount,
  type HireScenario,
  type HireSettings,
} from "./hireRange";

const baseScenario = (overrides: Partial<HireScenario> = {}): HireScenario => ({
  candidateName: "Sample Candidate",
  level: "L5",
  function: "Engineering",
  country: "US",
  targetEquityValue: 200000,
  fmvPerShare: 50,
  fmvAsOfDate: "2026-04-01",
  vestingPattern: "FOUR_YEAR_25_25_25_25",
  range: defaultRangeSettings(),
  shareRoundingIncrement: 1,
  ...overrides,
});

const baseSettings = (): HireSettings => ({
  ...defaultHireSettings(),
  asOfDate: "2026-05-08",
  staleFmvThresholdDays: 90,
});

// ───────── Share rounding ─────────

describe("roundShareCount", () => {
  it("returns 0 for zero or negative", () => {
    expect(roundShareCount(0, 1)).toBe(0);
    expect(roundShareCount(-5, 1)).toBe(0);
  });
  it("rounds to whole shares with increment 1", () => {
    expect(roundShareCount(123.4, 1)).toBe(123);
    expect(roundShareCount(123.6, 1)).toBe(124);
  });
  it("rounds to nearest multiple of the increment", () => {
    expect(roundShareCount(123, 50)).toBe(100);
    expect(roundShareCount(125, 50)).toBe(150);
    expect(roundShareCount(149, 50)).toBe(150);
  });
});

// ───────── Vesting schedule ─────────

describe("buildVestingSchedule", () => {
  it("4-year 25/25/25/25 splits 4000 shares into 4 × 1000", () => {
    const sch = buildVestingSchedule(4000, "FOUR_YEAR_25_25_25_25", 50);
    expect(sch).toHaveLength(4);
    expect(sch.map((r) => r.yearShares)).toEqual([1000, 1000, 1000, 1000]);
    expect(sch[0].yearValue).toBe(50000);
    expect(sch[3].cumulativeShares).toBe(4000);
    expect(sch[3].cumulativeValue).toBe(200000);
  });
  it("4-year back-loaded splits 1000 shares 100/200/300/400", () => {
    const sch = buildVestingSchedule(
      1000,
      "FOUR_YEAR_BACK_LOADED_10_20_30_40",
      50,
    );
    expect(sch.map((r) => r.yearShares)).toEqual([100, 200, 300, 400]);
  });
  it("3-year 33/33/34 absorbs the rounding remainder in the final year", () => {
    const sch = buildVestingSchedule(1000, "THREE_YEAR_33_33_34", 50);
    expect(sch.map((r) => r.yearShares)).toEqual([330, 330, 340]);
  });
  it("5-year 20-each splits 1000 shares evenly", () => {
    const sch = buildVestingSchedule(1000, "FIVE_YEAR_20_EACH", 50);
    expect(sch.map((r) => r.yearShares)).toEqual([200, 200, 200, 200, 200]);
  });
  it("returns empty for an unsupported pattern (defensive)", () => {
    // Cast a fake pattern to the type system to exercise the early return.
    const sch = buildVestingSchedule(
      1000,
      "NONSENSE" as unknown as Parameters<typeof buildVestingSchedule>[1],
      50,
    );
    expect(sch).toEqual([]);
  });
});

// ───────── computeHireQuote ─────────

describe("computeHireQuote — share count and range", () => {
  it("computes mid shares from target / FMV with multiplier range", () => {
    const q = computeHireQuote(baseScenario(), baseSettings());
    expect(q.mid.dollars).toBe(200000);
    expect(q.mid.shares).toBe(4000);
    // Default low 0.85 → 170000 / 50 = 3400; high 1.15 → 230000 / 50 = 4600
    expect(q.low.shares).toBe(3400);
    expect(q.high.shares).toBe(4600);
    expect(q.midValueAtFmv).toBe(200000);
    expect(q.midAnnualizedValue).toBeCloseTo(50000, 5);
  });
  it("computes range with absolute deltas", () => {
    const q = computeHireQuote(
      baseScenario({
        range: { kind: "ABSOLUTE_BAND", lowDelta: 25000, highDelta: 25000 },
      }),
      baseSettings(),
    );
    expect(q.low.dollars).toBe(175000);
    expect(q.high.dollars).toBe(225000);
    expect(q.low.shares).toBe(3500);
    expect(q.high.shares).toBe(4500);
  });
  it("respects a 50-share rounding increment for all three points", () => {
    const q = computeHireQuote(
      baseScenario({
        targetEquityValue: 153000,
        shareRoundingIncrement: 50,
      }),
      baseSettings(),
    );
    // 153000 / 50 = 3060 → nearest 50 = 3050.
    expect(q.mid.shares).toBe(3050);
  });
  it("clamps low at 0 when an absolute delta exceeds the target", () => {
    const q = computeHireQuote(
      baseScenario({
        range: { kind: "ABSOLUTE_BAND", lowDelta: 500000, highDelta: 0 },
      }),
      baseSettings(),
    );
    expect(q.low.dollars).toBe(0);
    expect(q.low.shares).toBe(0);
  });
});

describe("computeHireQuote — exceptions", () => {
  it("flags MISSING_FMV when FMV is zero", () => {
    const q = computeHireQuote(
      baseScenario({ fmvPerShare: 0 }),
      baseSettings(),
    );
    expect(q.exceptions.some((e) => e.type === "MISSING_FMV")).toBe(true);
    expect(q.mid.shares).toBe(0);
    expect(q.midAnnualizedValue).toBe(0);
  });
  it("flags ZERO_TARGET when target is zero", () => {
    const q = computeHireQuote(
      baseScenario({ targetEquityValue: 0 }),
      baseSettings(),
    );
    expect(q.exceptions.some((e) => e.type === "ZERO_TARGET")).toBe(true);
  });
  it("flags STALE_FMV when FMV as-of date exceeds threshold", () => {
    const q = computeHireQuote(
      baseScenario({ fmvAsOfDate: "2025-01-01" }),
      baseSettings(),
    );
    expect(q.exceptions.some((e) => e.type === "STALE_FMV")).toBe(true);
    expect(q.fmvAgeDays).toBeGreaterThan(90);
  });
  it("does NOT flag STALE_FMV for a recent FMV", () => {
    const q = computeHireQuote(baseScenario(), baseSettings());
    expect(q.exceptions.some((e) => e.type === "STALE_FMV")).toBe(false);
  });
  it("flags OUT_OF_RANGE below the guardrail", () => {
    const q = computeHireQuote(
      baseScenario({ targetEquityValue: 50000 }),
      { ...baseSettings(), guardrailLowDollars: 100000 },
    );
    expect(q.exceptions.some((e) => e.type === "OUT_OF_RANGE")).toBe(true);
  });
  it("flags OUT_OF_RANGE above the guardrail", () => {
    const q = computeHireQuote(
      baseScenario({ targetEquityValue: 500000 }),
      { ...baseSettings(), guardrailHighDollars: 300000 },
    );
    expect(q.exceptions.some((e) => e.type === "OUT_OF_RANGE")).toBe(true);
  });
});

// ───────── Memo + CSV ─────────

describe("composeOfferMemo", () => {
  it("renders all numbered sections and disclaimer", () => {
    const q = computeHireQuote(baseScenario(), baseSettings());
    const memo = composeOfferMemo(q);
    [
      "# Offer range",
      "## 1. Inputs and assumptions",
      "## 2. Range",
      "## 3. Vesting schedule",
      "## 4. Recruiter talking points",
      "## Disclaimer",
    ].forEach((s) => expect(memo).toContain(s));
    expect(memo).toMatch(/Internal recruiter/);
    expect(memo).toMatch(/not personalized investment advice/i);
  });
  it("includes a vesting table when the schedule is non-empty", () => {
    const q = computeHireQuote(baseScenario(), baseSettings());
    const memo = composeOfferMemo(q);
    // Markdown table heading row.
    expect(memo).toMatch(/\| Year \| Shares vesting \|/);
  });
  it("emits an exceptions section when there are exceptions", () => {
    const q = computeHireQuote(
      baseScenario({ fmvPerShare: 0 }),
      baseSettings(),
    );
    const memo = composeOfferMemo(q);
    expect(memo).toContain("## 5. Exceptions");
    expect(memo).toContain("Missing FMV");
  });
  it("includes ISO/RSU/PSU candidate-context bullets in talking points", () => {
    const memo = composeOfferMemo(
      computeHireQuote(baseScenario(), baseSettings()),
    );
    expect(memo).toMatch(/AMT exposure/);
    expect(memo).toMatch(/RSU\/PSU\/RSA/);
  });
});

describe("quoteToSummaryCsv", () => {
  it("emits a header row + one summary row + a vesting schedule block", () => {
    const csv = quoteToSummaryCsv(
      computeHireQuote(baseScenario(), baseSettings()),
    );
    const lines = csv.split("\n");
    // Header + 1 summary + blank + vesting header + 4 vesting rows = 8.
    expect(lines.length).toBe(8);
    expect(lines[0]).toContain("Mid Shares");
    expect(lines[3]).toContain("Year,Year Shares");
  });
});

// ───────── Date helpers ─────────

describe("parseISODate", () => {
  it("rejects malformed dates", () => {
    expect(parseISODate("not a date")).toBeNull();
    expect(parseISODate("2026/01/01")).toBeNull();
  });
});
