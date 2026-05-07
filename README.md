# Equity Ops Workbench

A free public toolbox of practitioner tools for stock-based compensation
professionals at `equityops.arminoorata.com`. Junior to senior leadership.
Private and public companies.

## Positioning

The user is on Fidelity, Shareworks, Computershare, E*TRADE, or Carta as
their system of record. Those platforms process vests, issue grants, run
Form 4 filings, and generate burn-rate / overhang reports. They do **not**
write the board memo, model the refresh, coordinate the cross-functional
equity event, draft the proxy narrative, audit grant distribution, stress-
test plan amendments, or build the AMT scenario for an exec conversation.
That work currently happens in Excel.

**The workbench fills those gaps.** Every tool built here starts from a
specific Excel pain point a practitioner has today. Every tool's value
proposition reads: "your platform gives you X; this tool turns it into Y."
Where the practitioner's vendor already covers the work cleanly, the
workbench leaves it alone.

## Architecture

One Next.js 16 + Tailwind 4 app, one subdomain, each tool as a route:

- `/plan-health` — Stock Plan Health Check (live)
- `/event-readiness` — Equity Event Readiness Planner (Phase 2)
- additional routes ship per `ROADMAP.md`

The existing standalone siblings (`equity.`, `fair.`, `flsa.`, `signs.`,
`jobarchitecture.`) keep their own subdomains because they're products
with their own identity. The workbench is the home for *new* tools
specifically designed to fill vendor-platform gaps.

## Repository layout

- [`RESEARCH.md`](./RESEARCH.md) — landscape and audience analysis. Written
  from the viewpoint of a Fortune 50 SBC practitioner.
- [`ROADMAP.md`](./ROADMAP.md) — prioritized build queue, organized by which
  vendor-platform gap each tool fills.
- `src/` — the Next.js app (chrome, routes, pure-functional libs, tests).

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
