import {
  calculateFlexibleFreeCashSummary,
  calculateSpecialExpenseCategoryTotals,
  getRowsInFlexibleFreeCashPeriod,
  type FlexibleFreeCashPeriod,
  type SpecialExpenseCategory,
} from "@/lib/flexibleFreeCash";
import { isEventActive, simulateScenario } from "@/lib/simulation";
import { isOrdinaryOptionIncomeEvent } from "@/lib/optionIncomeHints";
import type { IncomeEvent, ScenarioData, SimulationResult, SpecialExpenseEvent } from "@/types";

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

export type IncomePowerDiagnosticRow = {
  monthlyIncomePower: number;
  activeMonths: number;
  grossIncomeIncrease: number;
  taxAndSocialIncrease: number;
  netIncomeIncrease: number;
  effectiveRate: number | null;
  maxAdditionalEnjoymentAnnual: number;
  maxAdditionalEnjoymentTotal: number;
  targetBalanceGapAfterMax: number;
  targetBalanceStatusAfterMax: TargetBalanceStatus;
  depletionLabelAfterMax: string;
};

export type IncomePowerDiagnostics = {
  period: FlexibleFreeCashPeriod;
  sourceEventCount: number;
  baselineMonthlyIncomePower: number;
  baselineMaxAdditionalEnjoymentAnnual: number;
  rows: IncomePowerDiagnosticRow[];
  firstUsefulMonthlyIncomePower?: number;
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

function getOrdinaryOptionIncomeEvents(scenario: Pick<ScenarioData, "incomeEvents">) {
  return scenario.incomeEvents.filter((event) => isOrdinaryOptionIncomeEvent(event));
}

function setOrdinaryOptionIncomePower(scenario: ScenarioData, monthlyIncomePower: number) {
  const optionIncomeEvents = getOrdinaryOptionIncomeEvents(scenario);
  const optionIncomeEventIds = new Set(optionIncomeEvents.map((event) => event.id));
  const currentTotal = optionIncomeEvents.reduce((sum, event) => sum + Math.max(0, event.monthlyAmount ?? 0), 0);
  let remainingAmount = monthlyIncomePower;
  let remainingWeight = currentTotal > 0 ? currentTotal : 1;
  scenario.name = "入金力診断";
  scenario.incomeEvents = scenario.incomeEvents.map((event) =>
    optionIncomeEventIds.has(event.id)
      ? (() => {
          const weight = currentTotal > 0 ? Math.max(0, event.monthlyAmount ?? 0) : remainingAmount === monthlyIncomePower ? 1 : 0;
          const allocatedAmount = remainingWeight > 0 ? Math.round((remainingAmount * weight) / remainingWeight) : 0;
          remainingAmount = Math.max(0, remainingAmount - allocatedAmount);
          remainingWeight = Math.max(0, remainingWeight - weight);
          return {
            ...event,
            monthlyAmount: remainingWeight === 0 ? remainingAmount + allocatedAmount : allocatedAmount,
            amountInputMode: "monthly" as const,
            taxTreatment: "taxable" as const,
            sourceAssetPayoutMode: "retainInSourceAsset" as const,
          };
        })()
      : event,
  );
}

function countIncomePowerActiveMonths(
  scenario: Pick<ScenarioData, "incomeEvents">,
  result: Pick<SimulationResult, "monthly">,
  period: FlexibleFreeCashPeriod,
) {
  const events = getOrdinaryOptionIncomeEvents(scenario);
  return events.reduce(
    (sum, event) =>
      sum +
      result.monthly.filter(
        (row) =>
          row.ageYears >= period.startAge &&
          row.ageYears <= period.endAge &&
          isEventActive(event as Pick<IncomeEvent, "startYearMonth" | "endYearMonth">, row.yearMonth),
      ).length,
    0,
  );
}

function calculateOptionIncomeGrossAmount(
  scenario: Pick<ScenarioData, "incomeEvents">,
  result: Pick<SimulationResult, "monthly">,
  period: FlexibleFreeCashPeriod,
) {
  const events = getOrdinaryOptionIncomeEvents(scenario);
  return events.reduce(
    (sum, event) =>
      sum +
      result.monthly.filter(
        (row) =>
          row.ageYears >= period.startAge &&
          row.ageYears <= period.endAge &&
          isEventActive(event as Pick<IncomeEvent, "startYearMonth" | "endYearMonth">, row.yearMonth),
      ).length * Math.max(0, event.monthlyAmount ?? 0),
    0,
  );
}

function findMaxAdditionalEnjoymentAnnual(
  scenario: ScenarioData,
  result: SimulationResult,
  period: FlexibleFreeCashPeriod,
  maxAnnualAmount = 6_000_000,
) {
  const targetAmount = Math.max(0, scenario.userProfile.targetBalanceAmount ?? 0);
  const baselineTargetBalance = result.targetAgeBalance ?? 0;
  if (baselineTargetBalance < targetAmount) {
    const targetBalance = calculateTargetBalanceAnalysis(scenario, result);
    return {
      annualAmount: 0,
      trial: {
        targetBalance,
        totalAddedExpense: 0,
        depletionLabel: result.depletionYearMonth ? `${result.depletionAgeYears}歳${result.depletionAgeMonths}か月` : "期間内維持",
      },
    };
  }

  let low = 0;
  let high = maxAnnualAmount;
  let best = calculateAdditionalSpendingTrial(scenario, result, {
    ...period,
    annualAmount: 0,
    category: "enjoyment",
  });

  for (let i = 0; i < 12; i += 1) {
    const mid = Math.round((low + high) / 200_000) * 100_000;
    const trial = calculateAdditionalSpendingTrial(scenario, result, {
      ...period,
      annualAmount: mid,
      category: "enjoyment",
    });
    if (trial.targetBalance.gap >= 0) {
      best = trial;
      low = mid + 100_000;
    } else {
      high = mid - 100_000;
    }
    if (high < low) break;
  }

  return {
    annualAmount: Math.max(0, best.input.annualAmount),
    trial: best,
  };
}

export function calculateIncomePowerDiagnostics(
  scenario: ScenarioData,
  periodInput?: Partial<FlexibleFreeCashPeriod>,
  monthlyIncomePowers = [0, 100_000, 200_000, 300_000, 400_000, 500_000],
): IncomePowerDiagnostics {
  const period = calculateFlexibleFreeCashSummary(simulateScenario(scenario), periodInput).period;
  const sourceEventCount = getOrdinaryOptionIncomeEvents(scenario).length;
  const baselineMonthlyIncomePower = getOrdinaryOptionIncomeEvents(scenario).reduce(
    (sum, event) => sum + Math.max(0, event.monthlyAmount ?? 0),
    0,
  );
  if (sourceEventCount === 0) {
    return {
      period,
      sourceEventCount,
      baselineMonthlyIncomePower,
      baselineMaxAdditionalEnjoymentAnnual: 0,
      rows: [],
    };
  }
  const zeroScenario = structuredClone(scenario);
  setOrdinaryOptionIncomePower(zeroScenario, 0);
  const zeroResult = simulateScenario(zeroScenario);
  const zeroSummary = calculateFlexibleFreeCashSummary(zeroResult, period);
  const zeroGrossIncome = calculateOptionIncomeGrossAmount(zeroScenario, zeroResult, period);
  const zeroMaxAdditional = findMaxAdditionalEnjoymentAnnual(zeroScenario, zeroResult, period);
  const uniqueMonthlyIncomePowers = [...new Set(monthlyIncomePowers.map((amount) => Math.max(0, Math.round(amount))))].sort((a, b) => a - b);

  const rows = uniqueMonthlyIncomePowers.map((monthlyIncomePower) => {
    const trialScenario = structuredClone(scenario);
    setOrdinaryOptionIncomePower(trialScenario, monthlyIncomePower);
    const trialResult = simulateScenario(trialScenario);
    const trialSummary = calculateFlexibleFreeCashSummary(trialResult, period);
    const maxAdditional = findMaxAdditionalEnjoymentAnnual(trialScenario, trialResult, period);
    const activeMonths = countIncomePowerActiveMonths(trialScenario, trialResult, period);
    const grossIncomeIncrease = Math.max(0, calculateOptionIncomeGrossAmount(trialScenario, trialResult, period) - zeroGrossIncome);
    const taxAndSocialIncrease = Math.max(0, trialSummary.taxAndSocialTotal - zeroSummary.taxAndSocialTotal);
    const netIncomeIncrease = grossIncomeIncrease - taxAndSocialIncrease;

    return {
      monthlyIncomePower,
      activeMonths,
      grossIncomeIncrease,
      taxAndSocialIncrease,
      netIncomeIncrease,
      effectiveRate: grossIncomeIncrease > 0 ? netIncomeIncrease / grossIncomeIncrease : null,
      maxAdditionalEnjoymentAnnual: maxAdditional.annualAmount,
      maxAdditionalEnjoymentTotal: maxAdditional.trial.totalAddedExpense,
      targetBalanceGapAfterMax: maxAdditional.trial.targetBalance.gap,
      targetBalanceStatusAfterMax: maxAdditional.trial.targetBalance.status,
      depletionLabelAfterMax: maxAdditional.trial.depletionLabel,
    };
  });

  const firstUsefulRow = rows.find(
    (row) =>
      row.monthlyIncomePower > 0 &&
      row.maxAdditionalEnjoymentAnnual > zeroMaxAdditional.annualAmount &&
      (row.effectiveRate ?? 0) > 0,
  );

  return {
    period,
    sourceEventCount,
    baselineMonthlyIncomePower,
    baselineMaxAdditionalEnjoymentAnnual: zeroMaxAdditional.annualAmount,
    rows,
    firstUsefulMonthlyIncomePower: firstUsefulRow?.monthlyIncomePower,
  };
}
