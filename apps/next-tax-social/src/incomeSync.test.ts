import { describe, expect, it } from "vitest";
import { sampleState } from "@/data/sampleData";
import { __testHooks } from "@/App";
import type { ScenarioData } from "@/types";

function optionIncomeEvent(monthlyAmount: number): ScenarioData["incomeEvents"][number] {
  return {
    id: crypto.randomUUID(),
    memberId: sampleState.scenarios[0].householdProfile.headMemberId,
    name: "米国株オプション",
    type: "investmentIncome",
    startYearMonth: "2026-10",
    monthlyAmount,
    taxTreatment: "taxable",
    sourceAssetKey: "ordinaryAccountForOptions",
    sourceOptionSubAccountId: "option-us",
    sourceAssetPayoutMode: "retainInSourceAsset",
  };
}

describe("income scenario sync", () => {
  it("選択した収入イベントだけを反映し、未選択の反映先イベントは残す", () => {
    const commonIncomeId = crypto.randomUUID();
    const source = structuredClone(sampleState.scenarios[0]);
    source.incomeEvents = [
      {
        id: commonIncomeId,
        memberId: source.householdProfile.headMemberId,
        name: "共通収入",
        type: "salary",
        startYearMonth: "2026-04",
        monthlyAmount: 120_000,
        taxTreatment: "taxable",
      },
      optionIncomeEvent(100_000),
    ];
    const target = structuredClone(sampleState.scenarios[0]);
    target.incomeEvents = [optionIncomeEvent(300_000)];

    __testHooks.applyIncomeSyncFromSource(
      target,
      source,
      {
        incomeEvents: true,
        pensionPlanner: false,
        retirementIncomeEvents: false,
        pensionAdjustmentRate: false,
      },
      [commonIncomeId],
    );

    expect(target.incomeEvents.some((event) => event.name === "共通収入")).toBe(true);
    expect(target.incomeEvents.filter((event) => event.name === "米国株オプション")).toHaveLength(1);
    expect(target.incomeEvents.find((event) => event.name === "米国株オプション")?.monthlyAmount).toBe(300_000);
  });

  it("選択した収入イベントは同じ枠の反映先イベントを置き換える", () => {
    const salaryId = crypto.randomUUID();
    const source = structuredClone(sampleState.scenarios[0]);
    source.incomeEvents = [
      {
        id: salaryId,
        memberId: source.householdProfile.headMemberId,
        name: "再就職収入",
        type: "salary",
        startYearMonth: "2026-04",
        monthlyAmount: 180_000,
        taxTreatment: "taxable",
      },
    ];
    const target = structuredClone(sampleState.scenarios[0]);
    target.incomeEvents = [
      {
        ...structuredClone(source.incomeEvents[0]),
        monthlyAmount: 80_000,
      },
    ];

    __testHooks.applyIncomeSyncFromSource(
      target,
      source,
      {
        incomeEvents: true,
        pensionPlanner: false,
        retirementIncomeEvents: false,
        pensionAdjustmentRate: false,
      },
      [salaryId],
    );

    expect(target.incomeEvents).toHaveLength(1);
    expect(target.incomeEvents[0].monthlyAmount).toBe(180_000);
  });
});
