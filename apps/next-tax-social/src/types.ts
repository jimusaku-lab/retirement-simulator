export type YearMonth = string;

export type TaxCalculationMode = "manual" | "auto" | "autoWithAdjustment";

export type HouseholdRelationship = "self" | "spouse" | "child" | "parent" | "other";

export type HouseholdProfile = {
  municipality: string;
  headMemberId: string;
  taxCalculationMode: TaxCalculationMode;
  notes?: string;
};

export type HouseholdMember = {
  id: string;
  name: string;
  relationship: HouseholdRelationship;
  birthDate: string;
  isResident: boolean;
  isNationalHealthInsuranceMember: boolean;
  isLateElderlyMedicalMember: boolean;
  isLongTermCareInsured: boolean;
  isDependent: boolean;
  dependsOnMemberId?: string;
  notes?: string;
};

export type UserProfile = {
  birthDate: string;
  simulationStartYearMonth: YearMonth;
  simulationEndMode: "age" | "yearMonth";
  simulationEndAge?: number;
  simulationEndYearMonth?: YearMonth;
  targetBalanceAge: number;
  targetBalanceAmount?: number;
  plannedDrawdownEnabled?: boolean;
  cashReserve: number;
  municipality?: string;
  hasSpouse?: boolean;
  note?: string;
};

export type InitialAssets = {
  cash: number;
  bankDeposit: number;
  timeDeposit: number;
  nisa: number;
  specificAccount: number;
  ordinaryAccountForOptions: number;
  ideco: number;
  excludedAssets: number;
  debt: number;
};

export type InitialAssetCostBasis = {
  nisa: number;
  specificAccount: number;
  ordinaryAccountForOptions: number;
  ideco: number;
};

export type GrowthAssetKey =
  | "cash"
  | "bankDeposit"
  | "timeDeposit"
  | "nisa"
  | "specificAccount"
  | "ordinaryAccountForOptions"
  | "ideco";

export type AssetWithdrawalBreakdown = Record<GrowthAssetKey, number>;

export type GainTrackedAssetKey = "nisa" | "specificAccount" | "ordinaryAccountForOptions" | "ideco";
export type WithdrawalAssetKey = "bankDeposit" | "timeDeposit" | "specificAccount" | "ordinaryAccountForOptions" | "ideco" | "nisa";
export type AssetTransferSourceKey = "cash" | "bankDeposit" | "timeDeposit";
export type AssetTransferTargetKey = Exclude<GrowthAssetKey, "cash">;

export type GainTrackedAssetMap = Record<GainTrackedAssetKey, number>;

export type MonthlyExpenseProfile = {
  food: number;
  dailyGoods: number;
  hobbyEntertainment: number;
  social: number;
  transportation: number;
  clothingBeauty: number;
  healthMedical: number;
  car: number;
  educationCulture: number;
  specialExpense: number;
  cashCard: number;
  utilities: number;
  communication: number;
  housing: number;
  taxSocialInsurance: number;
  insurance: number;
  other: number;
};

export type ExpenseAdjustmentTarget = "all" | keyof MonthlyExpenseProfile;

export type AgeExpenseAdjustment = {
  id: string;
  name: string;
  startAge: number;
  endAge?: number;
  target: ExpenseAdjustmentTarget;
  mode: "setAmount" | "multiplier";
  value: number;
  note?: string;
};

export type IncomeEventType =
  | "unemployment"
  | "pension"
  | "salary"
  | "investmentIncome"
  | "dividend"
  | "other"
  | "oneTime";

export type RetirementIncomeEventType =
  | "idecoLumpSum"
  | "companyRetirementAllowance"
  | "corporateDcLumpSum"
  | "dbLumpSum"
  | "otherRetirementAllowance";

export type RetirementIncomeEvent = {
  id: string;
  memberId: string;
  name: string;
  type: RetirementIncomeEventType;
  paymentYearMonth: YearMonth;
  grossAmount: number;
  serviceYears: number;
  serviceStartDate?: string;
  serviceEndDate?: string;
  alreadyReceived?: boolean;
  retirementIncomeDeductionUsed?: boolean;
  withholdingTaxPaid?: number;
  residentTaxMunicipalPaid?: number;
  residentTaxPrefecturalPaid?: number;
  note?: string;
};

export type IncomeEvent = {
  id: string;
  memberId: string;
  name: string;
  type: IncomeEventType;
  startYearMonth: YearMonth;
  endYearMonth?: YearMonth;
  monthlyAmount: number;
  amountInputMode?: "monthly" | "annual";
  taxTreatment?: "taxable" | "withholding" | "nonTaxable";
  sourceAssetKey?: GrowthAssetKey;
  sourceOptionSubAccountId?: string;
  sourceAssetPayoutMode?: "cash" | "retainInSourceAsset";
  idecoPensionPayoutMode?: "fixedMonthly" | "monexSchedule";
  idecoPensionYears?: 5 | 10 | 15 | 20;
  idecoPensionPaymentsPerYear?: 1 | 2 | 4 | 6;
  idecoLumpSumContributionYears?: number;
  idecoLumpSumTaxMode?: "retirementIncomeDeclaration" | "noDeclaration";
  note?: string;
};

