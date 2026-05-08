import { describe, expect, it } from "vitest";
import {
  importUnderwaterCsv,
  UNDERWATER_CSV_TEMPLATE,
} from "./underwaterOptionsCsv";

describe("importUnderwaterCsv", () => {
  it("imports the bundled template with all four sample rows", () => {
    const r = importUnderwaterCsv(UNDERWATER_CSV_TEMPLATE);
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(4);
    const first = r.rows[0];
    expect(first.employeeId).toBe("E0001");
    expect(first.awardType).toBe("ISO");
    expect(first.strike).toBe(80);
    expect(first.sharesGranted).toBe(2000);
    expect(first.sharesVested).toBe(1500);
    expect(first.fmvOverride).toBe(50);
    expect(first.expirationDate).toBe("2032-02-15");
  });

  it("rejects when the Strike column is missing", () => {
    const r = importUnderwaterCsv("Employee ID,Award Type\nE1,ISO");
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0]).toMatch(/Missing required column: Strike/);
  });

  it("tolerates header variants", () => {
    const csv = [
      "Worker ID,Job Band,Grant Type,Exercise Price,Quantity,Vested,Exercised,Cancelled",
      "E001,L6,Incentive Stock Option,$80.00,3000,2250,250,0",
    ].join("\n");
    const r = importUnderwaterCsv(csv);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0].employeeId).toBe("E001");
    expect(r.rows[0].awardType).toBe("ISO");
    expect(r.rows[0].strike).toBe(80);
    expect(r.rows[0].sharesGranted).toBe(3000);
    expect(r.rows[0].sharesExercised).toBe(250);
    expect(r.rows[0].sharesForfeited).toBe(0);
  });

  it("normalizes M/D/YYYY dates", () => {
    const csv = "Employee ID,Strike,Grant Date,Expiration\nE1,50,2/15/2024,2/15/2034";
    const r = importUnderwaterCsv(csv);
    expect(r.rows[0].grantDate).toBe("2024-02-15");
    expect(r.rows[0].expirationDate).toBe("2034-02-15");
  });

  it("collects unmapped headers but keeps the row", () => {
    const csv = "Employee ID,Strike,Random Column\nE1,50,whatever";
    const r = importUnderwaterCsv(csv);
    expect(r.unmappedHeaders).toContain("Random Column");
    expect(r.rows.length).toBe(1);
  });

  it("skips no-signal rows", () => {
    const csv = "Strike,Employee ID\n,\n50,E1";
    const r = importUnderwaterCsv(csv);
    expect(r.rows.length).toBe(1);
  });
});
