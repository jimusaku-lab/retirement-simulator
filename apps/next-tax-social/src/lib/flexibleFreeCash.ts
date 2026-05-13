import type { AnnualResult, SimulationResult } from "@/types";

export type FlexibleFreeCashPeriod = {
  startAge: number;
  endAge: number;
};

export type FlexibleFreeCashSummary = {
  period: FlexibleFreeCashPeriod;
  yearCount: number;
  totalFreeCash: number;
  averageAnnualFreeCash: number;
  periodEndBalance: number;
  minimumLiquidBuffer: number;
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

export function calculateFlexibleFreeCashSummary(
  result: Pick<SimulationResult, "annual">,
  periodInput?: Partial<FlexibleFreeCashPeriod>,
): FlexibleFreeCashSummary {
  const period = normalizeFlexibleFreeCashPeriod(periodInput);
  const rows = result.annual.filter((row) => row.ageYears >= period.startAge && row.ageYears <= period.endAge);
  const yearCount = rows.length;
  const totalFreeCash = rows.reduce((sum, row) => sum + getAnnualFlexibleFreeCash(row), 0);
  const periodEndBalance = rows.at(-1)?.endingAssets ?? 0;
  const minimumLiquidBuffer = rows.length ? Math.min(...rows.map((row) => row.endingLiquidBuffer)) : 0;

  return {
    period,
    yearCount,
    totalFreeCash,
    averageAnnualFreeCash: yearCount ? totalFreeCash / yearCount : 0,
    periodEndBalance,
    minimumLiquidBuffer,
  };
}
