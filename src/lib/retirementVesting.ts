/**
 * Retirement vesting rules engine. Pure functions only — no React, no
 * I/O, no AI. Given an employee, a retirement policy, and a list of
 * outstanding awards, returns deterministic per-award results
 * (status, shares vesting, shares forfeited, reason) and a summary.
 *
 * The engine is intentionally conservative:
 * - It NEVER guesses at award treatment. Where data is insufficient
 *   (missing vest end date for an award that isn't fully vested,
 *   retirement date before grant date, etc.), it returns NEEDS_REVIEW
 *   with a specific exception message rather than fabricating an
 *   answer.
 * - It NEVER claims to be a substitute for the company's plan
 *   document, award agreement, or legal review. It surfaces what the
 *   stated policy implies for each award; the deliverable is a memo
 *   the practitioner takes to legal and payroll.
 * - It does NOT use AI to compute outcomes. Optional plain-English
 *   memo language is a separate template-fill function.
 *
 * References:
 * - "Retirement vesting" / "qualified retirement" / "rule of X" are
 *   common but plan-specific. Real-world plans vary by award type
 *   (often RSU/PSU treatment differs from option treatment), by
 *   eligibility timing (must be eligible at grant vs at retirement),
 *   and by pro-rata method.
 */

// ───────── Types ─────────

export type AwardType = "ISO" | "NSO" | "RSU" | "PSU" | "RSA" | "OTHER";

export type Award = {
  awardId: string;
  awardType: AwardType;
  /** ISO YYYY-MM-DD */
  grantDate: string;
  /** ISO YYYY-MM-DD */
  vestStartDate: string;
  /** ISO YYYY-MM-DD. Final vest date for the award. */
  vestEndDate?: string;
  /** Total shares granted. */
  sharesGranted: number;
  /** Shares already vested as of today (from the vendor report). */
  sharesVested: number;
  /** Per-share price for valuation. Optional. */
  pricePerShare?: number;
  /** Strike / exercise price for options. Optional. Display-only at this stage. */
  strike?: number;
  /** Optional employee context. Used in the per-award reason text. */
  employeeId?: string;
  employeeName?: string;
};

export type EmployeeContext = {
  /** ISO YYYY-MM-DD */
  birthDate: string;
  /** ISO YYYY-MM-DD */
  hireDate: string;
  /** ISO YYYY-MM-DD */
  retirementDate: string;
  /**
   * Optional global price override. Applied to every award that does
   * not carry its own pricePerShare.
   */
  sharePriceOverride?: number;
};

export type EligibilityRule =
  | { type: "NONE" }
  | { type: "AGE"; ageThreshold: number }
  | { type: "SERVICE"; serviceThreshold: number }
  | {
      type: "AGE_AND_SERVICE";
      ageThreshold: number;
      serviceThreshold: number;
    }
  | {
      type: "AGE_OR_SERVICE";
      ageThreshold: number;
      serviceThreshold: number;
    }
  | {
      /**
       * "Rule of X" — age + service must sum to at least the
       * combinedThreshold. Optional minAge/minService floors are
       * common (e.g., rule of 65 with min age 55).
       */
      type: "AGE_PLUS_SERVICE";
      combinedThreshold: number;
      minAge?: number;
      minService?: number;
    };

export type AwardTreatment =
  | "FULL_VESTING"
  | "PRO_RATA"
  | "CONTINUED_VESTING"
  | "FORFEITURE";

export type ProRataMethod =
  /** months from vest start to retirement / total vest months */
  | "MONTHS_SERVICE"
  /** days from grant to retirement / days from grant to vest end */
  | "DAYS_FROM_GRANT"
  /** sharesVested / sharesGranted (the share-based fraction) */
  | "VEST_FRACTION";

export type EligibilityCheckTiming = "RETIREMENT_DATE" | "GRANT_DATE";

export type RetirementPolicy = {
  eligibilityRule: EligibilityRule;
  eligibilityCheckAt: EligibilityCheckTiming;
  /** Treatment to apply per award type if the employee is eligible. */
  treatments: Record<AwardType, AwardTreatment>;
  proRataMethod: ProRataMethod;
  /**
   * Fallback treatment if the employee is NOT retirement-eligible at
   * the chosen check date. Almost always FORFEITURE, but some plans
   * keep CONTINUED_VESTING for a notice period.
   */
  treatmentIfNotEligible: AwardTreatment;
};

