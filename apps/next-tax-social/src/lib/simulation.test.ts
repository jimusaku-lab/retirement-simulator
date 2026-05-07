import { describe, expect, it } from "vitest";
import { sampleState } from "@/data/sampleData";
import { calculateAutoTaxDetails, calculateAutoTaxRows, getEffectiveTaxRows } from "@/lib/taxEngine";
import { getTaxFilingAdvice } from "@/lib/taxFilingAdvice";
import { getRetirementFilingAdvice, getRetirementOverlapAdjustments, getRetirementOverlapWarnings } from "@/lib/retirementIncome";
import { syncLinkedIncomeEndYearMonths } from "@/lib/householdEvents";
import {
  aggregateAnnualResults,
  getBalanceAtAge,
  getIncomeForMonth,
  getTaxInsuranceForMonth,
  simulateScenario,
} from "@/lib/simulation";
import type { ScenarioData } from "@/types";

function simpleScenario(overrides: Partial<ScenarioData> = {}): ScenarioData {
  return {
    id: "simple",
    name: "単純ケース",
    compare: true,
    userProfile: {
      birthDate: "1966-04-01",
      simulationStartYearMonth: "2026-04",
      simulationEndMode: "yearMonth",
      simulationEndYearMonth: "2026-06",
      targetBalanceAge: 60,
      targetBalanceAmount: 0,
      plannedDrawdownEnabled: false,
      cashReserve: 0,
    },
    householdProfile: {
      municipality: "東京都大田区",
      headMemberId: "member-self",
      taxCalculationMode: "manual",
    },
    householdMembers: [
      {
        id: "member-self",
        name: "本人",
        relationship: "self",
        birthDate: "1966-04-01",
        isResident: true,
        isNationalHealthInsuranceMember: true,
        isLateElderlyMedicalMember: false,
        isLongTermCareInsured: false,
        isDependent: false,
      },
    ],
    householdLivingArrangementEvents: [],
    initialAssets: {
      cash: 1_000_000,
      bankDeposit: 0,
      timeDeposit: 0,
      nisa: 0,
      specificAccount: 0,
      ordinaryAccountForOptions: 0,
      ideco: 0,
      excludedAssets: 0,
      debt: 0,
    },
    initialAssetCostBasis: {
      nisa: 0,
      specificAccount: 0,
      ordinaryAccountForOptions: 0,
      ideco: 0,
    },
    monthlyExpenses: {
      food: 0,
      dailyGoods: 0,
      hobbyEntertainment: 0,
      social: 0,
      transportation: 0,
      clothingBeauty: 0,
      healthMedical: 0,
      car: 0,
      educationCulture: 0,
      specialExpense: 0,
      cashCard: 0,
      utilities: 0,
      communication: 0,
      housing: 100_000,
      taxSocialInsurance: 0,
      insurance: 0,
      other: 0,
    },
    ageExpenseAdjustments: [],
    incomeEvents: [],
    assetTransferEvents: [],
    withdrawalOrder: ["bankDeposit", "timeDeposit", "specificAccount", "ordinaryAccountForOptions", "ideco", "nisa"],
    specialExpenses: [],
    taxInsurance: [],
    taxDeductionEvents: [],
    assetGrowthSettings: {
      enabled: false,
      rates: {
        cash: 0,
        bankDeposit: 0,
        timeDeposit: 0,
        nisa: 0,
        specificAccount: 0,
        ordinaryAccountForOptions: 0,
        ideco: 0,
      },
    },
    assetContributionEvents: [],
    inflationSettings: {
      enabled: false,
      livingCostAnnualInflationRate: 0,
      medicalAnnualInflationRate: 0,
      pensionAnnualAdjustmentRate: 0,
    },
    optionAccountRules: {
      enabled: true,
      minimumBalance: 0,
      targetBalance: 0,
      protectFromWithdrawal: true,
      suspendIncomeWhenBelowMinimum: true,
      profitSweepEnabled: false,
      profitSweepDestination: "bankDeposit",
      profitSweepTiming: "monthly",
      profitSweepMethod: "excessOverTarget",
      fixedSweepAmount: 0,
    },
    optionSubAccounts: [],
    nisaInvestmentRules: {
      annualLimit: 3_600_000,
      lifetimeLimitPerInvestor: 18_000_000,
      usedLifetimeLimitAtStart: 0,
      investorCount: 1,
      enforceAnnualLimit: true,
      protectDuringContribution: true,
      insufficientFundingMode: "skip",
      carryOverSkippedMode: "none",
    },
    taxableAccountSettings: {
      specificAccountWithholding: "withholding",
    },
    ...overrides,
  };
}

