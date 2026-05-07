import RetirementVestingView from "@/components/retirementVesting/RetirementVestingView";

export const metadata = { title: "Retirement Vesting Impact Forecaster" };

export default function RetirementVestingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
      <p
        className="text-xs font-medium uppercase tracking-[0.32em]"
        style={{ color: "var(--accent)" }}
      >
        Retirement Vesting Impact Forecaster
      </p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
        Which awards fully vest, which pro-rate, which forfeit.
      </h1>
      <p
        className="mt-3 max-w-3xl text-base leading-7"
        style={{ color: "var(--muted)" }}
      >
        Your stock administration platform (Fidelity, Shareworks,
        Computershare, E*TRADE, Carta) gives you the grants outstanding
        report. This tool turns it into a retirement-date impact analysis:
        per-award status, shares vesting due to retirement, shares
        forfeited, and a memo for equity, legal, and payroll review.
      </p>
      <p
        className="mt-3 max-w-3xl text-sm leading-6"
        style={{ color: "var(--muted)" }}
      >
        Deterministic rules engine. No AI in the calculation path. Client-side
        only — your CSV is read in your browser, lives in this tab&rsquo;s
        memory, and is gone the moment the tab closes.
      </p>
      <div className="mt-10">
        <RetirementVestingView />
      </div>
    </div>
  );
}
