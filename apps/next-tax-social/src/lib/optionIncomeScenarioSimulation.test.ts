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
