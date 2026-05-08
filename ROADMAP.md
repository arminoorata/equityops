# Equity Ops Workbench — Build Roadmap

Tools to ship as routes inside the workbench at `equityops.arminoorata.com`.
See [`RESEARCH.md`](./RESEARCH.md) for the full landscape and
[`README.md`](./README.md) for the project overview.

## Positioning lens

Assume the user is on Fidelity, Shareworks, Computershare, E*TRADE, or
Carta as their system of record. **Build only tools that fill the gaps
those platforms can't or don't fill, where practitioners currently use
Excel.** Every tool's value proposition starts with: "your platform
gives you X; this tool turns it into Y."

A tool earns "Build next" status when it scores well on all four:

1. **Stakeholder breadth** — junior + mid + senior, ideally
2. **Cross-stage applicability** — private + public
3. **Content moat** — Armi's 20 years of practice show through in a way
   a generic builder couldn't replicate
4. **Demo strength** — the gap between vendor output and Excel deliverable
   is visible in 60 seconds

---

## Status

This roadmap is a prioritized backlog, not a delivery commitment. Tools
ship one at a time. Quality bar is "would a Fortune 50 stock-based
compensation leader put this in a comp-committee pre-read." If a tool
does not clear that bar, it stays in the queue.

### Available now
1. **Stock Plan Health Check** — live at `/plan-health`
2. **Retirement Vesting Impact Forecaster** — live at `/retirement-vesting`
3. **Equity Event Readiness Planner** — live at `/event-readiness`
4. **Refresh Grant Sizing Tool** — live at `/refresh-sizing`
5. **Grant Distribution Auditor** — live at `/grant-distribution`
6. **Underwater Options Analyzer** — live at `/underwater-options`
7. **Hire Range Equity Calculator** — live at `/hire-range`
8. **AMT Scenario Modeler** — live at `/amt-scenario`
9. **ASC 718 Expense Forecaster** — live at `/asc-718-forecast`
10. **Plan Amendment Impact Modeler** — live at `/plan-amendment`
11. **Comp Committee Memo Builder** — live at `/comp-committee-memo`

### Build next
Eleven tools live. The remaining backlog categories below are open;
order and scope are not committed and several remaining items are
deliberately one-off / niche.

---

## Gap category 1: Strategic modeling

**The vendor doesn't help you decide.** Stock administration platforms
process transactions; they don't model "what if we changed refresh sizing
by 10%" or "what if we added 200 hires to next year's plan."

| Tool | Status | Audience | Stage | Vendor gap it fills |
|---|---|---|---|---|
| Retirement Vesting Impact Forecaster | **Available now** | All | Both | Per-award status, shares vesting due to retirement, shares forfeited, memo for legal/payroll. Vendor shows current state; the "what happens at the retirement date" model lives in Excel. |
| Refresh Grant Sizing Tool | **Available now** | Mid + Sr | Both | Multi-tier refresh logic, performance triggers, vest patterns, exception flags, executive memo. Today: Excel. |
| Hire Range Equity Calculator | **Available now** | All | Both | Translates target equity value into a low / mid / high share range at FMV, builds a vesting schedule with annualized vest value, and produces a recruiter prep memo with ISO/NSO/RSU candidate-context talking points. |
| Plan Amendment Impact Modeler | **Available now** | Sr | Public + late-stage private | Before/after on overhang, runway, and dilution; investor concern flags (high evergreen, large overhang increment, repricing without approval, asymmetric recycling, very short / very long runway); comp-committee memo with legal and finance question list. |
| Dilution Stress Tester | Backlog | Sr | Both | "If we hire 200 more next year, what does overhang look like?" Vendor shows current state, not forward scenarios. |
| M&A Retention Pool Modeler | Backlog | Sr | Both | Acquisition retention pool sizing, conversion ratios, accelerated vesting. Always Excel today. |

---

## Gap category 2: Narrative + memo layer

**The vendor generates numbers; you have to write the story.** Burn-rate
reports come out of every platform. The board memo, the proxy CD&A, the
plan-amendment justification, the question list for legal — those still
get written by hand each quarter.

| Tool | Status | Audience | Stage | Vendor gap it fills |
|---|---|---|---|---|
| Stock Plan Health Check | **Available now** | Sr | Public + late-stage private | Numbers → board-ready memo + question list for legal/finance + plan-feature investor-lens commentary. |
| Pay Ratio Narrative Drafter | Backlog | Sr | Public | Section 953(b) + plain-English narrative. Pairs with ProxyMiner. |
| Proxy CD&A Drafter | Backlog | Sr | Public | Turn inputs into compliant CD&A draft. Vendor doesn't write narrative. |
| Comp Committee Memo Builder | **Available now** | Sr | All stages | Meta-tool: paste markdown summaries from the other workbench tools, add key metrics, risks, open questions, and recommended next steps; assembles a deterministic board-format pre-read with executive summary, decision requested, and disclaimer. |

---

## Gap category 3: Cross-functional coordination

**The vendor processes the event; you orchestrate the work around it.**
Vest events, lockup expirations, IPOs, M&A acceleration, tender
windows — each requires payroll, legal, accounting, IR, and comms to
move in sequence. The vendor doesn't manage that.

