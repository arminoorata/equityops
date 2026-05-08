/**
 * End-to-end demo flow tests for the Refresh Grant Sizing tool. These
 * exercise the same paths a user takes in the browser (sample → edit →
 * import CSV → memo → results CSV → re-import results) without
 * spinning up a DOM.
 *
 * The view component is intentionally a thin shell over the engine and
 * the CSV importer, so testing the data flow at the lib boundary
 * covers the meaningful behavior. Anything in the view that isn't
 * tested here (button rendering, theme tokens, focus styles) is
 * cosmetic surface that would be flagged by lint or by a manual demo.
 */

import { describe, expect, it } from "vitest";
import {
  analyzeRefresh,
  composeRefreshMemo,
  defaultGuidelines,
  defaultSettings,
  EXCEPTION_LABEL,
  recommendationsToCsv,
  type EmployeeRow,
  type ExceptionType,
  type RefreshSettings,
} from "./refreshSizing";
import {
  importRefreshCsv,
  REFRESH_CSV_TEMPLATE,
} from "./refreshSizingCsv";
import {
  SAMPLE_GUIDELINES,
  SAMPLE_ROWS,
  sampleSettings,
} from "./sampleRefreshSizing";

const exceptionTypes = (rec: { exceptions: { type: ExceptionType }[] }) =>
  new Set(rec.exceptions.map((e) => e.type));

describe("E2E: load sample → analyze → memo → CSV", () => {
  it("produces a believable analysis from the bundled sample population", () => {
    const a = analyzeRefresh(SAMPLE_ROWS, SAMPLE_GUIDELINES, sampleSettings());
    expect(a.recommendations).toHaveLength(SAMPLE_ROWS.length);
    expect(a.summary.headcount).toBe(SAMPLE_ROWS.length);
    expect(a.summary.totalProposedDollars).toBeGreaterThan(0);
    expect(a.summary.totalProposedShares).toBeGreaterThan(0);
    // The bundled sample is sized under the $1.5M sample budget.
    expect(a.summary.budgetUsedPct).toBeDefined();
    expect(a.summary.budgetUsedPct!).toBeLessThan(1);
    // Every level in the matrix that has people gets a row in by-level.
    expect(a.summary.byLevel.length).toBeGreaterThan(0);
    // Distribution by tier covers more than one tier (the sample is mixed).
    expect(a.summary.byTier.length).toBeGreaterThan(1);
  });

  it("the bundled sample surfaces every category of exception we ship for", () => {
    const a = analyzeRefresh(SAMPLE_ROWS, SAMPLE_GUIDELINES, sampleSettings());
    const seen = new Set<ExceptionType>();
    a.recommendations.forEach((r) =>
      r.exceptions.forEach((e) => seen.add(e.type)),
    );
    // The sample is intentionally constructed to hit each of these.
    [
      "MISSING_LEVEL",
      "MISSING_GUIDELINE",
      "ABOVE_GUIDELINE",
      "BELOW_GUIDELINE",
      "WAY_ABOVE_GUIDELINE",
      "WAY_BELOW_GUIDELINE",
      "STALE_LAST_GRANT",
      "RETENTION_OVERRIDE",
      "ZERO_VALUE_PROPOSED",
    ].forEach((t) => {
      expect(seen.has(t as ExceptionType)).toBe(true);
    });
  });

  it("the memo composed from the sample contains every numbered section + matrix", () => {
    const a = analyzeRefresh(SAMPLE_ROWS, SAMPLE_GUIDELINES, sampleSettings());
    const memo = composeRefreshMemo(a, SAMPLE_GUIDELINES);
    [
      "## 1. Inputs and assumptions",
      "Refresh guideline matrix applied",
      "## 2. Totals",
      "## 3. Distribution by level",
      "## 4. Distribution by performance tier",
      "## 5. Exceptions",
      "## 6. Rows needing manual review",
      "## 7. Recommended next steps",
      "## Disclaimer",
    ].forEach((section) => {
      expect(memo).toContain(section);
    });
    // The recommended next steps explicitly hand off to the right
    // committees and functions — credibility depends on this.
    expect(memo).toMatch(/TR leadership/i);
    expect(memo).toMatch(/[Ff]inance/);
    expect(memo).toMatch(/[Aa]ccounting/);
    expect(memo).toMatch(/[Ll]egal/);
    expect(memo).toMatch(/[Cc]omp committee/);
  });

  it("the results CSV has one row per recommendation + a header", () => {
    const a = analyzeRefresh(SAMPLE_ROWS, SAMPLE_GUIDELINES, sampleSettings());
    const csv = recommendationsToCsv(a.recommendations);
    const lines = csv.split("\n");
    expect(lines.length).toBe(SAMPLE_ROWS.length + 1);
    expect(lines[0]).toContain("Row ID");
    expect(lines[0]).toContain("Proposed Refresh Dollars");
    expect(lines[0]).toContain("Exceptions");
  });
});