export type AwardStatus =
  | "FULL_VESTING"
  | "PRO_RATA"
  | "CONTINUED_VESTING"
  | "FORFEITURE"
  | "ALREADY_FULLY_VESTED"
  | "NEEDS_REVIEW";

export type AwardResult = {
  awardId: string;
  awardType: AwardType;
  status: AwardStatus;
  /** Shares already vested before retirement. */
  sharesAlreadyVested: number;
  /** Additional shares that vest DUE TO the retirement event. */
  sharesVestingDueToRetirement: number;
  /** Shares forfeited at retirement. */
  sharesForfeited: number;
  /**
   * Shares that continue to vest on the original schedule after
   * retirement (only nonzero when treatment is CONTINUED_VESTING).
   */
  sharesContinuingToVest: number;
  /**
   * Estimated value of sharesAlreadyVested + sharesVestingDueToRetirement
   * at retirement (using award.pricePerShare or
   * employee.sharePriceOverride). Undefined if no price input.
   */
  estimatedValue?: number;
  /** Plain-English reason for the status. */
  reason: string;
  /** Validation/data-quality exceptions. Non-blocking. */
  exceptions: string[];
};

export type EligibilityResult = {
  eligible: boolean;
  /** ISO YYYY-MM-DD when eligibility was evaluated. */
  evaluatedAt: string;
  /** Completed integer years of age at the check date. */
  ageAtCheck: number;
  /** Completed integer years of service at the check date. */
  serviceYearsAtCheck: number;
  reason: string;
  /**
   * True when policy.eligibilityCheckAt === "GRANT_DATE", in which
   * case eligibility is evaluated per award. The fields above describe
   * retirement-date eligibility for context only.
   */
  variesByAward?: boolean;
};

export type Analysis = {
  results: AwardResult[];
  eligibility: EligibilityResult;
  summary: {
    totalSharesGranted: number;
    totalSharesAlreadyVested: number;
    totalSharesVestingDueToRetirement: number;
    totalSharesForfeited: number;
    totalSharesContinuingToVest: number;
    totalEstimatedValue?: number;
    countByStatus: Record<AwardStatus, number>;
    exceptionCount: number;
  };
};

// ───────── Date utilities ─────────

/**
 * Parses an ISO YYYY-MM-DD string at local noon to avoid timezone
 * edges. Returns null if the input is unparseable.
 */
export function parseISODate(s: string | undefined | null): Date | null {
  if (!s || typeof s !== "string") return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Decimal years between two dates. Returns 0 if `to` is before `from`.
 * Uses 365.25 days per year to absorb leap years cleanly.
 *
 * NOTE: Eligibility comparisons MUST NOT use this — they use
 * completedYearsBetween. Decimal years would treat someone the day
 * before their 55th birthday as 54.997 years old, which is correct
 * mathematically but legally that person turns 55 the next day, not
 * today. Plans almost always read "age 55" as the completed year.
 */
export function yearsBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return 0;
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

/**
 * Exact completed years between `from` and `to`. Returns the integer
 * count of full anniversaries reached. The day before the anniversary
 * is N-1; the anniversary itself is N. Returns 0 if `to` <= `from`.
 *
 * Used for retirement eligibility thresholds where age 55 means the
 * 55th birthday has been reached.
 */
export function completedYearsBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  let years = to.getFullYear() - from.getFullYear();
  const monthDiff = to.getMonth() - from.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && to.getDate() < from.getDate())
  ) {
    years -= 1;
  }
  return Math.max(0, years);
}

/** Whole-month difference, used for vest-period calculations. */
export function monthsBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  let total = years * 12 + months;
  // Adjust: if the day-of-month in `to` is before `from`, we haven't
  // completed that final month yet.
  if (to.getDate() < from.getDate()) total -= 1;
  return Math.max(0, total);
}

// ───────── Eligibility ─────────

