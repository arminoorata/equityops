import { describe, expect, it } from "vitest";
import {
  buildBoardMemo,
  evaluatePlanHealth,
  type PlanHealthInputs,
} from "./planHealth";
import {
  analyzeAwards,
  composeRetirementMemo,
  defaultPolicy,
  type Award,
  type EmployeeContext,
} from "./retirementVesting";
import { generatePlan } from "./eventReadiness";
import {
  analyzeRefresh,
  composeRefreshMemo,
  defaultGuidelines,
  defaultSettings,
  type EmployeeRow,
} from "./refreshSizing";
import {
  analyzeGrantDistribution,
  composeDistributionMemo,
  defaultGrantSettings,
  type GrantRow,
} from "./grantDistribution";
import {
  analyzeUnderwater,
  composeUnderwaterMemo,
  defaultUnderwaterSettings,
  type OptionGrant,
} from "./underwaterOptions";
import {
  computeHireQuote,
  composeOfferMemo,
  defaultHireSettings,
} from "./hireRange";
import {
  analyzeAmt,
  composeAmtMemo,
  defaultAmtAssumptions,
  defaultAmtSettings,
  type IsoGrantRow,
} from "./amtScenario";
import {
  analyzeAsc718,
  composeAsc718Memo,
  defaultAsc718Settings,
  type AwardRow,
} from "./asc718Forecast";
import {
  analyzePlanAmendment,
  composePlanAmendmentMemo,
  defaultAmendmentProposal,
  defaultCurrentPlanState,
} from "./planAmendment";
import { buildCompCommitteeMemo } from "./compCommitteeMemo";

const expectMemoSections = (memo: string, sections: string[]) => {
  for (const section of sections) {
    expect(memo).toContain(section);
  }
};

