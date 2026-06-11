import type { RetirementPlanState, ScenarioData } from "@/types";

const baseScenario: ScenarioData = {
  id: "base",
  name: "今の働き方と積立を継続",
  description: "入力練習用の匿名サンプル。50歳前後の現役世代が、60歳・65歳時点資産とライフイベントを確認する前提です。",
  compare: true,
  userProfile: {
    birthDate: "1976-04-01",
    simulationStartYearMonth: "2026-06",
    simulationEndMode: "age",
    simulationEndAge: 95,
    targetBalanceAge: 90,
    targetBalanceAmount: 5_000_000,
    flexibleFreeCashStartAge: 50,
    flexibleFreeCashEndAge: 75,
    plannedDrawdownEnabled: false,
    cashReserve: 1_000_000,
    municipality: "東京都大田区",
    hasSpouse: true,
    note: "入力練習用の匿名サンプルです。現役収入、積立、教育費、住まい、体験支出を含めています。",
  },
  householdProfile: {
    municipality: "東京都大田区",
    headMemberId: "member-self",
    taxCalculationMode: "auto",
    planningGoals: ["assetAtMilestone", "lifeEvents", "enjoymentBudget"],
    notes: "一般公開版の入力練習用サンプル。",
  },
  householdMembers: [
    {
      id: "member-self",
      name: "本人",
      relationship: "self",
      birthDate: "1976-04-01",
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
      birthDate: "1977-04-01",
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
    bankDeposit: 55_000_000,
    timeDeposit: 0,
    nisa: 8_000_000,
    specificAccount: 4_000_000,
    ordinaryAccountForOptions: 0,
    ideco: 3_000_000,
    excludedAssets: 0,
    debt: 0,
  },
  initialAssetCostBasis: {
    nisa: 7_200_000,
    specificAccount: 3_600_000,
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
    healthMedical: 12_000,
    car: 0,
    educationCulture: 15_000,
    specialExpense: 0,
    cashCard: 0,
    utilities: 28_000,
    communication: 15_000,
    housing: 100_000,
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
      name: "現在の給与",
      type: "salary",
      startYearMonth: "2026-06",
      endYearMonth: "2041-03",
      monthlyAmount: 700_000,
      taxTreatment: "taxable",
    },
    {
      id: "pension-self",
      memberId: "member-self",
      name: "本人の公的年金",
      type: "pension",
      startYearMonth: "2041-04",
      monthlyAmount: 150_000,
      taxTreatment: "taxable",
    },
    {
      id: "pension-spouse",
      memberId: "member-spouse",
      name: "配偶者の公的年金",
      type: "pension",
      startYearMonth: "2042-04",
      monthlyAmount: 100_000,
      taxTreatment: "taxable",
    },
  ],
  retirementIncomeEvents: [],
  reviewAcknowledgements: [],
  taxDeductionEvents: [],
  specialExpenses: [
    {
      id: "education-university",
      name: "ライフイベント由来: 教育費",
      yearMonth: "2028-04",
      endYearMonth: "2032-03",
      amount: 900_000,
      category: "familySupport",
      schedule: "yearly",
      inflationMode: "livingCost",
      note: "ライフイベントテンプレート例: 大学・進学関連費用",
    },
    {
      id: "annual-family-travel",
      name: "ライフイベント由来: 家族旅行・体験",
      yearMonth: "2027-04",
      endYearMonth: "2036-03",
      amount: 350_000,
      category: "enjoyment",
      schedule: "yearly",
      inflationMode: "livingCost",
      note: "ライフイベントテンプレート例: 健康なうちの家族旅行・体験",
    },
    {
      id: "home-renovation",
      name: "ライフイベント由来: 住まいの修繕",
      yearMonth: "2036-04",
      amount: 1_800_000,
      category: "housingCar",
      schedule: "once",
      inflationMode: "livingCost",
      note: "ライフイベントテンプレート例: 10年以内のリフォーム",
    },
    {
      id: "parent-care-support",
      name: "ライフイベント由来: 親の介護・支援",
      yearMonth: "2034-04",
      endYearMonth: "2038-03",
      amount: 360_000,
      category: "familySupport",
      schedule: "yearly",
      inflationMode: "livingCost",
      note: "ライフイベントテンプレート例: 親への支援・帰省費",
    },
  ],
  timeBucketItems: [
    {
      id: "todo-travel",
      title: "家族旅行・体験",
      bucketId: "todo",
      convertedSpecialExpenseId: "annual-family-travel",
    },
    {
      id: "todo-home",
      title: "住まいの修繕",
      bucketId: "todo",
      convertedSpecialExpenseId: "home-renovation",
    },
  ],
  assetContributionEvents: [
    {
      id: "nisa-continue",
      assetKey: "nisa",
      name: "将来の積立予定: NISA積立",
      startYearMonth: "2026-06",
      endYearMonth: "2041-03",
      monthlyAmount: 100_000,
      nisaInvestmentSlot: "tsumitate",
      contributionPriority: 1,
      carryOverSkipped: false,
      note: "入力練習用サンプルの将来積立予定です。初回設定を保存すると、入力値に置き換わります。",
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
    scenarioWith("early-retirement-60", "早期リタイア: 60歳で仕事をやめる", (scenario) => {
      scenario.description = "60歳で現在の仕事収入と積立を止めた場合の比較用サンプル。";
      for (const event of scenario.incomeEvents) {
        if (event.type === "salary") event.endYearMonth = "2036-03";
      }
      for (const event of scenario.assetContributionEvents) {
        event.endYearMonth = "2036-03";
      }
    }),
    scenarioWith("second-career", "セカンドキャリア: 60歳以降は月15万円", (scenario) => {
      scenario.description = "60歳以降は仕事量を減らし、月15万円の収入を続ける比較用サンプル。";
      for (const event of scenario.incomeEvents) {
        if (event.type === "salary") event.endYearMonth = "2036-03";
      }
      scenario.incomeEvents.push({
        id: "second-career-income",
        memberId: "member-self",
        name: "セカンドキャリア収入",
        type: "salary",
        startYearMonth: "2036-04",
        endYearMonth: "2046-03",
        monthlyAmount: 150_000,
        taxTreatment: "taxable",
      });
      for (const event of scenario.assetContributionEvents) {
        event.monthlyAmount = 50_000;
        event.endYearMonth = "2036-03";
      }
    }),
    scenarioWith("enjoyment-priority", "楽しみ優先: 55〜65歳の体験支出を増やす", (scenario) => {
      scenario.description = "健康なうちの家族旅行・趣味・学びを厚めに入れた比較用サンプル。";
      scenario.specialExpenses.push({
        id: "extra-family-experience",
        name: "追加の家族旅行・学び",
        yearMonth: "2031-04",
        endYearMonth: "2041-03",
        amount: 450_000,
        category: "enjoyment",
        schedule: "yearly",
        inflationMode: "livingCost",
        note: "楽しみ優先シナリオの追加体験支出",
      });
    }),
    scenarioWith("safety-first", "安全重視: 支出を抑えて残高を厚めに残す", (scenario) => {
      scenario.description = "生活費と楽しみ支出を少し抑え、90歳時点残高を厚めに残す比較用サンプル。";
      for (const key of Object.keys(scenario.monthlyExpenses) as (keyof typeof scenario.monthlyExpenses)[]) {
        scenario.monthlyExpenses[key] = Math.round(scenario.monthlyExpenses[key] * 0.9);
      }
      for (const event of scenario.specialExpenses) {
        if ((event.category ?? "lifeMaintenance") === "enjoyment") event.amount = Math.round(event.amount * 0.7);
      }
    }),
    scenarioWith("expense-low", "生活費を少し抑える", (scenario) => {
      for (const key of Object.keys(scenario.monthlyExpenses) as (keyof typeof scenario.monthlyExpenses)[]) {
        scenario.monthlyExpenses[key] = Math.round(scenario.monthlyExpenses[key] * 0.9);
      }
    }),
    scenarioWith("pension-earlier", "年金受給を早める", (scenario) => {
      const selfPension = scenario.incomeEvents.find((event) => event.id === "pension-self");
      const spousePension = scenario.incomeEvents.find((event) => event.id === "pension-spouse");
      if (selfPension) {
        selfPension.startYearMonth = "2036-04";
        selfPension.monthlyAmount = 136_000;
      }
      if (spousePension) {
        spousePension.startYearMonth = "2037-04";
        spousePension.monthlyAmount = 90_000;
      }
    }),
    scenarioWith("pension-later", "年金受給を遅らせる", (scenario) => {
      const selfPension = scenario.incomeEvents.find((event) => event.id === "pension-self");
      const spousePension = scenario.incomeEvents.find((event) => event.id === "pension-spouse");
      if (selfPension) {
        selfPension.startYearMonth = "2043-04";
        selfPension.monthlyAmount = 175_000;
      }
      if (spousePension) {
        spousePension.startYearMonth = "2044-04";
        spousePension.monthlyAmount = 117_000;
      }
    }),
    scenarioWith("stress-shortfall", "厳しめケース", (scenario) => {
      scenario.description = "比較用の厳しめサンプル。資産や収入が少ない場合の見え方を確認します。";
      scenario.initialAssets.bankDeposit = 8_000_000;
      scenario.initialAssets.nisa = 3_000_000;
      scenario.initialAssets.specificAccount = 1_000_000;
      for (const event of scenario.assetContributionEvents) {
        event.monthlyAmount = 30_000;
      }
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
