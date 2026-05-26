import type { RetirementPlanState, ScenarioData } from "@/types";

const baseScenario: ScenarioData = {
  id: "base",
  name: "標準ケース",
  description: "60歳前後の夫婦世帯を想定した匿名サンプル",
  compare: true,
  userProfile: {
    birthDate: "1968-04-01",
    simulationStartYearMonth: "2026-06",
    simulationEndMode: "age",
    simulationEndAge: 95,
    targetBalanceAge: 90,
    targetBalanceAmount: 5_000_000,
    flexibleFreeCashStartAge: 58,
    flexibleFreeCashEndAge: 75,
    plannedDrawdownEnabled: false,
    cashReserve: 1_000_000,
    municipality: "東京都大田区",
    hasSpouse: true,
    note: "匿名の標準世帯サンプルです。税・社会保険は自動計算を基本にしています。",
  },
  householdProfile: {
    municipality: "東京都大田区",
    headMemberId: "member-self",
    taxCalculationMode: "auto",
    notes: "一般公開版の初期確認用サンプル。",
  },
  householdMembers: [
    {
      id: "member-self",
      name: "本人",
      relationship: "self",
      birthDate: "1968-04-01",
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
      birthDate: "1969-04-01",
      isResident: true,
      isNationalHealthInsuranceMember: true,
      isLateElderlyMedicalMember: false,
      isLongTermCareInsured: false,
      isDependent: false,
    },
  ],
  householdLivingArrangementEvents: [],
  householdMemberStatusEvents: [],
  initialAssets: {
    cash: 1_000_000,
    bankDeposit: 11_000_000,
    timeDeposit: 0,
    nisa: 8_000_000,
    specificAccount: 7_000_000,
    ordinaryAccountForOptions: 0,
    ideco: 6_000_000,
    excludedAssets: 0,
    debt: 0,
  },
  initialAssetCostBasis: {
    nisa: 7_200_000,
    specificAccount: 6_300_000,
    ordinaryAccountForOptions: 0,
    ideco: 5_400_000,
  },
  monthlyExpenses: {
    food: 60_000,
    dailyGoods: 20_000,
    hobbyEntertainment: 20_000,
    social: 15_000,
    transportation: 15_000,
    clothingBeauty: 10_000,
    healthMedical: 15_000,
    car: 0,
    educationCulture: 5_000,
    specialExpense: 0,
    cashCard: 0,
    utilities: 28_000,
    communication: 12_000,
    housing: 80_000,
    taxSocialInsurance: 0,
    insurance: 15_000,
    other: 25_000,
  },
  ageExpenseAdjustments: [
    {
      id: "expense-70",
      name: "70歳以降の生活費を少し抑える",
      startAge: 70,
      target: "all",
      mode: "multiplier",
      value: 0.95,
    },
    {
      id: "medical-75",
      name: "75歳以降の医療・介護費増",
      startAge: 75,
      target: "healthMedical",
      mode: "multiplier",
      value: 1.4,
    },
  ],
  incomeEvents: [
    {
      id: "salary-part-time",
      memberId: "member-self",
      name: "退職後の給与・パート",
      type: "salary",
      startYearMonth: "2026-06",
      endYearMonth: "2033-03",
      monthlyAmount: 100_000,
      taxTreatment: "taxable",
    },
    {
      id: "pension-self",
      memberId: "member-self",
      name: "本人の公的年金",
      type: "pension",
      startYearMonth: "2033-04",
      monthlyAmount: 150_000,
      taxTreatment: "taxable",
    },
    {
      id: "pension-spouse",
      memberId: "member-spouse",
      name: "配偶者の公的年金",
      type: "pension",
      startYearMonth: "2034-04",
      monthlyAmount: 100_000,
      taxTreatment: "taxable",
    },
  ],
  retirementIncomeEvents: [],
  taxDeductionEvents: [],
  specialExpenses: [
    {
      id: "annual-enjoyment",
      name: "旅行・趣味",
      yearMonth: "2028-04",
      endYearMonth: "2038-03",
      amount: 300_000,
      category: "enjoyment",
      schedule: "yearly",
      inflationMode: "livingCost",
    },
    {
      id: "home-maintenance",
      name: "住まいの修繕",
      yearMonth: "2036-04",
      amount: 1_200_000,
      category: "housingCar",
      schedule: "once",
      inflationMode: "livingCost",
    },
    {
      id: "family-event",
      name: "家族イベント",
      yearMonth: "2033-04",
      amount: 300_000,
      category: "familySupport",
      schedule: "once",
      inflationMode: "livingCost",
    },
  ],
  timeBucketItems: [
    {
      id: "todo-travel",
      title: "元気なうちの旅行・趣味",
      bucketId: "todo",
      convertedSpecialExpenseId: "annual-enjoyment",
    },
    {
      id: "todo-home",
      title: "住まいの修繕",
      bucketId: "todo",
      convertedSpecialExpenseId: "home-maintenance",
    },
  ],
  assetContributionEvents: [
    {
      id: "nisa-accumulate",
      assetKey: "nisa",
      name: "NISA積立",
      startYearMonth: "2026-06",
      endYearMonth: "2033-03",
      monthlyAmount: 50_000,
      nisaInvestmentSlot: "tsumitate",
      contributionPriority: 1,
      carryOverSkipped: false,
    },
  ],
  assetTransferEvents: [],
  withdrawalOrder: ["bankDeposit", "timeDeposit", "specificAccount", "nisa", "ideco"],
  taxInsurance: [],
  assetGrowthSettings: {
    enabled: true,
    rates: {
      cash: 0,
      bankDeposit: 0.001,
      timeDeposit: 0.002,
      nisa: 0.05,
      specificAccount: 0.03,
      ordinaryAccountForOptions: 0,
      ideco: 0.035,
    },
  },
  inflationSettings: {
    enabled: true,
    livingCostAnnualInflationRate: 0.02,
    medicalAnnualInflationRate: 0.025,
    pensionAnnualAdjustmentRate: 0.015,
    livingCostInflationTargets: [
      "food",
      "dailyGoods",
      "hobbyEntertainment",
      "social",
      "transportation",
      "clothingBeauty",
      "car",
      "educationCulture",
      "specialExpense",
      "cashCard",
      "utilities",
      "communication",
      "housing",
      "taxSocialInsurance",
      "insurance",
      "other",
    ],
    medicalInflationTargets: ["healthMedical"],
  },
  optionAccountRules: {
    enabled: false,
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
    annualLimit: 7_200_000,
    lifetimeLimitPerInvestor: 18_000_000,
    usedLifetimeLimitAtStart: 8_000_000,
    investorCount: 2,
    enforceAnnualLimit: true,
    protectDuringContribution: true,
    insufficientFundingMode: "skip",
    carryOverSkippedMode: "none",
  },
  taxableAccountSettings: {
    specificAccountWithholding: "withholding",
  },
};

