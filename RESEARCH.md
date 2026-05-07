# SBC Practitioner Tool Landscape

A practitioner-grade map of who stock-based compensation professionals are,
what jobs they do, where the friction lives, and what kinds of tools would
move the needle.

Written from the viewpoint of a Fortune 50 SBC practitioner. Cited where
possible to specific regulations, deliverables, and stakeholder expectations.

## Operating assumption

Every user already has a stock administration platform: Fidelity
NetBenefits Stock Plan Services, Shareworks (Morgan Stanley at Work),
Computershare, E*TRADE Equity Edge, or Carta for private companies. Those
platforms own the system of record — they process vests, issue grants,
generate Form 4 filings, run standard burn-rate / overhang reports, and
host the employee self-service portal.

**The workbench builds only tools that fill the gaps those platforms
can't or don't fill, where the practitioner currently uses Excel.** Where
the vendor's standard report or workflow already covers the job, the
workbench does not duplicate it. The practitioner's job-to-be-done is
"turn what comes out of the platform into the deliverable my CHRO/CFO/
Comp Committee/employee/legal counterpart actually needs."

Each tool's value proposition starts from this gap. See
[`ROADMAP.md`](./ROADMAP.md) for the gap-organized build queue.

---

## Audience segments

### Junior practitioner (1–3 years)
**Title patterns:** Compensation Analyst, Stock Plan Administrator, Equity
Specialist, Total Rewards Analyst.

**What they actually do day to day:**
- Process new-hire grants in Carta / Shareworks / Computershare.
- Reconcile vest events against payroll feeds.
- Pull cap tables for hiring managers.
- Answer "how does my grant work" tickets from employees.
- Generate one-off Excel models when leadership asks "what if."
- Run vest reports for finance to book ASC 718 expense.
- Maintain the equity inbox and triage employee questions.

**Where they get stuck:**
- Spreadsheet sprawl. Five versions of "Q3_grants_FINAL_v3_Armi.xlsx."
- "Is this number right?" anxiety. No external sanity check.
- Translating legalese for employees without giving advice.
- Vendor platform UI is brittle; some calcs require export-to-Excel.
- Time-zone math on grant effective dates and 83(b) deadlines.

**Tools that would help:**
- Calculation sanity checks (ISO/NSO/RSU outcome calculators).
- Plain-English glossary for employees they can hand off.
- 83(b) deadline tracker (30-day window from exercise).
- Grant-letter quality checker (date, vesting language, share count audit).
- Vest reconciliation diff (vendor report vs payroll feed).

---

### Mid-level practitioner (3–7 years)
**Title patterns:** Senior Compensation Analyst, Equity Compensation Manager,
Stock Plan Manager, Total Rewards Manager.

**What they actually do:**
- Own the new-hire grant approval workflow.
- Run quarterly vest events end-to-end with payroll, legal, accounting.
- Build comp models for refresh cycles, promo pools, M&A retention.
- Maintain the company's pay philosophy doc.
- Coordinate with legal on plan amendments and 10b5-1 setups.
- Review 409A inputs with finance ahead of valuation.
- Build Comp Committee meeting prep materials.
- Handle escalations when an employee disputes a grant or vest.

**Where they get stuck:**
- Cross-functional coordination. Vest events touch payroll, legal, accounting,
  IR, HR ops, comms. No single source of truth on who does what when.
- Communicating tradeoffs. "If we change the vest schedule, what's the burn
  rate impact?" requires building a model from scratch every time.
- Audit trails. "Why did we approve this refresh at 1.5x?" needs to be
  defensible six months later.
- Manager education. Hiring managers want to negotiate equity but don't
  understand strike vs FMV vs dilution. The TR manager becomes the educator.

