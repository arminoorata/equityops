"use client";

import { useMemo, useRef, useState } from "react";
import {
  AWARD_TYPES,
  analyzeGrantDistribution,
  composeDistributionMemo,
  defaultGrantSettings,
  EXCEPTION_LABEL,
  rowsToCsv,
  type AwardType,
  type DistributionBucket,
  type GrantException,
  type GrantRow,
  type GrantSettings,
  type GrantWithExceptions,
} from "@/lib/grantDistribution";
import {
  GRANT_DISTRIBUTION_CSV_TEMPLATE,
  importGrantDistributionCsv,
} from "@/lib/grantDistributionCsv";
import {
  SAMPLE_GRANTS,
  sampleGrantSettings,
} from "@/lib/sampleGrantDistribution";

/**
 * Grant Distribution Auditor view.
 *
 * Pure-functional engine in src/lib/grantDistribution.ts. No AI in
 * the audit path. Client-side only. Demographic data is sensitive;
 * the page reminds the user up top.
 */
export default function GrantDistributionView() {
  const [rows, setRows] = useState<GrantRow[]>(SAMPLE_GRANTS);
  const [settings, setSettings] = useState<GrantSettings>(sampleGrantSettings());
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
    () => analyzeGrantDistribution(rows, settings),
    [rows, settings],
  );
  const memo = useMemo(() => composeDistributionMemo(analysis), [analysis]);

  // ───────── State setters ─────────

  const updateRow = (rowId: string, patch: Partial<GrantRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)),
    );
    setUsingSample(false);
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
    setUsingSample(false);
  };

  const addRow = () => {
    const id = `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setRows((prev) => [
      ...prev,
      {
        rowId: id,
        employeeId: "",
        employeeName: "",
        level: "",
        function: "",
        country: "",
        performanceTier: "",
        grantId: "",
        awardType: "RSU",
        grantDate: "",
        shares: 0,
        fmvAtGrant: undefined,
        currentFmv: undefined,
        currentValue: undefined,
        vestingPattern: "",
      },
    ]);
    setUsingSample(false);
  };

  const updateSetting = <K extends keyof GrantSettings>(
    key: K,
    value: GrantSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setUsingSample(false);
  };

  const loadSample = () => {
    setRows(SAMPLE_GRANTS);
    setSettings(sampleGrantSettings());
    setUsingSample(true);
    setImportMessage(null);
    setCsvText("");
  };

  const clearAll = () => {
    setRows([]);
    setSettings(defaultGrantSettings());
    setUsingSample(false);
    setImportMessage(null);
    setCsvText("");
  };

  const handleImport = (text: string) => {
    if (!text.trim()) {
      setImportMessage({ kind: "error", text: "No CSV content to import." });
      return;
    }
    const result = importGrantDistributionCsv(text);
    if (result.errors.length > 0 && result.rows.length === 0) {
      setImportMessage({
        kind: "error",
        text: result.errors.join(" "),
        unmapped: result.unmappedHeaders,
      });
      return;
    }
    setRows(result.rows);
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
    triggerDownload(
      GRANT_DISTRIBUTION_CSV_TEMPLATE,
      "grant-distribution-template.csv",
      "text/csv",
    );
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

  const downloadMemo = () => {
    triggerDownload(memo, "grant-distribution-memo.md", "text/markdown");
  };

  const copyResultsCsv = async () => {
    try {
      await navigator.clipboard.writeText(rowsToCsv(analysis.rows));
      setCsvCopied(true);
      setTimeout(() => setCsvCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const downloadResultsCsv = () => {
    triggerDownload(
      rowsToCsv(analysis.rows),
      "grant-distribution-results.csv",
      "text/csv",
    );
  };

  // ───────── Render ─────────

  return (
    <div className="space-y-6">
      {/* Persistent provenance + sensitive-data reminder. */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
        style={{ color: "var(--muted)" }}
      >
        <ProvChip>Client-side only · no upload</ProvChip>
        <ProvChip>Deterministic engine · no AI in audit</ProvChip>
        <ProvChip>Not a system of record</ProvChip>
        <ProvChip tone="amber">
          Demographic fields are sensitive · optional · stay in your browser
        </ProvChip>
      </div>

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
            ? "Showing the sample grant population. Edit any field to start working with your own data, or clear to a blank slate."
            : "Editing your own inputs. Sample population is one click away if you want to see what the output looks like."}
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

      <CardSection title="How to use this in an audit cycle">
        <ol
          className="grid grid-cols-1 gap-2 text-sm leading-6 sm:grid-cols-2 lg:grid-cols-5"
          style={{ color: "var(--muted)" }}
        >
          <HowToStep
            n={1}
            title="Assemble grants + people data"
            body="Pull grants outstanding from Fidelity / Shareworks / Computershare / E*TRADE / Carta. Join with level / function / country / perf tier from Workday / SuccessFactors / Oracle HCM / Dayforce / UKG. Add optional demographic columns from your DEIB analytics partner."
          />
          <HowToStep
            n={2}
            title="Confirm settings"
            body="Set the default FMV (most recent 409A or trading-day reference), the cohort outlier multiple, the stale-grant threshold, and the concentration percentile."
          />
          <HowToStep
            n={3}
            title="Walk distributions"
            body="Review by level, function, country, grant year, award type, performance tier, and (when present) each demographic dimension. Compare against the company grant philosophy."
          />
          <HowToStep
            n={4}
            title="Triage exceptions"
            body="Walk missing-data, zero-share, stale-grant, and cohort-outlier rows. Document the rationale for any exception you decide to keep."
          />
          <HowToStep
            n={5}
            title="Hand off"
            body="TR leadership → DEIB partner (paired analysis on demographic distributions) → finance (reconciliation) → legal (privacy + plan compliance) → comp committee."
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
            heading="Deterministic, not AI"
            body="Distribution buckets, concentration math, and exception flags are computed by a rules engine in src/lib/grantDistribution.ts, unit-tested. AI is not used to decide which rows are flagged or which dimensions are surfaced."
          />
          <Disclosure
            heading="Client-side only"
            body="Your CSV is parsed in your browser. The data lives in this tab's memory for the session and is gone the moment the tab closes. Nothing is uploaded, including the demographic columns."
          />
          <Disclosure
            heading="Not a disparate-impact study"
            body="Counts and averages by cohort are a starting point for the conversation, not a substitute for paired analysis with the People / DEIB function. Take this output to the partner who can run a controlled analysis."
          />
          <Disclosure
            heading="Not a system of record"
            body="Your stock administration platform owns the source of truth. This tool sits above that. It's the audit workbench between the export and the comp committee pre-read."
          />
        </div>
      </details>

      <CardSection
        title="Settings"
        hint="Defaults a TR practitioner would set once at the start of an audit cycle."
        sourceHint="Default FMV: most recent 409A valuation (private) or trading-day reference (public). Stale-grant threshold: typically 5 years for an audit; tighten for a refresh-cycle review. Cohort outlier multiple: TR policy threshold for how far a single grant can sit above its (level, function) median before review. Concentration percentile: standard top-decile reference; can also use 0.05 (top 5%) for a tighter view."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Default FMV per share">
            <DollarInput
              value={settings.defaultFmvPerShare}
              onChange={(n) => updateSetting("defaultFmvPerShare", n)}
              allowDecimal
            />
          </Field>
          <Field label="As-of date">
            <input
              type="date"
              value={settings.asOfDate ?? ""}
              onChange={(e) =>
                updateSetting("asOfDate", e.target.value || undefined)
              }
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
                colorScheme: "dark",
                fontFamily: "var(--font-mono)",
              }}
            />
          </Field>
          <Field label="Stale-grant threshold (years)">
            <NumberInput
              value={settings.staleGrantThresholdYears}
              onChange={(n) => updateSetting("staleGrantThresholdYears", n)}
            />
          </Field>
          <Field label="Cohort outlier multiple (× median)">
            <NumberInput
              value={settings.outlierValueMultiple}
              onChange={(n) => updateSetting("outlierValueMultiple", n)}
              allowDecimal
            />
          </Field>
          <Field label="Tiny-grant shares threshold">
            <NumberInput
              value={settings.tinyGrantSharesThreshold}
              onChange={(n) => updateSetting("tinyGrantSharesThreshold", n)}
            />
          </Field>
          <Field label="Concentration top-N% (decimal)">
            <NumberInput
              value={settings.concentrationTopPct}
              onChange={(n) =>
                updateSetting(
                  "concentrationTopPct",
                  Math.min(1, Math.max(0.001, n)),
                )
              }
              allowDecimal
            />
          </Field>
          <Field label="Required demographic dimensions (comma-separated)">
            <input
              type="text"
              value={settings.requireDemographicDimensions.join(", ")}
              onChange={(e) =>
                updateSetting(
                  "requireDemographicDimensions",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              placeholder="e.g., Gender, Ethnicity Group"
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
              }}
            />
          </Field>
        </div>
      </CardSection>

      <CardSection
        title="Grant population"
        hint="Manual entry or paste/upload a grants outstanding worksheet joined with HRIS fields."
        sourceHint="Grant ID, Award Type, Grant Date, Shares, FMV at Grant, Current FMV: Fidelity / Shareworks (Morgan Stanley) / Computershare / E*TRADE / Carta grants outstanding export. Level, Function, Country, Performance Tier: Workday / SAP SuccessFactors / Oracle HCM / Dayforce / UKG. Demographic columns: optional, free-text dimension name prefixed with 'Demographic:' or 'Demo:' (e.g., Demographic: Gender). Required column: Level (or Grant ID if you're auditing by grant only)."
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={addRow}
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
              placeholder="Paste your grants outstanding CSV here…"
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
                importMessage.kind === "ok"
                  ? "var(--accent)"
                  : "var(--red, #d05a5a)",
              borderLeftColor:
                importMessage.kind === "ok"
                  ? "var(--accent)"
                  : "var(--red, #d05a5a)",
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
          <table
            className="min-w-full text-xs"
            style={{ color: "var(--text)" }}
          >
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: "var(--line)", color: "var(--muted)" }}
              >
                <Th>ID</Th>
                <Th>Name</Th>
                <Th>Level</Th>
                <Th>Function</Th>
                <Th>Country</Th>
                <Th>Tier</Th>
                <Th>Award</Th>
                <Th>Grant date</Th>
                <Th align="right">Shares</Th>
                <Th align="right">Current FMV</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="py-3 text-center text-[11px]"
                    style={{ color: "var(--muted)" }}
                  >
                    No grants yet. Use Add grant, Upload CSV, or Load sample.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.rowId}
                    className="border-b"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={r.employeeId ?? ""}
                        onChange={(v) =>
                          updateRow(r.rowId, { employeeId: v || undefined })
                        }
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={r.employeeName ?? ""}
                        onChange={(v) =>
                          updateRow(r.rowId, { employeeName: v || undefined })
                        }
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={r.level}
                        onChange={(v) => updateRow(r.rowId, { level: v })}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={r.function ?? ""}
                        onChange={(v) =>
                          updateRow(r.rowId, { function: v || undefined })
                        }
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={r.country ?? ""}
                        onChange={(v) =>
                          updateRow(r.rowId, { country: v || undefined })
                        }
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={r.performanceTier ?? ""}
                        onChange={(v) =>
                          updateRow(r.rowId, {
                            performanceTier: v || undefined,
                          })
                        }
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={r.awardType}
                        onChange={(e) =>
                          updateRow(r.rowId, {
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
                        value={r.grantDate ?? ""}
                        onChange={(v) =>
                          updateRow(r.rowId, { grantDate: v || undefined })
                        }
                        placeholder="YYYY-MM-DD"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={String(r.shares)}
                        onChange={(v) =>
                          updateRow(r.rowId, { shares: parseInt_(v) })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={r.currentFmv !== undefined ? String(r.currentFmv) : ""}
                        onChange={(v) =>
                          updateRow(r.rowId, {
                            currentFmv:
                              v === "" ? undefined : parseDecimal(v),
                          })
                        }
                        placeholder="—"
                        align="right"
                      />
                    </td>
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => removeRow(r.rowId)}
                        aria-label={`Remove ${r.employeeId || r.rowId}`}
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
        <p
          className="mt-2 text-[11px] leading-5"
          style={{ color: "var(--muted)" }}
        >
          The inline table edits the most-used columns. The full row schema
          (FMV at grant, current FMV override, vesting pattern, demographic
          dimensions) is honored on import and reflected in the analysis,
          memo, and exported CSV.
        </p>
      </CardSection>

      <CardSection title="Population summary">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Metric
            label="Grants"
            value={analysis.summary.grantCount.toLocaleString()}
          />
          <Metric
            label="Employees"
            value={analysis.summary.employeeCount.toLocaleString()}
          />
          <Metric
            label="Total shares"
            value={analysis.summary.totalShares.toLocaleString()}
          />
          <Metric
            label="Total value"
            value={formatUSD(analysis.summary.totalValue)}
          />
          <Metric
            label="Avg grant value"
            value={formatUSD(Math.round(analysis.summary.averageValue))}
          />
          <Metric
            label="Median grant value"
            value={formatUSD(Math.round(analysis.summary.medianValue))}
          />
          <Metric
            label="Rows with exceptions"
            value={analysis.summary.rowsWithExceptions.toLocaleString()}
          />
          <Metric
            label="Demographic dimensions"
            value={analysis.summary.demographicDimensions.length.toString()}
          />
        </div>
      </CardSection>

      <CardSection title="Concentration">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Metric
              label={`Top ${(settings.concentrationTopPct * 100).toFixed(0)}% employees`}
              value={`${analysis.concentration.topPctEmployeeCount.toLocaleString()} of ${analysis.concentration.totalEmployeeCount.toLocaleString()}`}
            />
            <Metric
              label="…hold this share of value"
              value={`${(analysis.concentration.topPctShareOfValue * 100).toFixed(1)}%`}
            />
            <Metric
              label="Gini coefficient"
              value={analysis.concentration.giniCoefficient.toFixed(3)}
            />
            <Metric
              label="Levels in pop."
              value={analysis.concentration.byLevelConcentration.length.toString()}
            />
          </div>
          <div>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color: "var(--muted)" }}
            >
              Concentration by level
            </p>
            <div className="mt-2 overflow-x-auto">
              <table
                className="min-w-full text-xs"
                style={{ color: "var(--text)" }}
              >
                <thead>
                  <tr
                    className="border-b text-left"
                    style={{
                      borderColor: "var(--line)",
                      color: "var(--muted)",
                    }}
                  >
                    <Th>Level</Th>
                    <Th align="right">Employees</Th>
                    <Th align="right">Share of value</Th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.concentration.byLevelConcentration.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-2 text-[11px]"
                        style={{ color: "var(--muted)" }}
                      >
                        —
                      </td>
                    </tr>
                  ) : (
                    analysis.concentration.byLevelConcentration.map((l) => (
                      <tr
                        key={l.level}
                        className="border-b"
                        style={{ borderColor: "var(--line)" }}
                      >
                        <td className="py-1.5 pr-2 font-mono text-[11px]">
                          {l.level}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {l.employees.toLocaleString()}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {(l.shareOfValue * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardSection>

      <CardSection title="Distribution by structural dimensions">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DistributionTable title="By level" buckets={analysis.byLevel} />
          <DistributionTable
            title="By function"
            buckets={analysis.byFunction}
          />
          <DistributionTable title="By country" buckets={analysis.byCountry} />
          <DistributionTable
            title="By grant year"
            buckets={analysis.byGrantYear}
          />
          <DistributionTable
            title="By award type"
            buckets={analysis.byAwardType}
          />
          {analysis.byPerformanceTier.length > 0 && (
            <DistributionTable
              title="By performance tier"
              buckets={analysis.byPerformanceTier}
            />
          )}
        </div>
      </CardSection>

      {analysis.summary.demographicDimensions.length > 0 && (
        <CardSection
          title="Distribution by demographic dimension"
          hint="Counts and averages by cohort. Use as a starting point only; do not infer disparate impact from an unweighted distribution view. Take this output to your DEIB partner for paired analysis."
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {analysis.summary.demographicDimensions.map((dim) => (
              <DistributionTable
                key={dim}
                title={dim}
                buckets={analysis.byDemographic[dim] ?? []}
              />
            ))}
          </div>
        </CardSection>
      )}

      <CardSection
        title="Exceptions"
        hint="Counts by type, sorted by volume. Red = blocks audit completion until resolved (missing level, missing award type). Amber = needs documentation."
      >
        {analysis.summary.rowsWithExceptions === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No exceptions flagged.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {(
              Object.entries(analysis.summary.countByException) as Array<
                [GrantException, number]
              >
            )
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([type, n]) => {
                const tone = exceptionTone(type);
                const s = FLAG_TONE_STYLE[tone];
                return (
                  <div
                    key={type}
                    className="rounded-md border-l-4 p-3"
                    style={{
                      borderColor: "var(--line)",
                      borderLeftColor: s.color,
                      background: "var(--bg-alt)",
                    }}
                  >
                    <p
                      className="text-[10px] font-medium uppercase tracking-[0.14em]"
                      style={{ color: s.color }}
                    >
                      {EXCEPTION_LABEL[type]}
                    </p>
                    <p
                      className="mt-1 text-sm font-semibold"
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
        )}
      </CardSection>

      <CardSection
        title="Per-grant exceptions detail"
        hint="First 50 rows shown for readability. Use the results CSV for the full set."
      >
        {(() => {
          const flagged = analysis.rows.filter((r) => r.exceptions.length > 0);
          if (flagged.length === 0) {
            return (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                No rows with exceptions.
              </p>
            );
          }
          const visible = flagged.slice(0, 50);
          return (
            <>
              <div className="overflow-x-auto">
                <table
                  className="min-w-full text-xs"
                  style={{ color: "var(--text)" }}
                >
                  <thead>
                    <tr
                      className="border-b text-left"
                      style={{
                        borderColor: "var(--line)",
                        color: "var(--muted)",
                      }}
                    >
                      <Th>ID / Name</Th>
                      <Th>Level · Function · Award</Th>
                      <Th align="right">Shares</Th>
                      <Th align="right">Computed value</Th>
                      <Th>Flags</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <ExceptionRow key={r.rowId} r={r} />
                    ))}
                  </tbody>
                </table>
              </div>
              {flagged.length > visible.length && (
                <p
                  className="mt-2 text-[11px]"
                  style={{ color: "var(--muted)" }}
                >
                  Showing {visible.length.toLocaleString()} of{" "}
                  {flagged.length.toLocaleString()} rows with exceptions.
                  Download the results CSV for the complete list.
                </p>
              )}
            </>
          );
        })()}
      </CardSection>

      <CardSection
        title="Audit memo"
        hint="Plain markdown. Drop into your audit pre-read or comp-committee packet."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={copyMemo}
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
          className="mt-3 whitespace-pre-wrap rounded-md border p-4 text-[12.5px] leading-6"
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
        Educational diagnostic. Not legal, tax, accounting, financial,
        compensation, or DEIB advice. Counts and averages by cohort are a
        starting point for the conversation, not a substitute for qualified
        analysis. Bring this memo to TR leadership, DEIB, finance, legal, and
        the comp committee before any action.
      </p>
    </div>
  );
}

// ──────────── Subcomponents ────────────

function CardSection({
  title,
  hint,
  sourceHint,
  children,
}: {
  title: string;
  hint?: string;
  sourceHint?: string;
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
        <p className="mt-1 text-xs leading-5" style={{ color: "var(--muted)" }}>
          {hint}
        </p>
      )}
      {sourceHint && (
        <p
          className="mt-2 rounded-md border-l-2 px-3 py-1.5 text-[11px] leading-5"
          style={{
            borderLeftColor: "var(--accent)",
            background: "var(--surface-alt)",
            color: "var(--muted)",
          }}
        >
          <span
            className="font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--accent)" }}
          >
            Where to find this
          </span>
          <span className="ml-2 normal-case tracking-normal">{sourceHint}</span>
        </p>
      )}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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

function Th({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      scope="col"
      className={`py-2 pr-2 font-medium uppercase tracking-[0.14em] ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Disclosure({
  heading,
  body,
}: {
  heading: string;
  body: React.ReactNode;
}) {
  return (
    <div>
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: "var(--text)" }}
      >
        {heading}
      </p>
      <p className="mt-1">{body}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: "var(--line)", background: "var(--bg-alt)" }}
    >
      <p
        className="text-[10px] font-medium uppercase tracking-[0.14em]"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-sm font-semibold"
        style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}
      >
        {value}
      </p>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  allowDecimal,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  allowDecimal?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      value={value === 0 ? "" : value.toString()}
      onChange={(e) => {
        const cleaned = allowDecimal
          ? e.target.value.replace(/[^\d.]/g, "")
          : e.target.value.replace(/[^\d]/g, "");
        if (cleaned === "" || cleaned === ".") {
          onChange(0);
          return;
        }
        const n = Number(cleaned);
        onChange(Number.isFinite(n) ? n : 0);
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

function DollarInput({
  value,
  onChange,
  allowDecimal,
}: {
  value: number;
  onChange: (n: number) => void;
  allowDecimal?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      value={value === 0 ? "" : value.toLocaleString("en-US")}
      onChange={(e) => {
        const cleaned = allowDecimal
          ? e.target.value.replace(/[^\d.]/g, "")
          : e.target.value.replace(/[^\d]/g, "");
        if (cleaned === "" || cleaned === ".") {
          onChange(0);
          return;
        }
        const n = Number(cleaned);
        onChange(Number.isFinite(n) ? n : 0);
      }}
      placeholder="0"
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

function CellInput({
  value,
  onChange,
  placeholder,
  align,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  align?: "right";
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`block w-full rounded border bg-transparent px-2 py-1 text-xs ${
        align === "right" ? "text-right" : ""
      }`}
      style={{
        borderColor: "var(--line)",
        color: "var(--text)",
        fontFamily: "var(--font-mono)",
      }}
    />
  );
}

function DistributionTable({
  title,
  buckets,
}: {
  title: string;
  buckets: DistributionBucket[];
}) {
  return (
    <div>
      <p
        className="text-[11px] font-medium uppercase tracking-[0.14em]"
        style={{ color: "var(--muted)" }}
      >
        {title}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table
          className="min-w-full text-xs"
          style={{ color: "var(--text)" }}
        >
          <thead>
            <tr
              className="border-b text-left"
              style={{ borderColor: "var(--line)", color: "var(--muted)" }}
            >
              <Th>Bucket</Th>
              <Th align="right">Grants</Th>
              <Th align="right">Empl.</Th>
              <Th align="right">Total $</Th>
              <Th align="right">% of value</Th>
              <Th align="right">Avg $</Th>
              <Th align="right">Median $</Th>
            </tr>
          </thead>
          <tbody>
            {buckets.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-2 text-[11px]"
                  style={{ color: "var(--muted)" }}
                >
                  —
                </td>
              </tr>
            ) : (
              buckets.map((b) => (
                <tr
                  key={b.key}
                  className="border-b"
                  style={{ borderColor: "var(--line)" }}
                >
                  <td className="py-1.5 pr-2">{b.key}</td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    {b.grantCount.toLocaleString()}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    {b.employeeCount.toLocaleString()}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    {formatUSD(b.totalValue)}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    {(b.shareOfTotalValue * 100).toFixed(1)}%
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    {formatUSD(Math.round(b.averageValue))}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    {formatUSD(Math.round(b.medianValue))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExceptionRow({ r }: { r: GrantWithExceptions }) {
  const id = r.employeeId || r.employeeName || r.grantId || r.rowId;
  const name = r.employeeName && r.employeeId ? r.employeeName : "";
  return (
    <>
      <tr style={{ borderColor: "var(--line)" }}>
        <td className="py-2 pr-2">
          <span className="block font-mono text-[11px]">{id}</span>
          {name && (
            <span
              className="block text-[10.5px]"
              style={{ color: "var(--muted)" }}
            >
              {name}
            </span>
          )}
        </td>
        <td className="py-2 pr-2 text-[11px]">
          <span className="font-mono">{r.level || "—"}</span>
          <span style={{ color: "var(--muted)" }}>
            {" · "}
            {r.function || "—"}
            {" · "}
            {r.awardType}
          </span>
        </td>
        <td className="py-2 pr-2 text-right font-mono">
          {r.shares.toLocaleString()}
        </td>
        <td className="py-2 pr-2 text-right font-mono">
          {formatUSD(r.computedValue)}
        </td>
        <td className="py-2 pr-2">
          <div className="flex flex-wrap gap-1">
            {r.exceptions.map((e, i) => (
              <FlagChip key={i} tone={exceptionTone(e.type)} title={e.message}>
                {EXCEPTION_LABEL[e.type]}
              </FlagChip>
            ))}
          </div>
        </td>
      </tr>
      <tr>
        <td
          colSpan={5}
          className="pb-2 pl-1 pr-2 text-[11px] leading-5"
          style={{ color: "var(--muted)" }}
        >
          {r.exceptions.map((e, i) => (
            <span key={i} className="block">
              · {e.message}
            </span>
          ))}
        </td>
      </tr>
    </>
  );
}

function exceptionTone(type: GrantException): FlagTone {
  switch (type) {
    case "MISSING_LEVEL":
    case "MISSING_AWARD_TYPE":
    case "NEEDS_MANUAL_REVIEW":
      return "red";
    case "MISSING_GRANT_DATE":
    case "MISSING_FMV":
    case "MISSING_DEMOGRAPHIC_FIELD":
    case "STALE_GRANT":
    case "ZERO_SHARES":
      return "amber";
    case "UNUSUALLY_HIGH_VALUE":
      return "accent";
  }
}

type FlagTone = "ok" | "amber" | "red" | "accent";

const FLAG_TONE_STYLE: Record<
  FlagTone,
  { bg: string; color: string; border: string }
> = {
  ok: {
    bg: "var(--green-bg)",
    color: "var(--green)",
    border: "var(--green-border)",
  },
  amber: {
    bg: "var(--amber-bg)",
    color: "var(--amber)",
    border: "var(--amber-border)",
  },
  red: {
    bg: "var(--red-bg)",
    color: "var(--red)",
    border: "var(--red-border)",
  },
  accent: {
    bg: "var(--accent-soft)",
    color: "var(--accent)",
    border: "var(--accent)",
  },
};

function FlagChip({
  tone,
  title,
  children,
}: {
  tone: FlagTone;
  title?: string;
  children: React.ReactNode;
}) {
  const s = FLAG_TONE_STYLE[tone];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
      title={title}
    >
      {children}
    </span>
  );
}

function ProvChip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "amber";
}) {
  const s =
    tone === "amber"
      ? {
          bg: "var(--amber-bg)",
          color: "var(--amber)",
          border: "var(--amber-border)",
        }
      : {
          bg: "var(--surface)",
          color: "var(--muted)",
          border: "var(--line)",
        };
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {children}
    </span>
  );
}

function HowToStep({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <li
      className="rounded-md border p-3"
      style={{ borderColor: "var(--line)", background: "var(--bg-alt)" }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--accent)" }}
      >
        Step {n}
      </p>
      <p
        className="mt-1 text-[12.5px] font-semibold leading-5"
        style={{ color: "var(--text)" }}
      >
        {title}
      </p>
      <p className="mt-1 text-[11px] leading-5">{body}</p>
    </li>
  );
}

// ──────────── Helpers ────────────

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

function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function triggerDownload(content: string, filename: string, mime: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
