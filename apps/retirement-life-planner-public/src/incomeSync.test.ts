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
        optionSubAccounts: false,
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
        optionSubAccounts: false,
        pensionPlanner: false,
        retirementIncomeEvents: false,
        pensionAdjustmentRate: false,
      },
      [salaryId],
    );

    expect(target.incomeEvents).toHaveLength(1);
    expect(target.incomeEvents[0].monthlyAmount).toBe(180_000);
  });

  it("選択したCFD・米国株オプション設定だけを反映し、反映先だけのサブ口座は残す", () => {
    const source = structuredClone(sampleState.scenarios[0]);
    source.optionSubAccounts = [
      {
        ...source.optionSubAccounts[0],
        id: "option-cfd",
        name: "CFD",
        initialValue: 3_000_000,
        initialCostBasis: 2_400_000,
      },
      {
        ...source.optionSubAccounts[1],
        id: "option-us",
        name: "米国株オプション",
        initialValue: 5_000_000,
        initialCostBasis: 4_100_000,
      },
    ];
    const target = structuredClone(sampleState.scenarios[0]);
    target.optionSubAccounts = [
      {
        ...target.optionSubAccounts[0],
        id: "option-cfd",
        name: "CFD",
        initialValue: 1_000_000,
        initialCostBasis: 800_000,
      },
      {
        ...target.optionSubAccounts[0],
        id: "option-target-only",
        name: "反映先だけの口座",
        initialValue: 700_000,
        initialCostBasis: 600_000,
      },
    ];

    __testHooks.applyIncomeSyncFromSource(
      target,
      source,
      {
        incomeEvents: false,
        optionSubAccounts: true,
        pensionPlanner: false,
        retirementIncomeEvents: false,
        pensionAdjustmentRate: false,
      },
      [],
      ["option-us"],
    );

    expect(target.optionSubAccounts.find((account) => account.id === "option-us")?.initialValue).toBe(5_000_000);
    expect(target.optionSubAccounts.find((account) => account.id === "option-cfd")?.initialValue).toBe(1_000_000);
    expect(target.optionSubAccounts.find((account) => account.id === "option-target-only")?.initialValue).toBe(700_000);
    expect(target.initialAssets.ordinaryAccountForOptions).toBe(6_700_000);
    expect(target.initialAssetCostBasis.ordinaryAccountForOptions).toBe(5_500_000);
  });

  it("収入イベント選択時、関連する一般口座サブ口座も一緒に反映できる", () => {
    const event = optionIncomeEvent(120_000);
    const source = structuredClone(sampleState.scenarios[0]);
    source.incomeEvents = [event];
    source.optionSubAccounts = [
      {
        ...source.optionSubAccounts[0],
        id: "option-us",
        name: "米国株オプション",
        initialValue: 4_000_000,
        initialCostBasis: 3_200_000,
        minimumBalance: 1_500_000,
      },
    ];
    const target = structuredClone(sampleState.scenarios[0]);
    target.incomeEvents = [];
    target.optionSubAccounts = [
      {
        ...target.optionSubAccounts[0],
        id: "target-only",
        name: "反映先だけの口座",
        initialValue: 600_000,
        initialCostBasis: 500_000,
      },
    ];

    const linkedAccountIds = __testHooks.getLinkedOptionSubAccountIdsForIncomeEvents(source, [event.id]);
    __testHooks.applyIncomeSyncFromSource(
      target,
      source,
      {
        incomeEvents: true,
        optionSubAccounts: true,
        pensionPlanner: false,
        retirementIncomeEvents: false,
        pensionAdjustmentRate: false,
      },
      [event.id],
      linkedAccountIds,
    );

    expect(linkedAccountIds).toEqual(["option-us"]);
    expect(target.incomeEvents).toHaveLength(1);
    expect(target.incomeEvents[0].sourceOptionSubAccountId).toBe("option-us");
    expect(target.optionSubAccounts.find((account) => account.id === "option-us")?.initialValue).toBe(4_000_000);
    expect(target.optionSubAccounts.find((account) => account.id === "target-only")?.initialValue).toBe(600_000);
    expect(target.initialAssets.ordinaryAccountForOptions).toBe(4_600_000);
  });

  it("収入イベント選択時、関連サブ口座OFFならサブ口座は反映しない", () => {
    const event = optionIncomeEvent(120_000);
    const source = structuredClone(sampleState.scenarios[0]);
    source.incomeEvents = [event];
    source.optionSubAccounts = [
      {
        ...source.optionSubAccounts[0],
        id: "option-us",
        name: "米国株オプション",
        initialValue: 4_000_000,
      },
    ];
    const target = structuredClone(sampleState.scenarios[0]);
    target.incomeEvents = [];
    target.optionSubAccounts = [];

    __testHooks.applyIncomeSyncFromSource(
      target,
      source,
      {
        incomeEvents: true,
        optionSubAccounts: false,
        pensionPlanner: false,
        retirementIncomeEvents: false,
        pensionAdjustmentRate: false,
      },
      [event.id],
    );

    expect(target.incomeEvents).toHaveLength(1);
    expect(target.optionSubAccounts).toHaveLength(0);
  });

  it("初期資産の一般口座サブ口座選択時、関連収入イベントも一緒に反映できる", () => {
    const event = optionIncomeEvent(90_000);
    const source = structuredClone(sampleState.scenarios[0]);
    source.incomeEvents = [event];
    source.optionSubAccounts = [
      {
        ...source.optionSubAccounts[0],
        id: "option-us",
        name: "米国株オプション",
        initialValue: 5_500_000,
        initialCostBasis: 4_400_000,
      },
    ];
    const target = structuredClone(sampleState.scenarios[0]);
    target.incomeEvents = [
      {
        ...optionIncomeEvent(20_000),
        id: "target-only-income",
        name: "反映先だけの収入",
        sourceOptionSubAccountId: "target-only",
      },
    ];
    target.optionSubAccounts = [
      {
        ...target.optionSubAccounts[0],
        id: "target-only",
        name: "反映先だけの口座",
        initialValue: 700_000,
        initialCostBasis: 600_000,
      },
    ];

    const linkedIncomeEventIds = __testHooks.getLinkedIncomeEventIdsForOptionSubAccounts(source, ["option-us"]);
    __testHooks.applyAssetSyncFromSource(
      target,
      source,
      {
        liquidAssets: false,
        marketAssets: false,
        costBasis: false,
        optionSubAccounts: true,
      },
      linkedIncomeEventIds,
    );

    expect(linkedIncomeEventIds).toEqual([event.id]);
    expect(target.optionSubAccounts.find((account) => account.id === "option-us")?.initialValue).toBe(5_500_000);
    expect(target.optionSubAccounts.find((account) => account.id === "target-only")?.initialValue).toBe(700_000);
    expect(target.incomeEvents.find((item) => item.id === event.id)?.monthlyAmount).toBe(90_000);
    expect(target.incomeEvents.find((item) => item.id === "target-only-income")).toBeTruthy();
  });

  it("初期資産の一般口座サブ口座選択時、関連収入イベントOFFなら収入イベントは反映しない", () => {
    const event = optionIncomeEvent(90_000);
    const source = structuredClone(sampleState.scenarios[0]);
    source.incomeEvents = [event];
    source.optionSubAccounts = [{ ...source.optionSubAccounts[0], id: "option-us", name: "米国株オプション" }];
    const target = structuredClone(sampleState.scenarios[0]);
    target.incomeEvents = [];

    __testHooks.applyAssetSyncFromSource(
      target,
      source,
      {
        liquidAssets: false,
        marketAssets: false,
        costBasis: false,
        optionSubAccounts: true,
      },
    );

    expect(target.optionSubAccounts.some((account) => account.id === "option-us")).toBe(true);
    expect(target.incomeEvents).toHaveLength(0);
  });

  it("任意コピー元の反映先数からコピー元と現在表示中シナリオを除外できる", () => {
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
