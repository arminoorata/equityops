import type {
  Award,
  EmployeeContext,
  RetirementPolicy,
} from "./retirementVesting";

/**
 * Sample retirement scenario for the demo / "show me what the output
 * looks like before I type my own" path. Numbers are synthetic and
 * picked to surface every status type (FULL_VESTING, PRO_RATA,
 * FORFEITURE, ALREADY_FULLY_VESTED, NEEDS_REVIEW) so a first-time
 * visitor sees the full output flow.
 *
 * To produce FORFEITURE without making the employee ineligible
 * overall, the policy treats ISO grants as FORFEITURE at retirement
 * (a common real-world choice — ISO acceleration is rarer than RSU
 * acceleration). NEEDS_REVIEW is produced by a PSU with a missing
 * vest end date that runs into the pro-rata calculation.
 */
export const SAMPLE_EMPLOYEE: EmployeeContext = {
  birthDate: "1968-04-15",
  hireDate: "2008-09-01",
  retirementDate: "2026-12-31",
  sharePriceOverride: 50,
};

export const SAMPLE_POLICY: RetirementPolicy = {
  eligibilityRule: {
    type: "AGE_PLUS_SERVICE",
    combinedThreshold: 65,
    minAge: 55,
  },
  eligibilityCheckAt: "RETIREMENT_DATE",
  treatments: {
    ISO: "FORFEITURE",
    NSO: "PRO_RATA",
    RSU: "FULL_VESTING",
    PSU: "PRO_RATA",
    RSA: "FULL_VESTING",
    OTHER: "PRO_RATA",
  },
  proRataMethod: "MONTHS_SERVICE",
  treatmentIfNotEligible: "FORFEITURE",
};

export const SAMPLE_AWARDS: Award[] = [
  // FULL_VESTING — RSU under eligible policy.
  {
    awardId: "RSU-2023-001",
    awardType: "RSU",
    grantDate: "2023-02-15",
    vestStartDate: "2023-02-15",
    vestEndDate: "2027-02-15",
    sharesGranted: 4000,
    sharesVested: 2000,
    pricePerShare: 50,
  },
  {
    awardId: "RSU-2024-014",
    awardType: "RSU",
    grantDate: "2024-02-20",
    vestStartDate: "2024-02-20",
    vestEndDate: "2028-02-20",
    sharesGranted: 3200,
    sharesVested: 800,
    pricePerShare: 50,
  },
  // PRO_RATA — NSO with strike (intrinsic value used for valuation).
  {
    awardId: "NSO-2022-007",
    awardType: "NSO",
    grantDate: "2022-03-01",
    vestStartDate: "2022-03-01",
    vestEndDate: "2026-03-01",
    sharesGranted: 5000,
    sharesVested: 3750,
    pricePerShare: 50,
    strike: 22,
  },
  // PRO_RATA — PSU with full schedule data.
  {
    awardId: "PSU-2025-003",
    awardType: "PSU",
    grantDate: "2025-02-15",
    vestStartDate: "2025-02-15",
    vestEndDate: "2028-02-15",
    sharesGranted: 1800,
    sharesVested: 0,
    pricePerShare: 50,
  },
  // ALREADY_FULLY_VESTED — older RSU, fully vested before retirement.
  {
    awardId: "RSU-2019-099",
    awardType: "RSU",
    grantDate: "2019-04-01",
    vestStartDate: "2019-04-01",
    vestEndDate: "2023-04-01",
    sharesGranted: 2400,
    sharesVested: 2400,
    pricePerShare: 50,
  },
  // FORFEITURE — ISO under a policy that does not accelerate ISOs at
  // retirement. Demonstrates the FORFEITURE status without making the
  // employee globally ineligible.
  {
    awardId: "ISO-2024-022",
    awardType: "ISO",
    grantDate: "2024-05-01",
    vestStartDate: "2024-05-01",
    vestEndDate: "2028-05-01",
    sharesGranted: 1500,
    sharesVested: 375,
    pricePerShare: 50,
    strike: 35,
  },
  // NEEDS_REVIEW — PSU with treatment PRO_RATA but missing vest end
  // date. The pro-rata calculation cannot complete; the engine flags
  // the row instead of guessing.
  {
    awardId: "PSU-2025-014",
    awardType: "PSU",
    grantDate: "2025-08-01",
    vestStartDate: "2025-08-01",
    vestEndDate: undefined,
    sharesGranted: 900,
    sharesVested: 0,
    pricePerShare: 50,
  },
];
