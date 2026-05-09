"use client";

import { useMemo, useState, useRef } from "react";
import {
  analyzeAwards,
  composeRetirementMemo,
  defaultPolicy,
  type Award,
  type AwardResult,
  type AwardStatus,
  type AwardTreatment,
  type AwardType,
  type EligibilityRule,
  type EmployeeContext,
  type ProRataMethod,
  type RetirementPolicy,
} from "@/lib/retirementVesting";
import {
  importCsv,
  SAMPLE_CSV_TEMPLATE,
  type ImportResult,
} from "@/lib/csvImport";
import {
  SAMPLE_AWARDS,
  SAMPLE_EMPLOYEE,
  SAMPLE_POLICY,
} from "@/lib/sampleRetirementData";

/**
 * Retirement Vesting Impact Forecaster — main view.
 *
 * Layout:
 *   - Sample/Clear banner up top
 *   - Two-column work area:
 *       Left: employee context + retirement policy + awards (manual + CSV)
 *       Right: eligibility, per-award results, summary, memo
 *
 * Pure-functional engine in src/lib/retirementVesting.ts. No AI in
 * the calculation path. Client-side only.
 */
export default function RetirementVestingView() {
  const [employee, setEmployee] = useState<EmployeeContext>(SAMPLE_EMPLOYEE);
  const [policy, setPolicy] = useState<RetirementPolicy>(SAMPLE_POLICY);
  const [awards, setAwards] = useState<Award[]>(SAMPLE_AWARDS);
  const [usingSample, setUsingSample] = useState(true);
  const [memoCopied, setMemoCopied] = useState(false);
  const [csvCopied, setCsvCopied] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importMessage, setImportMessage] = useState<{
    kind: "ok" | "error";
    text: string;
    unmapped?: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analysis = useMemo(
    () => analyzeAwards(awards, employee, policy),
    [awards, employee, policy],
  );
  const memo = useMemo(
    () => composeRetirementMemo(analysis, employee, policy),
    [analysis, employee, policy],
  );

  const setEmpField = <K extends keyof EmployeeContext>(
    key: K,
    value: EmployeeContext[K],
  ) => {
    setEmployee((prev) => ({ ...prev, [key]: value }));
    setUsingSample(false);
  };

  const updatePolicy = (next: Partial<RetirementPolicy>) => {
    setPolicy((prev) => ({ ...prev, ...next }));
    setUsingSample(false);
  };

  const updateRule = (next: Partial<EligibilityRule>) => {
    setPolicy((prev) => ({
      ...prev,
      eligibilityRule: { ...prev.eligibilityRule, ...next } as EligibilityRule,
    }));
    setUsingSample(false);
  };

  const setRuleType = (type: EligibilityRule["type"]) => {
    let newRule: EligibilityRule;
    switch (type) {
      case "NONE":
        newRule = { type: "NONE" };
        break;
      case "AGE":
        newRule = { type: "AGE", ageThreshold: 55 };
        break;
      case "SERVICE":
        newRule = { type: "SERVICE", serviceThreshold: 10 };
        break;
      case "AGE_AND_SERVICE":
        newRule = { type: "AGE_AND_SERVICE", ageThreshold: 55, serviceThreshold: 10 };
        break;
      case "AGE_OR_SERVICE":
        newRule = { type: "AGE_OR_SERVICE", ageThreshold: 65, serviceThreshold: 15 };
        break;
      case "AGE_PLUS_SERVICE":
        newRule = {
          type: "AGE_PLUS_SERVICE",
          combinedThreshold: 65,
          minAge: 55,
        };
        break;
    }
    setPolicy((prev) => ({ ...prev, eligibilityRule: newRule }));
    setUsingSample(false);
  };

  const setTreatment = (type: AwardType, treatment: AwardTreatment) => {
    setPolicy((prev) => ({
      ...prev,
      treatments: { ...prev.treatments, [type]: treatment },
    }));
    setUsingSample(false);
  };

  const updateAward = (i: number, patch: Partial<Award>) => {
    setAwards((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    );
    setUsingSample(false);
  };

  const addAward = () => {
    setAwards((prev) => [
      ...prev,
      {
        awardId: `Award-${prev.length + 1}`,
        awardType: "RSU",
        grantDate: "",
        vestStartDate: "",
        vestEndDate: "",
        sharesGranted: 0,
        sharesVested: 0,
      },
    ]);
    setUsingSample(false);
  };

  const removeAward = (i: number) => {
    setAwards((prev) => prev.filter((_, idx) => idx !== i));
    setUsingSample(false);
  };

  const loadSample = () => {
    setEmployee(SAMPLE_EMPLOYEE);
    setPolicy(SAMPLE_POLICY);
    setAwards(SAMPLE_AWARDS);
    setUsingSample(true);
    setImportMessage(null);
    setCsvText("");
  };

  const clearAll = () => {
    setEmployee({
      birthDate: "",
      hireDate: "",
      retirementDate: "",
    });
    setPolicy(defaultPolicy());
    setAwards([]);
    setUsingSample(false);
    setImportMessage(null);
    setCsvText("");
  };

  const handleImport = (text: string) => {
    if (!text.trim()) {
      setImportMessage({ kind: "error", text: "No CSV content to import." });
      return;
    }
    const result = importCsv(text);
    applyImport(result);
  };

  const applyImport = (result: ImportResult) => {
    if (result.errors.length > 0 && result.awards.length === 0) {
      setImportMessage({
        kind: "error",
        text: result.errors.join(" "),
        unmapped: result.unmappedHeaders,
      });
      return;
    }
    setAwards(result.awards);
    setUsingSample(false);
    setImportMessage({
      kind: "ok",
      text: `Imported ${result.awards.length} award${result.awards.length === 1 ? "" : "s"}${
        result.errors.length > 0
          ? `. ${result.errors.length} row${result.errors.length === 1 ? "" : "s"} skipped: ${result.errors[0]}`
          : ""
      }`,
      unmapped: result.unmappedHeaders,
    });
  };

  const handleFile = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      setImportMessage({
        kind: "error",
        text: "File is over 4 MB. Try a smaller export or paste the CSV inline.",
      });
      return;
    }
    try {
      const text = await file.text();
      handleImport(text);
    } catch {
      setImportMessage({
        kind: "error",
        text: "Could not read that file. Try opening it in a text editor and pasting instead.",
      });
    }
  };

  const downloadTemplate = () => {
    if (typeof window === "undefined") return;
    const blob = new Blob([SAMPLE_CSV_TEMPLATE], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "retirement-vesting-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyMemo = async () => {
    try {
      await navigator.clipboard.writeText(memo);
      setMemoCopied(true);
      setTimeout(() => setMemoCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const copyResultsCsv = async () => {
    try {
      const csv = resultsToCsv(analysis.results);
      await navigator.clipboard.writeText(csv);
      setCsvCopied(true);
      setTimeout(() => setCsvCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const downloadMemo = () => {
    if (typeof window === "undefined") return;
    const blob = new Blob([memo], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "retirement-vesting-memo.md";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadResultsCsv = () => {
    if (typeof window === "undefined") return;
    const csv = resultsToCsv(analysis.results);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "retirement-vesting-results.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border-l-4 px-4 py-3"
        style={{
          borderColor: "var(--accent)",
          borderLeftColor: "var(--accent)",
          borderLeftWidth: 4,
          background: "var(--surface)",
          color: "var(--muted)",
        }}
      >
        <div className="text-sm">
          {usingSample
            ? "Showing the sample retirement scenario. Edit any field to start working with your own data, or clear to a blank slate."
            : "Editing your own inputs. Sample data is one click away if you want to see what the output looks like."}
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={loadSample}
            className="rounded-full px-3 py-1.5 font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            Load sample
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-full px-3 py-1.5 font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            Clear all
          </button>
        </div>
      </div>

      <details
        className="rounded-md border p-4"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <summary
          className="cursor-pointer text-sm font-medium"
          style={{ color: "var(--accent)" }}
        >
          What this tool is, and what it isn&rsquo;t
        </summary>
        <div
          className="mt-3 grid gap-4 text-sm leading-6 md:grid-cols-2"
          style={{ color: "var(--muted)" }}
        >
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text)" }}
            >
              Deterministic, not AI
            </p>
            <p className="mt-1">
              Award treatment is computed by a rules engine in{" "}
              <span className="font-mono text-[12px]">
                src/lib/retirementVesting.ts
              </span>
              , unit-tested. AI is not used to decide which shares vest,
              forfeit, or pro-rate. Plain-English memo language is generated
              by deterministic templates filled with your inputs.
            </p>
          </div>
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text)" }}
            >
              Client-side only
            </p>
            <p className="mt-1">
              Your CSV is parsed in your browser. The data lives in this
              tab&rsquo;s memory for the session and is gone the moment the
              tab closes. Nothing is uploaded.
            </p>
          </div>
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text)" }}
            >
              Conservative on missing data
            </p>
            <p className="mt-1">
              When inputs are insufficient or inconsistent (missing vest end
              date, retirement before grant, share counts mismatched), the
              tool flags <span className="font-mono">NEEDS_REVIEW</span>{" "}
              with a specific exception. It does not guess.
            </p>
          </div>
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text)" }}
            >
              Not legal advice
            </p>
            <p className="mt-1">
              Real award treatment is governed by your company&rsquo;s plan
              document and individual award agreements. This is a starting
              point for the conversation with legal and payroll, not a
              substitute.
            </p>
          </div>
        </div>
      </details>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
        {/* ──────── Left column: inputs ──────── */}
        <section className="space-y-6">
          <CardSection title="Employee context">
            <Field label="Birth date">
              <DateInput
                value={employee.birthDate}
                onChange={(v) => setEmpField("birthDate", v)}
              />
            </Field>
            <Field label="Hire / service start date">
              <DateInput
                value={employee.hireDate}
                onChange={(v) => setEmpField("hireDate", v)}
              />
            </Field>
            <Field label="Proposed retirement date">
              <DateInput
                value={employee.retirementDate}
                onChange={(v) => setEmpField("retirementDate", v)}
              />
            </Field>
            <Field label="Share price (optional, used for valuation)">
              <NumberInput
                value={employee.sharePriceOverride ?? 0}
                onChange={(n) =>
                  setEmpField("sharePriceOverride", n === 0 ? undefined : n)
                }
                placeholder="0"
                allowDecimal
              />
            </Field>
          </CardSection>

          <CardSection
            title="Retirement policy"
            hint="Reflects the company plan's retirement provisions. Adjust to match your plan document."
          >
            <Field label="Eligibility rule">
              <select
                value={policy.eligibilityRule.type}
                onChange={(e) =>
                  setRuleType(e.target.value as EligibilityRule["type"])
                }
                className="block w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg-alt)",
                  color: "var(--text)",
                }}
              >
                <option value="NONE">No rule (always eligible)</option>
                <option value="AGE">Age threshold only</option>
                <option value="SERVICE">Service threshold only</option>
                <option value="AGE_AND_SERVICE">Age AND service</option>
                <option value="AGE_OR_SERVICE">Age OR service</option>
                <option value="AGE_PLUS_SERVICE">
                  Rule of X (age + service)
                </option>
              </select>
            </Field>

            {policy.eligibilityRule.type === "AGE" && (
              <Field label="Age threshold">
                <NumberInput
                  value={policy.eligibilityRule.ageThreshold}
                  onChange={(n) => updateRule({ ageThreshold: n })}
                />
              </Field>
            )}
            {policy.eligibilityRule.type === "SERVICE" && (
              <Field label="Service threshold (years)">
                <NumberInput
                  value={policy.eligibilityRule.serviceThreshold}
                  onChange={(n) => updateRule({ serviceThreshold: n })}
                />
              </Field>
            )}
            {(policy.eligibilityRule.type === "AGE_AND_SERVICE" ||
              policy.eligibilityRule.type === "AGE_OR_SERVICE") && (
              <>
                <Field label="Age threshold">
                  <NumberInput
                    value={policy.eligibilityRule.ageThreshold}
                    onChange={(n) => updateRule({ ageThreshold: n })}
                  />
                </Field>
                <Field label="Service threshold (years)">
                  <NumberInput
                    value={policy.eligibilityRule.serviceThreshold}
                    onChange={(n) => updateRule({ serviceThreshold: n })}
                  />
                </Field>
              </>
            )}
            {policy.eligibilityRule.type === "AGE_PLUS_SERVICE" && (
              <>
                <Field label="Combined threshold (age + service)">
                  <NumberInput
                    value={policy.eligibilityRule.combinedThreshold}
                    onChange={(n) => updateRule({ combinedThreshold: n })}
                  />
                </Field>
                <Field label="Min age (optional floor)">
                  <NumberInput
                    value={policy.eligibilityRule.minAge ?? 0}
                    onChange={(n) =>
                      updateRule({ minAge: n === 0 ? undefined : n })
                    }
                    placeholder="0"
                  />
                </Field>
                <Field label="Min service yrs (optional floor)">
                  <NumberInput
                    value={policy.eligibilityRule.minService ?? 0}
                    onChange={(n) =>
                      updateRule({ minService: n === 0 ? undefined : n })
                    }
                    placeholder="0"
                  />
                </Field>
              </>
            )}

            <Field label="When is eligibility checked?">
              <select
                value={policy.eligibilityCheckAt}
                onChange={(e) =>
                  updatePolicy({
                    eligibilityCheckAt:
                      e.target.value as RetirementPolicy["eligibilityCheckAt"],
                  })
                }
                className="block w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg-alt)",
                  color: "var(--text)",
                }}
              >
                <option value="RETIREMENT_DATE">
                  At retirement date (most common)
                </option>
                <option value="GRANT_DATE">At grant date</option>
              </select>
            </Field>

            <Field label="Pro-rata method">
              <select
                value={policy.proRataMethod}
                onChange={(e) =>
                  updatePolicy({ proRataMethod: e.target.value as ProRataMethod })
                }
                className="block w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg-alt)",
                  color: "var(--text)",
                }}
              >
                <option value="MONTHS_SERVICE">
                  Months served / total vest months
                </option>
                <option value="DAYS_FROM_GRANT">
                  Days from grant / total vest period
                </option>
                <option value="VEST_FRACTION">
                  Shares vested / shares granted
                </option>
              </select>
            </Field>

            <Field label="Treatment if NOT eligible">
              <select
                value={policy.treatmentIfNotEligible}
                onChange={(e) =>
                  updatePolicy({
                    treatmentIfNotEligible: e.target.value as AwardTreatment,
                  })
                }
                className="block w-full rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--bg-alt)",
                  color: "var(--text)",
                }}
              >
                <option value="FORFEITURE">Forfeiture</option>
                <option value="CONTINUED_VESTING">Continued vesting</option>
                <option value="PRO_RATA">Pro-rata</option>
                <option value="FULL_VESTING">Full vesting</option>
              </select>
            </Field>

            <div>
              <p
                className="text-[11px] font-medium uppercase tracking-[0.14em]"
                style={{ color: "var(--muted)" }}
              >
                Treatment if eligible (per award type)
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(["RSU", "PSU", "RSA", "ISO", "NSO", "OTHER"] as const).map(
                  (type) => (
                    <label
                      key={type}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-1.5"
                      style={{
                        borderColor: "var(--line)",
                        background: "var(--bg-alt)",
                      }}
                    >
                      <span
                        className="text-xs font-semibold"
                        style={{ color: "var(--text)" }}
                      >
                        {type}
                      </span>
                      <select
                        value={policy.treatments[type]}
                        onChange={(e) =>
                          setTreatment(type, e.target.value as AwardTreatment)
                        }
                        className="bg-transparent text-xs"
                        style={{ color: "var(--text)" }}
                      >
                        <option value="FULL_VESTING">Full vesting</option>
                        <option value="PRO_RATA">Pro-rata</option>
                        <option value="CONTINUED_VESTING">
                          Continued vesting
                        </option>
                        <option value="FORFEITURE">Forfeiture</option>
                      </select>
                    </label>
                  ),
                )}
              </div>
            </div>
          </CardSection>

          <CardSection
            title="Awards"
            hint="Manual entry or paste/upload a grants outstanding CSV from your stock administration platform."
            sourceHint="Fidelity / Shareworks / Computershare / E*TRADE / Carta: 'Grants Outstanding' or 'Award Status' export. Required columns: Award ID, Award Type, Grant Date, Shares Granted, AND a vesting source — either Shares Vested OR an explicit Unvested / Unreleased column (Outstanding alone is ambiguous and is not accepted). Optional: Vest Start, Vest End, Price, Strike, Employee. Strike is required to value ISO / NSO awards (intrinsic value)."
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={addAward}
                className="rounded-full px-3 py-1.5 font-medium"
                style={{ background: "var(--surface-alt)", color: "var(--text)" }}
              >
                + Add award
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full px-3 py-1.5 font-medium"
                style={{ background: "var(--surface-alt)", color: "var(--text)" }}
              >
                Upload CSV
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={downloadTemplate}
                className="rounded-full px-3 py-1.5 font-medium"
                style={{ background: "var(--surface-alt)", color: "var(--text)" }}
              >
                Download CSV template
              </button>
            </div>

            <details
              className="rounded-md border p-3"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
              }}
            >
              <summary
                className="cursor-pointer text-xs font-medium"
                style={{ color: "var(--accent)" }}
              >
                Or paste CSV inline
              </summary>
              <div className="mt-2 space-y-2">
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={6}
                  placeholder="Paste your grants outstanding CSV here…"
                  className="block w-full rounded-md border px-3 py-2 text-xs"
                  style={{
                    borderColor: "var(--line)",
                    background: "var(--surface)",
                    color: "var(--text)",
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleImport(csvText)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{
                    background: "var(--accent)",
                    color: "var(--bg)",
                  }}
                >
                  Import pasted CSV
                </button>
              </div>
            </details>

            {importMessage && (
              <div
                className="rounded-md border-l-4 px-3 py-2 text-xs leading-5"
                style={{
                  borderColor:
                    importMessage.kind === "ok"
                      ? "var(--accent)"
                      : "var(--red, #d05a5a)",
                  borderLeftColor:
                    importMessage.kind === "ok"
                      ? "var(--accent)"
                      : "var(--red, #d05a5a)",
                  borderLeftWidth: 4,
                  background: "var(--surface)",
                  color: "var(--muted)",
                }}
                role="status"
              >
                <p>{importMessage.text}</p>
                {importMessage.unmapped &&
                  importMessage.unmapped.length > 0 && (
                    <p className="mt-1">
                      Unmapped headers (ignored):{" "}
                      <span className="font-mono">
                        {importMessage.unmapped.join(", ")}
                      </span>
                    </p>
                  )}
              </div>
            )}

            <div className="overflow-x-auto">
              <table
                className="min-w-full text-xs"
                style={{ color: "var(--text)" }}
              >
                <thead>
                  <tr
                    className="border-b text-left"
                    style={{
                      borderColor: "var(--line)",
                      color: "var(--muted)",
                    }}
                  >
                    <th scope="col" className="py-2 pr-2 font-medium uppercase tracking-[0.14em]">
                      ID
                    </th>
                    <th scope="col" className="py-2 pr-2 font-medium uppercase tracking-[0.14em]">
                      Type
                    </th>
                    <th scope="col" className="py-2 pr-2 font-medium uppercase tracking-[0.14em]">
                      Grant
                    </th>
                    <th scope="col" className="py-2 pr-2 font-medium uppercase tracking-[0.14em]">
                      Vest start
                    </th>
                    <th scope="col" className="py-2 pr-2 font-medium uppercase tracking-[0.14em]">
                      Vest end
                    </th>
                    <th scope="col" className="py-2 pr-2 font-medium uppercase tracking-[0.14em]">
                      Granted
                    </th>
                    <th scope="col" className="py-2 pr-2 font-medium uppercase tracking-[0.14em]">
                      Vested
                    </th>
                    <th scope="col" className="py-2 pr-2 font-medium uppercase tracking-[0.14em]">
                      Price
                    </th>
                    <th
                      scope="col"
                      className="py-2 pr-2 font-medium uppercase tracking-[0.14em]"
                      title="Strike / exercise price. Required for ISO/NSO valuation; ignored for RSU/PSU/RSA."
                    >
                      Strike
                    </th>
                    <th scope="col" className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {awards.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-3 text-center text-[11px]" style={{ color: "var(--muted)" }}>
                        No awards yet. Use Add award, Upload CSV, or Load sample.
                      </td>
                    </tr>
                  ) : (
                    awards.map((a, i) => (
                      <tr
                        key={i}
                        className="border-b"
                        style={{ borderColor: "var(--line)" }}
                      >
                        <td className="py-1.5 pr-2">
                          <CellInput
                            value={a.awardId}
                            onChange={(v) => updateAward(i, { awardId: v })}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <select
                            value={a.awardType}
                            onChange={(e) =>
                              updateAward(i, {
                                awardType: e.target.value as AwardType,
                              })
                            }
                            className="bg-transparent"
                            style={{ color: "var(--text)" }}
                          >
                            {(
                              ["RSU", "PSU", "RSA", "ISO", "NSO", "OTHER"] as const
                            ).map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 pr-2">
                          <CellInput
                            value={a.grantDate}
                            onChange={(v) => updateAward(i, { grantDate: v })}
                            placeholder="YYYY-MM-DD"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <CellInput
                            value={a.vestStartDate}
                            onChange={(v) =>
                              updateAward(i, { vestStartDate: v })
                            }
                            placeholder="YYYY-MM-DD"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <CellInput
                            value={a.vestEndDate ?? ""}
                            onChange={(v) =>
                              updateAward(i, {
                                vestEndDate: v ? v : undefined,
                              })
                            }
                            placeholder="YYYY-MM-DD"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <CellInput
                            value={String(a.sharesGranted)}
                            onChange={(v) =>
                              updateAward(i, { sharesGranted: toNumber(v) })
                            }
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <CellInput
                            value={String(a.sharesVested)}
                            onChange={(v) =>
                              updateAward(i, { sharesVested: toNumber(v) })
                            }
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <CellInput
                            value={a.pricePerShare?.toString() ?? ""}
                            onChange={(v) =>
                              updateAward(i, {
                                pricePerShare: safeOptionalNumber(v),
                              })
                            }
                            placeholder=""
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <CellInput
                            value={a.strike?.toString() ?? ""}
                            onChange={(v) =>
                              updateAward(i, {
                                strike: safeOptionalNumber(v),
                              })
                            }
                            placeholder={
                              a.awardType === "ISO" || a.awardType === "NSO"
                                ? "required"
                                : "—"
                            }
                          />
                        </td>
                        <td className="py-1.5">
                          <button
                            type="button"
                            onClick={() => removeAward(i)}
                            aria-label={`Remove ${a.awardId}`}
                            className="text-xs"
                            style={{ color: "var(--muted)" }}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardSection>
        </section>

        {/* ──────── Right column: outputs ──────── */}
        <section className="space-y-6">
          <CardSection title="Eligibility">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric
                label={
                  analysis.eligibility.variesByAward
                    ? "Varies by award"
                    : "Eligible at evaluation"
                }
                value={
                  analysis.eligibility.variesByAward
                    ? "See per-award"
                    : analysis.eligibility.eligible
                      ? "Yes"
                      : "No"
                }
              />
              <Metric
                label={
                  analysis.eligibility.variesByAward
                    ? "At retirement date"
                    : "Evaluated at"
                }
                value={analysis.eligibility.evaluatedAt || "—"}
              />
              <Metric
                label="Age at check"
                value={`${analysis.eligibility.ageAtCheck} yrs`}
              />
              <Metric
                label="Service at check"
                value={`${analysis.eligibility.serviceYearsAtCheck} yrs`}
              />
            </div>
            <p
              className="mt-3 text-xs leading-5"
              style={{ color: "var(--muted)" }}
            >
              {analysis.eligibility.reason}
            </p>
          </CardSection>

          <CardSection title="Per-award outcomes">
            {analysis.results.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                No awards in scope.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="min-w-full text-xs"
                  style={{ color: "var(--text)" }}
                >
                  <thead>
                    <tr
                      className="border-b text-left"
                      style={{
                        borderColor: "var(--line)",
                        color: "var(--muted)",
                      }}
                    >
                      <th scope="col" className="py-2 pr-2 font-medium uppercase tracking-[0.14em]">
                        ID
                      </th>
                      <th scope="col" className="py-2 pr-2 font-medium uppercase tracking-[0.14em]">
                        Status
                      </th>
                      <th scope="col" className="py-2 pr-2 text-right font-medium uppercase tracking-[0.14em]">
                        Vesting
                      </th>
                      <th scope="col" className="py-2 pr-2 text-right font-medium uppercase tracking-[0.14em]">
                        Forfeited
                      </th>
                      <th scope="col" className="py-2 pr-2 text-right font-medium uppercase tracking-[0.14em]">
                        Continuing
                      </th>
                      <th scope="col" className="py-2 pr-2 text-right font-medium uppercase tracking-[0.14em]">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.results.map((r) => (
                      <ResultRow key={r.awardId} result={r} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardSection>

          <CardSection title="Summary">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric
                label="Already vested"
                value={analysis.summary.totalSharesAlreadyVested.toLocaleString()}
              />
              <Metric
                label="Vesting at retirement"
                value={analysis.summary.totalSharesVestingDueToRetirement.toLocaleString()}
              />
              <Metric
                label="Forfeited"
                value={analysis.summary.totalSharesForfeited.toLocaleString()}
              />
              <Metric
                label="Continuing to vest"
                value={analysis.summary.totalSharesContinuingToVest.toLocaleString()}
              />
              {analysis.summary.totalEstimatedValue !== undefined && (
                <Metric
                  label="Est. value at retirement"
                  value={`$${Math.round(analysis.summary.totalEstimatedValue).toLocaleString()}`}
                />
              )}
              {analysis.summary.exceptionCount > 0 && (
                <Metric
                  label="Exception flags"
                  value={String(analysis.summary.exceptionCount)}
                />
              )}
            </div>
          </CardSection>

          <CardSection
            title="Memo for equity / legal / payroll"
            hint="Plain markdown. Drop into your internal review thread."
          >
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={copyMemo}
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  background: memoCopied
                    ? "var(--accent-soft)"
                    : "var(--surface-alt)",
                  color: memoCopied ? "var(--accent)" : "var(--text)",
                }}
              >
                {memoCopied ? "Copied" : "Copy memo"}
              </button>
              <button
                type="button"
                onClick={downloadMemo}
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{ background: "var(--surface-alt)", color: "var(--text)" }}
              >
                Download memo (.md)
              </button>
              <button
                type="button"
                onClick={copyResultsCsv}
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  background: csvCopied
                    ? "var(--accent-soft)"
                    : "var(--surface-alt)",
                  color: csvCopied ? "var(--accent)" : "var(--text)",
                }}
              >
                {csvCopied ? "Copied" : "Copy results CSV"}
              </button>
              <button
                type="button"
                onClick={downloadResultsCsv}
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{ background: "var(--surface-alt)", color: "var(--text)" }}
              >
                Download CSV
              </button>
            </div>
            <pre
              className="mt-3 whitespace-pre-wrap break-words rounded-md border p-4 text-[12.5px] leading-6"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-alt)",
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {memo}
            </pre>
          </CardSection>

          <p
            className="text-xs italic leading-6"
            style={{ color: "var(--muted)" }}
          >
            Educational diagnostic. Not legal, tax, or financial advice. The
            company plan document, the individual award agreements, and legal
            review control. Bring this memo to equity, legal, and payroll
            before any action.
          </p>
        </section>
      </div>
    </div>
  );
}

