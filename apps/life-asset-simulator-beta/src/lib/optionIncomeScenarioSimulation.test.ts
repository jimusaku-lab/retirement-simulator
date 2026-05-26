import { describe, expect, it } from "vitest";
import { sampleState } from "@/data/sampleData";
import { simulateScenario } from "@/lib/simulation";

describe("option income scenario simulation", () => {
  it("保存データが汎用イベント名と誤ったサブ口座IDでもシナリオ名の入金力で計算する", () => {
    const scenario = structuredClone(sampleState.scenarios[0]);
    scenario.name = "年金６０才（夫婦） IDECO10年 米国株オプション30";
    scenario.userProfile.simulationStartYearMonth = "2026-07";
    scenario.userProfile.simulationEndMode = "yearMonth";
    scenario.userProfile.simulationEndYearMonth = "2026-09";
    scenario.initialAssets.ordinaryAccountForOptions = 4_000_000;
    scenario.initialAssetCostBasis.ordinaryAccountForOptions = 3_200_000;
    scenario.optionAccountRules.enabled = true;
    scenario.optionSubAccounts = [
      { id: "option-cfd", name: "CFD", initialValue: 2_000_000, initialCostBasis: 1_700_000, startYearMonth: "2026-06", enabled: true, minimumBalance: 1_000_000, targetBalance: 2_000_000, withdrawalPriority: 1, protectFromWithdrawal: true, releaseProtectionAfterEnd: true, suspendIncomeWhenBelowMinimum: true, profitSweepEnabled: false, profitSweepDestination: "bankDeposit", profitSweepTiming: "monthly", profitSweepMethod: "excessOverTarget", fixedSweepAmount: 0 },
      { id: "option-us", name: "米国株オプション", initialValue: 2_000_000, initialCostBasis: 1_500_000, startYearMonth: "2026-07", enabled: true, minimumBalance: 1_500_000, targetBalance: 2_500_000, withdrawalPriority: 2, protectFromWithdrawal: true, releaseProtectionAfterEnd: true, suspendIncomeWhenBelowMinimum: true, profitSweepEnabled: false, profitSweepDestination: "bankDeposit", profitSweepTiming: "monthly", profitSweepMethod: "excessOverTarget", fixedSweepAmount: 0 },
    ];
    scenario.incomeEvents = [
      {
        id: "generic-option-income",
        memberId: scenario.householdProfile.headMemberId,
        name: "オプション収入",
        type: "investmentIncome",
        startYearMonth: "2026-07",
        endYearMonth: "2026-09",
        monthlyAmount: 100_000,
        taxTreatment: "taxable",
        sourceAssetKey: "ordinaryAccountForOptions",
        sourceOptionSubAccountId: "option-cfd",
        sourceAssetPayoutMode: "retainInSourceAsset",
      },
    ];

    const result = simulateScenario(scenario);

    expect(result.annual.find((row) => row.year === 2026)?.declaredCapitalGainsIncomeTotal).toBe(900_000);
    expect(result.monthly.at(-1)?.endingTrackedAssetBalances.ordinaryAccountForOptions).toBeGreaterThan(4_800_000);
  });
});
