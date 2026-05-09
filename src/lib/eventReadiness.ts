/**
 * Equity Event Readiness Planner — engine.
 *
 * Pure functions only. Given an event type, an event date, a stage,
 * and optional metadata, produces a deterministic checklist
 * (countdown to the event) and a set of coordination email drafts to
 * the cross-functional partners (payroll, legal, comms, etc.).
 *
 * No AI in the generation path. The checklist content lives in the
 * companion module `eventReadinessChecklists.ts`. This file owns the
 * types, the plan composition, and the templating.
 *
 * Convention: `daysBeforeEvent` is signed. Negative values are pre-
 * event days (e.g., -30 means 30 days before). 0 is the event day.
 * Positive values are post-event days.
 */

import {
  CHECKLIST_TEMPLATES,
  EMAIL_TEMPLATES,
  type ChecklistTemplate,
  type EmailTemplate,
} from "./eventReadinessChecklists";

// ───────── Types ─────────

export type EventType =
  | "VESTING_CLIFF"
  | "DOUBLE_TRIGGER_IPO"
  | "TENDER_OFFER"
  | "IPO_LOCKUP_EXPIRATION"
  | "MA_ACCELERATION"
  | "SPIN_OFF"
  | "PLAN_TERMINATION";

export type CompanyStage = "PRIVATE" | "PUBLIC";

export type StakeholderFunction =
  | "TR"
  | "PAYROLL"
  | "LEGAL"
  | "ACCOUNTING"
  | "COMMS"
  | "IR"
  | "EQUITY_OPS";

export type ItemCategory =
  | "data"
  | "compliance"
  | "communication"
  | "operational"
  | "tax";

export type EventInputs = {
  eventType: EventType;
  /** ISO YYYY-MM-DD */
  eventDate: string;
  companyStage: CompanyStage;
  /** Optional human-readable name. Used in memos and email subjects. */
  eventName?: string;
  estimatedAffectedEmployees?: number;
  estimatedSharesAffected?: number;
  /** Free-form notes the user wants surfaced in the memo. */
  notes?: string;
  /** Optional named owner per function (defaults to the function label). */
  owners?: Partial<Record<StakeholderFunction, string>>;
};

export type ChecklistItem = {
  id: string;
  daysBeforeEvent: number;
  ownerFunction: StakeholderFunction;
  ownerName: string;
  title: string;
  rationale: string;
  category: ItemCategory;
  /** ISO YYYY-MM-DD computed from event date + offset. */
  scheduledDate: string;
};

export type CoordinationEmail = {
  id: string;
  to: StakeholderFunction;
  toName: string;
  subject: string;
  body: string;
};

export type EventPlan = {
  inputs: EventInputs;
  checklist: ChecklistItem[];
  emails: CoordinationEmail[];
  /** Plain markdown memo for the equity / legal / payroll review thread. */
  memo: string;
  /** True when inputs.eventDate parses to a valid YYYY-MM-DD. */
  eventDateValid: boolean;
};

/** Placeholder used in checklist scheduledDate, memo, and CSV when the event date is missing. */
export const MISSING_EVENT_DATE_PLACEHOLDER = "[set event date]";

// ───────── Date utilities ─────────