**Tools that would help:**
- Vesting Event Coordinator (the tool Evan demoed: timeline, owners, comms).
- Refresh Grant Sizing Model (multiple, performance-tier, vest-pattern).
- Burn Rate / Overhang Calculator with peer-band overlay.
- ASC 718 Expense Forecaster (Black-Scholes, expected term, forfeiture).
- Comp Committee Meeting Pack Generator (slides + memos from inputs).
- Grant Approval Workflow Template (rationale, approval chain, audit log).
- Plan Doc Plain-English Translator (employee-facing summary from legalese).

---

### Senior leadership (7+ years)
**Title patterns:** Director / Senior Director / VP Total Rewards, Head of
Compensation, CHRO/CPO direct reports.

**What they actually do:**
- Own the pay philosophy and defend it to CEO/CFO/Board.
- Set granting strategy: new hire bands, refresh cadence, performance vests.
- Approve exec comp recommendations going to the Comp Committee.
- Engage with proxy advisors (ISS, Glass Lewis) on say-on-pay.
- Negotiate with M&A counterparts on retention and conversion.
- Sponsor the equity-related parts of IPO readiness.
- Defend pay equity outcomes to legal, employees, and the public if disclosed.
- Build the narrative for the proxy CD&A and the 10-K Form 4 disclosures.

**Where they get stuck:**
- Executive narrative. Writing "why we paid the CEO X" in a way that survives
  ISS / Glass Lewis without being defensive.
- Strategic optionality. "Should we move from 4-year to 5-year vest? What
  signals does that send?" — there's no playbook, just gut.
- Peer benchmarking that holds up to scrutiny. "Are we competitive?" needs to
  cite specific peers, not just a survey.
- Defending refresh decisions when individual managers want exceptions.
- Board-level calibration. Comp Committee wants one-pagers, not models.

**Tools that would help:**
- Proxy CD&A Drafter (turn inputs into narrative; pairs with ProxyMiner).
- Pay-vs-Performance Table Builder (Dodd-Frank 953(a) compliant).
- Stock Plan Health Check (burn rate + overhang + share reserve runway +
  plan feature flags + board memo draft). Educational diagnostic, not a
  proxy advisor model.
- Peer Group Justification Doc Generator (industry, size, business model).
- Comp Committee One-Pager Templates (board-grade summaries).
- Clawback Policy Builder (Rule 10D-1 compliant).

**Deliberately excluded from this list:**
- *ISS Equity Plan Scorecard score replication.* The ISS EPSC framework is
  proprietary and changed materially in 2026. Any tool that claims to
  replicate the score creates accuracy and legal risk. The toolbox can
  surface ISS-aware *inputs* (burn rate, overhang, plan features that
  matter to ISS) without claiming to reproduce the score itself.
- *Glass Lewis Pay-for-Performance score replication.* Same reasoning.

---

## Company-stage cuts

### Pre-IPO private (sub-$100M ARR)
**Top concerns:**
- 409A timing — when's the next refresh? What triggers a re-valuation
  (financing, secondary, material change)?
- New-hire grant sizing relative to a tiny share pool.
- Founder/early-employee dilution on next round.
- Educating managers and execs who haven't done equity comp before.
- 83(b) elections for early exercises.

**Highest-value tools:**
- 409A Refresh Tracker (12-month deadline + materiality triggers).
- Cap Table Dilution Modeler (post-money option pool sizing).
- New-Hire Equity Bands by Level (offer ranges, modeled as % ownership).
- 83(b) Deadline Tracker.

### Growth-stage private ($100M+ ARR, IPO consideration)
**Top concerns:**
- IPO readiness: granting cadence, plan migration, evergreen vs fixed-amount.
- Tender / secondary coordination.
- Double-trigger RSU mechanics ahead of IPO.
- Refresh discipline as headcount scales past 1000 employees.
- 409A frequency (often quarterly or even monthly close to IPO).
- M&A retention if the company pivots to an acquisition exit.

