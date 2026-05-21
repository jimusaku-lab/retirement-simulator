import { describe, expect, it } from "vitest";
import {
  calculateAdditionalSpendingTrial,
  calculateAssetUseCategoryBreakdown,
  calculateEnjoymentShare,
  calculateIncomePowerDiagnostics,
  calculateOptionLiquidityAnalysis,
  calculateTargetBalanceAnalysis,
  findSpecialExpenseCategoryWarnings,
} from "@/lib/assetUseAnalysis";
import { sampleState } from "@/data/sampleData";
import { simulateScenario } from "@/lib/simulation";
import type { AnnualResult } from "@/types";

function annualRow(overrides: Partial<AnnualResult>): AnnualResult {
  return {
    year: 2026,
    ageYears: 60,
    ageMonths: 0,
    incomeTotal: 0,
    retainedSourceAssetIncomeTotal: 0,
    assetTransferTotal: 0,
    assetTransferDetails: [],
    optionAccountReleaseTotal: 0,
    optionAccountReleaseDetails: [],
    optionProfitSweepTotal: 0,
    optionProfitSweepDetails: [],
    optionIncomeSuspendedTotal: 0,
    nisaContributionSkippedTotal: 0,
    nisaAnnualLimitExceededTotal: 0,
    nisaContributionTotal: 0,
    nisaCumulativeInvestment: 0,
    nisaRemainingLifetimeLimit: 0,
    assetContributionTotal: 0,
    assetContributionFundingGap: 0,
    livingExpenseTotal: 0,
    specialExpenseTotal: 0,
    taxInsuranceTotal: 0,
    taxCashBreakdown: {
      incomeTaxSettlement: 0,
      residentTax: 0,
      nationalHealthInsurance: 0,
      lateElderlyMedical: 0,
      nationalPension: 0,
      nursingCare: 0,
      otherPublicCost: 0,
      deferredCapitalGainsTax: 0,
    },
    capitalGainsTaxTotal: 0,
    deferredCapitalGainsTaxTotal: 0,
    declaredCapitalGainsIncomeTotal: 0,
    idecoWithholdingTaxTotal: 0,
    startingLiquidBuffer: 0,
    endingLiquidBuffer: 0,
    growthAmount: 0,
    withdrawalAmount: 0,
    plannedDrawdownTotal: 0,
    cashReserveTopUpAmount: 0,
    grossAssetWithdrawalAmount: 0,
    sourceAssetIncomeWithdrawalAmount: 0,
    deficitAssetWithdrawalAmount: 0,
    withdrawalSourceBreakdown: {
      cash: 0,
      bankDeposit: 0,
      timeDeposit: 0,
      nisa: 0,
      specificAccount: 0,
      ordinaryAccountForOptions: 0,
      ideco: 0,
    },
    sourceAssetIncomeBreakdown: {
      cash: 0,
      bankDeposit: 0,
      timeDeposit: 0,
      nisa: 0,
      specificAccount: 0,
      ordinaryAccountForOptions: 0,
      ideco: 0,
    },
    deficitWithdrawalBreakdown: {
      cash: 0,
      bankDeposit: 0,
      timeDeposit: 0,
      nisa: 0,
      specificAccount: 0,
      ordinaryAccountForOptions: 0,
      ideco: 0,
    },
    netCashFlow: 0,
    idecoFeeTotal: 0,
    endingAssets: 0,
    endingTrackedAssetBalances: {
      nisa: 0,
      specificAccount: 0,
      ordinaryAccountForOptions: 0,
      ideco: 0,
    },
    endingTrackedAssetCostBasis: {
      nisa: 0,
      specificAccount: 0,
      ordinaryAccountForOptions: 0,
      ideco: 0,
    },
    endingTrackedAssetUnrealizedGains: {
      nisa: 0,
      specificAccount: 0,
      ordinaryAccountForOptions: 0,
      ideco: 0,
    },
    ...overrides,
  };
}

