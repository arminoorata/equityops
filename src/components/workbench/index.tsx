/**
 * Shared workbench UI primitives. Used by the new tools (AMT, ASC 718,
 * Plan Amendment, Comp Committee Memo Builder) without retrofitting
 * the existing seven tool views — those keep their inline copies to
 * avoid regression risk.
 *
 * Visual language: Gilt palette + Outfit / JetBrains Mono via tokens
 * declared in app/globals.css. Match the surrounding sibling pattern
 * documented in projects/SIBLING_TOOL_PATTERN.md.
 */
"use client";

import type { ReactNode } from "react";

// ───────── CardSection ─────────

export function CardSection({
  title,
  hint,
  sourceHint,
  children,
}: {
  title: string;
  hint?: string;
  sourceHint?: string;
  children: ReactNode;
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

// ───────── Field ─────────

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
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

// ───────── Th ─────────

export function Th({
  children,
  align,
}: {
  children?: ReactNode;
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

// ───────── Disclosure ─────────

export function Disclosure({
  heading,
  body,
}: {
  heading: string;
  body: ReactNode;
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

// ───────── Metric ─────────

export function Metric({ label, value }: { label: string; value: string }) {
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

// ───────── Inputs ─────────

export function NumberInput({
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

export function DollarInput({
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

export function TextInput({
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
        fontFamily: "var(--font-mono)",
      }}
    />
  );
}

export function CellInput({
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

export function DateInput({
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

// ───────── Chips and tones ─────────

export type FlagTone = "ok" | "amber" | "red" | "accent" | "neutral";

export const FLAG_TONE_STYLE: Record<
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
  neutral: {
    bg: "var(--surface)",
    color: "var(--muted)",
    border: "var(--line)",
  },
};

export function FlagChip({
  tone,
  title,
  children,
}: {
  tone: FlagTone;
  title?: string;
  children: ReactNode;
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

export function ProvChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: FlagTone;
}) {
  const s = FLAG_TONE_STYLE[tone];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {children}
    </span>
  );
}

// ───────── HowToStep ─────────

export function HowToStep({
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

// ───────── SampleClearBanner ─────────

export function SampleClearBanner({
  usingSample,
  sampleMessage,
  editingMessage,
  onLoadSample,
  onClearAll,
}: {
  usingSample: boolean;
  sampleMessage: string;
  editingMessage: string;
  onLoadSample: () => void;
  onClearAll: () => void;
}) {
  return (
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
      <div className="text-sm">{usingSample ? sampleMessage : editingMessage}</div>
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={onLoadSample}
          className="rounded-full px-3 py-1.5 font-medium"
          style={{ background: "var(--surface-alt)", color: "var(--text)" }}
        >
          Load sample
        </button>
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-full px-3 py-1.5 font-medium"
          style={{ background: "var(--surface-alt)", color: "var(--text)" }}
        >
          Clear all
        </button>
      </div>
    </div>
  );
}

// ───────── Helpers ─────────

export function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function triggerDownload(content: string, filename: string, mime: string) {
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
