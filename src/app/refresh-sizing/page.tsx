import RefreshSizingView from "@/components/refreshSizing/RefreshSizingView";

export const metadata = { title: "Refresh Grant Sizing Tool" };

export default function RefreshSizingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
      <p
        className="text-xs font-medium uppercase tracking-[0.32em]"
        style={{ color: "var(--accent)" }}
      >
        Refresh Grant Sizing Tool
      </p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
        Multi-tier refresh logic, exception flags, executive memo.
      </h1>
      <p
        className="mt-3 max-w-3xl text-base leading-7"
        style={{ color: "var(--muted)" }}
      >
        Your stock administration platform (Fidelity, Shareworks,
        Computershare, E*TRADE, Carta) and your HRIS (Workday, SAP
        SuccessFactors, Oracle HCM) hold the source data. This tool turns a
        refresh-cycle worksheet into a level × performance-tier
        recommendation, a budget summary, an exception list, a per-employee
        share count, and a copyable memo for the comp committee pre-read.
      </p>
      <p
        className="mt-3 max-w-3xl text-sm leading-6"
        style={{ color: "var(--muted)" }}
      >
        Deterministic rules engine. No AI in the calculation path. Client-
        side only. Your CSV is read in your browser, lives in this
        tab&rsquo;s memory, and is gone the moment the tab closes.
      </p>
      <div className="mt-10">
        <RefreshSizingView />
      </div>
    </div>
  );
}