describe("Fortune 50 practitioner scenario QA", () => {
  it("Stock Plan Health Check flags a public-company plan that needs board discussion", () => {
    const inputs: PlanHealthInputs = {
      companyName: "F50 Software Co",
      companyStage: "public",
      annualGrants: [12_000_000, 9_000_000, 7_000_000],
      weightedAverageSharesOutstanding: [480_000_000, 470_000_000, 460_000_000],
      sharesOutstanding: 500_000_000,
      awardsOutstanding: 48_000_000,
      sharesAvailableForGrant: 22_000_000,
      features: {
        singleTriggerAcceleration: false,
        evergreenReserve: true,
        repricingWithoutShareholderApproval: true,
        shareRecyclingPermitted: true,
        dividendEquivalentsOnUnvested: true,
        liberalChangeInControlDefinition: true,
        discountedStockOptionsPermitted: false,
      },
    };
    const analysis = evaluatePlanHealth(inputs);
    const memo = buildBoardMemo(inputs, analysis);

    expect(analysis.burnRate.trailingYear).toBeCloseTo(0.025, 4);
    expect(analysis.overhang.investorViewPct).toBeGreaterThan(0.13);
    expect(analysis.runway.yearsAtTrailingRate).toBeCloseTo(1.83, 1);
    expect(
      analysis.featureFindings.filter((f) => f.toneFromInvestorView === "concern")
        .length,
    ).toBeGreaterThanOrEqual(3);
    expectMemoSections(memo, [
      "## Headline metrics",
      "## Questions for legal and finance",
      "repricing",
    ]);
  });

  it("Retirement Vesting Forecaster separates full vest, pro-rata, forfeit, and review rows", () => {
    const employee: EmployeeContext = {
      birthDate: "1968-02-01",
      hireDate: "2014-07-01",
      retirementDate: "2026-05-21",
      sharePriceOverride: 85,
    };
    const awards: Award[] = [
      {
        awardId: "RSU-2023",
        awardType: "RSU",
        grantDate: "2023-03-01",
        vestStartDate: "2023-03-01",
        vestEndDate: "2027-03-01",
        sharesGranted: 10_000,
        sharesVested: 7_500,
      },
      {
        awardId: "PSU-2024",
        awardType: "PSU",
        grantDate: "2024-02-15",
        vestStartDate: "2024-02-15",
        vestEndDate: "2027-02-15",
        sharesGranted: 6_000,
        sharesVested: 2_000,
      },
      {
        awardId: "ISO-2025",
        awardType: "ISO",
        grantDate: "2025-03-01",
        vestStartDate: "2025-03-01",
        vestEndDate: "2029-03-01",
        sharesGranted: 4_000,
        sharesVested: 0,
        strike: 30,
      },
      {
        awardId: "BROKEN-ROW",
        awardType: "RSU",
        grantDate: "",
        vestStartDate: "2025-01-01",
        sharesGranted: 1_000,
        sharesVested: 0,
      },
    ];
    const analysis = analyzeAwards(awards, employee, defaultPolicy());
    const memo = composeRetirementMemo(analysis, employee, defaultPolicy());

    expect(analysis.summary.countByStatus.FULL_VESTING).toBe(1);
    expect(analysis.summary.countByStatus.PRO_RATA).toBeGreaterThanOrEqual(2);
    expect(analysis.summary.countByStatus.NEEDS_REVIEW).toBe(1);
    expect(analysis.summary.totalSharesForfeited).toBeGreaterThan(0);
    expect(memo).toContain("legal, and payroll");
  });

  it("Equity Event Readiness Planner creates an IPO double-trigger plan with owners and emails", () => {
    const plan = generatePlan({
      eventType: "DOUBLE_TRIGGER_IPO",
      eventDate: "2026-09-15",
      companyStage: "PUBLIC",
      eventName: "IPO double-trigger RSU release",
      estimatedAffectedEmployees: 7_500,
      estimatedSharesAffected: 18_000_000,
      owners: {
        PAYROLL: "Payroll Ops Lead",
        LEGAL: "Securities Counsel",
        COMMS: "Employee Comms",
      },
    });

    expect(plan.eventDateValid).toBe(true);
    expect(plan.checklist.length).toBeGreaterThanOrEqual(10);
    expect(plan.emails.length).toBeGreaterThanOrEqual(3);
    expect(plan.checklist.some((i) => i.scheduledDate === "2026-09-15")).toBe(
      true,
    );
    expect(plan.memo).toContain("IPO double-trigger RSU release");
  });

  it("Refresh Grant Sizing Tool catches budget pressure and exception-heavy employee rows", () => {
    const rows: EmployeeRow[] = [
      {
        rowId: "e1",
        employeeId: "1001",
        employeeName: "Critical AI Fellow",
        level: "L7",
        country: "US",
        currentEquityValue: 2_500_000,
        unvestedValue: 400_000,
        lastGrantDate: "2023-01-01",
        priorRefreshDollars: 100_000,
        performanceTier: "TOP",
        retentionRisk: "HIGH",
        criticalRoleFlag: true,
        proposedRefreshDollars: 320_000,
      },
      {
        rowId: "e2",
        employeeId: "1002",
        employeeName: "Manager Review",
        level: "L6",
        country: "US",
        currentEquityValue: 900_000,
        unvestedValue: 300_000,
        lastGrantDate: "2020-01-01",
        priorRefreshDollars: 75_000,
        performanceTier: "MEETS",
        retentionRisk: "LOW",
        criticalRoleFlag: false,
        proposedRefreshDollars: 20_000,
      },
      {
        rowId: "e3",
        level: "",
        currentEquityValue: 0,
        unvestedValue: 0,
        priorRefreshDollars: 0,
        performanceTier: "UNKNOWN",
        retentionRisk: "UNKNOWN",
        criticalRoleFlag: false,
      },
    ];
    const settings = {
      ...defaultSettings(),
      asOfDate: "2026-05-08",
      fmvPerShare: 84,
      totalBudget: 250_000,
      shareRoundingIncrement: 10,
    };
    const guidelines = defaultGuidelines();
    const analysis = analyzeRefresh(rows, guidelines, settings);
    const memo = composeRefreshMemo(analysis, guidelines);

    expect(analysis.summary.totalProposedDollars).toBeGreaterThan(300_000);
    expect(analysis.summary.budgetVariance).toBeGreaterThan(0);
    expect(analysis.summary.countByException.RETENTION_OVERRIDE).toBeGreaterThan(0);
    expect(analysis.summary.countByException.MISSING_LEVEL).toBeGreaterThan(0);
    expect(analysis.summary.countByException.STALE_LAST_GRANT).toBeGreaterThan(0);
    expect(memo).toContain("Recommended next steps");
  });

  it("Grant Distribution Auditor surfaces concentration and demographic completeness risk", () => {
    const rows: GrantRow[] = [
      {
        rowId: "g1",
        employeeId: "1",
        level: "L7",
        function: "Engineering",
        country: "US",
        performanceTier: "Top",
        grantId: "G1",
        awardType: "RSU",
        grantDate: "2026-01-15",
        shares: 40_000,
        currentFmv: 80,
        demographics: { Gender: "Women", Region: "NA" },
      },
      {
        rowId: "g2",
        employeeId: "2",
        level: "L5",
        function: "Engineering",
        country: "US",
        performanceTier: "Meets",
        grantId: "G2",
        awardType: "RSU",
        grantDate: "2026-01-15",
        shares: 6_000,
        currentFmv: 80,
        demographics: { Gender: "Men" },
      },
      {
        rowId: "g3",
        employeeId: "3",
        level: "",
        function: "Sales",
        country: "UK",
        grantId: "G3",
        awardType: "PSU",
        grantDate: "2018-01-15",
        shares: 8_000,
        currentFmv: 80,
        demographics: { Gender: "Women", Region: "EMEA" },
      },
    ];
    const analysis = analyzeGrantDistribution(rows, {
      ...defaultGrantSettings(),
      asOfDate: "2026-05-08",
      requireDemographicDimensions: ["Gender", "Region"],
      concentrationTopPct: 0.34,
    });
    const memo = composeDistributionMemo(analysis);

    expect(analysis.concentration.topPctShareOfValue).toBeGreaterThan(0.65);
    expect(analysis.summary.countByException.MISSING_LEVEL).toBeGreaterThan(0);
    expect(
      analysis.summary.countByException.MISSING_DEMOGRAPHIC_FIELD,
    ).toBeGreaterThan(0);
    expect(analysis.summary.countByException.STALE_GRANT).toBeGreaterThan(0);
    expect(memo).toContain("Distribution by demographic dimension");
  });

  it("Underwater Options Analyzer bins depth bands and excludes expired grants", () => {
    const grants: OptionGrant[] = [
      {
        rowId: "u1",
        employeeId: "1",
        level: "L5",
        grantId: "NQ-2021",
        awardType: "NSO",
        grantDate: "2021-01-15",
        strike: 120,
        sharesGranted: 10_000,
        sharesVested: 8_000,
        sharesExercised: 0,
        sharesForfeited: 0,
        expirationDate: "2031-01-15",
      },
      {
        rowId: "u2",
        employeeId: "2",
        level: "L6",
        grantId: "ISO-2022",
        awardType: "ISO",
        grantDate: "2022-02-01",
        strike: 60,
        sharesGranted: 5_000,
        sharesVested: 3_000,
        sharesExercised: 0,
        sharesForfeited: 0,
        expirationDate: "2032-02-01",
      },
      {
        rowId: "u3",
        employeeId: "3",
        level: "L4",
        grantId: "EXP-2014",
        awardType: "NSO",
        grantDate: "2014-01-01",
        strike: 90,
        sharesGranted: 2_000,
        sharesVested: 2_000,
        sharesExercised: 0,
        sharesForfeited: 0,
        expirationDate: "2024-01-01",
      },
    ];
    const analysis = analyzeUnderwater(grants, {
      ...defaultUnderwaterSettings(),
      currentFmv: 50,
      asOfDate: "2026-05-08",
    });
    const memo = composeUnderwaterMemo(analysis);

    expect(analysis.summary.countByStatus.UNDERWATER).toBe(2);
    expect(analysis.summary.countByStatus.EXCLUDED).toBe(1);
    expect(analysis.byDepthBand.filter((b) => b.grantCount > 0).length).toBe(2);
    expect(memo).toContain("does not recommend repricing");
  });

  it("Hire Range Equity Calculator translates a senior hire target into shares and vesting", () => {
    const quote = computeHireQuote(
      {
        candidateName: "VP Product Candidate",
        level: "M7",
        function: "Product",
        country: "US",
        targetEquityValue: 1_250_000,
        fmvPerShare: 84,
        fmvAsOfDate: "2026-05-01",
        vestingPattern: "FOUR_YEAR_1_CLIFF_EQUAL",
        range: { kind: "MULTIPLIER", lowMult: 0.85, highMult: 1.2 },
        shareRoundingIncrement: 50,
      },
      {
        ...defaultHireSettings(),
        asOfDate: "2026-05-08",
        guardrailLowDollars: 900_000,
        guardrailHighDollars: 1_500_000,
      },
    );
    const memo = composeOfferMemo(quote);

    expect(quote.mid.shares).toBeGreaterThan(14_000);
    expect(quote.vestingSchedule).toHaveLength(4);
    expect(quote.exceptions).toHaveLength(0);
    expect(memo).toContain("Recruiter talking points");
  });

  it("AMT Scenario Modeler produces a tax-advisor handoff with current defaults", () => {
    const grants: IsoGrantRow[] = [
      {
        rowId: "a1",
        grantId: "ISO-2021",
        grantDate: "2021-01-15",
        sharesExercisable: 30_000,
        strike: 8,
        currentFmv: 84,
        proposedExerciseShares: 10_000,
      },
      {
        rowId: "a2",
        grantId: "ISO-2024",
        grantDate: "2024-03-01",
        sharesExercisable: 6_000,
        strike: 40,
        currentFmv: 84,
        proposedExerciseShares: 6_000,
      },
    ];
    const analysis = analyzeAmt(
      grants,
      {
        ...defaultAmtAssumptions(),
        ordinaryIncomeEstimate: 700_000,
        effectiveRegularRate: 0.29,
      },
      {
        ...defaultAmtSettings(),
        asOfDate: "2026-05-08",
        fmvAsOfDate: "2026-05-01",
      },
    );
    const memo = composeAmtMemo(analysis);

    expect(analysis.assumptions.amtExemption).toBe(140_200);
    expect(analysis.assumptions.exemptionPhaseoutStart).toBe(1_000_000);
    expect(analysis.computation.amtExposure).toBeGreaterThan(0);
    expect(memo).toContain("qualified tax advisor");
  });

  it("ASC 718 Forecaster handles mixed awards and flags incomplete PSU support data", () => {
    const awards: AwardRow[] = [
      {
        rowId: "sbc1",
        awardId: "RSU-2026",
        awardType: "RSU",
        grantDate: "2026-02-01",
        shares: 100_000,
        grantDateFairValue: 80,
        vestingTermYears: 4,
        vestingPattern: "GRADED_4_YEAR_25_25_25_25",
      },
      {
        rowId: "sbc2",
        awardId: "PSU-2026",
        awardType: "PSU",
        grantDate: "2026-02-01",
        shares: 50_000,
        grantDateFairValue: 90,
        vestingTermYears: 3,
        vestingPattern: "GRADED_3_YEAR_33_33_34",
        performanceProbability: 1.6,
      },
      {
        rowId: "sbc3",
        awardId: "PSU-MISSING",
        awardType: "PSU",
        grantDate: "2026-02-01",
        shares: 10_000,
        grantDateFairValue: 90,
        vestingTermYears: 3,
        vestingPattern: "GRADED_3_YEAR_33_33_34",
      },
    ];
    const analysis = analyzeAsc718(awards, {
      ...defaultAsc718Settings(),
      periodStart: "2026-01-01",
      periodEnd: "2028-12-31",
      reportingFrequency: "QUARTERLY",
      defaultForfeitureRate: 0.06,
    });
    const memo = composeAsc718Memo(analysis);

    expect(analysis.periods).toHaveLength(12);
    expect(analysis.summary.totalExpenseInWindow).toBeGreaterThan(0);
    expect(analysis.summary.countByException.PSU_MISSING_PROBABILITY).toBe(1);
    expect(memo).toContain("external auditor controls");
  });

  it("Plan Amendment Impact Modeler flags investor-sensitive amendments", () => {
    const analysis = analyzePlanAmendment({
      current: {
        ...defaultCurrentPlanState(),
        sharesOutstanding: 500_000_000,
        awardsOutstanding: 55_000_000,
        availableReserve: 12_000_000,
        annualBurnRateShares: 14_000_000,
        forecastYears: 5,
        hiringGrowthMultiplier: 1.15,
      },
      proposal: {
        ...defaultAmendmentProposal(),
        additionalReserveShares: 35_000_000,
        evergreenEnabled: true,
        evergreenPercent: 5,
        repricingAllowed: true,
        repricingRequiresShareholderApproval: false,
        shareRecyclingFullValue: "FULL",
        shareRecyclingOptions: "FORFEIT_ONLY",
      },
    });
    const memo = composePlanAmendmentMemo(analysis);

    expect(analysis.after.additionalDilutionPct).toBeCloseTo(7, 0);
    expect(analysis.exceptions.some((e) => e.type === "HIGH_EVERGREEN")).toBe(
      true,
    );
    expect(
      analysis.exceptions.some((e) => e.type === "REPRICING_WITHOUT_APPROVAL"),
    ).toBe(true);
    expect(memo).toContain("ISS / Glass Lewis");
  });

  it("Comp Committee Memo Builder assembles a decision-ready approval packet", () => {
    const memo = buildCompCommitteeMemo({
      meetingDate: "2026-06-20",
      companyName: "F50 Software Co",
      companyStage: "PUBLIC",
      topic: "PLAN_AMENDMENT",
      title: "2026 equity plan amendment recommendation",
      requestedAction: "APPROVE",
      executiveNote:
        "Management recommends approval of the amended reserve request, subject to legal confirmation of listing-rule and shareholder-approval requirements.",
      pastedSummaries: [
        {
          heading: "Plan amendment model",
          body: "Additional reserve adds 7.0 percentage points of dilution capacity. Repricing without shareholder approval is not recommended.",
        },
      ],
      keyMetrics: [
        { label: "Additional reserve", value: "35.0M shares" },
        { label: "Incremental dilution", value: "7.0%" },
        { label: "Runway after amendment", value: "3.4 years" },
      ],
      risks: [
        {
          label: "Proxy narrative",
          description:
            "Investor-facing rationale must explain burn, hiring growth, and governance guardrails.",
          severity: "HIGH",
        },
      ],
      openQuestions: [
        {
          question:
            "Should repricing remain prohibited absent separate shareholder approval?",
          owner: "Legal",
        },
      ],
      nextSteps: [
        {
          step: "Finalize reserve request and proxy-language handoff.",
          owner: "TR / Legal",
          due: "2026-06-30",
        },
      ],
    });

    expect(memo.exceptions).toHaveLength(0);
    expectMemoSections(memo.markdown, [
      "## 1. Executive summary",
      "## 2. Decision requested",
      "## 3. Key metrics",
      "## 5. Risks and open questions",
      "For approval",
    ]);
  });
});