// ──────────── Subcomponents ────────────

function CardSection({
  title,
  hint,
  sourceHint,
  children,
}: {
  title: string;
  hint?: string;
  sourceHint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-md border p-5"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      <p
        className="text-[11px] font-medium uppercase tracking-[0.18em]"
        style={{ color: "var(--accent)" }}
      >
        {title}
      </p>
      {hint && (
        <p
          className="mt-1 text-xs leading-5"
          style={{ color: "var(--muted)" }}
        >
          {hint}
        </p>
      )}
      {sourceHint && (
        <p
          className="mt-2 rounded-md border-l-2 px-3 py-1.5 text-[11px] leading-5"
          style={{
            borderLeftColor: "var(--accent)",
            background: "var(--surface-alt)",
            color: "var(--muted)",
          }}
        >
          <span
            className="font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--accent)" }}
          >
            Where to find this
          </span>
          <span className="ml-2 normal-case tracking-normal">{sourceHint}</span>
        </p>
      )}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="block text-[11px] font-medium uppercase tracking-[0.14em]"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  allowDecimal,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  allowDecimal?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      value={value === 0 ? "" : value.toString()}
      onChange={(e) => {
        const cleaned = allowDecimal
          ? e.target.value.replace(/[^\d.]/g, "")
          : e.target.value.replace(/[^\d]/g, "");
        if (cleaned === "") {
          onChange(0);
          return;
        }
        const n = Number(cleaned);
        // Guard against "1.2.3" or lone "." producing NaN.
        onChange(Number.isFinite(n) ? n : 0);
      }}
      placeholder={placeholder ?? "0"}
      className="block w-full rounded-md border px-3 py-1.5 text-sm"
      style={{
        borderColor: "var(--line)",
        background: "var(--bg-alt)",
        color: "var(--text)",
        fontFamily: "var(--font-mono)",
      }}
    />
  );
}

