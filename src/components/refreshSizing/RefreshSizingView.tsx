"use client";

import { useMemo, useRef, useState } from "react";
import {
  analyzeRefresh,
  composeRefreshMemo,
  defaultGuidelines,
  defaultSettings,
  EXCEPTION_LABEL,
  PERFORMANCE_TIER_LABEL,
  PERFORMANCE_TIER_ORDER,
  recommendationsToCsv,
  RETENTION_RISK_LABEL,
  type EmployeeRecommendation,
  type EmployeeRow,
  type ExceptionType,
  type PerformanceTier,
  type RefreshGuidelines,
  type RefreshSettings,
  type RetentionRisk,
} from "@/lib/refreshSizing";
import {
  importRefreshCsv,
  REFRESH_CSV_TEMPLATE,
} from "@/lib/refreshSizingCsv";
import {
  SAMPLE_GUIDELINES,
  SAMPLE_ROWS,
  sampleSettings,
} from "@/lib/sampleRefreshSizing";

/**
 * Refresh Grant Sizing — main view.
 *
 * Layout:
 *   - Sample / Clear banner up top
 *   - Settings + guideline matrix in collapsible panels
 *   - Employee population table (manual + CSV)
 *   - Recommendations table, totals, distribution, exceptions, memo
 *
 * Pure-functional engine in src/lib/refreshSizing.ts. No AI. Client-side only.
 */
