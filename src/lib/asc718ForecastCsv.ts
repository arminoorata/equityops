/**
 * CSV import for the ASC 718 Expense Forecaster.
 * Required column: Grant Date Fair Value. Recognized header variants
 * are intentionally forgiving so a stock-comp accounting export
 * usually maps without renaming columns.
 */

import { parseCsvText } from "./csvImport";
import type { AwardRow, AwardType, VestingPattern } from "./asc718Forecast";

export type Asc718ImportResult = {
  rows: AwardRow[];
  errors: string[];
  unmappedHeaders: string[];
  rowCount: number;
};

type Field = keyof AwardRow;

const HEADER_VARIANTS: Partial<Record<Field, string[]>> = {
  awardId: [
    "award id",
    "grant id",
    "grant number",
    "award number",
    "award reference",
    "grant #",
    "award #",
  ],
  awardType: [
    "award type",
    "grant type",
    "type",
    "plan type",
    "award category",
  ],
  grantDate: ["grant date", "award date", "grant dt"],
  shares: [
    "shares",
    "shares granted",
    "granted shares",
    "quantity",
    "qty granted",
  ],
  grantDateFairValue: [
    "grant date fair value",
    "grant-date fair value",
    "gdfv",
    "fair value",
    "fair value per share",
    "asc 718 fair value",
    "asc718 fair value",
    "black-scholes fair value",
  ],
  vestingTermYears: [
    "vesting term years",
    "vesting term",
    "service period years",
    "service period",
    "term years",
  ],
  vestingPattern: [
    "vesting pattern",
    "vest pattern",
    "vesting",
    "vest schedule",
    "schedule",
  ],
  forfeitureRateOverride: [
    "forfeiture rate",
    "forfeiture",
    "forfeit rate",
    "forfeit",
  ],
  serviceStart: [
    "service start",
    "service period start",
    "expense start",
  ],
  serviceEnd: [
    "service end",
    "service period end",
    "expense end",
  ],
  performanceProbability: [
    "performance probability",
    "psu probability",
    "probability",
    "performance factor",
  ],
  notes: ["notes", "comments", "comment"],
};

const AWARD_TYPE_VARIANTS: Record<AwardType, string[]> = {
  RSU: ["rsu", "restricted stock unit"],
  PSU: [
    "psu",
    "performance stock unit",
    "performance share unit",
    "performance share",
  ],
  ISO: ["iso", "incentive stock option", "incentive option"],
  NSO: [
    "nso",
    "nq",
    "nqso",
    "non-qualified stock option",
    "non qualified",
    "nonstatutory",
  ],
  SAR: ["sar", "stock appreciation right"],
  RSA: ["rsa", "restricted stock award", "restricted stock"],
  OTHER: ["other"],
};

const VESTING_PATTERN_VARIANTS: Record<VestingPattern, string[]> = {
  STRAIGHT_LINE: ["straight-line", "straight line", "sl"],
  GRADED_4_YEAR_25_25_25_25: [
    "graded 4-year 25/25/25/25",
    "graded 4 year",
    "graded 4yr 25/25/25/25",
    "graded equal 4-year",
    "4yr 25/25/25/25",
    "4-year 25/25/25/25",
  ],
  GRADED_4_YEAR_1_CLIFF_EQUAL: [
    "graded 4-year cliff",
    "4-year 1-yr cliff",
    "4yr 1cliff/equal",
    "4yr 1-yr cliff then equal",
  ],
  GRADED_3_YEAR_33_33_34: [
    "graded 3-year 33/33/34",
    "3-year 33/33/34",
    "3yr 33/33/34",
  ],
  GRADED_5_YEAR_20_EACH: [
    "graded 5-year 20/20/20/20/20",
    "5-year 20/20/20/20/20",
    "5yr 20/20/20/20/20",
  ],
};

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeAwardType(raw: string | undefined): AwardType {
  if (!raw) return "OTHER";
  const n = normalizeHeader(raw);
  for (const [type, variants] of Object.entries(AWARD_TYPE_VARIANTS) as Array<
    [AwardType, string[]]
  >) {
    if (variants.includes(n)) return type;
  }
  const upper = raw.trim().toUpperCase();
  if (
    upper === "RSU" ||
    upper === "PSU" ||
    upper === "ISO" ||
    upper === "NSO" ||
    upper === "SAR" ||
    upper === "RSA" ||
    upper === "OTHER"
  )
    return upper as AwardType;
  return "OTHER";
}

function normalizeVestingPattern(raw: string | undefined): VestingPattern {
  if (!raw) return "STRAIGHT_LINE";
  const n = normalizeHeader(raw);
  for (const [pat, variants] of Object.entries(
    VESTING_PATTERN_VARIANTS,
  ) as Array<[VestingPattern, string[]]>) {
    if (variants.includes(n)) return pat;
  }
  return "STRAIGHT_LINE";
}

