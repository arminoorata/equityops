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

A tool earns Phase 1 status when it scores well on all four:

1. **Stakeholder breadth** — junior + mid + senior, ideally
2. **Cross-stage applicability** — private + public
3. **Content moat** — Armi's 20 years of practice show through in a way
   a generic builder couldn't replicate
4. **Demo strength** — the gap between vendor output and Excel deliverable
   is visible in 60 seconds

---

## North star order

1. **Stock Plan Health Check** — live at `/plan-health`
2. **Retirement Vesting Impact Forecaster** — live at `/retirement-vesting`
3. **Equity Event Readiness Planner** — live at `/event-readiness`
4. **Refresh Grant Sizing Tool** — Phase 4 (next)
5. **Hire Range Equity Calculator** — Phase 4
6. Strategic, narrative, and analytics gap-fillers — see categories below

The order picks tools that demonstrate the "above the vendor" framing
clearly and serve senior-leader audiences first.

---

## Gap category 1: Strategic modeling

**The vendor doesn't help you decide.** Stock administration platforms
process transactions; they don't model "what if we changed refresh sizing
by 10%" or "what if we added 200 hires to next year's plan."

| Tool | Phase | Audience | Stage | Vendor gap it fills |
|---|---|---|---|---|
| Retirement Vesting Impact Forecaster | **2 (live)** | All | Both | Per-award status, shares vesting due to retirement, shares forfeited, memo for legal/payroll. Vendor shows current state; the "what happens at the retirement date" model lives in Excel. |
| Refresh Grant Sizing Tool | 4 | Mid + Sr | Both | Multi-tier refresh logic, performance triggers, vest patterns. Today: Excel. |
| Hire Range Equity Calculator | 4 | All | Both | Translate offer-letter $ value to share count given current FMV + dilution + 4-year expected value. Today: Excel. |
| Plan Amendment Impact Modeler | 5 | Sr | Public | "What does adding evergreen do to overhang?" / "What does extending vest do to expense?" Today: custom Excel each time. |
| Dilution Stress Tester | 5 | Sr | Both | "If we hire 200 more next year, what does overhang look like?" Vendor shows current state, not forward scenarios. |
| M&A Retention Pool Modeler | 6 | Sr | Both | Acquisition retention pool sizing, conversion ratios, accelerated vesting. Always Excel today. |

---

## Gap category 2: Narrative + memo layer

**The vendor generates numbers; you have to write the story.** Burn-rate
reports come out of every platform. The board memo, the proxy CD&A, the
plan-amendment justification, the question list for legal — those still
get written by hand each quarter.

| Tool | Phase | Audience | Stage | Vendor gap it fills |
|---|---|---|---|---|
| Stock Plan Health Check | **1 (live)** | Sr | Public + late-stage private | Numbers → board-ready memo + question list for legal/finance + plan-feature investor-lens commentary. |
| Pay Ratio Narrative Drafter | 4 | Sr | Public | Section 953(b) + plain-English narrative. Pairs with ProxyMiner. |
| Proxy CD&A Drafter | 5 | Sr | Public | Turn inputs into compliant CD&A draft. Vendor doesn't write narrative. |
| Comp Committee Memo Builder | 4 | Sr | Public + late-stage private | Quarterly committee pre-read assembly from inputs. |

---

## Gap category 3: Cross-functional coordination

**The vendor processes the event; you orchestrate the work around it.**
Vest events, lockup expirations, IPOs, M&A acceleration, tender
windows — each requires payroll, legal, accounting, IR, and comms to
move in sequence. The vendor doesn't manage that.

| Tool | Phase | Audience | Stage | Vendor gap it fills |
|---|---|---|---|---|
| Equity Event Readiness Planner | **3 (live)** | Mid + Sr | Both | Phased countdown checklist + coordination email drafts for cliffs, double-trigger RSUs at IPO, tender offers, IPO lockup expirations, M&A acceleration, spin-offs, and plan terminations. Stage-aware. |
| 10b5-1 Plan Setup Helper | 5 | Mid + Sr | Public | Cooling-off, allowed amendments per 2023 amendments. Vendor doesn't validate plan terms. |
| IPO Readiness Checker | 6 | Sr | Pre-IPO | Granting hygiene, plan structure, share-reserve runway, double-trigger prep. End-to-end checklist. |
| Lockup Expiration Communications Builder | 6 | Sr | Public | Employee comms + market-signaling considerations. Vendor doesn't draft language. (Note: covered as a sub-event in the Event Readiness Planner; this would be a deeper standalone.) |

---

## Gap category 4: Ad-hoc analytics

**The vendor forces an Excel export for anything non-standard.** "Show
me grants by level by year" or "what's the distribution of underwater
options" or "stack the next year of vest events on a timeline" all start
with a CSV download.

| Tool | Phase | Audience | Stage | Vendor gap it fills |
|---|---|---|---|---|
| Grant Distribution Auditor | 4 | Mid + Sr | Both | Distribution by level, year, demographics. Vendor exports raw data; analytics are manual. |
| Underwater Options Analyzer | 4 | Mid + Sr | Both | What % of outstanding options are underwater, by tranche and grant date. Useful before plan amendments and refresh decisions. |
| Vest Stack Visualizer | 5 | Mid + Sr | Both | Upcoming vest events on a timeline, with cliff cohorts and double-trigger events called out. |
| Refresh Multiple Tracker | 5 | Mid + Sr | Both | Refresh size relative to original new-hire grant, by employee, over time. |

---

## Gap category 5: Tax + AMT scenarios

**The vendor records transactions; you model decisions.** Employees ask
"should I exercise" — the vendor can't answer. Practitioners build
custom Excel models for AMT exposure, ISO/NSO breakeven, multi-grant
sequencing.

| Tool | Phase | Audience | Stage | Vendor gap it fills |
|---|---|---|---|---|
| AMT Scenario Modeler | 4 | Mid + Sr | Both | Standalone version of the equity-portal AMT widget for TR-driven exec conversations. |
| ISO Disqualifying Disposition Calculator | 5 | Mid + Sr | Both | Same-day cashless vs held-after-exercise tax outcomes. |
| Multi-Grant Tax Sequencer | 5 | Mid + Sr | Both | "Which grant should I exercise first" given AMT, holding rules, expected sale. |
| ASC 718 Expense Forecaster | 5 | Mid + Sr | Public | Black-Scholes + expected term + forfeiture → 4-year forecast. Vendor reports current period only. |

---

## Gap category 6: Communications + governance

**The vendor doesn't draft language for humans.** Plan amendment
shareholder letters, lockup expiration messaging, manager equity-
education guides — all hand-written today.

| Tool | Phase | Audience | Stage | Vendor gap it fills |
|---|---|---|---|---|
| Plan Doc Plain-English Translator | 5 | All | Both | Turn plan-doc legalese into employee-readable summary. |
| Clawback Policy Builder (Rule 10D-1) | 5 | Sr | Public | Boilerplate-heavy; useful for newly-public companies. |
| Manager Equity Education Pack | 5 | Mid + Sr | Both | Briefing pack for hiring managers on grant types, dilution, FMV, vest mechanics. |

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

1. **First priority among Phase 4 tools.** Refresh Grant Sizing has the
   broadest immediate utility. Hire Range Equity Calculator pairs with
   the Equity Portal nicely. Plan Amendment Impact Modeler has the
   strongest senior-leader story.
2. **Branding evolution.** The brand identity can grow with the toolbox
   (logo treatment, illustration of the "above the vendor" stack
   metaphor). Currently using the eyebrow-only sibling pattern.
