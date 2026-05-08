import { describe, expect, it } from "vitest";
import {
  analyzeUnderwater,
  composeUnderwaterMemo,
  defaultUnderwaterSettings,
  evaluateGrant,
  parseISODate,
  rowsToCsv,
  type OptionGrant,
  type UnderwaterSettings,
} from "./underwaterOptions";

const baseSettings = (): UnderwaterSettings => ({
  ...defaultUnderwaterSettings(),
  asOfDate: "2026-05-08",
  currentFmv: 50,
});

const baseGrant = (overrides: Partial<OptionGrant> = {}): OptionGrant => ({
  rowId: "r1",
  employeeId: "E1",
  employeeName: "Sample",
  level: "L5",
  function: "Engineering",
  country: "US",
  grantId: "G-1",
  awardType: "ISO",
  grantDate: "2024-02-15",
  strike: 60,
  sharesGranted: 1000,
  sharesVested: 250,
  sharesExercised: 0,
  sharesForfeited: 0,
  ...overrides,
});

// ───────── Per-grant evaluation ─────────

describe("evaluateGrant — status decision", () => {
  it("flags an underwater grant when FMV < strike", () => {
    const r = evaluateGrant(
      baseGrant({ strike: 60 }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.status).toBe("UNDERWATER");
    expect(r.spreadValue).toBe(0);
    expect(r.fmvStrikeRatio).toBeCloseTo(50 / 60, 4);
    // 50/60 = 0.833 → ≥ 0.75 but < 0.95 → "Moderately underwater"
    expect(r.depthBandLabel).toBe("Moderately underwater");
  });
  it("classifies slightly underwater (ratio 0.96)", () => {
    const r = evaluateGrant(
      baseGrant({ strike: 52 }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    // 50/52 = 0.9615 → ≥ 0.95 → "Slightly underwater"
    expect(r.depthBandLabel).toBe("Slightly underwater");
  });
  it("flags AT_THE_MONEY when FMV == strike", () => {
    const r = evaluateGrant(
      baseGrant({ strike: 50 }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.status).toBe("AT_THE_MONEY");
  });
  it("computes spread for in-the-money grants", () => {
    const r = evaluateGrant(
      baseGrant({ strike: 30, sharesGranted: 1000 }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.status).toBe("IN_THE_MONEY");
    // (50 - 30) × 1000 = 20000.
    expect(r.spreadValue).toBe(20000);
    expect(r.spreadPerShare).toBe(20);
  });
  it("excludes the grant when strike is missing", () => {
    const r = evaluateGrant(
      baseGrant({ strike: 0 }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.status).toBe("EXCLUDED");
    expect(r.exceptions.some((e) => e.type === "MISSING_STRIKE")).toBe(true);
    expect(r.needsManualReview).toBe(true);
  });
  it("excludes the grant when FMV is missing in both row and settings", () => {
    const r = evaluateGrant(
      baseGrant(),
      { ...baseSettings(), currentFmv: 0 },
      parseISODate("2026-05-08")!,
    );
    expect(r.status).toBe("EXCLUDED");
    expect(r.exceptions.some((e) => e.type === "MISSING_FMV")).toBe(true);
  });
  it("excludes a zero-share grant from the analysis", () => {
    const r = evaluateGrant(
      baseGrant({ sharesGranted: 0 }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.status).toBe("EXCLUDED");
    expect(r.exceptions.some((e) => e.type === "ZERO_SHARES")).toBe(true);
  });
  it("flags negative inputs and coerces to non-negative", () => {
    const r = evaluateGrant(
      baseGrant({ sharesGranted: -100, strike: 60 }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.exceptions.some((e) => e.type === "NEGATIVE_VALUE")).toBe(true);
    expect(r.sharesGranted).toBe(0);
    expect(r.needsManualReview).toBe(true);
  });
});

describe("evaluateGrant — outstanding-share derivation", () => {
  it("derives outstanding from granted - exercised - forfeited when no override", () => {
    const r = evaluateGrant(
      baseGrant({
        sharesGranted: 1000,
        sharesExercised: 200,
        sharesForfeited: 100,
      }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.sharesOutstandingComputed).toBe(700);
  });
  it("honors an explicit sharesOutstanding override", () => {
    const r = evaluateGrant(
      baseGrant({
        sharesGranted: 1000,
        sharesExercised: 200,
        sharesForfeited: 100,
        sharesOutstanding: 800, // override the derivation
      }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.sharesOutstandingComputed).toBe(800);
  });
  it("computes unvested as outstanding - vested", () => {
    const r = evaluateGrant(
      baseGrant({
        sharesGranted: 1000,
        sharesVested: 250,
      }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.sharesUnvested).toBe(750);
  });
});

describe("evaluateGrant — depth bands", () => {
  it("classifies severely underwater (ratio 0.10)", () => {
    const r = evaluateGrant(
      baseGrant({ strike: 500 }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.status).toBe("UNDERWATER");
    expect(r.depthBandLabel).toBe("Severely underwater"); // 0.1 ≥ 0
  });
  it("classifies deeply underwater (ratio 0.50)", () => {
    const r = evaluateGrant(
      baseGrant({ strike: 100 }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.depthBandLabel).toBe("Deeply underwater"); // 0.5 ≥ 0.5
  });
  it("classifies moderately underwater (ratio 0.80)", () => {
    const r = evaluateGrant(
      baseGrant({ strike: 62.5 }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    // 50/62.5 = 0.80 → ≥ 0.75, < 0.95 → "Moderately underwater"
    expect(r.depthBandLabel).toBe("Moderately underwater");
  });
});

describe("evaluateGrant — expiration", () => {
  it("excludes expired grants when settings.excludeExpired is true (default)", () => {
    const r = evaluateGrant(
      baseGrant({ expirationDate: "2024-01-01" }),
      baseSettings(),
      parseISODate("2026-05-08")!,
    );
    expect(r.status).toBe("EXCLUDED");
    expect(r.exceptions.some((e) => e.type === "EXPIRED_GRANT")).toBe(true);
  });
  it("keeps expired grants when settings.excludeExpired is false", () => {
    const r = evaluateGrant(
      baseGrant({ expirationDate: "2024-01-01", strike: 60 }),
      { ...baseSettings(), excludeExpired: false },
      parseISODate("2026-05-08")!,
    );
    expect(r.status).toBe("EXPIRED");
    expect(r.exceptions.some((e) => e.type === "EXPIRED_GRANT")).toBe(true);
  });
});

// ───────── Aggregate analysis ─────────

describe("analyzeUnderwater", () => {
  const settings = baseSettings();

  const sample = (): OptionGrant[] => [
    // Three underwater grants for E1.
    baseGrant({ rowId: "1", employeeId: "E1", strike: 60, sharesGranted: 1000 }),
    baseGrant({ rowId: "2", employeeId: "E1", strike: 80, sharesGranted: 500 }),
    baseGrant({ rowId: "3", employeeId: "E1", strike: 200, sharesGranted: 300 }),
    // One in-the-money grant for E2.
    baseGrant({ rowId: "4", employeeId: "E2", strike: 30, sharesGranted: 800 }),
    // One excluded grant (missing strike).
    baseGrant({ rowId: "5", employeeId: "E3", strike: 0, sharesGranted: 200 }),
  ];

  it("counts in-scope grants and holders, excluding bad rows", () => {
    const a = analyzeUnderwater(sample(), settings);
    expect(a.summary.grantCount).toBe(4); // excludes the bad strike row
    expect(a.summary.holderCount).toBe(2); // E1 + E2
  });

  it("computes pct underwater by shares and by holders", () => {
    const a = analyzeUnderwater(sample(), settings);
    // Underwater shares: 1000 + 500 + 300 = 1800
    // In-scope shares: 1800 + 800 = 2600
    expect(a.summary.totalShares).toBe(2600);
    expect(a.summary.totalUnderwaterShares).toBe(1800);
    expect(a.summary.pctUnderwaterByShares).toBeCloseTo(1800 / 2600, 4);
    // 1 of 2 holders underwater → 50%.
    expect(a.summary.pctUnderwaterByHolders).toBeCloseTo(0.5, 4);
  });

  it("computes total spread (in-the-money intrinsic value)", () => {
    const a = analyzeUnderwater(sample(), settings);
    // Only ITM row: (50-30) × 800 = 16000.
    expect(a.summary.totalSpreadValue).toBe(16000);
    expect(a.summary.totalIntrinsicValue).toBe(16000);
  });

  it("buckets underwater grants into depth bands", () => {
    const a = analyzeUnderwater(sample(), settings);
    // 50/60 = 0.833 → "Moderately underwater"
    // 50/80 = 0.625 → "Deeply underwater"
    // 50/200 = 0.25 → "Severely underwater"
    const moderately = a.byDepthBand.find((b) => b.label === "Moderately underwater");
    const deeply = a.byDepthBand.find((b) => b.label === "Deeply underwater");
    const severely = a.byDepthBand.find((b) => b.label === "Severely underwater");
    expect(moderately?.grantCount).toBe(1);
    expect(deeply?.grantCount).toBe(1);
    expect(severely?.grantCount).toBe(1);
  });

  it("groups by tranche (year × strike)", () => {
    const a = analyzeUnderwater(sample(), settings);
    // 4 in-scope grants, each unique strike in the same year → 4 tranches.
    expect(a.byTranche.length).toBe(4);
  });

  it("counts EXCLUDED rows separately in countByStatus", () => {
    const a = analyzeUnderwater(sample(), settings);
    expect(a.summary.countByStatus.EXCLUDED).toBe(1);
    expect(a.summary.countByStatus.UNDERWATER).toBe(3);
    expect(a.summary.countByStatus.IN_THE_MONEY).toBe(1);
  });

  it("computes vested vs unvested underwater split", () => {
    const a = analyzeUnderwater(sample(), settings);
    // Each underwater row: vested=250, unvested = 1000-250=750 / 500-250=250 / 300-250=50
    // Total unvested underwater = 750 + 250 + 50 = 1050
    // Total vested underwater = 250 × 3 = 750
    expect(a.summary.underwaterUnvestedShares).toBe(1050);
    expect(a.summary.underwaterVestedShares).toBe(750);
  });

  it("computes Gini-free by-level distribution sorted by % underwater desc", () => {
    const a = analyzeUnderwater(sample(), settings);
    expect(a.byLevel.length).toBeGreaterThan(0);
    // Sorted by pctUnderwater descending; first entry should be ≥ second.
    if (a.byLevel.length > 1) {
      expect(a.byLevel[0].pctUnderwater).toBeGreaterThanOrEqual(
        a.byLevel[1].pctUnderwater,
      );
    }
  });

  it("treats per-row FMV override as the spread basis", () => {
    const grants: OptionGrant[] = [
      baseGrant({ rowId: "1", strike: 60, fmvOverride: 100 }), // ITM via override
    ];
    const a = analyzeUnderwater(grants, settings);
    expect(a.summary.countByStatus.IN_THE_MONEY).toBe(1);
    expect(a.summary.totalSpreadValue).toBe(40 * 1000);
  });
});

// ───────── Memo composition ─────────

describe("composeUnderwaterMemo", () => {
  it("renders all numbered sections + headline + disclaimer", () => {
    const grants: OptionGrant[] = [
      baseGrant({ rowId: "1", employeeId: "A", strike: 60 }),
      baseGrant({ rowId: "2", employeeId: "B", strike: 30 }),
    ];
    const memo = composeUnderwaterMemo(
      analyzeUnderwater(grants, baseSettings()),
    );
    [
      "# Underwater options exposure — planning memo",
      "## 1. Inputs and assumptions",
      "## 2. Headline exposure",
      "## 3. Vested vs unvested underwater exposure",
      "## 4. Underwater by award type",
      "## 5. Depth bands",
      "## 6. By grant year",
      "## 7. By level",
      "## 8. Tranches",
      "## 9. Exceptions",
      "## 10. Recommended next steps",
      "## Disclaimer",
    ].forEach((s) => {
      expect(memo).toContain(s);
    });
    // ISO note lands; memo refuses to recommend repricing.
    expect(memo).toMatch(/ISO note/);
    expect(memo).toMatch(/not a recommendation to reprice/i);
  });
  it("flags ISS / Glass Lewis posture in the next-steps handoff", () => {
    const memo = composeUnderwaterMemo(
      analyzeUnderwater([baseGrant()], baseSettings()),
    );
    expect(memo).toMatch(/ISS/);
    expect(memo).toMatch(/Glass Lewis/);
  });
});

describe("rowsToCsv", () => {
  it("produces a header + one row per grant", () => {
    const grants: OptionGrant[] = [
      baseGrant({ rowId: "1", strike: 60 }),
      baseGrant({ rowId: "2", strike: 30 }),
    ];
    const a = analyzeUnderwater(grants, baseSettings());
    const csv = rowsToCsv(a.rows);
    const lines = csv.split("\n");
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain("Status");
    expect(lines[0]).toContain("FMV/Strike Ratio");
    expect(lines[0]).toContain("Spread Value");
  });
});
