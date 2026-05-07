import { describe, expect, it } from "vitest";
import { importCsv, parseCsvText, SAMPLE_CSV_TEMPLATE } from "./csvImport";

describe("parseCsvText", () => {
  it("parses simple unquoted rows", () => {
    const out = parseCsvText("a,b,c\n1,2,3\n4,5,6");
    expect(out).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("handles quoted fields with commas", () => {
    const out = parseCsvText(`a,b,c\n"hello, world",x,"y, z"`);
    expect(out[1]).toEqual(["hello, world", "x", "y, z"]);
  });

  it("handles escaped double-quotes inside quoted fields", () => {
    const out = parseCsvText(`a\n"He said ""hi"""`);
    expect(out[1]).toEqual([`He said "hi"`]);
  });

  it("handles CRLF line endings", () => {
    const out = parseCsvText("a,b\r\n1,2\r\n3,4");
    expect(out).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("strips a leading BOM", () => {
    const out = parseCsvText("﻿a,b\n1,2");
    expect(out[0]).toEqual(["a", "b"]);
  });

  it("drops trailing blank rows", () => {
    const out = parseCsvText("a,b\n1,2\n\n");
    expect(out).toHaveLength(2);
  });
});

describe("importCsv — header mapping", () => {
  it("maps canonical headers", () => {
    const csv = `Award ID,Award Type,Grant Date,Vest Start Date,Vest End Date,Shares Granted,Shares Vested,Price Per Share
A1,RSU,2024-01-15,2024-01-15,2028-01-15,100,25,50`;
    const result = importCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.awards).toHaveLength(1);
    expect(result.awards[0]).toMatchObject({
      awardId: "A1",
      awardType: "RSU",
      grantDate: "2024-01-15",
      sharesGranted: 100,
      sharesVested: 25,
      pricePerShare: 50,
    });
  });

  it("maps vendor-specific header variants", () => {
    const csv = `Grant Number,Type,Grant Date,Vesting Start Date,Final Vest Date,Total Shares,Vested Shares,FMV
G-1,Restricted Stock Unit,01/15/2024,01/15/2024,01/15/2028,1000,250,42.50`;
    const result = importCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.awards).toHaveLength(1);
    expect(result.awards[0]).toMatchObject({
      awardId: "G-1",
      awardType: "RSU",
      grantDate: "2024-01-15",
      vestStartDate: "2024-01-15",
      vestEndDate: "2028-01-15",
      sharesGranted: 1000,
      sharesVested: 250,
      pricePerShare: 42.5,
    });
  });

  it("normalizes US date format M/D/YYYY", () => {
    const csv = `Award ID,Award Type,Grant Date,Vest Start Date,Shares Granted,Shares Vested
A1,RSU,1/5/2024,1/5/2024,100,0`;
    const result = importCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.awards[0].grantDate).toBe("2024-01-05");
  });

  it("returns row-level error for unrecognized award type", () => {
    const csv = `Award ID,Award Type,Grant Date,Shares Granted,Shares Vested
A1,WidgetGrant,2024-01-15,100,0`;
    const result = importCsv(csv);
    expect(result.awards).toHaveLength(0);
    expect(result.errors[0]).toContain("unrecognized award type");
  });

  it("returns top-level error when required columns are missing", () => {
    const csv = `Some Header,Other Header
1,2`;
    const result = importCsv(csv);
    expect(result.awards).toHaveLength(0);
    expect(result.errors[0].toLowerCase()).toContain("missing required columns");
  });

  it("strips $ and , from numeric fields", () => {
    const csv = `Award ID,Award Type,Grant Date,Shares Granted,Shares Vested,Price Per Share
A1,RSU,2024-01-15,"1,000",250,"$42.50"`;
    const result = importCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.awards[0].sharesGranted).toBe(1000);
    expect(result.awards[0].pricePerShare).toBe(42.5);
  });

  it("collects unmapped headers as informational, not as errors", () => {
    const csv = `Award ID,Award Type,Grant Date,Shares Granted,Shares Vested,Some Custom Col
A1,RSU,2024-01-15,100,0,whatever`;
    const result = importCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.unmappedHeaders).toContain("Some Custom Col");
    expect(result.awards).toHaveLength(1);
  });

  it("ignores blank rows in the body", () => {
    const csv = `Award ID,Award Type,Grant Date,Shares Granted,Shares Vested
A1,RSU,2024-01-15,100,0
,,,,
A2,RSU,2024-02-15,200,50`;
    const result = importCsv(csv);
    expect(result.awards).toHaveLength(2);
  });

  it("returns 'File is empty' for empty input", () => {
    expect(importCsv("").errors[0]).toContain("empty");
  });
});

describe("SAMPLE_CSV_TEMPLATE", () => {
  it("parses cleanly through importCsv", () => {
    const result = importCsv(SAMPLE_CSV_TEMPLATE);
    expect(result.errors).toEqual([]);
    expect(result.awards.length).toBeGreaterThan(0);
    expect(result.awards.every((a) => a.awardType !== undefined)).toBe(true);
  });
});
