/**
 * CSV import for the Refresh Grant Sizing tool. Reuses the
 * RFC 4180-ish primitive in csvImport.ts and adds a header mapper that
 * understands the columns a TR practitioner would already have in
 * their refresh worksheet.
 *
 * Header matching is case-insensitive and tolerates the small spelling
 * variations vendors and HRIS exports tend to produce ("Job Band" vs
 * "Level" vs "Grade", etc.). Mapping is intentionally forgiving on the
 * input side and strict on the output side: every imported row carries
 * a synthetic `rowId` so the UI can edit individual rows after import.
 *
 * Nothing is uploaded. Parsing happens in the user's browser.
 */

import { parseCsvText } from "./csvImport";
import {
  coerceBoolean,
  coercePerformanceTier,
  coerceRetentionRisk,
  type EmployeeRow,
} from "./refreshSizing";

export type RefreshImportResult = {
  rows: EmployeeRow[];
  errors: string[];
  unmappedHeaders: string[];
  rowCount: number;
};

type Field = keyof EmployeeRow;

/**
 * Curated header variants. Lowercased and whitespace-collapsed before
 * matching. First match wins; the canonical schema does not allow
 * duplicate columns mapping to the same field.
 */
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
  country: ["country", "work country", "country code", "location"],
  currentEquityValue: [
    "current equity value",
    "total equity value",
    "current equity $",
    "current value",
    "current grant value",
    "total grant value",
  ],
  unvestedValue: [
    "unvested value",
    "unvested equity value",
    "unvested $",
    "unvested grant value",
    "unvested",
  ],
  lastGrantDate: [
    "last grant date",
    "most recent grant date",
    "latest grant date",
    "last grant",
    "prior grant date",
  ],
  priorRefreshDollars: [
    "prior refresh amount",
    "prior refresh",
    "prior refresh dollars",
    "last refresh amount",
    "last refresh",
    "last refresh $",
    "previous refresh",
  ],
  performanceTier: [
    "performance tier",
    "perf tier",
    "performance",
    "perf rating",
    "performance rating",
    "rating",
    "calibration",
  ],
  retentionRisk: [
    "retention risk",
    "retention",
    "flight risk",
    "risk",
  ],
  criticalRoleFlag: [
    "critical role",
    "critical role flag",
    "critical",
    "key talent",
    "key role",
    "succession critical",
  ],
  proposedRefreshDollars: [
    "proposed refresh dollars",
    "proposed refresh",
    "proposed refresh $",
    "proposed",
    "manager proposed",
    "recommended refresh",
    "recommended",
  ],
  fmvPerShare: [
    "fmv",
    "fmv/share",
    "fmv per share",
    "fair market value",
    "share price",
    "price per share",
    "price",
  ],
  vestingPattern: [
    "vesting pattern",
    "vest pattern",
    "vesting",
    "vest schedule",
    "schedule",
  ],
  notes: ["notes", "manager note", "comments", "comment"],
};

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
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

/**
 * Convert a single CSV row into an EmployeeRow. The row id is built
 * deterministically from the row number and the employee id (or name)
 * when present, so re-importing a CSV produces stable ids.
 */
function rowToEmployee(
  row: string[],
  index: Partial<Record<Field, number>>,
  rowNumber: number,
): { row?: EmployeeRow; error?: string } {
  const get = (field: Field): string | undefined => {
    const i = index[field];
    if (i === undefined) return undefined;
    return row[i];
  };
  const level = (get("level") ?? "").trim();
  const employeeId = (get("employeeId") ?? "").trim() || undefined;
  const employeeName = (get("employeeName") ?? "").trim() || undefined;
  // A row is considered valid if it has any signal at all (an id, a
  // name, or a level). Empty noise rows skip silently upstream.
  if (!level && !employeeId && !employeeName) {
    return {
      error: `Row ${rowNumber}: row has no employee id, name, or level — skipped.`,
    };
  }
  const id = employeeId || employeeName || `row-${rowNumber}`;
  const result: EmployeeRow = {
    rowId: `${rowNumber}-${id}`,
    employeeId,
    employeeName,
    level,
    country: (get("country") ?? "").trim() || undefined,
    currentEquityValue: coerceNumber(get("currentEquityValue")) ?? 0,
    unvestedValue: coerceNumber(get("unvestedValue")) ?? 0,
    lastGrantDate: coerceDate(get("lastGrantDate")),
    priorRefreshDollars: coerceNumber(get("priorRefreshDollars")) ?? 0,
    performanceTier: coercePerformanceTier(get("performanceTier")),
    retentionRisk: coerceRetentionRisk(get("retentionRisk")),
    criticalRoleFlag: coerceBoolean(get("criticalRoleFlag")),
    proposedRefreshDollars: coerceNumber(get("proposedRefreshDollars")),
    fmvPerShare: coerceNumber(get("fmvPerShare")),
    vestingPattern: (get("vestingPattern") ?? "").trim() || undefined,
    notes: (get("notes") ?? "").trim() || undefined,
  };
  return { row: result };
}

export function importRefreshCsv(text: string): RefreshImportResult {
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
  const { index, unmapped } = mapHeaders(headerRow);

  // Required: at minimum a level (we can't look up a guideline without
  // it). Performance tier is also required; defaults to UNKNOWN if
  // missing, which gates downstream guideline resolution. We surface
  // the missing column as an info message rather than blocking.
  const errors: string[] = [];
  const required: Field[] = ["level"];
  const missing = required.filter((f) => index[f] === undefined);
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        `Missing required column: ${missing.join(", ")}. Recognized variants: Level, Job Level, Job Band, Band, Grade, Career Level.`,
      ],
      unmappedHeaders: unmapped,
      rowCount: 0,
    };
  }

  const out: EmployeeRow[] = [];
  dataRows.forEach((row, idx) => {
    if (row.every((c) => c.trim() === "")) return;
    const { row: parsed, error } = rowToEmployee(row, index, idx + 2);
    if (error) errors.push(error);
    if (parsed) out.push(parsed);
  });

  return {
    rows: out,
    errors,
    unmappedHeaders: unmapped,
    rowCount: dataRows.filter((r) => r.some((c) => c.trim() !== "")).length,
  };
}

export const REFRESH_CSV_TEMPLATE = `Employee ID,Employee Name,Level,Country,Current Equity Value,Unvested Value,Last Grant Date,Prior Refresh Amount,Performance Tier,Retention Risk,Critical Role,Proposed Refresh Dollars,FMV/Share,Vesting Pattern,Notes
E0001,Sample Employee A,L5,US,180000,90000,2025-02-15,32000,Top,Medium,No,42000,50,4yr 25/25/25/25,
E0002,Sample Employee B,L6,US,420000,210000,2024-02-15,75000,High,High,Yes,95000,50,4yr 25/25/25/25,Critical SME for migration
E0003,Sample Employee C,L4,US,90000,60000,2023-04-01,18000,Meets,Low,No,,50,4yr 25/25/25/25,
`;
