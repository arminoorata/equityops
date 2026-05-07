/**
 * Checklist and email content per event type. Separated from
 * eventReadiness.ts so the engine logic stays independent of the
 * specific items.
 *
 * Each checklist is a deterministic, ordered list of tasks with:
 * - daysBeforeEvent: signed offset (negative = pre, 0 = event day, positive = post)
 * - ownerFunction: which cross-functional partner owns the item
 * - title: the action itself
 * - rationale: one sentence on why this item matters
 * - category: data / compliance / communication / operational / tax
 *
 * Items can be conditional via `onlyPublic` / `onlyPrivate` flags.
 *
 * Email templates use these tokens:
 *   {eventName}, {eventDate}, {employees}, {shares}, {stage}, {notes}
 * Unknown or empty tokens fall through as bracketed placeholders so
 * the user can see what's missing.
 */

import type {
  EventType,
  ItemCategory,
  StakeholderFunction,
} from "./eventReadiness";

export type ChecklistTemplate = {
  id: string;
  daysBeforeEvent: number;
  ownerFunction: StakeholderFunction;
  title: string;
  rationale: string;
  category: ItemCategory;
  onlyPublic?: boolean;
  onlyPrivate?: boolean;
};

export type EmailTemplate = {
  id: string;
  to: StakeholderFunction;
  subject: string;
  body: string;
  onlyPublic?: boolean;
  onlyPrivate?: boolean;
};

// ───────── VESTING_CLIFF ─────────

const VESTING_CLIFF_CHECKLIST: ChecklistTemplate[] = [
  {
    id: "cliff-1",
    daysBeforeEvent: -30,
    ownerFunction: "TR",
    title: "Pull cliff cohort report — confirm headcount and share counts",
    rationale:
      "Locks in the population size before any communications go out. Catches data drift between offer-letter share counts and stock-admin records.",
    category: "data",
  },
  {
    id: "cliff-2",
    daysBeforeEvent: -30,
    ownerFunction: "PAYROLL",
    title: "Forecast withholding volume for the vest event",
    rationale:
      "Cliff vests can produce a single-day supplemental wage spike. Payroll needs lead time to coordinate withholding rates and any wires required.",
    category: "tax",
  },
  {
    id: "cliff-3",
    daysBeforeEvent: -21,
    ownerFunction: "LEGAL",
    title: "Confirm Section 16 officer status for affected insiders",
    rationale:
      "Any officer or director vesting needs Form 4 within 2 business days. Confirm the trade window and 10b5-1 plan coverage in advance.",
    category: "compliance",
    onlyPublic: true,
  },
  {
    id: "cliff-4",
    daysBeforeEvent: -14,
    ownerFunction: "COMMS",
    title: "Draft pre-vest employee FAQ and reminder",
    rationale:
      "First-cliff employees especially benefit from a plain-English explainer of what to expect (withholding, settlement timing, account access).",
    category: "communication",
  },
  {
    id: "cliff-5",
    daysBeforeEvent: -14,
    ownerFunction: "EQUITY_OPS",
    title: "Verify tax-table updates and award status in stock-admin platform",
    rationale:
      "Stock administration platforms occasionally drift from payroll's withholding schedule. A walkthrough catches it before vest day.",
    category: "operational",
  },
  {
    id: "cliff-6",
    daysBeforeEvent: -7,
    ownerFunction: "TR",
    title: "Reconcile final headcount — flag terminations since T-30",
    rationale:
      "Departures between T-30 and T-7 are the most common source of last-minute reconciliation work. Pull the latest exits list against the cohort.",
    category: "data",
  },
  {
    id: "cliff-7",
    daysBeforeEvent: -3,
    ownerFunction: "COMMS",
    title: "Send pre-vest comm to affected employees",
    rationale:
      "Gives employees a touchpoint to log into the stock plan portal and verify their information before settlement.",
    category: "communication",
  },
  {
    id: "cliff-8",
    daysBeforeEvent: -1,
    ownerFunction: "EQUITY_OPS",
    title: "Run vest event in stock-admin sandbox / pre-production",
    rationale:
      "Catches plan-feature edge cases (rounding rules, hold-back logic, address validation) one day before live processing.",
    category: "operational",
  },
  {
    id: "cliff-9",
    daysBeforeEvent: 0,
    ownerFunction: "EQUITY_OPS",
    title: "Process vest event; verify withholding and share settlement",
    rationale:
      "Live execution. Equity ops + payroll on a shared bridge for any escalations.",
    category: "operational",
  },
  {
    id: "cliff-10",
    daysBeforeEvent: 1,
    ownerFunction: "EQUITY_OPS",
    title: "Reconcile share counts post-event; confirm 0 exceptions",
    rationale:
      "Day-after audit catches any platform errors before tax forms generate.",
    category: "data",
  },
  {
    id: "cliff-11",
    daysBeforeEvent: 7,
    ownerFunction: "PAYROLL",
    title: "Confirm supplemental wage entries on payroll register",
    rationale:
      "Vest income shows on the upcoming W-2 / supplemental wage line. Catch any classification errors while they're easy to fix.",
    category: "tax",
  },
];

