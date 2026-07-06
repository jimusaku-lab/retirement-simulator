import dayjs from "dayjs";
import { historicalMarketReturnDataset } from "@/data/historicalMarketReturns";
import {
  getHistoricalReturnMonth,
  getHistoricalSinglePathDataCoverage,
  getRequiredHistoricalReturnMonths,
} from "@/lib/assetReturnModel";
import { calculateLifetimeTotalExpenseSummary } from "@/lib/lifetimeExpense";
import { getBalanceAtAge, simulateScenario } from "@/lib/simulation";
import type { AssetReturnModel, HistoricalAssetMapping, GrowthAssetKey, ScenarioData, YearMonth } from "@/types";

type HistoricalRollingRangeModel = Extract<AssetReturnModel, { mode: "historicalRollingRange" }>;

export type HistoricalRollingBacktestPath = {
  startYearMonth: YearMonth;
  endYearMonth: YearMonth;
  targetAgeBalance: number;
  age90Balance: number;
  depleted: boolean;
  depletionYearMonth?: YearMonth;
  depletionAgeYears?: number;
  depletionAgeMonths?: number;
  maxDrawdown: number;
  lifetimeTotalExpense: number;
  growthAmount: number;
  endingAssets: number;
};

export type HistoricalRollingMetricPoint = {
  value: number;
  startYearMonth: YearMonth;
};

export type HistoricalRollingMetricSummary = {
  worst: HistoricalRollingMetricPoint;
  p10: HistoricalRollingMetricPoint;
  median: HistoricalRollingMetricPoint;
  p90: HistoricalRollingMetricPoint;
  best: HistoricalRollingMetricPoint;
};

export type HistoricalRollingBacktestEstimate = {
  rangeStartYearMonth: YearMonth;
  rangeEndYearMonth: YearMonth;
  requiredMonths: number;
  totalPathCount: number;
  validPathCount: number;
  excludedPathCount: number;
  requiredIndexIds: string[];
  tooManyPathWarning: boolean;
};

export type HistoricalRollingBacktestResult = HistoricalRollingBacktestEstimate & {
  paths: HistoricalRollingBacktestPath[];
  depletedPathCount: number;
  depletionRate: number;
  dataInsufficientReason: string;
  worstStartYearMonth?: YearMonth;
  bestStartYearMonth?: YearMonth;
  targetAgeBalance: HistoricalRollingMetricSummary | null;
  age90Balance: HistoricalRollingMetricSummary | null;
  maxDrawdown: {
    worst: HistoricalRollingMetricPoint;
    median: HistoricalRollingMetricPoint;
  } | null;
};

function monthRange(startYearMonth: YearMonth, endYearMonth: YearMonth) {
  const months: YearMonth[] = [];
  const start = dayjs(`${startYearMonth}-01`);
  const end = dayjs(`${endYearMonth}-01`);
  if (!start.isValid() || !end.isValid() || start.isAfter(end)) return months;
  for (let cursor = start; !cursor.isAfter(end); cursor = cursor.add(1, "month")) {
    months.push(cursor.format("YYYY-MM"));
  }
  return months;
}

function metricPoint(path: HistoricalRollingBacktestPath, value: number): HistoricalRollingMetricPoint {
  return { value, startYearMonth: path.startYearMonth };
}

function percentileIndex(length: number, percentile: number) {
  return Math.min(length - 1, Math.max(0, Math.floor((length - 1) * percentile)));
}

function summarizeMetric(
  paths: HistoricalRollingBacktestPath[],
  getValue: (path: HistoricalRollingBacktestPath) => number,
): HistoricalRollingMetricSummary | null {
  if (paths.length === 0) return null;
  const sorted = [...paths].sort((a, b) => getValue(a) - getValue(b));
  return {
    worst: metricPoint(sorted[0], getValue(sorted[0])),
    p10: metricPoint(sorted[percentileIndex(sorted.length, 0.1)], getValue(sorted[percentileIndex(sorted.length, 0.1)])),
    median: metricPoint(sorted[percentileIndex(sorted.length, 0.5)], getValue(sorted[percentileIndex(sorted.length, 0.5)])),
    p90: metricPoint(sorted[percentileIndex(sorted.length, 0.9)], getValue(sorted[percentileIndex(sorted.length, 0.9)])),
    best: metricPoint(sorted[sorted.length - 1], getValue(sorted[sorted.length - 1])),
  };
}

function calculateMaxDrawdown(path: ReturnType<typeof simulateScenario>) {
  let peak = path.monthly[0]?.endingAssets ?? 0;
  let maxDrawdown = 0;
  for (const row of path.monthly) {
    peak = Math.max(peak, row.endingAssets);
    maxDrawdown = Math.max(maxDrawdown, peak - row.endingAssets);
  }
  return Math.round(maxDrawdown);
}