| Tool | Status | Audience | Stage | Vendor gap it fills |
|---|---|---|---|---|
| Equity Event Readiness Planner | **Available now** | Mid + Sr | Both | Phased countdown checklist + coordination email drafts for cliffs, double-trigger RSUs at IPO, tender offers, IPO lockup expirations, M&A acceleration, spin-offs, and plan terminations. Stage-aware. |
| 10b5-1 Plan Setup Helper | Backlog | Mid + Sr | Public | Cooling-off, allowed amendments per 2023 amendments. Vendor doesn't validate plan terms. |
| IPO Readiness Checker | Backlog | Sr | Pre-IPO | Granting hygiene, plan structure, share-reserve runway, double-trigger prep. End-to-end checklist. |
| Lockup Expiration Communications Builder | Backlog | Sr | Public | Employee comms + market-signaling considerations. Vendor doesn't draft language. (Note: covered as a sub-event in the Event Readiness Planner; this would be a deeper standalone.) |

---

## Gap category 4: Ad-hoc analytics

**The vendor forces an Excel export for anything non-standard.** "Show
me grants by level by year" or "what's the distribution of underwater
options" or "stack the next year of vest events on a timeline" all start
with a CSV download.

| Tool | Status | Audience | Stage | Vendor gap it fills |
|---|---|---|---|---|
| Grant Distribution Auditor | **Available now** | Mid + Sr | Both | Distribution by level, function, country, year, award type, performance tier, and optional demographic dimensions. Concentration math, cohort outliers, audit memo. Vendor exports raw data; analytics are manual. |
| Underwater Options Analyzer | **Available now** | Mid + Sr | Both | Percent underwater by shares + holders, intrinsic / spread value, depth bands, tranches by year × strike, vested vs unvested split, audit memo. Reports the math; does not recommend repricing. |
| Vest Stack Visualizer | Backlog | Mid + Sr | Both | Upcoming vest events on a timeline, with cliff cohorts and double-trigger events called out. |
| Refresh Multiple Tracker | Backlog | Mid + Sr | Both | Refresh size relative to original new-hire grant, by employee, over time. |

---

## Gap category 5: Tax + AMT scenarios

**The vendor records transactions; you model decisions.** Employees ask
"should I exercise" — the vendor can't answer. Practitioners build
custom Excel models for AMT exposure, ISO/NSO breakeven, multi-grant
sequencing.

| Tool | Status | Audience | Stage | Vendor gap it fills |
|---|---|---|---|---|
| AMT Scenario Modeler | **Available now** | Mid + Sr | Late-stage private + public | Bargain element by grant, regular tax vs tentative minimum tax math, AMT exposure, planning-grade breakeven share count, optional sale scenario. Editable filing-status-driven assumptions; deterministic engine; memo for the conversation with a qualified tax advisor. |
| ISO Disqualifying Disposition Calculator | Backlog | Mid + Sr | Both | Same-day cashless vs held-after-exercise tax outcomes. |
| Multi-Grant Tax Sequencer | Backlog | Mid + Sr | Both | "Which grant should I exercise first" given AMT, holding rules, expected sale. |
| ASC 718 Expense Forecaster | **Available now** | Mid + Sr | Public + late-stage private | Per-period bucketization (quarterly or annual), straight-line and graded vesting recognition, forfeiture and PSU probability assumptions, by-type and by-grant-year totals, accounting memo. Planning forecast; not GAAP-final. |

---

## Gap category 6: Communications + governance

**The vendor doesn't draft language for humans.** Plan amendment
shareholder letters, lockup expiration messaging, manager equity-
education guides — all hand-written today.

| Tool | Status | Audience | Stage | Vendor gap it fills |
|---|---|---|---|---|
| Plan Doc Plain-English Translator | Backlog | All | Both | Turn plan-doc legalese into employee-readable summary. |
| Clawback Policy Builder (Rule 10D-1) | Backlog | Sr | Public | Boilerplate-heavy; useful for newly-public companies. |
| Manager Equity Education Pack | Backlog | Mid + Sr | Both | Briefing pack for hiring managers on grant types, dilution, FMV, vest mechanics. |

---

## What we won't build (in this project)

- **System-of-record tooling.** No cap-table store, no ledger, no
  transaction processing. The practitioner's vendor platform owns the
  source of truth.
- **Server-side ingestion.** Nothing the user provides leaves the
  browser. No uploads to a backend, no persistence, no third-party
  analytics with user data. *Client-side CSV/XLSX parsing is allowed
  and intentional* — for tools whose natural workflow starts with a
  vendor export (e.g., a grants outstanding CSV from Fidelity or
  Shareworks), the file is parsed in-browser and the result lives only
  in the tab's memory for that session.
- **Tax preparation or filing.** Educational scenarios only.
- **ISS / Glass Lewis score replication.** The frameworks are
  proprietary and the 2026 ISS EPSC framework changed. Tools may
  surface ISS-aware *inputs* without claiming to reproduce any score.
- **Personal financial advice for grantees.** The Equity Portal sibling
  handles employee-facing educational content.

---

## Decisions still open

1. **Order across the Build next queue.** Hire Range pairs with the
   Equity Portal sibling and has recurring weekly demand. Distribution
   Auditor pairs with the Plan Health Check and supports DEIB
   conversations. Underwater Options Analyzer is most useful in
   depressed-stock cycles and pairs with plan-amendment thinking.
   Currently sequenced Hire Range → Distribution Auditor → Underwater.
2. **Branding evolution.** The brand identity can grow with the toolbox
   (logo treatment, illustration of the "above the vendor" stack
   metaphor). Currently using the eyebrow-only sibling pattern.
