import { describe, expect, it } from "vitest";
import {
  buildCompCommitteeMemo,
  buildMemoMarkdown,
  defaultCompCommitteeMemoInputs,
  validateInputs,
  type CompCommitteeMemoInputs,
} from "./compCommitteeMemo";

const sample = (overrides: Partial<CompCommitteeMemoInputs> = {}): CompCommitteeMemoInputs => ({
  ...defaultCompCommitteeMemoInputs(),
  meetingDate: "2026-06-15",
  companyName: "Sample Inc.",
  companyStage: "PUBLIC",
  topic: "REFRESH_CYCLE",
  title: "FY26 refresh recommendation",
  pastedSummaries: [
    {
      heading: "Refresh sizing summary",
      body: "- Population: 800 employees\n- Total proposed: $25M\n- Budget utilization: 95%",
    },
  ],
  keyMetrics: [
    { label: "Total proposed", value: "$25.0M" },
    { label: "Budget", value: "$26.5M" },
    { label: "Headcount", value: "800" },
  ],
  risks: [
    {
      severity: "MEDIUM",
      label: "Outlier overrides",
      description: "12 above-band overrides; rationale documented for 11 of 12.",
    },
  ],
  openQuestions: [
    {
      question: "Confirm the L7 retention guideline change is reflected in the plan-doc language.",
      owner: "Legal",
    },
  ],
  nextSteps: [
    {
      step: "Approve the refresh distribution and authorize the CHRO to execute under the plan",
      owner: "Comp committee",
      due: "2026-06-15",
    },
    {
      step: "Confirm ASC 718 expense impact in the next earnings cycle",
      owner: "Accounting",
    },
  ],
  requestedAction: "APPROVE",
  executiveNote:
    "FY26 refresh sized to land within budget with no broad-based deviation from the framework.",
  ...overrides,
});

// ───────── Validation ─────────

describe("validateInputs", () => {
  it("returns no exceptions for a complete input", () => {
    expect(validateInputs(sample())).toEqual([]);
  });
  it("flags missing meeting date", () => {
    const r = validateInputs(sample({ meetingDate: "" }));
    expect(r.some((e) => e.type === "MISSING_MEETING_DATE")).toBe(true);
  });
  it("flags malformed meeting date", () => {
    const r = validateInputs(sample({ meetingDate: "06/15/2026" }));
    expect(r.some((e) => e.type === "MISSING_MEETING_DATE")).toBe(true);
  });
  it("flags an empty body when nothing is supplied", () => {
    const r = validateInputs(
      sample({
        pastedSummaries: [],
        keyMetrics: [],
        risks: [],
        openQuestions: [],
        nextSteps: [],
        executiveNote: "",
      }),
    );
    expect(r.some((e) => e.type === "EMPTY_BODY")).toBe(true);
  });
});

// ───────── Memo composition ─────────

describe("buildMemoMarkdown", () => {
  it("renders a complete memo with all sections", () => {
    const md = buildMemoMarkdown(sample());
    [
      "# Sample Inc. — FY26 refresh recommendation",
      "**Meeting date:** 2026-06-15",
      "**Stage:** Public",
      "**Topic:** Refresh grant cycle",
      "**Requested action:** For approval",
      "## 1. Executive summary",
      "## 2. Decision requested",
      "## 3. Key metrics",
      "## 4. Analysis",
      "## 5. Risks and open questions",
      "## 6. Recommended next steps",
      "## Disclaimer",
    ].forEach((s) => expect(md).toContain(s));
    // Key metrics rendered as a markdown table.
    expect(md).toMatch(/\| Metric \| Value \|/);
    // Risks table has a Severity column.
    expect(md).toMatch(/\| Severity \| Risk \| Detail \|/);
  });
  it("escapes pipe characters inside table cells", () => {
    const md = buildMemoMarkdown(
      sample({
        keyMetrics: [{ label: "Total | net", value: "$1 | M" }],
      }),
    );
    expect(md).toContain("Total \\| net");
    expect(md).toContain("$1 \\| M");
  });
  it("uses topic-derived defaults when title is empty", () => {
    const md = buildMemoMarkdown(sample({ title: "" }));
    expect(md).toContain("Refresh grant cycle");
  });
  it("falls back to a generic executive summary when none supplied", () => {
    const md = buildMemoMarkdown(sample({ executiveNote: "" }));
    expect(md).toContain("Refresh grant cycle pre-read");
  });
  it("includes the headline ask under the decision when next steps exist", () => {
    const md = buildMemoMarkdown(sample());
    expect(md).toContain("Headline ask:");
  });
  it("renders pasted analysis sections verbatim with their headings", () => {
    const md = buildMemoMarkdown(sample());
    expect(md).toContain("### Refresh sizing summary");
    expect(md).toContain("- Population: 800 employees");
  });
  it("renders open questions with owner tag", () => {
    const md = buildMemoMarkdown(sample());
    expect(md).toContain("(owner: Legal)");
  });
  it("renders next steps as an ordered list with owner + due tags", () => {
    const md = buildMemoMarkdown(sample());
    expect(md).toMatch(/^\d\. Approve the refresh/m);
    expect(md).toContain("(owner: Comp committee)");
    expect(md).toContain("due 2026-06-15");
  });
});

describe("buildCompCommitteeMemo", () => {
  it("returns markdown plus an exceptions list", () => {
    const memo = buildCompCommitteeMemo(sample({ meetingDate: "" }));
    expect(memo.markdown.length).toBeGreaterThan(100);
    expect(memo.exceptions.some((e) => e.type === "MISSING_MEETING_DATE")).toBe(
      true,
    );
  });
});
