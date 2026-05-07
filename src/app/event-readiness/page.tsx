import EventReadinessView from "@/components/eventReadiness/EventReadinessView";

export const metadata = { title: "Equity Event Readiness Planner" };

export default function EventReadinessPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
      <p
        className="text-xs font-medium uppercase tracking-[0.32em]"
        style={{ color: "var(--accent)" }}
      >
        Equity Event Readiness Planner
      </p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
        Cross-functional countdown checklist for any equity event.
      </h1>
      <p
        className="mt-3 max-w-3xl text-base leading-7"
        style={{ color: "var(--muted)" }}
      >
        Your stock administration platform processes the event. This tool
        orchestrates the work around it. Pick the event type, set the date,
        and get a phased countdown checklist with task owners, rationales,
        and coordination email drafts for payroll, legal, comms, and
        accounting.
      </p>
      <p
        className="mt-3 max-w-3xl text-sm leading-6"
        style={{ color: "var(--muted)" }}
      >
        Deterministic checklist library. No AI in the generation path.
        Stage-aware (private vs public). Outputs copy and download as
        plain markdown.
      </p>
      <div className="mt-10">
        <EventReadinessView />
      </div>
    </div>
  );
}