export function checkEligibility(
  employee: EmployeeContext,
  policy: RetirementPolicy,
): EligibilityResult {
  const birth = parseISODate(employee.birthDate);
  const hire = parseISODate(employee.hireDate);
  const retire = parseISODate(employee.retirementDate);
  if (!birth || !hire || !retire) {
    return {
      eligible: false,
      evaluatedAt: employee.retirementDate || "",
      ageAtCheck: 0,
      serviceYearsAtCheck: 0,
      reason:
        "Could not evaluate eligibility: birth date, hire date, or retirement date is missing or unparseable.",
    };
  }
  // We always compute retirement-date eligibility for the summary
  // panel. When the policy checks at GRANT_DATE, the per-award check
  // happens inside evaluateAward and the global result carries
  // variesByAward=true so the UI/memo can frame it correctly.
  const ageAtRetirement = completedYearsBetween(birth, retire);
  const serviceAtRetirement = completedYearsBetween(hire, retire);
  const ruleResult = evaluateRule(
    ageAtRetirement,
    serviceAtRetirement,
    policy.eligibilityRule,
  );
  if (policy.eligibilityCheckAt === "GRANT_DATE") {
    return {
      eligible: ruleResult.eligible,
      evaluatedAt: formatISODate(retire),
      ageAtCheck: ageAtRetirement,
      serviceYearsAtCheck: serviceAtRetirement,
      reason:
        "Eligibility varies by award grant date. See per-award outcomes for the eligibility decision applied to each grant. Age and service shown above are at the retirement date for context only.",
      variesByAward: true,
    };
  }
  return {
    eligible: ruleResult.eligible,
    evaluatedAt: formatISODate(retire),
    ageAtCheck: ageAtRetirement,
    serviceYearsAtCheck: serviceAtRetirement,
    reason: ruleResult.reason,
  };
}

/**
 * Evaluate an eligibility rule against COMPLETED integer years of age
 * and service. Day before an anniversary is N-1; the anniversary is N.
 * Threshold comparisons use these integers (not decimal years), so a
 * "55+" rule fires on the 55th birthday, not the day before it.
 */
function evaluateRule(
  age: number,
  service: number,
  rule: EligibilityRule,
): { eligible: boolean; reason: string } {
  switch (rule.type) {
    case "NONE":
      return {
        eligible: true,
        reason: "Policy has no retirement-eligibility rule. Always eligible.",
      };
    case "AGE": {
      const ok = age >= rule.ageThreshold;
      return {
        eligible: ok,
        reason: ok
          ? `Eligible: age ${age} ≥ ${rule.ageThreshold}.`
          : `Not eligible: age ${age} < ${rule.ageThreshold}.`,
      };
    }
    case "SERVICE": {
      const ok = service >= rule.serviceThreshold;
      return {
        eligible: ok,
        reason: ok
          ? `Eligible: service ${service} yrs ≥ ${rule.serviceThreshold}.`
          : `Not eligible: service ${service} yrs < ${rule.serviceThreshold}.`,
      };
    }
    case "AGE_AND_SERVICE": {
      const ageOk = age >= rule.ageThreshold;
      const serviceOk = service >= rule.serviceThreshold;
      const ok = ageOk && serviceOk;
      return {
        eligible: ok,
        reason: ok
          ? `Eligible: age ${age} ≥ ${rule.ageThreshold} AND service ${service} yrs ≥ ${rule.serviceThreshold}.`
          : `Not eligible: ${
              !ageOk ? `age ${age} < ${rule.ageThreshold}` : ""
            }${!ageOk && !serviceOk ? " and " : ""}${
              !serviceOk
                ? `service ${service} yrs < ${rule.serviceThreshold}`
                : ""
            }.`,
      };
    }
    case "AGE_OR_SERVICE": {
      const ageOk = age >= rule.ageThreshold;
      const serviceOk = service >= rule.serviceThreshold;
      const ok = ageOk || serviceOk;
      return {
        eligible: ok,
        reason: ok
          ? `Eligible: ${
              ageOk ? `age ${age} ≥ ${rule.ageThreshold}` : ""
            }${ageOk && serviceOk ? " or " : ""}${
              serviceOk
                ? `service ${service} yrs ≥ ${rule.serviceThreshold}`
                : ""
            }.`
          : `Not eligible: age ${age} < ${rule.ageThreshold} and service ${service} yrs < ${rule.serviceThreshold}.`,
      };
    }
    case "AGE_PLUS_SERVICE": {
      const sum = age + service;
      const sumOk = sum >= rule.combinedThreshold;
      const minAgeOk = rule.minAge === undefined || age >= rule.minAge;
      const minServiceOk =
        rule.minService === undefined || service >= rule.minService;
      const ok = sumOk && minAgeOk && minServiceOk;
      const parts: string[] = [];
      parts.push(
        `age ${age} + service ${service} = ${sum} ${
          sumOk ? "≥" : "<"
        } ${rule.combinedThreshold}`,
      );
      if (rule.minAge !== undefined) {
        parts.push(`min age ${rule.minAge} ${minAgeOk ? "met" : "not met"}`);
      }
      if (rule.minService !== undefined) {
        parts.push(
          `min service ${rule.minService} ${
            minServiceOk ? "met" : "not met"
          }`,
        );
      }
      return {
        eligible: ok,
        reason: `${ok ? "Eligible" : "Not eligible"}: ${parts.join(", ")}.`,
      };
    }
  }
}

