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

- `/plan-health` — Stock Plan Health Check
- `/retirement-vesting` — Retirement Vesting Impact Forecaster
- `/event-readiness` — Equity Event Readiness Planner
- `/refresh-sizing` — Refresh Grant Sizing Tool
- `/grant-distribution` — Grant Distribution Auditor
- `/underwater-options` — Underwater Options Analyzer
- `/hire-range` — Hire Range Equity Calculator
- `/amt-scenario` — AMT Scenario Modeler
- `/asc-718-forecast` — ASC 718 Expense Forecaster
- `/plan-amendment` — Plan Amendment Impact Modeler
- `/comp-committee-memo` — Comp Committee Memo Builder
- additional routes ship per [`ROADMAP.md`](./ROADMAP.md)

The existing standalone siblings (`equity.`, `fair.`, `flsa.`, `signs.`,
`jobarchitecture.`) keep their own subdomains because they're products
with their own identity. The workbench is the home for *new* tools
specifically designed to fill vendor-platform gaps.

## Privacy and data handling

- **No server-side ingestion.** The app does not store, transmit, or
  persist any user data on a server. There is no backend, no database,
  no logged account, no analytics tags.
- **Client-side CSV/XLSX parsing is allowed and intentional** for tools
  whose workflow starts with a vendor export (e.g., a grants outstanding
  CSV from Fidelity or Shareworks). The file is read in the browser, the
  parsed result lives in memory for the session, and it is gone the
  moment the tab closes. Nothing is uploaded.
- **No system of record.** The workbench will never become an
  authoritative source of cap-table or grant data. The practitioner's
  stock administration platform owns the source of truth.
- **No external AI calls with employee data.** Where a tool produces
  narrative output, it is generated locally by deterministic templates
  filled with the user's inputs. AI-style explanation is only ever
  layered as optional, opt-in copy generation, never as the engine
  driving an outcome.

## Repository layout

- [`RESEARCH.md`](./RESEARCH.md) — landscape and audience analysis,
  written from the viewpoint of a Fortune 50 SBC practitioner.
- [`ROADMAP.md`](./ROADMAP.md) — prioritized build queue, organized by
  which vendor-platform gap each tool fills.
- `src/` — the Next.js app: chrome, routes, pure-functional libs in
  `src/lib/`, components in `src/components/`, route shells in
  `src/app/`. Co-located vitest test files (`*.test.ts`) live next to
  the libs they cover.

## Cross-references

These existing siblings are referenced from the workbench landing page
but are not rebuilt inside the workbench.

- [`equity.arminoorata.com`](https://equity.arminoorata.com) — Equity
  Education Portal (employee-facing).
- [`fair.arminoorata.com`](https://fair.arminoorata.com) — fair pay
  diagnostic.
- [`flsa.arminoorata.com`](https://flsa.arminoorata.com) — FLSA
  classification.
- [`jobarchitecture.arminoorata.com`](https://jobarchitecture.arminoorata.com)
  — job architecture education.
- ProxyMiner (workflow tool, not a public web app yet) — SEC proxy CD&A
  extraction.
- BenefitMath, ExitPay (referenced in Armi's bio, status TBD).

## What this project will NOT do

- Become a system of record. No persistence, no cap-table store, no
  employee record.
- Compete with vendor platforms. The workbench is the practitioner's
  scratch pad, not the enterprise stack.
- Replicate proprietary scoring frameworks (ISS EPSC, Glass Lewis PvP).
  Tools may surface ISS-aware *inputs* without claiming to reproduce
  any score.
- Provide tax, legal, or financial advice. Outputs are educational
  diagnostics and starting points for conversations with qualified
  advisors.
- Host paid services. Free public, like the rest of the family.

## Build and run

```
npm install
npm run dev      # local dev server
npm run lint     # eslint
npm test         # vitest
npm run build    # next build (static)
```

Each push to `main` auto-deploys via Vercel's GitHub integration.
