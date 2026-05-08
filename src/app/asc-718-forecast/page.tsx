import Asc718ForecastView from "@/components/asc718/Asc718ForecastView";

export const metadata = { title: "ASC 718 Expense Forecaster" };

export default function Asc718ForecastPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
      <p
        className="text-xs font-medium uppercase tracking-[0.32em]"
        style={{ color: "var(--accent)" }}
      >
        ASC 718 Expense Forecaster
      </p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
        Stock-comp expense forecast for finance and accounting partners.
      </h1>
      <p
        className="mt-3 max-w-3xl text-base leading-7"
        style={{ color: "var(--muted)" }}
      >
        Forecast stock-based compensation expense by reporting period
        from a population of awards, grant-date fair values, vesting
        terms, and forfeiture / probability assumptions. Walk by-period
        recognition, by-award-type and by-grant-year totals, and remaining
        unrecognized expense. Memo for the conversation between TR,
        finance, and accounting.
      </p>
      <p
        className="mt-3 max-w-3xl text-sm leading-6"
        style={{ color: "var(--muted)" }}
      >
        Deterministic engine. No AI in the calculation path. Client-side
        only. Planning forecast, not GAAP-final. Modification accounting,
        true-up cycles, and market-condition valuation are not modeled.
        Accounting policy and external auditor review control the final
        number.
      </p>
      <div className="mt-10">
        <Asc718ForecastView />
      </div>
    </div>
  );
}