// ───────── Award evaluation ─────────

/**
 * Compute estimated value for a count of shares of a given award.
 *
 * - RSU/PSU/RSA/OTHER: shares * sharePrice (no strike concept).
 * - ISO/NSO: max(0, sharePrice - strike) * shares (intrinsic value).
 *   If strike is missing, returns undefined and pushes a NEEDS_REVIEW
 *   exception — we never multiply price * shares for an option, since
 *   that would massively overstate value.
 * - Returns undefined if no price input.
 *
 * The exceptions array is mutated in place to carry the strike-missing
 * flag back to the caller. Duplicate flags are deduped.
 */
function computeAwardValue(
  award: Award,
  shares: number,
  price: number | undefined,
  exceptions: string[],
): number | undefined {
  if (price === undefined) return undefined;
  if (shares <= 0) return 0;
  if (award.awardType === "ISO" || award.awardType === "NSO") {
    if (award.strike === undefined) {
      const msg = `Strike price is missing for ${award.awardType} award; estimated value omitted (intrinsic value cannot be computed without strike).`;
      if (!exceptions.includes(msg)) exceptions.push(msg);
      return undefined;
    }
    const intrinsic = price - award.strike;
    return Math.max(0, intrinsic) * shares;
  }
  return shares * price;
}

/**
 * Evaluate a single award. The function is conservative: where data
 * is insufficient or inconsistent, it returns NEEDS_REVIEW with a
 * specific exception message.
 */
