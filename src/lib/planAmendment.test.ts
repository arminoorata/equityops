import { describe, expect, it } from "vitest";
import {
  analyzePlanAmendment,
  composePlanAmendmentMemo,
  defaultAmendmentProposal,
  defaultCurrentPlanState,
  forecastToCsv,
  type PlanAmendmentInputs,
} from "./planAmendment";

const baseInputs = (overrides: Partial<PlanAmendmentInputs> = {}): PlanAmendmentInputs => ({
  current: { ...defaultCurrentPlanState(), ...overrides.current },
  proposal: { ...defaultAmendmentProposal(), ...overrides.proposal },
});

describe("analyzePlanAmendment — before snapshot", () => {
  it("computes overhang, runway, and burn % from defaults", () => {
    const a = analyzePlanAmendment(baseInputs());
    // (8M + 4M) / 100M = 12%
    expect(a.before.overhangPct).toBeCloseTo(12, 4);
    // 4M / 2.5M = 1.6 yrs
    expect(a.before.runwayYears).toBeCloseTo(1.6, 4);
    // 2.5M / 100M = 2.5%
    expect(a.before.annualBurnPct).toBeCloseTo(2.5, 4);
  });
});

describe("analyzePlanAmendment — after snapshot", () => {
  it("adds proposed shares to the reserve and reports incremental dilution", () => {
    const a = analyzePlanAmendment(
      baseInputs({
        proposal: {
          ...defaultAmendmentProposal(),
          additionalReserveShares: 6_000_000,
        },
      }),
    );
    // After overhang = (8M + (4M + 6M)) / 100M = 18%
    expect(a.after.overhangPct).toBeCloseTo(18, 4);
    expect(a.after.additionalDilutionPct).toBeCloseTo(6, 4);
    expect(a.after.runwayYears).toBeCloseTo(10_000_000 / 2_500_000, 2); // 4 yrs
  });
  it("reports infinite runway when evergreen ≥ projected burn", () => {
    const a = analyzePlanAmendment(
      baseInputs({
        proposal: {
          ...defaultAmendmentProposal(),
          additionalReserveShares: 1_000_000,
          evergreenEnabled: true,
          evergreenPercent: 5, // 5% × 100M = 5M ≥ 2.5M burn
        },
      }),
    );
    expect(a.after.runwayYears).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("analyzePlanAmendment — forecast walk", () => {
  it("produces one row per forecast year with reserve clamped at 0", () => {
    const a = analyzePlanAmendment(
      baseInputs({
        current: {
          ...defaultCurrentPlanState(),
          forecastYears: 3,
        },
        proposal: {
          ...defaultAmendmentProposal(),
          additionalReserveShares: 0,
        },
      }),
    );
    expect(a.forecast.length).toBe(3);
    // Reserve runs out by year 2.
    expect(a.forecast[1].reserveEnd).toBe(0);
    // Cumulative dilution monotonic.
    expect(a.forecast[2].cumulativeDilutionPct).toBeGreaterThan(
      a.forecast[0].cumulativeDilutionPct,
    );
  });
  it("scales annual burn by hiringGrowthMultiplier", () => {
    const a = analyzePlanAmendment(
      baseInputs({
        current: {
          ...defaultCurrentPlanState(),
          forecastYears: 3,
          hiringGrowthMultiplier: 1.2,
        },
      }),
    );
    expect(a.forecast[1].annualBurn).toBeCloseTo(
      a.forecast[0].annualBurn * 1.2,
      2,
    );
    expect(a.forecast[2].annualBurn).toBeCloseTo(
      a.forecast[0].annualBurn * 1.2 * 1.2,
      2,
    );
  });
  it("adds evergreen shares to reserve at the start of each year", () => {
    const a = analyzePlanAmendment(
      baseInputs({
        current: {
          ...defaultCurrentPlanState(),
          forecastYears: 2,
        },
        proposal: {
          ...defaultAmendmentProposal(),
          evergreenEnabled: true,
          evergreenPercent: 1, // 1% × 100M = 1M
        },
      }),
    );
    // Year 1 reserve start = additional reserve (0) + base (4M) + evergreen (1M) = 5M.
    expect(a.forecast[0].reserveStart).toBe(5_000_000);
  });
});

describe("analyzePlanAmendment — investor concern flags", () => {
  it("HIGH_EVERGREEN fires at >= 5% / yr", () => {
    const a = analyzePlanAmendment(
      baseInputs({
        proposal: {
          ...defaultAmendmentProposal(),
          evergreenEnabled: true,
          evergreenPercent: 5,
        },
      }),
    );
    expect(a.exceptions.some((e) => e.type === "HIGH_EVERGREEN")).toBe(true);
  });
  it("HIGH_OVERHANG_INCREMENT fires when amendment adds >= 5pp", () => {
    const a = analyzePlanAmendment(
      baseInputs({
        proposal: {
          ...defaultAmendmentProposal(),
          additionalReserveShares: 6_000_000, // overhang 12 → 18 (6pp)
        },
      }),
    );
    expect(
      a.exceptions.some((e) => e.type === "HIGH_OVERHANG_INCREMENT"),
    ).toBe(true);
  });
  it("REPRICING_WITHOUT_APPROVAL fires when allowed without approval", () => {
    const a = analyzePlanAmendment(
      baseInputs({
        proposal: {
          ...defaultAmendmentProposal(),
          repricingAllowed: true,
          repricingRequiresShareholderApproval: false,
        },
      }),
    );
    expect(
      a.exceptions.some((e) => e.type === "REPRICING_WITHOUT_APPROVAL"),
    ).toBe(true);
  });
  it("ASYMMETRIC_RECYCLING fires when full-value vs option recycling differ", () => {
    const a = analyzePlanAmendment(
      baseInputs({
        proposal: {
          ...defaultAmendmentProposal(),
          shareRecyclingFullValue: "FULL",
          shareRecyclingOptions: "NONE",
        },
      }),
    );
    expect(a.exceptions.some((e) => e.type === "ASYMMETRIC_RECYCLING")).toBe(true);
  });
  it("VERY_SHORT_RUNWAY fires when post-amendment runway < threshold", () => {
    const a = analyzePlanAmendment(
      baseInputs({
        current: {
          ...defaultCurrentPlanState(),
          availableReserve: 1_000_000,
        },
        proposal: {
          ...defaultAmendmentProposal(),
          additionalReserveShares: 0,
        },
      }),
    );
    expect(a.exceptions.some((e) => e.type === "VERY_SHORT_RUNWAY")).toBe(true);
  });
  it("VERY_LONG_RUNWAY fires when post-amendment runway > threshold", () => {
    const a = analyzePlanAmendment(
      baseInputs({
        proposal: {
          ...defaultAmendmentProposal(),
          additionalReserveShares: 50_000_000,
        },
      }),
    );
    expect(a.exceptions.some((e) => e.type === "VERY_LONG_RUNWAY")).toBe(true);
  });
});

describe("analyzePlanAmendment — invalid inputs", () => {
  it("flags zero shares outstanding", () => {
    const a = analyzePlanAmendment(
      baseInputs({
        current: { ...defaultCurrentPlanState(), sharesOutstanding: 0 },
      }),
    );
    expect(a.exceptions.some((e) => e.type === "INVALID_INPUT")).toBe(true);
  });
  it("flags forecast years out of range", () => {
    const a = analyzePlanAmendment(
      baseInputs({
        current: { ...defaultCurrentPlanState(), forecastYears: 50 },
      }),
    );
    expect(a.exceptions.some((e) => e.type === "INVALID_INPUT")).toBe(true);
  });
});

describe("composePlanAmendmentMemo", () => {
  it("renders all numbered sections + ISS-aware framing + disclaimer", () => {
    const memo = composePlanAmendmentMemo(analyzePlanAmendment(baseInputs()));
    [
      "# Plan amendment impact — board / comp committee memo",
      "## 1. Inputs and assumptions",
      "## 2. Before vs after snapshot",
      "## 3. Forecast walk",
      "## 4. Investor concern flags",
      "## 5. Legal and finance question list",
      "## 6. Recommended next steps",
      "## Disclaimer",
    ].forEach((s) => expect(memo).toContain(s));
    expect(memo).toMatch(/ISS-aware framing/);
    expect(memo).toMatch(/not an ISS \/ Glass Lewis score/i);
  });
});

describe("forecastToCsv", () => {
  it("emits header + one row per forecast year", () => {
    const a = analyzePlanAmendment(baseInputs());
    const csv = forecastToCsv(a.forecast);
    const lines = csv.split("\n");
    expect(lines.length).toBe(a.inputs.current.forecastYears + 1);
    expect(lines[0]).toContain("Cumulative Dilution");
  });
});
