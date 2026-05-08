/**
 * CSV import for the AMT Scenario Modeler. Reuses parseCsvText.
 * Required column: Strike. Recognized header variants are intentionally
 * forgiving so a vendor export usually maps without renaming columns.
 */

import { parseCsvText } from "./csvImport";
import type { IsoGrantRow } from "./amtScenario";

export type AmtImportResult = {
  rows: IsoGrantRow[];
  errors: string[];
  unmappedHeaders: string[];
  rowCount: number;
};

type Field = keyof IsoGrantRow;

const HEADER_VARIANTS: Partial<Record<Field, string[]>> = {
  grantId: [
    "grant id",
    "grant number",
    "award id",
    "award number",
    "award reference",
    "grant #",
    "award #",
  ],
  grantDate: ["grant date", "award date", "grant dt"],
  sharesExercisable: [
    "shares exercisable",
    "exercisable shares",
    "exercisable",
    "shares vested",
    "vested shares",
    "vested",
  ],
  strike: [
    "strike",
    "strike price",
    "exercise price",
    "grant price",
    "option price",
  ],
  currentFmv: [
    "current fmv",
    "fmv",
    "fair market value",
    "current price",
    "share price",
    "price per share",
  ],
  proposedExerciseShares: [
    "proposed exercise shares",
    "proposed shares",
    "exercise shares",
    "shares to exercise",
    "shares exercising",
  ],
  notes: ["notes", "comments", "comment"],
};

const DATE_PATTERNS = [
  /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // M/D/YYYY
  /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // M-D-YYYY
];

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

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
): { row?: IsoGrantRow; error?: string } {
  const get = (f: Field): string | undefined => {
    const i = index[f];
    if (i === undefined) return undefined;
    return row[i];
  };
  const strikeStr = get("strike");
  if (strikeStr === undefined || strikeStr.trim() === "") {
    return {
      error: `Row ${rowNumber}: missing strike — skipped.`,
    };
  }
  const grantId = (get("grantId") ?? "").trim() || undefined;
  return {
    row: {
      rowId: `${rowNumber}-${grantId ?? "row"}`,
      grantId,
      grantDate: coerceDate(get("grantDate")),
      sharesExercisable: coerceNumber(get("sharesExercisable")) ?? 0,
      strike: coerceNumber(strikeStr) ?? 0,
      currentFmv: coerceNumber(get("currentFmv")) ?? 0,
      proposedExerciseShares: coerceNumber(get("proposedExerciseShares")) ?? 0,
      notes: (get("notes") ?? "").trim() || undefined,
    },
  };
}

export function importAmtCsv(text: string): AmtImportResult {
  const rows = parseCsvText(text);
  if (rows.length === 0) {
    return { rows: [], errors: ["File is empty."], unmappedHeaders: [], rowCount: 0 };
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
  const out: IsoGrantRow[] = [];
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

export const AMT_CSV_TEMPLATE = `Grant ID,Grant Date,Shares Exercisable,Strike,Current FMV,Proposed Exercise Shares,Notes
G-1001,2022-01-15,5000,5,50,5000,Founder ISO; held > 2 years from grant
G-1002,2023-06-01,3000,12,50,1500,Mid-stage ISO
G-1003,2025-02-15,2000,40,50,500,Recent grant; smaller bargain
`;