export function evaluateAward(
  award: Award,
  employee: EmployeeContext,
  policy: RetirementPolicy,
): AwardResult {
  const exceptions: string[] = [];
  const grantDate = parseISODate(award.grantDate);
  const vestStartDate = parseISODate(award.vestStartDate);
  const vestEndDate = parseISODate(award.vestEndDate);
  const retirementDate = parseISODate(employee.retirementDate);

  const sharesGranted = Math.max(0, Math.round(award.sharesGranted));
  const sharesVested = Math.max(0, Math.round(award.sharesVested));
  const sharesUnvested = Math.max(0, sharesGranted - sharesVested);
  const price = award.pricePerShare ?? employee.sharePriceOverride;

  // Validation exceptions.
  if (!grantDate) exceptions.push("Grant date is missing or unparseable.");
  if (!vestStartDate)
    exceptions.push("Vest start date is missing or unparseable.");
  if (!retirementDate)
    exceptions.push("Retirement date is missing or unparseable.");
  if (sharesGranted === 0)
    exceptions.push("Shares granted is zero.");
  if (sharesVested > sharesGranted)
    exceptions.push("Shares vested exceeds shares granted.");
  if (
    grantDate &&
    retirementDate &&
    retirementDate.getTime() < grantDate.getTime()
  ) {
    exceptions.push("Retirement date is before grant date.");
  }

  const baseResult = (status: AwardStatus, reason: string): AwardResult => ({
    awardId: award.awardId,
    awardType: award.awardType,
    status,
    sharesAlreadyVested: sharesVested,
    sharesVestingDueToRetirement: 0,
    sharesForfeited: 0,
    sharesContinuingToVest: 0,
    estimatedValue: computeAwardValue(award, sharesVested, price, exceptions),
    reason,
    exceptions,
  });

  // Hard fails that mean we cannot evaluate.
  if (
    !grantDate ||
    !vestStartDate ||
    !retirementDate ||
    sharesGranted === 0 ||
    sharesVested > sharesGranted ||
    retirementDate.getTime() < grantDate.getTime()
  ) {
    return baseResult(
      "NEEDS_REVIEW",
      "Insufficient or inconsistent data. See exceptions for the specific issue. The diagnostic does not guess; bring this award to legal/payroll for manual review.",
    );
  }

  // Already 100% vested before retirement — nothing to do.
  if (sharesUnvested === 0) {
    return baseResult(
      "ALREADY_FULLY_VESTED",
      `Award is fully vested as of the data snapshot (${sharesVested.toLocaleString()} shares). Retirement does not change its status.`,
    );
  }

  // Determine eligibility for THIS award based on policy timing.
  const eligibilityCheckDate =
    policy.eligibilityCheckAt === "GRANT_DATE" ? grantDate : retirementDate;
  const birth = parseISODate(employee.birthDate);
  const hire = parseISODate(employee.hireDate);
  if (!birth || !hire) {
    return baseResult(
      "NEEDS_REVIEW",
      "Employee birth date or hire date is missing or unparseable.",
    );
  }
  const ageAt = completedYearsBetween(birth, eligibilityCheckDate);
  const serviceAt = completedYearsBetween(hire, eligibilityCheckDate);
  const elig = evaluateRule(ageAt, serviceAt, policy.eligibilityRule);
  const eligPrefix =
    policy.eligibilityCheckAt === "GRANT_DATE"
      ? `At grant date ${award.grantDate}: ${elig.reason}`
      : elig.reason;

  const treatment = elig.eligible
    ? policy.treatments[award.awardType]
    : policy.treatmentIfNotEligible;

  switch (treatment) {
    case "FULL_VESTING":
      return {
        ...baseResult(
          "FULL_VESTING",
          `${eligPrefix} Policy treats ${award.awardType} as full vesting at retirement; ${sharesUnvested.toLocaleString()} unvested shares vest on ${employee.retirementDate}.`,
        ),
        sharesVestingDueToRetirement: sharesUnvested,
        sharesForfeited: 0,
        sharesContinuingToVest: 0,
        estimatedValue: computeAwardValue(
          award,
          sharesVested + sharesUnvested,
          price,
          exceptions,
        ),
      };

    case "FORFEITURE":
      return {
        ...baseResult(
          "FORFEITURE",
          `${eligPrefix} Policy forfeits unvested ${award.awardType} at retirement; ${sharesUnvested.toLocaleString()} shares forfeited.`,
        ),
        sharesVestingDueToRetirement: 0,
        sharesForfeited: sharesUnvested,
        sharesContinuingToVest: 0,
      };

    case "CONTINUED_VESTING":
      return {
        ...baseResult(
          "CONTINUED_VESTING",
          `${eligPrefix} Policy continues original vesting schedule for ${award.awardType} after retirement; ${sharesUnvested.toLocaleString()} shares continue to vest per the original schedule.`,
        ),
        sharesVestingDueToRetirement: 0,
        sharesForfeited: 0,
        sharesContinuingToVest: sharesUnvested,
        // Continued-vesting shares are not yet "value" at retirement, so
        // estimatedValue stays at the already-vested intrinsic value.
      };

    case "PRO_RATA": {
      const proRata = computeProRataFraction(
        award,
        employee,
        policy.proRataMethod,
        grantDate,
        vestStartDate,
        vestEndDate,
        retirementDate,
      );
      if (proRata.exception) {
        exceptions.push(proRata.exception);
        return baseResult(
          "NEEDS_REVIEW",
          `${eligPrefix} Pro-rata calculation could not be completed: ${proRata.exception}`,
        );
      }
      // Plans almost always honor at-least-already-vested. Cap at total
      // shares, floor at sharesVested.
      const proRataShares = Math.round(sharesGranted * proRata.fraction);
      const effectivelyVested = Math.min(
        sharesGranted,
        Math.max(sharesVested, proRataShares),
      );
      const additionalVesting = effectivelyVested - sharesVested;
      const forfeited = sharesGranted - effectivelyVested;
      return {
        ...baseResult(
          "PRO_RATA",
          `${eligPrefix} Pro-rata vesting (${(proRata.fraction * 100).toFixed(1)}% by ${proRataMethodLabel(policy.proRataMethod)}): ${additionalVesting.toLocaleString()} additional shares vest, ${forfeited.toLocaleString()} forfeit. Method honors at-least-already-vested, so a higher already-vested figure is preserved.`,
        ),
        sharesVestingDueToRetirement: additionalVesting,
        sharesForfeited: forfeited,
        sharesContinuingToVest: 0,
        estimatedValue: computeAwardValue(
          award,
          effectivelyVested,
          price,
          exceptions,
        ),
      };
    }
  }
}

