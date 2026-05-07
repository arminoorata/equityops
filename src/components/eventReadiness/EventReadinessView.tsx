"use client";

import { useMemo, useState } from "react";
import {
  defaultInputs,
  formatDayOffset,
  generatePlan,
  labelEventType,
  phaseLabel,
  FUNCTION_LABELS,
  type ChecklistItem,
  type CompanyStage,
  type CoordinationEmail,
  type EventInputs,
  type EventType,
  type StakeholderFunction,
} from "@/lib/eventReadiness";

/**
 * Equity Event Readiness Planner — main view.
 *
 * Layout:
 *   - Sample/Clear banner up top
 *   - Two-column work area:
 *       Left: event type, date, stage, metadata, owners
 *       Right: countdown checklist (grouped by phase), coordination
 *              emails, memo, export buttons
 *
 * Pure-functional engine in src/lib/eventReadiness.ts. No AI in
 * the generation path. Client-side only.
 */

const SAMPLE_INPUTS: EventInputs = {
  eventType: "DOUBLE_TRIGGER_IPO",
  eventDate: "2026-09-15",
  companyStage: "PUBLIC",
  eventName: "Acme IPO double-trigger vest",
  estimatedAffectedEmployees: 850,
  estimatedSharesAffected: 4_200_000,
  notes: "First IPO for the company; many employees will see this kind of event for the first time.",
  owners: {},
};

const ALL_EVENT_TYPES: EventType[] = [
  "VESTING_CLIFF",
  "DOUBLE_TRIGGER_IPO",
  "TENDER_OFFER",
  "IPO_LOCKUP_EXPIRATION",
  "MA_ACCELERATION",
  "SPIN_OFF",
  "PLAN_TERMINATION",
];

const ALL_FUNCTIONS: StakeholderFunction[] = [
  "TR",
  "PAYROLL",
  "LEGAL",
  "ACCOUNTING",
  "COMMS",
  "IR",
  "EQUITY_OPS",
];