export function parseISODate(s: string | undefined | null): Date | null {
  if (!s || typeof s !== "string") return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ───────── Function labels ─────────

export const FUNCTION_LABELS: Record<StakeholderFunction, string> = {
  TR: "Total Rewards",
  PAYROLL: "Payroll",
  LEGAL: "Legal",
  ACCOUNTING: "Accounting",
  COMMS: "Communications",
  IR: "Investor Relations",
  EQUITY_OPS: "Equity Operations",
};

export function ownerName(
  fn: StakeholderFunction,
  owners: EventInputs["owners"],
): string {
  return owners?.[fn]?.trim() || FUNCTION_LABELS[fn];
}

// ───────── Plan generation ─────────

/**
 * Generate the full event plan from inputs.
 *
 * Returns a deterministic plan (same inputs → same output). The
 * checklist is filtered against the company stage (some items are
 * public-only or private-only) and sorted by daysBeforeEvent.
 */
export function generatePlan(inputs: EventInputs): EventPlan {
  const eventDate = parseISODate(inputs.eventDate);
  const eventDateValid = eventDate !== null;
  const checklist = buildChecklist(inputs, eventDate);
  const emails = buildEmails(inputs);
  const memo = composeMemo(inputs, checklist, emails, eventDateValid);
  return { inputs, checklist, emails, memo, eventDateValid };
}

function buildChecklist(
  inputs: EventInputs,
  eventDate: Date | null,
): ChecklistItem[] {
  const templates: ChecklistTemplate[] =
    CHECKLIST_TEMPLATES[inputs.eventType] ?? [];
  return templates
    .filter((t) => {
      if (t.onlyPublic && inputs.companyStage !== "PUBLIC") return false;
      if (t.onlyPrivate && inputs.companyStage !== "PRIVATE") return false;
      return true;
    })
    .map((t) => ({
      id: t.id,
      daysBeforeEvent: t.daysBeforeEvent,
      ownerFunction: t.ownerFunction,
      ownerName: ownerName(t.ownerFunction, inputs.owners),
      title: t.title,
      rationale: t.rationale,
      category: t.category,
      scheduledDate: eventDate
        ? formatISODate(shiftDays(eventDate, t.daysBeforeEvent))
        : MISSING_EVENT_DATE_PLACEHOLDER,
    }))
    .sort((a, b) => a.daysBeforeEvent - b.daysBeforeEvent);
}

function buildEmails(inputs: EventInputs): CoordinationEmail[] {
  const templates: EmailTemplate[] = EMAIL_TEMPLATES[inputs.eventType] ?? [];
  return templates
    .filter((t) => {
      if (t.onlyPublic && inputs.companyStage !== "PUBLIC") return false;
      if (t.onlyPrivate && inputs.companyStage !== "PRIVATE") return false;
      return true;
    })
    .map((t) => ({
      id: t.id,
      to: t.to,
      toName: ownerName(t.to, inputs.owners),
      subject: fillTemplate(t.subject, inputs),
      body: fillTemplate(t.body, inputs),
    }));
}

// ───────── Templating ─────────

/**
 * Replaces `{tokens}` in a template string with values from inputs.
 * Unknown or empty tokens are left as bracketed placeholders so the
 * user knows to fill them in.
 */
function fillTemplate(template: string, inputs: EventInputs): string {
  const eventName = inputs.eventName?.trim() || labelEventType(inputs.eventType);
  const date = inputs.eventDate?.trim() || MISSING_EVENT_DATE_PLACEHOLDER;
  const employees =
    inputs.estimatedAffectedEmployees !== undefined &&
    inputs.estimatedAffectedEmployees > 0
      ? inputs.estimatedAffectedEmployees.toLocaleString()
      : "[# affected employees]";
  const shares =
    inputs.estimatedSharesAffected !== undefined &&
    inputs.estimatedSharesAffected > 0
      ? inputs.estimatedSharesAffected.toLocaleString()
      : "[# shares affected]";
  // Empty notes render as a visible bracketed placeholder, matching
  // the comment at the top of eventReadinessChecklists.ts that empty
  // tokens fall through as placeholders the user can see.
  const notes = inputs.notes?.trim() || "[notes/context]";

  return template
    .replace(/\{eventName\}/g, eventName)
    .replace(/\{eventDate\}/g, date)
    .replace(/\{employees\}/g, employees)
    .replace(/\{shares\}/g, shares)
    .replace(/\{stage\}/g, inputs.companyStage === "PUBLIC" ? "public" : "private")
    .replace(/\{notes\}/g, notes);
}

// ───────── Memo ─────────

function composeMemo(
  inputs: EventInputs,
  checklist: ChecklistItem[],
  emails: CoordinationEmail[],
  eventDateValid: boolean,
): string {
  const lines: string[] = [];
  const eventName = inputs.eventName?.trim() || labelEventType(inputs.eventType);
  lines.push(`# Event readiness plan — ${eventName}`);
  lines.push("");
  lines.push(
    "Educational coordination plan generated from typed inputs. Not legal, tax, or financial advice. The company plan document, the merger / tender / spin-off agreement (where applicable), and counsel control the actual workflow. Treat this as a starting checklist, not a substitute for the cross-functional kickoff.",
  );
  lines.push("");

  if (!eventDateValid) {
    lines.push(
      `> ⚠️ Event date is missing or unparseable. Scheduled dates show ${MISSING_EVENT_DATE_PLACEHOLDER} until you fill it in.`,
    );
    lines.push("");
  }

  lines.push("## Event");
  lines.push(`- Type: ${labelEventType(inputs.eventType)}`);
  lines.push(
    `- Date: ${eventDateValid ? inputs.eventDate : MISSING_EVENT_DATE_PLACEHOLDER}`,
  );
  lines.push(
    `- Company stage: ${inputs.companyStage === "PUBLIC" ? "Public" : "Private"}`,
  );
  if (
    inputs.estimatedAffectedEmployees !== undefined &&
    inputs.estimatedAffectedEmployees > 0
  ) {
    lines.push(
      `- Estimated affected employees: ${inputs.estimatedAffectedEmployees.toLocaleString()}`,
    );
  }
  if (
    inputs.estimatedSharesAffected !== undefined &&
    inputs.estimatedSharesAffected > 0
  ) {
    lines.push(
      `- Estimated shares affected: ${inputs.estimatedSharesAffected.toLocaleString()}`,
    );
  }
  if (inputs.notes?.trim()) {
    lines.push(`- Notes: ${inputs.notes.trim()}`);
  }
  lines.push("");

  lines.push("## Countdown checklist");
  if (checklist.length === 0) {
    lines.push("- No checklist items available for this event type.");
  } else {
    let lastPhase = "";
    checklist.forEach((item) => {
      const phase = phaseLabel(item.daysBeforeEvent);
      if (phase !== lastPhase) {
        lines.push("");
        lines.push(`### ${phase}`);
        lastPhase = phase;
      }
      const dateStr = item.scheduledDate ? ` (${item.scheduledDate})` : "";
      const dayLabel = formatDayOffset(item.daysBeforeEvent);
      lines.push(
        `- **${dayLabel}${dateStr}** [${item.ownerName}] ${item.title}`,
      );
      lines.push(`  - ${item.rationale}`);
    });
  }
  lines.push("");

  lines.push("## Coordination emails");
  if (emails.length === 0) {
    lines.push("- No coordination emails for this event type.");
  } else {
    emails.forEach((email, idx) => {
      lines.push(`${idx + 1}. To: **${email.toName}** — Subject: ${email.subject}`);
    });
    lines.push("");
    lines.push(
      "Open the Coordination emails section in the tool to copy each one individually.",
    );
  }
  lines.push("");

  lines.push("## Recommended next steps");
  lines.push(
    "1. Schedule a cross-functional kickoff with TR, equity ops, payroll, legal, accounting, IR, and comms. Walk the countdown checklist line by line and assign each owner.",
  );
  lines.push(
    "2. Confirm the platform-of-record (Fidelity / Shareworks / Computershare / E*TRADE / Carta) is configured for the event mechanics; the workbench does not process the event.",
  );
  lines.push(
    "3. Send the coordination emails on the cadence the checklist sets out; cc TR / legal so the audit trail lives in one thread.",
  );
  lines.push(
    "4. Save the assumption sheet (event type, dates, scope) alongside the memo so the post-event review uses the same baseline.",
  );
  lines.push("");

  lines.push("## Disclaimer");
  lines.push(
    "Outputs reflect typed inputs and a deterministic checklist library. They do not replace your company's plan document, the relevant transaction agreements, or counsel. Bring this plan to the cross-functional kickoff and adjust to your specific circumstances before executing.",
  );

  return lines.join("\n");
}

// ───────── Helpers ─────────

export function labelEventType(t: EventType): string {
  switch (t) {
    case "VESTING_CLIFF":
      return "Vesting cliff event";
    case "DOUBLE_TRIGGER_IPO":
      return "Double-trigger RSU vest at IPO";
    case "TENDER_OFFER":
      return "Tender offer";
    case "IPO_LOCKUP_EXPIRATION":
      return "IPO lockup expiration";
    case "MA_ACCELERATION":
      return "M&A acceleration";
    case "SPIN_OFF":
      return "Spin-off";
    case "PLAN_TERMINATION":
      return "Plan termination";
  }
}

export function categoryLabel(c: ItemCategory): string {
  switch (c) {
    case "data":
      return "Data";
    case "compliance":
      return "Compliance";
    case "communication":
      return "Communication";
    case "operational":
      return "Operational";
    case "tax":
      return "Tax";
  }
}

export function phaseLabel(daysBeforeEvent: number): string {
  if (daysBeforeEvent <= -45) return "T-90 to T-45";
  if (daysBeforeEvent <= -21) return "T-44 to T-21";
  if (daysBeforeEvent <= -7) return "T-20 to T-7";
  if (daysBeforeEvent < 0) return "T-6 to T-1";
  if (daysBeforeEvent === 0) return "Event day";
  return "Post-event";
}

export function formatDayOffset(daysBeforeEvent: number): string {
  if (daysBeforeEvent === 0) return "T-day";
  if (daysBeforeEvent < 0) return `T${daysBeforeEvent}`;
  return `T+${daysBeforeEvent}`;
}

// ───────── Defaults ─────────

export function defaultInputs(): EventInputs {
  return {
    eventType: "VESTING_CLIFF",
    eventDate: "",
    companyStage: "PUBLIC",
    eventName: "",
    notes: "",
    owners: {},
  };
}
