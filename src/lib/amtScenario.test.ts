import { describe, expect, it } from "vitest";
import {
  analyzeAmt,
  applyExemptionPhaseout,
  composeAmtMemo,
  defaultAmtAssumptions,
  defaultAmtSettings,
  evaluateGrant,
  FILING_STATUS_AMT_BRACKET_BREAKPOINT_DEFAULTS,
  FILING_STATUS_EXEMPTION_DEFAULTS,
  FILING_STATUS_PHASEOUT_START_DEFAULTS,
  parseISODate,
  planningBreakevenShares,
  rowsToCsv,
  tentativeMinimumTax,
  type AmtAssumptions,
  type AmtSettings,
  type IsoGrantRow,
} from "./amtScenario";

const baseGrant = (overrides: Partial<IsoGrantRow> = {}): IsoGrantRow => ({
  rowId: "r1",
  grantId: "G-1",
  grantDate: "2022-01-15",
  sharesExercisable: 1000,
  strike: 5,
  currentFmv: 50,
  proposedExerciseShares: 1000,
  ...overrides,
});

const baseAssumptions = (overrides: Partial<AmtAssumptions> = {}): AmtAssumptions => ({
  ...defaultAmtAssumptions(),
  ...overrides,
});

const baseSettings = (): AmtSettings => ({
  ...defaultAmtSettings(),
  asOfDate: "2026-05-08",
  fmvAsOfDate: "2026-04-01",
  staleFmvThresholdDays: 90,
});

describe("tax-year 2026 AMT defaults", () => {
  it("ships current editable exemption defaults by filing status", () => {
    expect(FILING_STATUS_EXEMPTION_DEFAULTS).toEqual({
      SINGLE: 90100,
      MARRIED_JOINT: 140200,
      MARRIED_SEPARATE: 70100,
      HEAD_OF_HOUSEHOLD: 90100,
    });
  });
  it("ships current editable phaseout and bracket defaults by filing status", () => {
    expect(FILING_STATUS_PHASEOUT_START_DEFAULTS).toEqual({
      SINGLE: 500000,
      MARRIED_JOINT: 1000000,
      MARRIED_SEPARATE: 500000,
      HEAD_OF_HOUSEHOLD: 500000,
    });
    expect(FILING_STATUS_AMT_BRACKET_BREAKPOINT_DEFAULTS).toEqual({
      SINGLE: 244500,
      MARRIED_JOINT: 244500,
      MARRIED_SEPARATE: 122250,
      HEAD_OF_HOUSEHOLD: 244500,
    });
  });
  it("defaults the sample scenario to married filing jointly 2026 values", () => {
    expect(defaultAmtAssumptions()).toMatchObject({
      filingStatus: "MARRIED_JOINT",
      amtExemption: 140200,
      exemptionPhaseoutStart: 1000000,
      amtBracketBreakpoint: 244500,
    });
  });
});

describe("evaluateGrant", () => {
  it("computes bargain per share and bargain element", () => {
    const r = evaluateGrant(baseGrant());
    expect(r.bargainPerShare).toBe(45);
    expect(r.bargainElement).toBe(45000);
    expect(r.exerciseCost).toBe(5000);
  });
  it("flags MISSING_STRIKE and excludes from totals", () => {
    const r = evaluateGrant(baseGrant({ strike: 0 }));
    expect(r.bargainElement).toBe(0);
    expect(r.exceptions.some((e) => e.type === "MISSING_STRIKE")).toBe(true);
  });
  it("flags MISSING_FMV", () => {
    const r = evaluateGrant(baseGrant({ currentFmv: 0 }));
    expect(r.bargainElement).toBe(0);
    expect(r.exceptions.some((e) => e.type === "MISSING_FMV")).toBe(true);
  });
  it("flags ZERO_PROPOSED_SHARES", () => {
    const r = evaluateGrant(baseGrant({ proposedExerciseShares: 0 }));
    expect(r.exceptions.some((e) => e.type === "ZERO_PROPOSED_SHARES")).toBe(
      true,
    );
  });
  it("flags EXERCISE_EXCEEDS_EXERCISABLE", () => {
    const r = evaluateGrant(
      baseGrant({ sharesExercisable: 1000, proposedExerciseShares: 1500 }),
    );
    expect(
      r.exceptions.some((e) => e.type === "EXERCISE_EXCEEDS_EXERCISABLE"),
    ).toBe(true);
  });
  it("rounds half-shares to integers", () => {
    const r = evaluateGrant(
      baseGrant({ sharesExercisable: 100.4, proposedExerciseShares: 100.6 }),
    );
    expect(r.sharesExercisable).toBe(100);
    expect(r.proposedExerciseShares).toBe(101);
  });
  it("treats FMV ≤ strike as zero bargain (out-of-money ISO)", () => {
    const r = evaluateGrant(baseGrant({ strike: 60, currentFmv: 50 }));
    expect(r.bargainPerShare).toBe(0);
    expect(r.bargainElement).toBe(0);
  });
});