const DATE_PATTERNS = [
  /^(\d{4})-(\d{2})-(\d{2})$/,
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
];

function coerceDate(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  for (const pat of DATE_PATTERNS) {
    const m = s.match(pat);
    if (!m) continue;
    let y: number, mo: number, d: number;
    if (pat === DATE_PATTERNS[0]) {
      y = Number(m[1]);
      mo = Number(m[2]);
      d = Number(m[3]);
    } else {
      mo = Number(m[1]);
      d = Number(m[2]);
      y = Number(m[3]);
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return undefined;
}

function coerceNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const s = raw.trim().replace(/[$,\s%]/g, "");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function mapHeaders(headerRow: string[]): {
  index: Partial<Record<Field, number>>;
  unmapped: string[];
} {
  const index: Partial<Record<Field, number>> = {};
  const unmapped: string[] = [];
  headerRow.forEach((raw, i) => {
    if (!raw) return;
    const norm = normalizeHeader(raw);
    if (!norm) return;
    let mapped = false;
    for (const [field, variants] of Object.entries(HEADER_VARIANTS) as Array<
      [Field, string[]]
    >) {
      if (variants.includes(norm) && index[field] === undefined) {
        index[field] = i;
        mapped = true;
        break;
      }
    }
    if (!mapped) unmapped.push(raw);
  });
  return { index, unmapped };
}

function rowToAward(
  row: string[],
  index: Partial<Record<Field, number>>,
  rowNumber: number,
): { row?: AwardRow; error?: string } {
  const get = (f: Field): string | undefined => {
    const i = index[f];
    if (i === undefined) return undefined;
    return row[i];
  };
  const fvStr = get("grantDateFairValue");
  if (fvStr === undefined || fvStr.trim() === "") {
    return {
      error: `Row ${rowNumber}: missing grant-date fair value — skipped.`,
    };
  }
  const awardId = (get("awardId") ?? "").trim() || undefined;
  return {
    row: {
      rowId: `${rowNumber}-${awardId ?? "row"}`,
      awardId,
      awardType: normalizeAwardType(get("awardType")),
      grantDate: coerceDate(get("grantDate")),
      shares: coerceNumber(get("shares")) ?? 0,
      grantDateFairValue: coerceNumber(fvStr) ?? 0,
      vestingTermYears: coerceNumber(get("vestingTermYears")) ?? 4,
      vestingPattern: normalizeVestingPattern(get("vestingPattern")),
      forfeitureRateOverride: coerceNumber(get("forfeitureRateOverride")),
      serviceStart: coerceDate(get("serviceStart")),
      serviceEnd: coerceDate(get("serviceEnd")),
      performanceProbability: coerceNumber(get("performanceProbability")),
      notes: (get("notes") ?? "").trim() || undefined,
    },
  };
}

export function importAsc718Csv(text: string): Asc718ImportResult {
  const rows = parseCsvText(text);
  if (rows.length === 0) {
    return { rows: [], errors: ["File is empty."], unmappedHeaders: [], rowCount: 0 };
  }
  const [headerRow, ...dataRows] = rows;
  const mapping = mapHeaders(headerRow);
  if (mapping.index.grantDateFairValue === undefined) {
    return {
      rows: [],
      errors: [
        "Missing required column: Grant Date Fair Value. Recognized variants: Grant Date Fair Value, GDFV, Fair Value, Fair Value Per Share, ASC 718 Fair Value, Black-Scholes Fair Value.",
      ],
      unmappedHeaders: mapping.unmapped,
      rowCount: 0,
    };
  }
  const out: AwardRow[] = [];
  const errors: string[] = [];
  dataRows.forEach((row, idx) => {
    if (row.every((c) => c.trim() === "")) return;
    const { row: parsed, error } = rowToAward(row, mapping.index, idx + 2);
    if (error) errors.push(error);
    if (parsed) out.push(parsed);
  });
  return {
    rows: out,
    errors,
    unmappedHeaders: mapping.unmapped,
    rowCount: dataRows.filter((r) => r.some((c) => c.trim() !== "")).length,
  };
}

export const ASC_718_CSV_TEMPLATE = `Award ID,Award Type,Grant Date,Shares,Grant Date Fair Value,Vesting Term Years,Vesting Pattern,Forfeiture Rate,Performance Probability,Notes
G-2024-001,RSU,2024-02-15,2000,45,4,Graded 4-year 25/25/25/25,0.05,,
G-2024-002,PSU,2024-02-15,1500,55,3,Graded 3-year 33/33/34,0.08,1.2,Performance probability 1.2x target
G-2025-001,RSU,2025-02-15,1800,50,4,Straight-line,,,
G-2025-010,NSO,2025-02-15,1000,15,4,Graded 4-year 1-yr cliff then equal,,,
`;