export type AssetContributionEvent = {
  id: string;
  assetKey: GrowthAssetKey;
  name: string;
  startYearMonth: YearMonth;
  endYearMonth?: YearMonth;
  monthlyAmount: number;
  nisaInvestmentSlot?: "tsumitate" | "growth";
  contributionPriority?: number;
  carryOverSkipped?: boolean;
  note?: string;
};

export type AssetTransferEvent = {
  id: string;
  name: string;
  yearMonth: YearMonth;
  fromAssetKey: AssetTransferSourceKey;
  toAssetKey: AssetTransferTargetKey;
  toOptionSubAccountId?: string;
  amount: number;
  note?: string;
};

export type SpecialExpenseEvent = {
  id: string;
  name: string;
  yearMonth: YearMonth;
  amount: number;
  schedule?: "once" | "monthly" | "quarterly" | "semiannual" | "yearly" | "customInterval";
  repeatIntervalMonths?: number;
  endYearMonth?: YearMonth;
  note?: string;
};

export type TaxInsuranceByFiscalYear = {
  id: string;
  fiscalYear: number;
  residentTaxAnnual: number;
  incomeTaxAnnual: number;
  nationalHealthInsuranceAnnual: number;
  lateElderlyMedicalAnnual?: number;
  nationalPensionMonthly: number;
  nationalPensionAnnual?: number;
  nursingCareAnnual: number;
  otherPublicCostAnnual: number;
};

export type TaxDeductionByFiscalYear = {
  id: string;
  fiscalYear: number;
  memberId: string;
  socialInsuranceDeductionAnnual: number;
  medicalExpenseDeductionAnnual: number;
  note?: string;
};

export type GrowthSettings = {
  enabled: boolean;
  rates: Record<GrowthAssetKey, number>;
};

export type InflationSettings = {
  enabled: boolean;
  livingCostAnnualInflationRate: number;
  medicalAnnualInflationRate: number;
  pensionAnnualAdjustmentRate: number;
};

export type OptionAccountRules = {
  enabled: boolean;
  minimumBalance: number;
  targetBalance: number;
  protectFromWithdrawal: boolean;
  suspendIncomeWhenBelowMinimum: boolean;
  profitSweepEnabled: boolean;
  profitSweepDestination: "cash" | "bankDeposit";
  profitSweepTiming: "monthly" | "yearEnd";
  profitSweepMethod: "excessOverTarget" | "fixedAmount";
  fixedSweepAmount: number;
};

export type OptionSubAccount = {
  id: string;
  name: string;
  initialValue: number;
  initialCostBasis: number;
  startYearMonth?: YearMonth;
  endYearMonth?: YearMonth;
  enabled: boolean;
  minimumBalance: number;
  targetBalance: number;
  withdrawalPriority: number;
  protectFromWithdrawal: boolean;
  releaseProtectionAfterEnd: boolean;
  suspendIncomeWhenBelowMinimum: boolean;
  profitSweepEnabled: boolean;
  profitSweepDestination: "cash" | "bankDeposit";
  profitSweepTiming: "monthly" | "yearEnd";
  profitSweepMethod: "excessOverTarget" | "fixedAmount";
  fixedSweepAmount: number;
  note?: string;
};

export type NisaInvestmentRules = {
  annualLimit: number;
  lifetimeLimitPerInvestor: number;
  usedLifetimeLimitAtStart: number;
  investorCount: number;
  enforceAnnualLimit: boolean;
  protectDuringContribution: boolean;
  insufficientFundingMode: "skip" | "withdrawOtherAssets";
  carryOverSkippedWithinYear?: boolean;
  carryOverSkippedMode: "none" | "withinYear" | "acrossYears";
};

export type TaxableAccountSettings = {
  specificAccountWithholding: "withholding" | "noWithholding";
};

export type ScenarioData = {
  id: string;
  name: string;
  description?: string;
  compare: boolean;
  userProfile: UserProfile;
  householdProfile: HouseholdProfile;
  householdMembers: HouseholdMember[];
  initialAssets: InitialAssets;
  initialAssetCostBasis: InitialAssetCostBasis;
  monthlyExpenses: MonthlyExpenseProfile;
  ageExpenseAdjustments: AgeExpenseAdjustment[];
  incomeEvents: IncomeEvent[];
  retirementIncomeEvents?: RetirementIncomeEvent[];
  assetContributionEvents: AssetContributionEvent[];
  assetTransferEvents: AssetTransferEvent[];
  withdrawalOrder: WithdrawalAssetKey[];
  specialExpenses: SpecialExpenseEvent[];
  taxInsurance: TaxInsuranceByFiscalYear[];
  taxDeductionEvents: TaxDeductionByFiscalYear[];
  assetGrowthSettings: GrowthSettings;
  inflationSettings: InflationSettings;
  optionAccountRules: OptionAccountRules;
  optionSubAccounts: OptionSubAccount[];
  nisaInvestmentRules: NisaInvestmentRules;
  taxableAccountSettings: TaxableAccountSettings;
};

