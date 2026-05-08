/**
 * Comp Committee Memo Builder engine. Pure deterministic templating —
 * no AI, no backend. Takes a meeting context (date, company stage,
 * topic), pasted summaries from other workbench tools, structured
 * risk / decision flags, and the requested committee action, and
 * assembles a board-ready pre-read memo with executive summary,
 * decision requested, key metrics table, risks and open questions,
 * and recommended next steps.
 *
 * What this is NOT:
 *   - Not a replacement for the company secretary, legal counsel, or
 *     comp consultant. It is a memo assembly tool, not legal advice.
 *   - Not a system of record. The user pastes / types; nothing is
 *     persisted server-side.
 *   - Not AI-written. The memo is a deterministic concatenation of
 *     the user's inputs into a board-format template.
 */

// ───────── Types ─────────

export type MemoTopic =
  | "PLAN_HEALTH"
  | "REFRESH_CYCLE"
  | "GRANT_DISTRIBUTION"
  | "UNDERWATER_OPTIONS"
  | "PLAN_AMENDMENT"
  | "EQUITY_EVENT"
  | "HIRE_RANGE"
  | "AMT_SCENARIO"
  | "ASC_718_FORECAST"
  | "OTHER";

export type CompanyStage =
  | "EARLY_PRIVATE"
  | "LATE_PRIVATE"
  | "PRE_IPO"
  | "RECENTLY_PUBLIC"
  | "PUBLIC";

export type CommitteeAction = "INFORM" | "DISCUSS" | "APPROVE";

export type KeyMetric = {
  label: string;
  value: string;
};

export type RiskFlag = {
  label: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
};

export type OpenQuestion = {
  question: string;
  owner?: string;
};

export type NextStep = {
  step: string;
  owner?: string;
  due?: string;
};

export type CompCommitteeMemoInputs = {
  meetingDate: string; // ISO YYYY-MM-DD
  companyName?: string;
  companyStage: CompanyStage;
  topic: MemoTopic;
  /**
   * Free-text title for the memo. Defaults to the topic label if not
   * supplied.
   */
  title?: string;
  /**
   * Pasted summary from the underlying workbench tool. Markdown is
   * preserved verbatim. Multiple sections allowed (RawSection[]).
   */
  pastedSummaries: RawSection[];
  /** Key metrics rendered in a markdown table. */
  keyMetrics: KeyMetric[];
  /** Risk flags. Severity drives the chip tone in the memo's table. */
  risks: RiskFlag[];
  /** Open questions for the committee + tagged owner. */
  openQuestions: OpenQuestion[];
  /** Recommended next steps (sequenced; renders as ordered list). */
  nextSteps: NextStep[];
  /** Committee action requested. */
  requestedAction: CommitteeAction;
  /** Optional executive note from the head of TR / CHRO. */
  executiveNote?: string;
};

export type RawSection = {
  heading: string;
  body: string;
};

export type CompCommitteeMemoException =
  | "MISSING_MEETING_DATE"
  | "MISSING_TOPIC"
  | "MISSING_DECISION"
  | "EMPTY_BODY";

export type CompCommitteeMemoExceptionFlag = {
  type: CompCommitteeMemoException;
  message: string;
};

export type CompCommitteeMemo = {
  inputs: CompCommitteeMemoInputs;
  markdown: string;
  exceptions: CompCommitteeMemoExceptionFlag[];
};

// ───────── Labels ─────────

export const TOPIC_LABEL: Record<MemoTopic, string> = {
  PLAN_HEALTH: "Stock plan health",
  REFRESH_CYCLE: "Refresh grant cycle",
  GRANT_DISTRIBUTION: "Grant distribution audit",
  UNDERWATER_OPTIONS: "Underwater options exposure",
  PLAN_AMENDMENT: "Plan amendment",
  EQUITY_EVENT: "Equity event readiness",
  HIRE_RANGE: "Executive hire range",
  AMT_SCENARIO: "ISO exercise / AMT scenario",
  ASC_718_FORECAST: "ASC 718 expense forecast",
  OTHER: "Other",
};

export const STAGE_LABEL: Record<CompanyStage, string> = {
  EARLY_PRIVATE: "Early private",
  LATE_PRIVATE: "Late private",
  PRE_IPO: "Pre-IPO",
  RECENTLY_PUBLIC: "Recently public",
  PUBLIC: "Public",
};

