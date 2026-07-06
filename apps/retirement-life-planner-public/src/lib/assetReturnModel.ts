import dayjs from "dayjs";
import { historicalMarketReturnDataset, historicalMarketReturns } from "@/data/historicalMarketReturns";
import type { AssetReturnModel, GrowthAssetKey, GrowthSettings, HistoricalAssetMapping, ScenarioData, YearMonth } from "@/types";

const historicalReturnByMonth = new Map(historicalMarketReturns.map((row) => [row.month, row]));

export const phase1HistoricalReturnAssetKeys: GrowthAssetKey[] = [
  "nisa",
  "specificAccount",
  "ordinaryAccountForOptions",
  "ideco",
];

const defaultHistoricalMapping: HistoricalAssetMapping = {
  type: "historicalPortfolio",
  allocations: [{ indexId: "sp500", weight: 1 }],
};

export function createDefaultHistoricalSinglePathReturnModel(startYearMonth: YearMonth = "2000-01"): AssetReturnModel {
  return {
    mode: "historicalSinglePath",
    datasetId: historicalMarketReturnDataset.id,
    startYearMonth,
    currencyMode: "indexOnly",
    assetMappings: Object.fromEntries(
      phase1HistoricalReturnAssetKeys.map((key) => [key, structuredClone(defaultHistoricalMapping)]),
    ) as Partial<Record<GrowthAssetKey, HistoricalAssetMapping>>,
  };
}

export function getEffectiveReturnModel(settings: GrowthSettings): AssetReturnModel {
  return settings.returnModel ?? { mode: "fixedAnnual" };
}

export function getHistoricalReturnMonth(startYearMonth: YearMonth, simulationMonthIndex: number): YearMonth {
  return dayjs(`${startYearMonth}-01`).add(simulationMonthIndex, "month").format("YYYY-MM");
}

export function getRequiredHistoricalReturnMonths(scenario: ScenarioData): number {
  const start = dayjs(`${scenario.userProfile.simulationStartYearMonth}-01`);
  const target = dayjs(scenario.userProfile.birthDate).add(scenario.userProfile.targetBalanceAge, "year").endOf("month");
  return Math.max(1, target.diff(start, "month"));
}

export function getHistoricalSinglePathDataCoverage(startYearMonth: YearMonth, requiredMonths: number) {
  const required = Math.max(1, requiredMonths);
  const lastRequiredMonth = getHistoricalReturnMonth(startYearMonth, required - 1);
  const availableMonths = historicalMarketReturns.filter((row) => row.month >= startYearMonth && row.month <= lastRequiredMonth).length;
  return {
    requiredMonths: required,
    startYearMonth,
    lastRequiredMonth,
    availableMonths,
    missingMonths: Math.max(0, required - availableMonths),
    isSufficient: availableMonths >= required,
  };
}

export function getFixedAnnualMonthlyGrowthRate(settings: GrowthSettings, assetKey: GrowthAssetKey): number {
  return Math.pow(1 + (settings.rates[assetKey] ?? 0), 1 / 12) - 1;
}

function getHistoricalIndexReturn(indexId: string, month: YearMonth): number | undefined {
  if (indexId === "cash") return 0;
  if (indexId !== "sp500") return undefined;
  return historicalReturnByMonth.get(month)?.sp500;
}

function getHistoricalPortfolioReturn(mapping: HistoricalAssetMapping, month: YearMonth): number | undefined {
  if (mapping.type === "fixedAnnual") return undefined;
  let totalWeight = 0;
  let weightedReturn = 0;
  for (const allocation of mapping.allocations) {
    const weight = Math.max(0, allocation.weight);
    if (weight <= 0) continue;
    const indexReturn = getHistoricalIndexReturn(allocation.indexId, month);
    if (indexReturn === undefined) return undefined;
    weightedReturn += indexReturn * weight;
    totalWeight += weight;
  }
  if (totalWeight <= 0) return undefined;
  return weightedReturn / totalWeight;
}

export function getMonthlyAssetGrowthRate(
  settings: GrowthSettings,
  assetKey: GrowthAssetKey,
  simulationMonthIndex: number,
): number {
  const returnModel = getEffectiveReturnModel(settings);
  if (returnModel.mode !== "historicalSinglePath" || returnModel.currencyMode !== "indexOnly") {
    return getFixedAnnualMonthlyGrowthRate(settings, assetKey);
  }

  const mapping = returnModel.assetMappings[assetKey];
  if (!mapping || mapping.type === "fixedAnnual") {
    return getFixedAnnualMonthlyGrowthRate(settings, assetKey);
  }

  const historicalMonth = getHistoricalReturnMonth(returnModel.startYearMonth, simulationMonthIndex);
  return getHistoricalPortfolioReturn(mapping, historicalMonth) ?? 0;
}

export function getHistoricalReturnDatasetSummary() {
  return historicalMarketReturnDataset;
}
