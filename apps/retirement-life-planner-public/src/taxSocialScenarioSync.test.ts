import { describe, expect, it } from "vitest";
import { __testHooks } from "@/App";
import { sampleState } from "@/data/sampleData";
import { simulateScenario } from "@/lib/simulation";
import type { ScenarioData } from "@/types";

function buildSourceScenario(): ScenarioData {
  const source = structuredClone(sampleState.scenarios[0]);
  source.id = "source";
  source.name = "通知書コピー元";
  source.taxSocialPaymentSchedule = [
    {
      id: "notice-resident-2027-06",
      name: "住民税 第1期",
      category: "residentTax",
      dueYearMonth: "2027-06",
      amount: 12_000,
      fiscalYear: 2026,
      source: "notice",
    },
    {
      id: "notice-nhi-2027-06",
      name: "国保 第1期",
      category: "nationalHealthInsurance",
      dueYearMonth: "2027-06",
      amount: 8_000,
      fiscalYear: 2026,
      source: "notice",
    },
  ];
  source.recurringTaxSocialPaymentTemplates = [
    {
      id: "recurring-property-tax",
      name: "固定資産税 継続見込み",
      category: "propertyTax",
      startFiscalYear: 2027,
      startYearMonth: "2027-04",
      annualIncreaseRate: 0,
      source: "noticeBasedEstimate",
      items: [{ dueMonth: 6, amount: 6_000, fiscalYearOffset: 0, label: "第1期" }],
    },
  ];
  return source;
}

describe("tax social payment scenario sync", () => {
  it("通知書実額支払と継続支払見込みをコピー元で置き換え、対象外フィールドは変更しない", () => {
    const source = buildSourceScenario();
    const target = structuredClone(sampleState.scenarios[1] ?? sampleState.scenarios[0]);
    target.id = "target";
    target.taxSocialPaymentSchedule = [
      {
        id: "old-notice",
        name: "古い通知書",
        category: "residentTax",
        dueYearMonth: "2027-07",
        amount: 3_000,
        fiscalYear: 2026,
        source: "manual",
      },
    ];
    target.recurringTaxSocialPaymentTemplates = [
      {
        id: "old-recurring",
        name: "古い継続見込み",
        category: "propertyTax",
        startFiscalYear: 2027,
        startYearMonth: "2027-04",
        source: "manual",
        items: [{ dueMonth: 9, amount: 2_000, fiscalYearOffset: 0 }],
      },
    ];
    const preserved = {
      incomeEvents: structuredClone(target.incomeEvents),
      monthlyExpenses: structuredClone(target.monthlyExpenses),
      initialAssets: structuredClone(target.initialAssets),
      retirementIncomeEvents: structuredClone(target.retirementIncomeEvents),
    };

    __testHooks.applyTaxSocialPaymentSyncFromSource(target, source, {
      taxSocialPaymentSchedule: true,
      recurringTaxSocialPaymentTemplates: true,
    });

    expect(target.taxSocialPaymentSchedule).toEqual(source.taxSocialPaymentSchedule);
    expect(target.recurringTaxSocialPaymentTemplates).toEqual(source.recurringTaxSocialPaymentTemplates);
    expect(target.taxSocialPaymentSchedule).not.toBe(source.taxSocialPaymentSchedule);
    expect(target.recurringTaxSocialPaymentTemplates).not.toBe(source.recurringTaxSocialPaymentTemplates);
    expect(target.incomeEvents).toEqual(preserved.incomeEvents);
    expect(target.monthlyExpenses).toEqual(preserved.monthlyExpenses);
    expect(target.initialAssets).toEqual(preserved.initialAssets);
    expect(target.retirementIncomeEvents).toEqual(preserved.retirementIncomeEvents);
  });

  it("選択していない項目は反映先の既存値を維持する", () => {
    const source = buildSourceScenario();
    const target = structuredClone(sampleState.scenarios[0]);
    target.taxSocialPaymentSchedule = [];
    target.recurringTaxSocialPaymentTemplates = [
      {
        id: "target-recurring",
        name: "反映先の継続見込み",
        category: "propertyTax",
        startFiscalYear: 2027,
        startYearMonth: "2027-04",
        source: "manual",
        items: [{ dueMonth: 12, amount: 4_000, fiscalYearOffset: 0 }],
      },
    ];
    const existingRecurring = structuredClone(target.recurringTaxSocialPaymentTemplates);

    __testHooks.applyTaxSocialPaymentSyncFromSource(target, source, {
      taxSocialPaymentSchedule: true,
      recurringTaxSocialPaymentTemplates: false,
    });

    expect(target.taxSocialPaymentSchedule).toEqual(source.taxSocialPaymentSchedule);
    expect(target.recurringTaxSocialPaymentTemplates).toEqual(existingRecurring);
  });

  it("反映後の月次キャッシュ支払に通知書実額と固定資産税継続が反映される", () => {
    const source = buildSourceScenario();
    const target = structuredClone(sampleState.scenarios[0]);

    __testHooks.applyTaxSocialPaymentSyncFromSource(target, source, {
      taxSocialPaymentSchedule: true,
      recurringTaxSocialPaymentTemplates: true,
    });

    const result = simulateScenario(target);
    const june2027 = result.monthly.find((row) => row.yearMonth === "2027-06");

    expect(june2027?.taxCashBreakdown.residentTax).toBe(12_000);
    expect(june2027?.taxCashBreakdown.nationalHealthInsurance).toBe(8_000);
    expect(june2027?.taxCashBreakdown.propertyTax).toBe(6_000);
  });

  it("反映先選択ではコピー元自身と除外シナリオを対象外にする", () => {
    const scenarios = sampleState.scenarios.slice(0, 4).map((scenario, index) => ({
      ...structuredClone(scenario),
      id: `scenario-${index}`,
      compare: index !== 3,
    }));

    expect(__testHooks.countAssetSyncTargets(scenarios, "scenario-1", "compare")).toBe(2);
    expect(__testHooks.countAssetSyncTargets(scenarios, "scenario-1", "compare", new Set(["scenario-0"]))).toBe(1);
    expect(__testHooks.countAssetSyncTargets(scenarios, "scenario-1", "all", new Set(["scenario-0"]))).toBe(2);
  });
});
