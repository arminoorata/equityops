import HireRangeView from "@/components/hireRange/HireRangeView";

export const metadata = { title: "Hire Range Equity Calculator" };

export default function HireRangePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
      <p
        className="text-xs font-medium uppercase tracking-[0.32em]"
        style={{ color: "var(--accent)" }}
      >
        Hire Range Equity Calculator
      </p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
        Target dollar value to share count, range, schedule, talking points.
      </h1>
      <p
        className="mt-3 max-w-3xl text-base leading-7"
        style={{ color: "var(--muted)" }}
      >
        The daily-use calculator for recruiters and TR partners. Translate a
        target equity value into a low / mid / high share range at the
        current FMV, lay out the year-by-year vesting schedule, surface the
        annualized vest value, and produce a recruiter prep memo with
        candidate-context talking points for ISOs, NSOs, and RSUs.
      </p>
      <p
        className="mt-3 max-w-3xl text-sm leading-6"
        style={{ color: "var(--muted)" }}
      >
        Deterministic rules engine. No AI in the calculation path. Client-
        side only. Internal recruiter / TR partner work product. Not a
        candidate-facing offer letter and not personalized financial advice.
      </p>
      <div className="mt-10">
        <HireRangeView />
      </div>
    </div>
  );
}
