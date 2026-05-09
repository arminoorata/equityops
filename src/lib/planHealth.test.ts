import { describe, expect, it } from "vitest";
import {
  buildBoardMemo,
  buildLegalQuestions,
  computeBurnRate,
  computeOverhang,
  computeReserveRunway,
  evaluatePlanFeatures,
  evaluatePlanHealth,
  EMPTY_INPUTS,
  SAMPLE_COMPANY,
  type PlanHealthInputs,
} from "./planHealth";

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe("computeBurnRate", () => {
  it("trailing year is grants[0] / WASO[0]", () => {
    const inputs: PlanHealthInputs = {
      ...EMPTY_INPUTS,
      annualGrants: [1_200_000, 1_000_000, 800_000],
      weightedAverageSharesOutstanding: [
        100_000_000, 95_000_000, 90_000_000,
      ],
    };
    const out = computeBurnRate(inputs);
    expect(close(out.trailingYear, 0.012)).toBe(true);
  });

  it("3-year average is sum-numerator over sum-denominator", () => {
    const inputs: PlanHealthInputs = {
      ...EMPTY_INPUTS,
      annualGrants: [3_000_000, 2_000_000, 1_000_000],
      weightedAverageSharesOutstanding: [
        100_000_000, 100_000_000, 100_000_000,
      ],
    };
    const out = computeBurnRate(inputs);
    // 6M / 300M = 2%
    expect(close(out.threeYearAverage, 0.02)).toBe(true);
  });

  it("returns zero when denominator is zero, never NaN", () => {
    const inputs: PlanHealthInputs = {
      ...EMPTY_INPUTS,
      annualGrants: [1_000, 0, 0],
      weightedAverageSharesOutstanding: [0, 0, 0],
    };
    const out = computeBurnRate(inputs);
    expect(out.trailingYear).toBe(0);
    expect(out.threeYearAverage).toBe(0);
  });
});

describe("computeOverhang", () => {
  it("fully-diluted percentage uses (outstanding + available) / (outstanding + available + shares outstanding)", () => {
    const inputs: PlanHealthInputs = {
      ...EMPTY_INPUTS,
      awardsOutstanding: 5_000_000,
      sharesAvailableForGrant: 5_000_000,
      sharesOutstanding: 90_000_000,
    };
    const out = computeOverhang(inputs);
    // 10M / 100M = 10%
    expect(close(out.fullyDilutedPct, 0.1)).toBe(true);
  });

  it("investor view uses (outstanding + available) / shares outstanding", () => {
    const inputs: PlanHealthInputs = {
      ...EMPTY_INPUTS,
      awardsOutstanding: 5_000_000,
      sharesAvailableForGrant: 5_000_000,
      sharesOutstanding: 100_000_000,
    };
    const out = computeOverhang(inputs);
    // 10M / 100M = 10%
    expect(close(out.investorViewPct, 0.1)).toBe(true);
  });

  it("zero shares outstanding returns zero, never NaN", () => {
    const out = computeOverhang(EMPTY_INPUTS);
    expect(out.fullyDilutedPct).toBe(0);
    expect(out.investorViewPct).toBe(0);
  });
});