describe("E2E: CSV template → import → analyze", () => {
  it("imports the bundled template, analyzes it, and produces a memo", () => {
    const r = importRefreshCsv(REFRESH_CSV_TEMPLATE);
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(3);
    const a = analyzeRefresh(r.rows, defaultGuidelines(), defaultSettings());
    const memo = composeRefreshMemo(a, defaultGuidelines());
    expect(a.recommendations).toHaveLength(3);
    expect(memo).toContain("# Refresh grant sizing — planning memo");
  });
});

// ───────── Messy input scenarios (each one called out in the QA brief) ─────────

describe("Messy input: missing level", () => {
  it("flags MISSING_LEVEL, routes to manual review, and zeros the proposed dollars", () => {
    const rows: EmployeeRow[] = [
      {
        rowId: "x",
        level: "",
        currentEquityValue: 0,
        unvestedValue: 0,
        priorRefreshDollars: 0,
        performanceTier: "MEETS",
        retentionRisk: "MEDIUM",
        criticalRoleFlag: false,
      },
    ];
    const a = analyzeRefresh(rows, defaultGuidelines(), defaultSettings());
    const r = a.recommendations[0];
    expect(exceptionTypes(r).has("MISSING_LEVEL")).toBe(true);
    expect(r.needsManualReview).toBe(true);
    expect(r.proposedRefreshDollars).toBe(0);
    expect(a.summary.countByException.NEEDS_MANUAL_REVIEW).toBe(1);
  });
});

describe("Messy input: missing FMV", () => {
  it("omits the share count and surfaces a MISSING_FMV flag", () => {
    const rows: EmployeeRow[] = [
      {
        rowId: "x",
        level: "L5",
        currentEquityValue: 0,
        unvestedValue: 0,
        priorRefreshDollars: 0,
        performanceTier: "MEETS",
        retentionRisk: "MEDIUM",
        criticalRoleFlag: false,
        proposedRefreshDollars: 30000,
      },
    ];
    const settings: RefreshSettings = { ...defaultSettings(), fmvPerShare: 0 };
    const a = analyzeRefresh(rows, defaultGuidelines(), settings);
    const r = a.recommendations[0];
    expect(r.fmvUsed).toBeUndefined();
    expect(r.proposedShareCount).toBeUndefined();
    expect(exceptionTypes(r).has("MISSING_FMV")).toBe(true);
    // Memo should not claim a share count when none is computable.
    const memo = composeRefreshMemo(a, defaultGuidelines());
    expect(memo).toContain("Proposed shares: 0");
  });
});

describe("Messy input: unknown performance tier", () => {
  it("flags MISSING_GUIDELINE because UNKNOWN has no matrix cell", () => {
    const rows: EmployeeRow[] = [
      {
        rowId: "x",
        level: "L5",
        currentEquityValue: 0,
        unvestedValue: 0,
        priorRefreshDollars: 0,
        performanceTier: "UNKNOWN",
        retentionRisk: "MEDIUM",
        criticalRoleFlag: false,
      },
    ];
    const a = analyzeRefresh(rows, defaultGuidelines(), defaultSettings());
    const r = a.recommendations[0];
    expect(exceptionTypes(r).has("MISSING_GUIDELINE")).toBe(true);
    expect(r.needsManualReview).toBe(true);
    expect(r.guidelineTargetDollars).toBeUndefined();
  });
});

describe("Messy input: above guideline (band breach, not way out)", () => {
  it("flags ABOVE_GUIDELINE without escalating to manual review", () => {
    // L5 MEETS target = 38000, max = 38000 × 1.25 = 47500. 50000 trips ABOVE.
    const rows: EmployeeRow[] = [
      {
        rowId: "x",
        level: "L5",
        currentEquityValue: 0,
        unvestedValue: 0,
        priorRefreshDollars: 0,
        performanceTier: "MEETS",
        retentionRisk: "MEDIUM",
        criticalRoleFlag: false,
        proposedRefreshDollars: 50000,
      },
    ];
    const a = analyzeRefresh(rows, defaultGuidelines(), defaultSettings());
    const r = a.recommendations[0];
    expect(exceptionTypes(r).has("ABOVE_GUIDELINE")).toBe(true);
    expect(exceptionTypes(r).has("WAY_ABOVE_GUIDELINE")).toBe(false);
    expect(r.needsManualReview).toBe(false);
  });
});

