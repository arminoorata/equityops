import UnderwaterOptionsView from "@/components/underwaterOptions/UnderwaterOptionsView";

export const metadata = { title: "Underwater Options Analyzer" };

export default function UnderwaterOptionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
      <p
        className="text-xs font-medium uppercase tracking-[0.32em]"
        style={{ color: "var(--accent)" }}
      >
        Underwater Options Analyzer
      </p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
        How much of the option pool is underwater, and how deep.
      </h1>
      <p
        className="mt-3 max-w-3xl text-base leading-7"
        style={{ color: "var(--muted)" }}
      >
        Your stock administration platform exports options outstanding. This
        tool turns it into the audit view you need before any plan amendment,
        refresh decision, or repricing conversation: percent underwater by
        shares and holders, intrinsic and spread value, depth bands,
        tranches by year and strike, vested vs unvested exposure, and a memo
        for TR, finance, accounting, legal, and the comp committee.
      </p>
      <p
        className="mt-3 max-w-3xl text-sm leading-6"
        style={{ color: "var(--muted)" }}
      >
        Deterministic intrinsic-value math. No AI in the audit path. Client-
        side only. The analyzer reports the math; it does not recommend
        repricing.
      </p>
      <div className="mt-10">
        <UnderwaterOptionsView />
      </div>
    </div>
  );
}
