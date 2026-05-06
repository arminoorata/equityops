import PlanHealthView from "@/components/planHealth/PlanHealthView";

export const metadata = { title: "Stock Plan Health Check" };

export default function PlanHealthPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-10 md:py-16">
      <p
        className="text-xs font-medium uppercase tracking-[0.32em]"
        style={{ color: "var(--accent)" }}
      >
        Stock Plan Health Check
      </p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
        A board-ready stock plan health memo, in one pass.
      </h1>
      <p
        className="mt-3 max-w-2xl text-base leading-7"
        style={{ color: "var(--muted)" }}
      >
        Type in burn rate, overhang, runway, and plan feature inputs. The
        diagnostic returns a Comp Committee-grade memo with the questions
        worth asking legal and finance. ISS-aware. Not a proxy advisor model.
      </p>
      <div className="mt-10">
        <PlanHealthView />
      </div>
    </div>
  );
}