// ───────── DOUBLE_TRIGGER_IPO ─────────

const DOUBLE_TRIGGER_IPO_CHECKLIST: ChecklistTemplate[] = [
  {
    id: "dt-1",
    daysBeforeEvent: -60,
    ownerFunction: "IR",
    title: "Confirm IPO date / liquidity-trigger date with bankers and legal",
    rationale:
      "Double-trigger RSU vesting hinges on the second trigger (liquidity event). Coordinate so the trigger date is locked before downstream prep starts.",
    category: "compliance",
  },
  {
    id: "dt-2",
    daysBeforeEvent: -45,
    ownerFunction: "TR",
    title: "Pull RSU schedule of awards subject to double-trigger",
    rationale:
      "Confirms the exact share count vesting at trigger. Distinguishes time-vested portions vs liquidity-conditioned portions.",
    category: "data",
  },
  {
    id: "dt-3",
    daysBeforeEvent: -30,
    ownerFunction: "PAYROLL",
    title: "Choose withholding method (sell-to-cover, net-share, cash)",
    rationale:
      "Pre-IPO companies default to net-share or cash withholding (no public market yet). Post-IPO same-day sell-to-cover is standard. The choice has cash-flow implications.",
    category: "tax",
  },
  {
    id: "dt-4",
    daysBeforeEvent: -30,
    ownerFunction: "TR",
    title: "Brief Comp Committee on vesting volume and dilution impact",
    rationale:
      "Large RSU vests at IPO show up immediately in fully-diluted share counts. Comp committee should see the number before the press hears about it.",
    category: "communication",
  },
  {
    id: "dt-5",
    daysBeforeEvent: -21,
    ownerFunction: "PAYROLL",
    title: "Configure supplemental withholding rates in payroll system",
    rationale:
      "RSU income is supplemental wages; the federal rate is 22% up to a threshold (37% above), plus state. Larger employees may exceed thresholds with a single vest.",
    category: "tax",
  },
  {
    id: "dt-6",
    daysBeforeEvent: -14,
    ownerFunction: "COMMS",
    title: "Distribute employee FAQ on RSU vest at IPO",
    rationale:
      "Most employees see double-trigger vesting once in their career. A clear FAQ reduces support tickets at the most stressful moment.",
    category: "communication",
  },
  {
    id: "dt-7",
    daysBeforeEvent: -7,
    ownerFunction: "EQUITY_OPS",
    title: "Validate stock-admin platform for double-trigger event",
    rationale:
      "Some platforms require manual configuration to recognize the liquidity trigger. A dry-run avoids day-of escalations.",
    category: "operational",
  },
  {
    id: "dt-8",
    daysBeforeEvent: 0,
    ownerFunction: "EQUITY_OPS",
    title: "Trigger vest, withhold, settle shares",
    rationale:
      "Live execution. Equity ops, payroll, and IR on a shared bridge.",
    category: "operational",
  },
  {
    id: "dt-9",
    daysBeforeEvent: 1,
    ownerFunction: "LEGAL",
    title: "File Form 4 for officers/directors who vested",
    rationale:
      "Two business days from the trigger. Coordinate with the EDGAR filer and confirm 10b5-1 coverage if any sales follow.",
    category: "compliance",
    onlyPublic: true,
  },
  {
    id: "dt-10",
    daysBeforeEvent: 7,
    ownerFunction: "PAYROLL",
    title: "Reconcile shares delivered against withholding remitted",
    rationale:
      "Same-day reconciliation against the broker. Catches any over- or under-withholding before tax forms generate.",
    category: "tax",
  },
  {
    id: "dt-11",
    daysBeforeEvent: 30,
    ownerFunction: "TR",
    title: "Send tax-treatment memo to affected employees",
    rationale:
      "Post-event communication explaining what shows on the W-2, the difference between supplemental withholding and actual tax owed, and 10b5-1 / blackout reminders.",
    category: "communication",
  },
];

// ───────── TENDER_OFFER ─────────

