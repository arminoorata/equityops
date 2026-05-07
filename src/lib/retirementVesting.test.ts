import { describe, expect, it } from "vitest";
import {
  analyzeAwards,
  checkEligibility,
  completedYearsBetween,
  composeRetirementMemo,
  defaultPolicy,
  evaluateAward,
  monthsBetween,
  parseISODate,
  yearsBetween,
  type Award,
  type EmployeeContext,
  type RetirementPolicy,
} from "./retirementVesting";

const close = (a: number, b: number, eps = 0.005) => Math.abs(a - b) < eps;

// ───────── Date utilities ─────────

describe("parseISODate", () => {
  it("parses valid YYYY-MM-DD", () => {
    const d = parseISODate("2026-04-15");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(15);
  });

  it("returns null for malformed strings", () => {
    expect(parseISODate("4/15/2026")).toBeNull();
    expect(parseISODate("2026/04/15")).toBeNull();
    expect(parseISODate("not a date")).toBeNull();
    expect(parseISODate("")).toBeNull();
    expect(parseISODate(null)).toBeNull();
    expect(parseISODate(undefined)).toBeNull();
  });

  it("rejects out-of-range months and days", () => {
    expect(parseISODate("2026-13-01")).toBeNull();
    expect(parseISODate("2026-02-31")).toBeNull(); // Feb 31 doesn't exist
    expect(parseISODate("2026-00-15")).toBeNull();
  });
});

describe("yearsBetween", () => {
  it("returns 0 for same date", () => {
    const d = parseISODate("2020-01-01")!;
    expect(yearsBetween(d, d)).toBe(0);
  });

  it("returns 0 when 'to' is before 'from'", () => {
    const a = parseISODate("2020-01-01")!;
    const b = parseISODate("2019-01-01")!;
    expect(yearsBetween(a, b)).toBe(0);
  });

  it("approximates whole years correctly", () => {
    const a = parseISODate("2020-01-01")!;
    const b = parseISODate("2025-01-01")!;
    expect(close(yearsBetween(a, b), 5, 0.01)).toBe(true);
  });
});

describe("completedYearsBetween", () => {
  it("day before anniversary returns N-1", () => {
    const birth = parseISODate("1968-04-15")!;
    const dayBefore = parseISODate("2026-04-14")!;
    expect(completedYearsBetween(birth, dayBefore)).toBe(57);
  });

  it("day of anniversary returns N", () => {
    const birth = parseISODate("1968-04-15")!;
    const dayOf = parseISODate("2026-04-15")!;
    expect(completedYearsBetween(birth, dayOf)).toBe(58);
  });

  it("day after anniversary still returns N", () => {
    const birth = parseISODate("1968-04-15")!;
    const dayAfter = parseISODate("2026-04-16")!;
    expect(completedYearsBetween(birth, dayAfter)).toBe(58);
  });

  it("returns 0 when 'to' is before 'from'", () => {
    expect(
      completedYearsBetween(
        parseISODate("2025-01-01")!,
        parseISODate("2024-01-01")!,
      ),
    ).toBe(0);
  });

  it("handles service-anniversary edges (Feb 29 hire)", () => {
    const hire = parseISODate("2020-02-29")!;
    // Non-leap year: anniversary is treated as Feb 28? No — getDate
    // comparison: Feb 28 day=28 < hire day=29 → not yet completed.
    // Feb 29 next leap year = anniversary. Mar 1 always counts.
    expect(completedYearsBetween(hire, parseISODate("2021-02-28")!)).toBe(0);
    expect(completedYearsBetween(hire, parseISODate("2021-03-01")!)).toBe(1);
    expect(completedYearsBetween(hire, parseISODate("2024-02-29")!)).toBe(4);
  });
});

describe("monthsBetween", () => {
  it("counts only completed months", () => {
    const a = parseISODate("2024-01-15")!;
    const b = parseISODate("2024-06-14")!;
    // 4 full months (Feb, Mar, Apr, May) + partial June, day 14 < 15
    expect(monthsBetween(a, b)).toBe(4);
  });

  it("counts the final month when day-of-month meets or exceeds start", () => {
    const a = parseISODate("2024-01-15")!;
    const b = parseISODate("2024-06-15")!;
    expect(monthsBetween(a, b)).toBe(5);
  });

  it("returns 0 when 'to' is before 'from'", () => {
    expect(
      monthsBetween(parseISODate("2024-06-01")!, parseISODate("2024-01-01")!),
    ).toBe(0);
  });
});

