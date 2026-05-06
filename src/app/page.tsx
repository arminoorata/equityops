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
        Practitioner tools for stock-based compensation.
      </h1>
      <p
        className="mt-4 max-w-2xl text-base leading-7 md:text-lg md:leading-8"
        style={{ color: "var(--muted)" }}
      >
        The orchestration layer between vendor platforms and the work TR teams
        actually do. Diagnose plan health for the board. Plan an equity event
        across payroll, legal, and accounting. Pressure-test refresh logic.
        Free, public, no login.
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
            description="Generate a board-ready stock plan health memo from burn rate, overhang, share reserve runway, and plan feature inputs. ISS-aware, not an ISS score."
            href="/plan-health"
            audience="Heads of Total Rewards · Comp Committee prep"
            stage="Public + late-stage private"
            cta="Open the diagnostic"
          />
          <ToolCard
            title="Equity Event Readiness Planner"
            description="30-day countdown checklist + coordination email drafts for vesting cliffs, double-trigger RSU events, tender windows, IPO lockups, M&A acceleration, and spin-offs."
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
          On the roadmap
        </p>
        <ul
          className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm md:grid-cols-2"
          style={{ color: "var(--muted)" }}
        >
          <li>· Hire Range Equity Calculator</li>
          <li>· Refresh Grant Sizing Tool</li>
          <li>· IPO Readiness Checker</li>
          <li>· 10b5-1 Plan Setup Helper</li>
          <li>· ASC 718 Expense Forecaster</li>
          <li>· Pay Ratio Narrative Drafter</li>
        </ul>
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