const TENDER_OFFER_CHECKLIST: ChecklistTemplate[] = [
  {
    id: "tender-1",
    daysBeforeEvent: -45,
    ownerFunction: "LEGAL",
    title: "Receive and review tender terms from board / buyer",
    rationale:
      "Pin down eligibility (vested-only? all holders? employees vs investors?), price, withholding method, and election window.",
    category: "compliance",
    onlyPrivate: true,
  },
  {
    id: "tender-2",
    daysBeforeEvent: -30,
    ownerFunction: "LEGAL",
    title: "Coordinate 409A implications with valuation provider",
    rationale:
      "A tender at a price above the most recent 409A is a presumptive material event. The next 409A may need to reference the tender.",
    category: "compliance",
    onlyPrivate: true,
  },
  {
    id: "tender-3",
    daysBeforeEvent: -30,
    ownerFunction: "COMMS",
    title: "Brief eligible holders on the offer",
    rationale:
      "First-time tender offer participants need basic education: what tendering means, tax implications, no-action consequences.",
    category: "communication",
  },
  {
    id: "tender-4",
    daysBeforeEvent: -21,
    ownerFunction: "EQUITY_OPS",
    title: "Open election window in the stock administration platform",
    rationale:
      "Election platforms (Carta, Shareworks, Computershare) need configuration for tender mechanics. Test the full flow end-to-end before opening.",
    category: "operational",
  },
  {
    id: "tender-5",
    daysBeforeEvent: -14,
    ownerFunction: "EQUITY_OPS",
    title: "Track election volume and follow up with low-engagement holders",
    rationale:
      "Mid-window check helps identify holders who haven't logged in. Common reasons: unaware of email, account locked, away from office.",
    category: "operational",
  },
  {
    id: "tender-6",
    daysBeforeEvent: -7,
    ownerFunction: "TR",
    title: "Final election count to buyer / company",
    rationale:
      "The buyer needs the final tendered share count to fund the purchase. Lock the count.",
    category: "data",
  },
  {
    id: "tender-7",
    daysBeforeEvent: -3,
    ownerFunction: "EQUITY_OPS",
    title: "Process elections in stock administration platform",
    rationale:
      "Move tendered shares into the closing bucket; confirm transfers in the cap table.",
    category: "operational",
  },
  {
    id: "tender-8",
    daysBeforeEvent: 0,
    ownerFunction: "EQUITY_OPS",
    title: "Tender close — fund settlement and share transfer",
    rationale:
      "Coordinated close with the buyer's transfer agent or escrow.",
    category: "operational",
  },
  {
    id: "tender-9",
    daysBeforeEvent: 1,
    ownerFunction: "PAYROLL",
    title: "Withholding remittance for employee sellers",
    rationale:
      "Tender proceeds for option exercises run as supplemental wages. Confirm the right tax treatment per holder.",
    category: "tax",
    onlyPrivate: true,
  },
  {
    id: "tender-10",
    daysBeforeEvent: 14,
    ownerFunction: "ACCOUNTING",
    title: "1099 / W-2 supplemental processing for tender proceeds",
    rationale:
      "Form generation timing depends on how the tender was structured (1099 for investors, W-2 supplement for option-spread income).",
    category: "tax",
    onlyPrivate: true,
  },
  {
    id: "tender-11",
    daysBeforeEvent: 21,
    ownerFunction: "LEGAL",
    title: "Trigger 409A refresh review",
    rationale:
      "A tender often triggers an interim 409A. Coordinate the new valuation timing.",
    category: "compliance",
    onlyPrivate: true,
  },
];

// ───────── IPO_LOCKUP_EXPIRATION ─────────

const IPO_LOCKUP_CHECKLIST: ChecklistTemplate[] = [
  {
    id: "lockup-1",
    daysBeforeEvent: -30,
    ownerFunction: "LEGAL",
    title: "Pull list of insiders, lock-up scope, and 10b5-1 plan coverage",
    rationale:
      "Lockup expiration is the moment insiders can finally trade. 10b5-1 plans should already be in place; if not, a manual trade-window approval workflow is needed.",
    category: "compliance",
    onlyPublic: true,
  },
  {
    id: "lockup-2",
    daysBeforeEvent: -30,
    ownerFunction: "TR",
    title: "Pull list of restricted shares and current vest status",
    rationale:
      "Establishes the universe of shares that become eligible to trade at expiration.",
    category: "data",
  },
  {
    id: "lockup-3",
    daysBeforeEvent: -21,
    ownerFunction: "IR",
    title: "Coordinate market-signaling communications with leadership",
    rationale:
      "Lockup expirations move share prices on the announcement effect. Pre-coordinate with IR on talking points and any planned company stance.",
    category: "communication",
    onlyPublic: true,
  },
  {
    id: "lockup-4",
    daysBeforeEvent: -14,
    ownerFunction: "EQUITY_OPS",
    title: "Brief brokerage / transfer agent on expected volume",
    rationale:
      "Brokers handling employee accounts may need lead time for elevated volume on expiration day.",
    category: "operational",
  },
  {
    id: "lockup-5",
    daysBeforeEvent: -14,
    ownerFunction: "LEGAL",
    title: "Insider trading policy refresher to affected employees",
    rationale:
      "Even after lockup, blackout windows, 10b5-1 plan rules, and Section 16 reporting obligations still apply. The refresher is ritual prevention.",
    category: "compliance",
    onlyPublic: true,
  },
  {
    id: "lockup-6",
    daysBeforeEvent: -7,
    ownerFunction: "LEGAL",
    title: "Confirm 10b5-1 plan windows and any pending amendments",
    rationale:
      "Plans set up around the IPO often have first allowed trade dates aligned with lockup expiration. Confirm cooling-off periods are met.",
    category: "compliance",
    onlyPublic: true,
  },
  {
    id: "lockup-7",
    daysBeforeEvent: -3,
    ownerFunction: "COMMS",
    title: "Final pre-expiration comm to affected employees",
    rationale:
      "Reminds employees of the trading window, the company's expectation around 10b5-1 use, and the support resources available.",
    category: "communication",
  },
  {
    id: "lockup-8",
    daysBeforeEvent: 0,
    ownerFunction: "EQUITY_OPS",
    title: "Lockup expires — restricted shares unlocked in admin platform",
    rationale:
      "Stock-admin platforms typically remove the lock automatically on the expiration date. Verify the change actually executed.",
    category: "operational",
  },
  {
    id: "lockup-9",
    daysBeforeEvent: 1,
    ownerFunction: "LEGAL",
    title: "Section 16 monitoring — track Form 4 filings",
    rationale:
      "First post-lockup trades trigger Form 4 filings within 2 business days. Active monitoring catches missed deadlines early.",
    category: "compliance",
    onlyPublic: true,
  },
];

