import type { TaxSocialPaymentCategory, TaxSocialPaymentScheduleItem, YearMonth } from "@/types";

export type TaxSocialPaymentCategoryTotal = {
  category: TaxSocialPaymentCategory;
  total: number;
};

export type NoticePaymentMonthSummary = {
  yearMonth: YearMonth;
  total: number;
  categories: TaxSocialPaymentCategoryTotal[];
};

export type NoticePaymentYearSummary = {
  year: number;
  total: number;
  categories: TaxSocialPaymentCategoryTotal[];
};

const categoryOrder: TaxSocialPaymentCategory[] = [
  "residentTax",
  "nationalHealthInsurance",
  "nationalPension",
  "lateElderlyMedical",
  "nursingCare",
  "propertyTax",
  "otherPublicCost",
];

export function isValidNoticePaymentItem(
  item: TaxSocialPaymentScheduleItem | undefined,
): item is TaxSocialPaymentScheduleItem {
  return Boolean(item?.dueYearMonth && item?.category && Number.isFinite(item?.amount));
}

function toCategoryTotals(totals: Map<TaxSocialPaymentCategory, number>): TaxSocialPaymentCategoryTotal[] {
  return categoryOrder
    .map((category) => ({ category, total: totals.get(category) ?? 0 }))
    .filter((item) => item.total !== 0);
}

export function getNextNoticePaymentMonthSummary(
  schedule: TaxSocialPaymentScheduleItem[] | undefined,
  baseYearMonth: YearMonth,
): NoticePaymentMonthSummary | undefined {
  const validItems = (schedule ?? []).filter(isValidNoticePaymentItem).sort((a, b) => a.dueYearMonth.localeCompare(b.dueYearMonth));
  const nextYearMonth = validItems.find((item) => item.dueYearMonth >= baseYearMonth)?.dueYearMonth ?? validItems[0]?.dueYearMonth;
  if (!nextYearMonth) return undefined;

  const categoryTotals = new Map<TaxSocialPaymentCategory, number>();
  let total = 0;
  for (const item of validItems) {
    if (item.dueYearMonth !== nextYearMonth) continue;
    total += item.amount;
    categoryTotals.set(item.category, (categoryTotals.get(item.category) ?? 0) + item.amount);
  }

  return {
    yearMonth: nextYearMonth,
    total,
    categories: toCategoryTotals(categoryTotals),
  };
}

export function summarizeNoticePaymentsByPaymentYear(
  schedule: TaxSocialPaymentScheduleItem[] | undefined,
): NoticePaymentYearSummary[] {
  const byYear = new Map<number, Map<TaxSocialPaymentCategory, number>>();
  for (const item of (schedule ?? []).filter(isValidNoticePaymentItem)) {
    const year = Number(item.dueYearMonth.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const categoryTotals = byYear.get(year) ?? new Map<TaxSocialPaymentCategory, number>();
    categoryTotals.set(item.category, (categoryTotals.get(item.category) ?? 0) + item.amount);
    byYear.set(year, categoryTotals);
  }

  return [...byYear.entries()]
    .sort(([yearA], [yearB]) => yearA - yearB)
    .map(([year, categoryTotals]) => {
      const categories = toCategoryTotals(categoryTotals);
      return {
        year,
        total: categories.reduce((sum, item) => sum + item.total, 0),
        categories,
      };
    });
}
