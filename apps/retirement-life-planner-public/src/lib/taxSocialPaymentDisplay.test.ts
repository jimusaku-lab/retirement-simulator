import { describe, expect, it } from "vitest";
import { getNextNoticePaymentMonthSummary, summarizeNoticePaymentsByPaymentYear } from "@/lib/taxSocialPaymentDisplay";
import type { TaxSocialPaymentScheduleItem } from "@/types";

const anonymousSchedule: TaxSocialPaymentScheduleItem[] = [
  { id: "resident-a", name: "住民税 任意入力", category: "residentTax", dueYearMonth: "2026-06", amount: 12_000, fiscalYear: 2026 },
  { id: "nhi-a", name: "国保 任意入力", category: "nationalHealthInsurance", dueYearMonth: "2026-06", amount: 8_000, fiscalYear: 2026 },
  { id: "property-a", name: "固定資産税 任意入力", category: "propertyTax", dueYearMonth: "2026-06", amount: 5_000, fiscalYear: 2026 },
  { id: "resident-b", name: "住民税 任意入力", category: "residentTax", dueYearMonth: "2027-02", amount: 11_000, fiscalYear: 2026 },
  { id: "property-b", name: "固定資産税 任意入力", category: "propertyTax", dueYearMonth: "2027-03", amount: 4_000, fiscalYear: 2026 },
];

describe("taxSocialPaymentDisplay", () => {
  it("次回支払月の複数通知を月合計とカテゴリ別合計にまとめる", () => {
    expect(getNextNoticePaymentMonthSummary(anonymousSchedule, "2026-05")).toEqual({
      yearMonth: "2026-06",
      total: 25_000,
      categories: [
        { category: "residentTax", total: 12_000 },
        { category: "nationalHealthInsurance", total: 8_000 },
        { category: "propertyTax", total: 5_000 },
      ],
    });
  });

  it("通知書実額を支払年ごとに分けて集計する", () => {
    expect(summarizeNoticePaymentsByPaymentYear(anonymousSchedule)).toEqual([
      {
        year: 2026,
        total: 25_000,
        categories: [
          { category: "residentTax", total: 12_000 },
          { category: "nationalHealthInsurance", total: 8_000 },
          { category: "propertyTax", total: 5_000 },
        ],
      },
      {
        year: 2027,
        total: 15_000,
        categories: [
          { category: "residentTax", total: 11_000 },
          { category: "propertyTax", total: 4_000 },
        ],
      },
    ]);
  });
});
