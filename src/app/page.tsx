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

      {/* ──────── Available now ──────── */}
      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p
            className="text-[11px] font-medium uppercase tracking-[0.18em]"
            style={{ color: "var(--accent)" }}
          >
            Available now
          </p>
          <p
            className="max-w-md text-[11px] leading-5"
            style={{ color: "var(--muted)" }}
          >
            Built, tested, and live. Each tool starts from a vendor export and
            ends with a deliverable a senior leader would put in a pre-read.
          </p>
        </div>
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
            title="Retirement Vesting Impact Forecaster"
            description="Turn a grants outstanding CSV into a retirement-date impact analysis: which awards fully vest, which pro-rate, which forfeit. Deterministic rules engine with a copyable memo for equity, legal, and payroll review."
            href="/retirement-vesting"
            audience="Equity admin · TR managers · senior leaders prepping a retirement"
            stage="Private + public"
            cta="Open the forecaster"
          />
          <ToolCard
            title="Equity Event Readiness Planner"
            description="Phased countdown checklist + coordination email drafts for vesting cliffs, double-trigger RSU events at IPO, tender offers, IPO lockup expirations, M&A acceleration, spin-offs, and plan terminations. Your platform processes the event; this orchestrates the work around it."
            href="/event-readiness"
            audience="TR managers · Equity ops · Senior leaders prepping a transaction"
            stage="Private + public"
            cta="Open the planner"
          />
          <ToolCard
            title="Refresh Grant Sizing Tool"
            description="Multi-tier refresh logic by level × performance tier. Translates dollars to share count at FMV, flags above/below-guideline rows and retention overrides, and produces a comp-committee-ready memo with budget summary and exception list."
            href="/refresh-sizing"
            audience="TR leaders · Comp consulting · Comp Committee prep"
            stage="Private + public"
            cta="Open the tool"
          />
        </div>
      </section>

      {/* ──────── Build next ──────── */}
      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p
            className="text-[11px] font-medium uppercase tracking-[0.18em]"
            style={{ color: "var(--text)" }}
          >
            Build next
          </p>
          <p
            className="max-w-md text-[11px] leading-5"
            style={{ color: "var(--muted)" }}
          >
            The next tools in the queue. Scoped, not yet built. Listed in
            current priority order.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <ToolCard
            title="Hire Range Equity Calculator"
            description="Translate offer-letter dollar value to share count given current FMV, dilution, and 4-year expected value. The tool recruiters and TR partners reach for during every offer cycle."
            href="#"
            audience="Recruiters · TR partners · Hiring managers"
            stage="Private + public"
            cta="Designing"
            status="Build next"
          />
          <ToolCard
            title="Grant Distribution Auditor"
            description="Distribution by level, year, country, and demographics from a grants outstanding export. The slice-and-dice your platform makes you do in Excel before any committee or DEIB conversation."
            href="#"
            audience="TR leaders · DEIB partners · Audit prep"
            stage="Private + public"
            cta="Scoping"
            status="Build next"
          />
          <ToolCard
            title="Underwater Options Analyzer"
            description="What share of outstanding options are underwater, by tranche and grant date. The pre-read for any plan-amendment or refresh decision in a depressed-stock environment."
            href="#"
            audience="TR leaders · Comp Committee prep · Plan amendment design"
            stage="Public"
            cta="Scoping"
            status="Build next"
          />
        </div>
      </section>

      {/* ──────── Backlog ──────── */}
      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p
            className="text-[11px] font-medium uppercase tracking-[0.18em]"
            style={{ color: "var(--text-secondary)" }}
          >
            Backlog
          </p>
          <p
            className="max-w-md text-[11px] leading-5"
            style={{ color: "var(--muted)" }}
          >
            Vetted ideas grouped by the vendor-platform gap they fill. Order
            and scope are not committed. This is the roadmap, not a
            commitment to ship every item.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-6 text-sm md:grid-cols-2">
          <BacklogColumn
            title="Strategic modeling"
            why="Vendors process; they don’t model. These tools take a what-if and return a number."
            items={[
              "Plan Amendment Impact Modeler",
              "Dilution Stress Tester",
              "M&A Retention Pool Modeler",
            ]}
          />
          <BacklogColumn
            title="Narrative + memo layer"
            why="Vendors generate numbers. The board memo, the proxy narrative, and the question list still get written by hand."
            items={[
              "Pay Ratio Narrative Drafter",
              "Proxy CD&A Drafter",
              "Comp Committee Memo Builder",
            ]}
          />
          <BacklogColumn
            title="Cross-functional coordination"
            why="Vendors process the event. The phased work that surrounds it (payroll, legal, IR, comms) happens elsewhere."
            items={[
              "10b5-1 Plan Setup Helper",
              "IPO Readiness Checker",
              "Lockup Expiration Communications Builder",
            ]}
          />
          <BacklogColumn
            title="Ad-hoc analytics"
            why="Vendors force an Excel export for anything non-standard. These pre-build the slices practitioners use most."
            items={["Vest Stack Visualizer", "Refresh Multiple Tracker"]}
          />
          <BacklogColumn
            title="Tax + AMT scenarios"
            why="Vendors record transactions; they don’t model decisions. These are the Excel models employees and execs ask TR for."
            items={[
              "AMT Scenario Modeler",
              "ISO Disqualifying Disposition Calculator",
              "Multi-Grant Tax Sequencer",
              "ASC 718 Expense Forecaster",
            ]}
          />
          <BacklogColumn
            title="Communications + governance"
            why="Vendors don’t draft language for humans. These bridge plan-doc legalese and the people who need to read it."
            items={[
              "Plan Doc Plain-English Translator",
              "Clawback Policy Builder (Rule 10D-1)",
              "Manager Equity Education Pack",
            ]}
          />
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
            · employee equity education
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
            · fair pay diagnostic
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
            · FLSA classification
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
            · job architecture
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
  status,
}: {
  title: string;
  description: string;
  href: string;
  audience: string;
  stage: string;
  cta: string;
  /** Optional status chip: "Live", "Build next", "In progress". */
  status?: string;
}) {
  const isLink = href !== "#";
  const statusTone = status === "Live"
    ? { background: "var(--accent-soft)", color: "var(--accent)" }
    : { background: "var(--surface-alt)", color: "var(--muted)" };
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
        {status && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
            style={{
              ...statusTone,
              border: "1px solid var(--line)",
            }}
          >
            {status}
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
          color: isLink ? "var(--accent)" : "var(--muted)",
        }}
      >
        {cta} {isLink && "→"}
      </p>
    </article>
  );

  if (!isLink) return inner;
  return (
    <Link href={href} className="block transition-opacity hover:opacity-90">
      {inner}
    </Link>
  );
}

function BacklogColumn({
  title,
  why,
  items,
}: {
  title: string;
  why: string;
  items: string[];
}) {
  return (
    <div>
      <p
        className="text-xs font-medium uppercase tracking-[0.14em]"
        style={{ color: "var(--text)" }}
      >
        {title}
      </p>
      <p className="mt-1 text-[11px] leading-5" style={{ color: "var(--muted)" }}>
        {why}
      </p>
      <ul className="mt-2 space-y-1" style={{ color: "var(--muted)" }}>
        {items.map((item) => (
          <li key={item}>· {item}</li>
        ))}
      </ul>
    </div>
  );
}
