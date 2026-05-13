import { describe, expect, it } from "vitest";
import { sampleState } from "@/data/sampleData";
import { normalizePlanState } from "@/store/usePlanStore";

describe("normalizePlanState", () => {
  it("米国株オプション10/20/30シナリオの保存済み収入月額をシナリオ名に合わせて補正する", () => {
    const scenario = structuredClone(sampleState.scenarios[0]);
    scenario.id = "us-option-30";
    scenario.name = "年金６０才（夫婦） IDECO10年 米国株オプション30";
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
});