describe("applyExemptionPhaseout", () => {
  it("returns the full exemption when AMTI is below the phaseout start", () => {
    expect(applyExemptionPhaseout(1000, 500, 2000, 0.25)).toBe(500);
  });
  it("phases out exemption at 25¢ per dollar above the start", () => {
    // AMTI 2,400 -> $400 over -> $100 reduction -> exemption $400.
    expect(applyExemptionPhaseout(2400, 500, 2000, 0.25)).toBe(400);
  });
  it("clamps the exemption at zero (cannot go negative)", () => {
    expect(applyExemptionPhaseout(10000, 500, 2000, 0.25)).toBe(0);
  });
});

describe("tentativeMinimumTax", () => {
  it("returns 0 when AMTI-after-exemption is non-positive", () => {
    expect(tentativeMinimumTax(0, 100000, 0.26, 0.28)).toBe(0);
    expect(tentativeMinimumTax(-100, 100000, 0.26, 0.28)).toBe(0);
  });
  it("uses the low rate up to the breakpoint", () => {
    expect(tentativeMinimumTax(50000, 100000, 0.26, 0.28)).toBeCloseTo(13000, 5);
  });
  it("applies the high rate above the breakpoint", () => {
    // 150000 -> 100000 x 0.26 + 50000 x 0.28 = 40000.
    expect(tentativeMinimumTax(150000, 100000, 0.26, 0.28)).toBeCloseTo(40000, 5);
  });
});

describe("planningBreakevenShares", () => {
  it("returns total shares when AMT exposure stays at zero across the full proposed exercise", () => {
    // Tiny bargain: strike 49, FMV 50, 100 shares → bargain = 100. Even
    // adding $100 to the AMTI proxy won't move TMT above the regular tax.
    const rows = [evaluateGrant(baseGrant({ strike: 49, proposedExerciseShares: 100 }))];
    const r = planningBreakevenShares(rows, 350000, 140200, 1000000, 0.25, 244500, 0.26, 0.28, 0.27);
    expect(r.shares).toBe(100);
    expect(r.note).toMatch(/stays at \$0/);
  });
  it("returns zero when there is no bargain at all", () => {
    const rows = [evaluateGrant(baseGrant({ strike: 60, currentFmv: 50 }))];
    const r = planningBreakevenShares(rows, 350000, 140200, 1000000, 0.25, 244500, 0.26, 0.28, 0.27);
    expect(r.shares).toBe(0);
    expect(r.note).toMatch(/No bargain element/);
  });
  it("reports zero and a flag when AMT exposure is positive at zero exercise", () => {
    // Push the regular rate to 0; ordinary income alone produces TMT > 0.
    const rows = [evaluateGrant(baseGrant())];
    const r = planningBreakevenShares(rows, 350000, 140200, 1000000, 0.25, 244500, 0.26, 0.28, 0.0);
    expect(r.shares).toBe(0);
    expect(r.note).toMatch(/AMT exposure is already positive/);
  });
});

