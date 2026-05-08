import { describe, expect, it } from "vitest";
import { AMT_CSV_TEMPLATE, importAmtCsv } from "./amtScenarioCsv";

describe("importAmtCsv", () => {
  it("imports the bundled template", () => {
    const r = importAmtCsv(AMT_CSV_TEMPLATE);
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(3);
    const first = r.rows[0];
    expect(first.grantId).toBe("G-1001");
    expect(first.strike).toBe(5);
    expect(first.currentFmv).toBe(50);
    expect(first.sharesExercisable).toBe(5000);
    expect(first.proposedExerciseShares).toBe(5000);
  });
  it("rejects when Strike column is missing", () => {
    const r = importAmtCsv("Grant ID,Current FMV\nG-1,50");
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0]).toMatch(/Missing required column: Strike/);
  });
  it("normalizes M/D/YYYY dates and tolerates header variants", () => {
    const csv = [
      "Award ID,Award Date,Vested Shares,Exercise Price,Share Price,Shares to Exercise",
      "G-1,2/15/2024,1000,15,50,1000",
    ].join("\n");
    const r = importAmtCsv(csv);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0].grantDate).toBe("2024-02-15");
    expect(r.rows[0].strike).toBe(15);
    expect(r.rows[0].sharesExercisable).toBe(1000);
    expect(r.rows[0].proposedExerciseShares).toBe(1000);
  });
  it("collects unmapped headers but keeps the row", () => {
    const r = importAmtCsv("Strike,Random\n10,whatever");
    expect(r.rows).toHaveLength(1);
    expect(r.unmappedHeaders).toContain("Random");
  });
});
