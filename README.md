# The SBC Toolbox

A free public hub of practitioner tools for stock-based compensation
professionals. Junior to senior leadership. Private and public companies.
Built and maintained by Armi Noorata as part of the AI-applied-to-Total-Rewards
positioning.

> Working name. The brand may change before launch. Working subdomain
> candidates: `sbc.arminoorata.com`, `equityops.arminoorata.com`. Other
> options: `workbench`, `operator`, `granted`.

## What this is

Most SBC tools today are vendor platforms (Carta, Shareworks, Computershare,
Fidelity, E*TRADE) that own the system of record. Equilar sells equity-plan
analysis. ISS publishes the proprietary EPSC framework. Practitioners need
lightweight, focused tools to *think* with — to model an offer, draft a
board memo, audit a refresh cycle, walk an exec through AMT, or coordinate
an equity event across payroll, legal, and accounting. The orchestration
layer is the gap.

The SBC Toolbox is one Next.js app at one subdomain, with each tool as a
route inside it (`/plan-health`, `/event-readiness`, etc.). One catalog,
one navigation, one chrome. Easier to maintain than five separate
subdomains, and the toolbox feel is preserved.

The existing siblings (`fair.`, `signs.`, `flsa.`, `equity.`,
`jobarchitecture.`) keep their own subdomains because they're standalone
products with their own identity. The toolbox is the home for *new*
practitioner tools that share infrastructure.

## What lives here

- [`RESEARCH.md`](./RESEARCH.md) — the landscape: who SBC professionals are,
  what jobs they do, what tools would help. Written from the viewpoint of a
  Fortune 50 SBC practitioner. Source of truth for the catalog.
- [`ROADMAP.md`](./ROADMAP.md) — the prioritized build queue. What ships first,
  what is queued, what stays as a stretch idea. Updated as tools ship.
- The Next.js app (not yet scaffolded) — a simple browseable index of tools
  filtered by audience (junior / mid / senior), company stage (private /
  public / both), and use case (modeling / process / governance / etc.).

## Cross-references

These existing siblings are referenced from the toolbox catalog page (as
links to their own subdomains) but are not rebuilt inside the toolbox.

- [`equity.arminoorata.com`](https://equity.arminoorata.com) — Equity Education
  Portal (employee-facing).
- [`fair.arminoorata.com`](https://fair.arminoorata.com) — fair pay diagnostic.
- [`flsa.arminoorata.com`](https://flsa.arminoorata.com) — FLSA classification.
- [`jobarchitecture.arminoorata.com`](https://jobarchitecture.arminoorata.com)
  — job architecture education.
- ProxyMiner (workflow tool, not a public web app yet) — SEC proxy CD&A
  extraction.
- BenefitMath, ExitPay (referenced in Armi's bio, status TBD).

## What this project will NOT do

- It will not become a system of record. No employee data, no cap tables, no
  ledger.
- It will not compete with vendor platforms. The toolbox is the practitioner's
  scratch pad, not the enterprise stack.
- It will not host paid services. Free public, like the rest of the family.

## North star

After a market check (Equilar, ISS 2026 EPSC, Mercer guidance, Wealthlane,
OptionTrax) and Codex review, the order is:

1. **Phase 1: Stock Plan Health Check Lite** — board-ready stock plan
   health memo. Burn rate, overhang, share reserve runway, plan feature
   flags, questions to ask legal/finance, board memo draft, with a clear
   "not a proxy advisor model" disclaimer. Best fit for Armi's CHRO/CFO
   thought-leadership positioning.
2. **Phase 2: Equity Event Readiness Planner** — broader than Evan's
   vesting-only tool. Covers vesting cliffs, double-trigger RSUs at IPO,
   tender windows, IPO lockups, M&A acceleration, spin-offs. Cross-
   functional checklists + coordination email drafts.
3. **Phase 3+:** Hire Range Equity Calculator, Refresh Sizing, IPO
   Readiness, 10b5-1 Setup, ASC 718 Forecaster. See [`ROADMAP.md`](./ROADMAP.md).

## Open questions for Armi

1. **Brand name and subdomain.** Working candidates: `sbc.arminoorata.com`
   or `equityops.arminoorata.com`. Other options: `workbench`, `operator`,
   `granted`, `vested`.
2. **Phase 1 working title.** Candidates in [`ROADMAP.md`](./ROADMAP.md):
   "Stock Plan Health Check," "Board-Ready Stock Plan Health Memo,"
   "ISS-Aware Stock Plan Readiness Check."
3. **Scaffold timing.** Project foundation is in place. Next step: clone
   `jobarchitecture/` as the Next.js 16 + Tailwind 4 starting point, set up
   the `/plan-health` route, and start the Stock Plan Health Check Lite
   build.