function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="block w-full rounded-md border px-3 py-1.5 text-sm"
      style={{
        borderColor: "var(--line)",
        background: "var(--bg-alt)",
        color: "var(--text)",
        colorScheme: "dark",
        fontFamily: "var(--font-mono)",
      }}
    />
  );
}

function CellInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="block w-full rounded border bg-transparent px-2 py-1 text-xs"
      style={{
        borderColor: "var(--line)",
        color: "var(--text)",
        fontFamily: "var(--font-mono)",
      }}
    />
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: "var(--line)", background: "var(--bg-alt)" }}
    >
      <p
        className="text-[10px] font-medium uppercase tracking-[0.14em]"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-sm font-semibold"
        style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}
      >
        {value}
      </p>
    </div>
  );
}

function ResultRow({ result }: { result: AwardResult }) {
  const tone = STATUS_TONE[result.status];
  return (
    <>
      <tr style={{ borderColor: "var(--line)" }}>
        <td className="py-2 pr-2 font-mono text-[11px]">{result.awardId}</td>
        <td className="py-2 pr-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: tone.bg,
              color: tone.color,
            }}
          >
            {STATUS_LABEL[result.status]}
          </span>
        </td>
        <td className="py-2 pr-2 text-right font-mono">
          {result.sharesVestingDueToRetirement.toLocaleString()}
        </td>
        <td className="py-2 pr-2 text-right font-mono">
          {result.sharesForfeited.toLocaleString()}
        </td>
        <td className="py-2 pr-2 text-right font-mono">
          {result.sharesContinuingToVest.toLocaleString()}
        </td>
        <td className="py-2 pr-2 text-right font-mono">
          {result.estimatedValue !== undefined
            ? `$${Math.round(result.estimatedValue).toLocaleString()}`
            : "—"}
        </td>
      </tr>
      <tr>
        <td colSpan={6} className="pb-2 text-[11px] leading-5" style={{ color: "var(--muted)" }}>
          {result.reason}
          {result.exceptions.length > 0 && (
            <span style={{ color: "var(--accent)" }}>
              {" "}
              · Exceptions: {result.exceptions.join("; ")}
            </span>
          )}
        </td>
      </tr>
    </>
  );
}

