import { describe, expect, it } from "vitest";
import {
  defaultInputs,
  formatDayOffset,
  generatePlan,
  labelEventType,
  MISSING_EVENT_DATE_PLACEHOLDER,
  ownerName,
  parseISODate,
  phaseLabel,
  shiftDays,
  type EventInputs,
  type EventType,
} from "./eventReadiness";

describe("date utilities", () => {
  it("parseISODate parses valid YYYY-MM-DD", () => {
    const d = parseISODate("2026-04-15");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
  });

  it("parseISODate rejects bad input", () => {
    expect(parseISODate("4/15/2026")).toBeNull();
    expect(parseISODate("")).toBeNull();
    expect(parseISODate(null)).toBeNull();
  });

  it("shiftDays moves the date by signed days", () => {
    const d = parseISODate("2026-06-15")!;
    expect(shiftDays(d, -7).getDate()).toBe(8);
    expect(shiftDays(d, 1).getDate()).toBe(16);
    expect(shiftDays(d, 30).getMonth()).toBe(6); // July
  });
});

describe("phaseLabel", () => {
  it("groups days into named phases", () => {
    expect(phaseLabel(-90)).toBe("T-90 to T-45");
    expect(phaseLabel(-45)).toBe("T-90 to T-45");
    expect(phaseLabel(-44)).toBe("T-44 to T-21");
    expect(phaseLabel(-21)).toBe("T-44 to T-21");
    expect(phaseLabel(-7)).toBe("T-20 to T-7");
    expect(phaseLabel(-3)).toBe("T-6 to T-1");
    expect(phaseLabel(0)).toBe("Event day");
    expect(phaseLabel(1)).toBe("Post-event");
    expect(phaseLabel(30)).toBe("Post-event");
  });
});

describe("formatDayOffset", () => {
  it("formats with explicit sign", () => {
    expect(formatDayOffset(-30)).toBe("T-30");
    expect(formatDayOffset(0)).toBe("T-day");
    expect(formatDayOffset(7)).toBe("T+7");
  });
});

describe("ownerName", () => {
  it("falls back to function label when no override", () => {
    expect(ownerName("PAYROLL", undefined)).toBe("Payroll");
    expect(ownerName("LEGAL", {})).toBe("Legal");
  });

  it("uses override when set", () => {
    expect(ownerName("PAYROLL", { PAYROLL: "Pat (payroll lead)" })).toBe(
      "Pat (payroll lead)",
    );
  });

  it("ignores empty/whitespace overrides", () => {
    expect(ownerName("LEGAL", { LEGAL: "   " })).toBe("Legal");
  });
});

describe("labelEventType", () => {
  it("returns a human label for every type", () => {
    const types: EventType[] = [
      "VESTING_CLIFF",
      "DOUBLE_TRIGGER_IPO",
      "TENDER_OFFER",
      "IPO_LOCKUP_EXPIRATION",
      "MA_ACCELERATION",
      "SPIN_OFF",
      "PLAN_TERMINATION",
    ];
    types.forEach((t) => {
      const l = labelEventType(t);
      expect(l.length).toBeGreaterThan(0);
      expect(l).not.toBe(t); // must transform, not echo the enum
    });
  });
});

// ───────── Plan generation ─────────

