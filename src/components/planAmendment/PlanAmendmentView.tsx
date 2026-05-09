"use client";

import { useMemo, useState } from "react";
import {
  CardSection,
  Disclosure,
  DollarInput,
  Field,
  FlagChip,
  HowToStep,
  Metric,
  NumberInput,
  ProvChip,
  SampleClearBanner,
  Th,
  triggerDownload,
  type FlagTone,
} from "@/components/workbench";
import {
  analyzePlanAmendment,
  composePlanAmendmentMemo,
  defaultAmendmentProposal,
  defaultCurrentPlanState,
  EXCEPTION_LABEL,
  forecastToCsv,
  SHARE_RECYCLING_LABEL,
  type PlanAmendmentException,
  type ShareRecyclingMode,
} from "@/lib/planAmendment";
import type { AmendmentProposal, CurrentPlanState } from "@/lib/planAmendment";

const SAMPLE_CURRENT: CurrentPlanState = {
  sharesOutstanding: 120_000_000,
  awardsOutstanding: 9_500_000,
  availableReserve: 3_500_000,
  annualBurnRateShares: 3_200_000,
  forecastYears: 5,
  hiringGrowthMultiplier: 1.1,
};

const SAMPLE_PROPOSAL: AmendmentProposal = {
  additionalReserveShares: 8_000_000,
  evergreenEnabled: false,
  evergreenPercent: 0,
  repricingAllowed: false,
  repricingRequiresShareholderApproval: true,
  shareRecyclingFullValue: "FORFEIT_ONLY",
  shareRecyclingOptions: "FORFEIT_ONLY",
};

