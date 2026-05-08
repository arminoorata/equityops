import PlanAmendmentView from "@/components/planAmendment/PlanAmendmentView";

export const metadata = { title: "Plan Amendment Impact Modeler" };

export default function PlanAmendmentPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
      <p
        className="text-xs font-medium uppercase tracking-[0.32em]"
        style={{ color: "var(--accent)" }}
      >
        Plan Amendment Impact Modeler
      </p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
        Before / after on overhang, runway, dilution, and investor concerns.
      </h1>
      <p
        className="mt-3 max-w-3xl text-base leading-7"
        style={{ color: "var(--muted)" }}
      >
        Model how a proposed plan-amendment package (additional shares,
        evergreen, share recycling, repricing posture) affects share
        reserve, overhang, runway, dilution, and the investor narrative
        across a forecast horizon. Pair with the Stock Plan Health Check
        and ASC 718 Expense Forecaster for a complete pre-read.
      </p>
      <p
        className="mt-3 max-w-3xl text-sm leading-6"
        style={{ color: "var(--muted)" }}
      >
        Deterministic engine. ISS-aware framing, not a proxy-advisor
        model. No AI in the calculation path. Client-side only. The
        plan document, listing-rule restrictions, shareholder-approval
        requirements, and the comp committee charter control any actual
        amendment.
      </p>
      <div className="mt-10">
        <PlanAmendmentView />
      </div>
    </div>
  );
}