// ───────── MA_ACCELERATION ─────────

const MA_ACCELERATION_CHECKLIST: ChecklistTemplate[] = [
  {
    id: "ma-1",
    daysBeforeEvent: -60,
    ownerFunction: "LEGAL",
    title: "Read merger agreement; confirm acceleration mechanics",
    rationale:
      "Single-trigger, double-trigger, and modified-single behaviors differ materially. The exact contractual language drives every downstream calculation.",
    category: "compliance",
  },
  {
    id: "ma-2",
    daysBeforeEvent: -45,
    ownerFunction: "TR",
    title: "Inventory affected awards by trigger type",
    rationale:
      "Each trigger type produces a different set of vested + accelerated shares. Build the master schedule of who gets what under which scenario.",
    category: "data",
  },
  {
    id: "ma-3",
    daysBeforeEvent: -45,
    ownerFunction: "TR",
    title: "Brief Comp Committee on retention and acceleration cost",
    rationale:
      "Acceleration shows on the final accounting; retention pool sizing relates directly to it. Comp Committee approval is typically required.",
    category: "communication",
  },
  {
    id: "ma-4",
    daysBeforeEvent: -30,
    ownerFunction: "LEGAL",
    title: "Coordinate cash-out vs share-conversion mechanics with buyer",
    rationale:
      "Some deals cash out vested options at the spread. Others convert to buyer equity. The mechanics affect employee tax treatment and timing.",
    category: "compliance",
  },
  {
    id: "ma-5",
    daysBeforeEvent: -30,
    ownerFunction: "PAYROLL",
    title: "Tax/withholding implications for accelerated value",
    rationale:
      "Cash-out at closing creates an immediate supplemental-wage event for many employees. Single-day spike requires lead time on the payroll side.",
    category: "tax",
  },
  {
    id: "ma-6",
    daysBeforeEvent: -21,
    ownerFunction: "COMMS",
    title: "Communicate acceleration treatment to affected employees",
    rationale:
      "Pre-closing communications need careful legal review. Employees facing acceleration deserve a clear summary of timing, tax, and any required elections.",
    category: "communication",
  },
  {
    id: "ma-7",
    daysBeforeEvent: -14,
    ownerFunction: "EQUITY_OPS",
    title: "Configure stock-admin for closing-date acceleration",
    rationale:
      "Stock-admin platforms need manual setup for one-time acceleration events. Test in pre-prod before closing.",
    category: "operational",
  },
  {
    id: "ma-8",
    daysBeforeEvent: -7,
    ownerFunction: "TR",
    title: "Final acceleration scope reconciliation",
    rationale:
      "Lock the acceleration counts ahead of the closing-date pre-funding window so the buyer has accurate numbers.",
    category: "data",
  },
  {
    id: "ma-9",
    daysBeforeEvent: -3,
    ownerFunction: "COMMS",
    title: "Closing-date employee comms",
    rationale:
      "Day-of communications confirming what employees can expect: when shares convert, when cash arrives, blackouts post-close.",
    category: "communication",
  },
  {
    id: "ma-10",
    daysBeforeEvent: 0,
    ownerFunction: "EQUITY_OPS",
    title: "Closing — acceleration triggers, settlement begins",
    rationale:
      "Live execution day. Coordination across legal, payroll, equity ops on a shared bridge.",
    category: "operational",
  },
  {
    id: "ma-11",
    daysBeforeEvent: 1,
    ownerFunction: "PAYROLL",
    title: "Cash settlement / share conversion processing",
    rationale:
      "Day-after processing of the final share counts and cash amounts to each affected employee.",
    category: "tax",
  },
  {
    id: "ma-12",
    daysBeforeEvent: 7,
    ownerFunction: "LEGAL",
    title: "Section 16 filings for officers post-close",
    rationale:
      "Closing transactions trigger Form 4 obligations within 2 business days. Cluster filing to reduce error risk.",
    category: "compliance",
    onlyPublic: true,
  },
  {
    id: "ma-13",
    daysBeforeEvent: 14,
    ownerFunction: "PAYROLL",
    title: "Tax forms / W-2 supplements for accelerated and cashed-out shares",
    rationale:
      "Final reconciliation of supplemental wages with payroll register. Ensures W-2 accuracy at year-end.",
    category: "tax",
  },
];

