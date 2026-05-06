import Link from "next/link";
import NavMenu from "./NavMenu";
import ThemeToggle from "./ThemeToggle";

export default function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-20 border-b backdrop-blur"
      style={{
        borderColor: "var(--line)",
        background: "color-mix(in srgb, var(--bg) 88%, transparent)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4 md:px-10">
        <Link href="/" className="block">
          <p
            className="text-xs font-medium uppercase tracking-[0.32em]"
            style={{ color: "var(--accent)" }}
          >
            Equity Ops Workbench
          </p>
        </Link>
        <div className="flex items-center gap-3">
          <NavMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