// ───────── Eligibility ─────────

describe("checkEligibility", () => {
  const baseEmployee: EmployeeContext = {
    birthDate: "1968-04-15",
    hireDate: "2008-09-01",
    retirementDate: "2026-12-31",
  };

  it("AGE_PLUS_SERVICE: rule of 65 with min age 55 — eligible", () => {
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityRule: {
        type: "AGE_PLUS_SERVICE",
        combinedThreshold: 65,
        minAge: 55,
      },
    };
    const result = checkEligibility(baseEmployee, policy);
    expect(result.eligible).toBe(true);
    expect(result.ageAtCheck).toBeGreaterThan(55);
    expect(result.serviceYearsAtCheck).toBeGreaterThan(15);
  });

  it("AGE: day before 55th birthday — not eligible (completed years)", () => {
    const employee: EmployeeContext = {
      birthDate: "1971-12-15",
      hireDate: "2010-01-01",
      retirementDate: "2026-12-14", // one day before 55th birthday
    };
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityRule: { type: "AGE", ageThreshold: 55 },
    };
    const result = checkEligibility(employee, policy);
    expect(result.eligible).toBe(false);
    expect(result.ageAtCheck).toBe(54);
  });

  it("AGE: day of 55th birthday — eligible (completed years)", () => {
    const employee: EmployeeContext = {
      birthDate: "1971-12-15",
      hireDate: "2010-01-01",
      retirementDate: "2026-12-15", // 55th birthday
    };
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityRule: { type: "AGE", ageThreshold: 55 },
    };
    const result = checkEligibility(employee, policy);
    expect(result.eligible).toBe(true);
    expect(result.ageAtCheck).toBe(55);
  });

  it("SERVICE: day before 10-year anniversary — not eligible", () => {
    const employee: EmployeeContext = {
      birthDate: "1965-01-01",
      hireDate: "2017-03-15",
      retirementDate: "2027-03-14",
    };
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityRule: { type: "SERVICE", serviceThreshold: 10 },
    };
    const result = checkEligibility(employee, policy);
    expect(result.eligible).toBe(false);
    expect(result.serviceYearsAtCheck).toBe(9);
  });

  it("SERVICE: day of 10-year anniversary — eligible", () => {
    const employee: EmployeeContext = {
      birthDate: "1965-01-01",
      hireDate: "2017-03-15",
      retirementDate: "2027-03-15",
    };
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityRule: { type: "SERVICE", serviceThreshold: 10 },
    };
    const result = checkEligibility(employee, policy);
    expect(result.eligible).toBe(true);
    expect(result.serviceYearsAtCheck).toBe(10);
  });

  it("SERVICE: day after 10-year anniversary — eligible", () => {
    const employee: EmployeeContext = {
      birthDate: "1965-01-01",
      hireDate: "2017-03-15",
      retirementDate: "2027-03-16",
    };
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityRule: { type: "SERVICE", serviceThreshold: 10 },
    };
    const result = checkEligibility(employee, policy);
    expect(result.eligible).toBe(true);
    expect(result.serviceYearsAtCheck).toBe(10);
  });

  it("AGE_PLUS_SERVICE: not eligible if min age fails even when sum meets", () => {
    // Born 1980, age 46 at retirement; service 30 yrs (impossible but
    // tests the rule). Sum 76 ≥ 65 but min age 55 fails.
    const employee: EmployeeContext = {
      birthDate: "1980-04-15",
      hireDate: "1996-04-15",
      retirementDate: "2026-12-31",
    };
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityRule: {
        type: "AGE_PLUS_SERVICE",
        combinedThreshold: 65,
        minAge: 55,
      },
    };
    const result = checkEligibility(employee, policy);
    expect(result.eligible).toBe(false);
    expect(result.reason.toLowerCase()).toContain("min age");
  });

  it("AGE: not eligible when age below threshold", () => {
    const employee: EmployeeContext = {
      ...baseEmployee,
      birthDate: "1980-04-15",
    };
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityRule: { type: "AGE", ageThreshold: 60 },
    };
    expect(checkEligibility(employee, policy).eligible).toBe(false);
  });

  it("SERVICE: eligible when service meets threshold", () => {
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityRule: { type: "SERVICE", serviceThreshold: 10 },
    };
    expect(checkEligibility(baseEmployee, policy).eligible).toBe(true);
  });

  it("AGE_AND_SERVICE: both must hold", () => {
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityRule: {
        type: "AGE_AND_SERVICE",
        ageThreshold: 60,
        serviceThreshold: 30,
      },
    };
    // 58yo, 18yrs service — fails both
    const result = checkEligibility(baseEmployee, policy);
    expect(result.eligible).toBe(false);
  });

  it("AGE_OR_SERVICE: either is enough", () => {
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityRule: {
        type: "AGE_OR_SERVICE",
        ageThreshold: 65,
        serviceThreshold: 15,
      },
    };
    // age fails, service passes
    expect(checkEligibility(baseEmployee, policy).eligible).toBe(true);
  });

  it("NONE: always eligible", () => {
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityRule: { type: "NONE" },
    };
    expect(checkEligibility(baseEmployee, policy).eligible).toBe(true);
  });

  it("returns ineligible result on missing dates", () => {
    const employee: EmployeeContext = {
      birthDate: "",
      hireDate: "",
      retirementDate: "",
    };
    const result = checkEligibility(employee, defaultPolicy());
    expect(result.eligible).toBe(false);
    expect(result.reason.toLowerCase()).toContain("missing");
  });
});

