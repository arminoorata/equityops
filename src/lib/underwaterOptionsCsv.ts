/**
 * CSV import for the Underwater Options Analyzer. Reuses the
 * RFC 4180-ish primitive in csvImport.ts.
 *
 * Required columns (per row): Strike. (Award Type defaults to OTHER if
 * absent; that path also collects a per-row exception flag at analysis
 * time.) Recognized header variants are intentionally forgiving so a
 * raw vendor export usually maps without renaming columns.
 */

import { parseCsvText } from "./csvImport";
import type {
  OptionAwardType,
  OptionGrant,
} from "./underwaterOptions";

export type UnderwaterImportResult = {
  rows: OptionGrant[];
  errors: string[];
  unmappedHeaders: string[];
  rowCount: number;
};

type Field = keyof OptionGrant;

const HEADER_VARIANTS: Partial<Record<Field, string[]>> = {
  employeeId: [
    "employee id",
    "emp id",
    "person id",
    "participant id",
    "ee id",
    "worker id",
    "associate id",
  ],
  employeeName: [
    "employee name",
    "name",
    "participant name",
    "ee name",
    "worker name",
  ],
  level: [
    "level",
    "job level",
    "job band",
    "band",
    "grade",
    "career level",
    "career band",
    "level / band",
    "level/band",
    "job grade",
  ],
  function: [
    "function",
    "job function",
    "job family",
    "function group",
    "department",
    "team",
  ],
  country: ["country", "work country", "country code", "location"],
  grantId: [
    "grant id",
    "grant number",
    "award id",
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
  strike: [
    "strike",
    "strike price",
    "exercise price",
    "grant price",
    "option price",
  ],
  sharesGranted: [
    "shares granted",
    "granted shares",
    "shares",
    "quantity",
    "qty granted",
    "granted",
  ],
  sharesVested: [
    "shares vested",
    "vested shares",
    "vested",
    "qty vested",
    "vested quantity",
  ],
  sharesExercised: [
    "shares exercised",
    "exercised shares",
    "exercised",
    "qty exercised",
  ],
  sharesForfeited: [
    "shares forfeited",
    "forfeited shares",
    "forfeited",
    "shares cancelled",
    "cancelled shares",
    "cancelled",
  ],
  sharesOutstanding: [
    "shares outstanding",
    "outstanding shares",
    "outstanding",
    "qty outstanding",
  ],
  fmvOverride: [
    "fmv",
    "fmv per share",
    "fmv override",
    "current fmv",
    "current price",
    "share price",
    "fair market value",
  ],
  expirationDate: [
    "expiration date",
    "expiration",
    "expiry",
    "expiry date",
    "expire date",
    "option expiration",
  ],
  notes: ["notes", "manager note", "comments", "comment"],
};

const AWARD_TYPE_VARIANTS: Record<OptionAwardType, string[]> = {
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
  OTHER: ["other"],
};

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeAwardType(raw: string | undefined): OptionAwardType {
  if (!raw) return "OTHER";
  const n = normalizeHeader(raw);
  for (const [type, variants] of Object.entries(AWARD_TYPE_VARIANTS) as Array<
    [OptionAwardType, string[]]
  >) {
    if (variants.includes(n)) return type;
  }
  const upper = raw.trim().toUpperCase();
  if (upper === "ISO" || upper === "NSO" || upper === "SAR" || upper === "OTHER") {
    return upper as OptionAwardType;
  }
  return "OTHER";
}

const DATE_PATTERNS = [
  /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // M/D/YYYY
  /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // M-D-YYYY
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
  const s = raw.trim().replace(/[$,\s]/g, "");
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

function rowToGrant(
  row: string[],
  index: Partial<Record<Field, number>>,
  rowNumber: number,
): { row?: OptionGrant; error?: string } {
  const get = (field: Field): string | undefined => {
    const i = index[field];
    if (i === undefined) return undefined;
    return row[i];
  };
  const employeeId = (get("employeeId") ?? "").trim() || undefined;
  const employeeName = (get("employeeName") ?? "").trim() || undefined;
  const grantId = (get("grantId") ?? "").trim() || undefined;
  const level = (get("level") ?? "").trim() || undefined;
  if (!employeeId && !grantId && !level && !employeeName) {
    return {
      error: `Row ${rowNumber}: row has no employee id, name, level, or grant id — skipped.`,
    };
  }
  const id = employeeId || grantId || employeeName || `row-${rowNumber}`;
  return {
    row: {
      rowId: `${rowNumber}-${id}`,
      employeeId,
      employeeName,
      level,
      function: (get("function") ?? "").trim() || undefined,
      country: (get("country") ?? "").trim() || undefined,
      grantId,
      awardType: normalizeAwardType(get("awardType")),
      grantDate: coerceDate(get("grantDate")),
      expirationDate: coerceDate(get("expirationDate")),
      strike: coerceNumber(get("strike")) ?? 0,
      sharesGranted: coerceNumber(get("sharesGranted")) ?? 0,
      sharesVested: coerceNumber(get("sharesVested")) ?? 0,
      sharesExercised: coerceNumber(get("sharesExercised")) ?? 0,
      sharesForfeited: coerceNumber(get("sharesForfeited")) ?? 0,
      sharesOutstanding: coerceNumber(get("sharesOutstanding")),
      fmvOverride: coerceNumber(get("fmvOverride")),
      notes: (get("notes") ?? "").trim() || undefined,
    },
  };
}

export function importUnderwaterCsv(text: string): UnderwaterImportResult {
  const rows = parseCsvText(text);
  if (rows.length === 0) {
    return {
      rows: [],
      errors: ["File is empty."],
      unmappedHeaders: [],
      rowCount: 0,
    };
  }
  const [headerRow, ...dataRows] = rows;
  const mapping = mapHeaders(headerRow);

  if (mapping.index.strike === undefined) {
    return {
      rows: [],
      errors: [
        "Missing required column: Strike. Recognized variants: Strike, Strike Price, Exercise Price, Grant Price, Option Price.",
      ],
      unmappedHeaders: mapping.unmapped,
      rowCount: 0,
    };
  }

  const out: OptionGrant[] = [];
  const errors: string[] = [];
  dataRows.forEach((row, idx) => {
    if (row.every((c) => c.trim() === "")) return;
    const { row: parsed, error } = rowToGrant(row, mapping.index, idx + 2);
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

export const UNDERWATER_CSV_TEMPLATE = `Employee ID,Employee Name,Level,Function,Country,Grant ID,Award Type,Grant Date,Expiration Date,Strike,Shares Granted,Shares Vested,Shares Exercised,Shares Forfeited,FMV
E0001,Sample Employee A,L5,Engineering,US,G-1001,ISO,2022-02-15,2032-02-15,80,2000,1500,0,0,50
E0002,Sample Employee B,L6,Engineering,US,G-1002,NSO,2021-02-15,2031-02-15,120,3000,2250,500,0,50
E0003,Sample Employee C,L4,Sales,DE,G-1003,NSO,2024-02-15,2034-02-15,30,1000,250,0,0,50
E0004,Sample Employee D,L7,Engineering,US,G-1004,ISO,2018-05-01,2028-05-01,15,5000,5000,2000,0,50
`;