describe("analyzeAmt — totals and computation", () => {
  it("computes bargain, exercise cost, AMTI, exemption, TMT, and exposure", () => {
    const rows = [
      baseGrant({ rowId: "1", strike: 5, currentFmv: 50, proposedExerciseShares: 5000 }),
      baseGrant({ rowId: "2", strike: 10, currentFmv: 50, proposedExerciseShares: 3000 }),
    ];
    const a = analyzeAmt(rows, baseAssumptions(), baseSettings());
    expect(a.totals.proposedExerciseShares).toBe(8000);
    expect(a.totals.totalExerciseCost).toBe(5 * 5000 + 10 * 3000); // 55000
    expect(a.totals.totalBargainElement).toBe(45 * 5000 + 40 * 3000); // 345000
    expect(a.computation.amtIncome).toBe(350000 + 345000); // 695000
    expect(a.computation.tentativeMinimumTax).toBeGreaterThan(0);
    expect(a.computation.regularTaxEstimate).toBeCloseTo(350000 * 0.27, 4);
  });
  it("flips to a $0 exposure when regular tax dominates", () => {
    // Tiny exercise with high regular rate slider: TMT < regular tax.
    const rows = [
      baseGrant({ strike: 49, currentFmv: 50, proposedExerciseShares: 10 }),
    ];
    const a = analyzeAmt(rows, baseAssumptions({ effectiveRegularRate: 0.6 }), baseSettings());
    expect(a.computation.amtExposure).toBe(0);
  });
  it("computes a sale scenario when sale price > 0", () => {
    const rows = [baseGrant()];
    const a = analyzeAmt(
      rows,
      baseAssumptions({ salePricePerShare: 75 }),
      baseSettings(),
    );
    expect(a.saleScenario).toBeDefined();
    expect(a.saleScenario!.saleSpreadValue).toBe((75 - 50) * 1000);
  });
  it("flags STALE_FMV when the FMV reference exceeds the threshold", () => {
    const a = analyzeAmt([baseGrant()], baseAssumptions(), {
      ...baseSettings(),
      fmvAsOfDate: "2025-01-01",
    });
    expect(a.exceptions.some((e) => e.type === "STALE_FMV")).toBe(true);
  });
  it("flags UNSUPPORTED_ASSUMPTION on an inverted bracket", () => {
    const a = analyzeAmt([baseGrant()], baseAssumptions({ amtRateLow: 0.3, amtRateHigh: 0.2 }), baseSettings());
    expect(a.exceptions.some((e) => e.type === "UNSUPPORTED_ASSUMPTION")).toBe(
      true,
    );
  });
});

describe("composeAmtMemo", () => {
  it("renders all numbered sections and the explicit not-tax-advice disclaimer", () => {
    const a = analyzeAmt([baseGrant()], baseAssumptions(), baseSettings());
    const memo = composeAmtMemo(a);
    [
      "# AMT scenario — planning memo",
      "## 1. Inputs and assumptions",
      "## 2. Per-grant bargain element",
      "## 3. Totals at the proposed exercise",
      "## 4. Regular vs tentative minimum tax",
      "## 5. Breakeven and liquidity",
      "## Recommended next steps",
      "## Disclaimer",
    ].forEach((s) => expect(memo).toContain(s));
    expect(memo).toMatch(/qualified tax advisor/i);
    expect(memo).toMatch(/State tax/);
  });
  it("includes a sale-scenario block only when set", () => {
    const without = composeAmtMemo(
      analyzeAmt([baseGrant()], baseAssumptions(), baseSettings()),
    );
    expect(without).not.toContain("### Sale scenario");
    const withSale = composeAmtMemo(
      analyzeAmt(
        [baseGrant()],
        baseAssumptions({ salePricePerShare: 75 }),
        baseSettings(),
      ),
    );
    expect(withSale).toContain("### Sale scenario");
  });
  it("emits an exceptions section when any are present", () => {
    const memo = composeAmtMemo(
      analyzeAmt(
        [baseGrant({ strike: 0 })],
        baseAssumptions(),
        baseSettings(),
      ),
    );
    expect(memo).toContain("## 6. Exceptions");
  });
});

describe("rowsToCsv", () => {
  it("emits header + one row per grant", () => {
    const a = analyzeAmt(
      [baseGrant({ rowId: "1" }), baseGrant({ rowId: "2" })],
      baseAssumptions(),
      baseSettings(),
    );
    const csv = rowsToCsv(a.rows);
    const lines = csv.split("\n");
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain("Bargain Element");
  });
});

describe("parseISODate", () => {
  it("rejects malformed dates", () => {
    expect(parseISODate("2026/05/08")).toBeNull();
  });
});