// ───────── Award evaluation ─────────

const baseEmployee: EmployeeContext = {
  birthDate: "1968-04-15",
  hireDate: "2008-09-01",
  retirementDate: "2026-12-31",
  sharePriceOverride: 50,
};

const baseAward: Award = {
  awardId: "RSU-1",
  awardType: "RSU",
  grantDate: "2024-02-15",
  vestStartDate: "2024-02-15",
  vestEndDate: "2028-02-15",
  sharesGranted: 4000,
  sharesVested: 1000,
  pricePerShare: 50,
};

describe("evaluateAward — full vesting", () => {
  it("eligible + RSU full-vesting policy: all unvested vest at retirement", () => {
    const result = evaluateAward(baseAward, baseEmployee, defaultPolicy());
    expect(result.status).toBe("FULL_VESTING");
    expect(result.sharesAlreadyVested).toBe(1000);
    expect(result.sharesVestingDueToRetirement).toBe(3000);
    expect(result.sharesForfeited).toBe(0);
    expect(result.estimatedValue).toBe(4000 * 50);
  });
});

describe("evaluateAward — pro-rata", () => {
  it("eligible + NSO pro-rata (months service): correct proportion vests", () => {
    const policy = defaultPolicy();
    const award: Award = {
      ...baseAward,
      awardId: "NSO-1",
      awardType: "NSO",
      grantDate: "2024-01-01",
      vestStartDate: "2024-01-01",
      vestEndDate: "2028-01-01",
      sharesGranted: 4000,
      sharesVested: 0,
    };
    // 36 months from 2024-01-01 to 2026-12-31 => actually 35 because day 31 vs day 1
    // Monthly logic: Dec 31 is past Jan 1 of next year? No, Dec 31, 2026 is 35.99 months.
    // Use monthsBetween(2024-01-01, 2026-12-31). Year diff 2, month diff 11, day 31 vs 1 doesn't subtract.
    // = 24 + 11 = 35
    // Total months = 48. Fraction = 35/48 ≈ 0.7292.
    // Pro-rata shares = round(4000 * 35/48) = round(2916.67) = 2917
    const result = evaluateAward(award, baseEmployee, policy);
    expect(result.status).toBe("PRO_RATA");
    expect(result.sharesVestingDueToRetirement).toBe(2917);
    expect(result.sharesForfeited).toBe(4000 - 2917);
  });

  it("pro-rata floors at already-vested (does not claw back)", () => {
    // If pro-rata fraction implies 25% but employee already vested 50%,
    // employee keeps the higher already-vested figure.
    const award: Award = {
      ...baseAward,
      awardId: "RSU-2",
      awardType: "PSU",
      grantDate: "2024-01-01",
      vestStartDate: "2024-01-01",
      vestEndDate: "2032-01-01",
      sharesGranted: 4000,
      sharesVested: 2000, // 50% already vested
    };
    // Pro-rata: 35 / 96 ≈ 36.5% → 1458 shares. But sharesVested=2000.
    // Effective vested = max(2000, 1458) = 2000. Additional = 0. Forfeit = 2000.
    const result = evaluateAward(award, baseEmployee, defaultPolicy());
    expect(result.status).toBe("PRO_RATA");
    expect(result.sharesVestingDueToRetirement).toBe(0);
    expect(result.sharesForfeited).toBe(2000);
  });

  it("pro-rata DAYS_FROM_GRANT method works with no vest end date issue when end is provided", () => {
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      proRataMethod: "DAYS_FROM_GRANT",
      treatments: { ...defaultPolicy().treatments, RSU: "PRO_RATA" },
    };
    const result = evaluateAward(baseAward, baseEmployee, policy);
    expect(result.status).toBe("PRO_RATA");
    // Sanity: the fraction is between 0 and 1.
    expect(result.sharesVestingDueToRetirement).toBeGreaterThan(0);
    expect(result.sharesVestingDueToRetirement).toBeLessThan(3000);
  });

  it("pro-rata VEST_FRACTION uses sharesVested/sharesGranted", () => {
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      proRataMethod: "VEST_FRACTION",
      treatments: { ...defaultPolicy().treatments, RSU: "PRO_RATA" },
    };
    const award: Award = {
      ...baseAward,
      sharesGranted: 4000,
      sharesVested: 1000, // 25%
    };
    // Fraction = 25%. ProRata = 1000. Effective = max(1000, 1000) = 1000.
    // Additional = 0. Forfeit = 3000.
    const result = evaluateAward(award, baseEmployee, policy);
    expect(result.status).toBe("PRO_RATA");
    expect(result.sharesVestingDueToRetirement).toBe(0);
    expect(result.sharesForfeited).toBe(3000);
  });

  it("pro-rata MONTHS_SERVICE without vest end date returns NEEDS_REVIEW", () => {
    const award: Award = {
      ...baseAward,
      awardId: "RSU-NO-END",
      awardType: "PSU",
      vestEndDate: undefined,
    };
    const result = evaluateAward(award, baseEmployee, defaultPolicy());
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.reason.toLowerCase()).toContain("pro-rata");
  });
});

