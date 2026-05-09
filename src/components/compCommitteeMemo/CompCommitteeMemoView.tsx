"use client";

import { useMemo, useState } from "react";
import {
  CardSection,
  DateInput,
  Disclosure,
  Field,
  HowToStep,
  ProvChip,
  SampleClearBanner,
  TextInput,
  triggerDownload,
} from "@/components/workbench";
import {
  ACTION_LABEL,
  buildCompCommitteeMemo,
  defaultCompCommitteeMemoInputs,
  EXCEPTION_LABEL,
  SEVERITY_LABEL,
  STAGE_LABEL,
  TOPIC_LABEL,
  type CommitteeAction,
  type CompanyStage,
  type CompCommitteeMemoInputs,
  type KeyMetric,
  type MemoTopic,
  type NextStep,
  type OpenQuestion,
  type RawSection,
  type RiskFlag,
} from "@/lib/compCommitteeMemo";

const SAMPLE_INPUTS: CompCommitteeMemoInputs = {
  meetingDate: "2026-06-15",
  companyName: "Sample Inc.",
  companyStage: "PUBLIC",
  topic: "REFRESH_CYCLE",
  title: "FY26 refresh recommendation",
  pastedSummaries: [
    {
      heading: "Refresh sizing summary",
      body:
        "- Population: 800 employees\n- Total proposed: $25.0M\n- Budget: $26.5M (94% utilization)\n- Above-band overrides: 12 (rationale documented for 11 of 12)\n- Below-band overrides: 0",
    },
    {
      heading: "Performance distribution",
      body:
        "- Top: 8% of headcount, 14% of dollars\n- High: 22%, 28%\n- Meets: 60%, 53%\n- Emerging / Below: 10%, 5%",
    },
  ],
  keyMetrics: [
    { label: "Total proposed dollars", value: "$25.0M" },
    { label: "Budget", value: "$26.5M" },
    { label: "Headcount in scope", value: "800" },
    { label: "Above-band overrides", value: "12" },
    { label: "Average per employee", value: "$31,250" },
  ],
  risks: [
    {
      severity: "MEDIUM",
      label: "Outlier overrides without rationale",
      description: "1 of 12 above-band overrides lacks a documented rationale.",
    },
    {
      severity: "LOW",
      label: "Stale FMV reference",
      description:
        "FMV used in the model is 32 days old; refresh date is 14 days out.",
    },
  ],
  openQuestions: [
    {
      question:
        "Confirm L7 retention guideline change is reflected in plan-doc language.",
      owner: "Legal",
    },
    {
      question:
        "Confirm the additional ASC 718 expense impact lands inside the FY26 expense plan.",
      owner: "Accounting",
    },
  ],
  nextSteps: [
    {
      step: "Approve the FY26 refresh distribution and authorize the CHRO to execute under the plan",
      owner: "Comp committee",
      due: "2026-06-15",
    },
    {
      step: "Reconcile the additional ASC 718 expense in the next earnings cycle",
      owner: "Accounting",
    },
    {
      step: "Update the L7 plan-doc retention guideline language",
      owner: "Legal",
      due: "2026-07-31",
    },
  ],
  requestedAction: "APPROVE",
  executiveNote:
    "FY26 refresh sized to land within budget with no broad-based deviation from the framework. One above-band override remains without documented rationale; the committee is asked to approve subject to that gap being closed.",
};

