import { describe, expect, it } from "vitest";
import {
  GRANT_DISTRIBUTION_CSV_TEMPLATE,
  importGrantDistributionCsv,
} from "./grantDistributionCsv";

describe("importGrantDistributionCsv", () => {
  it("imports the bundled template with all four sample rows", () => {
    const r = importGrantDistributionCsv(GRANT_DISTRIBUTION_CSV_TEMPLATE);
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(4);
    const first = r.rows[0];
    expect(first.employeeId).toBe("E0001");
    expect(first.level).toBe("L5");
    expect(first.function).toBe("Engineering");
    expect(first.country).toBe("US");
    expect(first.awardType).toBe("RSU");
    expect(first.grantDate).toBe("2025-02-15");
    expect(first.shares).toBe(2000);
    expect(first.fmvAtGrant).toBe(50);
    expect(first.currentFmv).toBe(55);
    expect(first.demographics).toEqual({
      Gender: "Women",
      "Ethnicity Group": "Asian",
      Generation: "Millennial",
    });
  });

  it("auto-detects demographic columns by 'Demographic:' prefix and 'Demo:' prefix", () => {
    const csv = [
      "Level,Demo: Gender,Demographic: Tenure Band",
      "L5,Women,5-10 yrs",
    ].join("\n");
    const r = importGrantDistributionCsv(csv);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0].demographics).toEqual({
      Gender: "Women",
      "Tenure Band": "5-10 yrs",
    });
  });

  it("tolerates header variants (Worker ID, Job Family, etc.)", () => {
    const csv = [
      "Worker ID,Job Band,Job Family,Award Type,Quantity,Share Price",
      "E001,L6,Sales,RSU,1500,42",
    ].join("\n");
    const r = importGrantDistributionCsv(csv);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0].employeeId).toBe("E001");
    expect(r.rows[0].level).toBe("L6");
    expect(r.rows[0].function).toBe("Sales");
    expect(r.rows[0].awardType).toBe("RSU");
    expect(r.rows[0].shares).toBe(1500);
    expect(r.rows[0].currentFmv).toBe(42);
  });

  it("normalizes M/D/YYYY grant dates", () => {
    const csv = "Level,Grant Date\nL5,2/15/2025";
    const r = importGrantDistributionCsv(csv);
    expect(r.rows[0].grantDate).toBe("2025-02-15");
  });

  it("rejects when neither Level nor Grant ID column is present", () => {
    const r = importGrantDistributionCsv("Employee ID\nE1");
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0]).toMatch(/Missing required column/);
  });

  it("collects unmapped non-demographic headers but keeps the row", () => {
    const csv = "Level,Random Column\nL5,whatever";
    const r = importGrantDistributionCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.unmappedHeaders).toContain("Random Column");
  });

  it("skips rows with no signal", () => {
    const csv = ["Level", "L5", "", ""].join("\n");
    const r = importGrantDistributionCsv(csv);
    expect(r.rows).toHaveLength(1);
  });

  it("normalizes award-type variants case-insensitively", () => {
    const csv = "Level,Award Type\nL5,Incentive Stock Option";
    const r = importGrantDistributionCsv(csv);
    expect(r.rows[0].awardType).toBe("ISO");
  });
});