function computeProRataFraction(
  award: Award,
  employee: EmployeeContext,
  method: ProRataMethod,
  grantDate: Date,
  vestStartDate: Date,
  vestEndDate: Date | null,
  retirementDate: Date,
): { fraction: number; exception?: string } {
  switch (method) {
    case "MONTHS_SERVICE": {
      if (!vestEndDate) {
        return {
          fraction: 0,
          exception:
            "Pro-rata by months requires a vest end date. The data does not include one for this award.",
        };
      }
      const monthsServed = monthsBetween(vestStartDate, retirementDate);
      const totalMonths = monthsBetween(vestStartDate, vestEndDate);
      if (totalMonths === 0) {
        return {
          fraction: 1,
          exception: undefined,
        };
      }
      return {
        fraction: Math.max(0, Math.min(1, monthsServed / totalMonths)),
      };
    }
    case "DAYS_FROM_GRANT": {
      if (!vestEndDate) {
        return {
          fraction: 0,
          exception:
            "Pro-rata by days from grant requires a vest end date. The data does not include one for this award.",
        };
      }
      const totalDays =
        (vestEndDate.getTime() - grantDate.getTime()) /
        (1000 * 60 * 60 * 24);
      const daysFromGrant =
        (retirementDate.getTime() - grantDate.getTime()) /
        (1000 * 60 * 60 * 24);
      if (totalDays <= 0) {
        return { fraction: 1 };
      }
      return {
        fraction: Math.max(0, Math.min(1, daysFromGrant / totalDays)),
      };
    }
    case "VEST_FRACTION": {
      const sharesGranted = Math.max(0, award.sharesGranted);
      if (sharesGranted === 0) return { fraction: 0 };
      // VEST_FRACTION uses the actually-vested share count as the
      // fraction. Bounded 0..1 even if the input data is inconsistent.
      const fraction = Math.max(
        0,
        Math.min(1, award.sharesVested / sharesGranted),
      );
      return { fraction };
    }
  }
  // Suppress unreachable-but-typescript-doesn't-know warnings.
  return { fraction: 0, exception: "Unknown pro-rata method." };
}

function proRataMethodLabel(method: ProRataMethod): string {
  switch (method) {
    case "MONTHS_SERVICE":
      return "months served / total vest months";
    case "DAYS_FROM_GRANT":
      return "days from grant / total vest period";
    case "VEST_FRACTION":
      return "shares vested / shares granted";
  }
}

// ───────── Top-level analysis ─────────

export function analyzeAwards(
  awards: Award[],
  employee: EmployeeContext,
  policy: RetirementPolicy,
): Analysis {
  const eligibility = checkEligibility(employee, policy);
  const results = awards.map((a) => evaluateAward(a, employee, policy));
  const summary = summarize(results);
  return { results, eligibility, summary };
}

