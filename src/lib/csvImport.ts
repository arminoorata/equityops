/**
 * Client-side CSV parser for grants-outstanding exports. RFC 4180-ish:
 * handles quoted fields containing commas and newlines, and escaped
 * double-quotes ("").
 *
 * Header mapping is intentionally forgiving — vendors use slightly
 * different column labels for the same concept ("Award ID" / "Grant
 * Number" / "Award Number"). The mapper matches case-insensitive
 * against a curated list of known variants.
 */

import type { Award, AwardType } from "./retirementVesting";

export type ParsedAward = Award;

export type ImportResult = {
  awards: ParsedAward[];
  errors: string[];
  /** Unmapped headers (informational, not a hard error). */
  unmappedHeaders: string[];
  rowCount: number;
};

// ───────── Header mapping ─────────

/**
 * Stock-admin exports often report unvested or unreleased shares
 * instead of shares vested. We capture those columns separately and
 * use them to derive sharesVested when sharesVested is absent:
 *   sharesVested = sharesGranted - unvested
 *
 * NOTE: "Outstanding" headers are intentionally NOT mapped here.
 * Across vendor exports, "outstanding" is ambiguous — for options it
 * commonly means granted-but-not-exercised (which includes vested
 * shares the holder hasn't exercised yet). Using it as "unvested"
 * would silently understate sharesVested for options. Only explicit
 * unvested / unreleased columns are safe to derive from.
 *
 * If a row has both an explicit "shares vested" value and an unvested
 * column, the explicit value wins.
 */
type ExtraField = "sharesUnvested";
const EXTRA_HEADER_VARIANTS: Record<ExtraField, string[]> = {
  sharesUnvested: [
    "shares unvested",
    "unvested shares",
    "unvested",
    "qty unvested",
    "shares unreleased",
    "unreleased shares",
    "unreleased",
  ],
};

const HEADER_VARIANTS: Record<keyof Award, string[]> = {
  awardId: [
    "award id",
    "award number",
    "grant id",
    "grant number",
    "award reference",
    "award #",
    "grant #",
  ],
  awardType: [
    "award type",
    "grant type",
    "type",
    "plan type",
    "award category",
  ],
  grantDate: ["grant date", "award date", "grant dt"],
  vestStartDate: [
    "vest start date",
    "vesting start date",
    "vest start",
    "vesting start",
    "start date",
    "vesting begin date",
  ],
  vestEndDate: [
    "vest end date",
    "vesting end date",
    "vest end",
    "vesting end",
    "final vest date",
    "end date",
    "fully vested date",
  ],
  sharesGranted: [
    "shares granted",
    "granted shares",
    "total shares",
    "quantity",
    "shares",
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
  pricePerShare: ["price", "price per share", "fair market value", "fmv"],
  strike: [
    "strike",
    "strike price",
    "exercise price",
    "grant price",
    "option price",
  ],
  employeeId: [
    "employee id",
    "person id",
    "participant id",
    "emp id",
    "ee id",
  ],
  employeeName: [
    "employee name",
    "participant name",
    "name",
    "employee",
    "ee name",
  ],
};

const AWARD_TYPE_VARIANTS: Record<AwardType, string[]> = {
  ISO: ["iso", "incentive stock option", "incentive option"],
  NSO: ["nso", "nq", "nqso", "non-qualified stock option", "non qualified", "nonstatutory"],
  RSU: ["rsu", "restricted stock unit"],
  PSU: ["psu", "performance stock unit", "performance share unit", "performance share"],
  RSA: ["rsa", "restricted stock award", "restricted stock"],
  OTHER: ["other", "sar", "stock appreciation right"],
};

// ───────── CSV parsing (RFC 4180-ish) ─────────

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const src = text.replace(/^﻿/, ""); // strip BOM if present
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // swallow; CRLF handled by \n branch
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Flush last field/row if anything pending.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop trailing empty rows (e.g., trailing newline at EOF).
  while (
    rows.length > 0 &&
    rows[rows.length - 1].every((c) => c.trim() === "")
  ) {
    rows.pop();
  }
  return rows;
}

// ───────── Header normalization ─────────

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapHeaders(headerRow: string[]): {
  index: Partial<Record<keyof Award, number>>;
  extraIndex: Partial<Record<ExtraField, number>>;
  unmapped: string[];
} {
  const index: Partial<Record<keyof Award, number>> = {};
  const extraIndex: Partial<Record<ExtraField, number>> = {};
  const unmapped: string[] = [];
  headerRow.forEach((raw, i) => {
    const norm = normalizeHeader(raw);
    if (!norm) return;
    let mapped = false;
    for (const [field, variants] of Object.entries(HEADER_VARIANTS) as Array<
      [keyof Award, string[]]
    >) {
      if (variants.includes(norm)) {
        // First match wins; the canonical schema does not allow
        // duplicate columns mapping to the same field.
        if (index[field] === undefined) {
          index[field] = i;
          mapped = true;
        }
        break;
      }
    }
    if (mapped) return;
    for (const [field, variants] of Object.entries(EXTRA_HEADER_VARIANTS) as Array<
      [ExtraField, string[]]
    >) {
      if (variants.includes(norm)) {
        if (extraIndex[field] === undefined) {
          extraIndex[field] = i;
          mapped = true;
        }
        break;
      }
    }
    if (!mapped) unmapped.push(raw);
  });
  return { index, extraIndex, unmapped };
}

function normalizeAwardType(raw: string): AwardType | null {
  const n = normalizeHeader(raw);
  for (const [type, variants] of Object.entries(AWARD_TYPE_VARIANTS) as Array<
    [AwardType, string[]]
  >) {
    if (variants.includes(n)) return type;
  }
  // Direct match on the canonical labels in case the header is exact.
  const upper = raw.trim().toUpperCase();
  if (
    upper === "ISO" ||
    upper === "NSO" ||
    upper === "RSU" ||
    upper === "PSU" ||
    upper === "RSA" ||
    upper === "OTHER"
  ) {
    return upper as AwardType;
  }
  return null;
}

