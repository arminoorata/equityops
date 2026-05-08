import { describe, expect, it } from "vitest";
import {
  importRefreshCsv,
  REFRESH_CSV_TEMPLATE,
} from "./refreshSizingCsv";

describe("importRefreshCsv", () => {
  it("imports the bundled template and produces typed rows", () => {
    const r = importRefreshCsv(REFRESH_CSV_TEMPLATE);
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(3);
    const first = r.rows[0];
    expect(first.employeeId).toBe("E0001");
    expect(first.level).toBe("L5");
    expect(first.performanceTier).toBe("TOP");
    expect(first.retentionRisk).toBe("MEDIUM");
    expect(first.criticalRoleFlag).toBe(false);
    expect(first.proposedRefreshDollars).toBe(42000);
    expect(first.fmvPerShare).toBe(50);
  });

  it("tolerates header variants and dollar-formatted numbers", () => {
    const csv = [
      "Worker ID,Job Band,Perf Rating,Flight Risk,Critical,Manager Proposed,Share Price",
      "E001,L6,High,High,Yes,\"$95,000\",\"$50.00\"",
    ].join("\n");
    const r = importRefreshCsv(csv);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0].employeeId).toBe("E001");
    expect(r.rows[0].level).toBe("L6");
    expect(r.rows[0].performanceTier).toBe("HIGH");
    expect(r.rows[0].retentionRisk).toBe("HIGH");
    expect(r.rows[0].criticalRoleFlag).toBe(true);
    expect(r.rows[0].proposedRefreshDollars).toBe(95000);
    expect(r.rows[0].fmvPerShare).toBe(50);
  });

  it("rejects when the level column is missing", () => {
    const csv = ["Employee ID,Performance Tier", "E1,Top"].join("\n");
    const r = importRefreshCsv(csv);
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0]).toMatch(/Missing required column: level/);
  });

  it("collects unmapped headers without dropping the row", () => {
    const csv = [
      "Employee ID,Level,Performance Tier,Random Column",
      "E1,L5,Top,whatever",
    ].join("\n");
    const r = importRefreshCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.unmappedHeaders).toContain("Random Column");
  });

  it("skips empty lines and rows with no signal", () => {
    const csv = [
      "Employee ID,Level,Performance Tier",
      "",
      "E1,L5,Meets",
      ",,",
    ].join("\n");
    const r = importRefreshCsv(csv);
    expect(r.rows).toHaveLength(1);
  });

  it("parses M/D/YYYY dates", () => {
    const csv = [
      "Employee ID,Level,Performance Tier,Last Grant Date",
      "E1,L5,Meets,2/15/2025",
    ].join("\n");
    const r = importRefreshCsv(csv);
    expect(r.rows[0].lastGrantDate).toBe("2025-02-15");
  });
});
