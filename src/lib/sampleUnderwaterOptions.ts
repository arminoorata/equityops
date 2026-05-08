import {
  defaultUnderwaterSettings,
  type OptionGrant,
  type UnderwaterSettings,
} from "./underwaterOptions";

/**
 * Sample option population for the Underwater Options Analyzer demo.
 *
 * Designed to surface every status (UNDERWATER across each depth band,
 * IN_THE_MONEY, AT_THE_MONEY, EXPIRED, EXCLUDED) AND every shipped
 * exception (MISSING_STRIKE, MISSING_FMV (covered by setting fmv to 0
 * locally if needed), ZERO_SHARES, NEGATIVE_VALUE, EXPIRED_GRANT).
 *
 * Numbers are tech-style: pre-IPO ISO/NSO grants sized for a F50
 * private with a recent down round. Current FMV $50 against strikes
 * ranging from $5 (founder grant, deep ITM) to $200 (recent peak,
 * severely underwater).
 */
export const SAMPLE_OPTION_GRANTS: OptionGrant[] = [
  // ── Founder-era ISO, deep in the money ──
  g("E1001", "A. Patel",   "L8", "Engineering", "US", "G-0001", "ISO", "2018-05-01", "2028-05-01",   5, 20000, 20000, 5000, 0),
  // ── Pre-IPO ISO, slightly ITM ──
  g("E1002", "B. Nguyen",  "L7", "Engineering", "US", "G-0500", "ISO", "2021-01-15", "2031-01-15",  35,  8000,  6000,    0, 0),
  // ── At-the-money ──
  g("E1003", "C. Romero",  "L6", "Engineering", "US", "G-0700", "NSO", "2022-02-15", "2032-02-15",  50,  4000,  3000,    0, 0),
  // ── Slightly underwater (50 / 52 = 0.96) ──
  g("E1004", "D. Park",    "L6", "Engineering", "US", "G-0801", "NSO", "2023-02-15", "2033-02-15",  52,  3000,  1500,    0, 0),
  // ── Moderately underwater (50 / 65 = 0.77) ──
  g("E1005", "E. Kim",     "L5", "Engineering", "US", "G-0901", "ISO", "2023-08-15", "2033-08-15",  65,  2500,  1250,    0, 0),
  g("E1006", "F. Adeyemi", "L5", "Sales",       "US", "G-0902", "NSO", "2023-08-15", "2033-08-15",  65,  2000,  1000,    0, 0),
  // ── Deeply underwater (50 / 80 = 0.625) ──
  g("E1007", "G. Bauer",   "L7", "Engineering", "US", "G-1001", "ISO", "2022-08-15", "2032-08-15",  80,  6000,  3000,    0, 0),
  g("E1008", "H. Singh",   "L7", "Engineering", "US", "G-1002", "NSO", "2022-08-15", "2032-08-15",  80,  5000,  2500,    0, 0),
  // ── Severely underwater (50 / 200 = 0.25) ──
  g("E1009", "I. Olsen",   "L6", "Engineering", "DK", "G-1101", "NSO", "2024-02-15", "2034-02-15", 200,  2000,   500,    0, 0),
  g("E1010", "J. Müller",  "L6", "Engineering", "DE", "G-1102", "NSO", "2024-02-15", "2034-02-15", 200,  1800,   450,    0, 0),
  g("E1011", "K. Carter",  "L7", "Engineering", "US", "G-1103", "NSO", "2024-02-15", "2034-02-15", 200,  4000,  1000,    0, 0),
  // ── Expired grant ──
  g("E1012", "L. Tanaka",  "L5", "Sales",       "JP", "G-1200", "NSO", "2014-01-15", "2024-01-15",  20,  1000,  1000,  500, 0),
  // ── SAR ──
  g("E1013", "M. Ahmed",   "L6", "Sales",       "AE", "G-1300", "SAR", "2023-08-15", "2033-08-15",  60,  2000,  1000,    0, 0),
  // ── Edge cases ──
  // Missing strike
  { rowId: "s-no-strike",  employeeId: "E2001", employeeName: "Missing-Strike Sample", level: "L5", function: "Engineering", country: "US", grantId: "G-X1", awardType: "ISO", grantDate: "2024-02-15", expirationDate: "2034-02-15", strike: 0, sharesGranted: 1000, sharesVested: 250, sharesExercised: 0, sharesForfeited: 0 },
  // Zero shares
  { rowId: "s-zero",       employeeId: "E2002", employeeName: "Zero-Shares Sample",    level: "L4", function: "Sales",       country: "US", grantId: "G-X2", awardType: "NSO", grantDate: "2024-02-15", expirationDate: "2034-02-15", strike: 50, sharesGranted: 0, sharesVested: 0, sharesExercised: 0, sharesForfeited: 0 },
];

function g(
  employeeId: string,
  employeeName: string,
  level: string,
  fn: string,
  country: string,
  grantId: string,
  awardType: OptionGrant["awardType"],
  grantDate: string,
  expirationDate: string,
  strike: number,
  sharesGranted: number,
  sharesVested: number,
  sharesExercised: number,
  sharesForfeited: number,
): OptionGrant {
  return {
    rowId: `s-${grantId}`,
    employeeId,
    employeeName,
    level,
    function: fn,
    country,
    grantId,
    awardType,
    grantDate,
    expirationDate,
    strike,
    sharesGranted,
    sharesVested,
    sharesExercised,
    sharesForfeited,
  };
}

export function sampleUnderwaterSettings(): UnderwaterSettings {
  return {
    ...defaultUnderwaterSettings(),
    currentFmv: 50,
    asOfDate: "2026-05-08",
    excludeExpired: true,
  };
}