describe("evaluateAward — forfeiture and continued vesting", () => {
  it("not eligible + default forfeiture: unvested shares forfeit", () => {
    const youngEmployee: EmployeeContext = {
      ...baseEmployee,
      birthDate: "1980-04-15",
    };
    const result = evaluateAward(baseAward, youngEmployee, defaultPolicy());
    expect(result.status).toBe("FORFEITURE");
    expect(result.sharesForfeited).toBe(3000);
    expect(result.sharesVestingDueToRetirement).toBe(0);
  });

  it("eligible + CONTINUED_VESTING treatment: shares keep vesting after retirement", () => {
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      treatments: { ...defaultPolicy().treatments, RSU: "CONTINUED_VESTING" },
    };
    const result = evaluateAward(baseAward, baseEmployee, policy);
    expect(result.status).toBe("CONTINUED_VESTING");
    expect(result.sharesVestingDueToRetirement).toBe(0);
    expect(result.sharesContinuingToVest).toBe(3000);
    expect(result.sharesForfeited).toBe(0);
  });
});

describe("evaluateAward — already fully vested", () => {
  it("award fully vested before retirement: ALREADY_FULLY_VESTED status", () => {
    const award: Award = {
      ...baseAward,
      sharesVested: baseAward.sharesGranted,
    };
    const result = evaluateAward(award, baseEmployee, defaultPolicy());
    expect(result.status).toBe("ALREADY_FULLY_VESTED");
    expect(result.sharesVestingDueToRetirement).toBe(0);
    expect(result.sharesForfeited).toBe(0);
  });
});