export type MonthlyResult = {
  yearMonth: YearMonth;
  ageYears: number;
  ageMonths: number;
  incomeTotal: number;
  retainedSourceAssetIncomeTotal: number;
  assetTransferTotal: number;
  optionProfitSweepTotal: number;
  optionIncomeSuspendedTotal: number;
  nisaContributionSkippedTotal: number;
  nisaAnnualLimitExceededTotal: number;
  nisaContributionTotal: number;
  nisaCumulativeInvestment: number;
  nisaRemainingLifetimeLimit: number;
  assetContributionTotal: number;
  assetContributionFundingGap: number;
  livingExpenseTotal: number;
  specialExpenseTotal: number;
  taxInsuranceTotal: number;
  capitalGainsTaxTotal: number;
  deferredCapitalGainsTaxTotal: number;
  declaredCapitalGainsIncomeTotal: number;
  idecoWithholdingTaxTotal: number;
  growthAmount: number;
  withdrawalAmount: number;
  plannedDrawdownTotal: number;
  cashReserveTopUpAmount: number;
  grossAssetWithdrawalAmount: number;
  sourceAssetIncomeWithdrawalAmount: number;
  deficitAssetWithdrawalAmount: number;
  withdrawalSourceBreakdown: AssetWithdrawalBreakdown;
  sourceAssetIncomeBreakdown: AssetWithdrawalBreakdown;
  deficitWithdrawalBreakdown: AssetWithdrawalBreakdown;
  netCashFlow: number;
  idecoFeeTotal: number;
  endingAssets: number;
  endingTrackedAssetBalances: GainTrackedAssetMap;
  endingTrackedAssetCostBasis: GainTrackedAssetMap;
  endingTrackedAssetUnrealizedGains: GainTrackedAssetMap;
};

export type AnnualResult = {
  year: number;
  ageYears: number;
  ageMonths: number;
  incomeTotal: number;
  retainedSourceAssetIncomeTotal: number;
  assetTransferTotal: number;
  optionProfitSweepTotal: number;
  optionIncomeSuspendedTotal: number;
  nisaContributionSkippedTotal: number;
  nisaAnnualLimitExceededTotal: number;
  nisaContributionTotal: number;
  nisaCumulativeInvestment: number;
  nisaRemainingLifetimeLimit: number;
  assetContributionTotal: number;
  assetContributionFundingGap: number;
  livingExpenseTotal: number;
  specialExpenseTotal: number;
  taxInsuranceTotal: number;
  capitalGainsTaxTotal: number;
  deferredCapitalGainsTaxTotal: number;
  declaredCapitalGainsIncomeTotal: number;
  idecoWithholdingTaxTotal: number;
  growthAmount: number;
  withdrawalAmount: number;
  plannedDrawdownTotal: number;
  cashReserveTopUpAmount: number;
  grossAssetWithdrawalAmount: number;
  sourceAssetIncomeWithdrawalAmount: number;
  deficitAssetWithdrawalAmount: number;
  withdrawalSourceBreakdown: AssetWithdrawalBreakdown;
  sourceAssetIncomeBreakdown: AssetWithdrawalBreakdown;
  deficitWithdrawalBreakdown: AssetWithdrawalBreakdown;
  netCashFlow: number;
  idecoFeeTotal: number;
  endingAssets: number;
  endingTrackedAssetBalances: GainTrackedAssetMap;
  endingTrackedAssetCostBasis: GainTrackedAssetMap;
  endingTrackedAssetUnrealizedGains: GainTrackedAssetMap;
};

export type SimulationResult = {
  scenarioId: string;
  monthly: MonthlyResult[];
  annual: AnnualResult[];
  depletionYearMonth?: YearMonth;
  depletionAgeYears?: number;
  depletionAgeMonths?: number;
  targetAgeBalance?: number;
  totalWithdrawal: number;
  averageMonthlyWithdrawal: number;
  averageAnnualDeficit: number;
  maxDeficitMonth?: MonthlyResult;
};

export type RetirementPlanSnapshot = {
  version: 1;
  activeScenarioId: string;
  scenarios: ScenarioData[];
  lastSavedAt?: string;
};

export type PlanBackup = {
  id: string;
  savedAt: string;
  label: string;
  state: RetirementPlanSnapshot;
};

export type RetirementPlanState = RetirementPlanSnapshot & {
  backups: PlanBackup[];
};
