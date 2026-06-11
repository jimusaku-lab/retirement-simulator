import { describe, expect, it } from "vitest";
import { sampleState } from "@/data/sampleData";
import { normalizePlanState, usePlanStore } from "@/store/usePlanStore";

describe("normalizePlanState", () => {
  it("米国株オプション10/20/30シナリオの保存済み収入月額をシナリオ名に合わせて補正する", () => {
    const scenario = structuredClone(sampleState.scenarios[0]);
    scenario.id = "us-option-30";
    scenario.name = "年金６０才（夫婦） IDECO10年 米国株オプション30";
    scenario.optionSubAccounts = [
      { id: "option-cfd", name: "CFD", initialValue: 2_000_000, initialCostBasis: 1_700_000, startYearMonth: "2026-06", enabled: true, minimumBalance: 1_000_000, targetBalance: 2_000_000, withdrawalPriority: 1, protectFromWithdrawal: true, releaseProtectionAfterEnd: true, suspendIncomeWhenBelowMinimum: true, profitSweepEnabled: false, profitSweepDestination: "bankDeposit", profitSweepTiming: "monthly", profitSweepMethod: "excessOverTarget", fixedSweepAmount: 0 },
      { id: "option-us", name: "米国株オプション", initialValue: 2_000_000, initialCostBasis: 1_500_000, startYearMonth: "2026-07", enabled: true, minimumBalance: 1_500_000, targetBalance: 2_500_000, withdrawalPriority: 2, protectFromWithdrawal: true, releaseProtectionAfterEnd: true, suspendIncomeWhenBelowMinimum: true, profitSweepEnabled: false, profitSweepDestination: "bankDeposit", profitSweepTiming: "monthly", profitSweepMethod: "excessOverTarget", fixedSweepAmount: 0 },
    ];
    scenario.incomeEvents = [
      {
        id: "us-option-income",
        memberId: scenario.householdProfile.headMemberId,
        name: "オプション収入",
        type: "investmentIncome",
        startYearMonth: scenario.userProfile.simulationStartYearMonth,
        monthlyAmount: 100_000,
        taxTreatment: "taxable",
        sourceAssetKey: "ordinaryAccountForOptions",
        sourceOptionSubAccountId: "option-cfd",
        sourceAssetPayoutMode: "retainInSourceAsset",
      },
    ];

    const normalized = normalizePlanState({
      ...sampleState,
      activeScenarioId: scenario.id,
      scenarios: [scenario],
    });
    const event = normalized.scenarios[0].incomeEvents[0];

    expect(event.monthlyAmount).toBe(300_000);
    expect(event.sourceOptionSubAccountId).toBe("option-us");
  });

  it("保存データに比較基準がない場合は比較対象の先頭を基準にする", () => {
    const first = structuredClone(sampleState.scenarios[0]);
    const second = structuredClone(sampleState.scenarios[1]);
    first.compare = false;
    second.compare = true;

    const normalized = normalizePlanState({
      version: 1,
      activeScenarioId: first.id,
      scenarios: [first, second],
      lastSavedAt: undefined,
      backups: [],
    });

    expect(normalized.baselineScenarioId).toBe(second.id);
  });

  it("保存済みの比較基準が存在する場合は維持する", () => {
    const first = structuredClone(sampleState.scenarios[0]);
    const second = structuredClone(sampleState.scenarios[1]);

    const normalized = normalizePlanState({
      ...sampleState,
      activeScenarioId: first.id,
      baselineScenarioId: second.id,
      scenarios: [first, second],
    });

    expect(normalized.baselineScenarioId).toBe(second.id);
  });

  it("既存の一般向けサンプル保存データに現役向けシナリオを補完する", () => {
    const legacyPublicSample = {
      ...sampleState,
      scenarios: sampleState.scenarios.filter((scenario) => scenario.id !== "early-retirement-60"),
    };

    const normalized = normalizePlanState(legacyPublicSample);

    expect(normalized.scenarios.map((scenario) => scenario.id)).toContain("early-retirement-60");
    expect(normalized.scenarios.findIndex((scenario) => scenario.id === "early-retirement-60")).toBeLessThan(
      normalized.scenarios.findIndex((scenario) => scenario.id === "pension-earlier"),
    );
  });

  it("個人用アプリ由来の初期サンプル保存データは一般向けサンプルに置き換える", () => {
    const legacyPrivateSample = {
      ...sampleState,
      activeScenarioId: "income-100k",
      baselineScenarioId: "base",
      scenarios: [
        { ...structuredClone(sampleState.scenarios[0]), id: "base", name: "標準ケース" },
        { ...structuredClone(sampleState.scenarios[0]), id: "income-100k", name: "月10万円追加入金" },
        { ...structuredClone(sampleState.scenarios[0]), id: "expense-low", name: "生活費10%削減" },
        { ...structuredClone(sampleState.scenarios[0]), id: "expense-shock", name: "特別支出発生" },
        { ...structuredClone(sampleState.scenarios[0]), id: "growth-zero", name: "利回り0%" },
      ],
    };

    const normalized = normalizePlanState(legacyPrivateSample);

    expect(normalized.activeScenarioId).toBe("base");
    expect(normalized.scenarios.map((scenario) => scenario.name)).toEqual(sampleState.scenarios.map((scenario) => scenario.name));
    expect(normalized.scenarios.some((scenario) => scenario.name === "月10万円追加入金")).toBe(false);
  });

  it("既存の一般向け初期サンプルは資産活用開始年齢を基本情報の年齢へ移行する", () => {
    const legacyPublicSample = {
      ...sampleState,
      scenarios: sampleState.scenarios.map((scenario) => ({
        ...structuredClone(scenario),
        userProfile: {
          ...structuredClone(scenario.userProfile),
          flexibleFreeCashStartAge: 60,
          flexibleFreeCashEndAge: 75,
        },
      })),
    };

    const normalized = normalizePlanState(legacyPublicSample);

    expect(normalized.scenarios.find((scenario) => scenario.id === "base")?.userProfile.flexibleFreeCashStartAge).toBe(50);
  });

  it("保存済みサブ口座名の普通口座表記を一般口座へ移行する", () => {
    const scenario = structuredClone(sampleState.scenarios[0]);
    scenario.optionSubAccounts = [
      {
        id: "option-default",
        name: "普通口座（オプション用）",
        initialValue: 0,
        initialCostBasis: 0,
        startYearMonth: scenario.userProfile.simulationStartYearMonth,
        enabled: false,
        minimumBalance: 0,
        targetBalance: 0,
        withdrawalPriority: 1,
        protectFromWithdrawal: true,
        releaseProtectionAfterEnd: true,
        suspendIncomeWhenBelowMinimum: true,
        profitSweepEnabled: false,
        profitSweepDestination: "bankDeposit",
        profitSweepTiming: "monthly",
        profitSweepMethod: "excessOverTarget",
        fixedSweepAmount: 0,
      },
    ];

    const normalized = normalizePlanState({
      ...sampleState,
      scenarios: [scenario],
    });

    expect(normalized.scenarios[0].optionSubAccounts[0].name).toBe("一般口座（オプション用）");
  });
});

