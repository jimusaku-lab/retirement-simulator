import {
  calculateFlexibleFreeCashSummary,
  calculateSpecialExpenseCategoryTotals,
  type FlexibleFreeCashPeriod,
  type SpecialExpenseCategory,
} from "@/lib/flexibleFreeCash";
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
