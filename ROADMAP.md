# SBC Toolbox — Build Roadmap

Prioritized queue of tools to ship under a single sibling subdomain (working
name `sbc.arminoorata.com` or `equityops.arminoorata.com`). The toolbox is
the Next.js app; each tool is a route inside it (`/plan-health`,
`/event-readiness`, etc.). See [`RESEARCH.md`](./RESEARCH.md) for the full
landscape.

> **Architecture decision (2026-04-30):** one subdomain with routed tools,
> not one subdomain per tool. Easier to maintain, lower hosting overhead,
> coherent toolbox feel. Existing siblings (FAIR, SIGNS, FLSA, EQUITY) keep
> their own subdomains because they're standalone products with their own
> identity. The toolbox is the home for *new* practitioner tools that share
> a navigation and chrome.

## Ranking lens

A tool earns top-of-roadmap status when it scores well on all four:

1. **Stakeholder breadth** — junior + mid + senior, ideally
2. **Cross-stage applicability** — private + public
3. **Content moat** — Armi's 20 years of SBC practice show through in a way
   a generic builder couldn't replicate
4. **Demo strength** — value visible to a CHRO/CFO in 60 seconds

---

## North star order

1. **Stock Plan Health Check Lite** (Phase 1)
2. **Equity Event Readiness Planner** (Phase 2)
3. Hire Range Equity Calculator + queued items (Phase 3+)

This order was set after a market check against Equilar (sells equity-plan
analysis), ISS (proprietary EPSC framework changed in 2026), Mercer (2026
ISS equity plan assessment guidance), Wealthlane and OptionTrax (vendor
plan administration). The gap is the **board-ready narrative layer**, not
another vendor calculator.

---

## Phase 1 — Stock Plan Health Check Lite

The senior-leader-facing diagnostic. Inputs: shares granted last 3 years,
shares outstanding, exercised, cancelled, share reserve, public/private
status, plan structure flags. Outputs:

- **Burn rate** (3-year average and trailing year)
- **Overhang** (total dilution from outstanding equity awards)
- **Share reserve runway** (years remaining at current run-rate)
- **Plan feature flags** (single-trigger acceleration, evergreen vs fixed
  reserve, repricing without shareholder approval, share recycling
  treatment, dividend equivalents on unvested equity)
- **Questions to ask legal / finance** (a checklist of "if X, ask Y")
- **Board memo draft** (plain-English narrative the user can paste into
  Comp Committee pre-read)
- **Disclaimer line:** "This is an educational health check, not an ISS,
  Glass Lewis, or other proxy advisor model. Proprietary scoring frameworks
  are not replicated here."

### Why this first
- **Stakeholder breadth:** primary user is senior leadership, but mid-level
  practitioners use it for prep.
- **Cross-stage:** mostly public + late-stage private; minimal private path.
- **Content moat:** the *narrative* output (what to put in a board memo,
  what questions to raise with legal) is where Armi's 20 years show through.
  Numbers alone are commoditized; framing isn't.
- **Demo strength:** one URL, structured inputs, board-ready output. A CHRO
  or CFO sees the value immediately.

### Anti-scope (deliberate omissions)
- **No ISS / Glass Lewis score replication.** Their scoring methodologies
  are proprietary, and the 2026 ISS Equity Plan Scorecard (EPSC) changed
  the framework. Replicating either is a legal and accuracy risk. The tool
  is *ISS-aware* in the sense that it surfaces the inputs ISS cares about,
  but it does not output a score.
- **No system-of-record integration.** Inputs are typed.
- **No SOX or audit-trail features.** This is a thinking tool, not a
  control.

### Working title alternatives
- **Stock Plan Health Check** (descriptive)
- **Board-Ready Stock Plan Health Memo** (output-focused)
- **ISS-Aware Stock Plan Readiness Check** (positioning-focused)

Pick whichever Armi feels strongest about; the route name (`/plan-health`)
stays stable regardless.

---

## Phase 2 — Equity Event Readiness Planner

