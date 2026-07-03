import type { MonthlyResult } from "@/types";
import { compactYen } from "@/lib/utils";

type LifetimeExpenseMonthlyRow = Pick<
  MonthlyResult,
  | "yearMonth"
  | "ageYears"
  | "livingExpenseTotal"
  | "specialExpenseTotal"
  | "taxInsuranceTotal"
  | "capitalGainsTaxTotal"
  | "idecoWithholdingTaxTotal"
  | "idecoFeeTotal"
>;

export type LifetimeTotalExpenseSummary = {
  total: number;
  living: number;
  special: number;
  taxAndSocial: number;
  targetYearMonth?: string;
};

export function getLifetimeExpenseRowsUntilTargetAge(
  result: { monthly: LifetimeExpenseMonthlyRow[] },
  targetAge: number,
) {
  const targetIndex = result.monthly.findIndex((row) => row.ageYears >= targetAge);
  return targetIndex >= 0 ? result.monthly.slice(0, targetIndex + 1) : result.monthly;
}

export function calculateLifetimeTotalExpenseSummary(
  result: { monthly: LifetimeExpenseMonthlyRow[] },
  targetAge: number,
): LifetimeTotalExpenseSummary {
  const rows = getLifetimeExpenseRowsUntilTargetAge(result, targetAge);
  const summary = rows.reduce(
    (acc, row) => {
      const living = row.livingExpenseTotal;
      const special = row.specialExpenseTotal;
      const taxAndSocial =
        row.taxInsuranceTotal +
        row.capitalGainsTaxTotal +
        row.idecoWithholdingTaxTotal +
        row.idecoFeeTotal;
      return {
        living: acc.living + living,
        special: acc.special + special,
        taxAndSocial: acc.taxAndSocial + taxAndSocial,
      };
    },
    { living: 0, special: 0, taxAndSocial: 0 },
  );

  return {
    ...summary,
    total: summary.living + summary.special + summary.taxAndSocial,
    targetYearMonth: rows.at(-1)?.yearMonth,
  };
}

export function formatLifetimeExpenseYen(value: number) {
  if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}億円`;
  return compactYen(value);
}