function summarize(results: AwardResult[]): Analysis["summary"] {
  const countByStatus: Record<AwardStatus, number> = {
    FULL_VESTING: 0,
    PRO_RATA: 0,
    CONTINUED_VESTING: 0,
    FORFEITURE: 0,
    ALREADY_FULLY_VESTED: 0,
    NEEDS_REVIEW: 0,
  };
  let totalSharesGranted = 0;
  let totalSharesAlreadyVested = 0;
  let totalSharesVestingDueToRetirement = 0;
  let totalSharesForfeited = 0;
  let totalSharesContinuingToVest = 0;
  let totalEstimatedValue = 0;
  let anyValue = false;
  let exceptionCount = 0;
  results.forEach((r) => {
    countByStatus[r.status] = (countByStatus[r.status] ?? 0) + 1;
    totalSharesAlreadyVested += r.sharesAlreadyVested;
    totalSharesVestingDueToRetirement += r.sharesVestingDueToRetirement;
    totalSharesForfeited += r.sharesForfeited;
    totalSharesContinuingToVest += r.sharesContinuingToVest;
    totalSharesGranted +=
      r.sharesAlreadyVested +
      r.sharesVestingDueToRetirement +
      r.sharesForfeited +
      r.sharesContinuingToVest;
    if (r.estimatedValue !== undefined) {
      totalEstimatedValue += r.estimatedValue;
      anyValue = true;
    }
    exceptionCount += r.exceptions.length;
  });
  return {
    totalSharesGranted,
    totalSharesAlreadyVested,
    totalSharesVestingDueToRetirement,
    totalSharesForfeited,
    totalSharesContinuingToVest,
    totalEstimatedValue: anyValue ? totalEstimatedValue : undefined,
    countByStatus,
    exceptionCount,
  };
}

// ───────── Memo composition ─────────

/**
 * Generates a plain-text memo from the analysis result. Pure
 * deterministic templating, no AI involved. The user copies this
 * into the equity / legal / payroll review thread.
 */
export function composeRetirementMemo(
  analysis: Analysis,
  employee: EmployeeContext,
  policy: RetirementPolicy,
): string {
  const lines: string[] = [];
  const employeeLabel = "the employee";
  lines.push(`# Retirement vesting impact — ${employeeLabel}`);
  lines.push("");
  lines.push(
    `Educational diagnostic prepared from typed inputs. Not legal, tax, or financial advice. The company's plan document, the award agreements, and legal counsel control. Bring this memo to equity, legal, and payroll for review before relying on it.`,
  );
  lines.push("");

  lines.push("## Inputs");
  lines.push(`- Birth date: ${employee.birthDate}`);
  lines.push(`- Hire date: ${employee.hireDate}`);
  lines.push(`- Proposed retirement date: ${employee.retirementDate}`);
  lines.push(
    `- Eligibility rule: ${describeRule(policy.eligibilityRule)} (checked at ${policy.eligibilityCheckAt === "GRANT_DATE" ? "grant date" : "retirement date"})`,
  );
  lines.push(`- Pro-rata method: ${proRataMethodLabel(policy.proRataMethod)}`);
  lines.push("");

  lines.push("## Eligibility");
  if (analysis.eligibility.variesByAward) {
    lines.push(
      "- Eligibility varies by award grant date. See per-award outcomes below for the eligibility decision applied to each grant.",
    );
    lines.push(
      `- Age at retirement date (context only): ${analysis.eligibility.ageAtCheck} yrs`,
    );
    lines.push(
      `- Service at retirement date (context only): ${analysis.eligibility.serviceYearsAtCheck} yrs`,
    );
  } else {
    lines.push(
      `- Evaluated at: ${analysis.eligibility.evaluatedAt}`,
    );
    lines.push(
      `- Age at evaluation: ${analysis.eligibility.ageAtCheck} yrs`,
    );
    lines.push(
      `- Service at evaluation: ${analysis.eligibility.serviceYearsAtCheck} yrs`,
    );
    lines.push(`- Outcome: ${analysis.eligibility.reason}`);
  }
  lines.push("");

  lines.push("## Per-award outcomes");
  if (analysis.results.length === 0) {
    lines.push("- No awards in scope.");
  } else {
    analysis.results.forEach((r) => {
      lines.push(`- **${r.awardId}** (${r.awardType}) — ${labelStatus(r.status)}`);
      lines.push(`  - Already vested: ${r.sharesAlreadyVested.toLocaleString()}`);
      if (r.sharesVestingDueToRetirement > 0) {
        lines.push(
          `  - Additional vesting at retirement: ${r.sharesVestingDueToRetirement.toLocaleString()}`,
        );
      }
      if (r.sharesForfeited > 0) {
        lines.push(`  - Forfeited: ${r.sharesForfeited.toLocaleString()}`);
      }
      if (r.sharesContinuingToVest > 0) {
        lines.push(
          `  - Continues to vest after retirement: ${r.sharesContinuingToVest.toLocaleString()}`,
        );
      }
      if (r.estimatedValue !== undefined) {
        lines.push(
          `  - Estimated value at retirement: ${formatUSD(r.estimatedValue)}`,
        );
      }
      lines.push(`  - Reason: ${r.reason}`);
      if (r.exceptions.length > 0) {
        lines.push(`  - **Exceptions**: ${r.exceptions.join("; ")}`);
      }
    });
  }
  lines.push("");

  lines.push("## Totals");
  lines.push(
    `- Shares already vested: ${analysis.summary.totalSharesAlreadyVested.toLocaleString()}`,
  );
  lines.push(
    `- Additional vesting due to retirement: ${analysis.summary.totalSharesVestingDueToRetirement.toLocaleString()}`,
  );
  lines.push(
    `- Forfeited: ${analysis.summary.totalSharesForfeited.toLocaleString()}`,
  );
  lines.push(
    `- Continuing to vest after retirement: ${analysis.summary.totalSharesContinuingToVest.toLocaleString()}`,
  );
  if (analysis.summary.totalEstimatedValue !== undefined) {
    lines.push(
      `- Estimated total value (vested at retirement): ${formatUSD(analysis.summary.totalEstimatedValue)}`,
    );
  }
  if (analysis.summary.exceptionCount > 0) {
    lines.push(
      `- **Awards needing manual review**: ${analysis.summary.countByStatus.NEEDS_REVIEW} (${analysis.summary.exceptionCount} total exception flags)`,
    );
  }
  lines.push("");

  lines.push("## Disclaimer");
  lines.push(
    "Outputs reflect the policy and inputs typed above. Real-world award treatment is governed by the company's plan document and individual award agreements. Plans frequently include nuances not modeled here (qualifying termination definitions, change-in-control overlays, exception clauses, holding-period requirements). Bring this memo and your award agreements to legal and payroll before any action.",
  );

  return lines.join("\n");
}