// ───────── SPIN_OFF ─────────

const SPIN_OFF_CHECKLIST: ChecklistTemplate[] = [
  {
    id: "spin-1",
    daysBeforeEvent: -60,
    ownerFunction: "LEGAL",
    title: "Confirm spin-off agreement and equity treatment provisions",
    rationale:
      "Award allocation between ParentCo and SpinCo follows the agreement and any tax-driven concentration rules. Treatment varies per spin.",
    category: "compliance",
  },
  {
    id: "spin-2",
    daysBeforeEvent: -45,
    ownerFunction: "TR",
    title: "Decide ParentCo vs SpinCo employee allocation method",
    rationale:
      "Methods include: convert all to ParentCo, convert all to SpinCo, or split based on go-forward employer. The choice has tax implications under IRC §424.",
    category: "compliance",
  },
  {
    id: "spin-3",
    daysBeforeEvent: -30,
    ownerFunction: "TR",
    title: "Pull awards by employee assignment (Parent / Spin)",
    rationale:
      "Establishes the go-forward roster mapping. Joint-employee cases need explicit decisions.",
    category: "data",
  },
  {
    id: "spin-4",
    daysBeforeEvent: -21,
    ownerFunction: "EQUITY_OPS",
    title: "Stock-admin configuration for award split / conversion",
    rationale:
      "Two new award schedules per converted award. Stock admin needs careful setup so the math is auditable.",
    category: "operational",
  },
  {
    id: "spin-5",
    daysBeforeEvent: -14,
    ownerFunction: "COMMS",
    title: "Communicate award treatment to affected employees",
    rationale:
      "Spin-offs are the most confusing equity event for employees. Plain-English explainers materially reduce support load.",
    category: "communication",
  },
  {
    id: "spin-6",
    daysBeforeEvent: -7,
    ownerFunction: "TR",
    title: "Final allocation reconciliation",
    rationale:
      "Lock the converted award schedules before the spin date so post-spin reporting is clean.",
    category: "data",
  },
  {
    id: "spin-7",
    daysBeforeEvent: 0,
    ownerFunction: "EQUITY_OPS",
    title: "Spin date — awards split per agreement",
    rationale:
      "Live execution. Two new award streams begin, one in each entity.",
    category: "operational",
  },
  {
    id: "spin-8",
    daysBeforeEvent: 1,
    ownerFunction: "LEGAL",
    title: "Form 4 filings, share count corrections",
    rationale:
      "Spin-offs trigger Section 16 reporting at both entities. Coordinate filing across both EDGAR filers.",
    category: "compliance",
    onlyPublic: true,
  },
  {
    id: "spin-9",
    daysBeforeEvent: 14,
    ownerFunction: "TR",
    title: "Tax basis communications to affected employees",
    rationale:
      "Spin-offs change cost basis. Employees need a clear write-up for their tax preparers.",
    category: "tax",
  },
];

// ───────── PLAN_TERMINATION ─────────

