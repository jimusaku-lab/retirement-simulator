import dayjs from "dayjs";
import { historicalMarketReturnDataset, historicalMarketReturns } from "@/data/historicalMarketReturns";
import type { AssetReturnModel, GrowthAssetKey, GrowthSettings, HistoricalAssetMapping, ScenarioData, YearMonth } from "@/types";

const historicalReturnByMonth = new Map(historicalMarketReturns.map((row) => [row.month, row]));

export const historicalReturnAssetKeys: GrowthAssetKey[] = [
  "nisa",
  "specificAccount",
  "ordinaryAccountForOptions",
  "ideco",
];

export const phase1HistoricalReturnAssetKeys = historicalReturnAssetKeys;

export type HistoricalReturnPresetId =
  | "fixedAnnual"
  | "sp500_100"
  | "nasdaq100_100"
  | "sp500_80_usBond_20"
  | "sp500_60_usBond_40";

export const historicalReturnPresets: Array<{
  id: HistoricalReturnPresetId;
  label: string;
  mapping: HistoricalAssetMapping;
}> = [
  { id: "fixedAnnual", label: "固定年率のまま", mapping: { type: "fixedAnnual" } },
  { id: "sp500_100", label: "S&P500 100%", mapping: { type: "historicalPortfolio", allocations: [{ indexId: "sp500", weight: 1 }] } },
  { id: "nasdaq100_100", label: "NASDAQ100 100%", mapping: { type: "historicalPortfolio", allocations: [{ indexId: "nasdaq100", weight: 1 }] } },
  {
    id: "sp500_80_usBond_20",
    label: "S&P500 80% / 米国債券 20%",
    mapping: { type: "historicalPortfolio", allocations: [{ indexId: "sp500", weight: 0.8 }, { indexId: "usBond", weight: 0.2 }] },
  },
  {
    id: "sp500_60_usBond_40",
    label: "S&P500 60% / 米国債券 40%",
    mapping: { type: "historicalPortfolio", allocations: [{ indexId: "sp500", weight: 0.6 }, { indexId: "usBond", weight: 0.4 }] },
  },
];

const defaultHistoricalMapping = historicalReturnPresets.find((preset) => preset.id === "sp500_100")!.mapping;

export function createDefaultHistoricalSinglePathReturnModel(startYearMonth: YearMonth = "2000-01"): AssetReturnModel {
  return {
    mode: "historicalSinglePath",
    datasetId: historicalMarketReturnDataset.id,
    startYearMonth,
    currencyMode: "indexOnly",
    assetMappings: Object.fromEntries(
      historicalReturnAssetKeys.map((key) => [key, structuredClone(defaultHistoricalMapping)]),
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

function getHistoricalIndexIdsFromMappings(assetMappings?: Partial<Record<GrowthAssetKey, HistoricalAssetMapping>>) {
  const ids = new Set<string>();
  for (const mapping of Object.values(assetMappings ?? {})) {
    if (!mapping || mapping.type !== "historicalPortfolio") continue;
    for (const allocation of mapping.allocations) {
      if (allocation.weight > 0 && allocation.indexId !== "cash") ids.add(allocation.indexId);
    }
  }
  return [...ids];
}

export function getHistoricalSinglePathDataCoverage(
  startYearMonth: YearMonth,
  requiredMonths: number,
  assetMappings?: Partial<Record<GrowthAssetKey, HistoricalAssetMapping>>,
) {
  const required = Math.max(1, requiredMonths);
  const lastRequiredMonth = getHistoricalReturnMonth(startYearMonth, required - 1);
  const requiredIndexIds = getHistoricalIndexIdsFromMappings(assetMappings);
  const availableMonths = historicalMarketReturns.filter((row) => {
    if (row.month < startYearMonth || row.month > lastRequiredMonth) return false;
    return requiredIndexIds.every((indexId) => getHistoricalIndexReturn(indexId, row.month) !== undefined);
  }).length;
  return {
    requiredMonths: required,
    startYearMonth,
    lastRequiredMonth,
    availableMonths,
    missingMonths: Math.max(0, required - availableMonths),
    isSufficient: availableMonths >= required,
    requiredIndexIds,
  };
}

export function getFixedAnnualMonthlyGrowthRate(settings: GrowthSettings, assetKey: GrowthAssetKey): number {
  return Math.pow(1 + (settings.rates[assetKey] ?? 0), 1 / 12) - 1;
}

function getHistoricalIndexReturn(indexId: string, month: YearMonth): number | undefined {
  if (indexId === "cash") return 0;
  const row = historicalReturnByMonth.get(month);
  if (indexId === "sp500") return row?.sp500;
  if (indexId === "nasdaq100") return row?.nasdaq100;
  if (indexId === "usBond") return row?.usBond;
  return undefined;
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
  if (Math.abs(totalWeight - 1) > 0.0001) return undefined;
  return weightedReturn;
}

export function getHistoricalReturnPresetId(mapping: HistoricalAssetMapping | undefined): HistoricalReturnPresetId {
  if (!mapping || mapping.type === "fixedAnnual") return "fixedAnnual";
  const normalized = mapping.allocations
    .filter((allocation) => allocation.weight > 0)
    .map((allocation) => ({ indexId: allocation.indexId, weight: Number(allocation.weight.toFixed(4)) }))
    .sort((a, b) => a.indexId.localeCompare(b.indexId));
  for (const preset of historicalReturnPresets) {
    if (preset.mapping.type === "fixedAnnual") continue;
    const presetAllocations = preset.mapping.allocations
      .map((allocation) => ({ indexId: allocation.indexId, weight: Number(allocation.weight.toFixed(4)) }))
      .sort((a, b) => a.indexId.localeCompare(b.indexId));
    if (JSON.stringify(normalized) === JSON.stringify(presetAllocations)) return preset.id;
  }
  return "fixedAnnual";
}

export function getHistoricalReturnPresetLabel(mapping: HistoricalAssetMapping | undefined) {
  const presetId = getHistoricalReturnPresetId(mapping);
  return historicalReturnPresets.find((preset) => preset.id === presetId)?.label ?? "固定年率のまま";
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
