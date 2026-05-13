import { isSpecialExpenseActive } from "@/lib/simulation";
import type { AnnualResult, ScenarioData, SimulationResult, SpecialExpenseEvent, YearMonth } from "@/types";

export type SpecialExpenseCategory = NonNullable<SpecialExpenseEvent["category"]>;

const specialExpenseCategories: SpecialExpenseCategory[] = [
  "enjoyment",
  "lifeMaintenance",
  "housingCar",
  "medicalCare",
  "familySupport",
];

function normalizeSpecialExpenseCategory(category: unknown): SpecialExpenseCategory {
  return specialExpenseCategories.includes(category as SpecialExpenseCategory)
    ? category as SpecialExpenseCategory
    : "lifeMaintenance";
}

export type FlexibleFreeCashPeriod = {
  startAge: number;
  endAge: number;
};

export type FlexibleFreeCashSummary = {
  period: FlexibleFreeCashPeriod;
  yearCount: number;
  totalFreeCash: number;
  assetUtilizationAmount: number;
  averageAnnualFreeCash: number;
  periodEndBalance: number;
  minimumLiquidBuffer: number;
  cashLikeIncomeTotal: number;
  livingExpenseTotal: number;
  taxAndSocialTotal: number;
  specialExpenseTotal: number;
  idecoFeeTotal: number;
  nisaContributionTotal: number;
  nisaRemainingLifetimeLimit: number;
};

export const DEFAULT_FLEXIBLE_FREE_CASH_PERIOD: FlexibleFreeCashPeriod = {
  startAge: 60,
  endAge: 72,
};

export function normalizeFlexibleFreeCashPeriod(period?: Partial<FlexibleFreeCashPeriod>): FlexibleFreeCashPeriod {
  const rawStartAge = Number.isFinite(period?.startAge) ? Math.trunc(period?.startAge ?? DEFAULT_FLEXIBLE_FREE_CASH_PERIOD.startAge) : DEFAULT_FLEXIBLE_FREE_CASH_PERIOD.startAge;
  const rawEndAge = Number.isFinite(period?.endAge) ? Math.trunc(period?.endAge ?? DEFAULT_FLEXIBLE_FREE_CASH_PERIOD.endAge) : DEFAULT_FLEXIBLE_FREE_CASH_PERIOD.endAge;
  const startAge = Math.max(0, rawStartAge);
  const endAge = Math.max(startAge, rawEndAge);
  return { startAge, endAge };
}

export function getAnnualFlexibleFreeCash(row: AnnualResult) {
  return (
    row.incomeTotal +
    row.optionProfitSweepTotal +
    row.optionAccountReleaseTotal -
    row.livingExpenseTotal -
    row.taxInsuranceTotal -
    row.capitalGainsTaxTotal -
    row.idecoWithholdingTaxTotal -
    row.specialExpenseTotal -
    row.idecoFeeTotal
  );
}

export function getRowsInFlexibleFreeCashPeriod(result: Pick<SimulationResult, "annual">, periodInput?: Partial<FlexibleFreeCashPeriod>) {
  const period = normalizeFlexibleFreeCashPeriod(periodInput);
  return {
    period,
    rows: result.annual.filter((row) => row.ageYears >= period.startAge && row.ageYears <= period.endAge),
  };
}

export function calculateFlexibleFreeCashSummary(
  result: Pick<SimulationResult, "annual">,
  periodInput?: Partial<FlexibleFreeCashPeriod>,
): FlexibleFreeCashSummary {
  const { period, rows } = getRowsInFlexibleFreeCashPeriod(result, periodInput);
  const yearCount = rows.length;
  const totalFreeCash = rows.reduce((sum, row) => sum + getAnnualFlexibleFreeCash(row), 0);
  const cashLikeIncomeTotal = rows.reduce((sum, row) => sum + row.incomeTotal + row.optionProfitSweepTotal + row.optionAccountReleaseTotal, 0);
  const livingExpenseTotal = rows.reduce((sum, row) => sum + row.livingExpenseTotal, 0);
  const taxAndSocialTotal = rows.reduce(
    (sum, row) => sum + row.taxInsuranceTotal + row.capitalGainsTaxTotal + row.idecoWithholdingTaxTotal,
    0,
  );
  const specialExpenseTotal = rows.reduce((sum, row) => sum + row.specialExpenseTotal, 0);
  const idecoFeeTotal = rows.reduce((sum, row) => sum + row.idecoFeeTotal, 0);
  const nisaContributionTotal = rows.reduce((sum, row) => sum + row.nisaContributionTotal, 0);
  const periodEndBalance = rows.at(-1)?.endingAssets ?? 0;
  const minimumLiquidBuffer = rows.length ? Math.min(...rows.map((row) => row.endingLiquidBuffer)) : 0;
  const nisaRemainingLifetimeLimit = rows.at(-1)?.nisaRemainingLifetimeLimit ?? 0;

  return {
    period,
    yearCount,
    totalFreeCash,
    assetUtilizationAmount: Math.max(0, -totalFreeCash),
    averageAnnualFreeCash: yearCount ? totalFreeCash / yearCount : 0,
    periodEndBalance,
    minimumLiquidBuffer,
    cashLikeIncomeTotal,
    livingExpenseTotal,
    taxAndSocialTotal,
    specialExpenseTotal,
    idecoFeeTotal,
    nisaContributionTotal,
    nisaRemainingLifetimeLimit,
  };
}

export function calculateSpecialExpenseCategoryTotals(
  scenario: Pick<ScenarioData, "specialExpenses">,
  result: Pick<SimulationResult, "monthly" | "annual">,
  periodInput?: Partial<FlexibleFreeCashPeriod>,
): Record<SpecialExpenseCategory, number> {
  const { period } = getRowsInFlexibleFreeCashPeriod(result, periodInput);
  const periodYearMonths = new Set(
    result.monthly
      .filter((row) => row.ageYears >= period.startAge && row.ageYears <= period.endAge)
      .map((row) => row.yearMonth),
  );
  const totals: Record<SpecialExpenseCategory, number> = {
    enjoyment: 0,
    lifeMaintenance: 0,
    housingCar: 0,
    medicalCare: 0,
    familySupport: 0,
  };

  for (const event of scenario.specialExpenses) {
    const category = normalizeSpecialExpenseCategory(event.category);
    for (const yearMonth of periodYearMonths) {
      if (isSpecialExpenseActive(event, yearMonth as YearMonth)) {
        totals[category] += event.amount;
      }
    }
  }

  return totals;
}