export default function PlanAmendmentView() {
  const [current, setCurrent] = useState<CurrentPlanState>(SAMPLE_CURRENT);
  const [proposal, setProposal] = useState<AmendmentProposal>(SAMPLE_PROPOSAL);
  const [usingSample, setUsingSample] = useState(true);
  const [memoCopied, setMemoCopied] = useState(false);
  const [csvCopied, setCsvCopied] = useState(false);

  const analysis = useMemo(
    () => analyzePlanAmendment({ current, proposal }),
    [current, proposal],
  );
  const memo = useMemo(() => composePlanAmendmentMemo(analysis), [analysis]);
  const csv = useMemo(() => forecastToCsv(analysis.forecast), [analysis]);

  const updateCurrent = <K extends keyof CurrentPlanState>(
    key: K,
    value: CurrentPlanState[K],
  ) => {
    setCurrent((prev) => ({ ...prev, [key]: value }));
    setUsingSample(false);
  };
  const updateProposal = <K extends keyof AmendmentProposal>(
    key: K,
    value: AmendmentProposal[K],
  ) => {
    setProposal((prev) => ({ ...prev, [key]: value }));
    setUsingSample(false);
  };

  const loadSample = () => {
    setCurrent(SAMPLE_CURRENT);
    setProposal(SAMPLE_PROPOSAL);
    setUsingSample(true);
  };
  const clearAll = () => {
    setCurrent(defaultCurrentPlanState());
    setProposal(defaultAmendmentProposal());
    setUsingSample(false);
  };

  const copyMemo = async () => {
    try {
      await navigator.clipboard.writeText(memo);
      setMemoCopied(true);
      setTimeout(() => setMemoCopied(false), 2000);
    } catch {
      // ignore
    }
  };
  const downloadMemo = () => triggerDownload(memo, "plan-amendment-memo.md", "text/markdown");
  const copyCsv = async () => {
    try {
      await navigator.clipboard.writeText(csv);
      setCsvCopied(true);
      setTimeout(() => setCsvCopied(false), 2000);
    } catch {
      // ignore
    }
  };
  const downloadCsv = () =>
    triggerDownload(csv, "plan-amendment-results.csv", "text/csv");

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
        style={{ color: "var(--muted)" }}
      >
        <ProvChip>Client-side only · no upload</ProvChip>
        <ProvChip>Deterministic engine · no AI in calc</ProvChip>
        <ProvChip>ISS-aware framing · not a proxy-advisor model</ProvChip>
      </div>

      <SampleClearBanner
        usingSample={usingSample}
        sampleMessage="Showing the sample plan-amendment scenario. Edit any field to start working with your own, or clear to a blank slate."
        editingMessage="Editing your own scenario. Sample is one click away if you want to see what the output looks like."
        onLoadSample={loadSample}
        onClearAll={clearAll}
      />

      <CardSection title="How to use this in an amendment cycle">
        <ol
          className="grid grid-cols-1 gap-2 text-sm leading-6 sm:grid-cols-2 lg:grid-cols-5"
          style={{ color: "var(--muted)" }}
        >
          <HowToStep
            n={1}
            title="Snapshot the current plan"
            body="Pull shares outstanding, awards outstanding, available reserve, and recent annual burn from the stock administration platform + cap table."
          />
          <HowToStep
            n={2}
            title="Define the proposal"
            body="Additional shares, evergreen yes/no, repricing posture, share recycling rules. Each dial is a deliberate plan-design choice with investor-facing implications."
          />
          <HowToStep
            n={3}
            title="Walk before / after"
            body="Compare overhang, runway, and dilution. Read the forecast walk to see how reserve runs over the company's hiring growth scenario."
          />
          <HowToStep
            n={4}
            title="Triage flags"
            body="Investor concern flags surface high evergreen, large overhang increment, repricing without shareholder approval, asymmetric recycling, very short or very long runway."
          />
          <HowToStep
            n={5}
            title="Hand off"
            body="Comp committee → legal (listing rules) → finance (dilution + budget) → accounting (ASC 718 expense) → IR for the proxy narrative."
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
            heading="ISS-aware, not a proxy-advisor model"
            body="The engine surfaces investor concern flags using practitioner-common reference points (high evergreen, large overhang increment, repricing posture). It does not reproduce the ISS Equity Plan Scorecard or Glass Lewis pay-for-performance models. Pull the latest proxy advisor guidance for the company's stage."
          />
          <Disclosure
            heading="Deterministic math"
            body="Overhang = (awards outstanding + reserve) / shares outstanding. Runway = reserve / annual burn (net of evergreen replenishment). Dilution = cumulative burn / shares outstanding. Editable hiring growth multiplier."
          />
          <Disclosure
            heading="Not legal advice"
            body="Listing-rule analysis (NYSE / Nasdaq), shareholder-approval requirements, country-specific sub-plan implications, and plan-document drafting are out of scope. Confirm with qualified counsel."
          />
          <Disclosure
            heading="Client-side only"
            body="Inputs stay in this browser tab and are gone the moment you close it. Nothing is uploaded."
          />
        </div>
      </details>

      <CardSection
        title="Current plan snapshot"
        sourceHint="Shares outstanding: 10-K / quarterly cap-table. Awards outstanding (vested + unvested): stock administration platform export. Available reserve: stock plan ledger / 10-K equity-comp footnote. Annual burn: trailing 12 months of grants. Forecast horizon and hiring growth multiplier: TR + finance scenario."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Shares outstanding">
            <DollarInput
              value={current.sharesOutstanding}
              onChange={(n) => updateCurrent("sharesOutstanding", n)}
            />
          </Field>
          <Field label="Awards outstanding (vested + unvested)">
            <DollarInput
              value={current.awardsOutstanding}
              onChange={(n) => updateCurrent("awardsOutstanding", n)}
            />
          </Field>
          <Field label="Available reserve (current)">
            <DollarInput
              value={current.availableReserve}
              onChange={(n) => updateCurrent("availableReserve", n)}
            />
          </Field>
          <Field label="Annual burn (shares granted / yr)">
            <DollarInput
              value={current.annualBurnRateShares}
              onChange={(n) => updateCurrent("annualBurnRateShares", n)}
            />
          </Field>
          <Field label="Forecast years (1–25)">
            <NumberInput
              value={current.forecastYears}
              onChange={(n) =>
                updateCurrent("forecastYears", Math.max(1, Math.min(25, n)))
              }
            />
          </Field>
          <Field label="Hiring growth multiplier (per year)">
            <NumberInput
              value={current.hiringGrowthMultiplier}
              onChange={(n) =>
                updateCurrent("hiringGrowthMultiplier", Math.max(0, n))
              }
              allowDecimal
            />
          </Field>
        </div>
      </CardSection>

      <CardSection title="Amendment proposal">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Additional reserve shares">
            <DollarInput
              value={proposal.additionalReserveShares}
              onChange={(n) => updateProposal("additionalReserveShares", n)}
            />
          </Field>
          <Field label="Evergreen enabled">
            <select
              value={proposal.evergreenEnabled ? "yes" : "no"}
              onChange={(e) =>
                updateProposal("evergreenEnabled", e.target.value === "yes")
              }
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
              }}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field label="Evergreen % (of shares outstanding / yr)">
            <NumberInput
              value={proposal.evergreenPercent}
              onChange={(n) => updateProposal("evergreenPercent", n)}
              allowDecimal
            />
          </Field>
          <Field label="Repricing allowed under plan">
            <select
              value={proposal.repricingAllowed ? "yes" : "no"}
              onChange={(e) =>
                updateProposal("repricingAllowed", e.target.value === "yes")
              }
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
              }}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field label="Repricing requires shareholder approval">
            <select
              value={proposal.repricingRequiresShareholderApproval ? "yes" : "no"}
              onChange={(e) =>
                updateProposal(
                  "repricingRequiresShareholderApproval",
                  e.target.value === "yes",
                )
              }
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
              }}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Recycling: full-value awards (RSU/PSU/RSA)">
            <select
              value={proposal.shareRecyclingFullValue}
              onChange={(e) =>
                updateProposal(
                  "shareRecyclingFullValue",
                  e.target.value as ShareRecyclingMode,
                )
              }
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
              }}
            >
              {(Object.entries(SHARE_RECYCLING_LABEL) as Array<
                [ShareRecyclingMode, string]
              >).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Recycling: options (ISO/NSO/SAR)">
            <select
              value={proposal.shareRecyclingOptions}
              onChange={(e) =>
                updateProposal(
                  "shareRecyclingOptions",
                  e.target.value as ShareRecyclingMode,
                )
              }
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
              }}
            >
              {(Object.entries(SHARE_RECYCLING_LABEL) as Array<
                [ShareRecyclingMode, string]
              >).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </CardSection>

      <CardSection title="Before vs after">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Metric
            label="Overhang (before)"
            value={`${analysis.before.overhangPct.toFixed(2)}%`}
          />
          <Metric
            label="Overhang (after)"
            value={`${analysis.after.overhangPct.toFixed(2)}%`}
          />
          <Metric
            label="Δ overhang"
            value={`${(analysis.after.overhangPct - analysis.before.overhangPct).toFixed(2)} pp`}
          />
          <Metric
            label="Additional dilution"
            value={`${analysis.after.additionalDilutionPct.toFixed(2)}%`}
          />
          <Metric
            label="Runway (before)"
            value={formatRunway(analysis.before.runwayYears)}
          />
          <Metric
            label="Runway (after)"
            value={formatRunway(analysis.after.runwayYears)}
          />
          <Metric
            label="Annual burn %"
            value={`${analysis.before.annualBurnPct.toFixed(2)}%`}
          />
          <Metric
            label="Forecast horizon"
            value={`${analysis.inputs.current.forecastYears} yrs`}
          />
        </div>
      </CardSection>

      <CardSection title="Forecast walk">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs" style={{ color: "var(--text)" }}>
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: "var(--line)", color: "var(--muted)" }}
              >
                <Th align="right">Year</Th>
                <Th align="right">Outstanding (start)</Th>
                <Th align="right">Reserve start (after evergreen)</Th>
                <Th align="right">Annual burn</Th>
                <Th align="right">Reserve end</Th>
                <Th align="right">Cumulative dilution</Th>
              </tr>
            </thead>
            <tbody>
              {analysis.forecast.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-2 text-[11px]"
                    style={{ color: "var(--muted)" }}
                  >
                    Set forecast years above to populate the forecast.
                  </td>
                </tr>
              ) : (
                analysis.forecast.map((y) => (
                  <tr
                    key={y.year}
                    className="border-b"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <td className="py-1.5 pr-2 text-right font-mono">{y.year}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {y.sharesOutstandingStart.toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {Math.round(y.reserveStart).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {Math.round(y.annualBurn).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {Math.round(y.reserveEnd).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {y.cumulativeDilutionPct.toFixed(2)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardSection>

      {analysis.exceptions.length > 0 && (
        <CardSection
          title="Investor concern flags"
          hint="Practitioner-common thresholds. Pair with the latest ISS / Glass Lewis policy guidance for the company's stage."
        >
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {analysis.exceptions.map((e, i) => {
              const tone = exceptionTone(e.type);
              return (
                <div
                  key={i}
                  className="rounded-md border-l-4 p-3"
                  style={{
                    borderColor: "var(--line)",
                    borderLeftColor:
                      tone === "red" ? "var(--red)" : "var(--amber)",
                    background: "var(--bg-alt)",
                  }}
                >
                  <FlagChip tone={tone}>{EXCEPTION_LABEL[e.type]}</FlagChip>
                  <p
                    className="mt-2 text-xs leading-5"
                    style={{ color: "var(--muted)" }}
                  >
                    {e.message}
                  </p>
                </div>
              );
            })}
          </div>
        </CardSection>
      )}

      <CardSection
        title="Comp-committee memo"
        hint="Plain markdown. Numbered sections + before/after table + forecast table + flags + question list + handoff."
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
          <button
            type="button"
            onClick={copyCsv}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              background: csvCopied ? "var(--accent-soft)" : "var(--surface-alt)",
              color: csvCopied ? "var(--accent)" : "var(--text)",
            }}
          >
            {csvCopied ? "Copied" : "Copy results CSV"}
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            Download CSV
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
          {memo}
        </pre>
      </CardSection>

      <p className="text-xs italic leading-6" style={{ color: "var(--muted)" }}>
        Educational diagnostic. ISS-aware framing, not an ISS / Glass Lewis
        score. Not legal, accounting, or financial advice. The plan
        document, listing-rule restrictions, shareholder-approval
        requirements, and the comp committee charter control any actual
        amendment.
      </p>
    </div>
  );
}

function exceptionTone(type: PlanAmendmentException): FlagTone {
  switch (type) {
    case "INVALID_INPUT":
    case "REPRICING_WITHOUT_APPROVAL":
    case "VERY_SHORT_RUNWAY":
      return "red";
    case "HIGH_EVERGREEN":
    case "HIGH_OVERHANG_INCREMENT":
    case "ASYMMETRIC_RECYCLING":
    case "VERY_LONG_RUNWAY":
      return "amber";
  }
}

function formatRunway(y: number): string {
  if (!Number.isFinite(y)) return "∞";
  return `${y.toFixed(2)} yrs`;
}
