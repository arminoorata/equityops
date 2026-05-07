import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-10 md:py-16">
      <p
        className="text-xs font-medium uppercase tracking-[0.32em]"
        style={{ color: "var(--accent)" }}
      >
        For SBC practitioners
      </p>
      <h1 className="mt-4 text-3xl font-medium tracking-tight md:text-5xl">
        The layer above Fidelity and Shareworks.
      </h1>
      <p
        className="mt-4 max-w-2xl text-base leading-7 md:text-lg md:leading-8"
        style={{ color: "var(--muted)" }}
      >
        Your stock administration platform is the system of record. It
        processes vests, issues grants, and runs Form 4 filings. It does not
        write the board memo, model the refresh, coordinate the cross-
        functional event, draft the proxy narrative, or stress-test the plan
        amendment. That work currently happens in Excel.
      </p>
      <p
        className="mt-3 max-w-2xl text-base leading-7 md:text-lg md:leading-8"
        style={{ color: "var(--muted)" }}
      >
        Equity Ops Workbench is the toolbox for the work between the export
        and the deliverable. Free, public, no login.
      </p>

      <section className="mt-12">
        <p
          className="text-[11px] font-medium uppercase tracking-[0.18em]"
          style={{ color: "var(--text-secondary)" }}
        >
          Available now
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ToolCard
            title="Stock Plan Health Check"
            description="Turn the burn-rate / overhang / runway report your platform exports into a board-ready memo with the questions to ask legal and finance. ISS-aware, not an ISS score."
            href="/plan-health"
            audience="Heads of Total Rewards · Comp Committee prep"
            stage="Public + late-stage private"
            cta="Open the diagnostic"
          />
          <ToolCard
            title="Equity Event Readiness Planner"
            description="30-day countdown checklist + coordination email drafts for vesting cliffs, double-trigger RSU events, tender windows, IPO lockups, M&A acceleration, and spin-offs. Your platform processes the event; this orchestrates the work around it."
            href="#"
            audience="TR managers · Equity ops"
            stage="Private + public"
            cta="In progress"
            comingSoon
          />
        </div>
      </section>

      <section className="mt-12">
        <p
          className="text-[11px] font-medium uppercase tracking-[0.18em]"
          style={{ color: "var(--text-secondary)" }}
        >
          Roadmap, organized by the gap each tool fills
        </p>
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-6 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: "var(--text)" }}>
              Strategic modeling (vendors don&rsquo;t do this)
            </p>
            <ul className="mt-2 space-y-1" style={{ color: "var(--muted)" }}>
              <li>· Refresh Grant Sizing Tool</li>
              <li>· Hire Range Equity Calculator</li>
              <li>· Plan Amendment Impact Modeler</li>
              <li>· Dilution Stress Tester</li>
              <li>· M&amp;A Retention Pool Modeler</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: "var(--text)" }}>
              Narrative + memo layer (vendors generate numbers, not stories)
            </p>
            <ul className="mt-2 space-y-1" style={{ color: "var(--muted)" }}>
              <li>· Stock Plan Health Check (live)</li>
              <li>· Pay Ratio Narrative Drafter</li>
              <li>· Proxy CD&amp;A Drafter</li>
              <li>· Comp Committee Memo Builder</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: "var(--text)" }}>
              Cross-functional coordination (vendors don&rsquo;t orchestrate)
            </p>
            <ul className="mt-2 space-y-1" style={{ color: "var(--muted)" }}>
              <li>· Equity Event Readiness Planner</li>
              <li>· 10b5-1 Plan Setup Helper</li>
              <li>· IPO Readiness Checker</li>
              <li>· Tender Offer Coordinator</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: "var(--text)" }}>
              Ad-hoc analytics (vendors force Excel exports)
            </p>
            <ul className="mt-2 space-y-1" style={{ color: "var(--muted)" }}>
              <li>· Grant Distribution Auditor</li>
              <li>· Underwater Options Analyzer</li>
              <li>· Vest Stack Visualizer</li>
              <li>· Refresh Multiple Tracker</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: "var(--text)" }}>
              Tax + AMT scenarios (vendors execute, don&rsquo;t model)
            </p>
            <ul className="mt-2 space-y-1" style={{ color: "var(--muted)" }}>
              <li>· AMT Scenario Modeler</li>
              <li>· ISO Disqualifying Disposition Calculator</li>
              <li>· Multi-Grant Tax Sequencer</li>
              <li>· ASC 718 Expense Forecaster</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: "var(--text)" }}>
              Communications + governance
            </p>
            <ul className="mt-2 space-y-1" style={{ color: "var(--muted)" }}>
              <li>· Lockup Expiration Communications Builder</li>
              <li>· Clawback Policy Builder (Rule 10D-1)</li>
              <li>· Plan Doc Plain-English Translator</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <p
          className="text-[11px] font-medium uppercase tracking-[0.18em]"
          style={{ color: "var(--text-secondary)" }}
        >
          Sibling tools
        </p>
        <ul
          className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm md:grid-cols-2"
          style={{ color: "var(--muted)" }}
        >
          <li>
            ·{" "}
            <a
              href="https://equity.arminoorata.com"
              className="underline underline-offset-4"
              style={{ color: "var(--text-secondary)" }}
            >
              equity.arminoorata.com
            </a>{" "}
            — employee equity education
          </li>
          <li>
            ·{" "}
            <a
              href="https://fair.arminoorata.com"
              className="underline underline-offset-4"
              style={{ color: "var(--text-secondary)" }}
            >
              fair.arminoorata.com
            </a>{" "}
            — fair pay diagnostic
          </li>
          <li>
            ·{" "}
            <a
              href="https://flsa.arminoorata.com"
              className="underline underline-offset-4"
              style={{ color: "var(--text-secondary)" }}
            >
              flsa.arminoorata.com
            </a>{" "}
            — FLSA classification
          </li>
          <li>
            ·{" "}
            <a
              href="https://jobarchitecture.arminoorata.com"
              className="underline underline-offset-4"
              style={{ color: "var(--text-secondary)" }}
            >
              jobarchitecture.arminoorata.com
            </a>{" "}
            — job architecture
          </li>
        </ul>
      </section>
    </div>
  );
}

function ToolCard({
  title,
  description,
  href,
  audience,
  stage,
  cta,
  comingSoon,
}: {
  title: string;
  description: string;
  href: string;
  audience: string;
  stage: string;
  cta: string;
  comingSoon?: boolean;
}) {
  const inner = (
    <article
      className="flex h-full flex-col rounded-md border p-5"
      style={{
        borderColor: "var(--line)",
        background: "var(--surface)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        {comingSoon && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
            style={{
              background: "var(--surface-alt)",
              color: "var(--muted)",
              border: "1px solid var(--line)",
            }}
          >
            In progress
          </span>
        )}
      </div>
      <p
        className="mt-2 flex-1 text-sm leading-6"
        style={{ color: "var(--muted)" }}
      >
        {description}
      </p>
      <dl className="mt-4 grid grid-cols-1 gap-1 text-xs" style={{ color: "var(--muted)" }}>
        <div>
          <dt className="inline font-medium">Audience: </dt>
          <dd className="inline">{audience}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Stage: </dt>
          <dd className="inline">{stage}</dd>
        </div>
      </dl>
      <p
        className="mt-4 text-sm font-medium"
        style={{
          color: comingSoon ? "var(--muted)" : "var(--accent)",
        }}
      >
        {cta} {!comingSoon && "→"}
      </p>
    </article>
  );

  if (comingSoon) return inner;
  return (
    <Link href={href} className="block transition-opacity hover:opacity-90">
      {inner}
    </Link>
  );
}