function scenarioWith(id: string, name: string, mutate: (scenario: ScenarioData) => void): ScenarioData {
  const scenario = structuredClone(baseScenario);
  scenario.id = id;
  scenario.name = name;
  scenario.description = undefined;
  mutate(scenario);
  return scenario;
}

export const sampleState: RetirementPlanState = {
  version: 1,
  activeScenarioId: "base",
  baselineScenarioId: "base",
  lastSavedAt: undefined,
  backups: [],
  scenarios: [
    baseScenario,
    scenarioWith("expense-low", "生活費を少し抑える", (scenario) => {
      for (const key of Object.keys(scenario.monthlyExpenses) as (keyof typeof scenario.monthlyExpenses)[]) {
        scenario.monthlyExpenses[key] = Math.round(scenario.monthlyExpenses[key] * 0.9);
      }
    }),
    scenarioWith("pension-earlier", "年金受給を早める", (scenario) => {
      const selfPension = scenario.incomeEvents.find((event) => event.id === "pension-self");
      const spousePension = scenario.incomeEvents.find((event) => event.id === "pension-spouse");
      if (selfPension) {
        selfPension.startYearMonth = "2031-04";
        selfPension.monthlyAmount = 136_000;
      }
      if (spousePension) {
        spousePension.startYearMonth = "2032-04";
        spousePension.monthlyAmount = 90_000;
      }
    }),
    scenarioWith("pension-later", "年金受給を遅らせる", (scenario) => {
      const selfPension = scenario.incomeEvents.find((event) => event.id === "pension-self");
      const spousePension = scenario.incomeEvents.find((event) => event.id === "pension-spouse");
      if (selfPension) {
        selfPension.startYearMonth = "2035-04";
        selfPension.monthlyAmount = 175_000;
      }
      if (spousePension) {
        spousePension.startYearMonth = "2036-04";
        spousePension.monthlyAmount = 117_000;
      }
    }),
    scenarioWith("enjoyment-plus", "楽しみ支出を増やす", (scenario) => {
      scenario.specialExpenses.push({
        id: "extra-enjoyment",
        name: "追加の旅行・趣味",
        yearMonth: "2028-04",
        endYearMonth: "2038-03",
        amount: 200_000,
        category: "enjoyment",
        schedule: "yearly",
        inflationMode: "livingCost",
      });
    }),
    scenarioWith("growth-low", "利回りを低めに見る", (scenario) => {
      scenario.assetGrowthSettings.enabled = true;
      scenario.assetGrowthSettings.rates = {
        cash: 0,
        bankDeposit: 0.001,
        timeDeposit: 0.0015,
        nisa: 0.03,
        specificAccount: 0.02,
        ordinaryAccountForOptions: 0,
        ideco: 0.025,
      };
    }),
  ],
};
