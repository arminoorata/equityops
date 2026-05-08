import AmtScenarioView from "@/components/amtScenario/AmtScenarioView";

export const metadata = { title: "AMT Scenario Modeler" };

export default function AmtScenarioPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
      <p
        className="text-xs font-medium uppercase tracking-[0.32em]"
        style={{ color: "var(--accent)" }}
      >
        AMT Scenario Modeler
      </p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
        ISO exercise planning math at a glance.
      </h1>
      <p
        className="mt-3 max-w-3xl text-base leading-7"
        style={{ color: "var(--muted)" }}
      >
        Model the AMT exposure of a proposed ISO exercise at a planning
        level. Walk regular tax versus tentative minimum tax, surface a
        breakeven share count, and produce a memo for the conversation
        between the equity holder, TR / equity ops, and a qualified tax
        advisor. Editable assumptions; deterministic math.
      </p>
      <p
        className="mt-3 max-w-3xl text-sm leading-6"
        style={{ color: "var(--muted)" }}
      >
        Deterministic engine. No AI in the calculation path. Client-side
        only. Not tax advice. State tax and AMT credit carryforward are
        not modeled. The employee needs a qualified tax advisor for any
        actual filing decision.
      </p>
      <div className="mt-10">
        <AmtScenarioView />
      </div>
    </div>
  );
}