export const ACTION_LABEL: Record<CommitteeAction, string> = {
  INFORM: "For information",
  DISCUSS: "For discussion",
  APPROVE: "For approval",
};

export const SEVERITY_LABEL: Record<RiskFlag["severity"], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const EXCEPTION_LABEL: Record<CompCommitteeMemoException, string> = {
  MISSING_MEETING_DATE: "Missing meeting date",
  MISSING_TOPIC: "Missing topic",
  MISSING_DECISION: "Missing decision requested",
  EMPTY_BODY: "Empty memo body",
};

// ───────── Defaults ─────────

export function defaultCompCommitteeMemoInputs(): CompCommitteeMemoInputs {
  return {
    meetingDate: "",
    companyName: "",
    companyStage: "PUBLIC",
    topic: "PLAN_HEALTH",
    title: "",
    pastedSummaries: [],
    keyMetrics: [],
    risks: [],
    openQuestions: [],
    nextSteps: [],
    requestedAction: "INFORM",
    executiveNote: "",
  };
}

// ───────── Validation ─────────

export function validateInputs(
  inputs: CompCommitteeMemoInputs,
): CompCommitteeMemoExceptionFlag[] {
  const exceptions: CompCommitteeMemoExceptionFlag[] = [];
  if (!inputs.meetingDate || !/^\d{4}-\d{2}-\d{2}$/.test(inputs.meetingDate)) {
    exceptions.push({
      type: "MISSING_MEETING_DATE",
      message:
        "Meeting date is missing or unparseable. Set the meeting date in ISO YYYY-MM-DD format.",
    });
  }
  if (!inputs.topic) {
    exceptions.push({
      type: "MISSING_TOPIC",
      message: "Topic is missing. Pick a topic to drive the memo template.",
    });
  }
  if (!inputs.requestedAction) {
    exceptions.push({
      type: "MISSING_DECISION",
      message:
        "Requested committee action is missing. Pick Inform, Discuss, or Approve.",
    });
  }
  const bodyEmpty =
    inputs.pastedSummaries.every((s) => !s.body.trim()) &&
    inputs.keyMetrics.length === 0 &&
    inputs.risks.length === 0 &&
    inputs.openQuestions.length === 0 &&
    inputs.nextSteps.length === 0 &&
    !inputs.executiveNote?.trim();
  if (bodyEmpty) {
    exceptions.push({
      type: "EMPTY_BODY",
      message:
        "Memo body is empty. Paste at least one summary, key metric, risk, question, or next step.",
    });
  }
  return exceptions;
}

// ───────── Memo composition ─────────

/**
 * Build the markdown memo. Sections render in the order a committee
 * member reads a pre-read packet:
 *
 *   - Header (title, meeting date, stage, topic, action requested)
 *   - 1. Executive summary (executive note + boilerplate framing)
 *   - 2. Decision requested
 *   - 3. Key metrics (markdown table)
 *   - 4. Pasted analysis sections (each user-supplied section verbatim)
 *   - 5. Risks and open questions
 *   - 6. Recommended next steps
 *   - Disclaimer
 */