export default function CompCommitteeMemoView() {
  const [inputs, setInputs] = useState<CompCommitteeMemoInputs>(SAMPLE_INPUTS);
  const [usingSample, setUsingSample] = useState(true);
  const [memoCopied, setMemoCopied] = useState(false);

  const memo = useMemo(() => buildCompCommitteeMemo(inputs), [inputs]);

  const update = <K extends keyof CompCommitteeMemoInputs>(
    key: K,
    value: CompCommitteeMemoInputs[K],
  ) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    setUsingSample(false);
  };

  const updateSummary = (i: number, patch: Partial<RawSection>) => {
    setInputs((prev) => ({
      ...prev,
      pastedSummaries: prev.pastedSummaries.map((s, idx) =>
        idx === i ? { ...s, ...patch } : s,
      ),
    }));
    setUsingSample(false);
  };
  const addSummary = () => {
    setInputs((prev) => ({
      ...prev,
      pastedSummaries: [...prev.pastedSummaries, { heading: "", body: "" }],
    }));
    setUsingSample(false);
  };
  const removeSummary = (i: number) => {
    setInputs((prev) => ({
      ...prev,
      pastedSummaries: prev.pastedSummaries.filter((_, idx) => idx !== i),
    }));
    setUsingSample(false);
  };

  const updateMetric = (i: number, patch: Partial<KeyMetric>) => {
    setInputs((prev) => ({
      ...prev,
      keyMetrics: prev.keyMetrics.map((m, idx) =>
        idx === i ? { ...m, ...patch } : m,
      ),
    }));
    setUsingSample(false);
  };
  const addMetric = () => {
    setInputs((prev) => ({
      ...prev,
      keyMetrics: [...prev.keyMetrics, { label: "", value: "" }],
    }));
    setUsingSample(false);
  };
  const removeMetric = (i: number) => {
    setInputs((prev) => ({
      ...prev,
      keyMetrics: prev.keyMetrics.filter((_, idx) => idx !== i),
    }));
    setUsingSample(false);
  };

  const updateRisk = (i: number, patch: Partial<RiskFlag>) => {
    setInputs((prev) => ({
      ...prev,
      risks: prev.risks.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    }));
    setUsingSample(false);
  };
  const addRisk = () => {
    setInputs((prev) => ({
      ...prev,
      risks: [...prev.risks, { severity: "MEDIUM", label: "", description: "" }],
    }));
    setUsingSample(false);
  };
  const removeRisk = (i: number) => {
    setInputs((prev) => ({
      ...prev,
      risks: prev.risks.filter((_, idx) => idx !== i),
    }));
    setUsingSample(false);
  };

  const updateQuestion = (i: number, patch: Partial<OpenQuestion>) => {
    setInputs((prev) => ({
      ...prev,
      openQuestions: prev.openQuestions.map((q, idx) =>
        idx === i ? { ...q, ...patch } : q,
      ),
    }));
    setUsingSample(false);
  };
  const addQuestion = () => {
    setInputs((prev) => ({
      ...prev,
      openQuestions: [...prev.openQuestions, { question: "", owner: "" }],
    }));
    setUsingSample(false);
  };
  const removeQuestion = (i: number) => {
    setInputs((prev) => ({
      ...prev,
      openQuestions: prev.openQuestions.filter((_, idx) => idx !== i),
    }));
    setUsingSample(false);
  };

  const updateStep = (i: number, patch: Partial<NextStep>) => {
    setInputs((prev) => ({
      ...prev,
      nextSteps: prev.nextSteps.map((s, idx) =>
        idx === i ? { ...s, ...patch } : s,
      ),
    }));
    setUsingSample(false);
  };
  const addStep = () => {
    setInputs((prev) => ({
      ...prev,
      nextSteps: [...prev.nextSteps, { step: "", owner: "", due: "" }],
    }));
    setUsingSample(false);
  };
  const removeStep = (i: number) => {
    setInputs((prev) => ({
      ...prev,
      nextSteps: prev.nextSteps.filter((_, idx) => idx !== i),
    }));
    setUsingSample(false);
  };

  const loadSample = () => {
    setInputs(SAMPLE_INPUTS);
    setUsingSample(true);
  };
  const clearAll = () => {
    setInputs(defaultCompCommitteeMemoInputs());
    setUsingSample(false);
  };

  const copyMemo = async () => {
    try {
      await navigator.clipboard.writeText(memo.markdown);
      setMemoCopied(true);
      setTimeout(() => setMemoCopied(false), 2000);
    } catch {
      // ignore
    }
  };
  const downloadMemo = () =>
    triggerDownload(memo.markdown, "comp-committee-memo.md", "text/markdown");

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
        style={{ color: "var(--muted)" }}
      >
        <ProvChip>Client-side only · no upload</ProvChip>
        <ProvChip>Deterministic templating · no AI</ProvChip>
        <ProvChip>Memo assembly tool · not legal advice</ProvChip>
      </div>

      <SampleClearBanner
        usingSample={usingSample}
        sampleMessage="Showing the sample comp committee pre-read. Edit any field to start working with your own, or clear to a blank slate."
        editingMessage="Editing your own pre-read. Sample is one click away if you want to see what the output looks like."
        onLoadSample={loadSample}
        onClearAll={clearAll}
      />

      <CardSection title="How to use this in a meeting cycle">
        <ol
          className="grid grid-cols-1 gap-2 text-sm leading-6 sm:grid-cols-2 lg:grid-cols-5"
          style={{ color: "var(--muted)" }}
        >
          <HowToStep
            n={1}
            title="Set the meeting context"
            body="Meeting date, company stage, topic, requested action (inform / discuss / approve)."
          />
          <HowToStep
            n={2}
            title="Paste analysis sections"
            body="Drop in the markdown summaries from the workbench tools (refresh sizing, plan health, ASC 718, etc.). Each summary becomes a sub-section under Analysis."
          />
          <HowToStep
            n={3}
            title="Add key metrics"
            body="A short table that reads at a glance. Three to seven rows is the right size for a board pre-read."
          />
          <HowToStep
            n={4}
            title="Capture risks + questions + steps"
            body="Risks (with severity), open questions (with owner), recommended next steps (with owner + due). The committee uses these to drive the conversation."
          />
          <HowToStep
            n={5}
            title="Export"
            body="Copy the markdown into your secretary template, or download the .md and convert to PDF / Google Doc."
          />
        </ol>
      </CardSection>

      <details
        className="rounded-md border p-4"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <summary
          className="cursor-pointer text-sm font-medium"
          style={{ color: "var(--accent)" }}
        >
          What this tool is, and what it isn&rsquo;t
        </summary>
        <div
          className="mt-3 grid gap-4 text-sm leading-6 md:grid-cols-2"
          style={{ color: "var(--muted)" }}
        >
          <Disclosure
            heading="Memo assembly only"
            body="Deterministic markdown template. The user supplies every word; the tool only orders the sections, escapes table cells, and renders the headers and disclaimer."
          />
          <Disclosure
            heading="Not legal advice"
            body="Comp committee charters, plan documents, listing rules, and securities law control any actual board action. The tool is a faster pre-read, not a replacement for the company secretary or counsel."
          />
          <Disclosure
            heading="No AI in the path"
            body="The memo body is concatenated from your inputs. No LLM rewrites; nothing leaves the browser tab."
          />
          <Disclosure
            heading="Pairs with the rest of the workbench"
            body="Paste the markdown memos from Refresh Sizing, Plan Health, ASC 718, Plan Amendment, etc. as analysis sections. The committee gets the underlying math + the assembled committee narrative in one place."
          />
        </div>
      </details>

      <CardSection title="Meeting context">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Meeting date">
            <DateInput
              value={inputs.meetingDate}
              onChange={(v) => update("meetingDate", v)}
            />
          </Field>
          <Field label="Company name (optional)">
            <TextInput
              value={inputs.companyName ?? ""}
              onChange={(v) => update("companyName", v)}
            />
          </Field>
          <Field label="Memo title (optional)">
            <TextInput
              value={inputs.title ?? ""}
              onChange={(v) => update("title", v)}
            />
          </Field>
          <Field label="Company stage">
            <select
              value={inputs.companyStage}
              onChange={(e) =>
                update("companyStage", e.target.value as CompanyStage)
              }
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
              }}
            >
              {(Object.entries(STAGE_LABEL) as Array<
                [CompanyStage, string]
              >).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Topic">
            <select
              value={inputs.topic}
              onChange={(e) => update("topic", e.target.value as MemoTopic)}
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
              }}
            >
              {(Object.entries(TOPIC_LABEL) as Array<[MemoTopic, string]>).map(
                ([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Requested committee action">
            <select
              value={inputs.requestedAction}
              onChange={(e) =>
                update("requestedAction", e.target.value as CommitteeAction)
              }
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
              }}
            >
              {(Object.entries(ACTION_LABEL) as Array<
                [CommitteeAction, string]
              >).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </CardSection>

      <CardSection title="Executive summary (optional)">
        <textarea
          value={inputs.executiveNote ?? ""}
          onChange={(e) => update("executiveNote", e.target.value)}
          rows={4}
          placeholder="One paragraph from the head of TR / CHRO. The committee reads this first."
          className="block w-full rounded-md border px-3 py-2 text-sm leading-6"
          style={{
            borderColor: "var(--line)",
            background: "var(--bg-alt)",
            color: "var(--text)",
            fontFamily: "var(--font-sans)",
          }}
        />
      </CardSection>

      <CardSection
        title="Analysis sections"
        hint="Paste markdown summaries from the underlying workbench tools. Each section keeps its heading and body verbatim."
      >
        <div className="space-y-3">
          {inputs.pastedSummaries.length === 0 && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No analysis sections yet.
            </p>
          )}
          {inputs.pastedSummaries.map((s, i) => (
            <div
              key={i}
              className="rounded-md border p-3"
              style={{ borderColor: "var(--line)", background: "var(--bg-alt)" }}
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={s.heading}
                  onChange={(e) => updateSummary(i, { heading: e.target.value })}
                  placeholder="Section heading"
                  className="block w-full rounded-md border px-3 py-1.5 text-sm"
                  style={{
                    borderColor: "var(--line)",
                    background: "var(--surface)",
                    color: "var(--text)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeSummary(i)}
                  aria-label={`Remove section ${i + 1}`}
                  className="text-xs"
                  style={{ color: "var(--muted)" }}
                >
                  ×
                </button>
              </div>
              <textarea
                value={s.body}
                onChange={(e) => updateSummary(i, { body: e.target.value })}
                rows={6}
                placeholder="Paste markdown body (bullets, lists, tables — preserved verbatim)."
                className="mt-2 block w-full rounded-md border px-3 py-2 text-xs leading-5"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  fontFamily: "var(--font-mono)",
                }}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addSummary}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            + Add section
          </button>
        </div>
      </CardSection>

      <CardSection title="Key metrics" hint="3–7 rows reads cleanly in a pre-read.">
        <div className="space-y-2">
          {inputs.keyMetrics.length === 0 && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No key metrics yet.
            </p>
          )}
          {inputs.keyMetrics.map((m, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                type="text"
                value={m.label}
                onChange={(e) => updateMetric(i, { label: e.target.value })}
                placeholder="Label"
                className="block w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg-alt)",
                  color: "var(--text)",
                }}
              />
              <input
                type="text"
                value={m.value}
                onChange={(e) => updateMetric(i, { value: e.target.value })}
                placeholder="Value"
                className="block w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg-alt)",
                  color: "var(--text)",
                  fontFamily: "var(--font-mono)",
                }}
              />
              <button
                type="button"
                onClick={() => removeMetric(i)}
                aria-label={`Remove metric ${i + 1}`}
                className="rounded px-2 text-xs"
                style={{ color: "var(--muted)" }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addMetric}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            + Add metric
          </button>
        </div>
      </CardSection>

      <CardSection title="Risks">
        <div className="space-y-2">
          {inputs.risks.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr_auto]"
            >
              <select
                value={r.severity}
                onChange={(e) =>
                  updateRisk(i, {
                    severity: e.target.value as RiskFlag["severity"],
                  })
                }
                className="block w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg-alt)",
                  color: "var(--text)",
                }}
              >
                {(Object.entries(SEVERITY_LABEL) as Array<
                  [RiskFlag["severity"], string]
                >).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-1 gap-1">
                <input
                  type="text"
                  value={r.label}
                  onChange={(e) => updateRisk(i, { label: e.target.value })}
                  placeholder="Risk title"
                  className="block w-full rounded-md border px-3 py-1.5 text-sm"
                  style={{
                    borderColor: "var(--line)",
                    background: "var(--bg-alt)",
                    color: "var(--text)",
                  }}
                />
                <input
                  type="text"
                  value={r.description}
                  onChange={(e) =>
                    updateRisk(i, { description: e.target.value })
                  }
                  placeholder="Detail"
                  className="block w-full rounded-md border px-3 py-1.5 text-xs"
                  style={{
                    borderColor: "var(--line)",
                    background: "var(--bg-alt)",
                    color: "var(--text)",
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRisk(i)}
                aria-label={`Remove risk ${i + 1}`}
                className="rounded px-2 text-xs"
                style={{ color: "var(--muted)" }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRisk}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            + Add risk
          </button>
        </div>
      </CardSection>

      <CardSection title="Open questions">
        <div className="space-y-2">
          {inputs.openQuestions.map((q, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px_auto]">
              <input
                type="text"
                value={q.question}
                onChange={(e) =>
                  updateQuestion(i, { question: e.target.value })
                }
                placeholder="Question"
                className="block w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg-alt)",
                  color: "var(--text)",
                }}
              />
              <input
                type="text"
                value={q.owner ?? ""}
                onChange={(e) => updateQuestion(i, { owner: e.target.value })}
                placeholder="Owner"
                className="block w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg-alt)",
                  color: "var(--text)",
                }}
              />
              <button
                type="button"
                onClick={() => removeQuestion(i)}
                aria-label={`Remove question ${i + 1}`}
                className="rounded px-2 text-xs"
                style={{ color: "var(--muted)" }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addQuestion}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            + Add question
          </button>
        </div>
      </CardSection>

      <CardSection title="Recommended next steps">
        <div className="space-y-2">
          {inputs.nextSteps.map((s, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px_140px_auto]">
              <input
                type="text"
                value={s.step}
                onChange={(e) => updateStep(i, { step: e.target.value })}
                placeholder="Next step"
                className="block w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg-alt)",
                  color: "var(--text)",
                }}
              />
              <input
                type="text"
                value={s.owner ?? ""}
                onChange={(e) => updateStep(i, { owner: e.target.value })}
                placeholder="Owner"
                className="block w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg-alt)",
                  color: "var(--text)",
                }}
              />
              <input
                type="text"
                value={s.due ?? ""}
                onChange={(e) => updateStep(i, { due: e.target.value })}
                placeholder="Due (free text)"
                className="block w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg-alt)",
                  color: "var(--text)",
                }}
              />
              <button
                type="button"
                onClick={() => removeStep(i)}
                aria-label={`Remove next step ${i + 1}`}
                className="rounded px-2 text-xs"
                style={{ color: "var(--muted)" }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addStep}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            + Add next step
          </button>
        </div>
      </CardSection>

      {memo.exceptions.length > 0 && (
        <CardSection title="Validation flags">
          <ul
            className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2"
            style={{ color: "var(--muted)" }}
          >
            {memo.exceptions.map((e, i) => (
              <li
                key={i}
                className="rounded-md border-l-4 px-3 py-1.5"
                style={{
                  borderColor: "var(--line)",
                  borderLeftColor: "var(--amber)",
                  background: "var(--bg-alt)",
                }}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--amber)" }}
                >
                  {EXCEPTION_LABEL[e.type]}
                </span>
                <p className="mt-1 text-xs leading-5">{e.message}</p>
              </li>
            ))}
          </ul>
        </CardSection>
      )}

      <CardSection
        title="Memo preview"
        hint="Plain markdown. Drop into your secretary template, paste into Google Docs / Notion, or save as .md for conversion to PDF."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={copyMemo}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              background: memoCopied ? "var(--accent-soft)" : "var(--surface-alt)",
              color: memoCopied ? "var(--accent)" : "var(--text)",
            }}
          >
            {memoCopied ? "Copied" : "Copy memo"}
          </button>
          <button
            type="button"
            onClick={downloadMemo}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            Download memo (.md)
          </button>
        </div>
        <pre
          className="mt-3 whitespace-pre-wrap break-words rounded-md border p-4 text-[12.5px] leading-6"
          style={{
            borderColor: "var(--line)",
            background: "var(--bg-alt)",
            color: "var(--text)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {memo.markdown}
        </pre>
      </CardSection>

      <p className="text-xs italic leading-6" style={{ color: "var(--muted)" }}>
        Memo assembly tool. Not legal, accounting, or financial advice. The
        plan document, comp committee charter, listing-rule restrictions,
        ASC 718 accounting policy, and qualified counsel control any
        committee action.
      </p>
    </div>
  );
}
