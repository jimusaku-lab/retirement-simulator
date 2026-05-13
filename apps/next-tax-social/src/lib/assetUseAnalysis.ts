import {
  calculateFlexibleFreeCashSummary,
  calculateSpecialExpenseCategoryTotals,
  getRowsInFlexibleFreeCashPeriod,
  type FlexibleFreeCashPeriod,
  type SpecialExpenseCategory,
} from "@/lib/flexibleFreeCash";
import { simulateScenario } from "@/lib/simulation";
import type { ScenarioData, SimulationResult, SpecialExpenseEvent } from "@/types";

export type TargetBalanceStatus = "surplus" | "onTarget" | "shortfall";

export type TargetBalanceAnalysis = {
  targetAge: number;
  targetAmount: number;
  actualAmount: number;
  gap: number;
  status: TargetBalanceStatus;
};

export type AssetUseCategoryBreakdown = Record<SpecialExpenseCategory | "livingAndTax", number>;

export type SpecialExpenseCategoryWarning = {
  eventId: string;
  eventName: string;
  suggestedCategory: SpecialExpenseCategory;
  reason: string;
};

export type AdditionalSpendingTrialInput = {
  startAge: number;
  endAge: number;
  annualAmount: number;
  category: SpecialExpenseCategory;
};

export type AdditionalSpendingTrial = {
  input: AdditionalSpendingTrialInput;
  monthlyAmount: number;
  totalAddedExpense: number;
  startYearMonth?: string;
  endYearMonth?: string;
  result: SimulationResult;
  targetBalance: TargetBalanceAnalysis;
  flexibleFreeCash: ReturnType<typeof calculateFlexibleFreeCashSummary>;
  depletionLabel: string;
};

export type OptionLiquidityAnalysis = {
  period: FlexibleFreeCashPeriod;
  yearCount: number;
  declaredOptionProfitTotal: number;
  profitSweptToLiquidTotal: number;
  accountReleasedToLiquidTotal: number;
  optionToLiquidTotal: number;
  suspendedIncomeTotal: number;
  optionToLiquidShareOfDeclaredProfit: number | null;
};

const enjoymentNamePattern = /旅行|旅|趣味|レジャー|温泉|外食|観光|帰省|家族旅行|イベント|記念|娯楽|遊び|ベトナム|海外|国内/i;

export function calculateTargetBalanceAnalysis(
  scenario: { userProfile: Pick<ScenarioData["userProfile"], "targetBalanceAge" | "targetBalanceAmount"> },
  result: Pick<SimulationResult, "targetAgeBalance">,
): TargetBalanceAnalysis {
  const targetAmount = Math.max(0, scenario.userProfile.targetBalanceAmount ?? 0);
  const actualAmount = result.targetAgeBalance ?? 0;
  const gap = actualAmount - targetAmount;
  const status: TargetBalanceStatus = gap > 0 ? "surplus" : gap === 0 ? "onTarget" : "shortfall";

  return {
    targetAge: scenario.userProfile.targetBalanceAge,
    targetAmount,
    actualAmount,
    gap,
    status,
  };
}

export function calculateAssetUseCategoryBreakdown(
  scenario: Pick<ScenarioData, "specialExpenses">,
  result: Pick<SimulationResult, "annual" | "monthly">,
  periodInput?: Partial<FlexibleFreeCashPeriod>,
): AssetUseCategoryBreakdown {
  const flexibleFreeCash = calculateFlexibleFreeCashSummary(result, periodInput);
  const specialExpenseTotals = calculateSpecialExpenseCategoryTotals(scenario, result, periodInput);

  return {
    enjoyment: specialExpenseTotals.enjoyment,
    lifeMaintenance: specialExpenseTotals.lifeMaintenance,
    housingCar: specialExpenseTotals.housingCar,
    medicalCare: specialExpenseTotals.medicalCare,
    familySupport: specialExpenseTotals.familySupport,
    livingAndTax: flexibleFreeCash.livingExpenseTotal + flexibleFreeCash.taxAndSocialTotal,
  };
}

export function calculateEnjoymentShare(breakdown: Pick<AssetUseCategoryBreakdown, "enjoyment" | "lifeMaintenance" | "housingCar" | "medicalCare" | "familySupport">) {
  const specialExpenseTotal =
    breakdown.enjoyment +
    breakdown.lifeMaintenance +
    breakdown.housingCar +
    breakdown.medicalCare +
    breakdown.familySupport;
  return specialExpenseTotal > 0 ? breakdown.enjoyment / specialExpenseTotal : 0;
}

