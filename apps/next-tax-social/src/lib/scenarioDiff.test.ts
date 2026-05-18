import { describe, expect, it } from "vitest";
import { sampleState } from "@/data/sampleData";
import { buildScenarioDiffSummary, formatScenarioDiffHeadline } from "@/lib/scenarioDiff";
import type { ScenarioData } from "@/types";

function cloneSampleScenario(): ScenarioData {
  return structuredClone(sampleState.scenarios[0]);
}

describe("scenarioDiff", () => {
  it("returns no differences for the same scenario", () => {
    const scenario = cloneSampleScenario();
    const diff = buildScenarioDiffSummary(scenario, scenario);

    expect(diff.items).toHaveLength(0);
    expect(formatScenarioDiffHeadline(diff)).toBe("基準との差分なし");
  });

  it("detects income amount and period changes", () => {
    const baseline = cloneSampleScenario();
    const target = structuredClone(baseline);
    target.id = "target";
    target.incomeEvents[0] = {
      ...target.incomeEvents[0],
      monthlyAmount: target.incomeEvents[0].monthlyAmount + 100_000,
      endYearMonth: "2027-12",
    };

    const diff = buildScenarioDiffSummary(baseline, target);

    expect(diff.items.some((item) => item.category === "income" && item.summary.includes("期間"))).toBe(true);
  });

  it("explains iDeCo pension year changes without repeating identical amount and period", () => {
    const baseline = cloneSampleScenario();
    const target = structuredClone(baseline);
    target.id = "target";
    baseline.incomeEvents[0] = {
      ...baseline.incomeEvents[0],
      id: "ideco-income",
      name: "iDeCo年金受け取り分割",
      sourceAssetKey: "ideco",
      idecoPensionYears: 5,
      monthlyAmount: 334_000,
      startYearMonth: "2027-02",
      endYearMonth: "2032-12",
    };
    target.incomeEvents[0] = {
      ...baseline.incomeEvents[0],
      idecoPensionYears: 10,
    };

    const diff = buildScenarioDiffSummary(baseline, target);

    expect(diff.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          summary: expect.stringContaining("受取年数 5年 → 10年"),
        }),
      ]),
    );
  });

  it("ignores removed blank placeholder income events", () => {
    const baseline = cloneSampleScenario();
    const target = structuredClone(baseline);
    target.id = "target";
    baseline.incomeEvents.push({
      id: "blank-income",
      memberId: baseline.householdMembers[0].id,
      name: "新しい収入",
      type: "other",
      startYearMonth: "2026-07",
      endYearMonth: "2040-12",
      monthlyAmount: 0,
      sourceAssetPayoutMode: "cash",
    });

    const diff = buildScenarioDiffSummary(baseline, target);

    expect(diff.items.some((item) => item.summary.includes("新しい収入"))).toBe(false);
  });

  it("detects added special expenses", () => {
    const baseline = cloneSampleScenario();
    const target = structuredClone(baseline);
    target.id = "target";
    target.specialExpenses.push({
      id: "trip",
      name: "旅行",
      yearMonth: "2030-05",
      amount: 500_000,
      category: "enjoyment",
      schedule: "once",
    });

    const diff = buildScenarioDiffSummary(baseline, target);

    expect(diff.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "specialExpense",
          label: "旅行",
          severity: "added",
        }),
      ]),
    );
  });

  it("detects NISA and tax calculation changes", () => {
    const baseline = cloneSampleScenario();
    const target = structuredClone(baseline);
    target.id = "target";
    target.nisaInvestmentRules.annualLimit += 1_000_000;
    target.householdProfile.taxCalculationMode = "manual";

    const diff = buildScenarioDiffSummary(baseline, target);

    expect(diff.items.some((item) => item.id === "nisa-annual-limit")).toBe(true);
    expect(diff.items.some((item) => item.id === "tax-calculation-mode")).toBe(true);
  });

  it("detects option sub account setting changes", () => {
    const baseline = cloneSampleScenario();
    const target = structuredClone(baseline);
    target.id = "target";
    target.optionSubAccounts[0] = {
      ...target.optionSubAccounts[0],
      minimumBalance: target.optionSubAccounts[0].minimumBalance + 1_000_000,
    };

    const diff = buildScenarioDiffSummary(baseline, target);

    expect(diff.items.some((item) => item.category === "optionAccount")).toBe(true);
  });
});