describe("computeReserveRunway", () => {
  it("years at trailing rate is reserve / trailing grants", () => {
    const inputs: PlanHealthInputs = {
      ...EMPTY_INPUTS,
      sharesAvailableForGrant: 6_000_000,
      annualGrants: [3_000_000, 2_000_000, 1_000_000],
      weightedAverageSharesOutstanding: [100_000_000, 100_000_000, 100_000_000],
    };
    const out = computeReserveRunway(inputs);
    expect(close(out.yearsAtTrailingRate, 2)).toBe(true);
    // Average rate = 2M, runway = 3 years
    expect(close(out.yearsAtAverageRate, 3)).toBe(true);
  });

  it("zero recent grants returns infinity (no current burn)", () => {
    const inputs: PlanHealthInputs = {
      ...EMPTY_INPUTS,
      sharesAvailableForGrant: 1_000_000,
      annualGrants: [0, 0, 0],
      weightedAverageSharesOutstanding: [100_000_000, 100_000_000, 100_000_000],
    };
    const out = computeReserveRunway(inputs);
    expect(out.yearsAtTrailingRate).toBe(Number.POSITIVE_INFINITY);
    expect(out.yearsAtAverageRate).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("evaluatePlanFeatures", () => {
  it("returns a finding for every feature, with the flagged state passed through", () => {
    const findings = evaluatePlanFeatures({
      singleTriggerAcceleration: true,
      evergreenReserve: false,
      repricingWithoutShareholderApproval: true,
      shareRecyclingPermitted: false,
      dividendEquivalentsOnUnvested: false,
      liberalChangeInControlDefinition: true,
      discountedStockOptionsPermitted: false,
    });
    expect(findings).toHaveLength(7);
    const map = Object.fromEntries(findings.map((f) => [f.feature, f.flagged]));
    expect(map.singleTriggerAcceleration).toBe(true);
    expect(map.evergreenReserve).toBe(false);
    expect(map.repricingWithoutShareholderApproval).toBe(true);
    expect(map.liberalChangeInControlDefinition).toBe(true);
  });

  it("every finding has a non-empty short label and explanation", () => {
    const findings = evaluatePlanFeatures(EMPTY_INPUTS.features);
    findings.forEach((f) => {
      expect(f.shortLabel.length).toBeGreaterThan(0);
      expect(f.whyItMatters.length).toBeGreaterThan(20);
    });
  });
});

describe("buildLegalQuestions", () => {
  it("triggers a question for every flagged concerning feature", () => {
    const inputs: PlanHealthInputs = {
      ...EMPTY_INPUTS,
      features: {
        ...EMPTY_INPUTS.features,
        singleTriggerAcceleration: true,
        evergreenReserve: true,
        repricingWithoutShareholderApproval: true,
      },
    };
    const questions = buildLegalQuestions(inputs);
    const triggers = questions.map((q) => q.triggeredBy);
    expect(triggers).toContain("Single-trigger acceleration");
    expect(triggers).toContain("Evergreen plan reserve");
    expect(triggers).toContain("Repricing without shareholder approval");
  });

  it("always emits the universal burn-rate and runway questions", () => {
    const questions = buildLegalQuestions(EMPTY_INPUTS);
    const triggers = questions.map((q) => q.triggeredBy);
    expect(triggers).toContain("Burn rate trajectory");
    expect(triggers).toContain("Reserve runway");
  });

  it("omits feature-specific questions when no features are flagged", () => {
    const questions = buildLegalQuestions(EMPTY_INPUTS);
    // Just the two universal questions.
    expect(questions).toHaveLength(2);
  });
});

describe("evaluatePlanHealth (top-level)", () => {
  it("composes all four sub-results", () => {
    const out = evaluatePlanHealth(SAMPLE_COMPANY);
    expect(out.burnRate.trailingYear).toBeGreaterThan(0);
    expect(out.overhang.fullyDilutedPct).toBeGreaterThan(0);
    expect(out.runway.yearsAtTrailingRate).toBeGreaterThan(0);
    expect(out.featureFindings).toHaveLength(7);
    expect(out.questionsToAsk.length).toBeGreaterThan(0);
  });

  it("sample company has evergreen and share-recycling flagged", () => {
    const out = evaluatePlanHealth(SAMPLE_COMPANY);
    const flaggedFeatures = out.featureFindings
      .filter((f) => f.flagged)
      .map((f) => f.feature);
    expect(flaggedFeatures).toContain("evergreenReserve");
    expect(flaggedFeatures).toContain("shareRecyclingPermitted");
  });
});

describe("buildBoardMemo", () => {
  it("includes the company name when provided", () => {
    const inputs: PlanHealthInputs = {
      ...SAMPLE_COMPANY,
      companyName: "ExampleCorp Inc.",
    };
    const memo = buildBoardMemo(inputs, evaluatePlanHealth(inputs));
    expect(memo).toContain("ExampleCorp Inc.");
  });

  it("uses generic 'the company' when name is empty", () => {
    const inputs: PlanHealthInputs = {
      ...SAMPLE_COMPANY,
      companyName: "",
    };
    const memo = buildBoardMemo(inputs, evaluatePlanHealth(inputs));
    expect(memo.toLowerCase()).toContain("the company");
  });

  it("includes a clear 'not a proxy advisor model' disclaimer", () => {
    const memo = buildBoardMemo(SAMPLE_COMPANY, evaluatePlanHealth(SAMPLE_COMPANY));
    expect(memo).toContain("Not a proxy advisor model");
  });

  it("includes the four headline metrics", () => {
    const memo = buildBoardMemo(SAMPLE_COMPANY, evaluatePlanHealth(SAMPLE_COMPANY));
    expect(memo).toContain("burn rate");
    expect(memo).toContain("Overhang");
    expect(memo).toContain("Share reserve runway");
  });

  it("notes the ISS EPSC weighting delta in the burn-rate section", () => {
    const memo = buildBoardMemo(SAMPLE_COMPANY, evaluatePlanHealth(SAMPLE_COMPANY));
    expect(memo).toContain("ISS Equity Plan Scorecard");
  });

  it("lists every flagged feature with its explanation", () => {
    const inputs: PlanHealthInputs = {
      ...EMPTY_INPUTS,
      features: {
        ...EMPTY_INPUTS.features,
        singleTriggerAcceleration: true,
      },
    };
    const memo = buildBoardMemo(inputs, evaluatePlanHealth(inputs));
    expect(memo).toContain("Single-trigger acceleration");
  });

  it("says 'No flagged plan features' when nothing is flagged", () => {
    const memo = buildBoardMemo(EMPTY_INPUTS, evaluatePlanHealth(EMPTY_INPUTS));
    expect(memo).toContain("No flagged plan features");
  });

  it("includes a Recommended next steps section that hands off to TR / legal / finance / accounting / committee", () => {
    const memo = buildBoardMemo(
      SAMPLE_COMPANY,
      evaluatePlanHealth(SAMPLE_COMPANY),
    );
    expect(memo).toContain("## Recommended next steps");
    expect(memo).toMatch(/TR leadership/i);
    expect(memo).toMatch(/[Ll]egal/);
    expect(memo).toMatch(/[Ff]inance/);
    expect(memo).toMatch(/[Aa]ccounting/);
    expect(memo).toMatch(/[Cc]omp committee/);
  });
});
