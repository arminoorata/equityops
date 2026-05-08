import GrantDistributionView from "@/components/grantDistribution/GrantDistributionView";

export const metadata = { title: "Grant Distribution Auditor" };

export default function GrantDistributionPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
      <p
        className="text-xs font-medium uppercase tracking-[0.32em]"
        style={{ color: "var(--accent)" }}
      >
        Grant Distribution Auditor
      </p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
        Audit-ready slices of your grant population.
      </h1>
      <p
        className="mt-3 max-w-3xl text-base leading-7"
        style={{ color: "var(--muted)" }}
      >
        Your stock administration platform exports raw rows. Your HRIS knows
        the level, function, country, and tier behind each row. This tool
        joins them into an audit view: distribution by level, function,
        country, grant year, award type, and any optional demographic
        dimension you provide; concentration math; cohort outliers; and a
        memo for TR, DEIB, finance, legal, and the comp committee.
      </p>
      <p
        className="mt-3 max-w-3xl text-sm leading-6"
        style={{ color: "var(--muted)" }}
      >
        Deterministic rules engine. No AI in the audit path. Client-side
        only. Demographic columns are optional, sensitive, and never leave
        your browser tab.
      </p>
      <div className="mt-10">
        <GrantDistributionView />
      </div>
    </div>
  );
}