describe("generatePlan — VESTING_CLIFF", () => {
  const baseInputs: EventInputs = {
    eventType: "VESTING_CLIFF",
    eventDate: "2026-06-15",
    companyStage: "PUBLIC",
    eventName: "1-Year Cliff Cohort Vest",
    estimatedAffectedEmployees: 120,
    estimatedSharesAffected: 240_000,
  };

  it("returns a non-empty checklist sorted by daysBeforeEvent", () => {
    const plan = generatePlan(baseInputs);
    expect(plan.checklist.length).toBeGreaterThan(0);
    for (let i = 1; i < plan.checklist.length; i++) {
      expect(plan.checklist[i].daysBeforeEvent).toBeGreaterThanOrEqual(
        plan.checklist[i - 1].daysBeforeEvent,
      );
    }
  });

  it("includes the Section 16 item only when stage is PUBLIC", () => {
    const publicPlan = generatePlan(baseInputs);
    expect(publicPlan.checklist.some((i) => i.id === "cliff-3")).toBe(true);

    const privatePlan = generatePlan({
      ...baseInputs,
      companyStage: "PRIVATE",
    });
    expect(privatePlan.checklist.some((i) => i.id === "cliff-3")).toBe(false);
  });

  it("computes scheduledDate from event date + offset", () => {
    const plan = generatePlan(baseInputs);
    const t30 = plan.checklist.find((i) => i.daysBeforeEvent === -30);
    expect(t30?.scheduledDate).toBe("2026-05-16");
    const t0 = plan.checklist.find((i) => i.daysBeforeEvent === 0);
    expect(t0?.scheduledDate).toBe("2026-06-15");
    const t1 = plan.checklist.find((i) => i.daysBeforeEvent === 1);
    expect(t1?.scheduledDate).toBe("2026-06-16");
  });

  it("returns placeholder scheduledDate when event date is missing (P2.7)", () => {
    const plan = generatePlan({ ...baseInputs, eventDate: "" });
    expect(plan.eventDateValid).toBe(false);
    plan.checklist.forEach((i) =>
      expect(i.scheduledDate).toBe(MISSING_EVENT_DATE_PLACEHOLDER),
    );
  });

  it("emails are generated and filter by stage", () => {
    const publicPlan = generatePlan(baseInputs);
    expect(publicPlan.emails.length).toBeGreaterThan(0);
    expect(
      publicPlan.emails.some((e) => e.subject.includes("Section 16")),
    ).toBe(true);

    const privatePlan = generatePlan({
      ...baseInputs,
      companyStage: "PRIVATE",
    });
    expect(
      privatePlan.emails.some((e) => e.subject.includes("Section 16")),
    ).toBe(false);
  });

  it("emails fill in event name, date, employees, shares tokens", () => {
    const plan = generatePlan(baseInputs);
    const payrollEmail = plan.emails.find((e) => e.to === "PAYROLL");
    expect(payrollEmail).toBeDefined();
    expect(payrollEmail!.body).toContain(baseInputs.eventName!);
    expect(payrollEmail!.body).toContain(baseInputs.eventDate);
    expect(payrollEmail!.body).toContain("120");
    expect(payrollEmail!.body).toContain("240,000");
  });

  it("uses placeholders when optional inputs are missing", () => {
    const plan = generatePlan({
      eventType: "VESTING_CLIFF",
      eventDate: "2026-06-15",
      companyStage: "PUBLIC",
    });
    const payrollEmail = plan.emails.find((e) => e.to === "PAYROLL");
    expect(payrollEmail!.body).toContain("[# affected employees]");
    expect(payrollEmail!.body).toContain("[# shares affected]");
  });

  it("memo includes event metadata, checklist phases, and disclaimer", () => {
    const plan = generatePlan(baseInputs);
    expect(plan.memo).toContain("Event readiness plan");
    expect(plan.memo).toContain("Vesting cliff event");
    expect(plan.memo).toContain("Public");
    expect(plan.memo).toContain("Countdown checklist");
    expect(plan.memo).toContain("Coordination emails");
    expect(plan.memo).toContain("Disclaimer");
    expect(plan.memo.toLowerCase()).toContain("not legal, tax, or financial");
  });

  it("memo includes notes when provided", () => {
    const plan = generatePlan({
      ...baseInputs,
      notes: "Cohort skews engineering; coordinate with eng leadership",
    });
    expect(plan.memo).toContain("Cohort skews engineering");
  });

  it("memo includes a Recommended next steps section that hands off to the platform of record + cross-functional team", () => {
    const plan = generatePlan(baseInputs);
    expect(plan.memo).toContain("## Recommended next steps");
    expect(plan.memo).toMatch(/cross-functional kickoff/i);
    expect(plan.memo).toMatch(/platform-of-record|Fidelity|Shareworks|Computershare|Carta/);
  });
});

// ───────── Owner overrides ─────────

describe("owner overrides flow through everywhere", () => {
  it("propagates the named owner into checklist items, emails, and memo", () => {
    const plan = generatePlan({
      eventType: "VESTING_CLIFF",
      eventDate: "2026-06-15",
      companyStage: "PUBLIC",
      eventName: "Test event",
      owners: { PAYROLL: "Pat Payroll" },
    });
    const payrollItem = plan.checklist.find((i) => i.ownerFunction === "PAYROLL");
    expect(payrollItem?.ownerName).toBe("Pat Payroll");
    const payrollEmail = plan.emails.find((e) => e.to === "PAYROLL");
    expect(payrollEmail?.toName).toBe("Pat Payroll");
    expect(plan.memo).toContain("Pat Payroll");
  });
});

// ───────── Edge cases ─────────