const PLAN_TERMINATION_CHECKLIST: ChecklistTemplate[] = [
  {
    id: "term-1",
    daysBeforeEvent: -90,
    ownerFunction: "LEGAL",
    title: "Board action to terminate plan / approve replacement",
    rationale:
      "Plan termination is a formal governance action. The board resolution typically covers transition mechanics for outstanding awards.",
    category: "compliance",
  },
  {
    id: "term-2",
    daysBeforeEvent: -60,
    ownerFunction: "TR",
    title: "Confirm termination treatment (vest / forfeit / buyout)",
    rationale:
      "Outstanding awards need explicit treatment. Common patterns: accelerated vesting, replacement-plan rollover, or staged forfeiture with notice.",
    category: "compliance",
  },
  {
    id: "term-3",
    daysBeforeEvent: -45,
    ownerFunction: "COMMS",
    title: "Develop employee communications strategy",
    rationale:
      "Plan terminations create anxiety. Clear communications timing prevents grapevine-fed rumors.",
    category: "communication",
  },
  {
    id: "term-4",
    daysBeforeEvent: -30,
    ownerFunction: "TR",
    title: "Confirm replacement plan rollover mechanics if applicable",
    rationale:
      "Rolling outstanding awards into a successor plan requires precise mapping. Each award type may need different handling.",
    category: "compliance",
  },
  {
    id: "term-5",
    daysBeforeEvent: -21,
    ownerFunction: "COMMS",
    title: "Brief affected employees on the termination",
    rationale:
      "Population-wide briefing with FAQ, timing, and support resources. Tailored messaging by award status.",
    category: "communication",
  },
  {
    id: "term-6",
    daysBeforeEvent: -14,
    ownerFunction: "EQUITY_OPS",
    title: "Stock-admin shutdown / migration plan in place",
    rationale:
      "Data archival, audit trail, replacement-plan migration. Equity ops owns the operational runbook.",
    category: "operational",
  },
  {
    id: "term-7",
    daysBeforeEvent: -7,
    ownerFunction: "TR",
    title: "Final reconciliation of affected awards",
    rationale:
      "Lock the population and per-award treatment ahead of the termination effective date.",
    category: "data",
  },
  {
    id: "term-8",
    daysBeforeEvent: 0,
    ownerFunction: "EQUITY_OPS",
    title: "Plan termination effective; final processing",
    rationale:
      "Effective-date execution: vesting accelerations processed, forfeitures recorded, replacement-plan rollovers confirmed.",
    category: "operational",
  },
  {
    id: "term-9",
    daysBeforeEvent: 30,
    ownerFunction: "PAYROLL",
    title: "Final tax forms / W-2 supplements for affected events",
    rationale:
      "Year-end W-2 reconciliation for any acceleration or cash-out events.",
    category: "tax",
  },
];

// ───────── Map ─────────

export const CHECKLIST_TEMPLATES: Record<EventType, ChecklistTemplate[]> = {
  VESTING_CLIFF: VESTING_CLIFF_CHECKLIST,
  DOUBLE_TRIGGER_IPO: DOUBLE_TRIGGER_IPO_CHECKLIST,
  TENDER_OFFER: TENDER_OFFER_CHECKLIST,
  IPO_LOCKUP_EXPIRATION: IPO_LOCKUP_CHECKLIST,
  MA_ACCELERATION: MA_ACCELERATION_CHECKLIST,
  SPIN_OFF: SPIN_OFF_CHECKLIST,
  PLAN_TERMINATION: PLAN_TERMINATION_CHECKLIST,
};

// ───────── Email templates ─────────

const EMAILS_VESTING_CLIFF: EmailTemplate[] = [
  {
    id: "cliff-email-payroll",
    to: "PAYROLL",
    subject: "Heads up — cliff vest event {eventDate} ({eventName})",
    body: `Hi Payroll team,

Flagging an upcoming cliff vest event so we can coordinate withholding before the date.

- Event: {eventName}
- Date: {eventDate}
- Estimated affected employees: {employees}
- Estimated shares: {shares}
- Notes: {notes}

What I need from your side:
1. Confirmation of supplemental withholding rate handling for the day-of vest income.
2. Any flags on employees who may exceed federal supplemental thresholds with this single event.
3. Proposed timing for any cash wires from the company to fund withholding.

Happy to set up a 30-minute kickoff. Any time next week works.

Thanks,
Total Rewards`,
  },
  {
    id: "cliff-email-legal",
    to: "LEGAL",
    subject: "Section 16 status check — cliff vest {eventDate}",
    body: `Hi Legal team,

Quick coordination on the upcoming cliff vest event.

- Event: {eventName}
- Date: {eventDate}
- Estimated affected employees: {employees}
- Estimated shares: {shares}

Asks:
1. Identify any Section 16 officers in the affected cohort.
2. Confirm 10b5-1 plan coverage and trade window status for those officers.
3. Walk through Form 4 filing logistics for the trigger date.

Let me know if a brief sync is useful.

Thanks,
Total Rewards`,
    onlyPublic: true,
  },
  {
    id: "cliff-email-comms",
    to: "COMMS",
    subject: "FAQ + reminder needed — cliff vest {eventDate}",
    body: `Hi Comms,

I'd like to coordinate two pieces of employee communication ahead of the cliff vest:

- Event: {eventName}
- Date: {eventDate}
- Estimated affected employees: {employees}

Asks:
1. Pre-vest FAQ (T-14): plain-English explainer of withholding, settlement, account access.
2. Day-of reminder (T-3): what to expect on the vest date, where to log in, who to contact.

I can draft v1 of both. Let me know your preferred review cadence.

Thanks,
Total Rewards`,
  },
];