**Highest-value tools:**
- IPO Readiness Checker (granting hygiene, plan structure, share reserve).
- Tender Offer Coordinator (cross-functional checklist + comms).
- Double-Trigger Vest Event Coordinator (the Evan tool, scoped to private).
- Plan Migration Modeler (option plan → RSU plan transition).
- Refresh Discipline Auditor (multi-year refresh patterns by level/perf).

### Newly public (post-IPO, within 24 months)
**Top concerns:**
- First proxy CD&A under say-on-pay scrutiny.
- Lockup expiration coordination and 10b5-1 setups.
- Section 16 filings (Form 4) for officers and directors.
- ISS / Glass Lewis first-time engagement.
- Burn rate ceiling discipline (now visible in the proxy).

**Highest-value tools:**
- First Proxy CD&A Builder (using ProxyMiner peer data).
- 10b5-1 Plan Setup Helper (cooling-off, allowed amendments).
- Section 16 / Form 4 Filing Tracker (deadlines, transaction reporting).
- ISS PvP Score Estimator (before submission, not after).
- Lockup Expiration Coordinator (employee comms + market signaling).

### Mature public (large-cap)
**Top concerns:**
- Multi-year defensibility of pay decisions.
- ESG and human capital disclosure (Reg S-K Item 101(c)).
- Pay ratio (Section 953(b)) calculation and storyline.
- Performance share unit (PSU) metric design and disclosure.
- Clawback enforcement under Rule 10D-1.

**Highest-value tools:**
- Pay Ratio Calculator + Narrative Drafter.
- PSU Metric Stress Tester (TSR, EPS, financial metric outcomes).
- Multi-Year Pay-for-Performance Defender (alignment over 3-5 years).
- Clawback Policy Builder + Enforcement Tracker.
- Human Capital Disclosure Drafter (S-K 101(c) + 102 narrative).

---

## Tool categories with concrete examples

### 1. Calculation & modeling
| Tool | Audience | Stage | Notes |
|---|---|---|---|
| AMT Modeling Tool | Mid + Sr | Both | Standalone version of the equity-portal AMT row |
| Equity Outcome Calculator (ISO/NSO/RSU) | All | Both | Already in equity-portal; could surface as embeddable widget |
| Lockup Strategy Modeler | Mid + Sr | Public | Hold-vs-sell scenarios at lockup expiration |
| Cap Table Dilution Modeler | Mid + Sr | Private | Multi-round post-money option pool sizing |
| Burn Rate / Overhang Calculator | Mid + Sr | Public | Annual run-rate vs total dilution + share reserve runway |
| ASC 718 Expense Forecaster | Mid + Sr | Both | Black-Scholes, expected term, forfeiture rates |
| Hire Range Equity Calculator | All | Both | Translate $ value to share count given current FMV |
| Refresh Grant Sizing Tool | Mid + Sr | Both | Refresh multiples, performance triggers, vest patterns |
| Pay-vs-Performance Table Builder | Sr | Public | Dodd-Frank 953(a) compliant |

### 2. Process & operations
| Tool | Audience | Stage | Notes |
|---|---|---|---|
| Equity Event Readiness Planner | Mid + Sr | Both | Multi-event-type taxonomy: cliffs, double-trigger RSUs, tender windows, IPO lockups, M&A acceleration, spin-offs. Cross-functional checklist + coordination email drafts. |
| IPO Readiness Checker | Sr | Private→Public | Granting hygiene, plan structure, share reserve |
| Tender Offer Coordinator | Mid + Sr | Private | Cross-functional checklist + comms templates |
| Section 16 Filing Tracker | Mid + Sr | Public | Form 4 deadlines, Rule 144 windows |
| 10b5-1 Plan Setup Helper | Mid + Sr | Public | Cooling-off, allowed amendments per Rule 10b5-1 amendments |
| 409A Refresh Tracker | Jr + Mid | Private | 12-month + materiality trigger logic |
| Equity Comms Generator | All | Both | Grant letters, vest reminders, exit comms |