describe("simulation", () => {
  it("開始月から終了月までの収入イベントを反映する", () => {
    const income = getIncomeForMonth(
      [
        {
          id: "income",
          memberId: "member-self",
          name: "収入",
          type: "salary",
          startYearMonth: "2026-05",
          endYearMonth: "2026-06",
          monthlyAmount: 80_000,
        },
      ],
      "2026-05",
      1,
    );

    expect(income).toBe(80_000);
    expect(getIncomeForMonth([], "2026-05", 1)).toBe(0);
  });

  it("税・社会保険の年度年額を月割りし、国民年金月額を加算する", () => {
    const amount = getTaxInsuranceForMonth(
      [
        {
          id: "tax",
          fiscalYear: 2026,
          residentTaxAnnual: 120_000,
          incomeTaxAnnual: 60_000,
          nationalHealthInsuranceAnnual: 240_000,
          nationalPensionMonthly: 17_000,
          nursingCareAnnual: 12_000,
          otherPublicCostAnnual: 0,
        },
      ],
      "2027-03",
    );

    expect(amount).toBe(53_000);
  });

  it("同居状態変更は指定月から選択費目だけ固定額を減らす", () => {
    const scenario = simpleScenario({
      userProfile: {
        birthDate: "1966-04-01",
        simulationStartYearMonth: "2026-01",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2026-03",
        targetBalanceAge: 60,
        cashReserve: 0,
      },
      monthlyExpenses: {
        food: 100_000,
        dailyGoods: 0,
        hobbyEntertainment: 0,
        social: 0,
        transportation: 0,
        clothingBeauty: 0,
        healthMedical: 0,
        car: 30_000,
        educationCulture: 0,
        specialExpense: 0,
        cashCard: 0,
        utilities: 50_000,
        communication: 0,
        housing: 0,
        taxSocialInsurance: 0,
        insurance: 0,
        other: 0,
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1966-04-01",
          isResident: true,
          isNationalHealthInsuranceMember: true,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
        {
          id: "child",
          name: "子",
          relationship: "child",
          birthDate: "2000-01-01",
          isResident: true,
          isNationalHealthInsuranceMember: false,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      householdLivingArrangementEvents: [
        {
          id: "child-move-out",
          memberId: "child",
          name: "子の別居",
          changeType: "moveOut",
          changeYearMonth: "2026-03",
          appliesToLivingExpenses: true,
          expenseKeys: ["food", "utilities"],
          reductionMode: "fixedAmount",
          reductionAmount: 30_000,
          reductionRate: 0,
        },
      ],
    });

    const result = simulateScenario(scenario);
    expect(result.monthly.find((row) => row.yearMonth === "2026-02")?.livingExpenseTotal).toBe(180_000);
    expect(result.monthly.find((row) => row.yearMonth === "2026-03")?.livingExpenseTotal).toBe(150_000);
  });

  it("同居状態変更リンクは収入終了月を別居開始の前月へ同期する", () => {
    const scenario = simpleScenario({
      userProfile: {
        birthDate: "1966-04-01",
        simulationStartYearMonth: "2026-01",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2026-06",
        targetBalanceAge: 60,
        cashReserve: 0,
      },
      householdLivingArrangementEvents: [
        {
          id: "child-move-out",
          memberId: "member-self",
          name: "子の別居",
          changeType: "moveOut",
          changeYearMonth: "2026-05",
          appliesToLivingExpenses: false,
          expenseKeys: [],
          reductionMode: "fixedAmount",
          reductionAmount: 0,
          reductionRate: 0,
        },
      ],
      incomeEvents: [
        {
          id: "support",
          memberId: "member-self",
          name: "子どもからの生活費",
          type: "other",
          startYearMonth: "2026-01",
          monthlyAmount: 40_000,
          taxTreatment: "nonTaxable",
          linkedHouseholdLivingArrangementEventId: "child-move-out",
        },
      ],
    });

    syncLinkedIncomeEndYearMonths(scenario);
    expect(scenario.incomeEvents[0].endYearMonth).toBe("2026-04");
    expect(getIncomeForMonth(scenario.incomeEvents, "2026-04", 3)).toBe(40_000);
    expect(getIncomeForMonth(scenario.incomeEvents, "2026-05", 4)).toBe(0);
  });

  it("所得控除入力は所得税と住民税の課税ベースを下げる", () => {
    const withoutDeduction = simpleScenario({
      userProfile: {
        birthDate: "1966-04-01",
        simulationStartYearMonth: "2026-01",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2026-12",
        targetBalanceAge: 60,
        cashReserve: 0,
      },
      incomeEvents: [
        {
          id: "salary",
          memberId: "member-self",
          name: "給与",
          type: "salary",
          startYearMonth: "2026-01",
          endYearMonth: "2026-12",
          monthlyAmount: 800_000,
          taxTreatment: "taxable",
        },
      ],
    });

    const withDeduction = simpleScenario({
      userProfile: withoutDeduction.userProfile,
      incomeEvents: withoutDeduction.incomeEvents,
      taxDeductionEvents: [
        {
          id: "deduction-2026",
          fiscalYear: 2026,
          memberId: "member-self",
          socialInsuranceDeductionAnnual: 600_000,
          medicalExpenseDeductionAnnual: 200_000,
        },
      ],
    });

    const withoutDetail = calculateAutoTaxDetails(withoutDeduction).find((row) => row.fiscalYear === 2026);
    const withDetail = calculateAutoTaxDetails(withDeduction).find((row) => row.fiscalYear === 2026);

    expect(withDetail?.memberDetails[0].manualSocialInsuranceDeductionAnnual).toBe(600_000);
    expect(withDetail?.memberDetails[0].autoSocialInsuranceDeductionAnnual).toBeGreaterThan(0);
    expect(withDetail?.memberDetails[0].socialInsuranceDeductionAnnual).toBe(
      (withDetail?.memberDetails[0].manualSocialInsuranceDeductionAnnual ?? 0) +
        (withDetail?.memberDetails[0].autoSocialInsuranceDeductionAnnual ?? 0),
    );
    expect(withDetail?.memberDetails[0].medicalExpenseDeductionAnnual).toBe(200_000);
    expect(withDetail?.memberDetails[0].incomeTaxBaseAnnual).toBeLessThan(withoutDetail?.memberDetails[0].incomeTaxBaseAnnual ?? 0);
    expect(withDetail?.memberDetails[0].residentTaxBaseAnnual).toBeLessThan(withoutDetail?.memberDetails[0].residentTaxBaseAnnual ?? 0);
    expect(withDetail?.memberDetails[0].incomeTaxAnnual).toBeLessThan(withoutDetail?.memberDetails[0].incomeTaxAnnual ?? 0);
    expect(withDetail?.memberDetails[0].residentTaxAnnual).toBeLessThan(withoutDetail?.memberDetails[0].residentTaxAnnual ?? 0);
    expect(withDetail?.nationalHealthInsuranceBreakdown.totalBaseIncome).toBe(
      withoutDetail?.nationalHealthInsuranceBreakdown.totalBaseIncome,
    );
    expect(withDetail?.nationalHealthInsuranceAnnual).toBe(withoutDetail?.nationalHealthInsuranceAnnual);
  });

  it("配偶者控除は配偶者の所得条件を満たす場合だけ反映する", () => {
    const dependentSpouseScenario = simpleScenario({
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1966-04-01",
          isResident: true,
          isNationalHealthInsuranceMember: true,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
        {
          id: "member-spouse",
          name: "配偶者",
          relationship: "spouse",
          birthDate: "1969-02-22",
          isResident: true,
          isNationalHealthInsuranceMember: true,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: true,
          dependsOnMemberId: "member-self",
        },
      ],
      incomeEvents: [
        {
          id: "salary-self",
          memberId: "member-self",
          name: "給与",
          type: "salary",
          startYearMonth: "2026-01",
          endYearMonth: "2026-12",
          monthlyAmount: 250_000,
          taxTreatment: "taxable",
        },
      ],
    });
    const dependentDetail = calculateAutoTaxDetails(dependentSpouseScenario)[0].memberDetails.find(
      (member) => member.memberId === "member-self",
    );

    const highIncomeSpouseDetail = calculateAutoTaxDetails({
      ...dependentSpouseScenario,
      incomeEvents: [
        ...dependentSpouseScenario.incomeEvents,
        {
          id: "salary-spouse",
          memberId: "member-spouse",
          name: "配偶者給与",
          type: "salary",
          startYearMonth: "2026-01",
          endYearMonth: "2026-12",
          monthlyAmount: 200_000,
          taxTreatment: "taxable",
        },
      ],
    })[0].memberDetails.find((member) => member.memberId === "member-self");

    expect(dependentDetail?.dependentDeductionsIncomeTaxAnnual).toBe(380_000);
    expect(dependentDetail?.dependentDeductionsResidentTaxAnnual).toBe(330_000);
    expect(highIncomeSpouseDetail?.dependentDeductionsIncomeTaxAnnual).toBe(0);
    expect(highIncomeSpouseDetail?.dependentDeductionsResidentTaxAnnual).toBe(0);
    expect(highIncomeSpouseDetail?.incomeTaxBaseAnnual).toBeGreaterThan(dependentDetail?.incomeTaxBaseAnnual ?? 0);
  });

  it("扶養控除は扶養対象者の所得が上限を超える場合は反映しない", () => {
    const detail = calculateAutoTaxDetails(
      simpleScenario({
        householdProfile: {
          municipality: "東京都大田区",
          headMemberId: "member-self",
          taxCalculationMode: "auto",
        },
        householdMembers: [
          {
            id: "member-self",
            name: "本人",
            relationship: "self",
            birthDate: "1966-04-01",
            isResident: true,
            isNationalHealthInsuranceMember: true,
            isLateElderlyMedicalMember: false,
            isLongTermCareInsured: false,
            isDependent: false,
          },
          {
            id: "member-child",
            name: "子",
            relationship: "child",
            birthDate: "2003-04-01",
            isResident: true,
            isNationalHealthInsuranceMember: true,
            isLateElderlyMedicalMember: false,
            isLongTermCareInsured: false,
            isDependent: true,
            dependsOnMemberId: "member-self",
          },
        ],
        incomeEvents: [
          {
            id: "salary-self",
            memberId: "member-self",
            name: "給与",
            type: "salary",
            startYearMonth: "2026-01",
            endYearMonth: "2026-12",
            monthlyAmount: 250_000,
            taxTreatment: "taxable",
          },
          {
            id: "salary-child",
            memberId: "member-child",
            name: "子の給与",
            type: "salary",
            startYearMonth: "2026-01",
            endYearMonth: "2026-12",
            monthlyAmount: 120_000,
            taxTreatment: "taxable",
          },
        ],
      }),
    )[0].memberDetails.find((member) => member.memberId === "member-self");

    expect(detail?.dependentDeductionsIncomeTaxAnnual).toBe(0);
    expect(detail?.dependentDeductionsResidentTaxAnnual).toBe(0);
  });

  it("配偶者控除の所得上限を超えても配偶者特別控除の範囲なら段階控除を反映する", () => {
    const detail = calculateAutoTaxDetails(
      simpleScenario({
        householdProfile: {
          municipality: "東京都大田区",
          headMemberId: "member-self",
          taxCalculationMode: "auto",
        },
        householdMembers: [
          {
            id: "member-self",
            name: "本人",
            relationship: "self",
            birthDate: "1966-04-01",
            isResident: true,
            isNationalHealthInsuranceMember: true,
            isLateElderlyMedicalMember: false,
            isLongTermCareInsured: false,
            isDependent: false,
          },
          {
            id: "member-spouse",
            name: "配偶者",
            relationship: "spouse",
            birthDate: "1969-02-22",
            isResident: true,
            isNationalHealthInsuranceMember: true,
            isLateElderlyMedicalMember: false,
            isLongTermCareInsured: false,
            isDependent: true,
            dependsOnMemberId: "member-self",
          },
        ],
        incomeEvents: [
          {
            id: "salary-self",
            memberId: "member-self",
            name: "本人給与",
            type: "salary",
            startYearMonth: "2026-01",
            endYearMonth: "2026-12",
            monthlyAmount: 250_000,
            taxTreatment: "taxable",
          },
          {
            id: "salary-spouse",
            memberId: "member-spouse",
            name: "配偶者給与",
            type: "salary",
            startYearMonth: "2026-01",
            endYearMonth: "2026-12",
            monthlyAmount: 110_000,
            taxTreatment: "taxable",
          },
        ],
      }),
    )[0].memberDetails.find((member) => member.memberId === "member-self");

    expect(detail?.spouseSpecialDeductionIncomeTaxAnnual).toBe(380_000);
    expect(detail?.spouseSpecialDeductionResidentTaxAnnual).toBe(330_000);
    expect(detail?.dependentDeductionsIncomeTaxAnnual).toBe(380_000);
    expect(detail?.dependentDeductionsResidentTaxAnnual).toBe(330_000);
  });

  it("税・社会保険は未入力年度で直近の前年度を引き継ぐ", () => {
    const amount = getTaxInsuranceForMonth(
      [
        {
          id: "tax",
          fiscalYear: 2027,
          residentTaxAnnual: 120_000,
          incomeTaxAnnual: 0,
          nationalHealthInsuranceAnnual: 240_000,
          nationalPensionMonthly: 10_000,
          nursingCareAnnual: 0,
          otherPublicCostAnnual: 0,
        },
      ],
      "2030-06",
    );

    expect(amount).toBe(40_000);
  });

  it("月次収支、取り崩し額、月末残高を計算する", () => {
    const result = simulateScenario(simpleScenario());

    expect(result.monthly).toHaveLength(3);
    expect(result.monthly[0]).toMatchObject({
      yearMonth: "2026-04",
      livingExpenseTotal: 100_000,
      withdrawalAmount: 100_000,
      netCashFlow: -100_000,
      endingAssets: 900_000,
    });
    expect(result.totalWithdrawal).toBe(300_000);
  });

  it("目標残高に向けた計画取り崩しを追加支出として反映する", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-04",
          targetBalanceAge: 60,
          targetBalanceAmount: 900_000,
          plannedDrawdownEnabled: true,
          cashReserve: 0,
        },
        monthlyExpenses: {
          ...simpleScenario().monthlyExpenses,
          housing: 0,
        },
      }),
    );

    expect(result.monthly[0].plannedDrawdownTotal).toBe(100_000);
    expect(result.monthly[0].endingAssets).toBe(900_000);
  });

  it("流動資金最低保持額は現金と普通預金の合計で判定する", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-04",
          targetBalanceAge: 60,
          cashReserve: 300_000,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 1_000_000,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
      }),
    );

    expect(result.monthly[0].withdrawalAmount).toBe(100_000);
    expect(result.monthly[0].cashReserveTopUpAmount).toBe(0);
    expect(result.monthly[0].grossAssetWithdrawalAmount).toBe(0);
    expect(result.monthly[0].withdrawalSourceBreakdown.bankDeposit).toBe(0);
    expect(result.monthly[0].endingAssets).toBe(900_000);
  });

  it("追加投資は収入ではなく現金または取り崩しから充当する", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-04",
          targetBalanceAge: 60,
          cashReserve: 0,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        assetContributionEvents: [
          {
            id: "nisa",
            assetKey: "nisa",
            name: "NISA追加投資",
            startYearMonth: "2026-04",
            monthlyAmount: 100_000,
          },
        ],
      }),
    );

    expect(result.monthly[0]).toMatchObject({
      assetContributionTotal: 100_000,
      nisaContributionTotal: 100_000,
      nisaCumulativeInvestment: 100_000,
      nisaRemainingLifetimeLimit: 17_900_000,
      withdrawalAmount: 100_000,
      netCashFlow: -100_000,
      endingAssets: 1_000_000,
    });
    expect(result.annual[0]).toMatchObject({
      nisaContributionTotal: 100_000,
      nisaCumulativeInvestment: 100_000,
      nisaRemainingLifetimeLimit: 17_900_000,
    });
  });

  it("資産原資つき収入は口座残高から受け取り、外部収入としては加算しない", () => {
    const result = simulateScenario(
      simpleScenario({
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 80_000,
          excludedAssets: 0,
          debt: 0,
        },
        monthlyExpenses: {
          food: 50_000,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        incomeEvents: [
          {
            id: "ideco-payout",
            memberId: "member-self",
            name: "iDeCo年金受取",
            type: "pension",
            startYearMonth: "2026-04",
            monthlyAmount: 100_000,
            sourceAssetKey: "ideco",
          },
        ],
      }),
    );

    expect(result.monthly[0]).toMatchObject({
      incomeTotal: 73_874,
      withdrawalAmount: 0,
      netCashFlow: 23_874,
      endingAssets: 23_874,
    });
    expect(result.monthly[0].idecoWithholdingTaxTotal).toBe(6_126);
  });

  it("NISAの原資収入に残る旧口座内積上指定は現金化も残高加算もしない", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-04",
          targetBalanceAge: 60,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 1_000_000,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 1_000_000,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 0,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        incomeEvents: [
          {
            id: "nisa-withdraw",
            memberId: "member-self",
            name: "NISA取り崩し",
            type: "investmentIncome",
            startYearMonth: "2026-04",
            endYearMonth: "2026-04",
            monthlyAmount: 100_000,
            taxTreatment: "nonTaxable",
            sourceAssetKey: "nisa",
            sourceAssetPayoutMode: "retainInSourceAsset",
          },
        ],
      }),
    );

    expect(result.monthly[0].incomeTotal).toBe(0);
    expect(result.monthly[0].retainedSourceAssetIncomeTotal).toBe(0);
    expect(result.monthly[0].endingTrackedAssetBalances.nisa).toBe(1_000_000);
    expect(result.monthly[0].endingAssets).toBe(1_000_000);
  });

  it("特定口座の取り崩しでは譲渡益課税を差し引く", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-04",
          targetBalanceAge: 60,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 110_000,
          ordinaryAccountForOptions: 0,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 0,
          specificAccount: 100_000,
          ordinaryAccountForOptions: 0,
          ideco: 0,
        },
        assetGrowthSettings: {
          enabled: false,
          rates: {
            cash: 0,
            bankDeposit: 0,
            timeDeposit: 0,
            nisa: 0,
            specificAccount: 0,
            ordinaryAccountForOptions: 0,
            ideco: 0,
          },
        },
        monthlyExpenses: {
          food: 100_000,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
      }),
    );

    expect(result.monthly[0].capitalGainsTaxTotal).toBeGreaterThan(0);
    expect(result.monthly[0].withdrawalAmount).toBe(100_000);
    expect(result.monthly[0].grossAssetWithdrawalAmount).toBeGreaterThan(100_000);
  });

  it("評価損益の推移用に口座別の評価額と取得原価を返す", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-04",
          targetBalanceAge: 60,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 10_000,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 100_000,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 80_000,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 0,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        assetContributionEvents: [
          {
            id: "nisa-add",
            assetKey: "nisa",
            name: "NISA積立",
            startYearMonth: "2026-04",
            monthlyAmount: 10_000,
          },
        ],
        assetGrowthSettings: {
          enabled: false,
          rates: {
            cash: 0,
            bankDeposit: 0,
            timeDeposit: 0,
            nisa: 0,
            specificAccount: 0,
            ordinaryAccountForOptions: 0,
            ideco: 0,
          },
        },
      }),
    );

    expect(result.monthly[0].endingTrackedAssetBalances.nisa).toBe(110_000);
    expect(result.monthly[0].endingTrackedAssetCostBasis.nisa).toBe(90_000);
    expect(result.monthly[0].endingTrackedAssetUnrealizedGains.nisa).toBe(20_000);
  });

  it("現金と普通預金は利回り対象外、対象外資産はシミュレーション残高に含めない", () => {
    const timeDepositMonthlyGrowth = 100_000 * (Math.pow(1 + 1, 1 / 12) - 1);
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-04",
          targetBalanceAge: 60,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 100_000,
          bankDeposit: 100_000,
          timeDeposit: 100_000,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 0,
          excludedAssets: 500_000,
          debt: 0,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        assetGrowthSettings: {
          enabled: true,
          rates: {
            cash: 1,
            bankDeposit: 1,
            timeDeposit: 1,
            nisa: 0,
            specificAccount: 0,
            ordinaryAccountForOptions: 0,
            ideco: 0,
          },
        },
      }),
    );

    expect(result.monthly[0].growthAmount).toBe(Math.round(timeDepositMonthlyGrowth));
    expect(result.monthly[0].endingAssets).toBe(Math.round(300_000 + timeDepositMonthlyGrowth));
  });

  it("満年齢に応じた生活費変更を反映する", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-03",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-04",
          targetBalanceAge: 60,
          cashReserve: 0,
        },
        ageExpenseAdjustments: [
          {
            id: "expense-age-60",
            name: "60歳から生活費80%",
            startAge: 60,
            target: "all",
            mode: "multiplier",
            value: 0.8,
          },
        ],
      }),
    );

    expect(result.monthly[0].ageYears).toBe(59);
    expect(result.monthly[0].livingExpenseTotal).toBe(100_000);
    expect(result.monthly[1].ageYears).toBe(60);
    expect(result.monthly[1].livingExpenseTotal).toBe(80_000);
  });

  it("資産枯渇月と枯渇年齢を判定する", () => {
    const result = simulateScenario(
      simpleScenario({
        initialAssets: {
          cash: 150_000,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
      }),
    );

    expect(result.depletionYearMonth).toBe("2026-05");
    expect(result.depletionAgeYears).toBe(60);
  });

  it("年次集計と指定年齢残高を返す", () => {
    const result = simulateScenario(simpleScenario());
    const annual = aggregateAnnualResults(result.monthly);

    expect(annual[0].withdrawalAmount).toBe(300_000);
    expect(annual[0].ageYears).toBe(60);
    expect(getBalanceAtAge(result.monthly, 60)).toBe(900_000);
    expect(result.targetAgeBalance).toBe(900_000);
  });

  it("自動計算モードでは税・社会保険を収入と世帯情報から算出する", () => {
    const scenario = simpleScenario({
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      incomeEvents: [
        {
          id: "salary",
          memberId: "member-self",
          name: "給与",
          type: "salary",
          startYearMonth: "2026-04",
          endYearMonth: "2027-03",
          monthlyAmount: 300_000,
          taxTreatment: "taxable",
        },
      ],
    });

    const rows = calculateAutoTaxRows(scenario);

    expect(rows[0].fiscalYear).toBe(2026);
    expect(rows[0].incomeTaxAnnual).toBeGreaterThan(0);
    expect(rows[0].residentTaxAnnual).toBeGreaterThan(0);
    expect(rows[0].nationalHealthInsuranceAnnual).toBeGreaterThan(0);
    expect(rows[0].nationalPensionMonthly).toBeGreaterThan(0);
  });

  it("国保介護分は40歳から64歳の国保加入者だけに発生する", () => {
    const base = simpleScenario({
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1962-04-01",
          isResident: true,
          isNationalHealthInsuranceMember: true,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: true,
          isDependent: false,
        },
      ],
      incomeEvents: [
        {
          id: "income",
          memberId: "member-self",
          name: "年金",
          type: "pension",
          startYearMonth: "2026-04",
          endYearMonth: "2026-12",
          monthlyAmount: 300_000,
          taxTreatment: "taxable",
        },
      ],
    });

    const under65 = calculateAutoTaxRows(base);
    const over65 = calculateAutoTaxRows({
      ...base,
      householdMembers: [
        {
          ...base.householdMembers[0],
          birthDate: "1961-04-01",
        },
      ],
    });

    expect(under65[0].nursingCareAnnual).toBeGreaterThan(0);
    expect(over65[0].nursingCareAnnual).toBeGreaterThan(0);
    expect(over65[0].nursingCareAnnual).toBeLessThan(under65[0].nursingCareAnnual);
  });

  it("後期高齢者医療は国保とは別に算出する", () => {
    const scenario = simpleScenario({
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1950-04-01",
          isResident: true,
          isNationalHealthInsuranceMember: false,
          isLateElderlyMedicalMember: true,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      incomeEvents: [
        {
          id: "pension",
          memberId: "member-self",
          name: "公的年金",
          type: "pension",
          startYearMonth: "2026-04",
          endYearMonth: "2026-12",
          monthlyAmount: 300_000,
          taxTreatment: "taxable",
        },
      ],
    });

    const rows = calculateAutoTaxRows(scenario);

    expect(rows[0].nationalHealthInsuranceAnnual).toBe(0);
    expect(rows[0].lateElderlyMedicalAnnual).toBeGreaterThan(0);
  });

  it("低所得の後期高齢者医療は均等割軽減を反映する", () => {
    const scenario = simpleScenario({
      userProfile: {
        ...simpleScenario().userProfile,
        simulationStartYearMonth: "2026-01",
        simulationEndYearMonth: "2026-12",
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1950-04-01",
          isResident: true,
          isNationalHealthInsuranceMember: false,
          isLateElderlyMedicalMember: true,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      incomeEvents: [
        {
          id: "pension",
          memberId: "member-self",
          name: "公的年金",
          type: "pension",
          startYearMonth: "2026-01",
          endYearMonth: "2026-12",
          monthlyAmount: 60_000,
          taxTreatment: "taxable",
        },
      ],
    });

    const detail = calculateAutoTaxDetails(scenario)[0];

    expect(detail.lateElderlyMedicalBreakdown.equalReductionLabel).toBe("7割軽減");
    expect(detail.lateElderlyMedicalBreakdown.medicalEqualReductionAmount).toBeGreaterThan(0);
    expect(detail.lateElderlyMedicalAnnual).toBeLessThan(54_600);
  });

  it("後期高齢者医療の窓口負担割合は所得増加を翌年8月からの期間に反映する", () => {
    const scenario = simpleScenario({
      userProfile: {
        ...simpleScenario().userProfile,
        simulationStartYearMonth: "2026-01",
        simulationEndYearMonth: "2027-12",
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1950-04-01",
          isResident: true,
          isNationalHealthInsuranceMember: false,
          isLateElderlyMedicalMember: true,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      incomeEvents: [
        {
          id: "pension",
          memberId: "member-self",
          name: "公的年金",
          type: "pension",
          startYearMonth: "2026-01",
          endYearMonth: "2026-12",
          monthlyAmount: 200_000,
          taxTreatment: "taxable",
        },
      ],
    });

    const detail2026 = calculateAutoTaxDetails(scenario).find((detail) => detail.fiscalYear === 2026);
    const ratio = detail2026?.lateElderlyBurdenRatios[0];

    expect(ratio?.periodStartYearMonth).toBe("2027-08");
    expect(ratio?.periodEndYearMonth).toBe("2028-07");
    expect(ratio?.burdenRatio).toBe(0.2);
  });

  it("75歳到達後は国保から後期高齢者医療へ自動で切り替える", () => {
    const scenario = simpleScenario({
      userProfile: {
        ...simpleScenario().userProfile,
        simulationStartYearMonth: "2030-01",
        simulationEndYearMonth: "2032-12",
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1956-10-22",
          isResident: true,
          isNationalHealthInsuranceMember: true,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      incomeEvents: [
        {
          id: "pension",
          memberId: "member-self",
          name: "公的年金",
          type: "pension",
          startYearMonth: "2030-01",
          endYearMonth: "2032-12",
          monthlyAmount: 300_000,
          taxTreatment: "taxable",
        },
      ],
    });

    const rows = calculateAutoTaxRows(scenario);
    const before75 = rows.find((row) => row.fiscalYear === 2030);
    const turning75 = rows.find((row) => row.fiscalYear === 2031);
    const after75 = rows.find((row) => row.fiscalYear === 2032);

    expect(before75?.nationalHealthInsuranceAnnual).toBeGreaterThan(0);
    expect(before75?.lateElderlyMedicalAnnual).toBe(0);
    expect(turning75?.nationalHealthInsuranceAnnual).toBeGreaterThan(0);
    expect(turning75?.lateElderlyMedicalAnnual).toBeGreaterThan(0);
    expect(after75?.nationalHealthInsuranceAnnual).toBe(0);
    expect(after75?.lateElderlyMedicalAnnual).toBeGreaterThan(0);
  });

  it("公的年金等の申告不要制度の確認対象を判定する", () => {
    const scenario = simpleScenario({
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1950-04-01",
          isResident: true,
          isNationalHealthInsuranceMember: false,
          isLateElderlyMedicalMember: true,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      incomeEvents: [
        {
          id: "pension",
          memberId: "member-self",
          name: "公的年金",
          type: "pension",
          startYearMonth: "2026-04",
          endYearMonth: "2026-12",
          monthlyAmount: 300_000,
          taxTreatment: "taxable",
        },
      ],
    });

    const advice = getTaxFilingAdvice(calculateAutoTaxDetails(scenario));

    expect(advice[0].status).toBe("notRequiredLikely");
    expect(advice[0].pensionGrossAnnual).toBeLessThanOrEqual(4_000_000);
    expect(advice[0].nonPensionIncomeAnnual).toBeLessThanOrEqual(200_000);
  });

  it("iDeCo年金受取を年金種別で入れると公的年金等控除を使う", () => {
    const scenario = simpleScenario({
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1950-04-01",
          isResident: true,
          isNationalHealthInsuranceMember: false,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      incomeEvents: [
        {
          id: "ideco-pension",
          memberId: "member-self",
          name: "iDeCo年金受取",
          type: "pension",
          startYearMonth: "2026-04",
          endYearMonth: "2027-03",
          monthlyAmount: 100_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
        },
      ],
    });

    const details = calculateAutoTaxDetails(scenario);

    expect(details[0].memberDetails[0].pensionGrossAnnual).toBe(900_000);
    expect(details[0].memberDetails[0].pensionDeductionAnnual).toBeGreaterThan(0);
    expect(details[0].memberDetails[0].incomeTaxBaseAnnual).toBe(0);
  });

  it("自動計算の年金収入は暦年ベースで集計する", () => {
    const scenario = simpleScenario({
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      incomeEvents: [
        {
          id: "public-pension",
          memberId: "member-self",
          name: "公的年金",
          type: "pension",
          startYearMonth: "2026-11",
          endYearMonth: "2056-12",
          monthlyAmount: 148_717,
          taxTreatment: "taxable",
        },
        {
          id: "ideco-pension",
          memberId: "member-self",
          name: "iDeCo年金受取",
          type: "pension",
          startYearMonth: "2027-02",
          monthlyAmount: 0,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
          idecoPensionPayoutMode: "monexSchedule",
          idecoPensionYears: 5,
          idecoPensionPaymentsPerYear: 6,
        },
      ],
    });

    const details = calculateAutoTaxDetails(scenario);
    const row2026 = details.find((row) => row.fiscalYear === 2026);

    expect(row2026?.memberDetails[0].pensionGrossAnnual).toBe(297_434);
  });

  it("公的年金等控除は65歳未満・65歳以上の速算表で計算する", () => {
    const under65 = calculateAutoTaxDetails(
      simpleScenario({
        userProfile: {
          birthDate: "1962-01-01",
          simulationStartYearMonth: "2026-01",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-12",
          targetBalanceAge: 64,
          cashReserve: 0,
        },
        householdProfile: {
          municipality: "東京都大田区",
          headMemberId: "member-self",
          taxCalculationMode: "auto",
        },
        householdMembers: [
          {
            id: "member-self",
            name: "本人",
            relationship: "self",
            birthDate: "1962-01-01",
            isResident: true,
            isNationalHealthInsuranceMember: true,
            isLateElderlyMedicalMember: false,
            isLongTermCareInsured: false,
            isDependent: false,
          },
        ],
        incomeEvents: [
          {
            id: "public-pension",
            memberId: "member-self",
            name: "公的年金",
            type: "pension",
            startYearMonth: "2026-01",
            endYearMonth: "2026-12",
            monthlyAmount: 200_000,
            taxTreatment: "taxable",
          },
        ],
      }),
    ).find((row) => row.fiscalYear === 2026);

    const over65 = calculateAutoTaxDetails(
      simpleScenario({
        userProfile: {
          birthDate: "1961-01-01",
          simulationStartYearMonth: "2026-01",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-12",
          targetBalanceAge: 65,
          cashReserve: 0,
        },
        householdProfile: {
          municipality: "東京都大田区",
          headMemberId: "member-self",
          taxCalculationMode: "auto",
        },
        householdMembers: [
          {
            id: "member-self",
            name: "本人",
            relationship: "self",
            birthDate: "1961-01-01",
            isResident: true,
            isNationalHealthInsuranceMember: true,
            isLateElderlyMedicalMember: false,
            isLongTermCareInsured: false,
            isDependent: false,
          },
        ],
        incomeEvents: [
          {
            id: "public-pension",
            memberId: "member-self",
            name: "公的年金",
            type: "pension",
            startYearMonth: "2026-01",
            endYearMonth: "2026-12",
            monthlyAmount: 200_000,
            taxTreatment: "taxable",
          },
        ],
      }),
    ).find((row) => row.fiscalYear === 2026);

    expect(under65?.memberDetails[0].pensionGrossAnnual).toBe(2_400_000);
    expect(under65?.memberDetails[0].pensionDeductionAnnual).toBe(875_000);
    expect(under65?.memberDetails[0].taxableIncomeBeforeBasicDeductionAnnual).toBe(1_525_000);
    expect(over65?.memberDetails[0].pensionGrossAnnual).toBe(2_400_000);
    expect(over65?.memberDetails[0].pensionDeductionAnnual).toBe(1_100_000);
    expect(over65?.memberDetails[0].taxableIncomeBeforeBasicDeductionAnnual).toBe(1_300_000);
  });

  it("公的年金等控除の主要な収入階層を国税庁速算表どおりに計算する", () => {
    const pensionDetail = (birthDate: string, annualPension: number) =>
      calculateAutoTaxDetails(
        simpleScenario({
          userProfile: {
            birthDate,
            simulationStartYearMonth: "2026-01",
            simulationEndMode: "yearMonth",
            simulationEndYearMonth: "2026-12",
            targetBalanceAge: 65,
            cashReserve: 0,
          },
          householdProfile: {
            municipality: "東京都大田区",
            headMemberId: "member-self",
            taxCalculationMode: "auto",
          },
          householdMembers: [
            {
              id: "member-self",
              name: "本人",
              relationship: "self",
              birthDate,
              isResident: true,
              isNationalHealthInsuranceMember: false,
              isLateElderlyMedicalMember: false,
              isLongTermCareInsured: false,
              isDependent: false,
            },
          ],
          incomeEvents: [
            {
              id: "public-pension",
              memberId: "member-self",
              name: "公的年金",
              type: "pension",
              startYearMonth: "2026-01",
              endYearMonth: "2026-12",
              monthlyAmount: annualPension,
              amountInputMode: "annual",
              taxTreatment: "taxable",
            },
          ],
        }),
      ).find((row) => row.fiscalYear === 2026)?.memberDetails[0];

    const under65Cases = [
      [600_000, 600_000, 0],
      [1_200_000, 600_000, 600_000],
      [4_500_000, 1_360_000, 3_140_000],
      [8_000_000, 1_855_000, 6_145_000],
      [11_000_000, 1_955_000, 9_045_000],
    ];
    for (const [gross, deduction, income] of under65Cases) {
      const detail = pensionDetail("1962-01-01", gross);
      expect(detail?.pensionGrossAnnual).toBe(gross);
      expect(detail?.pensionDeductionAnnual).toBe(deduction);
      expect(detail?.taxableIncomeBeforeBasicDeductionAnnual).toBe(income);
    }

    const over65Cases = [
      [1_100_000, 1_100_000, 0],
      [2_400_000, 1_100_000, 1_300_000],
      [4_500_000, 1_360_000, 3_140_000],
      [7_000_000, 1_735_000, 5_265_000],
      [11_000_000, 1_955_000, 9_045_000],
    ];
    for (const [gross, deduction, income] of over65Cases) {
      const detail = pensionDetail("1961-01-01", gross);
      expect(detail?.pensionGrossAnnual).toBe(gross);
      expect(detail?.pensionDeductionAnnual).toBe(deduction);
      expect(detail?.taxableIncomeBeforeBasicDeductionAnnual).toBe(income);
    }
  });

  it("年金受取が65歳未満から65歳以上へまたがる場合は年度ごとに控除表を切り替える", () => {
    const scenario = simpleScenario({
      userProfile: {
        birthDate: "1966-10-22",
        simulationStartYearMonth: "2030-01",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2032-12",
        targetBalanceAge: 66,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1966-10-22",
          isResident: true,
          isNationalHealthInsuranceMember: false,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      incomeEvents: [
        {
          id: "public-pension",
          memberId: "member-self",
          name: "公的年金",
          type: "pension",
          startYearMonth: "2030-01",
          endYearMonth: "2032-12",
          monthlyAmount: 200_000,
          taxTreatment: "taxable",
        },
      ],
    });

    const details = calculateAutoTaxDetails(scenario);
    const before65 = details.find((row) => row.fiscalYear === 2030)?.memberDetails[0];
    const yearTurning65 = details.find((row) => row.fiscalYear === 2031)?.memberDetails[0];
    const after65 = details.find((row) => row.fiscalYear === 2032)?.memberDetails[0];

    expect(before65?.ageAtYearEnd).toBe(64);
    expect(before65?.pensionGrossAnnual).toBe(2_400_000);
    expect(before65?.pensionDeductionAnnual).toBe(875_000);
    expect(before65?.taxableIncomeBeforeBasicDeductionAnnual).toBe(1_525_000);
    expect(yearTurning65?.ageAtYearEnd).toBe(65);
    expect(yearTurning65?.pensionGrossAnnual).toBe(2_400_000);
    expect(yearTurning65?.pensionDeductionAnnual).toBe(1_100_000);
    expect(yearTurning65?.taxableIncomeBeforeBasicDeductionAnnual).toBe(1_300_000);
    expect(after65?.ageAtYearEnd).toBe(66);
    expect(after65?.pensionDeductionAnnual).toBe(1_100_000);
  });

  it("iDeCo年金は公的年金と合算した雑所得として扱う", () => {
    const scenario = simpleScenario({
      userProfile: {
        birthDate: "1961-01-01",
        simulationStartYearMonth: "2026-01",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2026-12",
        targetBalanceAge: 65,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1961-01-01",
          isResident: true,
          isNationalHealthInsuranceMember: true,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      incomeEvents: [
        {
          id: "public-pension",
          memberId: "member-self",
          name: "公的年金",
          type: "pension",
          startYearMonth: "2026-01",
          endYearMonth: "2026-12",
          monthlyAmount: 100_000,
          taxTreatment: "taxable",
        },
        {
          id: "ideco-pension",
          memberId: "member-self",
          name: "iDeCo年金受取",
          type: "pension",
          startYearMonth: "2026-01",
          endYearMonth: "2026-12",
          monthlyAmount: 100_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
        },
      ],
    });

    const detail = calculateAutoTaxDetails(scenario).find((row) => row.fiscalYear === 2026);

    expect(detail?.memberDetails[0].pensionGrossAnnual).toBe(2_400_000);
    expect(detail?.memberDetails[0].pensionDeductionAnnual).toBe(1_100_000);
    expect(detail?.memberDetails[0].taxableIncomeBeforeBasicDeductionAnnual).toBe(1_300_000);
    expect(detail?.nationalHealthInsuranceBreakdown.totalBaseIncome).toBe(870_000);
  });

  it("iDeCo一時金は退職所得として扱い、公的年金等控除と国保所得ベースから分離する", () => {
    const scenario = simpleScenario({
      userProfile: {
        birthDate: "1961-01-01",
        simulationStartYearMonth: "2026-01",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2026-12",
        targetBalanceAge: 65,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1961-01-01",
          isResident: true,
          isNationalHealthInsuranceMember: true,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      incomeEvents: [
        {
          id: "ideco-lump-sum",
          memberId: "member-self",
          name: "iDeCo一時金",
          type: "oneTime",
          startYearMonth: "2026-04",
          endYearMonth: "2026-04",
          monthlyAmount: 12_000_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
          idecoLumpSumContributionYears: 25,
          idecoLumpSumTaxMode: "retirementIncomeDeclaration",
        },
      ],
    });

    const detail = calculateAutoTaxDetails(scenario).find((row) => row.fiscalYear === 2026);

    expect(detail?.memberDetails[0].retirementGrossAnnual).toBe(12_000_000);
    expect(detail?.memberDetails[0].retirementIncomeDeductionAnnual).toBe(11_500_000);
    expect(detail?.memberDetails[0].retirementIncomeAnnual).toBe(250_000);
    expect(detail?.memberDetails[0].pensionGrossAnnual).toBe(0);
    expect(detail?.memberDetails[0].taxableIncomeBeforeBasicDeductionAnnual).toBe(0);
    expect(detail?.nationalHealthInsuranceBreakdown.totalBaseIncome).toBe(0);
  });

  it("iDeCo一時金とiDeCo年金が同じ年にあっても退職所得と年金所得を分離する", () => {
    const scenario = simpleScenario({
      userProfile: {
        birthDate: "1961-01-01",
        simulationStartYearMonth: "2026-04",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2026-12",
        targetBalanceAge: 65,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1961-01-01",
          isResident: true,
          isNationalHealthInsuranceMember: true,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      initialAssets: {
        cash: 0,
        bankDeposit: 0,
        timeDeposit: 0,
        nisa: 0,
        specificAccount: 0,
        ordinaryAccountForOptions: 0,
        ideco: 9_000_000,
        excludedAssets: 0,
        debt: 0,
      },
      initialAssetCostBasis: {
        nisa: 0,
        specificAccount: 0,
        ordinaryAccountForOptions: 0,
        ideco: 9_000_000,
      },
      monthlyExpenses: {
        food: 0,
        dailyGoods: 0,
        hobbyEntertainment: 0,
        social: 0,
        transportation: 0,
        clothingBeauty: 0,
        healthMedical: 0,
        car: 0,
        educationCulture: 0,
        specialExpense: 0,
        cashCard: 0,
        utilities: 0,
        communication: 0,
        housing: 0,
        taxSocialInsurance: 0,
        insurance: 0,
        other: 0,
      },
      incomeEvents: [
        {
          id: "ideco-lump-sum",
          memberId: "member-self",
          name: "iDeCo一時金",
          type: "oneTime",
          startYearMonth: "2026-04",
          monthlyAmount: 8_000_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
          idecoLumpSumContributionYears: 10,
          idecoLumpSumTaxMode: "retirementIncomeDeclaration",
        },
        {
          id: "ideco-pension",
          memberId: "member-self",
          name: "iDeCo年金",
          type: "pension",
          startYearMonth: "2026-05",
          endYearMonth: "2026-12",
          monthlyAmount: 100_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
        },
      ],
    });

    const detail = calculateAutoTaxDetails(scenario).find((row) => row.fiscalYear === 2026);
    const taxRow = calculateAutoTaxRows(scenario).find((row) => row.fiscalYear === 2026);
    const result = simulateScenario(scenario);
    const lumpSumMonth = result.monthly.find((row) => row.yearMonth === "2026-04");
    const pensionMonth = result.monthly.find((row) => row.yearMonth === "2026-05");

    expect(detail?.memberDetails[0].retirementGrossAnnual).toBe(8_000_000);
    expect(detail?.memberDetails[0].retirementIncomeDeductionAnnual).toBe(4_000_000);
    expect(detail?.memberDetails[0].retirementIncomeAnnual).toBe(2_000_000);
    expect(detail?.memberDetails[0].pensionGrossAnnual).toBe(800_000);
    expect(detail?.memberDetails[0].taxableIncomeBeforeBasicDeductionAnnual).toBe(0);
    expect(taxRow?.incomeTaxAnnual).toBe(detail?.memberDetails[0].retirementIncomeTaxAnnual);
    expect(lumpSumMonth?.sourceAssetIncomeBreakdown.ideco).toBe(8_000_000);
    expect(pensionMonth?.sourceAssetIncomeBreakdown.ideco).toBe(100_000);
    expect(lumpSumMonth?.idecoWithholdingTaxTotal).toBeGreaterThan(pensionMonth?.idecoWithholdingTaxTotal ?? 0);
  });

  it("iDeCo一時金は過去退職金との重複調整後の退職所得控除で計算する", () => {
    const scenario = simpleScenario({
      userProfile: {
        birthDate: "1966-01-01",
        simulationStartYearMonth: "2030-01",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2030-12",
        targetBalanceAge: 65,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1966-01-01",
          isResident: true,
          isNationalHealthInsuranceMember: true,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      retirementIncomeEvents: [
        {
          id: "company-retirement",
          memberId: "member-self",
          name: "会社退職金",
          type: "companyRetirementAllowance",
          paymentYearMonth: "2025-09",
          grossAmount: 17_246_247,
          serviceYears: 29,
          serviceStartDate: "1997-05-26",
          serviceEndDate: "2025-09-30",
          alreadyReceived: true,
          retirementIncomeDeductionUsed: true,
          withholdingTaxPaid: 75_196,
          residentTaxMunicipalPaid: 88_300,
          residentTaxPrefecturalPaid: 58_900,
        },
      ],
      incomeEvents: [
        {
          id: "ideco-lump-sum",
          memberId: "member-self",
          name: "iDeCo一時金",
          type: "oneTime",
          startYearMonth: "2030-04",
          endYearMonth: "2030-04",
          monthlyAmount: 8_000_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
          idecoLumpSumContributionYears: 20,
          idecoLumpSumTaxMode: "retirementIncomeDeclaration",
        },
      ],
    });

    const detail = calculateAutoTaxDetails(scenario).find((row) => row.fiscalYear === 2030);
    const taxRow = calculateAutoTaxRows(scenario).find((row) => row.fiscalYear === 2030);

    expect(detail?.memberDetails[0].retirementGrossAnnual).toBe(8_000_000);
    expect(detail?.memberDetails[0].retirementIncomeDeductionAnnual).toBe(0);
    expect(detail?.memberDetails[0].retirementIncomeAnnual).toBe(4_000_000);
    expect(detail?.memberDetails[0].retirementIncomeTaxAnnual).toBeGreaterThan(0);
    expect(taxRow?.incomeTaxAnnual).toBe(detail?.memberDetails[0].retirementIncomeTaxAnnual);
    expect(taxRow?.residentTaxAnnual).toBe(detail?.memberDetails[0].retirementResidentTaxAnnual);
  });

  it("過去退職金が退職所得控除を使っていない記録ならiDeCo一時金の控除を減らさない", () => {
    const scenario = simpleScenario({
      userProfile: {
        birthDate: "1966-01-01",
        simulationStartYearMonth: "2030-01",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2030-12",
        targetBalanceAge: 65,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      retirementIncomeEvents: [
        {
          id: "company-retirement",
          memberId: "member-self",
          name: "会社退職金",
          type: "companyRetirementAllowance",
          paymentYearMonth: "2025-09",
          grossAmount: 17_246_247,
          serviceYears: 29,
          serviceStartDate: "1997-05-26",
          serviceEndDate: "2025-09-30",
          alreadyReceived: true,
          retirementIncomeDeductionUsed: false,
          withholdingTaxPaid: 75_196,
          residentTaxMunicipalPaid: 88_300,
          residentTaxPrefecturalPaid: 58_900,
        },
      ],
      incomeEvents: [
        {
          id: "ideco-lump-sum",
          memberId: "member-self",
          name: "iDeCo一時金",
          type: "oneTime",
          startYearMonth: "2030-04",
          endYearMonth: "2030-04",
          monthlyAmount: 8_000_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
          idecoLumpSumContributionYears: 20,
          idecoLumpSumTaxMode: "retirementIncomeDeclaration",
        },
      ],
    });

    const detail = calculateAutoTaxDetails(scenario).find((row) => row.fiscalYear === 2030);
    const adjustments = getRetirementOverlapAdjustments(scenario);

    expect(adjustments).toHaveLength(0);
    expect(detail?.memberDetails[0].retirementGrossAnnual).toBe(8_000_000);
    expect(detail?.memberDetails[0].retirementIncomeDeductionAnnual).toBe(8_000_000);
    expect(detail?.memberDetails[0].retirementIncomeAnnual).toBe(0);
  });

  it("過去退職金との重複調整はiDeCo一時金だけに効き、iDeCo年金の雑所得計算には混ざらない", () => {
    const scenario = simpleScenario({
      userProfile: {
        birthDate: "1966-01-01",
        simulationStartYearMonth: "2030-01",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2030-12",
        targetBalanceAge: 65,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1966-01-01",
          isResident: true,
          isNationalHealthInsuranceMember: true,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      retirementIncomeEvents: [
        {
          id: "company-retirement",
          memberId: "member-self",
          name: "会社退職金",
          type: "companyRetirementAllowance",
          paymentYearMonth: "2025-09",
          grossAmount: 17_246_247,
          serviceYears: 29,
          serviceStartDate: "1997-05-26",
          serviceEndDate: "2025-09-30",
          alreadyReceived: true,
          retirementIncomeDeductionUsed: true,
          withholdingTaxPaid: 75_196,
          residentTaxMunicipalPaid: 88_300,
          residentTaxPrefecturalPaid: 58_900,
        },
      ],
      incomeEvents: [
        {
          id: "ideco-lump-sum",
          memberId: "member-self",
          name: "iDeCo一時金",
          type: "oneTime",
          startYearMonth: "2030-04",
          endYearMonth: "2030-04",
          monthlyAmount: 8_000_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
          idecoLumpSumContributionYears: 20,
          idecoLumpSumTaxMode: "retirementIncomeDeclaration",
        },
        {
          id: "ideco-pension",
          memberId: "member-self",
          name: "iDeCo年金",
          type: "pension",
          startYearMonth: "2030-05",
          endYearMonth: "2030-12",
          monthlyAmount: 100_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
        },
      ],
    });

    const detail = calculateAutoTaxDetails(scenario).find((row) => row.fiscalYear === 2030);
    const member = detail?.memberDetails[0];

    expect(member?.retirementGrossAnnual).toBe(8_000_000);
    expect(member?.retirementIncomeDeductionAnnual).toBe(0);
    expect(member?.retirementIncomeAnnual).toBe(4_000_000);
    expect(member?.pensionGrossAnnual).toBe(800_000);
    expect(member?.pensionDeductionAnnual).toBe(600_000);
    expect(member?.taxableIncomeBeforeBasicDeductionAnnual).toBe(200_000);
    expect(detail?.nationalHealthInsuranceBreakdown.totalBaseIncome).toBe(0);
  });

  it("退職所得イベントは過去退職金との間隔を警告する", () => {
    const scenario = simpleScenario({
      retirementIncomeEvents: [
        {
          id: "company-retirement",
          memberId: "member-self",
          name: "会社退職金",
          type: "companyRetirementAllowance",
          paymentYearMonth: "2020-03",
          grossAmount: 8_000_000,
          serviceYears: 30,
          alreadyReceived: true,
          retirementIncomeDeductionUsed: true,
          withholdingTaxPaid: 0,
        },
      ],
      incomeEvents: [
        {
          id: "ideco-lump-sum",
          memberId: "member-self",
          name: "iDeCo一時金",
          type: "oneTime",
          startYearMonth: "2035-04",
          endYearMonth: "2035-04",
          monthlyAmount: 6_000_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
          idecoLumpSumContributionYears: 20,
          idecoLumpSumTaxMode: "retirementIncomeDeclaration",
        },
      ],
    });

    const warnings = getRetirementOverlapWarnings(scenario);

    expect(warnings.some((warning) => warning.ruleLabel.includes("退職金先取り後のiDeCoルール"))).toBe(true);
  });

  it("同一年に退職所得が重なると同一年合算の警告を出す", () => {
    const scenario = simpleScenario({
      retirementIncomeEvents: [
        {
          id: "company-retirement",
          memberId: "member-self",
          name: "会社退職金",
          type: "companyRetirementAllowance",
          paymentYearMonth: "2030-03",
          grossAmount: 8_000_000,
          serviceYears: 30,
          alreadyReceived: true,
          retirementIncomeDeductionUsed: true,
          withholdingTaxPaid: 0,
        },
      ],
      incomeEvents: [
        {
          id: "ideco-lump-sum",
          memberId: "member-self",
          name: "iDeCo一時金",
          type: "oneTime",
          startYearMonth: "2030-12",
          endYearMonth: "2030-12",
          monthlyAmount: 6_000_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
          idecoLumpSumContributionYears: 20,
          idecoLumpSumTaxMode: "retirementIncomeDeclaration",
        },
      ],
    });

    const warnings = getRetirementOverlapWarnings(scenario);

    expect(warnings.some((warning) => warning.message.includes("同一年"))).toBe(true);
  });

  it("20年以上空いていれば退職所得の間隔警告を出さない", () => {
    const scenario = simpleScenario({
      retirementIncomeEvents: [
        {
          id: "company-retirement",
          memberId: "member-self",
          name: "会社退職金",
          type: "companyRetirementAllowance",
          paymentYearMonth: "2010-03",
          grossAmount: 8_000_000,
          serviceYears: 30,
          alreadyReceived: true,
          retirementIncomeDeductionUsed: true,
          withholdingTaxPaid: 0,
        },
      ],
      incomeEvents: [
        {
          id: "ideco-lump-sum",
          memberId: "member-self",
          name: "iDeCo一時金",
          type: "oneTime",
          startYearMonth: "2035-04",
          endYearMonth: "2035-04",
          monthlyAmount: 6_000_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
          idecoLumpSumContributionYears: 20,
          idecoLumpSumTaxMode: "retirementIncomeDeclaration",
        },
      ],
    });

    const warnings = getRetirementOverlapWarnings(scenario);

    expect(warnings.length).toBe(0);
  });

  it("退職所得の申告確認メモは源泉徴収税額と住民税内訳を拾う", () => {
    const scenario = simpleScenario({
      retirementIncomeEvents: [
        {
          id: "company-retirement",
          memberId: "member-self",
          name: "会社退職金",
          type: "companyRetirementAllowance",
          paymentYearMonth: "2025-09",
          grossAmount: 17_246_247,
          serviceYears: 29,
          alreadyReceived: true,
          retirementIncomeDeductionUsed: true,
          withholdingTaxPaid: 75_196,
          residentTaxMunicipalPaid: 88_300,
          residentTaxPrefecturalPaid: 58_900,
        },
      ],
    });

    const advice = getRetirementFilingAdvice(scenario);

    expect(advice).toHaveLength(1);
    expect(advice[0]?.taxPaidTotal).toBe(222_396);
    expect(advice[0]?.status).toBe("attention");
  });

  it("退職所得控除の重複調整は期間重複から概算控除を出す", () => {
    const scenario = simpleScenario({
      retirementIncomeEvents: [
        {
          id: "company-retirement",
          memberId: "member-self",
          name: "会社退職金",
          type: "companyRetirementAllowance",
          paymentYearMonth: "2025-09",
          grossAmount: 17_246_247,
          serviceYears: 29,
          serviceStartDate: "1997-05-26",
          serviceEndDate: "2025-09-30",
          alreadyReceived: true,
          retirementIncomeDeductionUsed: true,
          withholdingTaxPaid: 75_196,
          residentTaxMunicipalPaid: 88_300,
          residentTaxPrefecturalPaid: 58_900,
        },
        {
          id: "ideco-lump",
          memberId: "member-self",
          name: "iDeCo一時金",
          type: "idecoLumpSum",
          paymentYearMonth: "2030-04",
          grossAmount: 8_000_000,
          serviceYears: 20,
          serviceStartDate: "2005-01-01",
          serviceEndDate: "2024-12-31",
          alreadyReceived: false,
          retirementIncomeDeductionUsed: true,
          withholdingTaxPaid: 0,
        },
      ],
    });

    const adjustments = getRetirementOverlapAdjustments(scenario);

    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]?.precision).toBe("dateBased");
    expect(adjustments[0]?.estimatedOverlapYears).toBe(20);
    expect(adjustments[0]?.baseDeduction).toBe(8_000_000);
    expect(adjustments[0]?.adjustedDeduction).toBe(0);
    expect(adjustments[0]?.estimatedIncomeAfterAdjustment).toBe(4_000_000);
  });

  it("公的年金等控除は年金以外の所得が1,000万円を超える場合の速算表を使う", () => {
    const scenario = simpleScenario({
      userProfile: {
        birthDate: "1961-01-01",
        simulationStartYearMonth: "2026-01",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2026-12",
        targetBalanceAge: 65,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1961-01-01",
          isResident: true,
          isNationalHealthInsuranceMember: false,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      incomeEvents: [
        {
          id: "salary",
          memberId: "member-self",
          name: "給与",
          type: "salary",
          startYearMonth: "2026-01",
          endYearMonth: "2026-12",
          monthlyAmount: 1_050_000,
          taxTreatment: "taxable",
        },
        {
          id: "public-pension",
          memberId: "member-self",
          name: "公的年金",
          type: "pension",
          startYearMonth: "2026-01",
          endYearMonth: "2026-12",
          monthlyAmount: 200_000,
          taxTreatment: "taxable",
        },
      ],
    });

    const detail = calculateAutoTaxDetails(scenario).find((row) => row.fiscalYear === 2026);

    expect(detail?.memberDetails[0].salaryGrossAnnual).toBe(12_600_000);
    expect(detail?.memberDetails[0].pensionGrossAnnual).toBe(2_400_000);
    expect(detail?.memberDetails[0].pensionDeductionAnnual).toBe(1_000_000);
  });

  it("iDeCo年金受取をマネックス受取設定で入れると年間回数どおりの月だけ発生する", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1950-04-01",
          simulationStartYearMonth: "2027-01",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2027-12",
          targetBalanceAge: 76,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 2_400_000,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 2_400_000,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        incomeEvents: [
          {
            id: "ideco-monex",
            memberId: "member-self",
            name: "iDeCo年金受取",
            type: "pension",
            startYearMonth: "2027-02",
            monthlyAmount: 0,
            taxTreatment: "taxable",
            sourceAssetKey: "ideco",
            idecoPensionPayoutMode: "monexSchedule",
            idecoPensionYears: 10,
            idecoPensionPaymentsPerYear: 6,
          },
        ],
      }),
    );

    const paidMonths = result.monthly.filter((row) => row.incomeTotal > 0).map((row) => row.yearMonth);
    expect(paidMonths).toEqual(["2027-02", "2027-04", "2027-06", "2027-08", "2027-10", "2027-12"]);
    expect(result.monthly[1].incomeTotal).toBeGreaterThan(35_000);
    expect(result.monthly[1].incomeTotal).toBeLessThan(37_000);
    expect(result.monthly[1].idecoWithholdingTaxTotal).toBeGreaterThan(2_000);
  });

  it("マネックス受取設定では開始月が奇数月でも初回支給月を翌偶数月に補正する", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1950-04-01",
          simulationStartYearMonth: "2027-01",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2027-06",
          targetBalanceAge: 76,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 1_200_000,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 1_200_000,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        incomeEvents: [
          {
            id: "ideco-monex",
            memberId: "member-self",
            name: "iDeCo年金受取",
            type: "pension",
            startYearMonth: "2027-01",
            monthlyAmount: 0,
            taxTreatment: "taxable",
            sourceAssetKey: "ideco",
            idecoPensionPayoutMode: "monexSchedule",
            idecoPensionYears: 5,
            idecoPensionPaymentsPerYear: 6,
          },
        ],
      }),
    );

    const paidMonths = result.monthly.filter((row) => row.incomeTotal > 0).map((row) => row.yearMonth);
    expect(paidMonths[0]).toBe("2027-02");
  });

  it("マネックス受取設定では古い終了年月が残っていても受取期間から終了月を計算する", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1950-04-01",
          simulationStartYearMonth: "2027-02",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2036-12",
          targetBalanceAge: 86,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 6_000_000,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 6_000_000,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        incomeEvents: [
          {
            id: "ideco-monex",
            memberId: "member-self",
            name: "iDeCo年金受取",
            type: "pension",
            startYearMonth: "2027-02",
            endYearMonth: "2032-12",
            monthlyAmount: 0,
            taxTreatment: "taxable",
            sourceAssetKey: "ideco",
            idecoPensionPayoutMode: "monexSchedule",
            idecoPensionYears: 10,
            idecoPensionPaymentsPerYear: 6,
          },
        ],
      }),
    );

    expect(result.monthly.find((row) => row.yearMonth === "2036-12")?.incomeTotal).toBeGreaterThan(0);
    expect(result.monthly.at(-1)?.endingTrackedAssetBalances.ideco ?? 0).toBeLessThan(1_000);
  });

  it("マネックス受取設定では支給月に手数料が反映される", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1950-04-01",
          simulationStartYearMonth: "2027-02",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2027-02",
          targetBalanceAge: 76,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 600_000,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 600_000,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        incomeEvents: [
          {
            id: "ideco-monex",
            memberId: "member-self",
            name: "iDeCo年金受取",
            type: "pension",
            startYearMonth: "2027-02",
            monthlyAmount: 0,
            taxTreatment: "taxable",
            sourceAssetKey: "ideco",
            idecoPensionPayoutMode: "monexSchedule",
            idecoPensionYears: 5,
            idecoPensionPaymentsPerYear: 6,
          },
        ],
      }),
    );

    expect(result.monthly[0].idecoFeeTotal).toBeGreaterThan(0);
    expect(result.monthly[0].incomeTotal).toBeGreaterThan(0);
    expect(result.monthly[0].withdrawalSourceBreakdown.ideco).toBeGreaterThan(0);
    expect(result.monthly[0].grossAssetWithdrawalAmount).toBeGreaterThan(0);
  });

  it("マネックス受取設定では終了月までにiDeCo残高がほぼ出尽くす", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1950-04-01",
          simulationStartYearMonth: "2027-02",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2032-12",
          targetBalanceAge: 82,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 6_000_000,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 6_000_000,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        incomeEvents: [
          {
            id: "ideco-monex",
            memberId: "member-self",
            name: "iDeCo年金受取",
            type: "pension",
            startYearMonth: "2027-02",
            monthlyAmount: 0,
            taxTreatment: "taxable",
            sourceAssetKey: "ideco",
            idecoPensionPayoutMode: "monexSchedule",
            idecoPensionYears: 5,
            idecoPensionPaymentsPerYear: 6,
          },
        ],
        assetGrowthSettings: {
          enabled: true,
          rates: {
            cash: 0,
            bankDeposit: 0,
            timeDeposit: 0,
            nisa: 0,
            specificAccount: 0,
            ordinaryAccountForOptions: 0,
            ideco: 0.04,
          },
        },
      }),
    );

    const finalMonth = result.monthly.at(-1);
    expect(finalMonth?.endingTrackedAssetBalances.ideco ?? 0).toBeLessThan(1_000);
  });

  it("iDeCo一時金は開始月だけiDeCoから現金化し、退職所得の概算税を差し引く", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1961-01-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-06",
          targetBalanceAge: 65,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 12_000_000,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 12_000_000,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        incomeEvents: [
          {
            id: "ideco-lump-sum",
            memberId: "member-self",
            name: "iDeCo一時金",
            type: "oneTime",
            startYearMonth: "2026-04",
            monthlyAmount: 12_000_000,
            taxTreatment: "taxable",
            sourceAssetKey: "ideco",
            idecoLumpSumContributionYears: 25,
            idecoLumpSumTaxMode: "retirementIncomeDeclaration",
          },
        ],
      }),
    );

    expect(result.monthly[0].grossAssetWithdrawalAmount).toBe(12_000_000);
    expect(result.monthly[0].idecoWithholdingTaxTotal).toBeGreaterThan(0);
    expect(result.monthly[0].incomeTotal).toBeLessThan(12_000_000);
    expect(result.monthly[1].incomeTotal).toBe(0);
    expect(result.monthly[2].incomeTotal).toBe(0);
    expect(result.monthly[0].endingTrackedAssetBalances.ideco).toBe(0);
  });

  it("iDeCo一時金の受取月源泉は過去退職金との重複調整後の控除で概算する", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-01-01",
          simulationStartYearMonth: "2030-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2030-04",
          targetBalanceAge: 65,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 8_000_000,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 8_000_000,
        },
        retirementIncomeEvents: [
          {
            id: "company-retirement",
            memberId: "member-self",
            name: "会社退職金",
            type: "companyRetirementAllowance",
            paymentYearMonth: "2025-09",
            grossAmount: 17_246_247,
            serviceYears: 29,
            serviceStartDate: "1997-05-26",
            serviceEndDate: "2025-09-30",
            alreadyReceived: true,
            retirementIncomeDeductionUsed: true,
            withholdingTaxPaid: 75_196,
            residentTaxMunicipalPaid: 88_300,
            residentTaxPrefecturalPaid: 58_900,
          },
        ],
        incomeEvents: [
          {
            id: "ideco-lump-sum",
            memberId: "member-self",
            name: "iDeCo一時金",
            type: "oneTime",
            startYearMonth: "2030-04",
            monthlyAmount: 8_000_000,
            taxTreatment: "taxable",
            sourceAssetKey: "ideco",
            idecoLumpSumContributionYears: 20,
            idecoLumpSumTaxMode: "retirementIncomeDeclaration",
          },
        ],
      }),
    );

    expect(result.monthly[0].grossAssetWithdrawalAmount).toBe(8_000_000);
    expect(result.monthly[0].idecoWithholdingTaxTotal).toBe(780_323);
    expect(result.monthly[0].incomeTotal).toBe(7_219_677);
  });

  it("iDeCo一時金の申告なしは受取月に20.42%源泉し、翌年に最終税額との差額を精算する", () => {
    const base = simpleScenario({
      userProfile: {
        birthDate: "1961-01-01",
        simulationStartYearMonth: "2026-04",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2027-12",
        targetBalanceAge: 66,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      initialAssets: {
        cash: 0,
        bankDeposit: 0,
        timeDeposit: 0,
        nisa: 0,
        specificAccount: 0,
        ordinaryAccountForOptions: 0,
        ideco: 12_000_000,
        excludedAssets: 0,
        debt: 0,
      },
      initialAssetCostBasis: {
        nisa: 0,
        specificAccount: 0,
        ordinaryAccountForOptions: 0,
        ideco: 12_000_000,
      },
      monthlyExpenses: {
        food: 0,
        dailyGoods: 0,
        hobbyEntertainment: 0,
        social: 0,
        transportation: 0,
        clothingBeauty: 0,
        healthMedical: 0,
        car: 0,
        educationCulture: 0,
        specialExpense: 0,
        cashCard: 0,
        utilities: 0,
        communication: 0,
        housing: 0,
        taxSocialInsurance: 0,
        insurance: 0,
        other: 0,
      },
      incomeEvents: [
        {
          id: "ideco-lump-sum",
          memberId: "member-self",
          name: "iDeCo一時金",
          type: "oneTime",
          startYearMonth: "2026-04",
          monthlyAmount: 12_000_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
          idecoLumpSumContributionYears: 25,
          idecoLumpSumTaxMode: "retirementIncomeDeclaration",
        },
      ],
    });
    const withoutDeclaration = simpleScenario({
      ...base,
      incomeEvents: [
        {
          ...base.incomeEvents[0],
          idecoLumpSumTaxMode: "noDeclaration",
        },
      ],
    });

    const declarationResult = simulateScenario(base);
    const noDeclarationResult = simulateScenario(withoutDeclaration);
    const finalTax = calculateAutoTaxRows(base).find((row) => row.fiscalYear === 2026);
    const expectedFinalTax = (finalTax?.incomeTaxAnnual ?? 0) + (finalTax?.residentTaxAnnual ?? 0);
    const expectedPriorYearPublicCosts =
      expectedFinalTax +
      (finalTax?.nationalHealthInsuranceAnnual ?? 0) +
      (finalTax?.lateElderlyMedicalAnnual ?? 0) +
      (finalTax?.nursingCareAnnual ?? 0) +
      (finalTax?.otherPublicCostAnnual ?? 0);
    const declarationWithholding = declarationResult.monthly.find((row) => row.yearMonth === "2026-04")?.idecoWithholdingTaxTotal ?? 0;
    const noDeclarationWithholding = noDeclarationResult.monthly.find((row) => row.yearMonth === "2026-04")?.idecoWithholdingTaxTotal ?? 0;
    const declarationSettlement = declarationResult.annual.find((row) => row.year === 2027)?.taxInsuranceTotal ?? 0;
    const noDeclarationSettlement = noDeclarationResult.annual.find((row) => row.year === 2027)?.taxInsuranceTotal ?? 0;
    const expectedDeclarationSettlement = Math.round((expectedPriorYearPublicCosts - declarationWithholding) / 12) * 12;
    const expectedNoDeclarationSettlement = Math.round((expectedPriorYearPublicCosts - noDeclarationWithholding) / 12) * 12;

    expect(expectedFinalTax).toBeGreaterThan(0);
    expect(Math.abs(declarationWithholding - expectedFinalTax)).toBeLessThanOrEqual(1);
    expect(declarationSettlement).toBe(expectedDeclarationSettlement);
    expect(noDeclarationWithholding).toBe(Math.round(12_000_000 * 0.2042));
    expect(noDeclarationWithholding).toBeGreaterThan(expectedFinalTax);
    expect(noDeclarationSettlement).toBe(expectedNoDeclarationSettlement);
  });

  it("取り崩し順はiDeCoがNISAより先", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-04",
          targetBalanceAge: 60,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 100_000,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 50_000,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 100_000,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 50_000,
        },
        monthlyExpenses: {
          food: 120_000,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
      }),
    );

    expect(result.monthly[0].endingTrackedAssetBalances.ideco).toBe(0);
    expect(result.monthly[0].endingTrackedAssetBalances.nisa).toBeLessThan(100_000);
  });

  it("iDeCo年金受取設定がある場合は通常不足補填でiDeCoを使わない", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1950-04-01",
          simulationStartYearMonth: "2027-02",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2027-03",
          targetBalanceAge: 76,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 6_000_000,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 6_000_000,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        incomeEvents: [
          {
            id: "ideco-monex",
            memberId: "member-self",
            name: "iDeCo年金受取",
            type: "pension",
            startYearMonth: "2027-02",
            monthlyAmount: 0,
            taxTreatment: "taxable",
            sourceAssetKey: "ideco",
            idecoPensionPayoutMode: "monexSchedule",
            idecoPensionYears: 10,
            idecoPensionPaymentsPerYear: 6,
          },
        ],
        assetContributionEvents: [
          {
            id: "nisa-add",
            assetKey: "nisa",
            name: "NISA追加投資",
            startYearMonth: "2027-02",
            monthlyAmount: 300_000,
          },
        ],
      }),
    );

    expect(result.monthly[0].nisaContributionSkippedTotal).toBeGreaterThan(0);
    expect(result.monthly[1].endingTrackedAssetBalances.ideco).toBeGreaterThan(5_850_000);
  });

  it("追加投資原資不足を月次で返す", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-04",
          targetBalanceAge: 60,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
        monthlyExpenses: {
          food: 100_000,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        incomeEvents: [
          {
            id: "income",
            memberId: "member-self",
            name: "収入",
            type: "salary",
            startYearMonth: "2026-04",
            monthlyAmount: 80_000,
            taxTreatment: "taxable",
          },
        ],
        assetContributionEvents: [
          {
            id: "nisa-add",
            assetKey: "nisa",
            name: "NISA積立",
            startYearMonth: "2026-04",
            monthlyAmount: 50_000,
          },
        ],
      }),
    );

    expect(result.monthly[0].nisaContributionSkippedTotal).toBe(50_000);
    expect(result.monthly[0].assetContributionFundingGap).toBe(0);
  });

  it("普通預金を含む流動資金で賄える追加投資は原資不足にしない", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-04",
          targetBalanceAge: 60,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 500_000,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
        monthlyExpenses: {
          food: 100_000,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        incomeEvents: [
          {
            id: "income",
            memberId: "member-self",
            name: "収入",
            type: "salary",
            startYearMonth: "2026-04",
            monthlyAmount: 80_000,
            taxTreatment: "taxable",
          },
        ],
        assetContributionEvents: [
          {
            id: "nisa-add",
            assetKey: "nisa",
            name: "NISA積立",
            startYearMonth: "2026-04",
            monthlyAmount: 50_000,
          },
        ],
      }),
    );

    expect(result.monthly[0].assetContributionFundingGap).toBe(0);
    expect(result.monthly[0].grossAssetWithdrawalAmount).toBe(0);
  });

  it("将来月の原資移動で現金から普通口座へ証拠金を移せる", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-07",
          targetBalanceAge: 60,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 1_000_000,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        assetTransferEvents: [
          {
            id: "fund-options",
            name: "米国株オプション原資",
            yearMonth: "2026-07",
            fromAssetKey: "cash",
            toAssetKey: "ordinaryAccountForOptions",
            amount: 300_000,
          },
        ],
      }),
    );

    expect(result.monthly[2].assetTransferTotal).toBe(0);
    expect(result.monthly[3].assetTransferTotal).toBe(300_000);
    expect(result.monthly[3].endingTrackedAssetBalances.ordinaryAccountForOptions).toBe(300_000);
    expect(result.monthly[3].endingTrackedAssetCostBasis.ordinaryAccountForOptions).toBe(300_000);
  });

  it("取り崩し順を変えると先に減る口座も変わる", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-04",
          targetBalanceAge: 60,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 100_000,
          nisa: 200_000,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 200_000,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 0,
        },
        monthlyExpenses: {
          food: 120_000,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        withdrawalOrder: ["nisa", "timeDeposit", "bankDeposit", "specificAccount", "ordinaryAccountForOptions", "ideco"],
      }),
    );

    expect(result.monthly[0].withdrawalSourceBreakdown.nisa).toBeGreaterThan(0);
    expect(result.monthly[0].withdrawalSourceBreakdown.timeDeposit).toBe(0);
  });

  it("普通口座の最低維持額を下回る取り崩しはしない", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2026-04",
          targetBalanceAge: 60,
          cashReserve: 0,
        },
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 500_000,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 500_000,
          ideco: 0,
        },
        monthlyExpenses: {
          food: 400_000,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        optionAccountRules: {
          enabled: true,
          minimumBalance: 300_000,
          targetBalance: 500_000,
          protectFromWithdrawal: true,
          suspendIncomeWhenBelowMinimum: true,
          profitSweepEnabled: false,
          profitSweepDestination: "bankDeposit",
          profitSweepTiming: "monthly",
          profitSweepMethod: "excessOverTarget",
          fixedSweepAmount: 0,
        },
        withdrawalOrder: ["ordinaryAccountForOptions", "bankDeposit", "timeDeposit", "specificAccount", "ideco", "nisa"],
      }),
    );

    expect(result.monthly[0].withdrawalSourceBreakdown.ordinaryAccountForOptions).toBe(200_000);
    expect(result.monthly[0].endingTrackedAssetBalances.ordinaryAccountForOptions).toBe(300_000);
  });

  it("普通口座が最低維持額未満ならオプション収益を停止する", () => {
    const result = simulateScenario(
      simpleScenario({
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 100_000,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 100_000,
          ideco: 0,
        },
        optionAccountRules: {
          enabled: true,
          minimumBalance: 300_000,
          targetBalance: 500_000,
          protectFromWithdrawal: true,
          suspendIncomeWhenBelowMinimum: true,
          profitSweepEnabled: false,
          profitSweepDestination: "bankDeposit",
          profitSweepTiming: "monthly",
          profitSweepMethod: "excessOverTarget",
          fixedSweepAmount: 0,
        },
        incomeEvents: [
          {
            id: "option-income",
            memberId: "member-self",
            name: "オプション収益",
            type: "investmentIncome",
            startYearMonth: "2026-04",
            endYearMonth: "2026-04",
            monthlyAmount: 20_000,
            sourceAssetKey: "ordinaryAccountForOptions",
            sourceAssetPayoutMode: "retainInSourceAsset",
            taxTreatment: "taxable",
          },
        ],
      }),
    );

    expect(result.monthly[0].optionIncomeSuspendedTotal).toBe(20_000);
    expect(result.monthly[0].retainedSourceAssetIncomeTotal).toBe(0);
  });

  it("普通口座の目標残高超過分を普通預金へ移す", () => {
    const result = simulateScenario(
      simpleScenario({
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 600_000,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 500_000,
          ideco: 0,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        optionAccountRules: {
          enabled: true,
          minimumBalance: 300_000,
          targetBalance: 500_000,
          protectFromWithdrawal: true,
          suspendIncomeWhenBelowMinimum: true,
          profitSweepEnabled: true,
          profitSweepDestination: "bankDeposit",
          profitSweepTiming: "monthly",
          profitSweepMethod: "excessOverTarget",
          fixedSweepAmount: 0,
        },
      }),
    );

    expect(result.monthly[0].optionProfitSweepTotal).toBe(100_000);
    expect(result.monthly[0].endingTrackedAssetBalances.ordinaryAccountForOptions).toBe(500_000);
  });

  it("NISA原資不足時は不足分を未実行にする", () => {
    const result = simulateScenario(
      simpleScenario({
        initialAssets: {
          cash: 100_000,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
        assetContributionEvents: [
          {
            id: "nisa",
            name: "NISA",
            assetKey: "nisa",
            startYearMonth: "2026-04",
            monthlyAmount: 200_000,
          },
        ],
      }),
    );

    expect(result.monthly[0].assetContributionTotal).toBe(0);
    expect(result.monthly[0].nisaContributionSkippedTotal).toBe(200_000);
    expect(result.monthly[0].withdrawalSourceBreakdown.nisa).toBe(0);
  });

  it("NISA未実行の繰越残がある年は不足補填元にNISAを使わない", () => {
    const base = simpleScenario();
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          ...base.userProfile,
          simulationEndYearMonth: "2026-05",
        },
        initialAssets: {
          ...base.initialAssets,
          cash: 0,
          nisa: 1_000_000,
          specificAccount: 1_000_000,
        },
        initialAssetCostBasis: {
          ...base.initialAssetCostBasis,
          nisa: 1_000_000,
          specificAccount: 1_000_000,
        },
        withdrawalOrder: ["nisa", "specificAccount", "bankDeposit", "timeDeposit", "ordinaryAccountForOptions", "ideco"],
        assetContributionEvents: [
          {
            id: "nisa",
            name: "NISA",
            assetKey: "nisa",
            startYearMonth: "2026-04",
            endYearMonth: "2026-04",
            monthlyAmount: 200_000,
          },
        ],
        nisaInvestmentRules: {
          ...base.nisaInvestmentRules,
          carryOverSkippedMode: "acrossYears",
          protectDuringContribution: true,
        },
      }),
    );

    expect(result.monthly[0].nisaContributionSkippedTotal).toBe(200_000);
    expect(result.monthly[1].deficitWithdrawalBreakdown.nisa).toBe(0);
    expect(result.monthly[1].deficitWithdrawalBreakdown.specificAccount).toBeGreaterThan(0);
  });

  it("NISA追加投資がある年は同じ年の不足補填元にNISAを使わない", () => {
    const base = simpleScenario();
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          ...base.userProfile,
          simulationEndYearMonth: "2026-05",
        },
        initialAssets: {
          ...base.initialAssets,
          cash: 0,
          nisa: 1_000_000,
          specificAccount: 1_000_000,
        },
        initialAssetCostBasis: {
          ...base.initialAssetCostBasis,
          nisa: 1_000_000,
          specificAccount: 1_000_000,
        },
        withdrawalOrder: ["nisa", "specificAccount", "bankDeposit", "timeDeposit", "ordinaryAccountForOptions", "ideco"],
        assetContributionEvents: [
          {
            id: "nisa",
            name: "NISA",
            assetKey: "nisa",
            startYearMonth: "2026-04",
            endYearMonth: "2026-04",
            monthlyAmount: 50_000,
          },
        ],
        nisaInvestmentRules: {
          ...base.nisaInvestmentRules,
          protectDuringContribution: true,
        },
      }),
    );

    expect(result.monthly.find((row) => row.yearMonth === "2026-05")?.deficitWithdrawalBreakdown.nisa).toBe(0);
    expect(result.monthly.find((row) => row.yearMonth === "2026-05")?.deficitWithdrawalBreakdown.specificAccount).toBeGreaterThan(0);
  });

  it("NISA未実行分は設定により同一年内の後月へ繰り越して実行する", () => {
    const base = simpleScenario();
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          ...base.userProfile,
          simulationEndYearMonth: "2026-05",
        },
        initialAssets: {
          ...base.initialAssets,
          cash: 0,
        },
        monthlyExpenses: {
          ...base.monthlyExpenses,
          housing: 0,
        },
        incomeEvents: [
          {
            id: "income-may",
            memberId: "member-self",
            name: "5月入金",
            type: "salary",
            startYearMonth: "2026-05",
            endYearMonth: "2026-05",
            monthlyAmount: 300_000,
            taxTreatment: "taxable",
          },
        ],
        assetContributionEvents: [
          {
            id: "nisa",
            name: "NISA",
            assetKey: "nisa",
            startYearMonth: "2026-04",
            endYearMonth: "2026-05",
            monthlyAmount: 200_000,
            carryOverSkipped: true,
          },
        ],
        nisaInvestmentRules: {
          ...base.nisaInvestmentRules,
          carryOverSkippedMode: "withinYear",
        },
      }),
    );

    expect(result.monthly[0].nisaContributionSkippedTotal).toBe(200_000);
    expect(result.monthly[1].assetContributionTotal).toBe(300_000);
    expect(result.monthly[1].nisaContributionSkippedTotal).toBe(100_000);
  });

  it("NISA未実行分は設定により翌年以降の空き枠へ繰り越して実行する", () => {
    const base = simpleScenario();
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          ...base.userProfile,
          simulationEndYearMonth: "2027-01",
        },
        initialAssets: {
          ...base.initialAssets,
          cash: 0,
        },
        monthlyExpenses: {
          ...base.monthlyExpenses,
          housing: 0,
        },
        incomeEvents: [
          {
            id: "income-2027",
            memberId: "member-self",
            name: "2027年入金",
            type: "salary",
            startYearMonth: "2027-01",
            endYearMonth: "2027-01",
            monthlyAmount: 500_000,
            taxTreatment: "taxable",
          },
        ],
        assetContributionEvents: [
          {
            id: "nisa-2026",
            name: "NISA 2026",
            assetKey: "nisa",
            startYearMonth: "2026-04",
            endYearMonth: "2026-04",
            monthlyAmount: 300_000,
            carryOverSkipped: true,
          },
        ],
        nisaInvestmentRules: {
          ...base.nisaInvestmentRules,
          annualLimit: 400_000,
          carryOverSkippedMode: "acrossYears",
        },
      }),
    );

    expect(result.monthly.find((row) => row.yearMonth === "2026-04")?.nisaContributionSkippedTotal).toBe(300_000);
    expect(result.monthly.find((row) => row.yearMonth === "2027-01")?.assetContributionTotal).toBe(300_000);
    expect(result.monthly.find((row) => row.yearMonth === "2027-01")?.nisaAnnualLimitExceededTotal).toBe(0);
  });

  it("NISAを不足補填に使った年は繰越分のNISA追加投資を実行しない", () => {
    const base = simpleScenario();
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          ...base.userProfile,
          simulationEndYearMonth: "2027-02",
        },
        initialAssets: {
          ...base.initialAssets,
          cash: 0,
          nisa: 1_000_000,
        },
        initialAssetCostBasis: {
          ...base.initialAssetCostBasis,
          nisa: 1_000_000,
        },
        incomeEvents: [
          {
            id: "income-2027-02",
            memberId: "member-self",
            name: "2027年2月入金",
            type: "salary",
            startYearMonth: "2027-02",
            endYearMonth: "2027-02",
            monthlyAmount: 500_000,
            taxTreatment: "taxable",
          },
        ],
        assetContributionEvents: [
          {
            id: "nisa-2026",
            name: "NISA 2026",
            assetKey: "nisa",
            startYearMonth: "2026-04",
            endYearMonth: "2026-04",
            monthlyAmount: 300_000,
            carryOverSkipped: true,
          },
        ],
        nisaInvestmentRules: {
          ...base.nisaInvestmentRules,
          carryOverSkippedMode: "acrossYears",
        },
      }),
    );

    expect(result.monthly.find((row) => row.yearMonth === "2027-01")?.deficitWithdrawalBreakdown.nisa).toBeGreaterThan(0);
    expect(result.monthly.find((row) => row.yearMonth === "2027-02")?.assetContributionTotal).toBe(0);
  });

  it("NISA成長投資枠は年内の積立投資枠を先に確保した残額だけ実行する", () => {
    const base = simpleScenario();
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          ...base.userProfile,
          simulationStartYearMonth: "2027-01",
          simulationEndYearMonth: "2027-01",
        },
        initialAssets: {
          ...base.initialAssets,
          cash: 7_000_000,
        },
        monthlyExpenses: {
          ...base.monthlyExpenses,
          housing: 0,
        },
        assetContributionEvents: [
          {
            id: "nisa-tsumitate",
            name: "NISA積立",
            assetKey: "nisa",
            startYearMonth: "2027-01",
            endYearMonth: "2027-12",
            monthlyAmount: 200_000,
            nisaInvestmentSlot: "tsumitate",
            contributionPriority: 1,
            carryOverSkipped: false,
          },
          {
            id: "nisa-growth",
            name: "NISA一括",
            assetKey: "nisa",
            startYearMonth: "2027-01",
            endYearMonth: "2027-01",
            monthlyAmount: 4_800_000,
            nisaInvestmentSlot: "growth",
            contributionPriority: 2,
            carryOverSkipped: true,
          },
        ],
        nisaInvestmentRules: {
          ...base.nisaInvestmentRules,
          annualLimit: 7_200_000,
        },
      }),
    );

    expect(result.monthly[0].assetContributionTotal).toBe(4_800_000);
    expect(result.monthly[0].nisaContributionSkippedTotal).toBe(200_000);
  });

  it("NISA未実行の繰越残高を翌月以降に重複計上しない", () => {
    const base = simpleScenario();
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          ...base.userProfile,
          simulationEndYearMonth: "2026-06",
        },
        initialAssets: {
          ...base.initialAssets,
          cash: 0,
        },
        monthlyExpenses: {
          ...base.monthlyExpenses,
          housing: 0,
        },
        assetContributionEvents: [
          {
            id: "nisa",
            name: "NISA毎月積立",
            assetKey: "nisa",
            startYearMonth: "2026-04",
            endYearMonth: "2026-06",
            monthlyAmount: 100_000,
          },
        ],
        nisaInvestmentRules: {
          ...base.nisaInvestmentRules,
          carryOverSkippedMode: "acrossYears",
        },
      }),
    );

    expect(result.monthly.map((row) => row.nisaContributionSkippedTotal)).toEqual([100_000, 100_000, 100_000]);
    expect(result.annual[0].nisaContributionSkippedTotal).toBe(300_000);
  });

  it("NISA年間枠を超えた分を未実行にする", () => {
    const result = simulateScenario(
      simpleScenario({
        initialAssets: {
          cash: 6_000_000,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 0,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
        assetContributionEvents: [
          {
            id: "nisa",
            name: "NISA",
            assetKey: "nisa",
            startYearMonth: "2026-04",
            monthlyAmount: 5_000_000,
          },
        ],
      }),
    );

    expect(result.monthly[0].assetContributionTotal).toBe(3_600_000);
    expect(result.monthly[0].nisaAnnualLimitExceededTotal).toBe(1_400_000);
  });

  it("原資資産から現金化する収入は現金収入に反映される", () => {
    const result = simulateScenario(
      simpleScenario({
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 500_000,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 500_000,
          ideco: 0,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        incomeEvents: [
          {
            id: "options-cashout",
            memberId: "member-self",
            name: "CFD",
            type: "investmentIncome",
            startYearMonth: "2026-04",
            endYearMonth: "2026-04",
            monthlyAmount: 20_000,
            taxTreatment: "taxable",
            sourceAssetKey: "ordinaryAccountForOptions",
            sourceAssetPayoutMode: "cash",
          },
        ],
      }),
    );

    expect(result.monthly[0].incomeTotal).toBe(20_000);
    expect(result.monthly[0].retainedSourceAssetIncomeTotal).toBe(0);
    expect(result.monthly[0].grossAssetWithdrawalAmount).toBe(20_000);
    expect(result.monthly[0].endingTrackedAssetBalances.ordinaryAccountForOptions).toBe(480_000);
  });

  it("普通口座の口座内積上は現金化せず残高だけを増やし取引原価は維持する", () => {
    const result = simulateScenario(
      simpleScenario({
        initialAssets: {
          cash: 0,
          bankDeposit: 0,
          timeDeposit: 0,
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 500_000,
          ideco: 0,
          excludedAssets: 0,
          debt: 0,
        },
        initialAssetCostBasis: {
          nisa: 0,
          specificAccount: 0,
          ordinaryAccountForOptions: 500_000,
          ideco: 0,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        incomeEvents: [
          {
            id: "options-retain",
            memberId: "member-self",
            name: "CFD",
            type: "investmentIncome",
            startYearMonth: "2026-04",
            endYearMonth: "2026-04",
            monthlyAmount: 20_000,
            taxTreatment: "taxable",
            sourceAssetKey: "ordinaryAccountForOptions",
            sourceAssetPayoutMode: "retainInSourceAsset",
          },
        ],
      }),
    );

    expect(result.monthly[0].incomeTotal).toBe(0);
    expect(result.monthly[0].retainedSourceAssetIncomeTotal).toBe(20_000);
    expect(result.monthly[0].grossAssetWithdrawalAmount).toBe(0);
    expect(result.monthly[0].endingTrackedAssetBalances.ordinaryAccountForOptions).toBe(520_000);
    expect(result.monthly[0].endingTrackedAssetCostBasis.ordinaryAccountForOptions).toBe(500_000);
    expect(result.monthly[0].endingTrackedAssetUnrealizedGains.ordinaryAccountForOptions).toBe(20_000);
  });

  it("自動計算プラス補正では自動計算に手入力差額を加える", () => {
    const scenario = simpleScenario({
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "autoWithAdjustment",
      },
      incomeEvents: [
        {
          id: "salary",
          memberId: "member-self",
          name: "給与",
          type: "salary",
          startYearMonth: "2026-04",
          endYearMonth: "2027-03",
          monthlyAmount: 300_000,
          taxTreatment: "taxable",
        },
      ],
      taxInsurance: [
        {
          id: "adj-2026",
          fiscalYear: 2026,
          residentTaxAnnual: 12_000,
          incomeTaxAnnual: 6_000,
          nationalHealthInsuranceAnnual: 24_000,
          nationalPensionMonthly: 1_000,
          nursingCareAnnual: 3_000,
          otherPublicCostAnnual: 2_000,
        },
      ],
    });

    const autoRows = calculateAutoTaxRows(scenario);
    const effectiveRows = getEffectiveTaxRows(scenario);

    expect(effectiveRows[0].residentTaxAnnual).toBe(autoRows[0].residentTaxAnnual + 12_000);
    expect(effectiveRows[0].incomeTaxAnnual).toBe(autoRows[0].incomeTaxAnnual + 6_000);
    expect(effectiveRows[0].nationalHealthInsuranceAnnual).toBe(autoRows[0].nationalHealthInsuranceAnnual + 24_000);
    expect(effectiveRows[0].nationalPensionMonthly).toBe(autoRows[0].nationalPensionMonthly + 1_000);
    expect(effectiveRows[0].nursingCareAnnual).toBe(autoRows[0].nursingCareAnnual + 3_000);
    expect(effectiveRows[0].otherPublicCostAnnual).toBe(autoRows[0].otherPublicCostAnnual + 2_000);
  });

  it("税・社会保険タブを使うときは生活費側の税社会保険を二重計上しない", () => {
    const result = simulateScenario(
      simpleScenario({
        householdProfile: {
          municipality: "東京都大田区",
          headMemberId: "member-self",
          taxCalculationMode: "manual",
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 100_000,
          taxSocialInsurance: 50_000,
          insurance: 0,
          other: 0,
        },
        taxInsurance: [
          {
            id: "tax",
            fiscalYear: 2026,
            residentTaxAnnual: 120_000,
            incomeTaxAnnual: 0,
            nationalHealthInsuranceAnnual: 0,
            nationalPensionMonthly: 0,
            nursingCareAnnual: 0,
            otherPublicCostAnnual: 0,
          },
        ],
      }),
    );

    expect(result.monthly[0].livingExpenseTotal).toBe(100_000);
    expect(result.monthly[0].taxInsuranceTotal).toBe(10_000);
    expect(result.monthly[0].withdrawalAmount).toBe(110_000);
  });

  it("自動計算の住民税と公的保険料は前年所得を翌年の現金支出として反映する", () => {
    const scenario = simpleScenario({
      userProfile: {
        birthDate: "1950-04-01",
        simulationStartYearMonth: "2026-04",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2027-12",
        targetBalanceAge: 77,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1950-04-01",
          isResident: true,
          isNationalHealthInsuranceMember: true,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      monthlyExpenses: {
        food: 0,
        dailyGoods: 0,
        hobbyEntertainment: 0,
        social: 0,
        transportation: 0,
        clothingBeauty: 0,
        healthMedical: 0,
        car: 0,
        educationCulture: 0,
        specialExpense: 0,
        cashCard: 0,
        utilities: 0,
        communication: 0,
        housing: 0,
        taxSocialInsurance: 0,
        insurance: 0,
        other: 0,
      },
      incomeEvents: [
        {
          id: "pension",
          memberId: "member-self",
          name: "公的年金",
          type: "pension",
          startYearMonth: "2026-04",
          endYearMonth: "2026-12",
          monthlyAmount: 300_000,
          taxTreatment: "taxable",
        },
      ],
    });
    const autoRows = calculateAutoTaxRows(scenario);
    const result = simulateScenario(scenario);

    const tax2026 = result.annual.find((row) => row.year === 2026)?.taxInsuranceTotal ?? 0;
    const tax2027 = result.annual.find((row) => row.year === 2027)?.taxInsuranceTotal ?? 0;
    const taxMonth2027 = result.monthly.find((row) => row.yearMonth === "2027-01")?.taxInsuranceTotal ?? 0;
    const incomeYear2026 = autoRows.find((row) => row.fiscalYear === 2026);
    const expectedPriorYearCosts =
      (incomeYear2026?.residentTaxAnnual ?? 0) +
      (incomeYear2026?.incomeTaxAnnual ?? 0) +
      (incomeYear2026?.nationalHealthInsuranceAnnual ?? 0) +
      (incomeYear2026?.lateElderlyMedicalAnnual ?? 0) +
      (incomeYear2026?.nursingCareAnnual ?? 0) +
      (incomeYear2026?.otherPublicCostAnnual ?? 0);

    expect(tax2026).toBe(0);
    expect(expectedPriorYearCosts).toBeGreaterThan(0);
    expect(taxMonth2027).toBe(Math.round(expectedPriorYearCosts / 12));
    expect(tax2027).toBe(Math.round(expectedPriorYearCosts / 12) * 12);
  });

  it("iDeCo年金と公的年金の合算所得は翌年の税社保支払いに反映する", () => {
    const baseScenario = simpleScenario({
      userProfile: {
        birthDate: "1962-04-01",
        simulationStartYearMonth: "2026-04",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2027-12",
        targetBalanceAge: 65,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1962-04-01",
          isResident: true,
          isNationalHealthInsuranceMember: true,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      initialAssets: {
        cash: 5_000_000,
        bankDeposit: 0,
        timeDeposit: 0,
        nisa: 0,
        specificAccount: 0,
        ordinaryAccountForOptions: 0,
        ideco: 3_000_000,
        excludedAssets: 0,
        debt: 0,
      },
      initialAssetCostBasis: {
        nisa: 0,
        specificAccount: 0,
        ordinaryAccountForOptions: 0,
        ideco: 3_000_000,
      },
      monthlyExpenses: {
        food: 0,
        dailyGoods: 0,
        hobbyEntertainment: 0,
        social: 0,
        transportation: 0,
        clothingBeauty: 0,
        healthMedical: 0,
        car: 0,
        educationCulture: 0,
        specialExpense: 0,
        cashCard: 0,
        utilities: 0,
        communication: 0,
        housing: 0,
        taxSocialInsurance: 0,
        insurance: 0,
        other: 0,
      },
      incomeEvents: [
        {
          id: "public-pension",
          memberId: "member-self",
          name: "公的年金",
          type: "pension",
          startYearMonth: "2026-04",
          endYearMonth: "2026-12",
          monthlyAmount: 200_000,
          taxTreatment: "taxable",
        },
      ],
    });
    const withIdecoPension = simpleScenario({
      ...baseScenario,
      incomeEvents: [
        ...baseScenario.incomeEvents,
        {
          id: "ideco-pension",
          memberId: "member-self",
          name: "iDeCo年金受取",
          type: "pension",
          startYearMonth: "2026-04",
          endYearMonth: "2026-12",
          monthlyAmount: 200_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
        },
      ],
    });

    const publicOnlyDetail = calculateAutoTaxDetails(baseScenario).find((row) => row.fiscalYear === 2026);
    const combinedDetail = calculateAutoTaxDetails(withIdecoPension).find((row) => row.fiscalYear === 2026);
    const publicOnlyResult = simulateScenario(baseScenario);
    const combinedResult = simulateScenario(withIdecoPension);
    const publicOnlyTax2027 = publicOnlyResult.annual.find((row) => row.year === 2027)?.taxInsuranceTotal ?? 0;
    const combinedTax2027 = combinedResult.annual.find((row) => row.year === 2027)?.taxInsuranceTotal ?? 0;

    expect(publicOnlyDetail?.memberDetails[0].pensionGrossAnnual).toBe(1_800_000);
    expect(combinedDetail?.memberDetails[0].pensionGrossAnnual).toBe(3_600_000);
    expect(combinedDetail?.nationalHealthInsuranceAnnual ?? 0).toBeGreaterThan(
      publicOnlyDetail?.nationalHealthInsuranceAnnual ?? 0,
    );
    expect(publicOnlyTax2027).toBeGreaterThan(0);
    expect(combinedTax2027).toBeGreaterThan(publicOnlyTax2027);
  });

  it("iDeCo年金の源泉徴収済み所得税は翌年の税社保支払いから差し引く", () => {
    const externalPension = simpleScenario({
      userProfile: {
        birthDate: "1950-04-01",
        simulationStartYearMonth: "2026-01",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2027-12",
        targetBalanceAge: 77,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1950-04-01",
          isResident: true,
          isNationalHealthInsuranceMember: false,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      initialAssets: {
        cash: 5_000_000,
        bankDeposit: 0,
        timeDeposit: 0,
        nisa: 0,
        specificAccount: 0,
        ordinaryAccountForOptions: 0,
        ideco: 2_400_000,
        excludedAssets: 0,
        debt: 0,
      },
      initialAssetCostBasis: {
        nisa: 0,
        specificAccount: 0,
        ordinaryAccountForOptions: 0,
        ideco: 2_400_000,
      },
      monthlyExpenses: {
        food: 0,
        dailyGoods: 0,
        hobbyEntertainment: 0,
        social: 0,
        transportation: 0,
        clothingBeauty: 0,
        healthMedical: 0,
        car: 0,
        educationCulture: 0,
        specialExpense: 0,
        cashCard: 0,
        utilities: 0,
        communication: 0,
        housing: 0,
        taxSocialInsurance: 0,
        insurance: 0,
        other: 0,
      },
      incomeEvents: [
        {
          id: "external-pension",
          memberId: "member-self",
          name: "外部年金",
          type: "pension",
          startYearMonth: "2026-01",
          endYearMonth: "2026-12",
          monthlyAmount: 200_000,
          taxTreatment: "taxable",
        },
      ],
    });
    const idecoPension = simpleScenario({
      ...externalPension,
      incomeEvents: [
        {
          id: "ideco-pension",
          memberId: "member-self",
          name: "iDeCo年金受取",
          type: "pension",
          startYearMonth: "2026-01",
          endYearMonth: "2026-12",
          monthlyAmount: 200_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
        },
      ],
    });

    const externalResult = simulateScenario(externalPension);
    const idecoResult = simulateScenario(idecoPension);
    const externalTax2027 = externalResult.annual.find((row) => row.year === 2027)?.taxInsuranceTotal ?? 0;
    const idecoTax2027 = idecoResult.annual.find((row) => row.year === 2027)?.taxInsuranceTotal ?? 0;
    const idecoWithholding2026 = idecoResult.annual.find((row) => row.year === 2026)?.idecoWithholdingTaxTotal ?? 0;

    expect(idecoWithholding2026).toBeGreaterThan(0);
    expect(idecoTax2027).toBeLessThan(externalTax2027);
    expect(externalTax2027 - idecoTax2027).toBe(idecoWithholding2026);
  });

  it("iDeCo年金の源泉徴収が所得税を上回る場合は翌年の現金収支で戻りとして扱う", () => {
    const scenario = simpleScenario({
      userProfile: {
        birthDate: "1961-04-01",
        simulationStartYearMonth: "2026-01",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2027-12",
        targetBalanceAge: 66,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1961-04-01",
          isResident: true,
          isNationalHealthInsuranceMember: false,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      initialAssets: {
        cash: 5_000_000,
        bankDeposit: 0,
        timeDeposit: 0,
        nisa: 0,
        specificAccount: 0,
        ordinaryAccountForOptions: 0,
        ideco: 600_000,
        excludedAssets: 0,
        debt: 0,
      },
      initialAssetCostBasis: {
        nisa: 0,
        specificAccount: 0,
        ordinaryAccountForOptions: 0,
        ideco: 600_000,
      },
      monthlyExpenses: {
        food: 0,
        dailyGoods: 0,
        hobbyEntertainment: 0,
        social: 0,
        transportation: 0,
        clothingBeauty: 0,
        healthMedical: 0,
        car: 0,
        educationCulture: 0,
        specialExpense: 0,
        cashCard: 0,
        utilities: 0,
        communication: 0,
        housing: 0,
        taxSocialInsurance: 0,
        insurance: 0,
        other: 0,
      },
      incomeEvents: [
        {
          id: "small-ideco-pension",
          memberId: "member-self",
          name: "少額iDeCo年金",
          type: "pension",
          startYearMonth: "2026-01",
          endYearMonth: "2026-12",
          monthlyAmount: 50_000,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
        },
      ],
    });

    const taxRow2026 = calculateAutoTaxRows(scenario).find((row) => row.fiscalYear === 2026);
    const result = simulateScenario(scenario);
    const withholding2026 = result.annual.find((row) => row.year === 2026)?.idecoWithholdingTaxTotal ?? 0;
    const taxSettlement2027 = result.annual.find((row) => row.year === 2027)?.taxInsuranceTotal ?? 0;

    expect(taxRow2026?.incomeTaxAnnual).toBe(0);
    expect(withholding2026).toBeGreaterThan(0);
    expect(taxSettlement2027).toBeLessThan(0);
    expect(taxSettlement2027).toBeCloseTo(-withholding2026, -1);
  });

  it("自動計算した公的保険料は翌年の社会保険料控除として所得税と住民税を下げる", () => {
    const scenario = simpleScenario({
      userProfile: {
        birthDate: "1950-04-01",
        simulationStartYearMonth: "2026-04",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2027-12",
        targetBalanceAge: 77,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1950-04-01",
          isResident: true,
          isNationalHealthInsuranceMember: true,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      incomeEvents: [
        {
          id: "pension-2026",
          memberId: "member-self",
          name: "公的年金",
          type: "pension",
          startYearMonth: "2026-04",
          endYearMonth: "2026-12",
          monthlyAmount: 300_000,
          taxTreatment: "taxable",
        },
        {
          id: "salary-2027",
          memberId: "member-self",
          name: "給与",
          type: "salary",
          startYearMonth: "2027-01",
          endYearMonth: "2027-12",
          monthlyAmount: 800_000,
          taxTreatment: "taxable",
        },
      ],
    });

    const detail2026 = calculateAutoTaxDetails(scenario).find((row) => row.fiscalYear === 2026);
    const detail2027 = calculateAutoTaxDetails(scenario).find((row) => row.fiscalYear === 2027);
    const member2027 = detail2027?.memberDetails[0];
    const expectedAutoDeduction =
      (detail2026?.nationalHealthInsuranceAnnual ?? 0) +
      (detail2026?.lateElderlyMedicalAnnual ?? 0) +
      (detail2026?.nursingCareAnnual ?? 0);

    expect(expectedAutoDeduction).toBeGreaterThan(0);
    expect(member2027?.autoSocialInsuranceDeductionAnnual).toBe(expectedAutoDeduction);
    expect(member2027?.incomeTaxBaseAnnual).toBe(
      Math.max(
        0,
        (member2027?.taxableIncomeBeforeBasicDeductionAnnual ?? 0) -
          (member2027?.basicDeductionAnnual ?? 0) -
          expectedAutoDeduction,
      ),
    );
  });

  it("75歳切替をまたいだ公的保険料も翌年の社会保険料控除に反映する", () => {
    const scenario = simpleScenario({
      userProfile: {
        birthDate: "1956-10-22",
        simulationStartYearMonth: "2030-01",
        simulationEndMode: "yearMonth",
        simulationEndYearMonth: "2032-12",
        targetBalanceAge: 77,
        cashReserve: 0,
      },
      householdProfile: {
        municipality: "東京都大田区",
        headMemberId: "member-self",
        taxCalculationMode: "auto",
      },
      householdMembers: [
        {
          id: "member-self",
          name: "本人",
          relationship: "self",
          birthDate: "1956-10-22",
          isResident: true,
          isNationalHealthInsuranceMember: true,
          isLateElderlyMedicalMember: false,
          isLongTermCareInsured: false,
          isDependent: false,
        },
      ],
      incomeEvents: [
        {
          id: "pension",
          memberId: "member-self",
          name: "公的年金",
          type: "pension",
          startYearMonth: "2030-01",
          endYearMonth: "2032-12",
          monthlyAmount: 300_000,
          taxTreatment: "taxable",
        },
        {
          id: "salary",
          memberId: "member-self",
          name: "給与",
          type: "salary",
          startYearMonth: "2031-01",
          endYearMonth: "2032-12",
          monthlyAmount: 800_000,
          taxTreatment: "taxable",
        },
      ],
    });

    const details = calculateAutoTaxDetails(scenario);
    const detail2030 = details.find((row) => row.fiscalYear === 2030);
    const detail2031 = details.find((row) => row.fiscalYear === 2031);
    const detail2032 = details.find((row) => row.fiscalYear === 2032);
    const insurance2030 =
      (detail2030?.nationalHealthInsuranceAnnual ?? 0) +
      (detail2030?.lateElderlyMedicalAnnual ?? 0) +
      (detail2030?.nursingCareAnnual ?? 0);
    const insurance2031 =
      (detail2031?.nationalHealthInsuranceAnnual ?? 0) +
      (detail2031?.lateElderlyMedicalAnnual ?? 0) +
      (detail2031?.nursingCareAnnual ?? 0);

    expect(detail2030?.nationalHealthInsuranceAnnual).toBeGreaterThan(0);
    expect(detail2030?.lateElderlyMedicalAnnual).toBe(0);
    expect(detail2031?.nationalHealthInsuranceAnnual).toBeGreaterThan(0);
    expect(detail2031?.lateElderlyMedicalAnnual).toBeGreaterThan(0);
    expect(detail2032?.nationalHealthInsuranceAnnual).toBe(0);
    expect(detail2032?.lateElderlyMedicalAnnual).toBeGreaterThan(0);
    expect(detail2031?.memberDetails[0].autoSocialInsuranceDeductionAnnual).toBe(insurance2030);
    expect(detail2032?.memberDetails[0].autoSocialInsuranceDeductionAnnual).toBe(insurance2031);
  });

  it("代表的サンプルシナリオで比較に必要な結果が出る", () => {
    const results = sampleState.scenarios.map(simulateScenario);

    expect(results.length).toBeGreaterThanOrEqual(5);
    expect(results.every((result) => result.monthly.length > 0)).toBe(true);
    expect(results.every((result) => Number.isFinite(result.totalWithdrawal))).toBe(true);
  });

  it("特別支出は毎月発生と毎年発生を反映する", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2027-12",
          targetBalanceAge: 60,
          cashReserve: 0,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        specialExpenses: [
          {
            id: "monthly-trip",
            name: "毎月旅行積立",
            yearMonth: "2026-04",
            endYearMonth: "2026-06",
            amount: 10_000,
            schedule: "monthly",
          },
          {
            id: "yearly-repair",
            name: "毎年修繕",
            yearMonth: "2026-10",
            endYearMonth: "2027-10",
            amount: 50_000,
            schedule: "yearly",
          },
        ],
      }),
    );

    expect(result.monthly.find((row) => row.yearMonth === "2026-04")?.specialExpenseTotal).toBe(10_000);
    expect(result.monthly.find((row) => row.yearMonth === "2026-06")?.specialExpenseTotal).toBe(10_000);
    expect(result.monthly.find((row) => row.yearMonth === "2026-10")?.specialExpenseTotal).toBe(50_000);
    expect(result.monthly.find((row) => row.yearMonth === "2027-10")?.specialExpenseTotal).toBe(50_000);
  });

  it("特別支出は四半期ごとと半年ごとを反映する", () => {
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          birthDate: "1966-04-01",
          simulationStartYearMonth: "2026-04",
          simulationEndMode: "yearMonth",
          simulationEndYearMonth: "2027-06",
          targetBalanceAge: 60,
          cashReserve: 0,
        },
        monthlyExpenses: {
          food: 0,
          dailyGoods: 0,
          hobbyEntertainment: 0,
          social: 0,
          transportation: 0,
          clothingBeauty: 0,
          healthMedical: 0,
          car: 0,
          educationCulture: 0,
          specialExpense: 0,
          cashCard: 0,
          utilities: 0,
          communication: 0,
          housing: 0,
          taxSocialInsurance: 0,
          insurance: 0,
          other: 0,
        },
        specialExpenses: [
          {
            id: "quarterly-trip",
            name: "四半期旅行",
            yearMonth: "2026-04",
            endYearMonth: "2026-12",
            amount: 30_000,
            schedule: "quarterly",
          },
          {
            id: "semiannual-maintenance",
            name: "半年ごとの点検",
            yearMonth: "2026-06",
            endYearMonth: "2027-06",
            amount: 80_000,
            schedule: "semiannual",
          },
        ],
      }),
    );

    expect(result.monthly.find((row) => row.yearMonth === "2026-04")?.specialExpenseTotal).toBe(30_000);
    expect(result.monthly.find((row) => row.yearMonth === "2026-07")?.specialExpenseTotal).toBe(30_000);
    expect(result.monthly.find((row) => row.yearMonth === "2026-10")?.specialExpenseTotal).toBe(30_000);
    expect(result.monthly.find((row) => row.yearMonth === "2026-06")?.specialExpenseTotal).toBe(80_000);
    expect(result.monthly.find((row) => row.yearMonth === "2026-12")?.specialExpenseTotal).toBe(80_000);
    expect(result.monthly.find((row) => row.yearMonth === "2027-06")?.specialExpenseTotal).toBe(80_000);
  });

  it("普通口座サブ口座ごとの最低維持額を取り崩し時に守る", () => {
    const base = simpleScenario();
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          ...base.userProfile,
          simulationEndYearMonth: "2026-04",
        },
        initialAssets: {
          ...base.initialAssets,
          cash: 0,
          ordinaryAccountForOptions: 500_000,
        },
        initialAssetCostBasis: {
          ...base.initialAssetCostBasis,
          ordinaryAccountForOptions: 500_000,
        },
        monthlyExpenses: {
          ...base.monthlyExpenses,
          housing: 300_000,
        },
        withdrawalOrder: ["ordinaryAccountForOptions", "bankDeposit", "timeDeposit", "specificAccount", "ideco", "nisa"],
        optionSubAccounts: [
          {
            id: "cfd",
            name: "CFD",
            initialValue: 300_000,
            initialCostBasis: 300_000,
            enabled: true,
            minimumBalance: 200_000,
            targetBalance: 300_000,
            withdrawalPriority: 1,
            protectFromWithdrawal: true,
            releaseProtectionAfterEnd: true,
            suspendIncomeWhenBelowMinimum: true,
            profitSweepEnabled: false,
            profitSweepDestination: "bankDeposit",
            profitSweepTiming: "monthly",
            profitSweepMethod: "excessOverTarget",
            fixedSweepAmount: 0,
          },
          {
            id: "us-option",
            name: "米国株オプション",
            initialValue: 200_000,
            initialCostBasis: 200_000,
            enabled: true,
            minimumBalance: 150_000,
            targetBalance: 200_000,
            withdrawalPriority: 2,
            protectFromWithdrawal: true,
            releaseProtectionAfterEnd: true,
            suspendIncomeWhenBelowMinimum: true,
            profitSweepEnabled: false,
            profitSweepDestination: "bankDeposit",
            profitSweepTiming: "monthly",
            profitSweepMethod: "excessOverTarget",
            fixedSweepAmount: 0,
          },
        ],
      }),
    );

    expect(result.monthly[0].withdrawalSourceBreakdown.ordinaryAccountForOptions).toBe(150_000);
    expect(result.monthly[0].endingTrackedAssetBalances.ordinaryAccountForOptions).toBe(350_000);
  });

  it("原資移動は指定した普通口座サブ口座へ入り、取得原価も増える", () => {
    const base = simpleScenario();
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          ...base.userProfile,
          simulationEndYearMonth: "2026-04",
        },
        initialAssets: {
          ...base.initialAssets,
          cash: 1_000_000,
          ordinaryAccountForOptions: 0,
        },
        optionSubAccounts: [
          {
            id: "us-option",
            name: "米国株オプション",
            initialValue: 0,
            initialCostBasis: 0,
            enabled: true,
            minimumBalance: 0,
            targetBalance: 0,
            withdrawalPriority: 1,
            protectFromWithdrawal: true,
            releaseProtectionAfterEnd: true,
            suspendIncomeWhenBelowMinimum: true,
            profitSweepEnabled: false,
            profitSweepDestination: "bankDeposit",
            profitSweepTiming: "monthly",
            profitSweepMethod: "excessOverTarget",
            fixedSweepAmount: 0,
          },
        ],
        assetTransferEvents: [
          {
            id: "transfer-us-option",
            name: "米国株オプション原資",
            yearMonth: "2026-04",
            fromAssetKey: "cash",
            toAssetKey: "ordinaryAccountForOptions",
            toOptionSubAccountId: "us-option",
            amount: 400_000,
          },
        ],
      }),
    );

    expect(result.monthly[0].assetTransferTotal).toBe(400_000);
    expect(result.monthly[0].endingTrackedAssetBalances.ordinaryAccountForOptions).toBe(400_000);
    expect(result.monthly[0].endingTrackedAssetCostBasis.ordinaryAccountForOptions).toBe(400_000);
  });

  it("特定口座の源泉徴収なしは売却月に差し引かず、翌年支払予定の譲渡益税に回す", () => {
    const base = simpleScenario();
    const result = simulateScenario(
      simpleScenario({
        userProfile: {
          ...base.userProfile,
          simulationEndYearMonth: "2027-01",
        },
        householdProfile: {
          ...base.householdProfile,
          taxCalculationMode: "auto",
        },
        initialAssets: {
          ...base.initialAssets,
          cash: 0,
          specificAccount: 1_000_000,
        },
        initialAssetCostBasis: {
          ...base.initialAssetCostBasis,
          specificAccount: 500_000,
        },
        withdrawalOrder: ["specificAccount", "bankDeposit", "timeDeposit", "ordinaryAccountForOptions", "ideco", "nisa"],
        taxableAccountSettings: {
          specificAccountWithholding: "noWithholding",
        },
      }),
    );

    expect(result.monthly[0].capitalGainsTaxTotal).toBe(0);
    expect(result.monthly[0].deferredCapitalGainsTaxTotal).toBeGreaterThan(0);
    expect(result.monthly.find((row) => row.yearMonth === "2027-01")?.taxInsuranceTotal).toBeGreaterThan(0);
  });

  it("特定口座の源泉徴収ありは売却益を申告所得として翌年の自動税社保に入れない", () => {
    const base = simpleScenario({
      userProfile: {
        ...simpleScenario().userProfile,
        simulationEndYearMonth: "2027-12",
      },
      householdProfile: {
        ...simpleScenario().householdProfile,
        taxCalculationMode: "auto",
      },
      initialAssets: {
        ...simpleScenario().initialAssets,
        cash: 0,
        specificAccount: 1_000_000,
      },
      initialAssetCostBasis: {
        ...simpleScenario().initialAssetCostBasis,
        specificAccount: 500_000,
      },
      withdrawalOrder: ["specificAccount", "bankDeposit", "timeDeposit", "ordinaryAccountForOptions", "ideco", "nisa"],
      taxableAccountSettings: {
        specificAccountWithholding: "withholding",
      },
    });
    const withoutSale = simpleScenario({
      ...base,
      initialAssets: {
        ...base.initialAssets,
        cash: 0,
        specificAccount: 0,
      },
      initialAssetCostBasis: {
        ...base.initialAssetCostBasis,
        specificAccount: 0,
      },
    });

    const result = simulateScenario(base);
    const noSaleResult = simulateScenario(withoutSale);

    expect(result.monthly[0].capitalGainsTaxTotal).toBeGreaterThan(0);
    expect(result.annual.find((row) => row.year === 2026)?.declaredCapitalGainsIncomeTotal).toBe(0);
    expect(result.monthly.find((row) => row.yearMonth === "2027-01")?.taxInsuranceTotal).toBe(
      noSaleResult.monthly.find((row) => row.yearMonth === "2027-01")?.taxInsuranceTotal,
    );
  });

  it("普通口座オプションの実現益は申告所得として翌年の税社保に反映する", () => {
    const base = simpleScenario({
      userProfile: {
        ...simpleScenario().userProfile,
        simulationEndYearMonth: "2027-12",
      },
      householdProfile: {
        ...simpleScenario().householdProfile,
        taxCalculationMode: "auto",
      },
      initialAssets: {
        ...simpleScenario().initialAssets,
        cash: 0,
        ordinaryAccountForOptions: 1_000_000,
      },
      initialAssetCostBasis: {
        ...simpleScenario().initialAssetCostBasis,
        ordinaryAccountForOptions: 500_000,
      },
      withdrawalOrder: ["ordinaryAccountForOptions", "bankDeposit", "timeDeposit", "specificAccount", "ideco", "nisa"],
    });
    const withoutGain = simpleScenario({
      ...base,
      initialAssetCostBasis: {
        ...base.initialAssetCostBasis,
        ordinaryAccountForOptions: 1_000_000,
      },
    });

    const result = simulateScenario(base);
    const noGainResult = simulateScenario(withoutGain);

    expect(result.monthly[0].capitalGainsTaxTotal).toBe(0);
    expect(result.annual.find((row) => row.year === 2026)?.declaredCapitalGainsIncomeTotal).toBeGreaterThan(0);
    expect(result.monthly.find((row) => row.yearMonth === "2027-01")?.taxInsuranceTotal ?? 0).toBeGreaterThan(
      noGainResult.monthly.find((row) => row.yearMonth === "2027-01")?.taxInsuranceTotal ?? 0,
    );
  });
});