const EMAILS_DOUBLE_TRIGGER_IPO: EmailTemplate[] = [
  {
    id: "dt-email-payroll",
    to: "PAYROLL",
    subject: "RSU double-trigger vest at IPO — supplemental withholding plan",
    body: `Hi Payroll team,

The IPO trigger is on track for {eventDate}. The double-trigger RSU population vests on that date and creates a single-day supplemental wage event.

- Event: {eventName}
- Trigger date: {eventDate}
- Estimated affected employees: {employees}
- Estimated shares: {shares}

Asks:
1. Choose withholding method (sell-to-cover, net-share, cash). Recommendation: sell-to-cover post-IPO if liquidity is open day one; otherwise net-share.
2. Configure supplemental-wage rate logic (22% federal up to threshold, 37% above; plus state).
3. Plan reconciliation timing for shares delivered vs withholding remitted.

I can pull a population summary by withholding tier this week. Want to set up a sync after that?

Thanks,
Total Rewards`,
  },
  {
    id: "dt-email-legal",
    to: "LEGAL",
    subject: "RSU vesting at IPO — Section 16 filing checklist",
    body: `Hi Legal,

Vesting executes at IPO trigger ({eventDate}). Officers and directors with RSUs in the trigger population will need Form 4 filings within 2 business days.

- Event: {eventName}
- Trigger date: {eventDate}

Asks:
1. Pull current officer/director list and confirm RSU exposure.
2. Confirm 10b5-1 plan coverage for any post-vest sales.
3. Pre-stage EDGAR filing logistics for trigger day + 2.

Happy to walk through the affected awards.

Thanks,
Total Rewards`,
    onlyPublic: true,
  },
  {
    id: "dt-email-comms",
    to: "COMMS",
    subject: "Employee FAQ for IPO RSU vest — needed by T-14",
    body: `Hi Comms team,

The double-trigger RSU population vests at IPO trigger date {eventDate}. For most affected employees this is a once-in-a-career event.

- Event: {eventName}
- Trigger date: {eventDate}
- Estimated affected employees: {employees}

Asks:
1. Co-draft a plain-English FAQ on what double-trigger vesting means.
2. Schedule distribution at T-14.
3. Set up a follow-up support channel for the first week post-trigger.

I can lead on the technical sections; want your eye on tone and timing.

Thanks,
Total Rewards`,
  },
];

const EMAILS_TENDER_OFFER: EmailTemplate[] = [
  {
    id: "tender-email-legal",
    to: "LEGAL",
    subject: "Tender offer election window — review needed",
    body: `Hi Legal,

The tender offer election window is scheduled to open ahead of close on {eventDate}.

- Event: {eventName}
- Close date: {eventDate}
- Estimated affected holders: {employees}

Asks:
1. Final review of the election form.
2. Confirm 409A implications and tentative timing for the next refresh.
3. Walk through tax treatment language for participating holders.

Available to coordinate this week.

Thanks,
Total Rewards`,
    onlyPrivate: true,
  },
  {
    id: "tender-email-payroll",
    to: "PAYROLL",
    subject: "Tender close {eventDate} — withholding on accepted shares",
    body: `Hi Payroll,

We're approaching the tender close on {eventDate}. Withholding requirements on accepted shares vary by award type.

- Event: {eventName}
- Close date: {eventDate}

Asks:
1. Confirm supplemental withholding logic for option-spread proceeds.
2. Plan the wire / payroll cycle to settle withholding within the standard window post-close.
3. Reconciliation cadence post-close.

Thanks,
Total Rewards`,
    onlyPrivate: true,
  },
];

const EMAILS_LOCKUP: EmailTemplate[] = [
  {
    id: "lockup-email-legal",
    to: "LEGAL",
    subject: "Lockup expires {eventDate} — insider trading policy refresher",
    body: `Hi Legal team,

Lockup expiration is on track for {eventDate}. Coordinating the standard pre-expiration tasks.

- Event: {eventName}
- Expiration date: {eventDate}
- Estimated affected insiders: {employees}

Asks:
1. Confirm 10b5-1 plan coverage and first-allowed-trade dates.
2. Refresher comm to insiders on Section 16 filing obligations.
3. Confirm blackout calendar through the next quarterly window.

Thanks,
Total Rewards`,
    onlyPublic: true,
  },
  {
    id: "lockup-email-ir",
    to: "IR",
    subject: "Lockup expiration {eventDate} — coordinate market communications",
    body: `Hi IR team,

The lockup window opens on {eventDate}. Lockup expirations are a known market-signaling event.

- Event: {eventName}
- Expiration date: {eventDate}

Asks:
1. Pre-coordinate talking points for any inbound investor questions.
2. Align on the company stance regarding insider trading post-expiration.
3. Note any planned company purchases / sales to coordinate around 10b5-1 plans.

Thanks,
Total Rewards`,
    onlyPublic: true,
  },
];

