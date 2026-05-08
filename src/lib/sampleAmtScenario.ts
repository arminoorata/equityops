import type { IsoGrantRow, AmtAssumptions, AmtSettings } from "./amtScenario";
import { defaultAmtAssumptions, defaultAmtSettings } from "./amtScenario";

/**
 * Sample ISO scenario for the AMT Modeler demo.
 *
 * Late-stage private executive holding three ISO grants. Strike rises
 * over time; FMV $50 today. Proposed exercise: full vested founder
 * grant + half of the second + a small chunk of the recent grant.
 *
 * Designed to surface a believable AMT exposure that the practitioner
 * can pressure-test with the assumption sliders without having to type
 * a population from scratch.
 */
export const SAMPLE_ISO_GRANTS: IsoGrantRow[] = [
  {
    rowId: "s-G-1001",
    grantId: "G-1001",
    grantDate: "2020-01-15",
    sharesExercisable: 8000,
    strike: 5,
    currentFmv: 50,
    proposedExerciseShares: 8000,
    notes: "Founder ISO; held > 2 years from grant. Full proposed exercise.",
  },
  {
    rowId: "s-G-1002",
    grantId: "G-1002",
    grantDate: "2022-06-01",
    sharesExercisable: 6000,
    strike: 12,
    currentFmv: 50,
    proposedExerciseShares: 3000,
    notes: "Mid-stage ISO. Partial proposed exercise.",
  },
  {
    rowId: "s-G-1003",
    grantId: "G-1003",
    grantDate: "2025-02-15",
    sharesExercisable: 2000,
    strike: 40,
    currentFmv: 50,
    proposedExerciseShares: 500,
    notes: "Recent grant; smaller bargain per share.",
  },
];

export function sampleAmtAssumptions(): AmtAssumptions {
  return {
    ...defaultAmtAssumptions(),
    filingStatus: "MARRIED_JOINT",
    ordinaryIncomeEstimate: 450000,
    salePricePerShare: undefined,
  };
}

export function sampleAmtSettings(): AmtSettings {
  return {
    ...defaultAmtSettings(),
    asOfDate: "2026-05-08",
    fmvAsOfDate: "2026-04-01",
    staleFmvThresholdDays: 90,
  };
}
