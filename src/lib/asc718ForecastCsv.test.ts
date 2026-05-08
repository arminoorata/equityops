import { describe, expect, it } from "vitest";
import {
  ASC_718_CSV_TEMPLATE,
  importAsc718Csv,
} from "./asc718ForecastCsv";

describe("importAsc718Csv", () => {
  it("imports the bundled template", () => {
    const r = importAsc718Csv(ASC_718_CSV_TEMPLATE);
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(4);
    expect(r.rows[0].awardType).toBe("RSU");
    expect(r.rows[0].vestingPattern).toBe("GRADED_4_YEAR_25_25_25_25");
    expect(r.rows[1].awardType).toBe("PSU");
    expect(r.rows[1].performanceProbability).toBe(1.2);
    expect(r.rows[2].vestingPattern).toBe("STRAIGHT_LINE");
  });
  it("rejects when fair-value column is missing", () => {
    const r = importAsc718Csv("Award ID,Award Type\nG-1,RSU");
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0]).toMatch(/Missing required column: Grant Date Fair Value/);
  });
  it("tolerates header variants and percent-formatted forfeiture", () => {
    const csv = [
      "Award ID,Award Type,Grant Date,Shares,GDFV,Vesting Term,Vesting Pattern,Forfeiture",
      "G-1,Restricted Stock Unit,2024-01-15,1000,$50.00,4,Straight Line,5%",
    ].join("\n");
    const r = importAsc718Csv(csv);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0].awardType).toBe("RSU");
    expect(r.rows[0].grantDateFairValue).toBe(50);
    expect(r.rows[0].vestingTermYears).toBe(4);
    expect(r.rows[0].vestingPattern).toBe("STRAIGHT_LINE");
    expect(r.rows[0].forfeitureRateOverride).toBe(5); // 5 = 5% the user entered, treated as the literal value
  });
  it("collects unmapped headers but keeps the row", () => {
    const r = importAsc718Csv("Fair Value,Random\n50,whatever");
    expect(r.rows).toHaveLength(1);
    expect(r.unmappedHeaders).toContain("Random");
  });
});