// ───────── Date and number coercion ─────────

const DATE_PATTERNS = [
  /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // M/D/YYYY or MM/DD/YYYY
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
    const moStr = String(mo).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    return `${y}-${moStr}-${dStr}`;
  }
  return undefined;
}

function coerceNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const s = raw.trim().replace(/[$,]/g, "");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

// ───────── Row → Award ─────────

function rowToAward(
  row: string[],
  index: Partial<Record<keyof Award, number>>,
  extraIndex: Partial<Record<ExtraField, number>>,
  rowNumber: number,
): { award?: ParsedAward; error?: string } {
  const get = (field: keyof Award): string | undefined => {
    const i = index[field];
    if (i === undefined) return undefined;
    return row[i];
  };
  const getExtra = (field: ExtraField): string | undefined => {
    const i = extraIndex[field];
    if (i === undefined) return undefined;
    return row[i];
  };

  const awardId = get("awardId")?.trim() ?? "";
  if (!awardId) {
    return { error: `Row ${rowNumber}: missing award id.` };
  }
  const rawType = get("awardType");
  if (!rawType) {
    return { error: `Row ${rowNumber}: missing award type.` };
  }
  const awardType = normalizeAwardType(rawType);
  if (!awardType) {
    return {
      error: `Row ${rowNumber}: unrecognized award type "${rawType}". Use ISO, NSO, RSU, PSU, RSA, or OTHER.`,
    };
  }

  const grantDate = coerceDate(get("grantDate"));
  if (!grantDate) {
    return {
      error: `Row ${rowNumber}: missing or unparseable grant date.`,
    };
  }
  const vestStartDate = coerceDate(get("vestStartDate")) ?? grantDate;
  const vestEndDate = coerceDate(get("vestEndDate"));

  const sharesGranted = coerceNumber(get("sharesGranted")) ?? 0;
  const explicitVested = coerceNumber(get("sharesVested"));
  const unvested = coerceNumber(getExtra("sharesUnvested"));
  // Explicit vested wins. If absent, derive from sharesGranted - unvested.
  // If neither is present, default to 0 (existing behaviour).
  let sharesVested: number;
  if (explicitVested !== undefined) {
    sharesVested = explicitVested;
  } else if (unvested !== undefined && sharesGranted > 0) {
    sharesVested = Math.max(0, sharesGranted - unvested);
  } else {
    sharesVested = 0;
  }
  const pricePerShare = coerceNumber(get("pricePerShare"));
  const strike = coerceNumber(get("strike"));
  const employeeId = get("employeeId")?.trim() || undefined;
  const employeeName = get("employeeName")?.trim() || undefined;

  return {
    award: {
      awardId,
      awardType,
      grantDate,
      vestStartDate,
      vestEndDate,
      sharesGranted,
      sharesVested,
      pricePerShare,
      strike,
      employeeId,
      employeeName,
    },
  };
}

// ───────── Top-level import ─────────

export function importCsv(text: string): ImportResult {
  const rows = parseCsvText(text);
  if (rows.length === 0) {
    return { awards: [], errors: ["File is empty."], unmappedHeaders: [], rowCount: 0 };
  }
  const [headerRow, ...dataRows] = rows;
  const { index, extraIndex, unmapped } = mapHeaders(headerRow);

  const required: Array<keyof Award> = [
    "awardId",
    "awardType",
    "grantDate",
    "sharesGranted",
  ];
  // sharesVested is satisfied either by an explicit column OR by an
  // unvested / unreleased column we can derive from. ("Outstanding" is
  // intentionally NOT accepted — see EXTRA_HEADER_VARIANTS comment.)
  const hasVestedSource =
    index.sharesVested !== undefined ||
    extraIndex.sharesUnvested !== undefined;
  const missing: string[] = required.filter((r) => index[r] === undefined);
  if (!hasVestedSource) missing.push("sharesVested (or unvested/unreleased)");
  if (missing.length > 0) {
    return {
      awards: [],
      errors: [
        `Missing required columns: ${missing.join(", ")}. Recognized variants for these fields are listed in the help text.`,
      ],
      unmappedHeaders: unmapped,
      rowCount: 0,
    };
  }

  const awards: ParsedAward[] = [];
  const errors: string[] = [];
  dataRows.forEach((row, idx) => {
    if (row.every((c) => c.trim() === "")) return; // blank line
    const { award, error } = rowToAward(row, index, extraIndex, idx + 2); // +2 for 1-indexed + header row
    if (error) errors.push(error);
    if (award) awards.push(award);
  });
  return {
    awards,
    errors,
    unmappedHeaders: unmapped,
    rowCount: dataRows.filter((r) => r.some((c) => c.trim() !== "")).length,
  };
}

/**
 * Generates a sample CSV the user can download to use as a template.
 * Mirrors the parsing rules so a user can edit it and re-import.
 */
export const SAMPLE_CSV_TEMPLATE = `Award ID,Award Type,Grant Date,Vest Start Date,Vest End Date,Shares Granted,Shares Vested,Price Per Share,Strike,Employee ID,Employee Name
RSU-2023-001,RSU,2023-02-15,2023-02-15,2027-02-15,4000,2000,50,,E12345,Sample Employee
NSO-2022-007,NSO,2022-03-01,2022-03-01,2026-03-01,5000,3750,50,22,E12345,Sample Employee
PSU-2025-003,PSU,2025-02-15,2025-02-15,2028-02-15,1800,0,50,,E12345,Sample Employee
`;
