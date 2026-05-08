import { describe, expect, it } from "vitest";
import {
  analyzeGrantDistribution,
  composeDistributionMemo,
  defaultGrantSettings,
  evaluateRow,
  giniCoefficient,
  median,
  parseISODate,
  rowsToCsv,
  yearsBetween,
  type GrantRow,
  type GrantSettings,
} from "./grantDistribution";

const baseSettings = (): GrantSettings => ({
  ...defaultGrantSettings(),
  asOfDate: "2026-05-08",
});

const baseRow = (overrides: Partial<GrantRow> = {}): GrantRow => ({
  rowId: "r-1",
  employeeId: "E001",
  employeeName: "Sample",
  level: "L5",
  function: "Engineering",
  country: "US",
  performanceTier: "Meets",
  grantId: "G-1",
  awardType: "RSU",
  grantDate: "2025-02-15",
  shares: 1000,
  currentFmv: 50,
  ...overrides,
});

// ───────── Statistics ─────────

describe("median", () => {
  it("returns 0 for empty input", () => {
    expect(median([])).toBe(0);
  });
  it("returns the middle value for odd-length arrays", () => {
    expect(median([1, 5, 3])).toBe(3);
  });
  it("returns the average of the two middle values for even-length arrays", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("does not mutate the input", () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("giniCoefficient", () => {
  it("returns 0 for empty input", () => {
    expect(giniCoefficient([])).toBe(0);
  });
  it("returns 0 for an even distribution", () => {
    expect(giniCoefficient([1, 1, 1, 1])).toBe(0);
  });
  it("returns 0 for all zeros", () => {
    expect(giniCoefficient([0, 0, 0])).toBe(0);
  });
  it("approaches 1 for extreme concentration", () => {
    // 1 person holds everything in a 100-person population.
    const arr = Array.from({ length: 100 }, (_, i) => (i === 0 ? 100 : 0));
    expect(giniCoefficient(arr)).toBeGreaterThan(0.95);
  });
  it("rejects negative values", () => {
    expect(() => giniCoefficient([1, -1])).toThrow(/negative/i);
  });
});

describe("parseISODate / yearsBetween", () => {
  it("parses a valid ISO date and computes whole-year spans", () => {
    const a = parseISODate("2020-05-08")!;
    const b = parseISODate("2026-05-08")!;
    expect(yearsBetween(a, b)).toBe(6);
  });
  it("rejects malformed dates", () => {
    expect(parseISODate("2020/05/08")).toBeNull();
    expect(parseISODate("not a date")).toBeNull();
  });
  it("returns 0 when to <= from", () => {
    const a = parseISODate("2026-05-08")!;
    const b = parseISODate("2020-05-08")!;
    expect(yearsBetween(a, b)).toBe(0);
  });
});

// ───────── Per-row evaluation ─────────

describe("evaluateRow — value computation", () => {
  it("uses the explicit currentValue when supplied", () => {
    const r = evaluateRow(
      baseRow({ currentValue: 12345, currentFmv: 50, shares: 1000 }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.computedValue).toBe(12345);
  });
  it("falls back to shares × currentFmv when currentValue is absent", () => {
    const r = evaluateRow(
      baseRow({ currentValue: undefined, currentFmv: 50, shares: 1000 }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.computedValue).toBe(50000);
    expect(r.fmvUsed).toBe(50);
  });
  it("falls back to fmvAtGrant when currentFmv is absent", () => {
    const r = evaluateRow(
      baseRow({
        currentValue: undefined,
        currentFmv: undefined,
        fmvAtGrant: 25,
        shares: 1000,
      }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.computedValue).toBe(25000);
    expect(r.fmvUsed).toBe(25);
  });
  it("falls back to settings.defaultFmvPerShare when both grant FMVs are absent", () => {
    const r = evaluateRow(
      baseRow({
        currentValue: undefined,
        currentFmv: undefined,
        fmvAtGrant: undefined,
        shares: 1000,
      }),
      { ...baseSettings(), defaultFmvPerShare: 75 },
      parseISODate("2026-05-08")!,
    );
    expect(r.computedValue).toBe(75000);
    expect(r.fmvUsed).toBe(75);
  });
  it("flags MISSING_FMV when no FMV is usable", () => {
    const r = evaluateRow(
      baseRow({
        currentValue: undefined,
        currentFmv: 0,
        fmvAtGrant: 0,
      }),
      { ...baseSettings(), defaultFmvPerShare: 0 },
      parseISODate("2026-05-08")!,
    );
    expect(r.fmvUsed).toBeUndefined();
    expect(r.computedValue).toBe(0);
    expect(r.exceptions.some((e) => e.type === "MISSING_FMV")).toBe(true);
  });
});

describe("evaluateRow — exception flags", () => {
  it("flags MISSING_LEVEL and routes to manual review", () => {
    const r = evaluateRow(
      baseRow({ level: "" }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "MISSING_LEVEL")).toBe(true);
    expect(r.needsManualReview).toBe(true);
  });
  it("flags MISSING_GRANT_DATE and skips the stale check", () => {
    const r = evaluateRow(
      baseRow({ grantDate: undefined }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "MISSING_GRANT_DATE")).toBe(true);
    expect(r.exceptions.some((e) => e.type === "STALE_GRANT")).toBe(false);
  });
  it("flags ZERO_SHARES", () => {
    const r = evaluateRow(
      baseRow({ shares: 0 }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "ZERO_SHARES")).toBe(true);
  });
  it("flags STALE_GRANT past the threshold", () => {
    const r = evaluateRow(
      baseRow({ grantDate: "2018-01-01" }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "STALE_GRANT")).toBe(true);
  });
  it("does not flag STALE_GRANT for a recent grant", () => {
    const r = evaluateRow(
      baseRow({ grantDate: "2025-02-15" }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "STALE_GRANT")).toBe(false);
  });
  it("flags MISSING_DEMOGRAPHIC_FIELD when a required dimension is absent", () => {
    const settings: GrantSettings = {
      ...baseSettings(),
      requireDemographicDimensions: ["Gender"],
    };
    const r = evaluateRow(
      baseRow({ demographics: undefined }),
      settings,
      parseISODate("2026-05-08")!,
    );
    expect(
      r.exceptions.some((e) => e.type === "MISSING_DEMOGRAPHIC_FIELD"),
    ).toBe(true);
  });
});

// ───────── Aggregate analysis ─────────

describe("analyzeGrantDistribution", () => {
  const settings = baseSettings();

  const sampleRows = (): GrantRow[] => [
    baseRow({ rowId: "1", employeeId: "E1", level: "L5", function: "Eng", country: "US", awardType: "RSU", grantDate: "2024-02-15", shares: 1000, currentFmv: 50 }),
    baseRow({ rowId: "2", employeeId: "E2", level: "L6", function: "Eng", country: "US", awardType: "RSU", grantDate: "2025-02-15", shares: 2000, currentFmv: 50 }),
    baseRow({ rowId: "3", employeeId: "E3", level: "L4", function: "Sales", country: "DE", awardType: "PSU", grantDate: "2024-02-15", shares: 800, currentFmv: 50 }),
    baseRow({ rowId: "4", employeeId: "E4", level: "L7", function: "Eng", country: "US", awardType: "ISO", grantDate: "2023-02-15", shares: 5000, currentFmv: 50, fmvAtGrant: 25 }),
  ];

  it("aggregates total population value and counts", () => {
    const a = analyzeGrantDistribution(sampleRows(), settings);
    expect(a.summary.grantCount).toBe(4);
    expect(a.summary.employeeCount).toBe(4);
    expect(a.summary.totalShares).toBe(8800);
    expect(a.summary.totalValue).toBe(440000);
    expect(a.summary.averageValue).toBe(110000);
  });

  it("buckets by level, function, country, year, award type", () => {
    const a = analyzeGrantDistribution(sampleRows(), settings);
    expect(a.byLevel.map((b) => b.key).sort()).toEqual(["L4", "L5", "L6", "L7"]);
    expect(a.byFunction.map((b) => b.key).sort()).toEqual(["Eng", "Sales"]);
    expect(a.byCountry.map((b) => b.key).sort()).toEqual(["DE", "US"]);
    expect(a.byGrantYear.map((b) => b.key)).toEqual(["2023", "2024", "2025"]);
    expect(a.byAwardType.map((b) => b.key).sort()).toEqual(["ISO", "PSU", "RSU"]);
  });

  it("computes shareOfTotalValue per bucket", () => {
    const a = analyzeGrantDistribution(sampleRows(), settings);
    const sumShares = a.byLevel.reduce((s, b) => s + b.shareOfTotalValue, 0);
    expect(sumShares).toBeCloseTo(1, 5);
  });

  it("flags UNUSUALLY_HIGH_VALUE for cohort outliers", () => {
    // Build a cohort of 10 L5/Eng grants where one is way above median.
    const rows: GrantRow[] = [];
    for (let i = 0; i < 9; i++) {
      rows.push(
        baseRow({
          rowId: `c-${i}`,
          employeeId: `EE-${i}`,
          shares: 1000,
          currentFmv: 50,
        }),
      );
    }
    rows.push(
      baseRow({
        rowId: "outlier",
        employeeId: "OO",
        shares: 5000,
        currentFmv: 50,
      }),
    );
    const a = analyzeGrantDistribution(rows, settings);
    const outlier = a.rows.find((r) => r.rowId === "outlier")!;
    expect(outlier.exceptions.some((e) => e.type === "UNUSUALLY_HIGH_VALUE")).toBe(
      true,
    );
  });

  it("ignores tiny seed grants in the cohort outlier check", () => {
    // 3 tiny grants + 1 medium grant; the medium grant should not be
    // flagged just because tiny seed grants drag the median to 0.
    const rows: GrantRow[] = [
      baseRow({ rowId: "tiny-1", shares: 25, currentFmv: 50 }),
      baseRow({ rowId: "tiny-2", shares: 25, currentFmv: 50 }),
      baseRow({ rowId: "tiny-3", shares: 25, currentFmv: 50 }),
      baseRow({ rowId: "med", shares: 800, currentFmv: 50 }),
    ];
    const a = analyzeGrantDistribution(rows, settings);
    const med = a.rows.find((r) => r.rowId === "med")!;
    expect(med.exceptions.some((e) => e.type === "UNUSUALLY_HIGH_VALUE")).toBe(
      false,
    );
  });

  it("detects demographic dimensions in the population", () => {
    const rows: GrantRow[] = [
      baseRow({ rowId: "1", demographics: { Gender: "Women", "Ethnicity Group": "Asian" } }),
      baseRow({ rowId: "2", demographics: { Gender: "Men" } }),
      baseRow({ rowId: "3" }),
    ];
    const a = analyzeGrantDistribution(rows, settings);
    expect(a.summary.demographicDimensions).toEqual(["Ethnicity Group", "Gender"]);
    expect(a.byDemographic.Gender.map((b) => b.key).sort()).toEqual(["Men", "Women"]);
  });

  it("computes concentration: top-N% share of value", () => {
    const rows: GrantRow[] = [];
    for (let i = 0; i < 10; i++) {
      rows.push(
        baseRow({
          rowId: `r-${i}`,
          employeeId: `E-${i}`,
          shares: i === 0 ? 9000 : 1000,
          currentFmv: 50,
        }),
      );
    }
    const a = analyzeGrantDistribution(rows, settings);
    // Top 10% = 1 employee out of 10. They hold 9000/(9000 + 9*1000) = 50%.
    expect(a.concentration.topPctEmployeeCount).toBe(1);
    expect(a.concentration.totalEmployeeCount).toBe(10);
    expect(a.concentration.topPctShareOfValue).toBeCloseTo(0.5, 3);
    expect(a.concentration.giniCoefficient).toBeGreaterThan(0);
  });

  it("groups multi-grant employees together for concentration", () => {
    // Two employees, each with two grants. Concentration is based on
    // per-employee total value, not per-grant.
    const rows: GrantRow[] = [
      baseRow({ rowId: "1", employeeId: "A", shares: 1000, currentFmv: 50 }),
      baseRow({ rowId: "2", employeeId: "A", shares: 1000, currentFmv: 50 }),
      baseRow({ rowId: "3", employeeId: "B", shares: 1000, currentFmv: 50 }),
      baseRow({ rowId: "4", employeeId: "B", shares: 1000, currentFmv: 50 }),
    ];
    const a = analyzeGrantDistribution(rows, settings);
    expect(a.concentration.totalEmployeeCount).toBe(2);
  });

  it("counts NEEDS_MANUAL_REVIEW separately from raw exception types", () => {
    const rows: GrantRow[] = [
      baseRow({ rowId: "1", level: "" }), // missing level → manual review
      baseRow({ rowId: "2", grantDate: undefined }), // missing date — not manual review
    ];
    const a = analyzeGrantDistribution(rows, settings);
    expect(a.summary.countByException.MISSING_LEVEL).toBe(1);
    expect(a.summary.countByException.MISSING_GRANT_DATE).toBe(1);
    expect(a.summary.countByException.NEEDS_MANUAL_REVIEW).toBe(1);
  });
});

// ───────── Memo + CSV ─────────

describe("composeDistributionMemo", () => {
  const settings = baseSettings();

  it("renders numbered sections, totals, distributions, concentration, and disclaimer", () => {
    const rows: GrantRow[] = [
      baseRow({ rowId: "1", employeeId: "A", level: "L5", function: "Eng", country: "US", awardType: "RSU", grantDate: "2025-02-15", shares: 1000 }),
      baseRow({ rowId: "2", employeeId: "B", level: "L6", function: "Sales", country: "DE", awardType: "PSU", grantDate: "2024-02-15", shares: 2000 }),
    ];
    const a = analyzeGrantDistribution(rows, settings);
    const memo = composeDistributionMemo(a);
    [
      "# Grant distribution audit — planning memo",
      "## 1. Inputs and assumptions",
      "## 2. Population summary",
      "## 3. Distribution by level",
      "## 4. Distribution by function",
      "## 5. Distribution by country",
      "## 6. Distribution by grant year",
      "## 7. Distribution by award type",
      "## 10. Concentration",
      "## 11. Exceptions",
      "## 13. Recommended next steps",
      "## Disclaimer",
    ].forEach((s) => {
      expect(memo).toContain(s);
    });
  });

  it("includes a manual-review section when there are review rows", () => {
    const rows: GrantRow[] = [baseRow({ rowId: "1", level: "" })];
    const memo = composeDistributionMemo(analyzeGrantDistribution(rows, settings));
    expect(memo).toContain("## 12. Rows needing manual review");
  });

  it("includes a demographic distribution section when dimensions are present", () => {
    const rows: GrantRow[] = [
      baseRow({ rowId: "1", demographics: { Gender: "Women" } }),
      baseRow({ rowId: "2", demographics: { Gender: "Men" } }),
    ];
    const memo = composeDistributionMemo(analyzeGrantDistribution(rows, settings));
    expect(memo).toContain("## 9. Distribution by demographic dimension");
    expect(memo).toContain("### Gender");
    // The demographic note is intentionally cautious — assert it.
    expect(memo).toMatch(/disparate impact/i);
  });

  it("does NOT include a demographic section when no demographic data is present", () => {
    const rows: GrantRow[] = [baseRow({ rowId: "1" })];
    const memo = composeDistributionMemo(analyzeGrantDistribution(rows, settings));
    expect(memo).not.toContain("## 9. Distribution by demographic dimension");
    expect(memo).toContain("Demographic dimensions detected: none");
  });
});

describe("rowsToCsv", () => {
  it("returns header + one row per grant and includes demographic columns when present", () => {
    const rows: GrantRow[] = [
      baseRow({ rowId: "1", demographics: { Gender: "Women" } }),
      baseRow({ rowId: "2", demographics: { Gender: "Men", Generation: "Gen X" } }),
    ];
    const a = analyzeGrantDistribution(rows, baseSettings());
    const csv = rowsToCsv(a.rows);
    const lines = csv.split("\n");
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain("Demographic: Gender");
    expect(lines[0]).toContain("Demographic: Generation");
  });
});