function describeRule(rule: EligibilityRule): string {
  switch (rule.type) {
    case "NONE":
      return "no eligibility rule (always eligible)";
    case "AGE":
      return `age ≥ ${rule.ageThreshold}`;
    case "SERVICE":
      return `service ≥ ${rule.serviceThreshold} yrs`;
    case "AGE_AND_SERVICE":
      return `age ≥ ${rule.ageThreshold} AND service ≥ ${rule.serviceThreshold} yrs`;
    case "AGE_OR_SERVICE":
      return `age ≥ ${rule.ageThreshold} OR service ≥ ${rule.serviceThreshold} yrs`;
    case "AGE_PLUS_SERVICE":
      return `age + service ≥ ${rule.combinedThreshold}${
        rule.minAge !== undefined ? ` (min age ${rule.minAge})` : ""
      }${rule.minService !== undefined ? ` (min service ${rule.minService})` : ""}`;
  }
}

function labelStatus(status: AwardStatus): string {
  switch (status) {
    case "FULL_VESTING":
      return "Full vesting";
    case "PRO_RATA":
      return "Pro-rata vesting";
    case "CONTINUED_VESTING":
      return "Continued vesting";
    case "FORFEITURE":
      return "Forfeiture";
    case "ALREADY_FULLY_VESTED":
      return "Already fully vested";
    case "NEEDS_REVIEW":
      return "Needs manual review";
  }
}

// ───────── Helpers ─────────

function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatUSD(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

// ───────── Default policies ─────────

/**
 * Common starter: Rule of 65 with min age 55. RSUs/PSUs full vest,
 * options pro-rata, all forfeit if not eligible.
 */
export function defaultPolicy(): RetirementPolicy {
  return {
    eligibilityRule: {
      type: "AGE_PLUS_SERVICE",
      combinedThreshold: 65,
      minAge: 55,
    },
    eligibilityCheckAt: "RETIREMENT_DATE",
    treatments: {
      ISO: "PRO_RATA",
      NSO: "PRO_RATA",
      RSU: "FULL_VESTING",
      PSU: "PRO_RATA",
      RSA: "FULL_VESTING",
      OTHER: "PRO_RATA",
    },
    proRataMethod: "MONTHS_SERVICE",
    treatmentIfNotEligible: "FORFEITURE",
  };
}
