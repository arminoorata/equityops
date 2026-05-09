"use client";

import { useMemo, useRef, useState } from "react";
import {
  analyzeUnderwater,
  composeUnderwaterMemo,
  defaultUnderwaterSettings,
  EXCEPTION_LABEL,
  OPTION_AWARD_TYPES,
  rowsToCsv,
  STATUS_LABEL,
  type GrantStatus,
  type GrantWithStatus,
  type OptionAwardType,
  type OptionGrant,
  type UnderwaterException,
  type UnderwaterSettings,
} from "@/lib/underwaterOptions";
import {
  importUnderwaterCsv,
  UNDERWATER_CSV_TEMPLATE,
} from "@/lib/underwaterOptionsCsv";
import {
  SAMPLE_OPTION_GRANTS,
  sampleUnderwaterSettings,
} from "@/lib/sampleUnderwaterOptions";

/**
 * Underwater Options Analyzer view. Pure-functional engine in
 * src/lib/underwaterOptions.ts. No AI in the audit path. Client-
 * side only. Reports intrinsic value; does not recommend repricing.
 */
export default function UnderwaterOptionsView() {
  const [grants, setGrants] = useState<OptionGrant[]>(SAMPLE_OPTION_GRANTS);
  const [settings, setSettings] = useState<UnderwaterSettings>(
    sampleUnderwaterSettings(),
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
    () => analyzeUnderwater(grants, settings),
    [grants, settings],
  );
  const memo = useMemo(() => composeUnderwaterMemo(analysis), [analysis]);

  const updateGrant = (rowId: string, patch: Partial<OptionGrant>) => {
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
        employeeId: "",
        employeeName: "",
        level: "",
        function: "",
        country: "",
        grantId: "",
        awardType: "ISO",
        grantDate: "",
        expirationDate: "",
        strike: 0,
        sharesGranted: 0,
        sharesVested: 0,
        sharesExercised: 0,
        sharesForfeited: 0,
      },
    ]);
    setUsingSample(false);
  };

  const updateSetting = <K extends keyof UnderwaterSettings>(
    key: K,
    value: UnderwaterSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setUsingSample(false);
  };

  const loadSample = () => {
    setGrants(SAMPLE_OPTION_GRANTS);
    setSettings(sampleUnderwaterSettings());
    setUsingSample(true);
    setImportMessage(null);
    setCsvText("");
  };

  const clearAll = () => {
    setGrants([]);
    setSettings(defaultUnderwaterSettings());
    setUsingSample(false);
    setImportMessage(null);
    setCsvText("");
  };

  const handleImport = (text: string) => {
    if (!text.trim()) {
      setImportMessage({ kind: "error", text: "No CSV content to import." });
      return;
    }
    const result = importUnderwaterCsv(text);
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
      text: `Imported ${result.rows.length} grant${result.rows.length === 1 ? "" : "s"}${
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
      UNDERWATER_CSV_TEMPLATE,
      "underwater-options-template.csv",
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
    triggerDownload(memo, "underwater-options-memo.md", "text/markdown");
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
      "underwater-options-results.csv",
      "text/csv",
    );
  };

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
        style={{ color: "var(--muted)" }}
      >
        <ProvChip>Client-side only · no upload</ProvChip>
        <ProvChip>Deterministic engine · no AI in audit</ProvChip>
        <ProvChip>Not a system of record</ProvChip>
        <ProvChip tone="amber">
          Intrinsic value only · not a recommendation to reprice
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
            ? "Showing the sample option population. Edit any field to start working with your own data, or clear to a blank slate."
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

      <CardSection title="How to use this in a plan-amendment / refresh discussion">
        <ol
          className="grid grid-cols-1 gap-2 text-sm leading-6 sm:grid-cols-2 lg:grid-cols-5"
          style={{ color: "var(--muted)" }}
        >
          <HowToStep
            n={1}
            title="Pull options outstanding"
            body="Export options outstanding (ISO + NSO + SAR) from Fidelity / Shareworks / Computershare / E*TRADE / Carta. Optionally join level / function / country from Workday / SuccessFactors / Oracle HCM / Dayforce / UKG."
          />
          <HowToStep
            n={2}
            title="Set the FMV reference"
            body="Use the most recent 409A (private) or trading-day close (public). Update the as-of date to match. Decide whether to include or exclude expired grants."
          />
          <HowToStep
            n={3}
            title="Read the headline"
            body="What share of outstanding option shares is underwater? What share of holders has at least one underwater grant? How does the depth distribution look across slightly / moderately / deeply / severely underwater bands?"
          />
          <HowToStep
            n={4}
            title="Walk tranches and levels"
            body="Identify which grant year + strike combos are concentrated underwater. Identify which levels are most exposed. Compare to the company refresh framework and dilution model."
          />
          <HowToStep
            n={5}
            title="Hand off"
            body="TR leadership → finance (burn-rate / overhang reconciliation) → accounting (ASC 718 modification expense) → legal (plan terms, ISS / Glass Lewis posture, listing rules) → comp committee."
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
            heading="Intrinsic value only"
            body="Spread = max(0, FMV − strike) × shares outstanding. This is the same intrinsic-value math your stock administration platform reports as 'in the money' value. It is not a Black-Scholes / ASC 718 fair-value engine."
          />
          <Disclosure
            heading="Not a recommendation"
            body="The analyzer reports the math. Repricing, option exchange, accelerated vesting, and plan amendments are governed by plan terms, ISS / Glass Lewis frameworks, listing rules, shareholder approval, and qualified counsel. The right next decision is usually 'monitor next quarter,' not a remediation."
          />
          <Disclosure
            heading="Client-side only"
            body="Your CSV is parsed in your browser. The data lives in this tab's memory for the session and is gone the moment the tab closes. Nothing is uploaded."
          />
          <Disclosure
            heading="ISO mechanics"
            body="ISO holders face different tax mechanics on exercise (AMT bargain-element exposure). Repricing or exchange of ISOs typically converts them to NSOs and triggers a fresh ISO 100k limit clock. Confirm with tax / legal before any modification."
          />
        </div>
      </details>

      <CardSection
        title="Settings"
        hint="Defaults a TR practitioner would set once at the start of the audit."
        sourceHint="Current FMV: most recent 409A valuation (private) or trading-day reference (public). Per-row FMV override is honored where supplied. Depth bands: defaults follow the practitioner-common 95% / 75% / 50% / 25% strike-of-FMV cuts; adjust to TR policy. Excluding expired grants is the default; toggle off when auditing a remediation cycle that may include re-issued vested-but-expired awards."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Current FMV per share">
            <DollarInput
              value={settings.currentFmv}
              onChange={(n) => updateSetting("currentFmv", n)}
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
          <Field label="Exclude expired grants">
            <select
              value={settings.excludeExpired ? "yes" : "no"}
              onChange={(e) =>
                updateSetting("excludeExpired", e.target.value === "yes")
              }
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
              }}
            >
              <option value="yes">Yes (exclude from analysis)</option>
              <option value="no">No (include in analysis)</option>
            </select>
          </Field>
        </div>
      </CardSection>

      <CardSection
        title="Option grants"
        hint="Manual entry or paste/upload an options outstanding worksheet."
        sourceHint="Strike, Award Type, Grant Date, Expiration Date, Shares Granted/Vested/Exercised/Forfeited: Fidelity / Shareworks (Morgan Stanley) / Computershare / E*TRADE / Carta options outstanding export. Level, Function, Country: Workday / SAP SuccessFactors / Oracle HCM / Dayforce / UKG. Required column: Strike."
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
              placeholder="Paste your options outstanding CSV here…"
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
                <Th>ID / Name</Th>
                <Th>Level</Th>
                <Th>Award</Th>
                <Th>Grant date</Th>
                <Th>Expires</Th>
                <Th align="right">Strike</Th>
                <Th align="right">Granted</Th>
                <Th align="right">Vested</Th>
                <Th align="right">Exercised</Th>
                <Th align="right">Forfeited</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {grants.length === 0 ? (
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
                grants.map((g) => (
                  <tr
                    key={g.rowId}
                    className="border-b"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={g.employeeId ?? ""}
                        onChange={(v) =>
                          updateGrant(g.rowId, { employeeId: v || undefined })
                        }
                        placeholder="ID"
                      />
                      <CellInput
                        value={g.employeeName ?? ""}
                        onChange={(v) =>
                          updateGrant(g.rowId, { employeeName: v || undefined })
                        }
                        placeholder="Name"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={g.level ?? ""}
                        onChange={(v) =>
                          updateGrant(g.rowId, { level: v || undefined })
                        }
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={g.awardType}
                        onChange={(e) =>
                          updateGrant(g.rowId, {
                            awardType: e.target.value as OptionAwardType,
                          })
                        }
                        className="bg-transparent text-xs"
                        style={{ color: "var(--text)" }}
                      >
                        {OPTION_AWARD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
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
                        value={g.expirationDate ?? ""}
                        onChange={(v) =>
                          updateGrant(g.rowId, {
                            expirationDate: v || undefined,
                          })
                        }
                        placeholder="YYYY-MM-DD"
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
                        value={String(g.sharesGranted)}
                        onChange={(v) =>
                          updateGrant(g.rowId, { sharesGranted: parseInt_(v) })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={String(g.sharesVested)}
                        onChange={(v) =>
                          updateGrant(g.rowId, { sharesVested: parseInt_(v) })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={String(g.sharesExercised)}
                        onChange={(v) =>
                          updateGrant(g.rowId, {
                            sharesExercised: parseInt_(v),
                          })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <CellInput
                        value={String(g.sharesForfeited)}
                        onChange={(v) =>
                          updateGrant(g.rowId, {
                            sharesForfeited: parseInt_(v),
                          })
                        }
                        align="right"
                      />
                    </td>
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => removeGrant(g.rowId)}
                        aria-label={`Remove ${g.employeeId || g.rowId}`}
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

      <CardSection title="Headline exposure">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Metric
            label="Underwater (shares)"
            value={`${(analysis.summary.pctUnderwaterByShares * 100).toFixed(1)}%`}
          />
          <Metric
            label="Underwater (holders)"
            value={`${(analysis.summary.pctUnderwaterByHolders * 100).toFixed(1)}%`}
          />
          <Metric
            label="Underwater shares"
            value={analysis.summary.totalUnderwaterShares.toLocaleString()}
          />
          <Metric
            label="Total in-scope shares"
            value={analysis.summary.totalShares.toLocaleString()}
          />
          <Metric
            label="Total spread (intrinsic)"
            value={formatUSD(analysis.summary.totalSpreadValue)}
          />
          <Metric
            label="ITM-only intrinsic"
            value={formatUSD(analysis.summary.totalIntrinsicValue)}
          />
          <Metric
            label="Holders in scope"
            value={analysis.summary.holderCount.toLocaleString()}
          />
          <Metric
            label="Underwater holders"
            value={analysis.summary.underwaterHolderCount.toLocaleString()}
          />
        </div>
      </CardSection>

      <CardSection title="Vested vs unvested underwater exposure">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Metric
            label="Vested underwater shares"
            value={analysis.summary.underwaterVestedShares.toLocaleString()}
          />
          <Metric
            label="Unvested underwater shares"
            value={analysis.summary.underwaterUnvestedShares.toLocaleString()}
          />
          {(
            Object.entries(analysis.summary.underwaterByAwardType) as Array<
              [OptionAwardType, number]
            >
          )
            .filter(([, n]) => n > 0)
            .map(([type, n]) => (
              <Metric key={type} label={`Underwater ${type}`} value={n.toLocaleString()} />
            ))}
        </div>
      </CardSection>

      <CardSection title="Depth bands">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs" style={{ color: "var(--text)" }}>
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: "var(--line)", color: "var(--muted)" }}
              >
                <Th>Band</Th>
                <Th align="right">FMV/strike range</Th>
                <Th align="right">Grants</Th>
                <Th align="right">Holders</Th>
                <Th align="right">Shares</Th>
              </tr>
            </thead>
            <tbody>
              {analysis.byDepthBand.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-2 text-[11px]" style={{ color: "var(--muted)" }}>
                    —
                  </td>
                </tr>
              ) : (
                analysis.byDepthBand.map((b) => (
                  <tr key={b.label} className="border-b" style={{ borderColor: "var(--line)" }}>
                    <td className="py-1.5 pr-2">{b.label}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {b.minRatio.toFixed(2)}–{b.maxRatio.toFixed(2)}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {b.grantCount.toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {b.holderCount.toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {b.totalShares.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardSection>

      <CardSection title="Tranches and trends">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color: "var(--muted)" }}
            >
              By grant year
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-xs" style={{ color: "var(--text)" }}>
                <thead>
                  <tr
                    className="border-b text-left"
                    style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                  >
                    <Th>Year</Th>
                    <Th align="right">Grants</Th>
                    <Th align="right">Shares</Th>
                    <Th align="right">Underwater</Th>
                    <Th align="right">% UW</Th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.byGrantYear.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-2 text-[11px]" style={{ color: "var(--muted)" }}>
                        —
                      </td>
                    </tr>
                  ) : (
                    analysis.byGrantYear.map((y) => (
                      <tr key={y.year} className="border-b" style={{ borderColor: "var(--line)" }}>
                        <td className="py-1.5 pr-2 font-mono">{y.year}</td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {y.grantCount.toLocaleString()}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {y.totalShares.toLocaleString()}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {y.underwaterShares.toLocaleString()}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {(y.pctUnderwater * 100).toFixed(1)}%
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
              By level (sorted by % underwater)
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-xs" style={{ color: "var(--text)" }}>
                <thead>
                  <tr
                    className="border-b text-left"
                    style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                  >
                    <Th>Level</Th>
                    <Th align="right">Holders</Th>
                    <Th align="right">UW shares</Th>
                    <Th align="right">Total</Th>
                    <Th align="right">% UW</Th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.byLevel.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-2 text-[11px]" style={{ color: "var(--muted)" }}>
                        —
                      </td>
                    </tr>
                  ) : (
                    analysis.byLevel.map((l) => (
                      <tr key={l.level} className="border-b" style={{ borderColor: "var(--line)" }}>
                        <td className="py-1.5 pr-2 font-mono">{l.level}</td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {l.holderCount.toLocaleString()}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {l.underwaterShares.toLocaleString()}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {l.totalShares.toLocaleString()}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono">
                          {(l.pctUnderwater * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <p
            className="text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color: "var(--muted)" }}
          >
            Tranches (year × strike, first 30)
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-xs" style={{ color: "var(--text)" }}>
              <thead>
                <tr
                  className="border-b text-left"
                  style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                >
                  <Th>Tranche</Th>
                  <Th align="right">Grants</Th>
                  <Th align="right">Shares</Th>
                  <Th align="right">Spread $</Th>
                </tr>
              </thead>
              <tbody>
                {analysis.byTranche.slice(0, 30).map((t) => (
                  <tr key={t.key} className="border-b" style={{ borderColor: "var(--line)" }}>
                    <td className="py-1.5 pr-2 font-mono">{t.key}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {t.grantCount.toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {t.totalShares.toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {formatUSD(t.totalSpreadValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analysis.byTranche.length > 30 && (
              <p className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                {analysis.byTranche.length - 30} more tranches in the results CSV.
              </p>
            )}
          </div>
        </div>
      </CardSection>

      <CardSection
        title="Per-grant detail"
        hint="First 50 rows shown. Use the results CSV for the full set."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs" style={{ color: "var(--text)" }}>
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: "var(--line)", color: "var(--muted)" }}
              >
                <Th>ID</Th>
                <Th>Status</Th>
                <Th align="right">Strike</Th>
                <Th align="right">FMV/Strike</Th>
                <Th align="right">Outstanding</Th>
                <Th align="right">Spread $</Th>
                <Th>Flags</Th>
              </tr>
            </thead>
            <tbody>
              {analysis.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-2 text-[11px]" style={{ color: "var(--muted)" }}>
                    No grants in scope.
                  </td>
                </tr>
              ) : (
                analysis.rows.slice(0, 50).map((r) => <DetailRow key={r.rowId} r={r} />)
              )}
            </tbody>
          </table>
        </div>
        {analysis.rows.length > 50 && (
          <p className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            Showing 50 of {analysis.rows.length.toLocaleString()} grants.
            Download the results CSV for the complete list.
          </p>
        )}
      </CardSection>

      <CardSection
        title="Exceptions"
        hint="Counts by type, sorted by volume."
      >
        {analysis.summary.rowsWithExceptions === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No exceptions flagged.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {(
              Object.entries(analysis.summary.countByException) as Array<
                [UnderwaterException, number]
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
        title="Audit memo"
        hint="Plain markdown. Drop into your audit pre-read or comp-committee packet."
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
        Educational diagnostic. Intrinsic-value analysis only. Not legal,
        tax, accounting, financial, or compensation advice. Not a
        recommendation to reprice, exchange, or otherwise modify outstanding
        awards. Real decisions are governed by the company plan document,
        ISS / Glass Lewis frameworks, shareholder-approval requirements,
        listing-rule restrictions, and qualified counsel.
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

function DetailRow({ r }: { r: GrantWithStatus }) {
  const id = r.employeeId || r.employeeName || r.grantId || r.rowId;
  const statusTone = STATUS_TONE[r.status];
  return (
    <tr style={{ borderColor: "var(--line)" }} className="border-b">
      <td className="py-1.5 pr-2 font-mono text-[11px]">{id}</td>
      <td className="py-1.5 pr-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            background: statusTone.bg,
            color: statusTone.color,
            border: `1px solid ${statusTone.border}`,
          }}
        >
          {STATUS_LABEL[r.status]}
        </span>
        {r.depthBandLabel && (
          <span
            className="ml-1 text-[10px]"
            style={{ color: "var(--muted)" }}
          >
            · {r.depthBandLabel}
          </span>
        )}
      </td>
      <td className="py-1.5 pr-2 text-right font-mono">
        {r.strike > 0 ? formatUSD(r.strike) : "—"}
      </td>
      <td className="py-1.5 pr-2 text-right font-mono">
        {r.fmvStrikeRatio !== undefined ? r.fmvStrikeRatio.toFixed(2) : "—"}
      </td>
      <td className="py-1.5 pr-2 text-right font-mono">
        {r.sharesOutstandingComputed.toLocaleString()}
      </td>
      <td className="py-1.5 pr-2 text-right font-mono">
        {r.spreadValue > 0 ? formatUSD(r.spreadValue) : "—"}
      </td>
      <td className="py-1.5 pr-2">
        <div className="flex flex-wrap gap-1">
          {r.exceptions.map((e, i) => (
            <FlagChip key={i} tone={exceptionTone(e.type)} title={e.message}>
              {EXCEPTION_LABEL[e.type]}
            </FlagChip>
          ))}
        </div>
      </td>
    </tr>
  );
}

function exceptionTone(type: UnderwaterException): FlagTone {
  switch (type) {
    case "MISSING_STRIKE":
    case "NEGATIVE_VALUE":
    case "NEEDS_MANUAL_REVIEW":
      return "red";
    case "MISSING_FMV":
    case "ZERO_SHARES":
    case "EXPIRED_GRANT":
      return "amber";
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

const STATUS_TONE: Record<GrantStatus, { bg: string; color: string; border: string }> = {
  UNDERWATER: FLAG_TONE_STYLE.red,
  AT_THE_MONEY: FLAG_TONE_STYLE.amber,
  IN_THE_MONEY: FLAG_TONE_STYLE.ok,
  EXPIRED: FLAG_TONE_STYLE.amber,
  EXCLUDED: {
    bg: "var(--surface-alt)",
    color: "var(--muted)",
    border: "var(--line)",
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
