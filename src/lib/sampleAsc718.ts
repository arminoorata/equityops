import {
  defaultAsc718Settings,
  type Asc718Settings,
  type AwardRow,
} from "./asc718Forecast";

/**
 * Sample population for the ASC 718 demo.
 * Mid-stage public-style company with three vintages of RSU, a PSU
 * tranche, and a small NSO grant. Surfaces every shipped exception
 * (missing FV / missing term / zero shares / PSU missing probability
 * / unsupported vesting / inverted service period) on first paint.
 */
export const SAMPLE_ASC718_AWARDS: AwardRow[] = [
  // ── RSU vintages ──
  {
    rowId: "s-G-2023-001",
    awardId: "G-2023-001",
    awardType: "RSU",
    grantDate: "2023-02-15",
    shares: 50000,
    grantDateFairValue: 35,
    vestingTermYears: 4,
    vestingPattern: "GRADED_4_YEAR_25_25_25_25",
  },
  {
    rowId: "s-G-2024-001",
    awardId: "G-2024-001",
    awardType: "RSU",
    grantDate: "2024-02-15",
    shares: 75000,
    grantDateFairValue: 45,
    vestingTermYears: 4,
    vestingPattern: "GRADED_4_YEAR_25_25_25_25",
  },
  {
    rowId: "s-G-2025-001",
    awardId: "G-2025-001",
    awardType: "RSU",
    grantDate: "2025-02-15",
    shares: 90000,
    grantDateFairValue: 50,
    vestingTermYears: 4,
    vestingPattern: "GRADED_4_YEAR_25_25_25_25",
  },
  // ── PSU with probability factor ──
  {
    rowId: "s-G-2024-PSU",
    awardId: "G-2024-PSU",
    awardType: "PSU",
    grantDate: "2024-02-15",
    shares: 25000,
    grantDateFairValue: 55,
    vestingTermYears: 3,
    vestingPattern: "GRADED_3_YEAR_33_33_34",
    performanceProbability: 1.1,
  },
  // ── ISO straight-line ──
  {
    rowId: "s-G-2022-ISO",
    awardId: "G-2022-ISO",
    awardType: "ISO",
    grantDate: "2022-02-15",
    shares: 20000,
    grantDateFairValue: 25,
    vestingTermYears: 4,
    vestingPattern: "STRAIGHT_LINE",
  },
  // ── Edge cases ──
  // Missing fair value
  {
    rowId: "s-no-fv",
    awardId: "G-X1",
    awardType: "RSU",
    grantDate: "2025-02-15",
    shares: 1000,
    grantDateFairValue: 0,
    vestingTermYears: 4,
    vestingPattern: "STRAIGHT_LINE",
  },
  // PSU missing probability
  {
    rowId: "s-psu-no-prob",
    awardId: "G-X2",
    awardType: "PSU",
    grantDate: "2025-02-15",
    shares: 1000,
    grantDateFairValue: 60,
    vestingTermYears: 3,
    vestingPattern: "GRADED_3_YEAR_33_33_34",
  },
];

export function sampleAsc718Settings(): Asc718Settings {
  return {
    ...defaultAsc718Settings(),
    periodStart: "2026-01-01",
    periodEnd: "2027-12-31",
    reportingFrequency: "QUARTERLY",
    defaultForfeitureRate: 0.05,
    performanceProbabilityCap: 2.0,
  };
}
