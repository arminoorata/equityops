"use client";

import { useMemo, useState } from "react";
import {
  buildBoardMemo,
  EMPTY_INPUTS,
  evaluatePlanHealth,
  SAMPLE_COMPANY,
  type PlanHealthInputs,
  type PlanFeatures,
} from "@/lib/planHealth";

/**
 * Stock Plan Health Check view. Live form on the left, computed
 * outputs on the right. Sample-company toggle from day one so a
 * first-time visitor sees the full output flow before typing in any
 * real data.
 */
export default function PlanHealthView() {
  const [inputs, setInputs] = useState<PlanHealthInputs>(SAMPLE_COMPANY);
  const [usingSample, setUsingSample] = useState(true);
  const [memoCopied, setMemoCopied] = useState(false);

  const outputs = useMemo(() => evaluatePlanHealth(inputs), [inputs]);
  const memo = useMemo(() => buildBoardMemo(inputs, outputs), [inputs, outputs]);

  const setField = <K extends keyof PlanHealthInputs>(
    key: K,
    value: PlanHealthInputs[K],
  ) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    setUsingSample(false);
  };

  const setGrant = (yearIdx: 0 | 1 | 2, value: number) => {
    setInputs((prev) => {
      const next = [...prev.annualGrants] as [number, number, number];
      next[yearIdx] = value;
      return { ...prev, annualGrants: next };
    });
    setUsingSample(false);
  };

  const setWASO = (yearIdx: 0 | 1 | 2, value: number) => {
    setInputs((prev) => {
      const next = [...prev.weightedAverageSharesOutstanding] as [
        number,
        number,
        number,
      ];
      next[yearIdx] = value;
      return { ...prev, weightedAverageSharesOutstanding: next };
    });
    setUsingSample(false);
  };

  const setFeature = (key: keyof PlanFeatures, value: boolean) => {
    setInputs((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: value },
    }));
    setUsingSample(false);
  };

  const loadSample = () => {
    setInputs(SAMPLE_COMPANY);
    setUsingSample(true);
  };

  const clearAll = () => {
    setInputs(EMPTY_INPUTS);
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
          {usingSample ? (
            <>
              Showing the sample company. Edit any field to start a fresh
              session, or clear the form below.
            </>
          ) : (
            <>
              Editing your own inputs. Sample data is one click away if you
              want to see what the output looks like.
            </>
          )}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="space-y-6">
          <CardSection title="Company">
            <Field label="Company name (optional, used in the memo)">
              <TextInput
                value={inputs.companyName ?? ""}
                onChange={(s) => setField("companyName", s)}
                placeholder="e.g., ExampleCorp Inc."
              />
            </Field>
            <Field label="Stage">
              <Toggle
                options={[
                  { id: "public", label: "Public" },
                  { id: "private", label: "Private (late-stage)" },
                ]}
                value={inputs.companyStage}
                onChange={(id) =>
                  setField("companyStage", id as "private" | "public")
                }
              />
            </Field>
          </CardSection>

          <CardSection
            title="Burn rate inputs"
            hint="Gross shares granted in each fiscal year, paired with the weighted-average common shares outstanding for that year. Most recent year first."
          >
            <Year3
              labelGrants="Annual gross grants"
              labelWASO="Weighted avg shares outstanding"
              grants={inputs.annualGrants}
              waso={inputs.weightedAverageSharesOutstanding}
              onGrant={setGrant}
              onWASO={setWASO}
            />
          </CardSection>

          <CardSection
            title="Overhang inputs"
            hint="Awards outstanding (unvested + vested-but-unexercised), shares left in the plan reserve, and total common shares outstanding on today's basis."
          >
            <NumberField
              label="Awards outstanding"
              value={inputs.awardsOutstanding}
              onChange={(n) => setField("awardsOutstanding", n)}
            />
            <NumberField
              label="Shares available for grant"
              value={inputs.sharesAvailableForGrant}
              onChange={(n) => setField("sharesAvailableForGrant", n)}
            />
            <NumberField
              label="Common shares outstanding"
              value={inputs.sharesOutstanding}
              onChange={(n) => setField("sharesOutstanding", n)}
            />
          </CardSection>

          <CardSection
            title="Plan feature flags"
            hint="Each flagged feature appears in the board memo with the investor lens explained. Inputs are typed; the model does not read your plan document."
          >
            <FeatureRow
              label="Single-trigger acceleration on change of control"
              value={inputs.features.singleTriggerAcceleration}
              onChange={(b) => setFeature("singleTriggerAcceleration", b)}
            />
            <FeatureRow
              label="Evergreen plan reserve (auto-replenishes annually)"
              value={inputs.features.evergreenReserve}
              onChange={(b) => setFeature("evergreenReserve", b)}
            />
            <FeatureRow
              label="Repricing without shareholder approval"
              value={inputs.features.repricingWithoutShareholderApproval}
              onChange={(b) =>
                setFeature("repricingWithoutShareholderApproval", b)
              }
            />
            <FeatureRow
              label="Share recycling permitted"
              value={inputs.features.shareRecyclingPermitted}
              onChange={(b) => setFeature("shareRecyclingPermitted", b)}
            />
            <FeatureRow
              label="Dividend equivalents paid on unvested awards"
              value={inputs.features.dividendEquivalentsOnUnvested}
              onChange={(b) => setFeature("dividendEquivalentsOnUnvested", b)}
            />
            <FeatureRow
              label="Liberal change-in-control definition"
              value={inputs.features.liberalChangeInControlDefinition}
              onChange={(b) =>
                setFeature("liberalChangeInControlDefinition", b)
              }
            />
            <FeatureRow
              label="Discounted stock options permitted"
              value={inputs.features.discountedStockOptionsPermitted}
              onChange={(b) => setFeature("discountedStockOptionsPermitted", b)}
            />
          </CardSection>
        </section>

        <section className="space-y-6">
          <CardSection title="Headline metrics">
            <Metric
              label="Trailing-year burn rate"
              value={formatPct(outputs.burnRate.trailingYear)}
            />
            <Metric
              label="3-year average burn rate"
              value={formatPct(outputs.burnRate.threeYearAverage)}
            />
            <Metric
              label="Overhang (fully-diluted view)"
              value={formatPct(outputs.overhang.fullyDilutedPct)}
            />
            <Metric
              label="Overhang (investor view)"
              value={formatPct(outputs.overhang.investorViewPct)}
            />
            <Metric
              label="Runway at trailing-year rate"
              value={formatYears(outputs.runway.yearsAtTrailingRate)}
            />
            <Metric
              label="Runway at 3-year average rate"
              value={formatYears(outputs.runway.yearsAtAverageRate)}
            />
          </CardSection>

          <CardSection title="Plan feature findings">
            <ul className="space-y-3 text-sm leading-6">
              {outputs.featureFindings.map((f) => (
                <li key={f.feature}>
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        background: f.flagged
                          ? "var(--accent)"
                          : "var(--line)",
                      }}
                    />
                    <span
                      className="font-medium"
                      style={{
                        color: f.flagged ? "var(--text)" : "var(--muted)",
                      }}
                    >
                      {f.shortLabel}
                    </span>
                    <span
                      className="ml-auto text-[11px] uppercase tracking-[0.18em]"
                      style={{
                        color: f.flagged ? "var(--accent)" : "var(--muted)",
                      }}
                    >
                      {f.flagged ? "Flagged" : "Not flagged"}
                    </span>
                  </div>
                  {f.flagged && (
                    <p
                      className="mt-1 text-[13px] leading-5"
                      style={{ color: "var(--muted)" }}
                    >
                      {f.whyItMatters}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardSection>

          <CardSection title="Questions to ask legal and finance">
            <ol
              className="space-y-3 list-decimal pl-5 text-sm leading-6"
              style={{ color: "var(--muted)" }}
            >
              {outputs.questionsToAsk.map((q, i) => (
                <li key={i}>
                  <span
                    className="font-medium"
                    style={{ color: "var(--text)" }}
                  >
                    {q.triggeredBy}:
                  </span>{" "}
                  {q.question}
                </li>
              ))}
            </ol>
          </CardSection>

          <CardSection
            title="Board memo draft"
            hint="Plain markdown. Copy and paste into the Comp Committee pre-read or your internal doc."
          >
            <div className="flex justify-end">
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
            </div>
            <pre
              className="mt-3 whitespace-pre-wrap rounded-md border p-4 text-[13px] leading-6"
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

          <p
            className="text-xs italic leading-6"
            style={{ color: "var(--muted)" }}
          >
            Educational diagnostic. Not a replication of ISS, Glass Lewis, or
            any other proprietary scoring framework. Outputs are starting
            points for conversations with legal, finance, and external
            advisors. Not legal, tax, or financial advice.
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

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <Field label={label}>
      <NumberInput value={value} onChange={onChange} />
    </Field>
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
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

function FeatureRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 text-sm leading-6">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1.5"
      />
      <span style={{ color: "var(--text)" }}>{label}</span>
    </label>
  );
}

function Year3({
  labelGrants,
  labelWASO,
  grants,
  waso,
  onGrant,
  onWASO,
}: {
  labelGrants: string;
  labelWASO: string;
  grants: [number, number, number];
  waso: [number, number, number];
  onGrant: (i: 0 | 1 | 2, n: number) => void;
  onWASO: (i: 0 | 1 | 2, n: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div
        className="grid grid-cols-3 gap-2 text-[11px] uppercase tracking-[0.14em]"
        style={{ color: "var(--muted)" }}
      >
        <div>Trailing year</div>
        <div>Year -1</div>
        <div>Year -2</div>
      </div>
      <div>
        <p
          className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em]"
          style={{ color: "var(--muted)" }}
        >
          {labelGrants}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <NumberInput value={grants[0]} onChange={(n) => onGrant(0, n)} />
          <NumberInput value={grants[1]} onChange={(n) => onGrant(1, n)} />
          <NumberInput value={grants[2]} onChange={(n) => onGrant(2, n)} />
        </div>
      </div>
      <div>
        <p
          className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em]"
          style={{ color: "var(--muted)" }}
        >
          {labelWASO}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <NumberInput value={waso[0]} onChange={(n) => onWASO(0, n)} />
          <NumberInput value={waso[1]} onChange={(n) => onWASO(1, n)} />
          <NumberInput value={waso[2]} onChange={(n) => onWASO(2, n)} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 border-b py-2.5 last:border-b-0"
      style={{ borderColor: "var(--line)" }}
    >
      <span className="text-sm" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      <span
        className="text-base font-semibold"
        style={{
          color: "var(--text)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function formatPct(fraction: number): string {
  if (!Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(2)}%`;
}

function formatYears(years: number): string {
  if (!Number.isFinite(years)) return "—";
  return `${years.toFixed(1)} yrs`;
}