describe("asset use analysis", () => {
  it("calculates the target balance gap without changing simulation rules", () => {
    const analysis = calculateTargetBalanceAnalysis(
      { userProfile: { targetBalanceAge: 90, targetBalanceAmount: 5_000_000 } },
      { targetAgeBalance: 18_000_000 },
    );

    expect(analysis).toEqual({
      targetAge: 90,
      targetAmount: 5_000_000,
      actualAmount: 18_000_000,
      gap: 13_000_000,
      status: "surplus",
    });
  });

  it("separates enjoyment spending from living and tax needs for the selected period", () => {
    const result = {
      annual: [
        annualRow({ year: 2026, ageYears: 60, livingExpenseTotal: 1_000_000, taxInsuranceTotal: 200_000, capitalGainsTaxTotal: 50_000 }),
        annualRow({ year: 2027, ageYears: 61, livingExpenseTotal: 1_200_000, taxInsuranceTotal: 300_000 }),
        annualRow({ year: 2028, ageYears: 62, livingExpenseTotal: 9_000_000 }),
      ],
      monthly: [
        { yearMonth: "2026-04", ageYears: 60 },
        { yearMonth: "2027-04", ageYears: 61 },
        { yearMonth: "2028-04", ageYears: 62 },
      ],
    };

    const breakdown = calculateAssetUseCategoryBreakdown(
      {
        userProfile: {
          simulationStartYearMonth: "2026-04",
        },
        inflationSettings: {
          livingCostAnnualInflationRate: 0,
          medicalAnnualInflationRate: 0,
        },
        specialExpenses: [
          { id: "trip", name: "旅行", yearMonth: "2026-04", amount: 400_000, category: "enjoyment" },
          { id: "support", name: "家族支援", yearMonth: "2027-04", amount: 300_000, category: "familySupport" },
        ],
      },
      result as never,
      { startAge: 60, endAge: 61 },
    );

    expect(breakdown.enjoyment).toBe(400_000);
    expect(breakdown.familySupport).toBe(300_000);
    expect(breakdown.livingAndTax).toBe(2_750_000);
    expect(calculateEnjoymentShare(breakdown)).toBeCloseTo(400_000 / 700_000);
  });

  it("warns when likely enjoyment events are left as life maintenance", () => {
    const warnings = findSpecialExpenseCategoryWarnings([
      { id: "domestic", name: "旅行 国内", category: "lifeMaintenance" },
      { id: "repair", name: "住宅修繕", category: "housingCar" },
    ]);

    expect(warnings).toEqual([
      {
        eventId: "domestic",
        eventName: "旅行 国内",
        suggestedCategory: "enjoyment",
        reason: "名称から楽しみ支出の可能性があります。生活維持のままでよいか確認してください。",
      },
    ]);
  });

  it("summarizes option profit converted to liquid funds in the selected period", () => {
    const analysis = calculateOptionLiquidityAnalysis(
      {
        annual: [
          annualRow({
            year: 2026,
            ageYears: 60,
            declaredCapitalGainsIncomeTotal: 1_000_000,
            optionProfitSweepTotal: 300_000,
            optionAccountReleaseTotal: 200_000,
            optionIncomeSuspendedTotal: 50_000,
          }),
          annualRow({
            year: 2027,
            ageYears: 61,
            declaredCapitalGainsIncomeTotal: 500_000,
            optionProfitSweepTotal: 100_000,
          }),
          annualRow({
            year: 2028,
            ageYears: 62,
            declaredCapitalGainsIncomeTotal: 9_000_000,
            optionProfitSweepTotal: 9_000_000,
          }),
        ],
      },
      { startAge: 60, endAge: 61 },
    );

    expect(analysis.declaredOptionProfitTotal).toBe(1_500_000);
    expect(analysis.profitSweptToLiquidTotal).toBe(400_000);
    expect(analysis.accountReleasedToLiquidTotal).toBe(200_000);
    expect(analysis.optionToLiquidTotal).toBe(600_000);
    expect(analysis.suspendedIncomeTotal).toBe(50_000);
    expect(analysis.optionToLiquidShareOfDeclaredProfit).toBeCloseTo(0.4);
  });

  it("runs an additional spending trial without mutating the source scenario", () => {
    const scenario = structuredClone(sampleState.scenarios[0]);
    const originalSpecialExpenseCount = scenario.specialExpenses.length;
    const baselineResult = simulateScenario(scenario);
    const trial = calculateAdditionalSpendingTrial(scenario, baselineResult, {
      startAge: 60,
      endAge: 60,
      annualAmount: 1_200_000,
      category: "enjoyment",
    });

    expect(scenario.specialExpenses).toHaveLength(originalSpecialExpenseCount);
    expect(trial.monthlyAmount).toBe(100_000);
    expect(trial.totalAddedExpense).toBeGreaterThan(0);
    expect(trial.startYearMonth).toBeDefined();
    expect(trial.endYearMonth).toBeDefined();
    expect(trial.result.targetAgeBalance ?? 0).toBeLessThan(baselineResult.targetAgeBalance ?? 0);
    expect(trial.targetBalance.actualAmount).toBe(trial.result.targetAgeBalance);
  });

  it("compares income power without mutating the source scenario", () => {
    const scenario = structuredClone(sampleState.scenarios[0]);
    scenario.name = `${scenario.name} 米国株オプション30`;
    const originalName = scenario.name;
    scenario.incomeEvents.push({
      id: "option-income",
      memberId: scenario.householdProfile.headMemberId,
      name: "米国株オプション",
      type: "investmentIncome",
      startYearMonth: scenario.userProfile.simulationStartYearMonth,
      monthlyAmount: 100_000,
      taxTreatment: "taxable",
      sourceAssetKey: "ordinaryAccountForOptions",
      sourceAssetPayoutMode: "retainInSourceAsset",
    });

    const diagnostics = calculateIncomePowerDiagnostics(
      scenario,
      { startAge: 60, endAge: 60 },
      [0, 100_000, 200_000],
    );

    expect(scenario.name).toBe(originalName);
    expect(scenario.incomeEvents.find((event) => event.id === "option-income")?.monthlyAmount).toBe(100_000);
    expect(diagnostics.sourceEventCount).toBeGreaterThan(0);
    expect(diagnostics.rows.map((row) => row.monthlyIncomePower)).toEqual([0, 100_000, 200_000]);
    expect(diagnostics.rows[1].grossIncomeIncrease).toBe(diagnostics.rows[1].activeMonths * 100_000);
    expect(diagnostics.rows[2].grossIncomeIncrease).toBe(diagnostics.rows[2].activeMonths * 200_000);
    expect(diagnostics.rows[1].maxAdditionalEnjoymentAnnual).toBeGreaterThanOrEqual(0);
  });

  it("treats zero-base option income diagnostics as new taxable income", () => {
    const scenario = structuredClone(sampleState.scenarios[0]);
    scenario.initialAssets.ordinaryAccountForOptions = 2_000_000;
    scenario.initialAssetCostBasis.ordinaryAccountForOptions = 1_500_000;
    scenario.optionAccountRules.enabled = true;
    scenario.optionSubAccounts = [
      { id: "option-us", name: "米国株オプション", initialValue: 2_000_000, initialCostBasis: 1_500_000, startYearMonth: scenario.userProfile.simulationStartYearMonth, enabled: true, minimumBalance: 500_000, targetBalance: 2_000_000, withdrawalPriority: 1, protectFromWithdrawal: true, releaseProtectionAfterEnd: true, suspendIncomeWhenBelowMinimum: true, profitSweepEnabled: false, profitSweepDestination: "bankDeposit", profitSweepTiming: "monthly", profitSweepMethod: "excessOverTarget", fixedSweepAmount: 0 },
    ];
    scenario.incomeEvents.push({
      id: "zero-option-income",
      memberId: scenario.householdProfile.headMemberId,
      name: "米国株オプション",
      type: "investmentIncome",
      startYearMonth: scenario.userProfile.simulationStartYearMonth,
      monthlyAmount: 0,
      taxTreatment: "taxable",
      sourceAssetKey: "ordinaryAccountForOptions",
      sourceOptionSubAccountId: scenario.optionSubAccounts[0]?.id,
      sourceAssetPayoutMode: "cash",
    });

    const diagnostics = calculateIncomePowerDiagnostics(
      scenario,
      { startAge: 60, endAge: 61 },
      [0, 100_000],
    );
    const [zeroRow, incomeRow] = diagnostics.rows;

    expect(diagnostics.baselineMonthlyIncomePower).toBe(0);
    expect(incomeRow.grossIncomeIncrease).toBeGreaterThan(0);
    expect(incomeRow.taxAndSocialIncrease).toBeGreaterThan(0);
    expect(incomeRow.targetBalanceGapAfterMax).toBeGreaterThan(zeroRow.targetBalanceGapAfterMax);
  });
});
