/**
 * CSV import for the Grant Distribution Auditor. Reuses the
 * RFC 4180-ish primitive in csvImport.ts and adds a header mapper that
 * understands the columns a TR practitioner would already have in
 * their grants outstanding worksheet.
 *
 * Demographic columns are auto-detected: any header prefixed with
 * "Demographic:" or "Demo:" (case-insensitive) becomes a demographic
 * dimension whose name is the rest of the header. This lets a
 * practitioner add Gender, Ethnicity Group, Generation, Tenure Band,
 * etc. without the tool taking a position on which dimensions are
 * appropriate to audit.
 *
 * Demographic data is sensitive. The tool is client-side only and
 * never uploads anything; the import banner reminds the user.
 */

import { parseCsvText } from "./csvImport";
import type { AwardType, GrantRow } from "./grantDistribution";

export type GrantImportResult = {
  rows: GrantRow[];
  errors: string[];
  unmappedHeaders: string[];
  rowCount: number;
};

type Field = Exclude<keyof GrantRow, "demographics">;

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
  performanceTier: [
    "performance tier",
    "perf tier",
    "performance",
    "perf rating",
    "performance rating",
    "rating",
    "calibration",
  ],
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
  shares: [
    "shares",
    "shares granted",
    "granted shares",
    "quantity",
    "qty",
    "qty granted",
  ],
  fmvAtGrant: [
    "fmv at grant",
    "grant date fmv",
    "grant date fair market value",
    "grant fmv",
    "grant price",
  ],
  currentFmv: [
    "current fmv",
    "current fair market value",
    "fmv",
    "fair market value",
    "share price",
    "price per share",
    "price",
  ],
  currentValue: [
    "current value",
    "current grant value",
    "current equity value",
    "value",
    "grant value",
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

const AWARD_TYPE_VARIANTS: Record<AwardType, string[]> = {
  ISO: ["iso", "incentive stock option", "incentive option"],
  NSO: ["nso", "nq", "nqso", "non-qualified stock option", "non qualified", "nonstatutory"],
  RSU: ["rsu", "restricted stock unit"],
  PSU: ["psu", "performance stock unit", "performance share unit", "performance share"],
  RSA: ["rsa", "restricted stock award", "restricted stock"],
  SAR: ["sar", "stock appreciation right"],
  OTHER: ["other"],
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
    upper === "ISO" ||
    upper === "NSO" ||
    upper === "RSU" ||
    upper === "PSU" ||
    upper === "RSA" ||
    upper === "SAR" ||
    upper === "OTHER"
  ) {
    return upper as AwardType;
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

const DEMO_PREFIX = /^demographic:\s*|^demo:\s*/i;

type Mapping = {
  index: Partial<Record<Field, number>>;
  demographicCols: Array<{ name: string; columnIndex: number }>;
  unmapped: string[];
};

function mapHeaders(headerRow: string[]): Mapping {
  const index: Partial<Record<Field, number>> = {};
  const demographicCols: Mapping["demographicCols"] = [];
  const unmapped: string[] = [];
  headerRow.forEach((raw, i) => {
    if (!raw) return;
    const norm = normalizeHeader(raw);
    if (!norm) return;
    // Demographic columns have a prefix.
    if (DEMO_PREFIX.test(raw.trim())) {
      const name = raw.trim().replace(DEMO_PREFIX, "").trim();
      if (name) demographicCols.push({ name, columnIndex: i });
      return;
    }
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
  return { index, demographicCols, unmapped };
}

function rowToGrant(
  row: string[],
  mapping: Mapping,
  rowNumber: number,
): { row?: GrantRow; error?: string } {
  const get = (field: Field): string | undefined => {
    const i = mapping.index[field];
    if (i === undefined) return undefined;
    return row[i];
  };
  const level = (get("level") ?? "").trim();
  const employeeId = (get("employeeId") ?? "").trim() || undefined;
  const employeeName = (get("employeeName") ?? "").trim() || undefined;
  const grantId = (get("grantId") ?? "").trim() || undefined;
  if (!level && !employeeId && !employeeName && !grantId) {
    return {
      error: `Row ${rowNumber}: row has no employee id, name, level, or grant id — skipped.`,
    };
  }
  const id = employeeId || grantId || employeeName || `row-${rowNumber}`;
  const demographics: Record<string, string> = {};
  for (const dim of mapping.demographicCols) {
    const v = (row[dim.columnIndex] ?? "").trim();
    if (v) demographics[dim.name] = v;
  }
  return {
    row: {
      rowId: `${rowNumber}-${id}`,
      employeeId,
      employeeName,
      level,
      function: (get("function") ?? "").trim() || undefined,
      country: (get("country") ?? "").trim() || undefined,
      performanceTier: (get("performanceTier") ?? "").trim() || undefined,
      grantId,
      awardType: normalizeAwardType(get("awardType")),
      grantDate: coerceDate(get("grantDate")),
      shares: coerceNumber(get("shares")) ?? 0,
      fmvAtGrant: coerceNumber(get("fmvAtGrant")),
      currentFmv: coerceNumber(get("currentFmv")),
      currentValue: coerceNumber(get("currentValue")),
      vestingPattern: (get("vestingPattern") ?? "").trim() || undefined,
      notes: (get("notes") ?? "").trim() || undefined,
      demographics: Object.keys(demographics).length > 0 ? demographics : undefined,
    },
  };
}

export function importGrantDistributionCsv(text: string): GrantImportResult {
  const rows = parseCsvText(text);
  if (rows.length === 0) {
    return { rows: [], errors: ["File is empty."], unmappedHeaders: [], rowCount: 0 };
  }
  const [headerRow, ...dataRows] = rows;
  const mapping = mapHeaders(headerRow);

  // Required: at minimum a level OR a grant id to anchor the row. We
  // surface the missing-level case as a per-row exception, not as a
  // hard error, so the import path can still ingest a partial file.
  if (mapping.index.level === undefined && mapping.index.grantId === undefined) {
    return {
      rows: [],
      errors: [
        "Missing required column: level (or grant id). Recognized variants for level: Level, Job Level, Job Band, Band, Grade, Career Level. For grant id: Grant ID, Award ID, Grant Number.",
      ],
      unmappedHeaders: mapping.unmapped,
      rowCount: 0,
    };
  }

  const out: GrantRow[] = [];
  const errors: string[] = [];
  dataRows.forEach((row, idx) => {
    if (row.every((c) => c.trim() === "")) return;
    const { row: parsed, error } = rowToGrant(row, mapping, idx + 2);
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

export const GRANT_DISTRIBUTION_CSV_TEMPLATE = `Employee ID,Employee Name,Level,Function,Country,Performance Tier,Grant ID,Award Type,Grant Date,Shares,FMV at Grant,Current FMV,Vesting Pattern,Demographic: Gender,Demographic: Ethnicity Group,Demographic: Generation,Notes
E0001,Sample Employee A,L5,Engineering,US,Top,G-1001,RSU,2025-02-15,2000,50,55,4yr 25/25/25/25,Women,Asian,Millennial,
E0002,Sample Employee B,L6,Engineering,US,High,G-1002,RSU,2025-02-15,4000,50,55,4yr 25/25/25/25,Men,White,Gen X,
E0003,Sample Employee C,L4,Sales,DE,Meets,G-1003,PSU,2024-02-15,800,40,55,3yr 33/33/34,Women,Black,Millennial,
E0004,Sample Employee D,L7,Engineering,US,Top,G-1004,ISO,2022-05-01,8000,30,55,4yr 1cliff/equal,Men,Hispanic/Latino,Gen X,Founder grant
`;