describe("Messy input: below guideline", () => {
  it("flags BELOW_GUIDELINE without escalating to manual review", () => {
    // L5 MEETS target = 38000, min = 38000 × 0.8 = 30400. 25000 trips BELOW.
    const rows: EmployeeRow[] = [
      {
        rowId: "x",
        level: "L5",
        currentEquityValue: 0,
        unvestedValue: 0,
        priorRefreshDollars: 0,
        performanceTier: "MEETS",
        retentionRisk: "MEDIUM",
        criticalRoleFlag: false,
        proposedRefreshDollars: 25000,
      },
    ];
    const a = analyzeRefresh(rows, defaultGuidelines(), defaultSettings());
    const r = a.recommendations[0];
    expect(exceptionTypes(r).has("BELOW_GUIDELINE")).toBe(true);
    expect(exceptionTypes(r).has("WAY_BELOW_GUIDELINE")).toBe(false);
    expect(r.needsManualReview).toBe(false);
  });
});

describe("Messy input: stale last grant", () => {
  it("flags STALE_LAST_GRANT past the threshold", () => {
    const rows: EmployeeRow[] = [
      {
        rowId: "x",
        level: "L5",
        currentEquityValue: 0,
        unvestedValue: 0,
        priorRefreshDollars: 0,
        performanceTier: "MEETS",
        retentionRisk: "MEDIUM",
        criticalRoleFlag: false,
        lastGrantDate: "2023-01-01",
      },
    ];
    const settings: RefreshSettings = {
      ...defaultSettings(),
      asOfDate: "2026-05-08",
      staleGrantThresholdMonths: 24,
    };
    const a = analyzeRefresh(rows, defaultGuidelines(), settings);
    expect(
      exceptionTypes(a.recommendations[0]).has("STALE_LAST_GRANT"),
    ).toBe(true);
  });
});

describe("Messy input: retention override", () => {
  it("adds RETENTION_OVERRIDE alongside ABOVE_GUIDELINE for critical roles", () => {
    const rows: EmployeeRow[] = [
      {
        rowId: "x",
        level: "L5",
        currentEquityValue: 0,
        unvestedValue: 0,
        priorRefreshDollars: 0,
        performanceTier: "MEETS",
        retentionRisk: "MEDIUM",
        criticalRoleFlag: true,
        proposedRefreshDollars: 55000, // above max but not way above
      },
    ];
    const a = analyzeRefresh(rows, defaultGuidelines(), defaultSettings());
    const types = exceptionTypes(a.recommendations[0]);
    expect(types.has("ABOVE_GUIDELINE")).toBe(true);
    expect(types.has("RETENTION_OVERRIDE")).toBe(true);
    expect(types.has("WAY_ABOVE_GUIDELINE")).toBe(false);
    // Retention override is documented, not blocking — should not promote
    // to manual review on its own.
    expect(a.recommendations[0].needsManualReview).toBe(false);
  });

  it("also fires RETENTION_OVERRIDE when retention risk is HIGH (not just critical role)", () => {
    const rows: EmployeeRow[] = [
      {
        rowId: "x",
        level: "L5",
        currentEquityValue: 0,
        unvestedValue: 0,
        priorRefreshDollars: 0,
        performanceTier: "MEETS",
        retentionRisk: "HIGH",
        criticalRoleFlag: false,
        proposedRefreshDollars: 55000,
      },
    ];
    const a = analyzeRefresh(rows, defaultGuidelines(), defaultSettings());
    expect(
      exceptionTypes(a.recommendations[0]).has("RETENTION_OVERRIDE"),
    ).toBe(true);
  });
});

describe("Bad CSV import paths", () => {
  it("rejects empty input", () => {
    const r = importRefreshCsv("");
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0]).toMatch(/empty/i);
  });

  it("rejects missing required Level column with a helpful message", () => {
    const r = importRefreshCsv("Employee ID,Performance Tier\nE1,Top");
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0]).toMatch(/Level/);
    expect(r.errors[0]).toMatch(/Recognized variants/);
  });

  it("collects unmapped headers but still imports usable rows", () => {
    const r = importRefreshCsv(
      "Level,Performance Tier,Random Column\nL5,Top,whatever",
    );
    expect(r.rows).toHaveLength(1);
    expect(r.unmappedHeaders).toContain("Random Column");
  });

  it("skips rows that have no employee id, name, or level", () => {
    const r = importRefreshCsv(
      "Employee ID,Level,Performance Tier\n,,\nE1,L5,Meets",
    );
    expect(r.rows).toHaveLength(1);
  });
});

describe("Exception label coverage", () => {
  it("every exception type has a human-readable label", () => {
    const expectedTypes: ExceptionType[] = [
      "ABOVE_GUIDELINE",
      "BELOW_GUIDELINE",
      "WAY_ABOVE_GUIDELINE",
      "WAY_BELOW_GUIDELINE",
      "MISSING_FMV",
      "MISSING_LEVEL",
      "MISSING_GUIDELINE",
      "STALE_LAST_GRANT",
      "RETENTION_OVERRIDE",
      "ZERO_VALUE_PROPOSED",
      "NEEDS_MANUAL_REVIEW",
    ];
    expectedTypes.forEach((t) => {
      expect(EXCEPTION_LABEL[t]).toBeTruthy();
    });
  });
});