describe("evaluateAward — exception cases (NEEDS_REVIEW)", () => {
  it("missing grant date", () => {
    const award: Award = { ...baseAward, grantDate: "" };
    const result = evaluateAward(award, baseEmployee, defaultPolicy());
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.exceptions.some((e) => e.toLowerCase().includes("grant date"))).toBe(true);
  });

  it("retirement date before grant date", () => {
    const award: Award = {
      ...baseAward,
      grantDate: "2030-01-01",
      vestStartDate: "2030-01-01",
      vestEndDate: "2034-01-01",
    };
    const result = evaluateAward(award, baseEmployee, defaultPolicy());
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(
      result.exceptions.some((e) =>
        e.toLowerCase().includes("retirement date is before grant date"),
      ),
    ).toBe(true);
  });

  it("zero shares granted", () => {
    const award: Award = { ...baseAward, sharesGranted: 0, sharesVested: 0 };
    const result = evaluateAward(award, baseEmployee, defaultPolicy());
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.exceptions.some((e) => e.includes("zero"))).toBe(true);
  });

  it("shares vested exceeds shares granted", () => {
    const award: Award = {
      ...baseAward,
      sharesGranted: 100,
      sharesVested: 200,
    };
    const result = evaluateAward(award, baseEmployee, defaultPolicy());
    expect(result.status).toBe("NEEDS_REVIEW");
  });
});

describe("evaluateAward — option intrinsic value (P1.1)", () => {
  const optionPolicy = (): RetirementPolicy => ({
    ...defaultPolicy(),
    treatments: { ...defaultPolicy().treatments, NSO: "FULL_VESTING" },
  });

  it("ISO in-the-money: estimated value uses (price - strike) * shares", () => {
    const award: Award = {
      ...baseAward,
      awardId: "ISO-ITM",
      awardType: "ISO",
      sharesGranted: 1000,
      sharesVested: 250,
      pricePerShare: 50,
      strike: 20,
    };
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      treatments: { ...defaultPolicy().treatments, ISO: "FULL_VESTING" },
    };
    const result = evaluateAward(award, baseEmployee, policy);
    // FULL_VESTING → all 1000 shares vested at retirement.
    // Intrinsic = (50 - 20) * 1000 = 30000.
    expect(result.estimatedValue).toBe(30_000);
    expect(
      result.exceptions.some((e) => e.toLowerCase().includes("strike")),
    ).toBe(false);
  });

  it("NSO underwater (price <= strike): estimated value is 0, not negative", () => {
    const award: Award = {
      ...baseAward,
      awardId: "NSO-UW",
      awardType: "NSO",
      sharesGranted: 2000,
      sharesVested: 500,
      pricePerShare: 30,
      strike: 80,
    };
    const result = evaluateAward(award, baseEmployee, optionPolicy());
    expect(result.estimatedValue).toBe(0);
  });

  it("ISO with missing strike: estimated value omitted + exception flagged", () => {
    const award: Award = {
      ...baseAward,
      awardId: "ISO-NO-STRIKE",
      awardType: "ISO",
      sharesGranted: 1000,
      sharesVested: 250,
      pricePerShare: 50,
      strike: undefined,
    };
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      treatments: { ...defaultPolicy().treatments, ISO: "FULL_VESTING" },
    };
    const result = evaluateAward(award, baseEmployee, policy);
    expect(result.estimatedValue).toBeUndefined();
    expect(
      result.exceptions.some((e) => e.toLowerCase().includes("strike")),
    ).toBe(true);
  });

  it("NSO with missing strike: never multiplies price * shares (no overstatement)", () => {
    const award: Award = {
      ...baseAward,
      awardId: "NSO-NO-STRIKE",
      awardType: "NSO",
      sharesGranted: 5000,
      sharesVested: 1000,
      pricePerShare: 50,
      strike: undefined,
    };
    const result = evaluateAward(award, baseEmployee, optionPolicy());
    // Without my fix, this would have been 5000 * 50 = 250,000.
    expect(result.estimatedValue).toBeUndefined();
  });

  it("RSU continues to use shares * price (no strike concept)", () => {
    const award: Award = {
      ...baseAward,
      awardId: "RSU-VAL",
      awardType: "RSU",
      sharesGranted: 100,
      sharesVested: 25,
      pricePerShare: 50,
      strike: undefined, // irrelevant for RSU
    };
    const result = evaluateAward(award, baseEmployee, defaultPolicy());
    // FULL_VESTING for RSU → all 100 shares = 5000.
    expect(result.estimatedValue).toBe(5_000);
  });
});