export default function EventReadinessView() {
  const [inputs, setInputs] = useState<EventInputs>(SAMPLE_INPUTS);
  const [usingSample, setUsingSample] = useState(true);
  const [memoCopied, setMemoCopied] = useState(false);
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);

  const plan = useMemo(() => generatePlan(inputs), [inputs]);

  const setField = <K extends keyof EventInputs>(
    key: K,
    value: EventInputs[K],
  ) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    setUsingSample(false);
  };

  const setOwner = (fn: StakeholderFunction, value: string) => {
    setInputs((prev) => ({
      ...prev,
      owners: { ...(prev.owners ?? {}), [fn]: value },
    }));
    setUsingSample(false);
  };

  const loadSample = () => {
    setInputs(SAMPLE_INPUTS);
    setUsingSample(true);
  };

  const clearAll = () => {
    setInputs(defaultInputs());
    setUsingSample(false);
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (key === "memo") {
        setMemoCopied(true);
        setTimeout(() => setMemoCopied(false), 2000);
      } else {
        setCopiedEmailId(key);
        setTimeout(() => setCopiedEmailId(null), 2000);
      }
    } catch {
      // ignore
    }
  };

  const downloadFile = (filename: string, text: string, mime: string) => {
    if (typeof window === "undefined") return;
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Group checklist items by phase for display.
  const phasedChecklist = useMemo(() => {
    const groups = new Map<string, ChecklistItem[]>();
    plan.checklist.forEach((item) => {
      const phase = phaseLabel(item.daysBeforeEvent);
      if (!groups.has(phase)) groups.set(phase, []);
      groups.get(phase)!.push(item);
    });
    return Array.from(groups.entries());
  }, [plan.checklist]);

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border-l-4 px-4 py-3"
        style={{
          borderColor: "var(--accent)",
          borderLeftColor: "var(--accent)",
          borderLeftWidth: 4,
          background: "var(--surface)",
          color: "var(--muted)",
        }}
      >
        <div className="text-sm">
          {usingSample
            ? "Showing the sample IPO double-trigger event. Edit any field to start working with your own event, or clear to a blank slate."
            : "Editing your own event. Sample data is one click away if you want to see what the output looks like."}
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={loadSample}
            className="rounded-full px-3 py-1.5 font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            Load sample
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-full px-3 py-1.5 font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            Clear all
          </button>
        </div>
      </div>

      {!plan.eventDateValid && (
        <div
          role="alert"
          data-testid="event-date-warning"
          className="rounded-md border-l-4 px-4 py-3 text-sm leading-6"
          style={{
            borderColor: "var(--red, #d05a5a)",
            borderLeftColor: "var(--red, #d05a5a)",
            borderLeftWidth: 4,
            background: "var(--surface)",
            color: "var(--text)",
          }}
        >
          <strong style={{ color: "var(--red, #d05a5a)" }}>
            Event date is missing or unparseable.
          </strong>{" "}
          <span style={{ color: "var(--muted)" }}>
            The countdown checklist and memo show
            {" "}
            <span className="font-mono">[set event date]</span>
            {" "}
            in place of scheduled dates until you fill in a valid date above.
          </span>
        </div>
      )}

      <details
        className="rounded-md border p-4"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <summary
          className="cursor-pointer text-sm font-medium"
          style={{ color: "var(--accent)" }}
        >
          How this tool works (and what it isn&rsquo;t)
        </summary>
        <div
          className="mt-3 grid gap-4 text-sm leading-6 md:grid-cols-2"
          style={{ color: "var(--muted)" }}
        >
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text)" }}
            >
              Deterministic, not AI
            </p>
            <p className="mt-1">
              Checklists and email drafts are pulled from a curated library
              in{" "}
              <span className="font-mono text-[12px]">
                src/lib/eventReadinessChecklists.ts
              </span>
              . AI is not used to invent or interpret tasks. Templates fill
              with your typed inputs only.
            </p>
          </div>
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text)" }}
            >
              Stage-aware
            </p>
            <p className="mt-1">
              Some items apply only to public companies (Section 16, lockup
              insider obligations) or only to private companies (409A
              refresh, tender mechanics). The right items show based on
              your stage selection.
            </p>
          </div>
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text)" }}
            >
              Starting checklist, not the whole job
            </p>
            <p className="mt-1">
              Every event is unique. Treat the output as a kickoff agenda:
              cross-check with your specific transaction agreement, plan
              document, and cross-functional partners. Tailor before
              executing.
            </p>
          </div>
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text)" }}
            >
              Not legal advice
            </p>
            <p className="mt-1">
              Acceleration mechanics, Section 16 timing, 409A implications,
              and tax treatment are governed by the specific agreement and
              counsel. This is education, not advice.
            </p>
          </div>
        </div>
      </details>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* ──────── Left column: inputs ──────── */}
        <section className="space-y-6">
          <CardSection title="Event">
            <Field label="Event type">
              <select
                value={inputs.eventType}
                onChange={(e) =>
                  setField("eventType", e.target.value as EventType)
                }
                className="block w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg-alt)",
                  color: "var(--text)",
                }}
              >
                {ALL_EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {labelEventType(t)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Event name (optional, used in memo and emails)">
              <TextInput
                value={inputs.eventName ?? ""}
                onChange={(s) => setField("eventName", s)}
                placeholder={`e.g., ${labelEventType(inputs.eventType)}`}
              />
            </Field>
            <Field label="Event date">
              <DateInput
                value={inputs.eventDate}
                onChange={(s) => setField("eventDate", s)}
              />
            </Field>
            <Field label="Company stage">
              <Toggle
                options={[
                  { id: "PUBLIC", label: "Public" },
                  { id: "PRIVATE", label: "Private" },
                ]}
                value={inputs.companyStage}
                onChange={(id) =>
                  setField("companyStage", id as CompanyStage)
                }
              />
            </Field>
            <Field label="Estimated affected employees (optional)">
              <NumberInput
                value={inputs.estimatedAffectedEmployees ?? 0}
                onChange={(n) =>
                  setField(
                    "estimatedAffectedEmployees",
                    n === 0 ? undefined : n,
                  )
                }
              />
            </Field>
            <Field label="Estimated shares affected (optional)">
              <NumberInput
                value={inputs.estimatedSharesAffected ?? 0}
                onChange={(n) =>
                  setField("estimatedSharesAffected", n === 0 ? undefined : n)
                }
              />
            </Field>
            <Field label="Notes (optional, surfaces in memo)">
              <textarea
                value={inputs.notes ?? ""}
                onChange={(e) => setField("notes", e.target.value)}
                rows={3}
                placeholder="Any context the cross-functional team should know about this event."
                className="block w-full rounded-md border px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg-alt)",
                  color: "var(--text)",
                }}
              />
            </Field>
          </CardSection>

          <CardSection
            title="Owners (optional)"
            hint="Name the partner on each function. Defaults to the function label, which is fine for a v1 plan."
          >
            <div className="grid grid-cols-1 gap-2">
              {ALL_FUNCTIONS.map((fn) => (
                <Field
                  key={fn}
                  label={`${FUNCTION_LABELS[fn]} (${fn})`}
                >
                  <TextInput
                    value={inputs.owners?.[fn] ?? ""}
                    onChange={(s) => setOwner(fn, s)}
                    placeholder={FUNCTION_LABELS[fn]}
                  />
                </Field>
              ))}
            </div>
          </CardSection>
        </section>

        {/* ──────── Right column: outputs ──────── */}
        <section className="space-y-6">
          <CardSection
            title="Countdown checklist"
            hint={`${plan.checklist.length} item${plan.checklist.length === 1 ? "" : "s"} for ${labelEventType(inputs.eventType)} (${inputs.companyStage === "PUBLIC" ? "public" : "private"} stage).`}
          >
            {phasedChecklist.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                No checklist items for this event type.
              </p>
            ) : (
              <div className="space-y-5">
                {phasedChecklist.map(([phase, items]) => (
                  <div key={phase}>
                    <p
                      className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                      style={{ color: "var(--text)" }}
                    >
                      {phase}
                    </p>
                    <ul className="mt-2 space-y-2.5">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-md border p-3 text-sm leading-6"
                          style={{
                            borderColor: "var(--line)",
                            background: "var(--bg-alt)",
                          }}
                        >
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span
                              className="font-mono text-[11px] uppercase tracking-[0.14em]"
                              style={{ color: "var(--accent)" }}
                            >
                              {formatDayOffset(item.daysBeforeEvent)}
                            </span>
                            {item.scheduledDate && (
                              <span
                                className="font-mono text-[11px]"
                                style={{ color: "var(--muted)" }}
                              >
                                {item.scheduledDate}
                              </span>
                            )}
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                              style={{
                                background: "var(--surface-alt)",
                                color: "var(--text)",
                              }}
                            >
                              {item.ownerName}
                            </span>
                            <span
                              className="text-[10px] uppercase tracking-[0.14em]"
                              style={{ color: "var(--muted)" }}
                            >
                              {item.category}
                            </span>
                          </div>
                          <p
                            className="mt-1.5 font-medium"
                            style={{ color: "var(--text)" }}
                          >
                            {item.title}
                          </p>
                          <p style={{ color: "var(--muted)" }}>
                            {item.rationale}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardSection>

          <CardSection
            title="Coordination emails"
            hint={`${plan.emails.length} draft${plan.emails.length === 1 ? "" : "s"}. Click any to expand and copy.`}
          >
            {plan.emails.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                No emails for this event type.
              </p>
            ) : (
              <div className="space-y-3">
                {plan.emails.map((email) => (
                  <EmailCard
                    key={email.id}
                    email={email}
                    copied={copiedEmailId === email.id}
                    onCopy={() =>
                      copyText(
                        `Subject: ${email.subject}\n\n${email.body}`,
                        email.id,
                      )
                    }
                  />
                ))}
              </div>
            )}
          </CardSection>

          <CardSection
            title="Plan memo"
            hint="Plain markdown. Drop into the cross-functional kickoff thread."
          >
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => copyText(plan.memo, "memo")}
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  background: memoCopied
                    ? "var(--accent-soft)"
                    : "var(--surface-alt)",
                  color: memoCopied ? "var(--accent)" : "var(--text)",
                }}
              >
                {memoCopied ? "Copied" : "Copy memo"}
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadFile(
                    "event-readiness-plan.md",
                    plan.memo,
                    "text/markdown",
                  )
                }
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{ background: "var(--surface-alt)", color: "var(--text)" }}
              >
                Download memo (.md)
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadFile(
                    "event-readiness-checklist.csv",
                    checklistToCsv(plan.checklist),
                    "text/csv",
                  )
                }
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{ background: "var(--surface-alt)", color: "var(--text)" }}
              >
                Download checklist (.csv)
              </button>
            </div>
            <pre
              className="mt-3 whitespace-pre-wrap rounded-md border p-4 text-[12.5px] leading-6"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {plan.memo}
            </pre>
          </CardSection>

          <p
            className="text-xs italic leading-6"
            style={{ color: "var(--muted)" }}
          >
            Educational coordination plan. Not legal, tax, or financial
            advice. Acceleration mechanics, Section 16 filings, 409A
            implications, and withholding rules are governed by the
            specific transaction agreement, plan document, and counsel.
            Tailor this checklist to your circumstances before executing.
          </p>
        </section>
      </div>
    </div>
  );
}