export function buildMemoMarkdown(inputs: CompCommitteeMemoInputs): string {
  const lines: string[] = [];
  const title =
    inputs.title?.trim() ||
    `${TOPIC_LABEL[inputs.topic] ?? "Comp committee pre-read"}`;
  const company = inputs.companyName?.trim() || "(company)";
  lines.push(`# ${company} — ${title}`);
  lines.push("");
  lines.push(`**Meeting date:** ${inputs.meetingDate || "(not set)"}`);
  lines.push(`**Stage:** ${STAGE_LABEL[inputs.companyStage]}`);
  lines.push(`**Topic:** ${TOPIC_LABEL[inputs.topic] ?? inputs.topic}`);
  lines.push(`**Requested action:** ${ACTION_LABEL[inputs.requestedAction]}`);
  lines.push("");
  lines.push(
    "Memo assembled from typed and pasted inputs. Not legal, accounting, or financial advice. The plan document, comp committee charter, and qualified counsel control any committee action.",
  );
  lines.push("");

  // 1. Executive summary
  lines.push("## 1. Executive summary");
  if (inputs.executiveNote?.trim()) {
    lines.push(inputs.executiveNote.trim());
  } else {
    lines.push(
      `${TOPIC_LABEL[inputs.topic]} pre-read for the ${inputs.meetingDate || "(date TBD)"} comp committee meeting. The committee is asked to ${ACTION_LABEL[inputs.requestedAction].toLowerCase()}.`,
    );
  }
  lines.push("");

  // 2. Decision requested
  lines.push("## 2. Decision requested");
  lines.push(`- ${ACTION_LABEL[inputs.requestedAction]}.`);
  if (inputs.nextSteps.length > 0) {
    const headline = inputs.nextSteps.find((s) => s.step.trim());
    if (headline) {
      lines.push(`- Headline ask: ${headline.step.trim()}.`);
    }
  }
  lines.push("");

  // 3. Key metrics
  lines.push("## 3. Key metrics");
  if (inputs.keyMetrics.length === 0) {
    lines.push("- (no key metrics supplied)");
  } else {
    lines.push("");
    lines.push("| Metric | Value |");
    lines.push("| --- | --- |");
    inputs.keyMetrics.forEach((m) => {
      lines.push(`| ${escapePipes(m.label)} | ${escapePipes(m.value)} |`);
    });
  }
  lines.push("");

  // 4. Pasted analysis sections
  lines.push("## 4. Analysis");
  if (inputs.pastedSummaries.length === 0) {
    lines.push("- (no analysis sections pasted)");
  } else {
    inputs.pastedSummaries.forEach((s, i) => {
      const heading = s.heading?.trim() || `Section ${i + 1}`;
      lines.push(`### ${heading}`);
      lines.push("");
      lines.push(s.body.trim());
      lines.push("");
    });
  }
  lines.push("");

  // 5. Risks and open questions
  lines.push("## 5. Risks and open questions");
  if (inputs.risks.length === 0 && inputs.openQuestions.length === 0) {
    lines.push("- (none)");
  } else {
    if (inputs.risks.length > 0) {
      lines.push("**Risks:**");
      lines.push("");
      lines.push("| Severity | Risk | Detail |");
      lines.push("| --- | --- | --- |");
      inputs.risks.forEach((r) => {
        lines.push(
          `| ${SEVERITY_LABEL[r.severity]} | ${escapePipes(r.label)} | ${escapePipes(r.description)} |`,
        );
      });
      lines.push("");
    }
    if (inputs.openQuestions.length > 0) {
      lines.push("**Open questions:**");
      lines.push("");
      inputs.openQuestions.forEach((q) => {
        const owner = q.owner?.trim() ? ` (owner: ${q.owner.trim()})` : "";
        lines.push(`- ${q.question.trim()}${owner}`);
      });
      lines.push("");
    }
  }

  // 6. Recommended next steps
  lines.push("## 6. Recommended next steps");
  if (inputs.nextSteps.length === 0) {
    lines.push("- (no next steps supplied)");
  } else {
    inputs.nextSteps.forEach((s, i) => {
      const owner = s.owner?.trim() ? ` (owner: ${s.owner.trim()})` : "";
      const due = s.due?.trim() ? ` — due ${s.due.trim()}` : "";
      lines.push(`${i + 1}. ${s.step.trim()}${owner}${due}.`);
    });
  }
  lines.push("");

  // Disclaimer
  lines.push("## Disclaimer");
  lines.push(
    "Memo assembled from typed and pasted inputs. Not legal, accounting, or financial advice. The plan document, comp committee charter, listing-rule restrictions, ASC 718 accounting policy, and qualified counsel control any committee action.",
  );
  return lines.join("\n");
}

export function buildCompCommitteeMemo(
  inputs: CompCommitteeMemoInputs,
): CompCommitteeMemo {
  const exceptions = validateInputs(inputs);
  const markdown = buildMemoMarkdown(inputs);
  return {
    inputs,
    markdown,
    exceptions,
  };
}

// ───────── Helpers ─────────

/** Escape pipes inside a markdown table cell so the table renders. */
function escapePipes(s: string): string {
  return s.replace(/\|/g, "\\|");
}