const STATUS_LABEL: Record<AwardStatus, string> = {
  FULL_VESTING: "Full vesting",
  PRO_RATA: "Pro-rata",
  CONTINUED_VESTING: "Continued vesting",
  FORFEITURE: "Forfeiture",
  ALREADY_FULLY_VESTED: "Already vested",
  NEEDS_REVIEW: "Needs review",
};

const STATUS_TONE: Record<AwardStatus, { bg: string; color: string }> = {
  FULL_VESTING: { bg: "var(--accent-soft)", color: "var(--accent)" },
  PRO_RATA: { bg: "var(--accent-soft)", color: "var(--accent)" },
  CONTINUED_VESTING: { bg: "var(--surface-alt)", color: "var(--text)" },
  FORFEITURE: { bg: "var(--surface-alt)", color: "var(--muted)" },
  ALREADY_FULLY_VESTED: {
    bg: "var(--surface-alt)",
    color: "var(--text)",
  },
  NEEDS_REVIEW: { bg: "var(--surface-alt)", color: "var(--accent)" },
};

// ──────────── Helpers ────────────

function toNumber(s: string): number {
  const cleaned = s.replace(/[^\d]/g, "");
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * For optional numeric fields (price, strike). Returns undefined for
 * empty input or any value that would coerce to NaN. Decimals allowed.
 */
function safeOptionalNumber(s: string): number | undefined {
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  const cleaned = trimmed.replace(/[^\d.]/g, "");
  if (!cleaned || cleaned === ".") return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function resultsToCsv(results: AwardResult[]): string {
  const rows: string[] = [
    [
      "Award ID",
      "Award Type",
      "Status",
      "Already Vested",
      "Vesting At Retirement",
      "Forfeited",
      "Continuing To Vest",
      "Estimated Value",
      "Reason",
      "Exceptions",
    ].join(","),
  ];
  results.forEach((r) => {
    rows.push(
      [
        csvEscape(r.awardId),
        r.awardType,
        STATUS_LABEL[r.status],
        r.sharesAlreadyVested,
        r.sharesVestingDueToRetirement,
        r.sharesForfeited,
        r.sharesContinuingToVest,
        r.estimatedValue !== undefined
          ? Math.round(r.estimatedValue)
          : "",
        csvEscape(r.reason),
        csvEscape(r.exceptions.join("; ")),
      ].join(","),
    );
  });
  return rows.join("\n");
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