### 3. Policy & governance
| Tool | Audience | Stage | Notes |
|---|---|---|---|
| Stock Ownership Guidelines Modeler | Sr | Public | Exec ownership tracking |
| Clawback Policy Builder | Sr | Public | Dodd-Frank Rule 10D-1 compliant |
| Insider Trading Policy Generator | Mid + Sr | Public | Blackout windows, pre-clearance |
| Equity Plan Health Check | Sr | Public | Burn rate + overhang + share reserve runway + plan feature flags + board memo. Not a proxy advisor score replication. |
| Peer Group Justification Doc Generator | Sr | Public | Industry, size, business-model alignment |

### 4. Education & communication
| Tool | Audience | Stage | Notes |
|---|---|---|---|
| Equity Education Portal | Employees | Both | Already shipped at equity.arminoorata.com |
| Plain-English Plan Doc Translator | All | Both | Turn legalese into employee-readable summary |
| Exec Compensation Summary Generator | Sr | Public | Plain-English summary of CD&A for Board pre-read |
| Comp Committee Pack Builder | Sr | Public | Quarterly review materials from inputs |
| Total Rewards Storyteller | Mid + Sr | Both | Narrative for offers, reviews, exits |

### 5. Benchmarking & data
| Tool | Audience | Stage | Notes |
|---|---|---|---|
| ProxyMiner | Mid + Sr | Public | Already exists; productize for public access |
| Public Comp Peer Scraper | Sr | Public | Pull CD&A peer data from SEC filings |
| Equity Practice Benchmark | Sr | Both | Burn rate, overhang, vest schedules vs peers |
| Refresh Multiple Calculator | Mid + Sr | Both | New hire vs refresh ratio benchmarking |
| Equity Survey Aggregator | Sr | Both | Across published surveys |

### 6. Compliance & regulatory
| Tool | Audience | Stage | Notes |
|---|---|---|---|
| Section 162(m) Tracker | Mid + Sr | Public | Covered employee determination, $1M limits |
| ASC 718 Footnote Builder | Mid + Sr | Public | Narrative for 10-K |
| Form 4 Generator | Mid + Sr | Public | XBRL-ready Section 16 filing helper |
| Reg S-K Item 402 Mapper | Sr | Public | Required disclosure mapper |
| Pay Ratio (Section 953(b)) Calculator | Sr | Public | CEO pay ratio + narrative |

### 7. Pay equity & fairness
| Tool | Audience | Stage | Notes |
|---|---|---|---|
| Pay Equity Regression | Sr | Both | Already built internally; productize as public version |
| Equity Grant Distribution Auditor | Mid + Sr | Both | Are grants fair across demographics |
| Promotion Equity Tracker | Sr | Both | Refresh + raises across demographics |

---

## What this list deliberately omits

- **System-of-record tooling.** Carta, Shareworks, Computershare, Fidelity,
  E*TRADE own this. The toolbox is the practitioner's scratch pad, not the
  ledger.
- **Tax preparation.** Turbotax / KPMG / Big-4 territory. The toolbox can
  educate and model, but it cannot prepare actual tax filings.
- **Financial advisor recommendations.** "Should I exercise" is a personal
  finance question; the toolbox provides frameworks, not advice.
- **Vendor-locked features.** Anything that requires reading from a specific
  vendor API. The toolbox is provider-agnostic.

---

## Ranking lens for "what to build first"

A tool earns Phase 1 status when it scores well on all four:

1. **Stakeholder breadth** — does it serve junior, mid, AND senior, or just one?
2. **Cross-stage applicability** — does it work for private + public, or one only?
3. **Content moat** — does Armi's 20 years of practice show through in a way
   a generic builder couldn't replicate?
4. **Demo strength** — can a CHRO or CFO see the value in 60 seconds?

See `ROADMAP.md` for the prioritized first-to-build list.