Broadens the original Vesting Event Coordinator idea. Covers any
significant equity event a TR team has to coordinate, not just routine
vesting. Event types in scope:

- Vesting cliffs (1-year-cliff cohort hitting at scale)
- Double-trigger RSU vesting at IPO
- Tender offer windows (private secondary)
- IPO lockup expiration
- M&A acceleration (single-trigger, double-trigger, modified single)
- Spin-off equity treatment
- Plan termination / replacement events

For each event type, the tool produces:

- 30-day countdown checklist with task owners (TR, payroll, legal,
  accounting, comms, IR)
- One-sentence rationale per item explaining why it matters
- Coordination email drafts to payroll, legal, comms with the right details
- Stage-specific variants (private vs public, US vs international where
  the rules diverge)
- Export to .ics or markdown

### Why second, not first
- The senior-leader demo for Stock Plan Health Check is sharper for thought
  leadership positioning.
- Event Readiness is more visible to the TR community on social channels
  but lower stakes per use.
- Both tools share infrastructure (the Next.js shell), so building them in
  sequence is efficient.

### Differentiator vs Evan's tool
- Multi-event-type taxonomy, not just vesting.
- Stage-aware: private and public versions of the same event have different
  checklists.
- Generates the *coordination email* that payroll and legal actually need,
  not a generic notification.
- Free, public, and brand-aligned with Armi's other tools.

---

## Phase 3 — queued

### Hire Range Equity Calculator
Translate $ value into share counts given current FMV and vest pattern.
Junior + mid daily workhorse. Pairs naturally with the Equity Portal.
Audience: junior + mid. Stage: both. Demo: medium.

### Refresh Grant Sizing Tool
Multi-tier refresh logic with performance triggers and vest patterns.
Audience: mid + senior. Stage: both. Demo: medium.

### IPO Readiness Checker
Granting hygiene + plan structure + share reserve runway + double-trigger
prep. Audience: senior. Stage: late-stage private. Demo: high (bursty).

### 10b5-1 Plan Setup Helper
Compliant with the 2023 Rule 10b5-1 amendments (cooling-off, single-plan
limits, allowed amendments). Audience: mid + senior. Stage: public. Demo:
high for newly public.

### ASC 718 Expense Forecaster
Black-Scholes + expected term + forfeiture rates → 4-year quarterly
forecast. Audience: mid + senior + finance. Stage: both. Demo: medium
(technical audience).

### Pay Ratio Narrative Drafter
Section 953(b) calculation + plain-English narrative for proxy. Pairs with
ProxyMiner. Audience: senior. Stage: public. Demo: medium-high in season.

---

## Stretch / future

- Equity Grant Distribution Auditor (pay equity for grants)
- Section 16 / Form 4 Filing Tracker
- Clawback Policy Builder (Rule 10D-1)
- Tender Offer Coordinator (subset of Event Readiness)
- Equity Plan Migration Modeler (option → RSU)
- Pay-vs-Performance Table Builder (Dodd-Frank 953(a))

---

## What we won't build (in this project)

- System-of-record tooling (cap tables, ledgers).
- Tax preparation or filing.
- Personal financial advice for grantees (Equity Portal handles education).
- Anything that ingests cap-table or payroll data (typed inputs only).
- ISS / Glass Lewis score replication (proprietary, accuracy risk).

---

## Decisions still open

1. **Brand name for the toolbox.** Working: `sbc.arminoorata.com` or
   `equityops.arminoorata.com`. Other options: `workbench`, `operator`,
   `granted`, `vested`. Pick before scaffolding so the Next.js project
   names + GitHub repo align.
2. **Phase 1 working title.** Three candidates above; pick whichever feels
   strongest in Armi's voice.
3. **Scaffold timing.** Project foundation is in place. Next step: clone
   `jobarchitecture/` as the Next.js + Tailwind 4 starting point, set up
   the `/plan-health` route, and start the Stock Plan Health Check Lite
   build.
