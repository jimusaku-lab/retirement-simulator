import { describe, expect, it } from "vitest";
import {
  applyScenarioNameOptionIncomeHint,
  inferMonthlyOptionIncomeFromScenarioName,
} from "@/lib/optionIncomeHints";
import type { IncomeEvent } from "@/types";

const optionIncomeEvent: IncomeEvent = {
  id: "us-option-income",
  memberId: "self",
  name: "米国株オプション",
  type: "investmentIncome",
  startYearMonth: "2026-10",
  monthlyAmount: 100_000,
  taxTreatment: "taxable",
  sourceAssetKey: "ordinaryAccountForOptions",
  sourceAssetPayoutMode: "retainInSourceAsset",
};

describe("option income hints", () => {
  it("シナリオ名の米国株オプション金額を月額に変換する", () => {
    expect(inferMonthlyOptionIncomeFromScenarioName("年金６０才（夫婦） IDECO10年 米国株オプション20", "米国株オプション")).toBe(200_000);
    expect(inferMonthlyOptionIncomeFromScenarioName("年金６０才（夫婦） IDECO5年 米国株式オプション３０万", "米国株式オプション")).toBe(300_000);
  });

  it("米国株オプション以外のイベントにはシナリオ名補正をかけない", () => {
    expect(inferMonthlyOptionIncomeFromScenarioName("年金６０才（夫婦） IDECO10年 米国株オプション20", "CFD")).toBeUndefined();
  });

  it("単一の普通口座オプション収入なら汎用名イベントにもシナリオ名の入金力を使える", () => {
    expect(
      inferMonthlyOptionIncomeFromScenarioName("年金６０才（夫婦） IDECO10年 米国株オプション20", "オプション収入", undefined, {
        allowGenericEvent: true,
      }),
    ).toBe(200_000);
  });

  it("既存シナリオ名と収入イベントがずれている場合は収入イベント月額を補正する", () => {
    const fixed = applyScenarioNameOptionIncomeHint(
      "年金６０才（夫婦） IDECO10年 米国株オプション30",
      optionIncomeEvent,
      { name: "米国株式オプション" },
    );

    expect(fixed.monthlyAmount).toBe(300_000);
    expect(fixed.amountInputMode).toBe("monthly");
  });
});