describe("evaluateAward — eligibility checked at GRANT_DATE", () => {
  it("eligible at grant: per-award treatment is the eligible treatment", () => {
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityCheckAt: "GRANT_DATE",
    };
    // baseEmployee is 55 (completed) at grant date 2024-02-15 (born 1968-04-15;
    // pre-birthday so 55 completed yrs). Service ~15 completed yrs.
    // Sum 70 ≥ 65. Min age 55 met. → eligible at grant → full vesting.
    const result = evaluateAward(baseAward, baseEmployee, policy);
    expect(result.status).toBe("FULL_VESTING");
    expect(result.reason.toLowerCase()).toContain("at grant date");
  });

  it("pass at retirement but fail at grant: forfeit (P1.3)", () => {
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityCheckAt: "GRANT_DATE",
      eligibilityRule: { type: "AGE", ageThreshold: 55 },
    };
    // baseEmployee turns 56 in April 2024 (passes at retirement 2026-12-31).
    // earlyAward grantDate 2020-01-01 → age completed 51 → fails at grant.
    const earlyAward: Award = {
      ...baseAward,
      awardId: "EARLY-1",
      grantDate: "2020-01-01",
      vestStartDate: "2020-01-01",
      vestEndDate: "2024-01-01",
      sharesVested: 0,
      sharesGranted: 1000,
    };
    const result = evaluateAward(earlyAward, baseEmployee, policy);
    expect(result.status).toBe("FORFEITURE");
    // The per-award reason cites the grant-date eligibility decision.
    expect(result.reason.toLowerCase()).toContain("at grant date 2020-01-01");
    expect(result.reason).toContain("age 51 < 55");
  });

  it("pass at grant: treatment is the eligible treatment even if rule grew stricter (sanity check)", () => {
    // With our model, age/service are monotonically non-decreasing, so
    // "pass at grant fail at retirement" via age/service alone isn't
    // reachable. This test pins the behaviour we DO support: when
    // eligibility passes at the grant-date check, the eligible
    // treatment is what gets applied — regardless of any later
    // recomputation of age/service.
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityCheckAt: "GRANT_DATE",
      eligibilityRule: { type: "AGE", ageThreshold: 55 },
    };
    const grantOnBirthday: Award = {
      ...baseAward,
      awardId: "ON-BDAY",
      grantDate: "2023-04-15", // employee turns 55 exactly today
      vestStartDate: "2023-04-15",
      vestEndDate: "2027-04-15",
      sharesVested: 0,
      sharesGranted: 1000,
    };
    const result = evaluateAward(grantOnBirthday, baseEmployee, policy);
    expect(result.status).toBe("FULL_VESTING");
    expect(result.reason).toContain("age 55 ≥ 55");
  });

  it("checkEligibility under GRANT_DATE returns variesByAward + dedicated reason", () => {
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityCheckAt: "GRANT_DATE",
    };
    const result = checkEligibility(baseEmployee, policy);
    expect(result.variesByAward).toBe(true);
    expect(result.reason.toLowerCase()).toContain("varies");
    // Age/service still populated (retirement-date values for context).
    expect(result.ageAtCheck).toBeGreaterThan(0);
    expect(result.serviceYearsAtCheck).toBeGreaterThan(0);
  });

  it("memo under GRANT_DATE renders the variesByAward summary (P1.3)", () => {
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityCheckAt: "GRANT_DATE",
    };
    const analysis = analyzeAwards([baseAward], baseEmployee, policy);
    const memo = composeRetirementMemo(analysis, baseEmployee, policy);
    expect(memo.toLowerCase()).toContain("eligibility varies by award grant date");
    expect(memo.toLowerCase()).toContain("context only");
  });
});

