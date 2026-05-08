import {
  defaultGrantSettings,
  type GrantRow,
  type GrantSettings,
} from "./grantDistribution";

/**
 * Sample grant population for the Grant Distribution Auditor demo.
 *
 * Designed to surface every shipped exception (missing level, missing
 * grant date, missing FMV, zero shares, unusually high value, missing
 * demographic field, stale grant) AND a believable distribution
 * across level, function, country, year, award type, and three
 * sample demographic dimensions (Gender, Ethnicity Group, Generation).
 *
 * Numbers reflect a tech-style F50 mix: heavier RSUs at L5/L6/M5,
 * occasional PSUs for senior leaders, a small ISO/NSO tail from a
 * pre-IPO grant program, and one founder-era ISO that triggers the
 * stale-grant flag plus the cohort outlier flag.
 */
export const SAMPLE_GRANTS: GrantRow[] = [
  // ── Engineering, US, mostly RSUs ──
  row("E1001", "A. Patel",       "L4", "Engineering",      "US", "Top",     "G-1001", "RSU", "2025-02-15", 1200, 50, 55, { Gender: "Women", "Ethnicity Group": "Asian",            Generation: "Millennial" }),
  row("E1002", "B. Nguyen",      "L5", "Engineering",      "US", "High",    "G-1002", "RSU", "2025-02-15", 2400, 50, 55, { Gender: "Women", "Ethnicity Group": "Asian",            Generation: "Millennial" }),
  row("E1003", "C. Romero",      "L5", "Engineering",      "US", "Meets",   "G-1003", "RSU", "2025-02-15", 2200, 50, 55, { Gender: "Men",   "Ethnicity Group": "Hispanic/Latino",   Generation: "Gen X" }),
  row("E1004", "D. Park",        "L6", "Engineering",      "US", "Top",     "G-1004", "RSU", "2024-02-15", 4400, 45, 55, { Gender: "Men",   "Ethnicity Group": "Asian",            Generation: "Gen X" }),
  row("E1005", "E. Kim",         "L6", "Engineering",      "US", "High",    "G-1005", "RSU", "2024-02-15", 4000, 45, 55, { Gender: "Women", "Ethnicity Group": "Asian",            Generation: "Millennial" }),
  row("E1006", "F. Adeyemi",     "L6", "Engineering",      "US", "Meets",   "G-1006", "RSU", "2025-02-15", 3800, 50, 55, { Gender: "Men",   "Ethnicity Group": "Black",            Generation: "Millennial" }),
  row("E1007", "G. Bauer",       "L7", "Engineering",      "US", "Top",     "G-1007", "RSU", "2025-02-15", 8000, 50, 55, { Gender: "Men",   "Ethnicity Group": "White",            Generation: "Gen X" }),
  row("E1008", "H. Singh",       "L7", "Engineering",      "US", "High",    "G-1008", "PSU", "2025-02-15", 5000, 50, 55, { Gender: "Men",   "Ethnicity Group": "Asian",            Generation: "Gen X" }),
  // ── Engineering, EMEA ──
  row("E1009", "I. Olsen",       "L5", "Engineering",      "DK", "Top",     "G-1009", "RSU", "2025-02-15", 2200, 50, 55, { Gender: "Women", "Ethnicity Group": "White",            Generation: "Millennial" }),
  row("E1010", "J. Müller",      "L6", "Engineering",      "DE", "Meets",   "G-1010", "RSU", "2024-02-15", 3600, 45, 55, { Gender: "Men",   "Ethnicity Group": "White",            Generation: "Gen X" }),
  // ── Sales, multiple regions ──
  row("E1011", "K. Carter",      "L4", "Sales",            "US", "Meets",   "G-1011", "RSU", "2025-02-15",  900, 50, 55, { Gender: "Women", "Ethnicity Group": "Black",            Generation: "Millennial" }),
  row("E1012", "L. Tanaka",      "L5", "Sales",            "JP", "High",    "G-1012", "RSU", "2025-02-15", 1800, 50, 55, { Gender: "Women", "Ethnicity Group": "Asian",            Generation: "Gen X" }),
  row("E1013", "M. Ahmed",       "L6", "Sales",            "AE", "Top",     "G-1013", "RSU", "2025-02-15", 4200, 50, 55, { Gender: "Men",   "Ethnicity Group": "Middle Eastern",   Generation: "Millennial" }),
  row("E1014", "N. Owusu",       "L4", "Sales",            "US", "High",    "G-1014", "RSU", "2025-02-15", 1100, 50, 55, { Gender: "Men",   "Ethnicity Group": "Black",            Generation: "Millennial" }),
  // ── G&A: Finance, Legal, People ──
  row("E1015", "O. Larsen",      "L5", "Finance",          "US", "Meets",   "G-1015", "RSU", "2025-02-15", 1900, 50, 55, { Gender: "Women", "Ethnicity Group": "White",            Generation: "Gen X" }),
  row("E1016", "P. Schmidt",     "L6", "Legal",            "US", "High",    "G-1016", "RSU", "2024-02-15", 3400, 45, 55, { Gender: "Men",   "Ethnicity Group": "White",            Generation: "Gen X" }),
  row("E1017", "Q. Reyes",       "L5", "People",           "US", "Top",     "G-1017", "RSU", "2025-02-15", 2100, 50, 55, { Gender: "Women", "Ethnicity Group": "Hispanic/Latino",   Generation: "Millennial" }),
  // ── Manager track ──
  row("E1018", "R. Yamamoto",    "M5", "Engineering",      "US", "Top",     "G-1018", "PSU", "2025-02-15", 5400, 50, 55, { Gender: "Men",   "Ethnicity Group": "Asian",            Generation: "Gen X" }),
  row("E1019", "S. Davies",      "M6", "Engineering",      "US", "High",    "G-1019", "PSU", "2025-02-15", 8500, 50, 55, { Gender: "Women", "Ethnicity Group": "White",            Generation: "Gen X" }),
  row("E1020", "T. Owusu",       "M5", "Sales",            "US", "Meets",   "G-1020", "RSU", "2025-02-15", 4200, 50, 55, { Gender: "Men",   "Ethnicity Group": "Black",            Generation: "Millennial" }),
  // ── A second grant for an existing employee (E1004) — show grouping ──
  row("E1004", "D. Park",        "L6", "Engineering",      "US", "Top",     "G-1004b", "RSU", "2025-02-15", 1000, 50, 55, { Gender: "Men", "Ethnicity Group": "Asian", Generation: "Gen X" }),
  // ── Founder-era ISO grant: stale + cohort outlier ──
  row("E1099", "Z. Founder",     "L7", "Engineering",      "US", "Top",     "G-0001", "ISO", "2018-01-15", 60000, 5, 55, { Gender: "Men",   "Ethnicity Group": "White",            Generation: "Gen X" }),
  // ── Edge cases for exception coverage ──
  // Missing level
  { rowId: "s-missing-level", employeeId: "E2001", employeeName: "Missing-Level Sample", level: "", function: "Engineering", country: "US", performanceTier: "Meets", awardType: "RSU", grantDate: "2025-02-15", shares: 1000, currentFmv: 55 },
  // Missing grant date
  { rowId: "s-missing-date",  employeeId: "E2002", employeeName: "Missing-Date Sample",  level: "L5", function: "Sales", country: "US", performanceTier: "Meets", awardType: "RSU", grantDate: undefined, shares: 1500, currentFmv: 55 },
  // Zero shares
  { rowId: "s-zero-shares",   employeeId: "E2003", employeeName: "Zero-Shares Sample",   level: "L4", function: "Finance", country: "US", performanceTier: "Below", awardType: "RSU", grantDate: "2025-02-15", shares: 0, currentFmv: 55 },
  // Missing demographic field — only if user marks dimension required;
  // covered automatically by E1099 et al. when they happen to be missing
  // dims; here we add a row that's deliberately demographic-blank.
  { rowId: "s-no-demo",       employeeId: "E2004", employeeName: "No-Demographics Sample", level: "L5", function: "People", country: "US", performanceTier: "Meets", awardType: "RSU", grantDate: "2025-02-15", shares: 1700, currentFmv: 55 },
];

function row(
  employeeId: string,
  employeeName: string,
  level: string,
  fn: string,
  country: string,
  perfTier: string,
  grantId: string,
  awardType: GrantRow["awardType"],
  grantDate: string,
  shares: number,
  fmvAtGrant: number,
  currentFmv: number,
  demographics: Record<string, string>,
): GrantRow {
  return {
    rowId: `s-${grantId}`,
    employeeId,
    employeeName,
    level,
    function: fn,
    country,
    performanceTier: perfTier,
    grantId,
    awardType,
    grantDate,
    shares,
    fmvAtGrant,
    currentFmv,
    vestingPattern: "4yr 25/25/25/25",
    demographics,
  };
}

export function sampleGrantSettings(): GrantSettings {
  return {
    ...defaultGrantSettings(),
    defaultFmvPerShare: 55,
    asOfDate: "2026-05-08",
    staleGrantThresholdYears: 5,
    outlierValueMultiple: 3,
    tinyGrantSharesThreshold: 50,
    concentrationTopPct: 0.1,
    requireDemographicDimensions: ["Gender"],
  };
}