export default function RefreshSizingView() {
  const [rows, setRows] = useState<EmployeeRow[]>(SAMPLE_ROWS);
  const [guidelines, setGuidelines] = useState<RefreshGuidelines>(
    () => clone(SAMPLE_GUIDELINES),
  );
  const [settings, setSettings] = useState<RefreshSettings>(sampleSettings());
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
    () => analyzeRefresh(rows, guidelines, settings),
    [rows, guidelines, settings],
  );
  const memo = useMemo(
    () => composeRefreshMemo(analysis, guidelines),
    [analysis, guidelines],
  );

  // ───────── State setters ─────────

  const updateRow = (rowId: string, patch: Partial<EmployeeRow>) => {
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
        level: guidelines.levels[0] ?? "",
        country: "",
        currentEquityValue: 0,
        unvestedValue: 0,
        lastGrantDate: undefined,
        priorRefreshDollars: 0,
        performanceTier: "MEETS",
        retentionRisk: "MEDIUM",
        criticalRoleFlag: false,
        proposedRefreshDollars: undefined,
        fmvPerShare: undefined,
        vestingPattern: "",
      },
    ]);
    setUsingSample(false);
  };

  const updateSetting = <K extends keyof RefreshSettings>(
    key: K,
    value: RefreshSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setUsingSample(false);
  };

  const updateGuidelineCell = (
    level: string,
    tier: PerformanceTier,
    target: number,
  ) => {
    setGuidelines((prev) => {
      const next = clone(prev);
      next.byLevelByTier[level] = next.byLevelByTier[level] ?? {};
      if (target <= 0) {
        delete next.byLevelByTier[level][tier];
      } else {
        next.byLevelByTier[level][tier] = { targetDollars: target };
      }
      return next;
    });
    setUsingSample(false);
  };

  const updateGuidelineBands = (low: number, high: number) => {
    setGuidelines((prev) => ({
      ...prev,
      bandLowMultiple: low,
      bandHighMultiple: high,
    }));
    setUsingSample(false);
  };

  const addGuidelineLevel = (level: string) => {
    const trimmed = level.trim();
    if (!trimmed) return;
    setGuidelines((prev) => {
      if (prev.levels.includes(trimmed)) return prev;
      const next = clone(prev);
      next.levels.push(trimmed);
      next.byLevelByTier[trimmed] = next.byLevelByTier[trimmed] ?? {};
      return next;
    });
    setUsingSample(false);
  };

  const removeGuidelineLevel = (level: string) => {
    setGuidelines((prev) => {
      const next = clone(prev);
      next.levels = next.levels.filter((l) => l !== level);
      delete next.byLevelByTier[level];
      return next;
    });
    setUsingSample(false);
  };

  // ───────── Sample / clear / CSV ─────────

  const loadSample = () => {
    setRows(SAMPLE_ROWS);
    setGuidelines(clone(SAMPLE_GUIDELINES));
    setSettings(sampleSettings());
    setUsingSample(true);
    setImportMessage(null);
    setCsvText("");
  };

  const clearAll = () => {
    setRows([]);
    setGuidelines(defaultGuidelines());
    setSettings(defaultSettings());
    setUsingSample(false);
    setImportMessage(null);
    setCsvText("");
  };

  const handleImport = (text: string) => {
    if (!text.trim()) {
      setImportMessage({ kind: "error", text: "No CSV content to import." });
      return;
    }
    const result = importRefreshCsv(text);
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
          ? `. ${result.errors.length} row${result.errors.length === 1 ? "" : "s"} skipped: ${result.errors[0]}`
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
    triggerDownload(REFRESH_CSV_TEMPLATE, "refresh-sizing-template.csv", "text/csv");
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
    triggerDownload(memo, "refresh-sizing-memo.md", "text/markdown");
  };

  const copyResultsCsv = async () => {
    try {
      await navigator.clipboard.writeText(
        recommendationsToCsv(analysis.recommendations),
      );
      setCsvCopied(true);
      setTimeout(() => setCsvCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const downloadResultsCsv = () => {
    triggerDownload(
      recommendationsToCsv(analysis.recommendations),
      "refresh-sizing-results.csv",
      "text/csv",
    );
  };

  // ───────── Render ─────────

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
            ? "Showing the sample refresh population. Edit any field to start working with your own data, or clear to a blank slate."
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
          <Disclosure
            heading="Deterministic, not AI"
            body={
              <>
                Recommendations are computed by a rules engine in{" "}
                <span className="font-mono text-[12px]">
                  src/lib/refreshSizing.ts
                </span>
                , unit-tested. AI is not used to set guidelines, propose
                refresh dollars, or decide which rows are flagged. Memo
                language is generated by deterministic templates filled with
                your inputs.
              </>
            }
          />
          <Disclosure
            heading="Client-side only"
            body={
              <>
                Your CSV is parsed in your browser. The data lives in this
                tab&rsquo;s memory for the session and is gone the moment the
                tab closes. Nothing is uploaded.
              </>
            }
          />
          <Disclosure
            heading="Not a system of record"
            body={
              <>
                Your stock administration platform owns the source of truth
                for grants, FMV, and outstanding awards. This tool sits above
                that — it&rsquo;s the planning workbench between the export
                and the comp committee pre-read.
              </>
            }
          />
          <Disclosure
            heading="Not advice"
            body={
              <>
                Real refresh decisions are governed by the company&rsquo;s
                plan document, comp committee authority, ASC 718 expense
                considerations, share-pool runway, dilution targets, and
                applicable employment and securities law. This tool is a
                planning aid for your conversation with TR leadership,
                finance, accounting, and legal.
              </>
            }
          />
        </div>
      </details>

      <CardSection
        title="Settings"
        hint="Defaults a TR practitioner would set once at the start of a refresh cycle."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Default FMV per share">
            <DollarInput
              value={settings.fmvPerShare}
              onChange={(n) => updateSetting("fmvPerShare", n)}
              allowDecimal
            />
          </Field>
          <Field label="Total refresh budget (optional)">
            <DollarInput
              value={settings.totalBudget ?? 0}
              onChange={(n) =>
                updateSetting("totalBudget", n === 0 ? undefined : n)
              }
            />
          </Field>
          <Field label="As-of date (for stale-grant calc)">
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
          <Field label="Stale-grant threshold (months)">
            <NumberInput
              value={settings.staleGrantThresholdMonths}
              onChange={(n) => updateSetting("staleGrantThresholdMonths", n)}
            />
          </Field>
          <Field label="Way-above guideline multiple">
            <NumberInput
              value={settings.highOutlierMultiple}
              onChange={(n) => updateSetting("highOutlierMultiple", n)}
              allowDecimal
            />
          </Field>
          <Field label="Way-below guideline multiple">
            <NumberInput
              value={settings.lowOutlierMultiple}
              onChange={(n) => updateSetting("lowOutlierMultiple", n)}
              allowDecimal
            />
          </Field>
          <Field label="Share rounding increment">
            <NumberInput
              value={settings.shareRoundingIncrement}
              onChange={(n) =>
                updateSetting(
                  "shareRoundingIncrement",
                  Math.max(1, Math.round(n)),
                )
              }
            />
          </Field>
          <Field label="In-band low multiple of target">
            <NumberInput
              value={guidelines.bandLowMultiple}
              onChange={(n) =>
                updateGuidelineBands(n, guidelines.bandHighMultiple)
              }
              allowDecimal
            />
          </Field>
          <Field label="In-band high multiple of target">
            <NumberInput
              value={guidelines.bandHighMultiple}
              onChange={(n) =>
                updateGuidelineBands(guidelines.bandLowMultiple, n)
              }
              allowDecimal
            />
          </Field>
        </div>
      </CardSection>

      <details
        className="rounded-md border"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        open
      >
        <summary
          className="cursor-pointer p-5 text-[11px] font-medium uppercase tracking-[0.18em]"
          style={{ color: "var(--accent)" }}
        >
          Refresh guideline matrix (level × performance tier)
        </summary>
        <div className="border-t p-5" style={{ borderColor: "var(--line)" }}>
          <p
            className="text-xs leading-5"
            style={{ color: "var(--muted)" }}
          >
            Target refresh dollars per cell. In-band tolerance is set in
            Settings. Empty cell = no guideline for that combo (rows in that
            combo will be flagged).
          </p>
          <div className="mt-3 overflow-x-auto">
            <table
              className="min-w-full text-xs"
              style={{ color: "var(--text)" }}
            >
              <thead>
                <tr
                  className="border-b text-left"
                  style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                >
                  <th className="py-2 pr-2 font-medium uppercase tracking-[0.14em]">
                    Level
                  </th>
                  {PERFORMANCE_TIER_ORDER.filter((t) => t !== "UNKNOWN").map(
                    (t) => (
                      <th
                        key={t}
                        className="py-2 pr-2 text-right font-medium uppercase tracking-[0.14em]"
                      >
                        {PERFORMANCE_TIER_LABEL[t]}
                      </th>
                    ),
                  )}
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {guidelines.levels.map((lvl) => (
                  <tr
                    key={lvl}
                    className="border-b"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <td className="py-1.5 pr-2 font-mono text-[11px]">{lvl}</td>
                    {PERFORMANCE_TIER_ORDER.filter((t) => t !== "UNKNOWN").map(
                      (t) => (
                        <td key={t} className="py-1.5 pr-2 text-right">
                          <CellInput
                            value={(
                              guidelines.byLevelByTier[lvl]?.[t]
                                ?.targetDollars ?? 0
                            ).toString()}
                            onChange={(v) =>
                              updateGuidelineCell(lvl, t, parseDollars(v))
                            }
                            placeholder="—"
                            align="right"
                          />
                        </td>
                      ),
                    )}
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => removeGuidelineLevel(lvl)}
                        aria-label={`Remove ${lvl}`}
                        className="text-xs"
                        style={{ color: "var(--muted)" }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AddLevelControl onAdd={addGuidelineLevel} />
        </div>
      </details>

      <CardSection
        title="Employee population"
        hint="Manual entry or paste/upload a refresh-cycle worksheet from your HRIS, total rewards, or finance system."
        sourceHint="Workday / SAP SuccessFactors / Oracle HCM / your TR refresh worksheet. Combine with grants outstanding from Fidelity / Shareworks / Computershare / E*TRADE / Carta to populate Current Equity Value, Unvested Value, Last Grant Date, and Prior Refresh Amount. Required column: Level. Strongly recommended: Performance Tier, Retention Risk, Critical Role, Proposed Refresh Dollars, FMV/Share."
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={addRow}
            className="rounded-full px-3 py-1.5 font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            + Add employee
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
          style={{
            borderColor: "var(--line)",
            background: "var(--bg-alt)",
          }}
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
              placeholder="Paste your refresh worksheet CSV here…"
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
          <table className="min-w-full text-xs" style={{ color: "var(--text)" }}>
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: "var(--line)", color: "var(--muted)" }}
              >
                <Th>ID</Th>
                <Th>Name</Th>
                <Th>Level</Th>
                <Th>Country</Th>
                <Th align="right">Cur. equity $</Th>
                <Th align="right">Unvested $</Th>
                <Th>Last grant</Th>
                <Th align="right">Prior refresh $</Th>
                <Th>Tier</Th>
                <Th>Risk</Th>
                <Th>Critical</Th>
                <Th align="right">Proposed $</Th>
                <Th align="right">FMV/sh</Th>
                <Th>Vesting</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={15}
                    className="py-3 text-center text-[11px]"
                    style={{ color: "var(--muted)" }}
                  >
                    No employees yet. Use Add employee, Upload CSV, or Load
                    sample.
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
                        value={r.country ?? ""}
                        onChange={(v) =>
                          updateRow(r.rowId, { country: v || undefined })
                        }
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={r.currentEquityValue.toString()}
                        onChange={(v) =>
                          updateRow(r.rowId, {
                            currentEquityValue: parseDollars(v),
                          })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={r.unvestedValue.toString()}
                        onChange={(v) =>
                          updateRow(r.rowId, { unvestedValue: parseDollars(v) })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={r.lastGrantDate ?? ""}
                        onChange={(v) =>
                          updateRow(r.rowId, {
                            lastGrantDate: v || undefined,
                          })
                        }
                        placeholder="YYYY-MM-DD"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={r.priorRefreshDollars.toString()}
                        onChange={(v) =>
                          updateRow(r.rowId, {
                            priorRefreshDollars: parseDollars(v),
                          })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={r.performanceTier}
                        onChange={(e) =>
                          updateRow(r.rowId, {
                            performanceTier: e.target.value as PerformanceTier,
                          })
                        }
                        className="bg-transparent text-xs"
                        style={{ color: "var(--text)" }}
                      >
                        {PERFORMANCE_TIER_ORDER.map((t) => (
                          <option key={t} value={t}>
                            {PERFORMANCE_TIER_LABEL[t]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={r.retentionRisk}
                        onChange={(e) =>
                          updateRow(r.rowId, {
                            retentionRisk: e.target.value as RetentionRisk,
                          })
                        }
                        className="bg-transparent text-xs"
                        style={{ color: "var(--text)" }}
                      >
                        {(
                          ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const
                        ).map((t) => (
                          <option key={t} value={t}>
                            {RETENTION_RISK_LABEL[t]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2 text-center">
                      <input
                        type="checkbox"
                        checked={r.criticalRoleFlag}
                        onChange={(e) =>
                          updateRow(r.rowId, {
                            criticalRoleFlag: e.target.checked,
                          })
                        }
                        aria-label="Critical role"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={
                          r.proposedRefreshDollars !== undefined
                            ? String(r.proposedRefreshDollars)
                            : ""
                        }
                        onChange={(v) =>
                          updateRow(r.rowId, {
                            proposedRefreshDollars:
                              v === "" ? undefined : parseDollars(v),
                          })
                        }
                        placeholder="auto"
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={
                          r.fmvPerShare !== undefined
                            ? String(r.fmvPerShare)
                            : ""
                        }
                        onChange={(v) =>
                          updateRow(r.rowId, {
                            fmvPerShare:
                              v === "" ? undefined : parseDecimal(v),
                          })
                        }
                        placeholder="—"
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={r.vestingPattern ?? ""}
                        onChange={(v) =>
                          updateRow(r.rowId, {
                            vestingPattern: v || undefined,
                          })
                        }
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
      </CardSection>

      <CardSection title="Budget summary">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Metric
            label="Headcount"
            value={analysis.summary.headcount.toLocaleString()}
          />
          <Metric
            label="Proposed dollars"
            value={formatUSD(analysis.summary.totalProposedDollars)}
          />
          <Metric
            label="Proposed shares"
            value={analysis.summary.totalProposedShares.toLocaleString()}
          />
          <Metric
            label="Avg per employee"
            value={formatUSD(
              Math.round(analysis.summary.averageProposedDollars),
            )}
          />
          {analysis.summary.budgetUsedPct !== undefined && (
            <>
              <Metric
                label="Budget"
                value={formatUSD(settings.totalBudget ?? 0)}
              />
              <Metric
                label="Budget used"
                value={`${(analysis.summary.budgetUsedPct * 100).toFixed(1)}%`}
              />
              <Metric
                label="Variance"
                value={`${
                  (analysis.summary.budgetVariance ?? 0) >= 0 ? "+" : "−"
                }${formatUSD(Math.abs(analysis.summary.budgetVariance ?? 0))}`}
              />
            </>
          )}
          <Metric
            label="Rows with exceptions"
            value={analysis.summary.headcountWithExceptions.toLocaleString()}
          />
        </div>
      </CardSection>

      <CardSection title="Distribution">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color: "var(--muted)" }}
            >
              By level
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-xs" style={{ color: "var(--text)" }}>
                <thead>
                  <tr
                    className="border-b text-left"
                    style={{
                      borderColor: "var(--line)",
                      color: "var(--muted)",
                    }}
                  >
                    <Th>Level</Th>
                    <Th align="right">Headcount</Th>
                    <Th align="right">Total $</Th>
                    <Th align="right">Avg $</Th>
                    <Th align="right">Shares</Th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.summary.byLevel.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-2 text-[11px]" style={{ color: "var(--muted)" }}>
                        —
                      </td>
                    </tr>
                  ) : (
                    analysis.summary.byLevel.map((l) => (
                      <tr
                        key={l.level}
                        className="border-b"
                        style={{ borderColor: "var(--line)" }}
                      >
                        <td className="py-1.5 pr-2 font-mono text-[11px]">
                          {l.level}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {l.headcount.toLocaleString()}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {formatUSD(l.totalDollars)}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {formatUSD(Math.round(l.averageDollars))}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {l.totalShares.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color: "var(--muted)" }}
            >
              By performance tier
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-xs" style={{ color: "var(--text)" }}>
                <thead>
                  <tr
                    className="border-b text-left"
                    style={{
                      borderColor: "var(--line)",
                      color: "var(--muted)",
                    }}
                  >
                    <Th>Tier</Th>
                    <Th align="right">Headcount</Th>
                    <Th align="right">Total $</Th>
                    <Th align="right">Share of $</Th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.summary.byTier.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-2 text-[11px]" style={{ color: "var(--muted)" }}>
                        —
                      </td>
                    </tr>
                  ) : (
                    analysis.summary.byTier.map((t) => {
                      const share =
                        analysis.summary.totalProposedDollars > 0
                          ? t.totalDollars /
                            analysis.summary.totalProposedDollars
                          : 0;
                      return (
                        <tr
                          key={t.tier}
                          className="border-b"
                          style={{ borderColor: "var(--line)" }}
                        >
                          <td className="py-1.5 pr-2">
                            {PERFORMANCE_TIER_LABEL[t.tier]}
                          </td>
                          <td className="py-1.5 pr-2 text-right font-mono">
                            {t.headcount.toLocaleString()}
                          </td>
                          <td className="py-1.5 pr-2 text-right font-mono">
                            {formatUSD(t.totalDollars)}
                          </td>
                          <td className="py-1.5 pr-2 text-right font-mono">
                            {(share * 100).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardSection>

      <CardSection title="Per-employee recommendations">
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
                <Th>ID / Name</Th>
                <Th>Level · Tier</Th>
                <Th align="right">Target $</Th>
                <Th align="right">Proposed $</Th>
                <Th align="right">% of target</Th>
                <Th align="right">Shares</Th>
                <Th>Flags</Th>
              </tr>
            </thead>
            <tbody>
              {analysis.recommendations.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-2 text-[11px]"
                    style={{ color: "var(--muted)" }}
                  >
                    Add employees above to see recommendations.
                  </td>
                </tr>
              ) : (
                analysis.recommendations.map((r) => (
                  <RecommendationRow key={r.rowId} r={r} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardSection>

      <CardSection title="Exceptions">
        {analysis.summary.headcountWithExceptions === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No exceptions flagged.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {(
              Object.entries(analysis.summary.countByException) as Array<
                [ExceptionType, number]
              >
            )
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([type, n]) => (
                <div
                  key={type}
                  className="rounded-md border p-3"
                  style={{
                    borderColor: "var(--line)",
                    background: "var(--bg-alt)",
                  }}
                >
                  <p
                    className="text-[10px] font-medium uppercase tracking-[0.14em]"
                    style={{ color: "var(--muted)" }}
                  >
                    {EXCEPTION_LABEL[type]}
                  </p>
                  <p
                    className="mt-1 text-sm font-semibold"
                    style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}
                  >
                    {n.toLocaleString()}
                  </p>
                </div>
              ))}
          </div>
        )}
      </CardSection>

      <CardSection
        title="Executive memo"
        hint="Plain markdown. Drop into your committee pre-read or budget meeting deck."
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
              background: csvCopied
                ? "var(--accent-soft)"
                : "var(--surface-alt)",
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
        Educational diagnostic. Not legal, tax, accounting, financial, or
        compensation advice. Real refresh decisions are governed by the
        company&rsquo;s plan document, comp committee authority, ASC 718
        expense considerations, share-pool runway, dilution targets, and
        applicable employment and securities law. Bring this memo to TR
        leadership, finance, accounting, and legal before any action.
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

function RecommendationRow({ r }: { r: EmployeeRecommendation }) {
  const id = r.employeeId || r.employeeName || r.rowId;
  const name = r.employeeName && r.employeeId ? r.employeeName : "";
  const pct = r.pctOfGuideline;
  const pctTone = pctTone_(r);
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
            {PERFORMANCE_TIER_LABEL[r.performanceTier]}
          </span>
        </td>
        <td className="py-2 pr-2 text-right font-mono">
          {r.guidelineTargetDollars !== undefined
            ? formatUSD(r.guidelineTargetDollars)
            : "—"}
        </td>
        <td className="py-2 pr-2 text-right font-mono">
          {formatUSD(r.proposedRefreshDollars)}
          {r.proposedSeededFromGuideline && (
            <span
              className="ml-1 text-[10px]"
              style={{ color: "var(--muted)" }}
              title="Seeded from the guideline target because the row didn't supply one."
            >
              auto
            </span>
          )}
        </td>
        <td
          className="py-2 pr-2 text-right font-mono"
          style={{ color: pctTone }}
        >
          {pct !== undefined ? `${(pct * 100).toFixed(0)}%` : "—"}
        </td>
        <td className="py-2 pr-2 text-right font-mono">
          {r.proposedShareCount !== undefined
            ? r.proposedShareCount.toLocaleString()
            : "—"}
        </td>
        <td className="py-2 pr-2">
          <div className="flex flex-wrap gap-1">
            {r.exceptions.length === 0 ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                In band
              </span>
            ) : (
              r.exceptions.map((e, i) => (
                <span
                  key={i}
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    background:
                      e.type === "RETENTION_OVERRIDE"
                        ? "var(--accent-soft)"
                        : "var(--surface-alt)",
                    color:
                      e.type === "RETENTION_OVERRIDE"
                        ? "var(--accent)"
                        : "var(--muted)",
                  }}
                  title={e.message}
                >
                  {EXCEPTION_LABEL[e.type]}
                </span>
              ))
            )}
            {r.isCriticalRole && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                Critical role
              </span>
            )}
          </div>
        </td>
      </tr>
      {r.exceptions.length > 0 && (
        <tr>
          <td
            colSpan={7}
            className="pb-2 text-[11px] leading-5"
            style={{ color: "var(--muted)" }}
          >
            {r.exceptions.map((e, i) => (
              <span key={i} className="block">
                · {e.message}
              </span>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}

function pctTone_(r: EmployeeRecommendation): string {
  if (r.guidelineMaxDollars === undefined || r.guidelineMinDollars === undefined) {
    return "var(--text)";
  }
  if (r.proposedRefreshDollars > r.guidelineMaxDollars) {
    return "var(--accent)";
  }
  if (
    r.proposedRefreshDollars > 0 &&
    r.proposedRefreshDollars < r.guidelineMinDollars
  ) {
    return "var(--muted)";
  }
  return "var(--text)";
}

function AddLevelControl({ onAdd }: { onAdd: (level: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-3 flex items-center gap-2 text-xs">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add level (e.g., L8 or M8)"
        className="rounded border px-2 py-1"
        style={{
          borderColor: "var(--line)",
          background: "var(--bg-alt)",
          color: "var(--text)",
          fontFamily: "var(--font-mono)",
        }}
      />
      <button
        type="button"
        onClick={() => {
          onAdd(value);
          setValue("");
        }}
        className="rounded-full px-3 py-1 font-medium"
        style={{ background: "var(--surface-alt)", color: "var(--text)" }}
      >
        + Add level
      </button>
    </div>
  );
}

// ──────────── Helpers ────────────

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function parseDollars(v: string): number {
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