describe("usePlanStore scenario ordering", () => {
  it("複製したシナリオをコピー元の直下へ挿入する", () => {
    usePlanStore.setState(structuredClone(sampleState));
    const sourceId = usePlanStore.getState().scenarios[1].id;
    const sourceName = usePlanStore.getState().scenarios[1].name;

    usePlanStore.getState().duplicateScenario(sourceId);

    const scenarios = usePlanStore.getState().scenarios;
    expect(scenarios[1].id).toBe(sourceId);
    expect(scenarios[2].name).toBe(`${sourceName} コピー`);
    expect(usePlanStore.getState().activeScenarioId).toBe(scenarios[2].id);
  });

  it("比較基準シナリオを削除した場合は次の比較対象へ切り替える", () => {
    usePlanStore.setState(structuredClone(sampleState));
    const state = usePlanStore.getState();
    const baselineId = state.scenarios[0].id;
    const nextCompareId = state.scenarios.find((scenario) => scenario.id !== baselineId && scenario.compare)?.id ?? state.scenarios[1].id;

    usePlanStore.setState({ baselineScenarioId: baselineId });
    usePlanStore.getState().deleteScenario(baselineId);

    expect(usePlanStore.getState().baselineScenarioId).toBe(nextCompareId);
  });

  it("シナリオの順番を上下に移動できる", () => {
    usePlanStore.setState(structuredClone(sampleState));
    const before = usePlanStore.getState().scenarios.map((scenario) => scenario.id);

    usePlanStore.getState().moveScenario(before[1], "up");

    const afterUp = usePlanStore.getState().scenarios.map((scenario) => scenario.id);
    expect(afterUp[0]).toBe(before[1]);
    expect(afterUp[1]).toBe(before[0]);

    usePlanStore.getState().moveScenario(before[1], "down");

    const afterDown = usePlanStore.getState().scenarios.map((scenario) => scenario.id);
    expect(afterDown[0]).toBe(before[0]);
    expect(afterDown[1]).toBe(before[1]);
  });
});
