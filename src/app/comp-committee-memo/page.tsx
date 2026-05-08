import CompCommitteeMemoView from "@/components/compCommitteeMemo/CompCommitteeMemoView";

export const metadata = { title: "Comp Committee Memo Builder" };

export default function CompCommitteeMemoPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
      <p
        className="text-xs font-medium uppercase tracking-[0.32em]"
        style={{ color: "var(--accent)" }}
      >
        Comp Committee Memo Builder
      </p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
        Assemble the pre-read from the workbench tools you already ran.
      </h1>
      <p
        className="mt-3 max-w-3xl text-base leading-7"
        style={{ color: "var(--muted)" }}
      >
        The meta-tool. Paste the markdown summaries from Refresh Sizing,
        Plan Health, Grant Distribution, Underwater Options, Plan
        Amendment, ASC 718, and the rest, add key metrics, risks, open
        questions, and recommended next steps, and assemble a
        deterministic board-format pre-read with executive summary,
        decision requested, and disclaimer.
      </p>
      <p
        className="mt-3 max-w-3xl text-sm leading-6"
        style={{ color: "var(--muted)" }}
      >
        Deterministic templating. No AI in the path. Client-side only.
        Memo assembly tool, not legal, accounting, or financial advice.
        The plan document, comp committee charter, and qualified counsel
        control any committee action.
      </p>
      <div className="mt-10">
        <CompCommitteeMemoView />
      </div>
    </div>
  );
}