export function calculateOptionLiquidityAnalysis(
  result: Pick<SimulationResult, "annual">,
  periodInput?: Partial<FlexibleFreeCashPeriod>,
): OptionLiquidityAnalysis {
  const { period, rows } = getRowsInFlexibleFreeCashPeriod(result, periodInput);
  const declaredOptionProfitTotal = rows.reduce((sum, row) => sum + row.declaredCapitalGainsIncomeTotal, 0);
  const profitSweptToLiquidTotal = rows.reduce((sum, row) => sum + row.optionProfitSweepTotal, 0);
  const accountReleasedToLiquidTotal = rows.reduce((sum, row) => sum + row.optionAccountReleaseTotal, 0);
  const suspendedIncomeTotal = rows.reduce((sum, row) => sum + row.optionIncomeSuspendedTotal, 0);
  const optionToLiquidTotal = profitSweptToLiquidTotal + accountReleasedToLiquidTotal;

  return {
    period,
    yearCount: rows.length,
    declaredOptionProfitTotal,
    profitSweptToLiquidTotal,
    accountReleasedToLiquidTotal,
    optionToLiquidTotal,
    suspendedIncomeTotal,
    optionToLiquidShareOfDeclaredProfit: declaredOptionProfitTotal > 0 ? optionToLiquidTotal / declaredOptionProfitTotal : null,
  };
}

export function findSpecialExpenseCategoryWarnings(
  events: Pick<SpecialExpenseEvent, "id" | "name" | "category">[],
): SpecialExpenseCategoryWarning[] {
  return events
    .filter((event) => (event.category ?? "lifeMaintenance") === "lifeMaintenance" && enjoymentNamePattern.test(event.name))
    .map((event) => ({
      eventId: event.id,
      eventName: event.name,
      suggestedCategory: "enjoyment",
      reason: "名称から楽しみ支出の可能性があります。生活維持のままでよいか確認してください。",
    }));
}

function getTrialPeriodYearMonths(
  result: Pick<SimulationResult, "monthly">,
  input: Pick<AdditionalSpendingTrialInput, "startAge" | "endAge">,
) {
  const startAge = Math.max(0, Math.trunc(input.startAge));
  const endAge = Math.max(startAge, Math.trunc(input.endAge));
  const rows = result.monthly.filter((row) => row.ageYears >= startAge && row.ageYears <= endAge);
  return {
    startAge,
    endAge,
    rows,
    startYearMonth: rows[0]?.yearMonth,
    endYearMonth: rows.at(-1)?.yearMonth,
  };
}

export function calculateAdditionalSpendingTrial(
  scenario: ScenarioData,
  baselineResult: SimulationResult,
  input: AdditionalSpendingTrialInput,
): AdditionalSpendingTrial {
  const period = getTrialPeriodYearMonths(baselineResult, input);
  const annualAmount = Math.max(0, input.annualAmount);
  const monthlyAmount = annualAmount / 12;
  const trialScenario = structuredClone(scenario);

  if (period.startYearMonth && period.endYearMonth && monthlyAmount > 0) {
    trialScenario.specialExpenses.push({
      id: "asset-use-trial-additional-spending",
      name: "追加支出シミュレーター",
      yearMonth: period.startYearMonth,
      endYearMonth: period.endYearMonth,
      amount: monthlyAmount,
      category: input.category,
      schedule: "monthly",
      note: "資産活用ビューの一時試算です。保存データには反映しません。",
    });
  }

  const result = simulateScenario(trialScenario);
  const normalizedInput = {
    ...input,
    startAge: period.startAge,
    endAge: period.endAge,
    annualAmount,
  };
  const flexibleFreeCash = calculateFlexibleFreeCashSummary(result, normalizedInput);
  const targetBalance = calculateTargetBalanceAnalysis(trialScenario, result);
  const depletionLabel = result.depletionYearMonth ? `${result.depletionAgeYears}歳${result.depletionAgeMonths}か月` : "期間内維持";

  return {
    input: normalizedInput,
    monthlyAmount,
    totalAddedExpense: monthlyAmount * period.rows.length,
    startYearMonth: period.startYearMonth,
    endYearMonth: period.endYearMonth,
    result,
    targetBalance,
    flexibleFreeCash,
    depletionLabel,
  };
}
