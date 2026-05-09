"use client";

import { useMemo, useRef, useState } from "react";
import {
  CardSection,
  CellInput,
  DateInput,
  Disclosure,
  Field,
  FlagChip,
  HowToStep,
  Metric,
  NumberInput,
  ProvChip,
  SampleClearBanner,
  Th,
  formatUSD,
  triggerDownload,
  type FlagTone,
} from "@/components/workbench";
import {
  AWARD_TYPES,
  analyzeAsc718,
  composeAsc718Memo,
  defaultAsc718Settings,
  EXCEPTION_LABEL,
  rowsToCsv,
  VESTING_PATTERN_LABEL,
  type Asc718Exception,
  type Asc718Settings,
  type AwardRow,
  type AwardType,
  type ReportingFrequency,
  type VestingPattern,
} from "@/lib/asc718Forecast";
import {
  ASC_718_CSV_TEMPLATE,
  importAsc718Csv,
} from "@/lib/asc718ForecastCsv";
import {
  SAMPLE_ASC718_AWARDS,
  sampleAsc718Settings,
} from "@/lib/sampleAsc718";

export default function Asc718ForecastView() {
  const [awards, setAwards] = useState<AwardRow[]>(SAMPLE_ASC718_AWARDS);
  const [settings, setSettings] = useState<Asc718Settings>(
    sampleAsc718Settings(),
  );
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
    () => analyzeAsc718(awards, settings),
    [awards, settings],
  );
  const memo = useMemo(() => composeAsc718Memo(analysis), [analysis]);

  const updateAward = (rowId: string, patch: Partial<AwardRow>) => {
    setAwards((prev) =>
      prev.map((a) => (a.rowId === rowId ? { ...a, ...patch } : a)),
    );
    setUsingSample(false);
  };
  const removeAward = (rowId: string) => {
    setAwards((prev) => prev.filter((a) => a.rowId !== rowId));
    setUsingSample(false);
  };
  const addAward = () => {
    const id = `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setAwards((prev) => [
      ...prev,
      {
        rowId: id,
        awardId: "",
        awardType: "RSU",
        grantDate: "",
        shares: 0,
        grantDateFairValue: 0,
        vestingTermYears: 4,
        vestingPattern: "STRAIGHT_LINE",
      },
    ]);
    setUsingSample(false);
  };

  const updateSetting = <K extends keyof Asc718Settings>(
    key: K,
    value: Asc718Settings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setUsingSample(false);
  };

  const loadSample = () => {
    setAwards(SAMPLE_ASC718_AWARDS);
    setSettings(sampleAsc718Settings());
    setUsingSample(true);
    setCsvText("");
    setImportMessage(null);
  };
  const clearAll = () => {
    setAwards([]);
    setSettings(defaultAsc718Settings());
    setUsingSample(false);
    setCsvText("");
    setImportMessage(null);
  };

  const handleImport = (text: string) => {
    if (!text.trim()) {
      setImportMessage({ kind: "error", text: "No CSV content to import." });
      return;
    }
    const result = importAsc718Csv(text);
    if (result.errors.length > 0 && result.rows.length === 0) {
      setImportMessage({
        kind: "error",
        text: result.errors.join(" "),
        unmapped: result.unmappedHeaders,
      });
      return;
    }
    setAwards(result.rows);
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

  const downloadTemplate = () =>
    triggerDownload(ASC_718_CSV_TEMPLATE, "asc-718-template.csv", "text/csv");

  const copyMemo = async () => {
    try {
      await navigator.clipboard.writeText(memo);
      setMemoCopied(true);
      setTimeout(() => setMemoCopied(false), 2000);
    } catch {
      // ignore
    }
  };
  const downloadMemo = () => triggerDownload(memo, "asc-718-memo.md", "text/markdown");
  const copyCsv = async () => {
    try {
      await navigator.clipboard.writeText(rowsToCsv(analysis.rows));
      setCsvCopied(true);
      setTimeout(() => setCsvCopied(false), 2000);
    } catch {
      // ignore
    }
  };
  const downloadCsv = () =>
    triggerDownload(rowsToCsv(analysis.rows), "asc-718-results.csv", "text/csv");

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
        style={{ color: "var(--muted)" }}
      >
        <ProvChip>Client-side only · no upload</ProvChip>
        <ProvChip>Deterministic engine · no AI in calc</ProvChip>
        <ProvChip>Planning forecast</ProvChip>
        <ProvChip tone="amber">Not GAAP-final · accounting policy controls</ProvChip>
      </div>

      <SampleClearBanner
        usingSample={usingSample}
        sampleMessage="Showing the sample award population. Edit any field to start working with your own data, or clear to a blank slate."
        editingMessage="Editing your own inputs. Sample population is one click away if you want to see what the output looks like."
        onLoadSample={loadSample}
        onClearAll={clearAll}
      />

      <CardSection title="How to use this in a stock-comp forecast cycle">
        <ol
          className="grid grid-cols-1 gap-2 text-sm leading-6 sm:grid-cols-2 lg:grid-cols-5"
          style={{ color: "var(--muted)" }}
        >
          <HowToStep
            n={1}
            title="Pull award population"
            body="Export awards outstanding with grant-date fair value from your stock administration platform. Add any vesting-term or service-period overrides where the company's accounting policy differs from the platform default."
          />
          <HowToStep
            n={2}
            title="Set the forecast window"
            body="Pick the period start, end, and reporting frequency (quarterly or annual). Set the default forfeiture rate per the company's true-up policy."
          />
          <HowToStep
            n={3}
            title="Read the per-period forecast"
            body="The bucketizer places straight-line awards proportionally across the period and graded awards via per-tranche accelerated attribution."
          />
          <HowToStep
            n={4}
            title="Walk exceptions"
            body="Missing fair value, missing vesting term, missing PSU probability, and inverted service period all surface as flags before the forecast is shared."
          />
          <HowToStep
            n={5}
            title="Hand off"
            body="Stock-comp accounting → finance (FY budget) → TR → external auditor for any modification or re-measurement cycle."
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
            heading="Planning forecast, not GAAP-final"
            body="The engine is directional. Modification accounting (Type I/II/III), forfeiture true-up cycles, performance-condition probability re-measurement, and market-condition Monte Carlo valuation are out of scope. Accounting policy and external auditor review control the final number."
          />
          <Disclosure
            heading="Recognition shortcut"
            body="Straight-line attributes uniformly across the service period. Graded vesting uses accelerated attribution per tranche. The company's accounting policy may use a different attribution method; the forecast is calibrated for planning, not closing."
          />
          <Disclosure
            heading="Editable assumptions"
            body="Forfeiture rate, PSU probability cap, service-period overrides, vesting pattern. Confirm against the company's accounting policy before relying on the output."
          />
          <Disclosure
            heading="Client-side only"
            body="Inputs stay in this browser tab and are gone the moment you close it. Nothing is uploaded."
          />
        </div>
      </details>

      <CardSection
        title="Awards"
        hint="Manual entry or paste/upload an awards-outstanding worksheet."
        sourceHint="Award ID, Award Type, Grant Date, Shares, Grant-Date Fair Value, Vesting Term Years, Vesting Pattern: stock administration platform export. Forfeiture Rate, Performance Probability, Service Start/End: company stock-comp accounting policy / valuation report. Required column on import: Grant Date Fair Value."
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={addAward}
            className="rounded-full px-3 py-1.5 font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            + Add award
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
              placeholder="Paste your awards-outstanding CSV here…"
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
                <Th>Award ID</Th>
                <Th>Type</Th>
                <Th>Grant date</Th>
                <Th align="right">Shares</Th>
                <Th align="right">FV/share</Th>
                <Th align="right">Term yrs</Th>
                <Th>Pattern</Th>
                <Th align="right">Forfeit</Th>
                <Th align="right">PSU prob</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {awards.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-3 text-center text-[11px]"
                    style={{ color: "var(--muted)" }}
                  >
                    No awards yet. Use Add award, Upload CSV, or Load sample.
                  </td>
                </tr>
              ) : (
                awards.map((a) => (
                  <tr
                    key={a.rowId}
                    className="border-b"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={a.awardId ?? ""}
                        onChange={(v) =>
                          updateAward(a.rowId, { awardId: v || undefined })
                        }
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={a.awardType}
                        onChange={(e) =>
                          updateAward(a.rowId, {
                            awardType: e.target.value as AwardType,
                          })
                        }
                        className="bg-transparent text-xs"
                        style={{ color: "var(--text)" }}
                      >
                        {AWARD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={a.grantDate ?? ""}
                        onChange={(v) =>
                          updateAward(a.rowId, { grantDate: v || undefined })
                        }
                        placeholder="YYYY-MM-DD"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={String(a.shares)}
                        onChange={(v) =>
                          updateAward(a.rowId, { shares: parseInt_(v) })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={String(a.grantDateFairValue)}
                        onChange={(v) =>
                          updateAward(a.rowId, {
                            grantDateFairValue: parseDecimal(v),
                          })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={String(a.vestingTermYears)}
                        onChange={(v) =>
                          updateAward(a.rowId, {
                            vestingTermYears: parseDecimal(v),
                          })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={a.vestingPattern}
                        onChange={(e) =>
                          updateAward(a.rowId, {
                            vestingPattern: e.target.value as VestingPattern,
                          })
                        }
                        className="bg-transparent text-xs"
                        style={{ color: "var(--text)" }}
                      >
                        {(Object.entries(VESTING_PATTERN_LABEL) as Array<
                          [VestingPattern, string]
                        >).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={
                          a.forfeitureRateOverride !== undefined
                            ? String(a.forfeitureRateOverride)
                            : ""
                        }
                        onChange={(v) =>
                          updateAward(a.rowId, {
                            forfeitureRateOverride:
                              v === "" ? undefined : parseDecimal(v),
                          })
                        }
                        placeholder="auto"
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={
                          a.performanceProbability !== undefined
                            ? String(a.performanceProbability)
                            : ""
                        }
                        onChange={(v) =>
                          updateAward(a.rowId, {
                            performanceProbability:
                              v === "" ? undefined : parseDecimal(v),
                          })
                        }
                        placeholder={a.awardType === "PSU" ? "1.0" : "—"}
                        align="right"
                      />
                    </td>
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => removeAward(a.rowId)}
                        aria-label={`Remove ${a.awardId || a.rowId}`}
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

      <CardSection title="Forecast settings">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Period start">
            <DateInput
              value={settings.periodStart}
              onChange={(v) => updateSetting("periodStart", v)}
            />
          </Field>
          <Field label="Period end">
            <DateInput
              value={settings.periodEnd}
              onChange={(v) => updateSetting("periodEnd", v)}
            />
          </Field>
          <Field label="Reporting frequency">
            <select
              value={settings.reportingFrequency}
              onChange={(e) =>
                updateSetting(
                  "reportingFrequency",
                  e.target.value as ReportingFrequency,
                )
              }
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
              }}
            >
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUAL">Annual</option>
            </select>
          </Field>
          <Field label="Default forfeiture rate (decimal)">
            <NumberInput
              value={settings.defaultForfeitureRate}
              onChange={(n) => updateSetting("defaultForfeitureRate", n)}
              allowDecimal
            />
          </Field>
          <Field label="Performance probability cap">
            <NumberInput
              value={settings.performanceProbabilityCap}
              onChange={(n) => updateSetting("performanceProbabilityCap", n)}
              allowDecimal
            />
          </Field>
        </div>
      </CardSection>

      <CardSection title="Headline forecast">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Metric
            label="Awards in scope"
            value={analysis.summary.awardCount.toLocaleString()}
          />
          <Metric
            label="Total expected"
            value={formatUSD(analysis.summary.totalExpectedExpense)}
          />
          <Metric
            label="Recognized in window"
            value={formatUSD(analysis.summary.totalExpenseInWindow)}
          />
          <Metric
            label="Remaining"
            value={formatUSD(analysis.summary.totalRemainingExpense)}
          />
          <Metric
            label="Rows with exceptions"
            value={analysis.summary.rowsWithExceptions.toLocaleString()}
          />
          <Metric
            label="Periods"
            value={analysis.periods.length.toLocaleString()}
          />
          <Metric
            label="Forfeiture (default)"
            value={`${(settings.defaultForfeitureRate * 100).toFixed(1)}%`}
          />
          <Metric
            label="PSU cap"
            value={settings.performanceProbabilityCap.toFixed(2)}
          />
        </div>
      </CardSection>

      <CardSection title="Forecast by period">
        {analysis.periods.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Set forecast period start + end above to populate the forecast.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="min-w-full text-xs"
              style={{ color: "var(--text)" }}
            >
              <thead>
                <tr
                  className="border-b text-left"
                  style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                >
                  <Th>Period</Th>
                  <Th>Range</Th>
                  <Th align="right">Total expense</Th>
                  {AWARD_TYPES.map((t) => (
                    <Th key={t} align="right">
                      {t}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.periods.map((p) => (
                  <tr
                    key={p.label}
                    className="border-b"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <td className="py-1.5 pr-2 font-mono">{p.label}</td>
                    <td className="py-1.5 pr-2 text-[11px]" style={{ color: "var(--muted)" }}>
                      {p.start} → {p.end}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {formatUSD(p.totalExpense)}
                    </td>
                    {AWARD_TYPES.map((t) => (
                      <td
                        key={t}
                        className="py-1.5 pr-2 text-right font-mono"
                        style={{
                          color:
                            p.byAwardType[t] > 0
                              ? "var(--text)"
                              : "var(--muted)",
                        }}
                      >
                        {p.byAwardType[t] > 0
                          ? formatUSD(p.byAwardType[t])
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardSection>

      <CardSection title="By award type / by grant year">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color: "var(--muted)" }}
            >
              By award type (total expected)
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-xs" style={{ color: "var(--text)" }}>
                <tbody>
                  {(
                    Object.entries(analysis.summary.byAwardType) as Array<
                      [AwardType, number]
                    >
                  )
                    .filter(([, n]) => n > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([t, n]) => (
                      <tr
                        key={t}
                        className="border-b"
                        style={{ borderColor: "var(--line)" }}
                      >
                        <td className="py-1.5 pr-2 font-mono">{t}</td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {formatUSD(n)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color: "var(--muted)" }}
            >
              By grant year (total expected)
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-xs" style={{ color: "var(--text)" }}>
                <tbody>
                  {analysis.summary.byGrantYear.map((y) => (
                    <tr
                      key={y.year}
                      className="border-b"
                      style={{ borderColor: "var(--line)" }}
                    >
                      <td className="py-1.5 pr-2 font-mono">{y.year}</td>
                      <td className="py-1.5 pr-2 text-right font-mono">
                        {formatUSD(y.expense)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardSection>

      {analysis.summary.rowsWithExceptions > 0 && (
        <CardSection title="Exceptions">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {(
              Object.entries(analysis.summary.countByException) as Array<
                [Asc718Exception, number]
              >
            )
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([type, n]) => {
                const tone = exceptionTone(type);
                return (
                  <div
                    key={type}
                    className="rounded-md border-l-4 p-3"
                    style={{
                      borderColor: "var(--line)",
                      borderLeftColor:
                        tone === "red" ? "var(--red)" : "var(--amber)",
                      background: "var(--bg-alt)",
                    }}
                  >
                    <FlagChip tone={tone}>{EXCEPTION_LABEL[type]}</FlagChip>
                    <p
                      className="mt-2 text-sm font-semibold"
                      style={{
                        color: "var(--text)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {n.toLocaleString()}
                    </p>
                  </div>
                );
              })}
          </div>
        </CardSection>
      )}

      <CardSection
        title="Accounting memo"
        hint="Plain markdown. Not a GAAP-final estimate; the external auditor controls the final number."
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
            {csvCopied ? "Copied" : "Copy CSV"}
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
        Educational planning forecast. Not a GAAP-final stock-comp expense
        estimate. Modification accounting, forfeiture true-up, performance-
        condition probability re-measurement, and market-condition Monte
        Carlo valuation are not modeled. Accounting policy and external
        auditor review control the final number.
      </p>
    </div>
  );
}

function exceptionTone(type: Asc718Exception): FlagTone {
  switch (type) {
    case "MISSING_FAIR_VALUE":
    case "MISSING_VESTING_TERM":
    case "INVERTED_SERVICE_PERIOD":
      return "red";
    case "ZERO_SHARES":
    case "PSU_MISSING_PROBABILITY":
    case "MISSING_GRANT_DATE":
    case "UNSUPPORTED_VESTING":
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
