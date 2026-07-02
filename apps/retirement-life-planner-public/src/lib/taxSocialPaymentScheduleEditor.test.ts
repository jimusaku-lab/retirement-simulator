import { describe, expect, it } from "vitest";
import {
  addTaxSocialPaymentScheduleItem,
  buildInstallmentTaxSocialPaymentScheduleItems,
  buildNationalPensionMonthlyScheduleItems,
  buildPropertyTaxRecurringTemplate,
  createTaxSocialPaymentScheduleItem,
  deleteTaxSocialPaymentScheduleItem,
  duplicateTaxSocialPaymentScheduleItem,
  updateTaxSocialPaymentScheduleItem,
} from "@/lib/taxSocialPaymentScheduleEditor";
import type { ScenarioData } from "@/types";

function scenarioStub(): ScenarioData {
  return {
    id: "scenario-editor-test",
    name: "通知書編集テスト",
    userProfile: { simulationStartYearMonth: "2026-04" },
    householdMembers: [
      { id: "member-self", name: "本人", relationship: "self", birthDate: "1966-01-01", gender: "male" },
      { id: "member-spouse", name: "配偶者", relationship: "spouse", birthDate: "1967-01-01", gender: "female" },
    ],
    taxSocialPaymentSchedule: [],
    recurringTaxSocialPaymentTemplates: [],
  } as unknown as ScenarioData;
}

describe("taxSocialPaymentScheduleEditor", () => {
  it("通知書実額支払の追加・編集・複製・削除でシナリオ状態を更新できる", () => {
    const scenario = scenarioStub();
    const item = createTaxSocialPaymentScheduleItem({
      name: "住民税 第1期",
      category: "residentTax",
      dueYearMonth: "2026-06",
      amount: 113_000,
      fiscalYear: 2026,
      incomeYear: 2025,
    });

    addTaxSocialPaymentScheduleItem(scenario, item);
    expect(scenario.taxSocialPaymentSchedule).toHaveLength(1);

    updateTaxSocialPaymentScheduleItem(scenario, item.id, (target) => {
      target.amount = 112_000;
      target.dueYearMonth = "2026-08";
      target.note = "第2期へ修正";
    });
    expect(scenario.taxSocialPaymentSchedule?.[0]).toMatchObject({
      amount: 112_000,
      dueYearMonth: "2026-08",
      note: "第2期へ修正",
    });

    duplicateTaxSocialPaymentScheduleItem(scenario, item.id);
    expect(scenario.taxSocialPaymentSchedule).toHaveLength(2);
    expect(scenario.taxSocialPaymentSchedule?.[1].name).toContain("コピー");

    deleteTaxSocialPaymentScheduleItem(scenario, item.id);
    expect(scenario.taxSocialPaymentSchedule).toHaveLength(1);
    expect(scenario.taxSocialPaymentSchedule?.[0].id).not.toBe(item.id);
  });

  it("住民税・国保・固定資産税の期別テンプレートから通知書明細を作成できる", () => {
    const items = buildInstallmentTaxSocialPaymentScheduleItems({
      category: "nationalHealthInsurance",
      fiscalYear: 2026,
      namePrefix: "国民健康保険料",
      installments: [
        { label: "6月期", dueYearMonth: "2026-06", amount: 46_976 },
        { label: "7月期", dueYearMonth: "2026-07", amount: 46_960 },
        { label: "未入力", dueYearMonth: "2026-08", amount: 0 },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.amount)).toEqual([46_976, 46_960]);
    expect(items.every((item) => item.category === "nationalHealthInsurance" && item.source === "notice")).toBe(true);
  });

  it("国民年金の月次テンプレートは10万円未満の減免月も円単位で登録でき、終了月まで作成する", () => {
    const items = buildNationalPensionMonthlyScheduleItems({
      coveredMemberId: "member-spouse",
      coveredMemberName: "配偶者",
      startYearMonth: "2026-07",
      endYearMonth: "2026-08",
      amount: 4_480,
      fiscalYear: 2026,
      note: "減免月",
    });

    expect(items).toHaveLength(2);
    expect(items.map((item) => [item.dueYearMonth, item.amount, item.coveredMemberId])).toEqual([
      ["2026-07", 4_480, "member-spouse"],
      ["2026-08", 4_480, "member-spouse"],
    ]);
  });

  it("固定資産税・都市計画税の継続テンプレートを期別明細から作成できる", () => {
    const template = buildPropertyTaxRecurringTemplate({
      fiscalYear: 2026,
      startYearMonth: "2027-06",
      installments: [
        { label: "第1期", dueYearMonth: "2026-06", amount: 11_500 },
        { label: "第2期", dueYearMonth: "2026-09", amount: 9_000 },
        { label: "第3期", dueYearMonth: "2026-12", amount: 9_000 },
        { label: "第4期", dueYearMonth: "2027-03", amount: 9_000 },
      ],
    });

    expect(template.category).toBe("propertyTax");
    expect(template.startFiscalYear).toBe(2027);
    expect(template.items.map((item) => [item.dueMonth, item.amount, item.fiscalYearOffset])).toEqual([
      [6, 11_500, 0],
      [9, 9_000, 0],
      [12, 9_000, 0],
      [3, 9_000, 1],
    ]);
  });
});