describe("edge cases", () => {
  it("default inputs produce a usable empty-ish plan", () => {
    const plan = generatePlan(defaultInputs());
    expect(plan.checklist.length).toBeGreaterThan(0);
    expect(plan.memo).toContain("Vesting cliff event");
  });

  it("invalid event date: plan still generates and uses placeholder (P2.7)", () => {
    const plan = generatePlan({
      ...defaultInputs(),
      eventType: "TENDER_OFFER",
      eventDate: "not-a-date",
      companyStage: "PRIVATE",
    });
    expect(plan.eventDateValid).toBe(false);
    expect(plan.checklist.length).toBeGreaterThan(0);
    plan.checklist.forEach((i) =>
      expect(i.scheduledDate).toBe(MISSING_EVENT_DATE_PLACEHOLDER),
    );
    // Memo carries a visible warning and uses the placeholder for Date.
    expect(plan.memo).toContain(MISSING_EVENT_DATE_PLACEHOLDER);
    expect(plan.memo.toLowerCase()).toContain("missing or unparseable");
  });

  it("valid event date: eventDateValid true and memo has no warning (P2.7)", () => {
    const plan = generatePlan({
      ...defaultInputs(),
      eventDate: "2026-12-01",
    });
    expect(plan.eventDateValid).toBe(true);
    expect(plan.memo).not.toContain(MISSING_EVENT_DATE_PLACEHOLDER);
    expect(plan.memo.toLowerCase()).not.toContain("missing or unparseable");
  });

  it("empty notes render as visible '[notes/context]' placeholder in email body (P2.8)", () => {
    const plan = generatePlan({
      eventType: "VESTING_CLIFF",
      eventDate: "2026-06-15",
      companyStage: "PUBLIC",
      eventName: "Test event",
      notes: "",
    });
    const payrollEmail = plan.emails.find((e) => e.to === "PAYROLL");
    expect(payrollEmail).toBeDefined();
    expect(payrollEmail!.body).toContain("[notes/context]");
    // And it should NOT leave a bare 'Notes: ' line.
    expect(payrollEmail!.body).not.toMatch(/Notes:\s*$/m);
  });

  it("provided notes render verbatim (no placeholder leakage) (P2.8)", () => {
    const plan = generatePlan({
      eventType: "VESTING_CLIFF",
      eventDate: "2026-06-15",
      companyStage: "PUBLIC",
      eventName: "Test event",
      notes: "Watch for engineering cohort exposure",
    });
    const payrollEmail = plan.emails.find((e) => e.to === "PAYROLL");
    expect(payrollEmail!.body).toContain("Watch for engineering cohort exposure");
    expect(payrollEmail!.body).not.toContain("[notes/context]");
  });

  it("private-only items appear only when stage is PRIVATE (tender)", () => {
    const tenderPrivate = generatePlan({
      ...defaultInputs(),
      eventType: "TENDER_OFFER",
      eventDate: "2026-09-01",
      companyStage: "PRIVATE",
    });
    expect(tenderPrivate.checklist.some((i) => i.id === "tender-1")).toBe(true);

    const tenderPublic = generatePlan({
      ...defaultInputs(),
      eventType: "TENDER_OFFER",
      eventDate: "2026-09-01",
      companyStage: "PUBLIC",
    });
    expect(tenderPublic.checklist.some((i) => i.id === "tender-1")).toBe(false);
  });

  it("every event type produces a non-empty plan with sample inputs", () => {
    const types: EventType[] = [
      "VESTING_CLIFF",
      "DOUBLE_TRIGGER_IPO",
      "TENDER_OFFER",
      "IPO_LOCKUP_EXPIRATION",
      "MA_ACCELERATION",
      "SPIN_OFF",
      "PLAN_TERMINATION",
    ];
    types.forEach((eventType) => {
      // pick the right stage so private-only items render where applicable
      const stage =
        eventType === "TENDER_OFFER" ? "PRIVATE" : "PUBLIC";
      const plan = generatePlan({
        eventType,
        eventDate: "2026-12-01",
        companyStage: stage,
      });
      expect(plan.checklist.length).toBeGreaterThan(0);
      expect(plan.memo.length).toBeGreaterThan(100);
    });
  });

  it("checklist items have non-empty title and rationale", () => {
    const plan = generatePlan({
      eventType: "MA_ACCELERATION",
      eventDate: "2026-09-01",
      companyStage: "PUBLIC",
    });
    plan.checklist.forEach((i) => {
      expect(i.title.length).toBeGreaterThan(5);
      expect(i.rationale.length).toBeGreaterThan(20);
      expect(i.ownerName.length).toBeGreaterThan(0);
    });
  });

  it("every email has a non-empty subject and body", () => {
    const plan = generatePlan({
      eventType: "DOUBLE_TRIGGER_IPO",
      eventDate: "2026-09-01",
      companyStage: "PUBLIC",
      eventName: "Acme IPO",
    });
    plan.emails.forEach((e) => {
      expect(e.subject.length).toBeGreaterThan(5);
      expect(e.body.length).toBeGreaterThan(50);
      expect(e.body).toContain("Acme IPO");
    });
  });
});
