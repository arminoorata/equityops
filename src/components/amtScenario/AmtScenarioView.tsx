"use client";

import { useMemo, useRef, useState } from "react";
import {
  CardSection,
  CellInput,
  DateInput,
  DollarInput,
  Disclosure,
  Field,
  FlagChip,
  HowToStep,
  Metric,
  NumberInput,
  ProvChip,
  SampleClearBanner,
  TextInput,
  Th,
  formatUSD,
  triggerDownload,
  type FlagTone,
} from "@/components/workbench";
import {
  analyzeAmt,
  composeAmtMemo,
  defaultAmtAssumptions,
  defaultAmtSettings,
  EXCEPTION_LABEL,
  FILING_STATUS_EXEMPTION_DEFAULTS,
  FILING_STATUS_LABEL,
  FILING_STATUS_AMT_BRACKET_BREAKPOINT_DEFAULTS,
  FILING_STATUS_PHASEOUT_START_DEFAULTS,
  rowsToCsv,
  type AmtAssumptions,
  type AmtException,
  type AmtSettings,
  type FilingStatus,
  type IsoGrantRow,
} from "@/lib/amtScenario";
import {
  AMT_CSV_TEMPLATE,
  importAmtCsv,
} from "@/lib/amtScenarioCsv";
import {
  SAMPLE_ISO_GRANTS,
  sampleAmtAssumptions,
  sampleAmtSettings,
} from "@/lib/sampleAmtScenario";