function buildSinglePathScenario(
  scenario: ScenarioData,
  model: HistoricalRollingRangeModel,
  startYearMonth: YearMonth,
): ScenarioData {
  const next = structuredClone(scenario);
  next.assetGrowthSettings.returnModel = {
    mode: "historicalSinglePath",
    datasetId: model.datasetId,
    startYearMonth,
    currencyMode: "indexOnly",
    assetMappings: structuredClone(model.assetMappings) as Partial<Record<GrowthAssetKey, HistoricalAssetMapping>>,
  };
  return next;
}

export function estimateHistoricalRollingBacktestPaths(
  scenario: ScenarioData,
  model: HistoricalRollingRangeModel,
): HistoricalRollingBacktestEstimate {
  const requiredMonths = getRequiredHistoricalReturnMonths(scenario);
  const candidateMonths = monthRange(model.rangeStartYearMonth, model.rangeEndYearMonth);
  let validPathCount = 0;
  let requiredIndexIds: string[] = [];

  for (const month of candidateMonths) {
    const coverage = getHistoricalSinglePathDataCoverage(month, requiredMonths, model.assetMappings);
    requiredIndexIds = coverage.requiredIndexIds;
    if (coverage.isSufficient) validPathCount += 1;
  }

  return {
    rangeStartYearMonth: model.rangeStartYearMonth,
    rangeEndYearMonth: model.rangeEndYearMonth,
    requiredMonths,
    totalPathCount: candidateMonths.length,
    validPathCount,
    excludedPathCount: Math.max(0, candidateMonths.length - validPathCount),
    requiredIndexIds,
    tooManyPathWarning: candidateMonths.length > 240,
  };
}

export function runHistoricalRollingBacktest(
  scenario: ScenarioData,
  model: HistoricalRollingRangeModel,
): HistoricalRollingBacktestResult {
  const estimate = estimateHistoricalRollingBacktestPaths(scenario, model);
  const paths: HistoricalRollingBacktestPath[] = [];

  for (const startYearMonth of monthRange(model.rangeStartYearMonth, model.rangeEndYearMonth)) {
    const coverage = getHistoricalSinglePathDataCoverage(startYearMonth, estimate.requiredMonths, model.assetMappings);
    if (!coverage.isSufficient) continue;

    const result = simulateScenario(buildSinglePathScenario(scenario, model, startYearMonth));
    const lastMonthly = result.monthly.at(-1);
    const age90Balance = getBalanceAtAge(result.monthly, 90) ?? lastMonthly?.endingAssets ?? 0;
    const targetAgeBalance = result.targetAgeBalance ?? lastMonthly?.endingAssets ?? 0;
    const lifetimeTotalExpense = calculateLifetimeTotalExpenseSummary(result, scenario.userProfile.targetBalanceAge).total;
    paths.push({
      startYearMonth,
      endYearMonth: getHistoricalReturnMonth(startYearMonth, estimate.requiredMonths - 1),
      targetAgeBalance,
      age90Balance,
      depleted: result.depletionYearMonth !== undefined,
      depletionYearMonth: result.depletionYearMonth,
      depletionAgeYears: result.depletionAgeYears,
      depletionAgeMonths: result.depletionAgeMonths,
      maxDrawdown: calculateMaxDrawdown(result),
      lifetimeTotalExpense,
      growthAmount: result.annual.reduce((sum, row) => sum + row.growthAmount, 0),
      endingAssets: lastMonthly?.endingAssets ?? 0,
    });
  }

  const targetAgeBalance = summarizeMetric(paths, (path) => path.targetAgeBalance);
  const age90Balance = summarizeMetric(paths, (path) => path.age90Balance);
  const drawdownSorted = [...paths].sort((a, b) => a.maxDrawdown - b.maxDrawdown);
  const depletedPathCount = paths.filter((path) => path.depleted).length;

  return {
    ...estimate,
    paths,
    depletedPathCount,
    depletionRate: paths.length ? depletedPathCount / paths.length : 0,
    dataInsufficientReason: "必要月数分の過去データがない開始月は検証対象外です。平均リターンなどでは補完しません。",
    worstStartYearMonth: age90Balance?.worst.startYearMonth,
    bestStartYearMonth: age90Balance?.best.startYearMonth,
    targetAgeBalance,
    age90Balance,
    maxDrawdown: drawdownSorted.length
      ? {
          worst: metricPoint(drawdownSorted[drawdownSorted.length - 1], drawdownSorted[drawdownSorted.length - 1].maxDrawdown),
          median: metricPoint(drawdownSorted[percentileIndex(drawdownSorted.length, 0.5)], drawdownSorted[percentileIndex(drawdownSorted.length, 0.5)].maxDrawdown),
        }
      : null,
  };
}

export function createHistoricalRollingBacktestFingerprint(
  scenario: ScenarioData,
  model: HistoricalRollingRangeModel,
) {
  return JSON.stringify({
    scenario,
    returnModel: model,
    datasetId: historicalMarketReturnDataset.id,
    datasetLastMonth: historicalMarketReturnDataset.lastMonth,
  });
}