const EMAILS_MA: EmailTemplate[] = [
  {
    id: "ma-email-payroll",
    to: "PAYROLL",
    subject: "M&A closing {eventDate} — acceleration cash/share treatment",
    body: `Hi Payroll team,

We're on track to close on {eventDate}. Acceleration mechanics produce a same-day supplemental wage event for affected employees.

- Event: {eventName}
- Closing date: {eventDate}
- Estimated affected employees: {employees}
- Estimated shares: {shares}

Asks:
1. Confirm supplemental withholding handling on the closing-date acceleration.
2. Plan the cash flow for any required wires.
3. Reconciliation timing for the final closing-day register.

Want to set up a sync this week.

Thanks,
Total Rewards`,
  },
  {
    id: "ma-email-legal",
    to: "LEGAL",
    subject: "M&A closing acceleration — Section 16 filings for officers",
    body: `Hi Legal,

The merger closes on {eventDate}. Officer / director acceleration triggers Form 4 filings within 2 business days.

- Event: {eventName}
- Closing date: {eventDate}

Asks:
1. Pull the officer / director list and confirm acceleration scope.
2. Pre-stage cluster-filing logistics for closing + 2.
3. Confirm 10b5-1 plan handling at closing.

Thanks,
Total Rewards`,
    onlyPublic: true,
  },
  {
    id: "ma-email-comms",
    to: "COMMS",
    subject: "M&A closing {eventDate} — affected employee comms by T-21",
    body: `Hi Comms,

Affected employees should receive acceleration treatment communications by T-21. Closing is on {eventDate}.

- Event: {eventName}
- Closing date: {eventDate}
- Estimated affected employees: {employees}

Asks:
1. Co-draft acceleration explainer with technical sections from TR.
2. Plan distribution timing.
3. Confirm legal review of all employee-facing language.

Thanks,
Total Rewards`,
  },
];

const EMAILS_SPIN: EmailTemplate[] = [
  {
    id: "spin-email-legal",
    to: "LEGAL",
    subject: "Spin-off allocation method needs sign-off",
    body: `Hi Legal,

We're locking award allocation methodology ahead of the spin date {eventDate}.

- Event: {eventName}
- Spin date: {eventDate}

Asks:
1. Sign-off on chosen allocation method (Parent / Spin / split).
2. Confirm IRC §424 considerations for the chosen method.
3. Document in board materials for record.

Thanks,
Total Rewards`,
  },
  {
    id: "spin-email-comms",
    to: "COMMS",
    subject: "Spin-off date {eventDate} — employee FAQ on award treatment",
    body: `Hi Comms,

Spin-offs are the most confusing equity event for employees. We have a content target of T-14 for FAQ distribution.

- Event: {eventName}
- Spin date: {eventDate}
- Estimated affected employees: {employees}

Asks:
1. Co-draft FAQ with technical sections from TR.
2. Plan distribution timing and follow-up channel.
3. Coordinate with payroll on tax-basis explainer for post-spin period.

Thanks,
Total Rewards`,
  },
];

const EMAILS_TERMINATION: EmailTemplate[] = [
  {
    id: "term-email-legal",
    to: "LEGAL",
    subject: "Plan termination effective {eventDate} — final filings",
    body: `Hi Legal team,

Plan termination is effective {eventDate}. Coordinating the post-termination filing and audit-trail close.

- Event: {eventName}
- Termination effective date: {eventDate}

Asks:
1. Confirm any required regulatory filings post-termination.
2. Confirm document-retention requirements.
3. Walk through the replacement-plan rollover (if applicable).

Thanks,
Total Rewards`,
  },
  {
    id: "term-email-payroll",
    to: "PAYROLL",
    subject: "Plan termination — final payroll cycle plan",
    body: `Hi Payroll,

The plan terminates on {eventDate}. Any acceleration or cash-out events flow through payroll on or around that date.

- Event: {eventName}
- Termination date: {eventDate}
- Estimated affected employees: {employees}

Asks:
1. Plan the supplemental-wage processing window.
2. Confirm year-end W-2 reconciliation timing.
3. Coordinate any required communication to terminated populations.

Thanks,
Total Rewards`,
  },
];

export const EMAIL_TEMPLATES: Record<EventType, EmailTemplate[]> = {
  VESTING_CLIFF: EMAILS_VESTING_CLIFF,
  DOUBLE_TRIGGER_IPO: EMAILS_DOUBLE_TRIGGER_IPO,
  TENDER_OFFER: EMAILS_TENDER_OFFER,
  IPO_LOCKUP_EXPIRATION: EMAILS_LOCKUP,
  MA_ACCELERATION: EMAILS_MA,
  SPIN_OFF: EMAILS_SPIN,
  PLAN_TERMINATION: EMAILS_TERMINATION,
};
