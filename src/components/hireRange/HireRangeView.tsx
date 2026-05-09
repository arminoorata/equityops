"use client";

import { useMemo, useState } from "react";
import {
  composeOfferMemo,
  computeHireQuote,
  defaultHireSettings,
  defaultRangeSettings,
  EXCEPTION_LABEL,
  quoteToSummaryCsv,
  VESTING_PATTERN_LABEL,
  type HireException,
  type HireScenario,
  type HireSettings,
  type RangeSettings,
  type VestingPattern,
} from "@/lib/hireRange";

/**
 * Hire Range Equity Calculator view.
 *
 * Single-scenario calculator (recruiter-paced workflow). Pure-
 * functional engine in src/lib/hireRange.ts. No AI in the
 * calculation path. Client-side only. Internal recruiter / TR
 * partner work product, not candidate-facing.
 */
export default function HireRangeView() {
  const [scenario, setScenario] = useState<HireScenario>(SAMPLE_SCENARIO);
  const [settings, setSettings] = useState<HireSettings>(SAMPLE_SETTINGS);
  const [usingSample, setUsingSample] = useState(true);
  const [memoCopied, setMemoCopied] = useState(false);
  const [csvCopied, setCsvCopied] = useState(false);

  const quote = useMemo(
    () => computeHireQuote(scenario, settings),
    [scenario, settings],
  );
  const memo = useMemo(() => composeOfferMemo(quote), [quote]);
  const csv = useMemo(() => quoteToSummaryCsv(quote), [quote]);

  const update = <K extends keyof HireScenario>(
    key: K,
    value: HireScenario[K],
  ) => {
    setScenario((prev) => ({ ...prev, [key]: value }));
    setUsingSample(false);
  };

  const updateSetting = <K extends keyof HireSettings>(
    key: K,
    value: HireSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setUsingSample(false);
  };

  const updateRange = (next: Partial<RangeSettings>) => {
    setScenario((prev) => ({
      ...prev,
      range: { ...prev.range, ...(next as RangeSettings) } as RangeSettings,
    }));
    setUsingSample(false);
  };

  const setRangeKind = (kind: RangeSettings["kind"]) => {
    setScenario((prev) => ({
      ...prev,
      range:
        kind === "MULTIPLIER"
          ? { kind: "MULTIPLIER", lowMult: 0.85, highMult: 1.15 }
          : { kind: "ABSOLUTE_BAND", lowDelta: 25000, highDelta: 25000 },
    }));
    setUsingSample(false);
  };

  const loadSample = () => {
    setScenario(SAMPLE_SCENARIO);
    setSettings(SAMPLE_SETTINGS);
    setUsingSample(true);
  };

  const clearAll = () => {
    setScenario({
      candidateName: "",
      level: "",
      function: "",
      country: "",
      targetEquityValue: 0,
      fmvPerShare: 0,
      fmvAsOfDate: "",
      vestingPattern: "FOUR_YEAR_25_25_25_25",
      range: defaultRangeSettings(),
      shareRoundingIncrement: 1,
    });
    setSettings(defaultHireSettings());
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

  const downloadMemo = () => {
    triggerDownload(memo, "hire-range-memo.md", "text/markdown");
  };

  const copyCsv = async () => {
    try {
      await navigator.clipboard.writeText(csv);
      setCsvCopied(true);
      setTimeout(() => setCsvCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const downloadCsv = () => {
    triggerDownload(csv, "hire-range-results.csv", "text/csv");
  };

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
        style={{ color: "var(--muted)" }}
      >
        <ProvChip>Client-side only · no upload</ProvChip>
        <ProvChip>Deterministic engine · no AI in calc</ProvChip>
        <ProvChip>Internal recruiter / TR work product</ProvChip>
        <ProvChip tone="amber">Not employee financial advice</ProvChip>
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
            ? "Showing the sample offer scenario. Edit any field to start working with your own, or clear to a blank slate."
            : "Editing your own scenario. Sample is one click away if you want to see what the output looks like."}
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

      <CardSection title="How to use this in an offer cycle">
        <ol
          className="grid grid-cols-1 gap-2 text-sm leading-6 sm:grid-cols-2 lg:grid-cols-5"
          style={{ color: "var(--muted)" }}
        >
          <HowToStep
            n={1}
            title="Confirm FMV reference"
            body="Use the most recent 409A (private) or trading-day close (public). Update the FMV as-of date to match. Stale FMV triggers a flag."
          />
          <HowToStep
            n={2}
            title="Set the target value"
            body="Enter the candidate's target equity value (mid of the range). Set the level guardrail in Settings to flag out-of-range targets."
          />
          <HowToStep
            n={3}
            title="Pick the range philosophy"
            body="Multiplier (e.g., mid × 0.85 / × 1.15) or absolute dollar deltas. Choose what your TR policy uses."
          />
          <HowToStep
            n={4}
            title="Read the schedule"
            body="Walk the per-year vesting schedule and the annualized vest value. Confirm the talking points for the candidate's award type."
          />
          <HowToStep
            n={5}
            title="Hand off"
            body="Recruiter prep document → hiring manager / leveling review → TR partner sign-off → comp committee escalation if outside guardrails."
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
            heading="Internal work product"
            body="The output is the recruiter / TR partner's prep document. It is not a candidate-facing offer letter and not personalized financial, tax, or legal advice for the candidate."
          />
          <Disclosure
            heading="Client-side only"
            body="Your inputs stay in this browser tab and are gone the moment you close it. Nothing is uploaded."
          />
          <Disclosure
            heading="Current FMV at face value"
            body="The vesting schedule values use the FMV you supply. They are not projections of share-price growth and they are not Black-Scholes / ASC 718 fair-value estimates."
          />
          <Disclosure
            heading="Guardrails are guidance"
            body="The level guardrail is a TR policy reference. Any range deviation outside it is flagged but not blocked. The actual approval is governed by the company plan, level + geo guidelines, and (depending on level) comp committee authority."
          />
        </div>
      </details>

      <CardSection
        title="Scenario"
        hint="Single-candidate offer scenario. Edit any field; the range, schedule, and memo update live."
        sourceHint="FMV per share + as-of date: most recent 409A (private) or trading-day close (public). Level / function / country / target value: hiring manager + TR partner alignment. Vesting pattern: company plan document. Range philosophy: TR policy."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Candidate name (optional)">
            <TextInput
              value={scenario.candidateName ?? ""}
              onChange={(v) => update("candidateName", v || undefined)}
            />
          </Field>
          <Field label="Level (required)">
            <TextInput
              value={scenario.level}
              onChange={(v) => update("level", v)}
            />
          </Field>
          <Field label="Function">
            <TextInput
              value={scenario.function ?? ""}
              onChange={(v) => update("function", v || undefined)}
            />
          </Field>
          <Field label="Country">
            <TextInput
              value={scenario.country ?? ""}
              onChange={(v) => update("country", v || undefined)}
            />
          </Field>
          <Field label="Target equity value (USD, mid)">
            <DollarInput
              value={scenario.targetEquityValue}
              onChange={(n) => update("targetEquityValue", n)}
            />
          </Field>
          <Field label="FMV per share (USD)">
            <DollarInput
              value={scenario.fmvPerShare}
              onChange={(n) => update("fmvPerShare", n)}
              allowDecimal
            />
          </Field>
          <Field label="FMV as-of date">
            <input
              type="date"
              value={scenario.fmvAsOfDate ?? ""}
              onChange={(e) =>
                update("fmvAsOfDate", e.target.value || undefined)
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
          <Field label="Vesting pattern">
            <select
              value={scenario.vestingPattern}
              onChange={(e) =>
                update("vestingPattern", e.target.value as VestingPattern)
              }
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
              }}
            >
              {(Object.entries(VESTING_PATTERN_LABEL) as Array<
                [VestingPattern, string]
              >).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Share rounding increment">
            <NumberInput
              value={scenario.shareRoundingIncrement}
              onChange={(n) =>
                update(
                  "shareRoundingIncrement",
                  Math.max(1, Math.round(n)),
                )
              }
            />
          </Field>
          <Field label="Range philosophy">
            <select
              value={scenario.range.kind}
              onChange={(e) =>
                setRangeKind(e.target.value as RangeSettings["kind"])
              }
              className="block w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
              }}
            >
              <option value="MULTIPLIER">Multiplier (× mid)</option>
              <option value="ABSOLUTE_BAND">Absolute dollar delta</option>
            </select>
          </Field>
          {scenario.range.kind === "MULTIPLIER" ? (
            <>
              <Field label="Low multiplier (× mid)">
                <NumberInput
                  value={scenario.range.lowMult}
                  onChange={(n) => updateRange({ lowMult: n })}
                  allowDecimal
                />
              </Field>
              <Field label="High multiplier (× mid)">
                <NumberInput
                  value={scenario.range.highMult}
                  onChange={(n) => updateRange({ highMult: n })}
                  allowDecimal
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Low dollar delta (subtract from mid)">
                <DollarInput
                  value={scenario.range.lowDelta}
                  onChange={(n) => updateRange({ lowDelta: n })}
                />
              </Field>
              <Field label="High dollar delta (add to mid)">
                <DollarInput
                  value={scenario.range.highDelta}
                  onChange={(n) => updateRange({ highDelta: n })}
                />
              </Field>
            </>
          )}
        </div>
      </CardSection>

      <CardSection
        title="Settings"
        hint="Level guardrails are optional. When set, targets outside the range are flagged but not blocked."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Stale FMV threshold (days)">
            <NumberInput
              value={settings.staleFmvThresholdDays}
              onChange={(n) => updateSetting("staleFmvThresholdDays", n)}
            />
          </Field>
          <Field label="Guardrail low (USD)">
            <DollarInput
              value={settings.guardrailLowDollars ?? 0}
              onChange={(n) =>
                updateSetting("guardrailLowDollars", n === 0 ? undefined : n)
              }
            />
          </Field>
          <Field label="Guardrail high (USD)">
            <DollarInput
              value={settings.guardrailHighDollars ?? 0}
              onChange={(n) =>
                updateSetting("guardrailHighDollars", n === 0 ? undefined : n)
              }
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
        </div>
      </CardSection>

      <CardSection title="Range">
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <RangeBox label="Low" dollars={quote.low.dollars} shares={quote.low.shares} />
          <RangeBox
            label="Mid (target)"
            dollars={quote.mid.dollars}
            shares={quote.mid.shares}
            highlight
          />
          <RangeBox label="High" dollars={quote.high.dollars} shares={quote.high.shares} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Metric
            label="Mid total at FMV"
            value={formatUSD(quote.midValueAtFmv)}
          />
          <Metric
            label={`Annualized (${quote.totalYears} yr)`}
            value={formatUSD(Math.round(quote.midAnnualizedValue))}
          />
          <Metric
            label="FMV per share"
            value={formatUSD(scenario.fmvPerShare)}
          />
          <Metric
            label="FMV age"
            value={
              quote.fmvAgeDays !== undefined
                ? `${quote.fmvAgeDays} days`
                : "—"
            }
          />
        </div>
      </CardSection>

      <CardSection title="Vesting schedule (mid share count)">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs" style={{ color: "var(--text)" }}>
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: "var(--line)", color: "var(--muted)" }}
              >
                <Th>Year</Th>
                <Th align="right">Shares vesting</Th>
                <Th align="right">Cumulative shares</Th>
                <Th align="right">Year value @ FMV</Th>
                <Th align="right">Cumulative value</Th>
              </tr>
            </thead>
            <tbody>
              {quote.vestingSchedule.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-2 text-[11px]"
                    style={{ color: "var(--muted)" }}
                  >
                    Vesting schedule unavailable (check FMV / pattern).
                  </td>
                </tr>
              ) : (
                quote.vestingSchedule.map((r) => (
                  <tr
                    key={r.year}
                    className="border-b"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <td className="py-1.5 pr-2 font-mono">{r.year}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {r.yearShares.toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {r.cumulativeShares.toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {formatUSD(r.yearValue)}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {formatUSD(r.cumulativeValue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardSection>

      {quote.exceptions.length > 0 && (
        <CardSection title="Flags">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {quote.exceptions.map((e, i) => {
              const tone = exceptionTone(e.type);
              const s = FLAG_TONE_STYLE[tone];
              return (
                <div
                  key={i}
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
                    {EXCEPTION_LABEL[e.type]}
                  </p>
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
        title="Recruiter offer memo"
        hint="Plain markdown. Internal work product; do not share verbatim with the candidate."
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
        Educational diagnostic. Internal recruiter / TR partner work product.
        Not a candidate-facing offer letter and not personalized financial,
        tax, or legal advice for the candidate. Real offers are governed by
        the company plan document, level + geo guidelines, and the comp
        committee&rsquo;s authority. Numbers use the current FMV at face
        value; they are not projections.
      </p>
    </div>
  );
}

// ──────────── Sample data ────────────

const SAMPLE_SCENARIO: HireScenario = {
  candidateName: "Sample Candidate",
  level: "L5",
  function: "Engineering",
  country: "US",
  targetEquityValue: 200000,
  fmvPerShare: 50,
  fmvAsOfDate: "2026-04-01",
  vestingPattern: "FOUR_YEAR_25_25_25_25",
  range: defaultRangeSettings(),
  shareRoundingIncrement: 1,
};

const SAMPLE_SETTINGS: HireSettings = {
  ...defaultHireSettings(),
  asOfDate: "2026-05-08",
  guardrailLowDollars: 100000,
  guardrailHighDollars: 350000,
};

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

function RangeBox({
  label,
  dollars,
  shares,
  highlight,
}: {
  label: string;
  dollars: number;
  shares: number;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-md border p-4"
      style={{
        borderColor: highlight ? "var(--accent)" : "var(--line)",
        background: highlight ? "var(--accent-soft)" : "var(--bg-alt)",
      }}
    >
      <p
        className="text-[10px] font-medium uppercase tracking-[0.14em]"
        style={{ color: highlight ? "var(--accent)" : "var(--muted)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-lg font-semibold"
        style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}
      >
        {formatUSD(dollars)}
      </p>
      <p
        className="text-xs"
        style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}
      >
        {shares.toLocaleString()} shares
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

function TextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
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

function exceptionTone(type: HireException): FlagTone {
  switch (type) {
    case "MISSING_FMV":
    case "ZERO_TARGET":
    case "UNSUPPORTED_VESTING":
      return "red";
    case "STALE_FMV":
    case "OUT_OF_RANGE":
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