describe("evaluateAward — multiple award types", () => {
  it("respects per-type treatment: RSU full vests, NSO pro-rates", () => {
    const policy = defaultPolicy();
    const rsu: Award = { ...baseAward, awardId: "RSU-A", awardType: "RSU" };
    const nso: Award = { ...baseAward, awardId: "NSO-A", awardType: "NSO" };
    const rsuResult = evaluateAward(rsu, baseEmployee, policy);
    const nsoResult = evaluateAward(nso, baseEmployee, policy);
    expect(rsuResult.status).toBe("FULL_VESTING");
    expect(nsoResult.status).toBe("PRO_RATA");
  });
});

// ───────── Top-level analysis ─────────

describe("analyzeAwards", () => {
  it("aggregates totals across multiple awards", () => {
    const awards: Award[] = [
      // RSU full vesting
      { ...baseAward, awardId: "A1" },
      // Already fully vested RSU
      {
        ...baseAward,
        awardId: "A2",
        sharesVested: baseAward.sharesGranted,
      },
      // NSO pro-rata
      {
        ...baseAward,
        awardId: "A3",
        awardType: "NSO",
        sharesVested: 0,
      },
    ];
    const analysis = analyzeAwards(awards, baseEmployee, defaultPolicy());
    expect(analysis.results).toHaveLength(3);
    expect(analysis.eligibility.eligible).toBe(true);
    expect(analysis.summary.countByStatus.FULL_VESTING).toBeGreaterThanOrEqual(1);
    expect(analysis.summary.countByStatus.ALREADY_FULLY_VESTED).toBeGreaterThanOrEqual(1);
    expect(analysis.summary.countByStatus.PRO_RATA).toBeGreaterThanOrEqual(1);
  });

  it("counts exceptions across the analysis", () => {
    const broken: Award = { ...baseAward, awardId: "BAD", grantDate: "" };
    const analysis = analyzeAwards([broken], baseEmployee, defaultPolicy());
    expect(analysis.summary.exceptionCount).toBeGreaterThan(0);
    expect(analysis.summary.countByStatus.NEEDS_REVIEW).toBe(1);
  });

  it("totalEstimatedValue is undefined when no awards have a price", () => {
    const noPriceEmployee: EmployeeContext = {
      ...baseEmployee,
      sharePriceOverride: undefined,
    };
    const noPriceAward: Award = { ...baseAward, pricePerShare: undefined };
    const analysis = analyzeAwards(
      [noPriceAward],
      noPriceEmployee,
      defaultPolicy(),
    );
    expect(analysis.summary.totalEstimatedValue).toBeUndefined();
  });
});

// ───────── Memo ─────────

describe("composeRetirementMemo", () => {
  it("includes eligibility outcome and per-award lines", () => {
    const analysis = analyzeAwards([baseAward], baseEmployee, defaultPolicy());
    const memo = composeRetirementMemo(analysis, baseEmployee, defaultPolicy());
    expect(memo).toContain("Retirement vesting impact");
    expect(memo).toContain("Eligibility");
    expect(memo).toContain(baseAward.awardId);
    expect(memo).toContain("Disclaimer");
  });

  it("flags exceptions in the memo", () => {
    const broken: Award = { ...baseAward, awardId: "X", grantDate: "" };
    const analysis = analyzeAwards([broken], baseEmployee, defaultPolicy());
    const memo = composeRetirementMemo(analysis, baseEmployee, defaultPolicy());
    expect(memo).toContain("Exceptions");
  });

  it("never claims to be legal advice", () => {
    const analysis = analyzeAwards([baseAward], baseEmployee, defaultPolicy());
    const memo = composeRetirementMemo(analysis, baseEmployee, defaultPolicy());
    expect(memo.toLowerCase()).toContain("not legal, tax, or financial advice");
    expect(memo.toLowerCase()).toContain("plan document");
  });
});