// ──────────── Subcomponents ────────────

function CardSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-md border p-5"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      <p
        className="text-[11px] font-medium uppercase tracking-[0.18em]"
        style={{ color: "var(--accent)" }}
      >
        {title}
      </p>
      {hint && (
        <p
          className="mt-1 text-xs leading-5"
          style={{ color: "var(--muted)" }}
        >
          {hint}
        </p>
      )}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="block text-[11px] font-medium uppercase tracking-[0.14em]"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value === 0 ? "" : value.toLocaleString("en-US")}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^\d]/g, "");
        onChange(cleaned === "" ? 0 : Number(cleaned));
      }}
      placeholder={placeholder ?? "0"}
      className="block w-full rounded-md border px-3 py-1.5 text-sm"
      style={{
        borderColor: "var(--line)",
        background: "var(--bg-alt)",
        color: "var(--text)",
        fontFamily: "var(--font-mono)",
      }}
    />
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="block w-full rounded-md border px-3 py-1.5 text-sm"
      style={{
        borderColor: "var(--line)",
        background: "var(--bg-alt)",
        color: "var(--text)",
      }}
    />
  );
}

function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="block w-full rounded-md border px-3 py-1.5 text-sm"
      style={{
        borderColor: "var(--line)",
        background: "var(--bg-alt)",
        color: "var(--text)",
        colorScheme: "dark",
        fontFamily: "var(--font-mono)",
      }}
    />
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex flex-wrap gap-1 rounded-full border p-1"
      style={{ borderColor: "var(--line)", background: "var(--bg-alt)" }}
    >
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: active ? "var(--accent-soft)" : "transparent",
              color: active ? "var(--text)" : "var(--muted)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function EmailCard({
  email,
  copied,
  onCopy,
}: {
  email: CoordinationEmail;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <details
      className="rounded-md border"
      style={{
        borderColor: "var(--line)",
        background: "var(--bg-alt)",
      }}
    >
      <summary
        className="flex cursor-pointer flex-wrap items-center gap-3 px-3 py-2 text-sm"
        style={{ color: "var(--text)" }}
      >
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ background: "var(--surface-alt)", color: "var(--text)" }}
        >
          To: {email.toName}
        </span>
        <span style={{ color: "var(--muted)" }}>{email.subject}</span>
      </summary>
      <div className="border-t px-3 py-3" style={{ borderColor: "var(--line)" }}>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCopy}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              background: copied ? "var(--accent-soft)" : "var(--surface-alt)",
              color: copied ? "var(--accent)" : "var(--text)",
            }}
          >
            {copied ? "Copied" : "Copy email"}
          </button>
        </div>
        <pre
          className="mt-2 whitespace-pre-wrap text-[12.5px] leading-6"
          style={{
            color: "var(--text)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {`Subject: ${email.subject}\n\n${email.body}`}
        </pre>
      </div>
    </details>
  );
}

function checklistToCsv(items: ChecklistItem[]): string {
  const rows = [
    [
      "Days From Event",
      "Scheduled Date",
      "Owner",
      "Category",
      "Title",
      "Rationale",
    ].join(","),
  ];
  items.forEach((i) => {
    rows.push(
      [
        i.daysBeforeEvent,
        i.scheduledDate,
        csvEscape(i.ownerName),
        i.category,
        csvEscape(i.title),
        csvEscape(i.rationale),
      ].join(","),
    );
  });
  return rows.join("\n");
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
