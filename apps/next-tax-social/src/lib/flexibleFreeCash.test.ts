import { describe, expect, it } from "vitest";
import {
  calculateSpecialExpenseCategoryTotals,
  calculateFlexibleFreeCashSummary,
  getAnnualFlexibleFreeCash,
  normalizeFlexibleFreeCashPeriod,
} from "@/lib/flexibleFreeCash";
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

describe("flexible free cash", () => {
  it("normalizes invalid or reversed periods", () => {
    expect(normalizeFlexibleFreeCashPeriod({ startAge: 72, endAge: 60 })).toEqual({ startAge: 72, endAge: 72 });
    expect(normalizeFlexibleFreeCashPeriod({ startAge: -1, endAge: 65 })).toEqual({ startAge: 0, endAge: 65 });
  });

  it("calculates annual free cash without subtracting additional investments", () => {
    const row = annualRow({
      incomeTotal: 1_000_000,
      optionProfitSweepTotal: 200_000,
      optionAccountReleaseTotal: 300_000,
      livingExpenseTotal: 500_000,
      taxInsuranceTotal: 100_000,
      capitalGainsTaxTotal: 20_000,
      idecoWithholdingTaxTotal: 30_000,
      specialExpenseTotal: 40_000,
      idecoFeeTotal: 10_000,
      assetContributionTotal: 999_999,
    });

    expect(getAnnualFlexibleFreeCash(row)).toBe(800_000);
  });

  it("summarizes only rows inside the selected year-end age range", () => {
    const annual = [
      annualRow({ year: 2026, ageYears: 59, incomeTotal: 9_000_000, endingAssets: 9_000_000, endingLiquidBuffer: 900_000 }),
      annualRow({ year: 2027, ageYears: 60, incomeTotal: 1_000_000, livingExpenseTotal: 300_000, endingAssets: 7_000_000, endingLiquidBuffer: 700_000 }),
      annualRow({ year: 2028, ageYears: 61, incomeTotal: 1_200_000, livingExpenseTotal: 400_000, endingAssets: 6_000_000, endingLiquidBuffer: 500_000 }),
      annualRow({ year: 2029, ageYears: 62, incomeTotal: 9_000_000, endingAssets: 5_000_000, endingLiquidBuffer: 300_000 }),
    ];

    const summary = calculateFlexibleFreeCashSummary({ annual }, { startAge: 60, endAge: 61 });

    expect(summary.yearCount).toBe(2);
    expect(summary.totalFreeCash).toBe(1_500_000);
    expect(summary.assetUtilizationAmount).toBe(0);
    expect(summary.averageAnnualFreeCash).toBe(750_000);
    expect(summary.periodEndBalance).toBe(6_000_000);
    expect(summary.minimumLiquidBuffer).toBe(500_000);
  });

  it("summarizes special expenses by explicit category inside the selected period", () => {
    const result = {
      annual: [
        annualRow({ year: 2026, ageYears: 60 }),
        annualRow({ year: 2027, ageYears: 61 }),
        annualRow({ year: 2028, ageYears: 62 }),
      ],
      monthly: [
        { yearMonth: "2026-04", ageYears: 60 },
        { yearMonth: "2027-04", ageYears: 61 },
        { yearMonth: "2028-04", ageYears: 62 },
      ],
    };
    const totals = calculateSpecialExpenseCategoryTotals(
      {
        userProfile: {
          simulationStartYearMonth: "2026-04",
        },
        inflationSettings: {
          livingCostAnnualInflationRate: 0,
          medicalAnnualInflationRate: 0,
        },
        specialExpenses: [
          { id: "trip", name: "旅行", yearMonth: "2026-04", amount: 300_000, category: "enjoyment" },
          { id: "repair", name: "修繕", yearMonth: "2027-04", amount: 500_000, category: "housingCar" },
          { id: "legacy", name: "旧予備カテゴリ", yearMonth: "2028-04", amount: 100_000, category: "contingency" as never },
        ],
      },
      result as never,
      { startAge: 60, endAge: 62 },
    );

    expect(totals.enjoyment).toBe(300_000);
    expect(totals.housingCar).toBe(500_000);
    expect(totals.lifeMaintenance).toBe(100_000);
  });
});
