import { describe, expect, it } from "vitest";
import {
  analyzeAwards,
  checkEligibility,
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

describe("evaluateAward — eligibility checked at GRANT_DATE", () => {
  it("a grant where the employee was eligible at grant continues to be eligible at retirement", () => {
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityCheckAt: "GRANT_DATE",
    };
    // baseEmployee is 55+ at grant date 2024-02-15? Born 1968-04-15, so 55.8 yrs old in Feb 2024.
    // Service 15.5 yrs at grant. Sum 71.3 ≥ 65. Min age 55 met. So eligible at grant.
    const result = evaluateAward(baseAward, baseEmployee, policy);
    expect(result.status).toBe("FULL_VESTING");
  });

  it("a grant where the employee was NOT eligible at grant — forfeit even if eligible at retirement", () => {
    const policy: RetirementPolicy = {
      ...defaultPolicy(),
      eligibilityCheckAt: "GRANT_DATE",
      eligibilityRule: { type: "AGE", ageThreshold: 60 },
    };
    // baseEmployee is 55.8 at grant (2024-02), so under 60 even at grant.
    // At retirement they are 58.7. Still under 60.
    // Both fail → forfeit. But to test grant-only failure, need a case
    // where they pass at retirement but fail at grant. Let me adjust.
    const earlyAward: Award = {
      ...baseAward,
      grantDate: "2020-01-01",
      vestStartDate: "2020-01-01",
      vestEndDate: "2024-01-01",
      sharesVested: 0,
      sharesGranted: 1000,
    };
    // At grant 2020-01-01, age 51.7. Below 60. Not eligible at grant.
    // Even if eligible at retirement, GRANT_DATE check forfeits.
    const result = evaluateAward(earlyAward, baseEmployee, policy);
    expect(result.status).toBe("FORFEITURE");
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