export default function AmtScenarioView() {
  const [grants, setGrants] = useState<IsoGrantRow[]>(SAMPLE_ISO_GRANTS);
  const [assumptions, setAssumptions] = useState<AmtAssumptions>(
    sampleAmtAssumptions(),
  );
  const [settings, setSettings] = useState<AmtSettings>(sampleAmtSettings());
  const [usingSample, setUsingSample] = useState(true);
  const [csvText, setCsvText] = useState("");
  const [memoCopied, setMemoCopied] = useState(false);
  const [csvCopied, setCsvCopied] = useState(false);
  const [importMessage, setImportMessage] = useState<{
    kind: "ok" | "error";
    text: string;
    unmapped?: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analysis = useMemo(
    () => analyzeAmt(grants, assumptions, settings),
    [grants, assumptions, settings],
  );
  const memo = useMemo(() => composeAmtMemo(analysis), [analysis]);

  const updateGrant = (rowId: string, patch: Partial<IsoGrantRow>) => {
    setGrants((prev) =>
      prev.map((g) => (g.rowId === rowId ? { ...g, ...patch } : g)),
    );
    setUsingSample(false);
  };
  const removeGrant = (rowId: string) => {
    setGrants((prev) => prev.filter((g) => g.rowId !== rowId));
    setUsingSample(false);
  };
  const addGrant = () => {
    const id = `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setGrants((prev) => [
      ...prev,
      {
        rowId: id,
        grantId: "",
        grantDate: "",
        sharesExercisable: 0,
        strike: 0,
        currentFmv: assumptions.salePricePerShare ?? 50,
        proposedExerciseShares: 0,
      },
    ]);
    setUsingSample(false);
  };

  const updateAssumption = <K extends keyof AmtAssumptions>(
    key: K,
    value: AmtAssumptions[K],
  ) => {
    setAssumptions((prev) => ({ ...prev, [key]: value }));
    setUsingSample(false);
  };

  const updateSetting = <K extends keyof AmtSettings>(
    key: K,
    value: AmtSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setUsingSample(false);
  };

  const setFilingStatus = (status: FilingStatus) => {
    setAssumptions((prev) => ({
      ...prev,
      filingStatus: status,
      amtExemption: FILING_STATUS_EXEMPTION_DEFAULTS[status],
      exemptionPhaseoutStart: FILING_STATUS_PHASEOUT_START_DEFAULTS[status],
      amtBracketBreakpoint:
        FILING_STATUS_AMT_BRACKET_BREAKPOINT_DEFAULTS[status],
    }));
    setUsingSample(false);
  };

  const loadSample = () => {
    setGrants(SAMPLE_ISO_GRANTS);
    setAssumptions(sampleAmtAssumptions());
    setSettings(sampleAmtSettings());
    setUsingSample(true);
    setCsvText("");
    setImportMessage(null);
  };
  const clearAll = () => {
    setGrants([]);
    setAssumptions(defaultAmtAssumptions());
    setSettings(defaultAmtSettings());
    setUsingSample(false);
    setCsvText("");
    setImportMessage(null);
  };

  const handleImport = (text: string) => {
    if (!text.trim()) {
      setImportMessage({ kind: "error", text: "No CSV content to import." });
      return;
    }
    const result = importAmtCsv(text);
    if (result.errors.length > 0 && result.rows.length === 0) {
      setImportMessage({
        kind: "error",
        text: result.errors.join(" "),
        unmapped: result.unmappedHeaders,
      });
      return;
    }
    setGrants(result.rows);
    setUsingSample(false);
    setImportMessage({
      kind: "ok",
      text: `Imported ${result.rows.length} row${result.rows.length === 1 ? "" : "s"}${
        result.errors.length > 0
          ? `. ${result.errors.length} skipped: ${result.errors[0]}`
          : ""
      }`,
      unmapped: result.unmappedHeaders,
    });
  };

  const handleFile = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      setImportMessage({
        kind: "error",
        text: "File is over 4 MB. Try a smaller export or paste the CSV inline.",
      });
      return;
    }
    try {
      const text = await file.text();
      handleImport(text);
    } catch {
      setImportMessage({
        kind: "error",
        text: "Could not read that file. Try opening it in a text editor and pasting instead.",
      });
    }
  };

  const downloadTemplate = () => {
    triggerDownload(AMT_CSV_TEMPLATE, "amt-scenario-template.csv", "text/csv");
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
  const downloadMemo = () => triggerDownload(memo, "amt-scenario-memo.md", "text/markdown");
  const copyResultsCsv = async () => {
    try {
      await navigator.clipboard.writeText(rowsToCsv(analysis.rows));
      setCsvCopied(true);
      setTimeout(() => setCsvCopied(false), 2000);
    } catch {
      // ignore
    }
  };
  const downloadResultsCsv = () =>
    triggerDownload(rowsToCsv(analysis.rows), "amt-scenario-results.csv", "text/csv");

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
        style={{ color: "var(--muted)" }}
      >
        <ProvChip>Client-side only · no upload</ProvChip>
        <ProvChip>Deterministic engine · no AI in calc</ProvChip>
        <ProvChip>Planning model</ProvChip>
        <ProvChip tone="amber">Not tax advice · qualified advisor required</ProvChip>
      </div>

      <SampleClearBanner
        usingSample={usingSample}
        sampleMessage="Showing the sample ISO scenario. Edit any field to start working with your own, or clear to a blank slate."
        editingMessage="Editing your own scenario. Sample is one click away if you want to see what the output looks like."
        onLoadSample={loadSample}
        onClearAll={clearAll}
      />

      <CardSection title="How to use this in an exercise conversation">
        <ol
          className="grid grid-cols-1 gap-2 text-sm leading-6 sm:grid-cols-2 lg:grid-cols-5"
          style={{ color: "var(--muted)" }}
        >
          <HowToStep
            n={1}
            title="Pull ISO grants"
            body="Export ISO grants outstanding (or paste manually). Each row carries strike, current FMV, exercisable shares, and the proposed exercise count."
          />
          <HowToStep
            n={2}
            title="Set assumptions"
            body="Confirm filing status, AMT exemption, phaseout start, bracket breakpoint, regular-tax slider, and ordinary income estimate. The defaults are editable; the engine never invents numbers."
          />
          <HowToStep
            n={3}
            title="Read the math"
            body="Walk regular tax vs tentative minimum tax. The exposure number is the planning-grade gap a qualified tax advisor will validate."
          />
          <HowToStep
            n={4}
            title="Test breakeven"
            body="The breakeven figure is a planning-grade share count below which AMT exposure stays at $0 under the same assumption set."
          />
          <HowToStep
            n={5}
            title="Hand off"
            body="Take the assumption sheet + memo to a qualified tax advisor. The model is the conversation starter, not the filing decision."
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
            heading="Planning model, not tax advice"
            body="Engine math is deterministic. The output is a starting point for a conversation between the equity holder, TR, and a qualified tax advisor. It is not a filing recommendation."
          />
          <Disclosure
            heading="Not a complete tax projection"
            body="State tax is not modeled. AMT credit carryforward is not modeled. Capital gains tax on a subsequent sale is not modeled beyond the optional sale-spread view."
          />
          <Disclosure
            heading="Editable assumptions"
            body="Exemption, phaseout, bracket breakpoint, rates, and the regular-tax planning slider are all editable. Confirm against the latest IRS guidance before relying on the output."
          />
          <Disclosure
            heading="Client-side only"
            body="Inputs stay in this browser tab and are gone the moment you close it. Nothing is uploaded."
          />
        </div>
      </details>

      <CardSection
        title="ISO grants"
        hint="Manual entry or paste/upload an ISO grants outstanding worksheet."
        sourceHint="Strike, Grant Date, Shares Exercisable, Current FMV: Fidelity / Shareworks (Morgan Stanley) / Computershare / E*TRADE / Carta options outstanding export. Proposed Exercise Shares: planning input from the holder + TR partner. Required column on import: Strike."
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={addGrant}
            className="rounded-full px-3 py-1.5 font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            + Add grant
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full px-3 py-1.5 font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            Upload CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-full px-3 py-1.5 font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            Download CSV template
          </button>
        </div>

        <details
          className="rounded-md border p-3"
          style={{ borderColor: "var(--line)", background: "var(--bg-alt)" }}
        >
          <summary
            className="cursor-pointer text-xs font-medium"
            style={{ color: "var(--accent)" }}
          >
            Or paste CSV inline
          </summary>
          <div className="mt-2 space-y-2">
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={6}
              placeholder="Paste your ISO grants outstanding CSV here…"
              className="block w-full rounded-md border px-3 py-2 text-xs"
              style={{
                borderColor: "var(--line)",
                background: "var(--surface)",
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
              }}
            />
            <button
              type="button"
              onClick={() => handleImport(csvText)}
              className="rounded-full px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--accent)", color: "var(--bg)" }}
            >
              Import pasted CSV
            </button>
          </div>
        </details>

        {importMessage && (
          <div
            className="rounded-md border-l-4 px-3 py-2 text-xs leading-5"
            style={{
              borderColor:
                importMessage.kind === "ok" ? "var(--accent)" : "var(--red, #d05a5a)",
              borderLeftColor:
                importMessage.kind === "ok" ? "var(--accent)" : "var(--red, #d05a5a)",
              borderLeftWidth: 4,
              background: "var(--surface)",
              color: "var(--muted)",
            }}
            role="status"
          >
            <p>{importMessage.text}</p>
            {importMessage.unmapped && importMessage.unmapped.length > 0 && (
              <p className="mt-1">
                Unmapped headers (ignored):{" "}
                <span className="font-mono">
                  {importMessage.unmapped.join(", ")}
                </span>
              </p>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs" style={{ color: "var(--text)" }}>
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: "var(--line)", color: "var(--muted)" }}
              >
                <Th>Grant ID</Th>
                <Th>Grant date</Th>
                <Th align="right">Exercisable</Th>
                <Th align="right">Strike</Th>
                <Th align="right">Current FMV</Th>
                <Th align="right">Proposed</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {grants.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-3 text-center text-[11px]"
                    style={{ color: "var(--muted)" }}
                  >
                    No grants yet. Use Add grant, Upload CSV, or Load sample.
                  </td>
                </tr>
              ) : (
                grants.map((g) => (
                  <tr
                    key={g.rowId}
                    className="border-b"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={g.grantId ?? ""}
                        onChange={(v) =>
                          updateGrant(g.rowId, { grantId: v || undefined })
                        }
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={g.grantDate ?? ""}
                        onChange={(v) =>
                          updateGrant(g.rowId, { grantDate: v || undefined })
                        }
                        placeholder="YYYY-MM-DD"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={String(g.sharesExercisable)}
                        onChange={(v) =>
                          updateGrant(g.rowId, {
                            sharesExercisable: parseInt_(v),
                          })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={String(g.strike)}
                        onChange={(v) =>
                          updateGrant(g.rowId, { strike: parseDecimal(v) })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={String(g.currentFmv)}
                        onChange={(v) =>
                          updateGrant(g.rowId, { currentFmv: parseDecimal(v) })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={String(g.proposedExerciseShares)}
                        onChange={(v) =>
                          updateGrant(g.rowId, {
                            proposedExerciseShares: parseInt_(v),
                          })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => removeGrant(g.rowId)}
                        aria-label={`Remove ${g.grantId || g.rowId}`}
                        className="text-xs"
                        style={{ color: "var(--muted)" }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardSection>

      <CardSection
        title="Tax assumptions"
        hint="Editable defaults. Confirm exemption / phaseout against the latest IRS guidance for the year you are modeling."
        sourceHint="AMT exemption + phaseout start: latest IRS Publication 17 / Form 6251 guidance for the year. Bracket breakpoint and rates: same source. Effective regular tax rate: planning-grade slider; for accuracy use the holder's actual projection. Ordinary income estimate: W-2-style total minus the ISO bargain element (the engine adds the bargain back)."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Filing status">
            <select
              value={assumptions.filingStatus}
              onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
              }}
            >
              {(Object.entries(FILING_STATUS_LABEL) as Array<
                [FilingStatus, string]
              >).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="AMT exemption (USD)">
            <DollarInput
              value={assumptions.amtExemption}
              onChange={(n) => updateAssumption("amtExemption", n)}
            />
          </Field>
          <Field label="Exemption phaseout start (USD)">
            <DollarInput
              value={assumptions.exemptionPhaseoutStart}
              onChange={(n) => updateAssumption("exemptionPhaseoutStart", n)}
            />
          </Field>
          <Field label="Phaseout rate (decimal)">
            <NumberInput
              value={assumptions.exemptionPhaseoutRate}
              onChange={(n) => updateAssumption("exemptionPhaseoutRate", n)}
              allowDecimal
            />
          </Field>
          <Field label="Bracket breakpoint (USD)">
            <DollarInput
              value={assumptions.amtBracketBreakpoint}
              onChange={(n) => updateAssumption("amtBracketBreakpoint", n)}
            />
          </Field>
          <Field label="AMT low rate (decimal)">
            <NumberInput
              value={assumptions.amtRateLow}
              onChange={(n) => updateAssumption("amtRateLow", n)}
              allowDecimal
            />
          </Field>
          <Field label="AMT high rate (decimal)">
            <NumberInput
              value={assumptions.amtRateHigh}
              onChange={(n) => updateAssumption("amtRateHigh", n)}
              allowDecimal
            />
          </Field>
          <Field label="Effective regular tax rate (decimal)">
            <NumberInput
              value={assumptions.effectiveRegularRate}
              onChange={(n) => updateAssumption("effectiveRegularRate", n)}
              allowDecimal
            />
          </Field>
          <Field label="Ordinary income estimate (USD)">
            <DollarInput
              value={assumptions.ordinaryIncomeEstimate}
              onChange={(n) => updateAssumption("ordinaryIncomeEstimate", n)}
            />
          </Field>
          <Field label="Sale price per share (optional, USD)">
            <DollarInput
              value={assumptions.salePricePerShare ?? 0}
              onChange={(n) =>
                updateAssumption("salePricePerShare", n === 0 ? undefined : n)
              }
              allowDecimal
            />
          </Field>
          <Field label="Holding period note">
            <TextInput
              value={assumptions.holdingPeriodNote ?? ""}
              onChange={(v) =>
                updateAssumption("holdingPeriodNote", v || undefined)
              }
            />
          </Field>
          <Field label="State tax note">
            <TextInput
              value={assumptions.stateTaxNote ?? ""}
              onChange={(v) =>
                updateAssumption("stateTaxNote", v || undefined)
              }
            />
          </Field>
        </div>
      </CardSection>

      <CardSection title="FMV and stale-data settings">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="As-of date">
            <DateInput
              value={settings.asOfDate ?? ""}
              onChange={(v) => updateSetting("asOfDate", v || undefined)}
            />
          </Field>
          <Field label="FMV as-of date">
            <DateInput
              value={settings.fmvAsOfDate ?? ""}
              onChange={(v) => updateSetting("fmvAsOfDate", v || undefined)}
            />
          </Field>
          <Field label="Stale FMV threshold (days)">
            <NumberInput
              value={settings.staleFmvThresholdDays}
              onChange={(n) => updateSetting("staleFmvThresholdDays", n)}
            />
          </Field>
        </div>
      </CardSection>

      <CardSection title="Headline computation">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Metric
            label="Proposed shares"
            value={analysis.totals.proposedExerciseShares.toLocaleString()}
          />
          <Metric
            label="Total exercise cost"
            value={formatUSD(analysis.totals.totalExerciseCost)}
          />
          <Metric
            label="Total bargain element"
            value={formatUSD(analysis.totals.totalBargainElement)}
          />
          <Metric
            label="AMT exposure"
            value={formatUSD(analysis.computation.amtExposure)}
          />
          <Metric
            label="Tentative minimum tax"
            value={formatUSD(analysis.computation.tentativeMinimumTax)}
          />
          <Metric
            label="Regular tax estimate"
            value={formatUSD(analysis.computation.regularTaxEstimate)}
          />
          <Metric
            label="Exemption after phaseout"
            value={formatUSD(analysis.computation.exemptionAfterPhaseout)}
          />
          <Metric
            label="Breakeven shares"
            value={analysis.computation.breakevenExerciseShares.toLocaleString()}
          />
        </div>
        <p
          className="mt-3 text-[11px] leading-5"
          style={{ color: "var(--muted)" }}
        >
          {analysis.computation.breakevenNote}
        </p>
      </CardSection>

      {analysis.saleScenario && (
        <CardSection title="Sale scenario (optional)">
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
            <Metric
              label="Sale price per share"
              value={formatUSD(analysis.saleScenario.salePricePerShare)}
            />
            <Metric
              label="Sale spread vs FMV"
              value={formatUSD(analysis.saleScenario.saleSpreadValue)}
            />
            <Metric
              label="Liquidity needed for AMT"
              value={formatUSD(analysis.saleScenario.cashLiquidityForAmt)}
            />
          </div>
          <p
            className="mt-3 text-[11px] leading-5"
            style={{ color: "var(--muted)" }}
          >
            {analysis.saleScenario.note}
          </p>
        </CardSection>
      )}

      {analysis.exceptions.length > 0 && (
        <CardSection title="Flags">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <FlagChip tone={tone}>{EXCEPTION_LABEL[e.type]}</FlagChip>
                    {e.rowId && (
                      <span
                        className="font-mono text-[10px]"
                        style={{ color: "var(--muted)" }}
                      >
                        {e.rowId}
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-1 text-xs leading-5"
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
        title="Planning memo"
        hint="Plain markdown. Take this + the assumption sheet to a qualified tax advisor; do not file from this output."
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
            onClick={copyResultsCsv}
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
            onClick={downloadResultsCsv}
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
        Educational planning model. Not legal, tax, accounting, or financial
        advice. State tax not modeled. AMT credit carryforward not modeled.
        The employee needs a qualified tax advisor for any actual filing
        decision.
      </p>
    </div>
  );
}

function exceptionTone(type: AmtException): FlagTone {
  switch (type) {
    case "MISSING_STRIKE":
    case "EXERCISE_EXCEEDS_EXERCISABLE":
    case "UNSUPPORTED_ASSUMPTION":
      return "red";
    case "MISSING_FMV":
    case "STALE_FMV":
    case "ZERO_PROPOSED_SHARES":
      return "amber";
  }
}

function parseInt_(v: string): number {
  const cleaned = v.replace(/[^\d]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDecimal(v: string): number {
  const cleaned = v.replace(/[^\d.]/g, "");
  if (!cleaned || cleaned === ".") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
