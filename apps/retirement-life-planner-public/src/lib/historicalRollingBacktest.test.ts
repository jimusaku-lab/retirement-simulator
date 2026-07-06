import { describe, expect, it } from "vitest";
import { sampleState } from "@/data/sampleData";
import { createDefaultHistoricalRollingRangeReturnModel } from "@/lib/assetReturnModel";
import { estimateHistoricalRollingBacktestPaths, runHistoricalRollingBacktest } from "@/lib/historicalRollingBacktest";
import { simulateScenario } from "@/lib/simulation";
import type { ScenarioData } from "@/types";

function testScenario(): ScenarioData {
  const scenario = structuredClone(sampleState.scenarios[0]);
  scenario.userProfile = {
    ...scenario.userProfile,
    birthDate: "1966-04-01",
    simulationStartYearMonth: "2026-04",
    simulationEndMode: "yearMonth",
    simulationEndYearMonth: "2026-06",
    targetBalanceAge: 90,
  };
  scenario.assetGrowthSettings = {
    enabled: true,
    rates: {
      cash: 0,
      bankDeposit: 0,
      timeDeposit: 0.01,
      nisa: 0.06,
      specificAccount: 0.05,
      ordinaryAccountForOptions: 0.05,
      ideco: 0.07,
    },
  };
  return scenario;
}

describe("historical rolling backtest", () => {
  it("必要月数を満たす開始月だけを範囲検証の対象にする", () => {
    const scenario = testScenario();
    const model = createDefaultHistoricalRollingRangeReturnModel("1990-01", "1990-03");
    if (model.mode !== "historicalRollingRange") throw new Error("rolling range model expected");

    const estimate = estimateHistoricalRollingBacktestPaths(scenario, model);

    expect(estimate.requiredMonths).toBe(360);
    expect(estimate.totalPathCount).toBe(3);
    expect(estimate.validPathCount).toBe(3);
    expect(estimate.excludedPathCount).toBe(0);
  });

  it("必要月数に足りない開始月は平均リターンで補完せず除外する", () => {
    const scenario = testScenario();
    scenario.userProfile.targetBalanceAge = 100;
    const model = createDefaultHistoricalRollingRangeReturnModel("2000-01", "2000-03");
    if (model.mode !== "historicalRollingRange") throw new Error("rolling range model expected");

    const estimate = estimateHistoricalRollingBacktestPaths(scenario, model);
    const result = runHistoricalRollingBacktest(scenario, model);

    expect(estimate.requiredMonths).toBe(480);
    expect(estimate.totalPathCount).toBe(3);
    expect(estimate.validPathCount).toBe(0);
    expect(estimate.excludedPathCount).toBe(3);
    expect(result.paths).toHaveLength(0);
    expect(result.dataInsufficientReason).toContain("補完しません");
  });

  it("円換算リターンではUSD/JPYデータ不足の開始月を範囲検証から除外する", () => {
    const scenario = testScenario();
    scenario.userProfile.targetBalanceAge = 60;
    const model = createDefaultHistoricalRollingRangeReturnModel("1970-01", "1971-03");
    if (model.mode !== "historicalRollingRange") throw new Error("rolling range model expected");
    model.currencyMode = "jpyConverted";

    const estimate = estimateHistoricalRollingBacktestPaths(scenario, model);
    const result = runHistoricalRollingBacktest(scenario, model);

    expect(estimate.requiredMonths).toBe(1);
    expect(estimate.totalPathCount).toBe(15);
    expect(estimate.validPathCount).toBe(2);
    expect(estimate.excludedPathCount).toBe(13);
    expect(result.paths.map((path) => path.startYearMonth)).toEqual(["1971-02", "1971-03"]);
    expect(result.dataInsufficientReason).toContain("USD/JPY");
  });

  it("範囲検証は各開始月を既存シミュレーションに当てはめて集計する", () => {
    const scenario = testScenario();
    const model = createDefaultHistoricalRollingRangeReturnModel("1990-01", "1990-03");
    if (model.mode !== "historicalRollingRange") throw new Error("rolling range model expected");

    const result = runHistoricalRollingBacktest(scenario, model);

    expect(result.paths).toHaveLength(3);
    expect(result.age90Balance?.worst.startYearMonth).toBeDefined();
    expect(result.age90Balance?.median.value).toEqual(expect.any(Number));
    expect(result.maxDrawdown?.worst.value).toBeGreaterThanOrEqual(result.maxDrawdown?.median.value ?? 0);
    expect(result.depletedPathCount).toBe(result.paths.filter((path) => path.depleted).length);
  });

  it("通常シミュレーションは範囲検証の中央値や最悪ケースに置き換えない", () => {
    const base = testScenario();
    const rolling = structuredClone(base);
    rolling.assetGrowthSettings.returnModel = createDefaultHistoricalRollingRangeReturnModel("1990-01", "1990-03");
    const fixed = structuredClone(base);
    fixed.assetGrowthSettings.returnModel = { mode: "fixedAnnual" };

    expect(simulateScenario(rolling).monthly[0].growthAmount).toBe(simulateScenario(fixed).monthly[0].growthAmount);
  });
});
