import { ChangeEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Copy,
  Download,
  BookOpen,
  FileJson,
  Plus,
  RefreshCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormGrid } from "@/components/Field";
import { OnboardingWizard, applyOnboardingDraftToScenario, type OnboardingDraft } from "@/components/OnboardingWizard";
import { TimeBucketPlanner } from "@/components/TimeBucketPlanner";
import { NoticePaymentScheduleEditor } from "@/components/NoticePaymentScheduleEditor";
import { calculateAutoTaxDetails, calculateAutoTaxRows, getEffectiveTaxRows, type AutoTaxYearDetail } from "@/lib/taxEngine";
import {
  buildRetirementIncomeRecords,
  getIdecoLumpSumContributionYears,
  getRetirementFilingAdvice,
  getRetirementOverlapAdjustments,
  getRetirementOverlapWarnings,
  type RetirementOverlapAdjustment,
} from "@/lib/retirementIncome";
import { getTaxFilingAdvice, type TaxFilingAdvice } from "@/lib/taxFilingAdvice";
import {
  calculateAssetUseWaterfallRows,
  calculateSpecialExpenseCategoryTotals,
  calculateFlexibleFreeCashSummary,
  getAnnualFlexibleFreeCash,
  normalizeFlexibleFreeCashPeriod,
  type SpecialExpenseCategory,
  type FlexibleFreeCashPeriod,
} from "@/lib/flexibleFreeCash";
import {
  calculateAdditionalSpendingTrial,
  calculateAssetUseCategoryBreakdown,
  calculateEnjoymentShare,
  calculateIncomePowerDiagnostics,
  calculateOptionLiquidityAnalysis,
  calculateTargetBalanceAnalysis,
  findSpecialExpenseCategoryWarnings,
  type IncomePowerDiagnostics,
  type TargetBalanceStatus,
} from "@/lib/assetUseAnalysis";
import {
  getIdecoLumpSumEstimatedGrossAmount,
  getIdecoMonexEndYearMonth,
  getIdecoMonexEstimatedPerPayment,
  getIdecoMonexFirstPayoutYearMonth,
  isIdecoLumpSumCurrentBalanceMode,
} from "@/lib/incomeEvents";
import {
  applyIncomeEventAmountInput,
  describeIncomeEventAmountConversion,
  getIncomeEventInputAmount,
  type IncomeEventAmountInputMode,
} from "@/lib/incomeEventAmountInput";
import { syncLinkedIncomeEndYearMonths } from "@/lib/householdEvents";
import { inferMonthlyOptionIncomeFromScenarioName } from "@/lib/optionIncomeHints";
import { inferOptionSubAccountIdFromName, resolveOptionSubAccountId } from "@/lib/optionSubAccounts";
import { buildScenarioDiffSummary, formatScenarioDiffHeadline, type ScenarioDiffSummary } from "@/lib/scenarioDiff";
import { calculateLifetimeTotalExpenseSummary, formatLifetimeExpenseYen } from "@/lib/lifetimeExpense";
import {
  createDefaultHistoricalRollingRangeReturnModel,
  createDefaultHistoricalSinglePathReturnModel,
  getEffectiveReturnModel,
  getHistoricalCurrencyMode,
  getHistoricalReturnPresetId,
  getHistoricalReturnPresetLabel,
  getHistoricalSinglePathDataCoverage,
  getHistoricalReturnDatasetSummary,
  getRequiredHistoricalReturnMonths,
  historicalCurrencyModeLabels,
  historicalReturnAssetKeys,
  historicalReturnPresets,
  type HistoricalCurrencyMode,
  type HistoricalReturnPresetId,
} from "@/lib/assetReturnModel";
import {
  createHistoricalRollingBacktestFingerprint,
  estimateHistoricalRollingBacktestPaths,
  runHistoricalRollingBacktest,
  type HistoricalRollingBacktestEstimate,
  type HistoricalRollingBacktestResult,
} from "@/lib/historicalRollingBacktest";
import {
  getNextNoticePaymentMonthSummary,
  summarizeNoticePaymentsByPaymentYear,
  type NoticePaymentYearSummary,
} from "@/lib/taxSocialPaymentDisplay";
import {
  judgeWorkplaceSocialInsurance,
  type WorkplaceSocialInsuranceSettings,
  type WorkplaceSocialInsuranceJudgment,
} from "@/lib/spouseWorkstyleTaxSocial";
import {
  buildSpousePartIncomeEfficiencyRows,
  getDefaultSpousePartIncomeCompareYear,
  getSpousePartIncomeCompareYears,
  type SpousePartIncomeAggregationMode,
  type SpousePartIncomeEfficiencyRow,
} from "@/lib/spousePartIncomeEfficiency";
import {
  KAKYU_PENSION_STANDARD_AMOUNT,
  PENSION_STANDARD_CLAIM_AGE,
  defaultPensionClaimStartYearMonth,
  getPensionPlannerMembers,
  isPensionPlannerReplacingEvent,
  memberAgeAtEndOfMonth,
  memberAgeAtEndOfYear,
  mergePensionPlannerSettings,
  pensionClaimAgeFromStartYearMonth,
  pensionClaimMonthsFromStandardStart,
  pensionClaimRate,
  pensionClaimRateForStartYearMonth,
  pensionStandardStartYearMonth,
  yearMemberTurnsAge,
  yearMonthRangeForYear,
} from "@/lib/pensionPlanner";
import { cn, compactYen, downloadText, numberOrZero, yen } from "@/lib/utils";
import {
  getBaseMonthlyExpense,
  getSpecialExpenseAmountForMonth,
  getSimulationTargetAssets,
  getTotalAssets,
  isEventActive,
  isSpecialExpenseActive,
  simulateScenario,
} from "@/lib/simulation";
import { usePlanStore } from "@/store/usePlanStore";
import { createId } from "@/lib/id";
import type {
  AnnualResult,
  IncomeEvent,
  IncomeEventType,
  InitialAssetCostBasis,
  InitialAssets,
  MonthlyResult,
  MonthlyExpenseProfile,
  HouseholdMember,
  HouseholdProfile,
  HouseholdLivingArrangementEvent,
  PlanningGoal,
  RetirementPlanState,
  ScenarioData,
  SpecialExpenseEvent,
  TaxInsuranceByFiscalYear,
  TaxSocialPaymentCategory,
  TaxSocialPaymentScheduleItem,
  RecurringTaxSocialPaymentTemplate,
  YearMonth,
  GrowthAssetKey,
  PlanBackup,
  ExpenseAdjustmentTarget,
  AgeExpenseAdjustment,
  AssetTransferSourceKey,
  AssetTransferTargetKey,
  WithdrawalAssetKey,
  OptionSubAccount,
  RetirementIncomeEvent,
  PensionPlannerSettings,
  RealizedGainDetail,
} from "@/types";

const tabs = [
  { key: "profile", label: "基本情報", group: "input" },
  { key: "assets", label: "初期資産", group: "input" },
  { key: "expenses", label: "生活費", group: "input" },
  { key: "income", label: "収入", group: "input" },
  { key: "tax", label: "税・社会保険", group: "hybrid" },
  { key: "special", label: "特別支出", group: "input" },
  { key: "results", label: "結果", group: "output" },
  { key: "compare", label: "比較", group: "output" },
  { key: "scenarios", label: "シナリオ", group: "management" },
  { key: "data", label: "データ", group: "management" },
] as const;

const inputTabLabels: Record<Exclude<TabKey, "dashboard" | "manual" | "results" | "compare" | "data">, string> = {
  profile: "基本情報",
  assets: "初期資産",
  expenses: "生活費",
  income: "収入",
  tax: "税・社会保険",
  special: "特別支出",
  scenarios: "シナリオ",
};

type TabKey = "dashboard" | "manual" | (typeof tabs)[number]["key"];
type TabGroup = (typeof tabs)[number]["group"];
type AppMode = "safety" | "assetUse";
type AssetUseTab = "timeBucket" | "quickTrial" | "review" | "incomePower";
type PrimaryNavKey = "dashboard" | "safety" | "assetUse" | "results" | "compare" | "data";
type InputCardPriority = "required" | "recommended" | "detail" | "expert";
type InputCardStatus = "not_started" | "incomplete" | "complete" | "review_recommended" | "reviewed" | "not_applicable" | "inactive";
type InputCardVisibility = "always" | "summary" | "collapsed" | "hidden";
type InputCardHighlight = "none" | "current" | "next_required" | "review" | "blocked" | "targeted";
type InputCardId =
  | "profile-family-period"
  | "assets-current"
  | "assets-cost-basis"
  | "expenses-monthly"
  | "income-pension"
  | "income-ideco"
  | "income-ideco-lump"
  | "tax-mode"
  | "tax-retirement-overlap"
  | "special-expenses";
type InputCardDefinition = {
  id: InputCardId;
  title: string;
  priority: InputCardPriority;
  status: InputCardStatus;
  visibility: InputCardVisibility;
  highlight: InputCardHighlight;
  summary: string;
  missingItems: string[];
  tab: Exclude<TabKey, "dashboard" | "manual" | "results" | "compare" | "data">;
  nextCardId?: InputCardId;
};
type ExpenseKey = keyof MonthlyExpenseProfile;
type AssetKey = keyof InitialAssets;
type HouseholdRelationship = HouseholdMember["relationship"];

const RESIDENT_TAX_BASIC_DEDUCTION_FOR_DISPLAY = 430_000;
const RESIDENT_TAX_RATE_FOR_DISPLAY = 0.1;
const RESIDENT_TAX_FLAT_FOR_DISPLAY = 5_000;
const DECLARED_OPTION_INCOME_TAX_RATE_FOR_DISPLAY = 0.15315;
const DECLARED_OPTION_RESIDENT_TAX_RATE_FOR_DISPLAY = 0.05;
const OTA_NHI_RATES_FOR_DISPLAY = {
  baseIncomeDeduction: 430_000,
  medicalIncomeRate: 0.0751,
  medicalPerCapita: 47_600,
  medicalCap: 670_000,
  supportIncomeRate: 0.028,
  supportPerCapita: 17_600,
  supportCap: 260_000,
  childSupportIncomeRate: 0.0027,
  childSupportPerCapita: 1_873,
  childSupportCap: 30_000,
  careIncomeRate: 0.0243,
  carePerCapita: 17_800,
  careCap: 170_000,
};
const ONBOARDING_COMPLETED_KEY = "retirement-life-planner-public-onboarding-completed-v2";
const TRUST_EXPLAINED_KEY = "retirement-life-planner-public-trust-explained-v1";
const TOKYO_LATE_ELDERLY_MEDICAL_FOR_DISPLAY = {
  medicalIncomeRate: 0.0988,
  medicalPerCapita: 53_300,
  medicalCap: 850_000,
  childSupportIncomeRate: 0.0026,
  childSupportPerCapita: 1_300,
  childSupportCap: 21_000,
};
const TAX_SOCIAL_SENSITIVITY_STEPS = [0, 500_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000];
const PENSION_PLANNER_COMPARE_AGES = [60, 62, 65, 68, 70, 75];
const specialExpenseCategoryLabels: Record<SpecialExpenseCategory, string> = {
  enjoyment: "楽しみ",
  lifeMaintenance: "生活維持",
  housingCar: "住宅・車",
  medicalCare: "医療・介護",
  familySupport: "家族支援",
};
const planningGoalLabels: Record<PlanningGoal, string> = {
  assetAtMilestone: "60歳・65歳時点資産",
  earlyRetirement: "早期リタイア",
  reducedWork: "仕事を減らす・セカンドキャリア",
  lifeEvents: "教育費・住宅ローン・親の介護",
  enjoymentBudget: "家族旅行・趣味・学び",
  pensionAndRetirementBenefits: "年金・iDeCo・退職金",
};
const lifeEventNoteMarker = "ライフイベント由来";

const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);

const targetBalanceStatusLabels: Record<TargetBalanceStatus, string> = {
  surplus: "達成",
  onTarget: "目標一致",
  shortfall: "目標割れ",
};

const targetBalanceStatusClassNames: Record<TargetBalanceStatus, string> = {
  surplus: "text-teal-700",
  onTarget: "text-slate-700",
  shortfall: "text-destructive",
};

const primaryNavClassNames = {
  dashboardActive: "border border-sky-700 bg-sky-700 text-white shadow-sm hover:bg-sky-800",
  dashboardInactive: "border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100",
  safetyActive: "border border-teal-800 bg-teal-800 text-white shadow-sm hover:bg-teal-900",
  safetyInactive: "border border-teal-700 bg-teal-700 text-white shadow-sm hover:bg-teal-800",
  assetActive: "border border-indigo-800 bg-indigo-800 text-white shadow-sm hover:bg-indigo-900",
  assetInactive: "border border-indigo-700 bg-indigo-700 text-white shadow-sm hover:bg-indigo-800",
};

const tabGroupClassNames: Record<TabGroup, { active: string; inactive: string }> = {
  input: {
    active: "border border-emerald-400 bg-emerald-100 text-emerald-950 shadow-sm hover:bg-emerald-100",
    inactive: "border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
  },
  output: {
    active: "border border-sky-400 bg-sky-100 text-sky-950 shadow-sm hover:bg-sky-100",
    inactive: "border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100",
  },
  hybrid: {
    active: "border border-amber-400 bg-amber-100 text-amber-950 shadow-sm hover:bg-amber-100",
    inactive: "border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
  },
  management: {
    active: "border border-violet-400 bg-violet-100 text-violet-950 shadow-sm hover:bg-violet-100",
    inactive: "border border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100",
  },
};

const enjoymentNavClassNames = {
  active: "border border-rose-400 bg-rose-100 text-rose-950 shadow-sm hover:bg-rose-100",
  inactive: "border border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100",
};

const primarySectionClassNames: Record<PrimaryNavKey, { active: string; inactive: string }> = {
  dashboard: {
    active: primaryNavClassNames.dashboardActive,
    inactive: primaryNavClassNames.dashboardInactive,
  },
  safety: {
    active: primaryNavClassNames.safetyActive,
    inactive: "border border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100",
  },
  assetUse: {
    active: primaryNavClassNames.assetActive,
    inactive: "border border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100",
  },
  results: {
    active: "border border-sky-700 bg-sky-700 text-white shadow-sm hover:bg-sky-800",
    inactive: "border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100",
  },
  compare: {
    active: "border border-violet-700 bg-violet-700 text-white shadow-sm hover:bg-violet-800",
    inactive: "border border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100",
  },
  data: {
    active: "border border-slate-700 bg-slate-700 text-white shadow-sm hover:bg-slate-800",
    inactive: "border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100",
  },
};

const assetUseTabLabels: Record<AssetUseTab, string> = {
  timeBucket: "タイムバケット",
  quickTrial: "クイック試算",
  review: "資産レビュー",
  incomePower: "入金力診断",
};

function appModeFromHash(): AppMode {
  return window.location.hash === "#/asset-use" ? "assetUse" : "safety";
}

function setAppModeHash(mode: AppMode) {
  const nextHash = mode === "assetUse" ? "#/asset-use" : "";
  if (window.location.hash === nextHash) return;
  window.location.hash = nextHash;
}

function declaredOptionTaxBreakdownForDisplay(declaredGain: number) {
  const taxableGain = Math.max(0, declaredGain);
  const incomeTaxEquivalent = Math.round(taxableGain * DECLARED_OPTION_INCOME_TAX_RATE_FOR_DISPLAY);
  const residentTaxEquivalent = Math.round(taxableGain * DECLARED_OPTION_RESIDENT_TAX_RATE_FOR_DISPLAY);
  return {
    taxableGain,
    incomeTaxEquivalent,
    residentTaxEquivalent,
    totalEquivalent: incomeTaxEquivalent + residentTaxEquivalent,
  };
}

function incomeTaxFormulaLabel(taxableIncome: number) {
  if (taxableIncome <= 0) return "課税ベース0円のため0円";
  if (taxableIncome <= 1_949_000) return "課税ベース × 5% × 復興特別税1.021";
  if (taxableIncome <= 3_299_000) return "(課税ベース × 10% - 97,500円) × 1.021";
  if (taxableIncome <= 6_949_000) return "(課税ベース × 20% - 427,500円) × 1.021";
  if (taxableIncome <= 8_999_000) return "(課税ベース × 23% - 636,000円) × 1.021";
  if (taxableIncome <= 17_999_000) return "(課税ベース × 33% - 1,536,000円) × 1.021";
  if (taxableIncome <= 39_999_000) return "(課税ベース × 40% - 2,796,000円) × 1.021";
  return "(課税ベース × 45% - 4,796,000円) × 1.021";
}

function residentTaxFormulaLabel(taxableIncome: number) {
  if (taxableIncome <= 0) return "課税ベース0円のため0円";
  return `課税ベース × ${(RESIDENT_TAX_RATE_FOR_DISPLAY * 100).toFixed(0)}% + 均等割 ${yen(RESIDENT_TAX_FLAT_FOR_DISPLAY)}`;
}

function incomeTaxFormulaSubstitution(taxableIncome: number, tax: number) {
  if (taxableIncome <= 0) {
    return ["所得税", "= 0円", "= 課税所得が0円のため0円"];
  }
  const band =
    taxableIncome <= 1_949_000
      ? { rate: 0.05, deduction: 0 }
      : taxableIncome <= 3_299_000
        ? { rate: 0.1, deduction: 97_500 }
        : taxableIncome <= 6_949_000
          ? { rate: 0.2, deduction: 427_500 }
          : taxableIncome <= 8_999_000
            ? { rate: 0.23, deduction: 636_000 }
            : taxableIncome <= 17_999_000
              ? { rate: 0.33, deduction: 1_536_000 }
              : taxableIncome <= 39_999_000
                ? { rate: 0.4, deduction: 2_796_000 }
                : { rate: 0.45, deduction: 4_796_000 };
  return [
    "所得税",
    "= (課税所得 × 税率 - 控除額) × 復興特別所得税係数",
    `= (${yen(taxableIncome)} × ${(band.rate * 100).toFixed(0)}% - ${yen(band.deduction)}) × 1.021`,
    `= ${yen(tax)}`,
  ];
}

function residentTaxFormulaSubstitution(taxableIncome: number, tax: number) {
  if (taxableIncome <= 0) {
    return ["住民税", "= 0円", "= 課税所得が0円のため0円"];
  }
  return [
    "住民税",
    "= 課税所得 × 税率 + 均等割",
    `= ${yen(taxableIncome)} × ${(RESIDENT_TAX_RATE_FOR_DISPLAY * 100).toFixed(0)}% + ${yen(RESIDENT_TAX_FLAT_FOR_DISPLAY)}`,
    `= ${yen(tax)}`,
  ];
}

function yearEndAgeLabel(year: number, ageYears: number) {
  return `${year} / 年末${ageYears}歳`;
}

function yearEndAgeValue(ageYears: number | undefined) {
  return typeof ageYears === "number" ? `年末${ageYears}歳` : "-";
}

function taxYearEndAgeLabel(ageYears: number) {
  return `12月31日時点 ${ageYears}歳`;
}

function zeroFloorLine(label: string, amount: number) {
  return amount < 0 ? `${label}はマイナスのため0円として扱います` : `${label}はプラスのためそのまま使います`;
}

function personMonthLabel(personYears: number) {
  const months = Math.round(personYears * 12);
  if (months <= 0) return "0か月分";
  if (months === 12) return "12か月分（1人が通年加入）";
  return `${months}か月分（月割り人数 ${personYears.toFixed(2)}人）`;
}

function capSelectionLines(label: string, calculatedAmount: number, cap: number, result: number) {
  return [
    `${label}は、計算額と上限額を比べて低い方を採用します`,
    `計算額 = ${yen(calculatedAmount)}`,
    `上限額 = ${yen(cap)}`,
    calculatedAmount > cap ? `計算額が上限を超えるため、採用額 = ${yen(result)}` : `計算額が上限以下のため、採用額 = ${yen(result)}`,
  ];
}

function autoTaxDetailTotal(detail: AutoTaxYearDetail) {
  const incomeTax = detail.memberDetails.reduce((sum, member) => sum + member.incomeTaxAnnual + member.retirementIncomeTaxAnnual, 0);
  const residentTax = detail.memberDetails.reduce((sum, member) => sum + member.residentTaxAnnual + member.retirementResidentTaxAnnual, 0);
  const nationalPension = detail.memberDetails.reduce((sum, member) => sum + member.nationalPensionAnnual, 0);
  return {
    incomeTax,
    residentTax,
    nationalPension,
    nationalHealthInsurance: detail.nationalHealthInsuranceAnnual,
    lateElderlyMedical: detail.lateElderlyMedicalAnnual,
    nursingCare: detail.nursingCareAnnual,
    otherPublicCost: detail.otherPublicCostAnnual,
    total:
      incomeTax +
      residentTax +
      nationalPension +
      detail.nationalHealthInsuranceAnnual +
      detail.lateElderlyMedicalAnnual +
      detail.nursingCareAnnual +
      detail.otherPublicCostAnnual,
  };
}

const expenseLabels: Record<ExpenseKey, string> = {
  food: "食費",
  dailyGoods: "日用品",
  hobbyEntertainment: "趣味・娯楽",
  social: "交際費",
  transportation: "交通費",
  clothingBeauty: "衣服・美容",
  healthMedical: "健康・医療",
  car: "自動車",
  educationCulture: "教養・教育",
  specialExpense: "特別支出",
  cashCard: "現金・カード",
  utilities: "水道・光熱費",
  communication: "通信費",
  housing: "住居",
  taxSocialInsurance: "税・社会保険",
  insurance: "保険",
  other: "その他",
};

const defaultHouseholdLivingExpenseKeys: ExpenseKey[] = ["food", "dailyGoods", "utilities", "communication", "transportation"];

const assetLabels: Record<AssetKey, string> = {
  cash: "現金",
  bankDeposit: "普通預金",
  timeDeposit: "定期預金",
  nisa: "NISA非課税口座",
  specificAccount: "特定口座",
  ordinaryAccountForOptions: "一般口座（オプション用）",
  ideco: "iDeCo",
  excludedAssets: "取り崩し対象外資産",
  debt: "負債残高",
};

const liquidAssetKeys = ["cash", "bankDeposit", "timeDeposit", "excludedAssets", "debt"] as const satisfies AssetKey[];
const marketAssetKeys = ["nisa", "specificAccount", "ideco"] as const satisfies AssetKey[];
const costBasisKeys = ["nisa", "specificAccount", "ordinaryAccountForOptions", "ideco"] as const satisfies (keyof InitialAssetCostBasis)[];

const gainTrackedAssets = [
  { key: "nisa", label: "NISA非課税口座" },
  { key: "specificAccount", label: "特定口座" },
  { key: "ordinaryAccountForOptions", label: "一般口座（オプション用）" },
  { key: "ideco", label: "iDeCo" },
] as const;

const growthAssetLabels: Record<GrowthAssetKey, string> = {
  cash: "現金",
  bankDeposit: "普通預金",
  timeDeposit: "定期預金",
  nisa: "NISA非課税口座",
  specificAccount: "特定口座",
  ordinaryAccountForOptions: "一般口座（オプション用）",
  ideco: "iDeCo",
};

const incomeTypeLabels: Record<IncomeEventType, string> = {
  unemployment: "失業手当",
  pension: "年金",
  salary: "就労収入",
  investmentIncome: "投資由来の定期入金",
  dividend: "配当・利息",
  other: "その他",
  oneTime: "一時金・単発入金",
};

const incomeTypeOptionOrder: IncomeEventType[] = ["unemployment", "pension", "salary", "investmentIncome", "dividend", "other", "oneTime"];
const idecoIncomeTypeOptionOrder: IncomeEventType[] = ["pension", "oneTime"];

function isIdecoIncomeType(type: IncomeEventType) {
  return type === "pension" || type === "oneTime";
}

function getIncomeTypeSelectOptions(sourceAssetKey: GrowthAssetKey | undefined, currentType: IncomeEventType) {
  if (sourceAssetKey === "ideco") return idecoIncomeTypeOptionOrder;
  const options = incomeTypeOptionOrder;
  return options.includes(currentType) ? options : [currentType, ...options];
}

function getIncomeTypeSelectLabel(type: IncomeEventType, sourceAssetKey: GrowthAssetKey | undefined) {
  if (sourceAssetKey === "ideco") {
    if (type === "pension") return "iDeCo年金受取（雑所得）";
    if (type === "oneTime") return "iDeCo一時金（一括受取・退職所得）";
  }
  return incomeTypeLabels[type];
}

function incomeAmountInputLabel(mode: IncomeEventAmountInputMode) {
  if (mode === "annual") return "金額（年額）";
  if (mode === "periodTotal") return "金額（期間合計）";
  return "金額（月額）";
}

function incomeAmountConversionText(event: IncomeEvent) {
  const conversion = describeIncomeEventAmountConversion(event);
  if (conversion.warning) return conversion.warning;
  if (conversion.mode === "annual") return `月額換算 ${yen(conversion.monthlyEquivalent)}`;
  if (conversion.mode === "periodTotal") {
    return `対象期間 ${event.startYearMonth}〜${event.endYearMonth} / ${conversion.periodMonths}か月、月額換算 約${yen(conversion.monthlyEquivalent)}`;
  }
  return `年換算 ${yen(conversion.annualEquivalent)}`;
}

function applyIncomeEventCurrentAmountInput(event: IncomeEvent) {
  const mode = event.amountInputMode ?? "monthly";
  applyIncomeEventAmountInput(event, mode, getIncomeEventInputAmount(event));
}

const editableGrowthAssetKeys: GrowthAssetKey[] = [
  "timeDeposit",
  "nisa",
  "specificAccount",
  "ordinaryAccountForOptions",
  "ideco",
];
const historicalReturnDataset = getHistoricalReturnDatasetSummary();
const defaultHistoricalStartYearMonth = "2000-01";

const assetTransferSourceLabels: Record<AssetTransferSourceKey, string> = {
  cash: "現金",
  bankDeposit: "普通預金",
  timeDeposit: "定期預金",
};

const assetTransferTargetLabels: Record<AssetTransferTargetKey, string> = {
  bankDeposit: "普通預金",
  timeDeposit: "定期預金",
  nisa: "NISA非課税口座",
  specificAccount: "特定口座",
  ordinaryAccountForOptions: "一般口座（オプション用）",
  ideco: "iDeCo",
};

const withdrawalOrderLabels: Record<WithdrawalAssetKey, string> = {
  bankDeposit: "普通預金",
  timeDeposit: "定期預金",
  specificAccount: "特定口座",
  ordinaryAccountForOptions: "一般口座（オプション用）",
  ideco: "iDeCo",
  nisa: "NISA非課税口座",
};

const relationshipLabels: Record<HouseholdRelationship, string> = {
  self: "本人",
  spouse: "配偶者",
  child: "子",
  parent: "親",
  other: "その他",
};

const taxModeHelp: Record<HouseholdProfile["taxCalculationMode"], { label: string; description: string }> = {
  manual: {
    label: "手入力",
    description: "税・社会保険タブに入れた金額だけを使います。通知書や確定値がある場合向けです。",
  },
  auto: {
    label: "自動計算",
    description: "世帯情報と収入から概算します。通常はこれを選べば十分です。",
  },
  autoWithAdjustment: {
    label: "自動計算 + 補正",
    description: "自動計算をベースに、税・社会保険タブで差額だけ上乗せします。",
  },
};

function shouldIgnoreTaxExpenseField(scenario: ScenarioData) {
  return getEffectiveTaxRows(scenario).length > 0;
}

function App() {
  const [appMode, setAppMode] = useState<AppMode>(() => appModeFromHash());
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [assetUseTab, setAssetUseTab] = useState<AssetUseTab>("timeBucket");
  const [showOnboarding, setShowOnboarding] = useState(() => window.localStorage.getItem(ONBOARDING_COMPLETED_KEY) !== "true");
  const [showDataTrustModal, setShowDataTrustModal] = useState(() => window.localStorage.getItem(TRUST_EXPLAINED_KEY) !== "true");
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [trustNoticeCollapsed, setTrustNoticeCollapsed] = useState(false);
  const [trustNoticeExpandCount, setTrustNoticeExpandCount] = useState(0);
  const [targetedInputCardId, setTargetedInputCardId] = useState<InputCardId | null>(null);
  const [spouseWorkstyleHighlightKey, setSpouseWorkstyleHighlightKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    scenarios,
    activeScenarioId,
    baselineScenarioId,
    setActiveScenario,
    setBaselineScenario,
    updateActiveScenario,
    updateScenarios,
    duplicateScenario,
    deleteScenario,
    moveScenario,
    toggleScenarioCompare,
    replaceState,
    resetToSample,
    clearLocalData,
    lastSavedAt,
    backups,
    createBackup,
    restoreBackup,
    deleteBackup,
  } = usePlanStore();

  const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0];
  const baselineScenario = scenarios.find((scenario) => scenario.id === baselineScenarioId) ?? scenarios.find((scenario) => scenario.compare) ?? scenarios[0];
  const deferredScenarios = useDeferredValue(scenarios);
  const result = useMemo(() => simulateScenario(activeScenario), [activeScenario]);
  const inputCards = useMemo(() => buildInputCards(activeScenario), [activeScenario]);
  const allResults = useMemo(
    () => {
      if (activeTab !== "compare") return [];
      const compareScenarios = deferredScenarios.filter((scenario) => scenario.compare);
      const scenariosForCompare = compareScenarios.some((scenario) => scenario.id === baselineScenario.id)
        ? compareScenarios
        : [baselineScenario, ...compareScenarios];
      return scenariosForCompare.map((scenario) => ({ scenario, result: simulateScenario(scenario) }));
    },
    [activeTab, baselineScenario, deferredScenarios],
  );
  useEffect(() => {
    if (!baselineScenario || baselineScenario.id === baselineScenarioId) return;
    setBaselineScenario(baselineScenario.id);
  }, [baselineScenario, baselineScenarioId, setBaselineScenario]);

  useEffect(() => {
    const syncAppMode = () => setAppMode(appModeFromHash());
    window.addEventListener("hashchange", syncAppMode);
    return () => window.removeEventListener("hashchange", syncAppMode);
  }, []);

  useEffect(() => {
    if (!restoreMessage) return undefined;
    const timer = window.setTimeout(() => setRestoreMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [restoreMessage]);

  useEffect(() => {
    if (activeTab === "manual") {
      setTrustNoticeCollapsed(false);
      return undefined;
    }
    setTrustNoticeCollapsed(false);
    const collapseDelay = trustNoticeExpandCount > 0 ? 10_000 : 5_000;
    const timer = window.setTimeout(() => setTrustNoticeCollapsed(true), collapseDelay);
    return () => window.clearTimeout(timer);
  }, [activeTab, appMode, trustNoticeExpandCount]);

  const updateScenario = (updater: (scenario: ScenarioData) => void) => {
    updateActiveScenario((scenario) => {
      updater(scenario);
      syncLinkedIncomeEndYearMonths(scenario);
      return scenario;
    });
  };

  const completeOnboarding = (draft: OnboardingDraft) => {
    updateScenario((scenario) => applyOnboardingDraftToScenario(scenario, draft));
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
    setAppModeHash("safety");
    setActiveTab("dashboard");
    setRestoreMessage("初回設定を反映しました。詳細条件は入力タブや税金・社会保険タブから後で調整できます。");
  };

  const closeOnboarding = () => {
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
    setShowOnboarding(false);
  };

  const closeDataTrustModal = () => {
    window.localStorage.setItem(TRUST_EXPLAINED_KEY, "true");
    setShowDataTrustModal(false);
    if (window.localStorage.getItem(ONBOARDING_COMPLETED_KEY) !== "true") {
      setShowOnboarding(true);
    }
  };

  useEffect(() => {
    if (!targetedInputCardId) return undefined;
    const timer = window.setTimeout(() => setTargetedInputCardId(null), 4500);
    return () => window.clearTimeout(timer);
  }, [targetedInputCardId]);

  const confirmJsonFileHandling = (actionLabel: string) =>
    window.confirm(
      `${actionLabel}します。保存用ファイルには入力した家計・資産・年金情報が含まれます。共有や送付をする場合は、内容を確認してから扱ってください。続けますか？`,
    );

  const exportJson = () => {
    if (!confirmJsonFileHandling("保存用ファイル出力")) return;
    const state: RetirementPlanState = { version: 1, activeScenarioId, baselineScenarioId, scenarios, lastSavedAt, backups };
    downloadText("retirement-life-plan-public.json", JSON.stringify(state, null, 2));
  };

  const createBackupAndExport = () => {
    if (!confirmJsonFileHandling("保存用バックアップ作成")) return;
    const savedAt = new Date().toISOString();
    createBackup("保存用ファイル出力時バックアップ");
    const state: RetirementPlanState = { version: 1, activeScenarioId, baselineScenarioId, scenarios, lastSavedAt: savedAt, backups };
    const timestamp = savedAt.replaceAll(":", "").slice(0, 15);
    downloadText(`retirement-life-plan-backup-${timestamp}.json`, JSON.stringify(state, null, 2));
  };

  const exportCsv = () => {
    const rows = [
      [
        "年月",
        "月末年齢",
        "現金収入",
        "口座内積上",
        "原資移動",
        "一般口座から流動資金へ",
        "一般口座終了戻し",
        "証拠金不足停止",
        "NISA未実行",
        "NISA枠超過",
        "追加投資",
        "生活費",
        "特別支出",
        "税社会保険支払",
        "iDeCo源泉",
        "運用益",
        "取り崩し",
        "月末資産",
      ],
      ...result.monthly.map((row) => [
        row.yearMonth,
        `${row.ageYears}歳${row.ageMonths}か月`,
        row.incomeTotal,
        row.retainedSourceAssetIncomeTotal,
        row.assetTransferTotal,
        row.optionProfitSweepTotal + row.optionAccountReleaseTotal,
        row.optionAccountReleaseTotal,
        row.optionIncomeSuspendedTotal,
        row.nisaContributionSkippedTotal,
        row.nisaAnnualLimitExceededTotal,
        row.assetContributionTotal,
        row.livingExpenseTotal,
        row.specialExpenseTotal,
        row.taxInsuranceTotal + row.capitalGainsTaxTotal,
        row.idecoWithholdingTaxTotal,
        row.growthAmount,
        row.withdrawalAmount,
        row.endingAssets,
      ]),
    ];
    downloadText("monthly-results.csv", rows.map((row) => row.join(",")).join("\n"), "text/csv;charset=utf-8");
  };

  const openJsonImportDialog = () => {
    if (!fileInputRef.current) return;
    if (!window.confirm("保存用ファイルを読み込むと、このブラウザに保存されている現在の入力内容が置き換わります。読み込み前の状態は履歴に残します。続けますか？")) {
      return;
    }
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const clearBrowserData = () => {
    const firstConfirm = window.confirm(
      "この端末で保存した入力データと履歴バックアップを削除し、初期サンプルに戻します。すでに作成した保存用ファイルは削除されません。続けますか？",
    );
    if (!firstConfirm) return;
    const secondConfirm = window.confirm("削除後は、この端末内の履歴からは元に戻せません。本当に削除しますか？");
    if (!secondConfirm) return;
    clearLocalData();
    window.localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    window.localStorage.removeItem(TRUST_EXPLAINED_KEY);
    setShowOnboarding(true);
    setShowDataTrustModal(true);
    setAppModeHash("safety");
    setActiveTab("dashboard");
    setRestoreMessage("この端末で保存した入力データと履歴バックアップを削除し、初期サンプルに戻しました。");
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const importedState =
        typeof parsed === "object" && parsed !== null && "state" in parsed
          ? ((parsed as { state?: unknown }).state as RetirementPlanState)
          : (parsed as RetirementPlanState);
      if (importedState.version !== 1 || !Array.isArray(importedState.scenarios) || importedState.scenarios.length === 0) {
        throw new Error("未対応の保存用ファイル形式です。");
      }
      replaceState(importedState);
      setActiveTab("dashboard");
      setRestoreMessage(`保存用ファイルを読み込みました: ${importedState.scenarios.length}件 / ${importedState.scenarios[0]?.name ?? "シナリオ"}`);
    } catch (error) {
      setRestoreMessage(error instanceof Error ? `保存用ファイルの読み込みに失敗しました: ${error.message}` : "保存用ファイルの読み込みに失敗しました。");
    } finally {
      event.target.value = "";
    }
  };

  const openFlexibleFreeCashSettings = () => {
    setAppModeHash("safety");
    setActiveTab("profile");
    window.setTimeout(() => {
      document.getElementById("asset-use-period-settings")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const safetySubTabs = tabs.filter((tab) => !["results", "compare", "data"].includes(tab.key));
  const safetySubTabKeys = new Set<TabKey>(safetySubTabs.map((tab) => tab.key));
  const activePrimaryNav: PrimaryNavKey =
    appMode === "assetUse"
      ? "assetUse"
      : activeTab === "dashboard"
        ? "dashboard"
        : activeTab === "results"
          ? "results"
          : activeTab === "compare"
            ? "compare"
            : activeTab === "data"
              ? "data"
              : "safety";
  const primaryNavClass = (key: PrimaryNavKey) =>
    `shrink-0 ${activePrimaryNav === key ? primarySectionClassNames[key].active : primarySectionClassNames[key].inactive}`;
  const openSafetyNav = () => {
    setAppModeHash("safety");
    if (!safetySubTabKeys.has(activeTab)) setActiveTab("profile");
  };
  const openInputCard = (cardId: InputCardId) => {
    const card = inputCards.find((item) => item.id === cardId);
    if (!card) return;
    setAppModeHash("safety");
    setActiveTab(card.tab);
    setTargetedInputCardId(card.id);
    window.setTimeout(() => {
      const target = document.getElementById(card.id);
      const focusTarget =
        document.querySelector<HTMLElement>(`[data-input-focus-id="${card.id}"]`) ??
        target?.querySelector<HTMLElement>("select, input, textarea, button");
      const scrollTarget = focusTarget?.closest<HTMLElement>(`[data-input-card-id="${card.id}"]`) ?? target;
      scrollTarget?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        focusTarget?.focus({ preventScroll: true });
      }, 180);
    }, 120);
  };
  const openInputGuideSummary = () => {
    setAppModeHash("safety");
    if (!safetySubTabKeys.has(activeTab)) setActiveTab("profile");
    window.setTimeout(() => {
      document.getElementById("input-guidance-summary")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };
  const openTaxCashPaymentTiming = () => {
    setAppModeHash("safety");
    setActiveTab("results");
    window.setTimeout(() => {
      const detail = document.getElementById("results-diagnostics-details") as HTMLDetailsElement | null;
      if (detail && !detail.open) {
        detail.open = true;
        detail.dispatchEvent(new Event("toggle"));
      }
      window.setTimeout(() => {
        document.getElementById("tax-cash-payment-timing")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    }, 120);
  };
  const openSpouseIncomeEvents = () => {
    openInputCard("income-pension");
  };
  const openSpousePartIncomeCompare = () => {
    setAppModeHash("safety");
    setActiveTab("compare");
    window.setTimeout(() => {
      const detail = document.getElementById("spouse-part-income-efficiency-compare") as HTMLDetailsElement | null;
      if (detail && !detail.open) {
        detail.open = true;
        detail.dispatchEvent(new Event("toggle", { bubbles: true }));
      }
      document.getElementById("spouse-part-income-efficiency-compare")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };
  const openSpouseWorkstyleSettings = (scenarioId: string) => {
    if (scenarioId && scenarioId !== activeScenarioId) setActiveScenario(scenarioId);
    setAppModeHash("safety");
    setActiveTab("tax");
    setSpouseWorkstyleHighlightKey((current) => current + 1);
    window.setTimeout(() => {
      document.getElementById("spouse-workstyle-tax-social-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 160);
  };
  const nextInputCard = getNextInputCard(inputCards);
  const requiredInputComplete = inputCards.filter((card) => card.priority === "required").every(isInputCardSatisfied);

  return (
    <div className="min-h-screen">
      {restoreMessage && (
        <div className="border-b bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          <div className="container flex flex-wrap items-center justify-between gap-2">
            <span>{restoreMessage}</span>
            <Button variant="ghost" size="sm" onClick={() => setRestoreMessage(null)}>
              閉じる
            </Button>
          </div>
        </div>
      )}
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="container flex flex-col gap-4 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">一般向け版</p>
            <h1 className="text-2xl font-semibold tracking-normal">人生資産シミュレーション</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={activeScenario.id} onChange={(event) => setActiveScenario(event.target.value)} className="w-64">
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={() => duplicateScenario(activeScenario.id)}>
              <Copy className="h-4 w-4" />
              複製
            </Button>
            <Button variant="outline" onClick={() => setShowDataTrustModal(true)}>
              データの扱い
            </Button>
            <Button variant="outline" onClick={() => setShowOnboarding(true)}>
              初回設定をやり直す
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAppModeHash("safety");
                setActiveTab("manual");
              }}
              className="text-muted-foreground hover:text-slate-900"
            >
              <BookOpen className="h-4 w-4" />
              マニュアル
            </Button>
          </div>
        </div>
        <nav className="container flex gap-2 overflow-x-auto pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAppModeHash("safety");
              setActiveTab("dashboard");
            }}
            className={primaryNavClass("dashboard")}
          >
            ダッシュボード
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={openSafetyNav}
            className={primaryNavClass("safety")}
          >
            安全性シミュレーション
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAssetUseTab("timeBucket");
              setAppModeHash("assetUse");
            }}
            className={primaryNavClass("assetUse")}
          >
            資産活用
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAppModeHash("safety");
              setActiveTab("results");
            }}
            className={primaryNavClass("results")}
          >
            結果
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAppModeHash("safety");
              setActiveTab("compare");
            }}
            className={primaryNavClass("compare")}
          >
            比較
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAppModeHash("safety");
              setActiveTab("data");
            }}
            className={primaryNavClass("data")}
          >
            データ
          </Button>
        </nav>
        {appMode === "safety" && activeTab !== "manual" && activePrimaryNav === "safety" && (
          <nav className="container flex gap-2 overflow-x-auto pb-3">
            {safetySubTabs.map((tab) => (
            <Button
              key={tab.key}
              variant="ghost"
              size="sm"
              onClick={() => {
                if (nextInputCard?.tab === tab.key) {
                  openInputCard(nextInputCard.id);
                  return;
                }
                setActiveTab(tab.key);
              }}
              className={`shrink-0 gap-1.5 ${activeTab === tab.key ? tabGroupClassNames[tab.group].active : tabGroupClassNames[tab.group].inactive}`}
              title={nextInputCard?.tab === tab.key ? `次: ${nextInputCard.title}` : undefined}
              aria-label={nextInputCard?.tab === tab.key ? `${tab.label}。次: ${nextInputCard.title}` : tab.label}
            >
              {tab.label}
              {nextInputCard?.tab === tab.key && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">次</span>
              )}
            </Button>
            ))}
          </nav>
        )}
        {appMode === "assetUse" && (
          <nav className="container flex gap-2 overflow-x-auto pb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAssetUseTab("timeBucket")}
                className={`shrink-0 ${assetUseTab === "timeBucket" ? enjoymentNavClassNames.active : enjoymentNavClassNames.inactive}`}
              >
                タイムバケット
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAssetUseTab("quickTrial")}
                className={`shrink-0 ${assetUseTab === "quickTrial" ? enjoymentNavClassNames.active : enjoymentNavClassNames.inactive}`}
              >
                クイック試算
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAssetUseTab("review")}
                className={`shrink-0 ${assetUseTab === "review" ? enjoymentNavClassNames.active : enjoymentNavClassNames.inactive}`}
              >
                資産レビュー
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAssetUseTab("incomePower")}
                className={`shrink-0 ${assetUseTab === "incomePower" ? enjoymentNavClassNames.active : enjoymentNavClassNames.inactive}`}
              >
                入金力診断
              </Button>
          </nav>
        )}
      </header>

      <TrustNotice
        collapsed={activeTab !== "manual" && trustNoticeCollapsed}
        onExpand={() => {
          setTrustNoticeCollapsed(false);
          setTrustNoticeExpandCount((count) => count + 1);
        }}
      />

      <main className="container space-y-6 py-6">
        {appMode === "assetUse" && (
          <AssetUseWorkspace
            scenario={activeScenario}
            result={result}
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            setActiveScenario={setActiveScenario}
            updateScenario={updateScenario}
            updateScenarios={updateScenarios}
            onOpenSpecialExpenses={() => {
              setActiveTab("special");
              setAppModeHash("safety");
            }}
            onOpenFlexibleFreeCashSettings={openFlexibleFreeCashSettings}
            activeAssetUseTab={assetUseTab}
          />
        )}
        {appMode === "safety" && (
          <>
            {(activeTab === "dashboard" || activeTab === "results") && nextInputCard && (
              <InputGuideMini
                card={nextInputCard}
                requiredComplete={requiredInputComplete}
                onOpenCard={openInputCard}
                onOpenGuide={openInputGuideSummary}
              />
            )}
            {activePrimaryNav === "safety" && safetySubTabKeys.has(activeTab) && (
              <InputGuidanceSummary
                cards={inputCards}
                onOpenCard={openInputCard}
                onOpenResults={() => setActiveTab("results")}
                onOpenOnboarding={() => setShowOnboarding(true)}
              />
            )}
            {activeTab === "dashboard" && (
              <Dashboard
                scenario={activeScenario}
                result={result}
                baselineScenario={baselineScenario}
                onOpenFlexibleFreeCashSettings={openFlexibleFreeCashSettings}
                onOpenInputCard={openInputCard}
                inputCards={inputCards}
                onOpenInputGuide={openInputGuideSummary}
              />
            )}
            {activeTab === "profile" && (
              <ProfileSection
                scenario={activeScenario}
                scenarios={scenarios}
                updateScenario={updateScenario}
                updateScenarios={updateScenarios}
                targetCardId={targetedInputCardId}
              />
            )}
            {activeTab === "assets" && (
              <AssetsSection
                scenario={activeScenario}
                scenarios={scenarios}
                updateScenario={updateScenario}
                updateScenarios={updateScenarios}
                targetCardId={targetedInputCardId}
              />
            )}
            {activeTab === "expenses" && (
              <ExpensesSection
                scenario={activeScenario}
                scenarios={scenarios}
                updateScenario={updateScenario}
                updateScenarios={updateScenarios}
                targetCardId={targetedInputCardId}
              />
            )}
            {activeTab === "income" && (
              <IncomeSection
                scenario={activeScenario}
                scenarios={scenarios}
                updateScenario={updateScenario}
                updateScenarios={updateScenarios}
                targetCardId={targetedInputCardId}
              />
            )}
            {activeTab === "tax" && (
              <TaxSection
                scenario={activeScenario}
                scenarios={scenarios}
                updateScenario={updateScenario}
                updateScenarios={updateScenarios}
                targetCardId={targetedInputCardId}
                onOpenTaxCashPaymentTiming={openTaxCashPaymentTiming}
                onOpenSpouseIncomeEvents={openSpouseIncomeEvents}
                onOpenSpousePartIncomeCompare={openSpousePartIncomeCompare}
                spouseWorkstyleHighlightKey={spouseWorkstyleHighlightKey}
              />
            )}
            {activeTab === "special" && (
              <SpecialSection
                scenario={activeScenario}
                scenarios={scenarios}
                updateScenario={updateScenario}
                updateScenarios={updateScenarios}
                targetCardId={targetedInputCardId}
                onOpenTimeBucket={() => {
                  setAssetUseTab("timeBucket");
                  setAppModeHash("assetUse");
                }}
              />
            )}
            {activeTab === "scenarios" && (
              <ScenariosSection
                scenarios={scenarios}
                activeScenarioId={activeScenarioId}
                setActiveScenario={setActiveScenario}
                duplicateScenario={duplicateScenario}
                deleteScenario={deleteScenario}
                moveScenario={moveScenario}
                toggleScenarioCompare={toggleScenarioCompare}
                updateScenario={updateScenario}
              />
            )}
            {activeTab === "results" && (
              <ResultsSection
                scenario={activeScenario}
                result={result}
                onOpenInputCard={openInputCard}
                inputCards={inputCards}
                onOpenInputGuide={openInputGuideSummary}
              />
            )}
            {activeTab === "compare" && (
              <CompareSection
                items={allResults}
                scenarios={scenarios}
                baselineScenario={baselineScenario}
                baselineScenarioId={baselineScenario.id}
                setBaselineScenarioId={setBaselineScenario}
                periodSourceScenario={activeScenario}
                updateScenario={updateScenario}
                onOpenSpouseWorkstyleSettings={openSpouseWorkstyleSettings}
              />
            )}
            {activeTab === "manual" && <ManualSection />}
            {activeTab === "data" && (
              <DataSection
                exportJson={exportJson}
                createBackupAndExport={createBackupAndExport}
                exportCsv={exportCsv}
                importJson={openJsonImportDialog}
                resetToSample={resetToSample}
                clearLocalData={clearBrowserData}
                onOpenOnboarding={() => setShowOnboarding(true)}
                lastSavedAt={lastSavedAt}
                backups={backups}
                createBackup={createBackup}
                restoreBackup={restoreBackup}
                deleteBackup={deleteBackup}
              />
            )}
          </>
        )}
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={importJson} />
      </main>
      {showOnboarding && !showDataTrustModal && (
        <OnboardingWizard
          scenario={activeScenario}
          onApply={completeOnboarding}
          onClose={closeOnboarding}
        />
      )}
      {showDataTrustModal && <DataTrustModal onClose={closeDataTrustModal} />}
      {!showOnboarding && !showDataTrustModal && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="fixed bottom-5 left-5 z-50 bg-white/95 shadow-md"
          onClick={() => setShowOnboarding(true)}
          aria-label="初回設定を開く"
        >
          初回設定
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="fixed bottom-5 right-5 z-50 bg-white shadow-md"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="ページ上部へ戻る"
      >
        <ArrowUp className="h-4 w-4" />
        上へ
      </Button>
    </div>
  );
}

function getScenarioFlexibleFreeCashPeriod(scenario: ScenarioData): FlexibleFreeCashPeriod {
  return normalizeFlexibleFreeCashPeriod({
    startAge: scenario.userProfile.flexibleFreeCashStartAge,
    endAge: scenario.userProfile.flexibleFreeCashEndAge,
  });
}

function flexibleFreeCashPeriodLabel(period: FlexibleFreeCashPeriod) {
  return `${period.startAge}〜${period.endAge}歳`;
}

function FlexibleFreeCashPeriodFields({ period, updateScenario }: { period: FlexibleFreeCashPeriod; updateScenario: SectionProps["updateScenario"] }) {
  const updateStartAge = (value: string) => {
    const startAge = Math.trunc(numberOrZero(value));
    updateScenario((s) => {
      s.userProfile.flexibleFreeCashStartAge = startAge;
      s.userProfile.flexibleFreeCashEndAge = Math.max(startAge, s.userProfile.flexibleFreeCashEndAge ?? period.endAge);
    });
  };
  const updateEndAge = (value: string) => {
    const endAge = Math.trunc(numberOrZero(value));
    updateScenario((s) => {
      const startAge = s.userProfile.flexibleFreeCashStartAge ?? period.startAge;
      s.userProfile.flexibleFreeCashEndAge = Math.max(startAge, endAge);
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="資産活用 開始年齢">
        <Input type="number" min={0} step={1} value={period.startAge} onChange={(event) => updateStartAge(event.target.value)} />
      </Field>
      <Field label="資産活用 終了年齢">
        <Input type="number" min={period.startAge} step={1} value={period.endAge} onChange={(event) => updateEndAge(event.target.value)} />
      </Field>
    </div>
  );
}

function specialExpenseScheduleLabel(event: SpecialExpenseEvent) {
  const schedule = event.schedule ?? "once";
  if (schedule === "once") return event.yearMonth;
  const start = event.yearMonth;
  const end = event.endYearMonth ?? "終了未設定";
  const interval =
    schedule === "monthly"
      ? "毎月"
      : schedule === "quarterly"
        ? "四半期"
        : schedule === "semiannual"
          ? "半年ごと"
          : schedule === "yearly"
            ? "毎年"
            : schedule === "seasonalMonthly"
              ? "毎年指定月"
              : `${Math.max(1, Math.round(event.repeatIntervalMonths ?? 1))}か月ごと`;
  const monthWindow =
    schedule === "seasonalMonthly" && event.activeStartMonth && event.activeEndMonth
      ? ` / ${event.activeStartMonth}月〜${event.activeEndMonth}月`
      : "";
  return `${start}〜${end} / ${interval}${monthWindow}`;
}

function AssetUseWorkspace({
  scenario,
  result,
  scenarios,
  activeScenarioId,
  setActiveScenario,
  updateScenario,
  updateScenarios,
  onOpenSpecialExpenses,
  onOpenFlexibleFreeCashSettings,
  activeAssetUseTab,
}: {
  scenario: ScenarioData;
  result: ReturnType<typeof simulateScenario>;
  scenarios: ScenarioData[];
  activeScenarioId: string;
  setActiveScenario: (id: string) => void;
  updateScenario: (updater: (scenario: ScenarioData) => void) => void;
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData, backupLabel?: string) => void;
  onOpenSpecialExpenses: () => void;
  onOpenFlexibleFreeCashSettings: () => void;
  activeAssetUseTab: AssetUseTab;
}) {
  const flexibleFreeCashPeriod = getScenarioFlexibleFreeCashPeriod(scenario);
  const [trialStartAge, setTrialStartAge] = useState(flexibleFreeCashPeriod.startAge);
  const [trialEndAge, setTrialEndAge] = useState(flexibleFreeCashPeriod.endAge);
  const [trialAnnualAmount, setTrialAnnualAmount] = useState(1_000_000);
  const [trialCategory, setTrialCategory] = useState<SpecialExpenseCategory>("enjoyment");
  const [incomePowerDiagnostics, setIncomePowerDiagnostics] = useState<IncomePowerDiagnostics | null>(null);
  const flexibleFreeCashSummary = calculateFlexibleFreeCashSummary(result, flexibleFreeCashPeriod);
  const optionLiquidityAnalysis = calculateOptionLiquidityAnalysis(result, flexibleFreeCashPeriod);
  const specialExpenseCategoryTotals = calculateSpecialExpenseCategoryTotals(scenario, result, flexibleFreeCashPeriod);
  const targetBalanceAnalysis = calculateTargetBalanceAnalysis(scenario, result);
  const categoryBreakdown = calculateAssetUseCategoryBreakdown(scenario, result, flexibleFreeCashPeriod);
  const categoryWarnings = findSpecialExpenseCategoryWarnings(scenario.specialExpenses);
  const flexibleFreeCashLabel = flexibleFreeCashPeriodLabel(flexibleFreeCashSummary.period);
  const flexibleFreeCashPeriodYearMonths = result.monthly
    .filter((row) => row.ageYears >= flexibleFreeCashSummary.period.startAge && row.ageYears <= flexibleFreeCashSummary.period.endAge)
    .map((row) => row.yearMonth as YearMonth);
  const outOfPeriodSpecialExpenses = scenario.specialExpenses.filter(
    (event) => event.amount > 0 && !flexibleFreeCashPeriodYearMonths.some((yearMonth) => isSpecialExpenseActive(event, yearMonth)),
  );
  const assetLifeValue = result.depletionYearMonth ? `${result.depletionAgeYears}歳${result.depletionAgeMonths}か月` : "期間内維持";
  const enjoymentShare = calculateEnjoymentShare(categoryBreakdown);
  const specialExpenseReviewTotal =
    categoryBreakdown.enjoyment +
    categoryBreakdown.lifeMaintenance +
    categoryBreakdown.housingCar +
    categoryBreakdown.medicalCare +
    categoryBreakdown.familySupport;
  const allExpenseReviewTotal = specialExpenseReviewTotal + categoryBreakdown.livingAndTax;
  const enjoymentAllExpenseShare = allExpenseReviewTotal > 0 ? categoryBreakdown.enjoyment / allExpenseReviewTotal : 0;
  const enjoymentSpecialExpensePercent = Math.max(0, Math.min(100, Math.round(enjoymentShare * 100)));
  const optionLiquidityShareOfAssetUse =
    flexibleFreeCashSummary.assetUtilizationAmount > 0
      ? optionLiquidityAnalysis.optionToLiquidTotal / flexibleFreeCashSummary.assetUtilizationAmount
      : null;
  const optionLiquidityReading =
    optionLiquidityAnalysis.optionToLiquidTotal <= 0 && optionLiquidityAnalysis.declaredOptionProfitTotal > 0
      ? "期間内に申告対象利益はありますが、現金・普通預金へ回った額はありません。楽しみ支出に使える資金としては増えていません。"
      : optionLiquidityAnalysis.optionToLiquidTotal <= 0
        ? "期間内に一般口座オプションから現金・普通預金へ回った資金はありません。"
        : optionLiquidityAnalysis.suspendedIncomeTotal > 0
          ? "一般口座から流動資金へ回った額はありますが、最低維持額不足で停止された予定利益もあります。"
          : "一般口座オプションから流動資金へ回った額を、健康寿命期の使える資金として確認できます。";
  const ordinaryOptionIncomeEvents = scenario.incomeEvents.filter(
    (event) =>
      event.sourceAssetKey === "ordinaryAccountForOptions" &&
      (event.type === "investmentIncome" || event.type === "dividend" || event.type === "other"),
  );
  const optionIncomeAuditRows = ordinaryOptionIncomeEvents
    .filter(
      (event) =>
        event.sourceAssetKey === "ordinaryAccountForOptions" &&
        (event.type === "investmentIncome" || event.type === "dividend" || event.type === "other"),
    )
    .map((event) => {
      const configuredAccount = scenario.optionSubAccounts.find((account) => account.id === event.sourceOptionSubAccountId);
      const scenarioNameAmount = inferMonthlyOptionIncomeFromScenarioName(scenario.name, event.name, configuredAccount?.name, {
        allowGenericEvent: ordinaryOptionIncomeEvents.length === 1,
      });
      const scenarioResolvedAccountId = scenarioNameAmount === undefined
        ? undefined
        : inferOptionSubAccountIdFromName(scenario.optionSubAccounts, scenario.name);
      const resolvedAccountId =
        scenarioResolvedAccountId ??
        resolveOptionSubAccountId(scenario.optionSubAccounts, event.sourceOptionSubAccountId, event.name);
      const resolvedAccount = scenario.optionSubAccounts.find((account) => account.id === resolvedAccountId);
      const activeMonthsInPeriod = result.monthly.filter(
        (row) =>
          row.ageYears >= flexibleFreeCashSummary.period.startAge &&
          row.ageYears <= flexibleFreeCashSummary.period.endAge &&
          isEventActive(event, row.yearMonth),
      ).length;
      const monthlyAmount = Math.max(0, event.monthlyAmount ?? 0);
      const configuredAccountName = configuredAccount?.name ?? (event.sourceOptionSubAccountId ? "見つからないサブ口座" : "未指定");
      const resolvedAccountName = resolvedAccount?.name ?? configuredAccountName;
      return {
        id: event.id,
        name: event.name || "一般口座オプション収入",
        monthlyAmount,
        scenarioNameAmount,
        activeMonthsInPeriod,
        periodTotal: monthlyAmount * activeMonthsInPeriod,
        payoutMode: event.sourceAssetPayoutMode ?? "cash",
        configuredAccountName,
        resolvedAccountName,
        isCorrected: Boolean(
          (resolvedAccountId &&
            event.sourceOptionSubAccountId &&
            resolvedAccountId !== event.sourceOptionSubAccountId) ||
          (scenarioNameAmount !== undefined && scenarioNameAmount !== monthlyAmount),
        ),
      };
    });
  const targetGapSub =
    targetBalanceAnalysis.gap >= 0
      ? `${targetBalanceAnalysis.targetAge}歳目標 ${compactYen(targetBalanceAnalysis.targetAmount)} を上回る余力目安`
      : `${targetBalanceAnalysis.targetAge}歳目標 ${compactYen(targetBalanceAnalysis.targetAmount)} を下回っています`;
  const assetUseReviewItems = [
    {
      title: "安全余力",
      value: targetBalanceStatusLabels[targetBalanceAnalysis.status],
      className: targetBalanceStatusClassNames[targetBalanceAnalysis.status],
      description:
        targetBalanceAnalysis.status === "shortfall"
          ? `${targetBalanceAnalysis.targetAge}歳目標に ${compactYen(Math.abs(targetBalanceAnalysis.gap))} 届いていません。追加支出より先に安全性側の調整が必要です。`
          : `${targetBalanceAnalysis.targetAge}歳目標を ${compactYen(targetBalanceAnalysis.gap)} 上回っています。追加支出候補を検討できる余地があります。`,
    },
    {
      title: "期間内の使い方",
      value: flexibleFreeCashSummary.averageAnnualFreeCash < 0 ? "資産活用中" : "現金余力あり",
      className: flexibleFreeCashSummary.averageAnnualFreeCash < 0 ? "text-amber-700" : "text-teal-700",
      description:
        flexibleFreeCashSummary.averageAnnualFreeCash < 0
          ? `${flexibleFreeCashLabel} は年平均 ${compactYen(Math.abs(flexibleFreeCashSummary.averageAnnualFreeCash))} を資産で補っています。`
          : `${flexibleFreeCashLabel} は年平均 ${compactYen(flexibleFreeCashSummary.averageAnnualFreeCash)} の現金収支余力があります。`,
    },
    {
      title: "楽しみ比率",
      value: compactPercent(enjoymentShare),
      className: enjoymentShare >= 0.3 ? "text-teal-700" : enjoymentShare > 0 ? "text-amber-700" : "text-slate-700",
      description:
        specialExpenseCategoryTotals.enjoyment > 0
          ? `期間内の特別支出のうち、楽しみカテゴリは ${compactYen(specialExpenseCategoryTotals.enjoyment)} です。`
          : "期間内に楽しみカテゴリの特別支出はありません。使う候補は下の追加支出シミュレーターで試せます。",
    },
  ];
  const assetUseKeyMetrics = [
    {
      title: "資産寿命",
      value: assetLifeValue,
      sub: `${scenario.userProfile.targetBalanceAge}歳時点 ${compactYen(result.targetAgeBalance ?? 0)}`,
    },
    {
      title: `${scenario.userProfile.targetBalanceAge}歳目標との差額`,
      value: compactYen(targetBalanceAnalysis.gap),
      sub: targetGapSub,
    },
    {
      title: `${flexibleFreeCashLabel} 資産活用額`,
      value: compactYen(flexibleFreeCashSummary.assetUtilizationAmount),
      sub: "現金収入等で賄いきれず資産で補った額",
    },
    {
      title: `${flexibleFreeCashSummary.period.endAge}歳時点残高`,
      value: compactYen(flexibleFreeCashSummary.periodEndBalance),
      sub: "健康寿命期の終点で残る年末資産",
    },
  ];
  const hasOrdinaryOptionIncomeEvents = scenario.incomeEvents.some(
    (event) =>
      event.sourceAssetKey === "ordinaryAccountForOptions" &&
      (event.type === "investmentIncome" || event.type === "dividend" || event.type === "other"),
  );
  const assetUseNextFocus =
    targetBalanceAnalysis.status === "shortfall"
      ? "まず目標残高割れの原因を安全性シミュレーション側で確認してください。"
      : specialExpenseCategoryTotals.enjoyment <= 0
        ? "楽しみカテゴリが未設定です。特別支出タブで旅行・趣味・家族イベントを楽しみに分類するか、クイック試算で候補額を確認してください。"
      : flexibleFreeCashSummary.averageAnnualFreeCash > 0 && enjoymentShare < 0.3
        ? "安全余力と現金余力があるため、健康寿命期の楽しみ支出候補を増やして試す余地があります。"
        : hasOrdinaryOptionIncomeEvents
          ? "追加支出クイック試算で使える年額を確認し、入金力別診断で入金を増やした場合の実質手残りと分岐点を確認してください。"
          : "現在の支出配分を維持しつつ、追加支出クイック試算で年額別の影響を確認してください。";
  const assetUseDecision =
    targetBalanceAnalysis.status === "shortfall"
      ? {
          title: "追加支出は保留",
          className: "text-red-700",
          description: `${targetBalanceAnalysis.targetAge}歳目標に ${compactYen(Math.abs(targetBalanceAnalysis.gap))} 届いていません。安全性側の前提を先に直す状態です。`,
          next: "結果タブ・比較タブで資産寿命と90歳残高を確認",
        }
      : specialExpenseCategoryTotals.enjoyment <= 0
        ? {
            title: "楽しみ支出の登録余地あり",
            className: "text-amber-700",
            description: `${flexibleFreeCashLabel} に楽しみカテゴリの特別支出がありません。安全余力はあるため、旅行・趣味などの候補を入れる段階です。`,
            next: "特別支出タブでカテゴリを楽しみに変更、またはクイック試算",
          }
        : flexibleFreeCashSummary.averageAnnualFreeCash > 0
          ? {
              title: "追加支出を試せる",
              className: "text-teal-700",
              description: `${targetBalanceAnalysis.targetAge}歳目標を守りつつ、期間内に年平均 ${compactYen(flexibleFreeCashSummary.averageAnnualFreeCash)} の現金余力があります。`,
              next: "クイック試算で年額別の上限を確認",
            }
          : hasOrdinaryOptionIncomeEvents
            ? {
                title: "入金力とのバランス確認",
                className: "text-teal-700",
                description: `${flexibleFreeCashLabel} は年平均 ${compactYen(Math.abs(flexibleFreeCashSummary.averageAnnualFreeCash))} を資産で補っています。入金力別診断で効率を確認する状態です。`,
                next: "入金力別診断で分岐点と有効率を確認",
              }
            : {
                title: "年額別に影響確認",
                className: "text-teal-700",
                description: `${targetBalanceAnalysis.targetAge}歳目標は達成しています。追加する楽しみ支出の年額で資産寿命がどう変わるかを確認します。`,
                next: "クイック試算で追加支出額を調整",
              };
  const categoryRows = [
    { label: "楽しみ", value: categoryBreakdown.enjoyment, note: "旅行・趣味・家族イベントなど" },
    { label: "生活維持", value: categoryBreakdown.lifeMaintenance, note: "特別支出カテゴリ分" },
    { label: "住宅・車", value: categoryBreakdown.housingCar, note: "修繕・買替など" },
    { label: "医療・介護", value: categoryBreakdown.medicalCare, note: "医療・介護関連" },
    { label: "家族支援", value: categoryBreakdown.familySupport, note: "家族への支援" },
    { label: "生活費・税社保", value: categoryBreakdown.livingAndTax, note: "通常生活費と税・社会保険" },
  ];
  const categoryChartData = categoryRows.map((row) => ({ name: row.label, amount: row.value }));
  const additionalSpendingTrial = useMemo(
    () =>
      calculateAdditionalSpendingTrial(scenario, result, {
        startAge: trialStartAge,
        endAge: trialEndAge,
        annualAmount: trialAnnualAmount,
        category: trialCategory,
      }),
    [scenario, result, trialAnnualAmount, trialCategory, trialEndAge, trialStartAge],
  );
  const targetBalanceImpact = additionalSpendingTrial.targetBalance.actualAmount - targetBalanceAnalysis.actualAmount;
  const incomePowerFocusText =
    !hasOrdinaryOptionIncomeEvents
      ? "一般口座オプション収入イベントがないため、入金力別診断はまだ使えません。収入タブで一般口座オプション由来の収入イベントを登録してください。"
      : !incomePowerDiagnostics
        ? "重い診断のため自動計算はしません。期間を確認してから診断を実行してください。"
      : incomePowerDiagnostics.firstUsefulMonthlyIncomePower === undefined
        ? "この条件では、入金力を上げても楽しみ支出を安全に増やせる明確な分岐点は出ていません。税社保増、最低維持額、90歳目標差額を確認してください。"
        : `この条件では、月${compactYen(incomePowerDiagnostics.firstUsefulMonthlyIncomePower)}付近から、90歳目標を守りながら楽しみ支出を増やせる目安が出ます。`;
  const incomePowerFirstUsefulRow = incomePowerDiagnostics?.rows.find(
    (row) => row.monthlyIncomePower === incomePowerDiagnostics.firstUsefulMonthlyIncomePower,
  );
  const incomePowerBestEnjoymentRow = incomePowerDiagnostics?.rows.reduce(
    (best, row) => (row.maxAdditionalEnjoymentAnnual > best.maxAdditionalEnjoymentAnnual ? row : best),
    incomePowerDiagnostics.rows[0],
  );
  const incomePowerBestEfficiencyRow = incomePowerDiagnostics?.rows
    .filter((row) => row.effectiveRate !== null && row.grossIncomeIncrease > 0)
    .reduce(
      (best, row) => (!best || (row.effectiveRate ?? 0) > (best.effectiveRate ?? 0) ? row : best),
      undefined as (typeof incomePowerDiagnostics.rows)[number] | undefined,
    );
  const incomePowerMaxNetIncome = Math.max(1, ...(incomePowerDiagnostics?.rows.map((row) => row.netIncomeIncrease) ?? [0]));
  const incomePowerMaxTaxIncrease = Math.max(1, ...(incomePowerDiagnostics?.rows.map((row) => row.taxAndSocialIncrease) ?? [0]));
  const incomePowerMaxEnjoyment = Math.max(1, ...(incomePowerDiagnostics?.rows.map((row) => row.maxAdditionalEnjoymentAnnual) ?? [0]));
  const incomePowerStepRows =
    incomePowerDiagnostics?.rows.map((row, index, rows) => {
      const previous = rows[index - 1];
      const grossDelta = previous ? row.grossIncomeIncrease - previous.grossIncomeIncrease : 0;
      const taxDelta = previous ? row.taxAndSocialIncrease - previous.taxAndSocialIncrease : 0;
      const netDelta = previous ? row.netIncomeIncrease - previous.netIncomeIncrease : 0;
      const enjoymentDelta = previous ? row.maxAdditionalEnjoymentAnnual - previous.maxAdditionalEnjoymentAnnual : 0;
      return {
        ...row,
        grossDelta,
        taxDelta,
        netDelta,
        enjoymentDelta,
        marginalEffectiveRate: grossDelta > 0 ? netDelta / grossDelta : null,
      };
    }) ?? [];
  useEffect(() => {
    setIncomePowerDiagnostics(null);
  }, [scenario.id, trialStartAge, trialEndAge]);
  const runIncomePowerDiagnostics = () => {
    setIncomePowerDiagnostics(
      calculateIncomePowerDiagnostics(scenario, {
        startAge: trialStartAge,
        endAge: trialEndAge,
      }),
    );
  };
  const setTrialPeriod = (startAge: number, endAge: number) => {
    setTrialStartAge(startAge);
    setTrialEndAge(Math.max(startAge, endAge));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>資産活用ビュー</CardTitle>
          <CardDescription>
            何をしたいかを整理し、年額で試し、安全性を確認し、必要な時だけ入金力の意味を見ます。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm leading-6 md:grid-cols-4">
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="text-muted-foreground">選択シナリオ</div>
            <div className="mt-1 font-semibold text-slate-900">{scenario.name}</div>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="text-muted-foreground">見る期間</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{flexibleFreeCashLabel}</span>
              <Button variant="outline" size="sm" onClick={onOpenFlexibleFreeCashSettings}>
                設定
              </Button>
            </div>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="text-muted-foreground">守る基準</div>
            <div className="mt-1 font-semibold text-slate-900">{targetBalanceAnalysis.targetAge}歳目標 {compactYen(targetBalanceAnalysis.targetAmount)}</div>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="text-muted-foreground">表示中</div>
            <div className="mt-1 font-semibold text-slate-900">{assetUseTabLabels[activeAssetUseTab]}</div>
          </div>
        </CardContent>
      </Card>

      {activeAssetUseTab === "timeBucket" && (
        <TimeBucketPlanner
          scenario={scenario}
          scenarios={scenarios}
          updateScenario={updateScenario}
          updateScenarios={updateScenarios}
          onOpenSpecialExpenses={onOpenSpecialExpenses}
        />
      )}

      {activeAssetUseTab === "review" && (
        <>
      <Card>
        <CardHeader>
          <CardTitle>資産活用レビュー</CardTitle>
          <CardDescription>
            まず安全性と使える余地を確認し、次にクイック試算か入金力別診断へ進みます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.9fr)_minmax(260px,1.4fr)]">
            <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3">
              <div className="text-sm text-teal-950">今回の判定</div>
              <div className={`mt-1 text-xl font-semibold ${assetUseDecision.className}`}>{assetUseDecision.title}</div>
              <p className="mt-2 text-sm leading-6 text-teal-950">{assetUseDecision.description}</p>
            </div>
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <div className="text-sm text-muted-foreground">次に見るポイント</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">{assetUseDecision.next}</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{assetUseNextFocus}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {assetUseKeyMetrics.map((item) => (
              <div key={item.title} className="rounded-md border bg-slate-50 px-4 py-3">
                <div className="text-sm text-muted-foreground">{item.title}</div>
                <div className="mt-1 text-xl font-semibold text-slate-900">{item.value}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.sub}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {assetUseReviewItems.map((item) => (
              <div key={item.title} className="rounded-md border bg-slate-50 px-4 py-3">
                <div className="text-sm text-muted-foreground">{item.title}</div>
                <div className={`mt-1 text-xl font-semibold ${item.className}`}>{item.value}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

        </>
      )}

      {activeAssetUseTab === "quickTrial" && (
        <>
      <Card>
        <CardHeader>
          <CardTitle>楽しみに使える額を探すクイック試算</CardTitle>
          <CardDescription>
            このカード内の年額と期間だけを変えて、健康寿命期にどこまで追加で使えるかを試します。保存データは変更しません。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(260px,1.4fr)_repeat(4,minmax(130px,1fr))]">
            <Field label="試算するシナリオ">
              <Select value={activeScenarioId} onChange={(event) => setActiveScenario(event.target.value)}>
                {scenarios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="開始年齢">
              <Input
                type="number"
                min={0}
                step={1}
                value={trialStartAge}
                onChange={(event) => {
                  const nextStartAge = Math.trunc(numberOrZero(event.target.value));
                  setTrialStartAge(nextStartAge);
                  setTrialEndAge((current) => Math.max(nextStartAge, current));
                }}
              />
            </Field>
            <Field label="終了年齢">
              <Input
                type="number"
                min={trialStartAge}
                step={1}
                value={trialEndAge}
                onChange={(event) => setTrialEndAge(Math.max(trialStartAge, Math.trunc(numberOrZero(event.target.value))))}
              />
            </Field>
            <Field label="年額追加支出">
              <Input
                type="number"
                min={0}
                step={100_000}
                value={trialAnnualAmount}
                onChange={(event) => setTrialAnnualAmount(numberOrZero(event.target.value))}
              />
            </Field>
            <Field label="カテゴリ">
              <Select value={trialCategory} onChange={(event) => setTrialCategory(event.target.value as SpecialExpenseCategory)}>
                {Object.entries(specialExpenseCategoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setTrialPeriod(60, 69)}>60〜69歳</Button>
            <Button variant="outline" size="sm" onClick={() => setTrialPeriod(60, 72)}>60〜72歳</Button>
            <Button variant="outline" size="sm" onClick={() => setTrialPeriod(flexibleFreeCashPeriod.startAge, flexibleFreeCashPeriod.endAge)}>
              現在の集計期間
            </Button>
            {[500_000, 1_000_000, 1_500_000, 2_000_000].map((amount) => (
              <Button key={amount} variant="ghost" size="sm" onClick={() => setTrialAnnualAmount(amount)}>
                年{compactYen(amount)}
              </Button>
            ))}
          </div>
          <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950">
            年額ボタンや任意金額を変えるたびに、このカード内だけで試算結果が変わります。具体的に実行する支出は、後で特別支出タブに年月つきで登録してください。
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <div className="text-sm text-muted-foreground">追加支出総額</div>
              <div className="mt-1 text-xl font-semibold">{compactYen(additionalSpendingTrial.totalAddedExpense)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {additionalSpendingTrial.startYearMonth ?? "-"}〜{additionalSpendingTrial.endYearMonth ?? "-"}
              </div>
            </div>
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <div className="text-sm text-muted-foreground">{scenario.userProfile.targetBalanceAge}歳目標との差額</div>
              <div className={`mt-1 text-xl font-semibold ${targetBalanceStatusClassNames[additionalSpendingTrial.targetBalance.status]}`}>
                {compactYen(additionalSpendingTrial.targetBalance.gap)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {targetBalanceStatusLabels[additionalSpendingTrial.targetBalance.status]}
              </div>
            </div>
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <div className="text-sm text-muted-foreground">資産寿命</div>
              <div className="mt-1 text-xl font-semibold">{additionalSpendingTrial.depletionLabel}</div>
              <div className="mt-1 text-xs text-muted-foreground">{additionalSpendingTrial.result.depletionYearMonth ?? "期間内維持"}</div>
            </div>
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <div className="text-sm text-muted-foreground">年平均余力</div>
              <div className={`mt-1 text-xl font-semibold ${additionalSpendingTrial.flexibleFreeCash.averageAnnualFreeCash < 0 ? "text-amber-700" : "text-teal-700"}`}>
                {compactYen(additionalSpendingTrial.flexibleFreeCash.averageAnnualFreeCash)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">追加支出込み</div>
            </div>
          </div>
        </CardContent>
      </Card>

        </>
      )}

      {activeAssetUseTab === "incomePower" && (
        <>

      <Card>
        <CardHeader>
          <CardTitle>入金力別診断</CardTitle>
          <CardDescription>
            一般口座オプション収入を月0〜50万円で仮置きし、税・社会保険を引いた実質効果と、楽しみに増やせる年額の目安を横並びで見ます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950">
            {incomePowerFocusText}
          </div>
          {hasOrdinaryOptionIncomeEvents ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-slate-50 px-4 py-3">
                <div className="text-sm text-muted-foreground">
                  {trialStartAge}〜{trialEndAge}歳の期間で、月0〜50万円の仮入金力を比較します。
                </div>
                <Button onClick={runIncomePowerDiagnostics}>
                  診断を実行
                </Button>
              </div>
              {incomePowerDiagnostics ? (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border bg-slate-50 px-4 py-3">
                      <div className="text-sm text-muted-foreground">診断対象</div>
                      <div className="mt-1 text-xl font-semibold">{incomePowerDiagnostics.sourceEventCount}件</div>
                      <div className="mt-1 text-xs text-muted-foreground">一般口座オプション収入イベント</div>
                    </div>
                    <div className="rounded-md border bg-slate-50 px-4 py-3">
                      <div className="text-sm text-muted-foreground">現在の入金力</div>
                      <div className="mt-1 text-xl font-semibold">{compactYen(incomePowerDiagnostics.baselineMonthlyIncomePower)} / 月</div>
                      <div className="mt-1 text-xs text-muted-foreground">保存済みシナリオの合計入力値</div>
                    </div>
                    <div className="rounded-md border bg-slate-50 px-4 py-3">
                      <div className="text-sm text-muted-foreground">0円入金時の楽しみ余地</div>
                      <div className="mt-1 text-xl font-semibold">{compactYen(incomePowerDiagnostics.baselineMaxAdditionalEnjoymentAnnual)} / 年</div>
                      <div className="mt-1 text-xs text-muted-foreground">比較の基準値</div>
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3">
                      <div className="text-sm text-teal-950">分岐点</div>
                      <div className="mt-1 text-xl font-semibold text-teal-800">
                        {incomePowerFirstUsefulRow ? `月${compactYen(incomePowerFirstUsefulRow.monthlyIncomePower)}` : "明確な分岐点なし"}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-teal-950">
                        {incomePowerFirstUsefulRow
                          ? `楽しみ支出 ${compactYen(incomePowerFirstUsefulRow.maxAdditionalEnjoymentAnnual)} / 年、実質手残り ${compactYen(incomePowerFirstUsefulRow.netIncomeIncrease)}`
                          : "90歳目標を守りながら楽しみ支出を増やせる候補が見つかっていません。"}
                      </div>
                    </div>
                    <div className="rounded-md border bg-slate-50 px-4 py-3">
                      <div className="text-sm text-muted-foreground">最大候補</div>
                      <div className="mt-1 text-xl font-semibold">
                        {incomePowerBestEnjoymentRow ? `${compactYen(incomePowerBestEnjoymentRow.maxAdditionalEnjoymentAnnual)} / 年` : "-"}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        {incomePowerBestEnjoymentRow
                          ? `仮の入金力 月${compactYen(incomePowerBestEnjoymentRow.monthlyIncomePower)}、90歳目標差額 ${compactYen(incomePowerBestEnjoymentRow.targetBalanceGapAfterMax)}`
                          : "診断結果がありません。"}
                      </div>
                    </div>
                    <div className="rounded-md border bg-slate-50 px-4 py-3">
                      <div className="text-sm text-muted-foreground">効率がよい候補</div>
                      <div className="mt-1 text-xl font-semibold">
                        {incomePowerBestEfficiencyRow?.effectiveRate === null || !incomePowerBestEfficiencyRow
                          ? "-"
                          : `月${compactYen(incomePowerBestEfficiencyRow.monthlyIncomePower)} / ${compactPercent(incomePowerBestEfficiencyRow.effectiveRate)}`}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        {incomePowerBestEfficiencyRow
                          ? `入金総額 ${compactYen(incomePowerBestEfficiencyRow.grossIncomeIncrease)} に対し、実質手残り ${compactYen(incomePowerBestEfficiencyRow.netIncomeIncrease)}`
                          : "入金増の実質手残りを比較できる候補がありません。"}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 rounded-md border bg-white px-4 py-3">
                    <div className="grid gap-2 text-xs font-medium text-muted-foreground md:grid-cols-[9rem_1fr_1fr_1fr]">
                      <div>仮の入金力</div>
                      <div>実質手残り</div>
                      <div>税・社保増</div>
                      <div>楽しみに増やせる年額</div>
                    </div>
                    {incomePowerDiagnostics.rows.map((row) => (
                      <div key={`visual-${row.monthlyIncomePower}`} className="grid items-center gap-2 text-sm md:grid-cols-[9rem_1fr_1fr_1fr]">
                        <div className="font-medium">月{compactYen(row.monthlyIncomePower)}</div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-teal-600"
                              style={{ width: `${Math.max(0, Math.min(100, (row.netIncomeIncrease / incomePowerMaxNetIncome) * 100))}%` }}
                            />
                          </div>
                          <span className="w-20 text-right text-teal-700">{compactYen(row.netIncomeIncrease)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-amber-600"
                              style={{ width: `${Math.max(0, Math.min(100, (row.taxAndSocialIncrease / incomePowerMaxTaxIncrease) * 100))}%` }}
                            />
                          </div>
                          <span className="w-20 text-right text-amber-700">{compactYen(row.taxAndSocialIncrease)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-sky-600"
                              style={{ width: `${Math.max(0, Math.min(100, (row.maxAdditionalEnjoymentAnnual / incomePowerMaxEnjoyment) * 100))}%` }}
                            />
                          </div>
                          <span className="w-20 text-right">{compactYen(row.maxAdditionalEnjoymentAnnual)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <ScenarioSyncDetails
                    title="診断表の詳細"
                    description="入金総額、税・社会保険増、有効率、90歳目標差額を行ごとに確認します。"
                  >
                    <div className="table-scroll overflow-auto">
                      <Table className="min-w-[1100px]">
                        <thead>
                          <Tr>
                            <Th>仮の入金力</Th>
                            <Th>楽しみに増やせる年額</Th>
                            <Th>入金総額</Th>
                            <Th>税・社保増</Th>
                            <Th>実質手残り</Th>
                            <Th>有効率</Th>
                            <Th>90歳目標差額</Th>
                            <Th>資産寿命</Th>
                          </Tr>
                        </thead>
                        <tbody>
                          {incomePowerDiagnostics.rows.map((row) => (
                            <Tr key={row.monthlyIncomePower}>
                              <Td className={row.monthlyIncomePower === incomePowerDiagnostics.baselineMonthlyIncomePower ? "font-semibold text-teal-700" : ""}>
                                月{compactYen(row.monthlyIncomePower)}
                              </Td>
                              <Td className="font-medium">{compactYen(row.maxAdditionalEnjoymentAnnual)} / 年</Td>
                              <Td>
                                {compactYen(row.grossIncomeIncrease)}
                                <div className="text-xs text-muted-foreground">イベント延べ{row.activeMonths}か月対象</div>
                              </Td>
                              <Td className={row.taxAndSocialIncrease > 0 ? "text-amber-700" : ""}>{compactYen(row.taxAndSocialIncrease)}</Td>
                              <Td className={row.netIncomeIncrease < 0 ? "text-red-600" : "text-teal-700"}>{compactYen(row.netIncomeIncrease)}</Td>
                              <Td>{row.effectiveRate === null ? "-" : compactPercent(row.effectiveRate)}</Td>
                              <Td className={targetBalanceStatusClassNames[row.targetBalanceStatusAfterMax]}>{compactYen(row.targetBalanceGapAfterMax)}</Td>
                              <Td>{row.depletionLabelAfterMax}</Td>
                            </Tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                    <p className="text-xs leading-6 text-muted-foreground">
                      「仮の入金力」は一般口座オプション収入イベント全体の合計月額として扱います。複数イベントがある場合も、合計が月10万円、月20万円になるよう配分します。
                      イベントごとに有効期間が違う場合、入金総額は単純な「月額×延べ月数」ではなく、配分後の各イベント月額×対象月数の合計です。
                      税・社保増は月0円入金ケースとの差分で、保存データには反映しません。
                    </p>
                    <div className="table-scroll overflow-auto">
                      <Table className="min-w-[980px]">
                        <thead>
                          <Tr>
                            <Th>仮の入金力</Th>
                            <Th>前段からの入金増</Th>
                            <Th>前段からの税・社保増</Th>
                            <Th>前段からの手残り増</Th>
                            <Th>前段の有効率</Th>
                            <Th>楽しみ支出の増減</Th>
                          </Tr>
                        </thead>
                        <tbody>
                          {incomePowerStepRows.map((row) => (
                            <Tr key={`step-${row.monthlyIncomePower}`}>
                              <Td>月{compactYen(row.monthlyIncomePower)}</Td>
                              <Td>{row.grossDelta === 0 ? "-" : compactYen(row.grossDelta)}</Td>
                              <Td className={row.taxDelta > 0 ? "text-amber-700" : ""}>{row.taxDelta === 0 ? "-" : compactYen(row.taxDelta)}</Td>
                              <Td className={row.netDelta < 0 ? "text-red-600" : row.netDelta > 0 ? "text-teal-700" : ""}>
                                {row.netDelta === 0 ? "-" : compactYen(row.netDelta)}
                              </Td>
                              <Td>{row.marginalEffectiveRate === null ? "-" : compactPercent(row.marginalEffectiveRate)}</Td>
                              <Td className={row.enjoymentDelta < 0 ? "text-red-600" : row.enjoymentDelta > 0 ? "text-teal-700" : ""}>
                                {row.enjoymentDelta === 0 ? "-" : compactYen(row.enjoymentDelta)}
                              </Td>
                            </Tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                    <p className="text-xs leading-6 text-muted-foreground">
                      前段からの差分は、月0万から月10万、月10万から月20万のように一段増やした時の変化です。
                      ここを見ると、入金を増やした分が税・社会保険でどれだけ減り、楽しみ支出の上限にどれだけ反映されたかを確認できます。
                    </p>
                  </ScenarioSyncDetails>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  診断表はまだ計算していません。上の「診断を実行」を押すと、現在の期間設定で横並び比較を作成します。
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              収入タブで、原資資産が「一般口座（オプション用）」の収入イベントを登録すると、ここに入金力別の診断表が表示されます。
            </p>
          )}
        </CardContent>
      </Card>

      <ScenarioSyncDetails
        title="一般口座オプションの流動資金化"
        description="オプション利益や運用終了後の資金が、使える現金へどれだけ回ったかを確認します。"
      >
      <Card>
        <CardHeader>
          <CardTitle>一般口座オプションの流動資金化</CardTitle>
          <CardDescription>
            {flexibleFreeCashLabel} に、オプション利益や運用終了後の一般口座資金がどれだけ現金・普通預金へ回ったかを確認します。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(260px,1.2fr)_minmax(260px,2fr)]">
            <Field label="このカードの表示シナリオ">
              <Select value={activeScenarioId} onChange={(event) => setActiveScenario(event.target.value)}>
                {scenarios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm leading-6 text-muted-foreground">
              現在は「{scenario.name}」の {flexibleFreeCashLabel} を表示しています。
              この期間内の一般口座オプション設定が同じシナリオでは、数値も同じになります。
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <div className="text-sm text-muted-foreground">申告対象利益</div>
              <div className="mt-1 text-xl font-semibold">{compactYen(optionLiquidityAnalysis.declaredOptionProfitTotal)}</div>
              <div className="mt-1 text-xs text-muted-foreground">一般口座オプション等の申告対象損益</div>
            </div>
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <div className="text-sm text-muted-foreground">利益の現金化</div>
              <div className="mt-1 text-xl font-semibold">{compactYen(optionLiquidityAnalysis.profitSweptToLiquidTotal)}</div>
              <div className="mt-1 text-xs text-muted-foreground">目標残高超過分を現金・普通預金へ</div>
            </div>
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <div className="text-sm text-muted-foreground">終了後の戻し</div>
              <div className="mt-1 text-xl font-semibold">{compactYen(optionLiquidityAnalysis.accountReleasedToLiquidTotal)}</div>
              <div className="mt-1 text-xs text-muted-foreground">運用終了後に一般口座から戻した額</div>
            </div>
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <div className="text-sm text-muted-foreground">使える資金へ回った額</div>
              <div className="mt-1 text-xl font-semibold text-teal-700">{compactYen(optionLiquidityAnalysis.optionToLiquidTotal)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                資産活用額比 {optionLiquidityShareOfAssetUse === null ? "-" : compactPercent(optionLiquidityShareOfAssetUse)}
              </div>
            </div>
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <div className="text-sm text-muted-foreground">停止された予定利益</div>
              <div className={`mt-1 text-xl font-semibold ${optionLiquidityAnalysis.suspendedIncomeTotal > 0 ? "text-red-600" : ""}`}>
                {compactYen(optionLiquidityAnalysis.suspendedIncomeTotal)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">最低維持額不足で入らなかった額</div>
            </div>
          </div>
          <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950">
            {optionLiquidityReading}
            {optionLiquidityAnalysis.optionToLiquidShareOfDeclaredProfit !== null && (
              <span>
                {" "}申告対象利益に対する流動資金化の目安は {compactPercent(optionLiquidityAnalysis.optionToLiquidShareOfDeclaredProfit)} です。
              </span>
            )}
          </div>
          <div className="rounded-md border bg-white px-4 py-3">
            <div className="text-sm font-medium">入金力の計算入力チェック</div>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              このシナリオで計算に使っている一般口座オプション収入です。10万・20万・30万シナリオを切り替えた時、ここが変わらなければ入力差分が計算に入っていません。
            </p>
            {optionIncomeAuditRows.length > 0 ? (
              <div className="table-scroll mt-3 overflow-auto">
                <Table className="min-w-[1080px]">
                  <thead>
                    <Tr>
                      <Th>収入名</Th>
                      <Th>月額</Th>
                      <Th>シナリオ名の入金力</Th>
                      <Th>{flexibleFreeCashLabel}<br />対象月数</Th>
                      <Th>{flexibleFreeCashLabel}<br />入金合計</Th>
                      <Th>反映先</Th>
                      <Th>サブ口座</Th>
                      <Th>補正</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {optionIncomeAuditRows.map((row) => (
                      <Tr key={row.id}>
                        <Td>{row.name}</Td>
                        <Td>{compactYen(row.monthlyAmount)}</Td>
                        <Td>{row.scenarioNameAmount === undefined ? "-" : compactYen(row.scenarioNameAmount)}</Td>
                        <Td>{row.activeMonthsInPeriod}か月</Td>
                        <Td>{compactYen(row.periodTotal)}</Td>
                        <Td>{row.payoutMode === "retainInSourceAsset" ? "原資口座内で積み上げる" : "現金収入にする"}</Td>
                        <Td>
                          {row.resolvedAccountName}
                          {row.configuredAccountName !== row.resolvedAccountName && (
                            <span className="ml-2 text-xs text-amber-700">元: {row.configuredAccountName}</span>
                          )}
                        </Td>
                        <Td className={row.isCorrected ? "text-amber-700" : "text-muted-foreground"}>
                          {row.isCorrected ? "名称から補正" : row.scenarioNameAmount === undefined ? "補正なし" : "一致"}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                このシナリオには一般口座オプションを原資にした定期入金がありません。
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      </ScenarioSyncDetails>

        </>
      )}

      {activeAssetUseTab === "review" && (
        <>

      <Card>
        <CardHeader>
          <CardTitle>特別支出内の楽しみ比率</CardTitle>
          <CardDescription>
            生活費・税社保を除き、旅行・趣味などの楽しみ支出が特別支出の中でどれくらいあるかを見ます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="font-medium">特別支出内</div>
              <div className="text-xs text-muted-foreground">楽しみカテゴリ / 特別支出カテゴリ合計</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-semibold text-teal-700">{compactPercent(enjoymentShare)}</div>
              <div className="text-xs text-muted-foreground">
                {compactYen(categoryBreakdown.enjoyment)} / {compactYen(specialExpenseReviewTotal)}
              </div>
            </div>
          </div>
          <div className="h-5 overflow-hidden rounded-full border bg-slate-100">
            <div className="h-full bg-teal-700" style={{ width: `${enjoymentSpecialExpensePercent}%` }} />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            生活費・税社保も含めた全支出内では {compactPercent(enjoymentAllExpenseShare)} です。全体の金額感は下の支出内訳で確認してください。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>健康寿命期の支出内訳</CardTitle>
          <CardDescription>
            {flexibleFreeCashLabel} の期間内だけを集計します。期間外の特別支出は、このグラフと表には含めません。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
          <div className="h-80 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} layout="vertical" margin={{ top: 8, right: 28, bottom: 8, left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} />
                <YAxis dataKey="name" type="category" width={88} />
                <Tooltip formatter={(value) => yen(Number(value))} />
                <Bar dataKey="amount" name="支出額" fill="#0f766e" maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="table-scroll overflow-auto">
            <Table className="min-w-[520px]">
              <thead>
                <Tr>
                  <Th>区分</Th>
                  <Th>金額</Th>
                  <Th>読み方</Th>
                </Tr>
              </thead>
              <tbody>
                {categoryRows.map((row) => (
                  <Tr key={row.label}>
                    <Td>{row.label}</Td>
                    <Td>{compactYen(row.value)}</Td>
                    <Td className="text-sm text-muted-foreground">{row.note}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </CardContent>
        {outOfPeriodSpecialExpenses.length > 0 && (
          <CardContent className="border-t">
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <div className="text-sm font-medium">この内訳に含まれていない特別支出</div>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                下記は {flexibleFreeCashLabel} の集計期間外にあるため、上のカテゴリ別内訳には入りません。住宅修繕などを健康寿命期の支出として見たい場合は、資産活用終了年齢または特別支出の年月を確認してください。
              </p>
              <div className="table-scroll mt-3 overflow-auto">
                <Table className="min-w-[640px]">
                  <thead>
                    <Tr>
                      <Th>名称</Th>
                      <Th>カテゴリ</Th>
                      <Th>年月・繰り返し</Th>
                      <Th>金額</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {outOfPeriodSpecialExpenses.slice(0, 8).map((event) => (
                      <Tr key={event.id}>
                        <Td>{event.name || "特別支出"}</Td>
                        <Td>{specialExpenseCategoryLabels[event.category ?? "lifeMaintenance"]}</Td>
                        <Td className="text-sm text-muted-foreground">{specialExpenseScheduleLabel(event)}</Td>
                        <Td>{compactYen(event.amount)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              {outOfPeriodSpecialExpenses.length > 8 && (
                <p className="mt-2 text-xs text-muted-foreground">ほか {outOfPeriodSpecialExpenses.length - 8} 件あります。</p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

        </>
      )}

      {activeAssetUseTab === "quickTrial" && (
        <>
      <ScenarioSyncDetails
        title="追加支出シミュレーター詳細"
        description="クイック試算の条件で、目標残高・期間末残高・最低流動資金を詳しく確認します。"
      >
      <Card>
        <CardHeader>
          <CardTitle>健康寿命期の追加支出シミュレーター詳細</CardTitle>
          <CardDescription>
            上のクイック試算で設定した条件を、詳細指標で確認します。保存データは変更しません。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
            {scenario.name} / {trialStartAge}〜{trialEndAge}歳 / 年{compactYen(trialAnnualAmount)} / {specialExpenseCategoryLabels[trialCategory]}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              title="追加支出総額"
              value={compactYen(additionalSpendingTrial.totalAddedExpense)}
              sub={`${additionalSpendingTrial.startYearMonth ?? "-"}〜${additionalSpendingTrial.endYearMonth ?? "-"} に月額 ${compactYen(additionalSpendingTrial.monthlyAmount)}`}
            />
            <Metric
              title={`${scenario.userProfile.targetBalanceAge}歳残高`}
              value={compactYen(additionalSpendingTrial.targetBalance.actualAmount)}
              sub={`現状比 ${compactYen(targetBalanceImpact)}`}
            />
            <Metric
              title="目標残高との差額"
              value={compactYen(additionalSpendingTrial.targetBalance.gap)}
              sub={`${scenario.userProfile.targetBalanceAge}歳目標 ${compactYen(additionalSpendingTrial.targetBalance.targetAmount)} との差`}
            />
            <Metric
              title="判定"
              value={targetBalanceStatusLabels[additionalSpendingTrial.targetBalance.status]}
              sub={additionalSpendingTrial.targetBalance.status === "shortfall" ? "この追加支出では目標割れです" : "目標残高を守る試算です"}
            />
            <Metric title="資産寿命" value={additionalSpendingTrial.depletionLabel} sub={additionalSpendingTrial.result.depletionYearMonth ?? "期間内維持"} />
            <Metric
              title={`${additionalSpendingTrial.input.endAge}歳時点残高`}
              value={compactYen(additionalSpendingTrial.flexibleFreeCash.periodEndBalance)}
              sub="追加支出込みの指定期間末残高"
            />
            <Metric
              title="期間中最低流動資金"
              value={compactYen(additionalSpendingTrial.flexibleFreeCash.minimumLiquidBuffer)}
              sub={`保持したい安全資金 ${compactYen(scenario.userProfile.cashReserve)}`}
            />
            <Metric
              title="年平均余力"
              value={compactYen(additionalSpendingTrial.flexibleFreeCash.averageAnnualFreeCash)}
              sub="追加支出込みの現金収支余力"
            />
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            この試算は、指定期間に年額追加支出を月割りで置いた場合の影響を見ます。実行する支出が単発旅行や数年おきの支出なら、後で特別支出タブに具体的な年月で登録してください。
          </p>
        </CardContent>
      </Card>
      </ScenarioSyncDetails>

        </>
      )}

      {activeAssetUseTab === "review" && (
        <>
      <ScenarioSyncDetails
        title="判定の前提"
        description="目標残高、計画取り崩し、安全資金、カテゴリ警告の前提を確認します。"
      >
      <Card>
        <CardHeader>
          <CardTitle>判定の前提</CardTitle>
          <CardDescription>
            目標残高は自動で使い切る設定ではなく、Die with Zero視点の判定基準として扱います。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            現在の「目標残高に向けた計画取り崩し」は{scenario.userProfile.plannedDrawdownEnabled ? "ON" : "OFF"}です。
            {scenario.userProfile.plannedDrawdownEnabled
              ? "シミュレーション内で目標残高に向けた計画取り崩しも反映されています。"
              : "目標残高は判定用であり、アプリが自動で目標残高まで使い切るわけではありません。"}
          </p>
          <p>
            予備・想定外の安全資金は特別支出ではなく、流動資金最低保持額に含めて扱います。
          </p>
          {categoryWarnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <div className="font-medium">カテゴリ確認が必要な特別支出があります</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {categoryWarnings.map((warning) => (
                  <li key={warning.eventId}>
                    {warning.eventName}: {warning.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
      </ScenarioSyncDetails>
        </>
      )}
    </div>
  );
}

function Dashboard({
  scenario,
  result,
  baselineScenario,
  onOpenFlexibleFreeCashSettings,
  onOpenInputCard,
  inputCards,
  onOpenInputGuide,
}: {
  scenario: ScenarioData;
  result: ReturnType<typeof simulateScenario>;
  baselineScenario: ScenarioData;
  onOpenFlexibleFreeCashSettings: () => void;
  onOpenInputCard: (cardId: InputCardId) => void;
  inputCards: InputCardDefinition[];
  onOpenInputGuide: () => void;
}) {
  const flexibleFreeCashPeriod = getScenarioFlexibleFreeCashPeriod(scenario);
  const flexibleFreeCashSummary = calculateFlexibleFreeCashSummary(result, flexibleFreeCashPeriod);
  const assetUseWaterfallRows = calculateAssetUseWaterfallRows(result, flexibleFreeCashPeriod);
  const specialExpenseCategoryTotals = calculateSpecialExpenseCategoryTotals(scenario, result, flexibleFreeCashPeriod);
  const diffSummary = buildScenarioDiffSummary(baselineScenario, scenario);
  const flexibleFreeCashLabel = flexibleFreeCashPeriodLabel(flexibleFreeCashSummary.period);
  const assetLifeValue = result.depletionYearMonth ? `${result.depletionAgeYears}歳${result.depletionAgeMonths}か月` : "期間内維持";
  const lifetimeTotalExpense = calculateLifetimeTotalExpenseSummary(result, scenario.userProfile.targetBalanceAge);
  const otherSpecialExpenseTotal = Math.max(0, flexibleFreeCashSummary.specialExpenseTotal - specialExpenseCategoryTotals.enjoyment);
  const chartData = result.annual.map((row) => ({
    year: String(row.year),
    age: `年末${row.ageYears}歳`,
    axisLabel: yearEndAgeLabel(row.year, row.ageYears),
    assets: row.endingAssets,
    withdrawal: row.withdrawalAmount,
  }));
  const cashflowChartData = result.annual.map((row) => ({
    label: yearEndAgeLabel(row.year, row.ageYears),
    income: row.incomeTotal,
    optionSweep: row.optionProfitSweepTotal + row.optionAccountReleaseTotal,
    living: -row.livingExpenseTotal,
    tax: -(row.taxInsuranceTotal + row.capitalGainsTaxTotal),
    special: -row.specialExpenseTotal,
    assetTransfer: -row.assetTransferTotal,
    contribution: -row.assetContributionTotal,
    net: row.netCashFlow,
  }));
  const annualEnjoymentChartData = result.annual
    .filter((row) => row.ageYears >= flexibleFreeCashSummary.period.startAge && row.ageYears <= flexibleFreeCashSummary.period.endAge)
    .map((annualRow) => {
      const yearMonths = result.monthly
        .filter((monthlyRow) => Number(monthlyRow.yearMonth.slice(0, 4)) === annualRow.year && monthlyRow.ageYears >= flexibleFreeCashSummary.period.startAge && monthlyRow.ageYears <= flexibleFreeCashSummary.period.endAge)
        .map((monthlyRow) => monthlyRow.yearMonth);
      const enjoyment = scenario.specialExpenses
        .filter((event) => (event.category ?? "lifeMaintenance") === "enjoyment")
        .reduce((eventSum, event) => {
          return eventSum + yearMonths.reduce((monthSum, yearMonth) => {
            return monthSum + (isSpecialExpenseActive(event, yearMonth) ? getSpecialExpenseAmountForMonth(scenario, event, yearMonth) : 0);
          }, 0);
        }, 0);
      return {
        label: yearEndAgeLabel(annualRow.year, annualRow.ageYears),
        enjoyment,
        assets: annualRow.endingAssets,
      };
    });
  const annualAssetUseBreakdownChartData = result.annual
    .filter((row) => row.ageYears >= flexibleFreeCashSummary.period.startAge && row.ageYears <= flexibleFreeCashSummary.period.endAge)
    .map((row) => ({
      label: yearEndAgeLabel(row.year, row.ageYears),
      living: row.livingExpenseTotal,
      tax: row.taxInsuranceTotal + row.capitalGainsTaxTotal + row.idecoWithholdingTaxTotal,
      special: row.specialExpenseTotal,
      idecoFee: row.idecoFeeTotal,
      assetUse: Math.max(0, -getAnnualFlexibleFreeCash(row)),
    }));
  const annualCapitalGainsChartData = result.annual
    .filter(
      (row) =>
        row.ageYears >= flexibleFreeCashSummary.period.startAge &&
        row.ageYears <= flexibleFreeCashSummary.period.endAge &&
        (row.capitalGainsTaxTotal > 0 || row.deferredCapitalGainsTaxTotal > 0 || row.declaredCapitalGainsIncomeTotal > 0),
    )
    .map((row) => ({
      label: yearEndAgeLabel(row.year, row.ageYears),
      withheld: row.capitalGainsTaxTotal,
      deferred: row.deferredCapitalGainsTaxTotal,
      declaredIncome: row.declaredCapitalGainsIncomeTotal,
    }));
  const assetUseWaterfallChartData = assetUseWaterfallRows.map((row) => ({
    ...row,
    displayAmount: row.amount,
    shortLabel: row.label === "一般口座から流動資金へ" ? "一般口座→流動資金" : row.label,
  }));
  const nisaProgressChartData = result.annual
    .filter((row) => row.ageYears >= flexibleFreeCashSummary.period.startAge && row.ageYears <= flexibleFreeCashSummary.period.endAge)
    .map((row) => ({
      label: yearEndAgeLabel(row.year, row.ageYears),
      executed: row.nisaContributionTotal,
      skipped: row.nisaContributionSkippedTotal,
      remaining: Number.isFinite(row.nisaRemainingLifetimeLimit) ? row.nisaRemainingLifetimeLimit : 0,
    }));
  const nisaSkippedTotal = nisaProgressChartData.reduce((sum, row) => sum + row.skipped, 0);
  const dashboardRequiredComplete = inputCards.filter((card) => card.priority === "required").every(isInputCardSatisfied);
  const dashboardNextCard = getNextInputCard(inputCards);
  const preRetirementDashboard = isPreRetirementScenario(scenario, result);
  const planningGoals = scenario.householdProfile.planningGoals ?? [];
  const planningGoalText = planningGoals.length > 0
    ? planningGoals.map((goal) => planningGoalLabels[goal]).filter(Boolean).join(" / ")
    : "60歳・65歳時点資産 / ライフイベント / 楽しみ支出";
  const targetBalanceAmount = scenario.userProfile.targetBalanceAmount ?? 0;
  const targetBalance = result.targetAgeBalance ?? 0;
  const targetBalanceGap = targetBalance - targetBalanceAmount;
  const targetStatus =
    targetBalanceGap >= 0
      ? `${scenario.userProfile.targetBalanceAge}歳の目標残高を上回っています`
      : `${scenario.userProfile.targetBalanceAge}歳の目標残高に不足しています`;
  const periodMonthCount = Math.max(1, flexibleFreeCashSummary.yearCount * 12);
  const monthlyAfterLivingAndTax =
    (flexibleFreeCashSummary.cashLikeIncomeTotal - flexibleFreeCashSummary.livingExpenseTotal - flexibleFreeCashSummary.taxAndSocialTotal) /
    periodMonthCount;
  const monthlyAfterAllSpending = flexibleFreeCashSummary.averageAnnualFreeCash / 12;
  const monthlyIncomeOnlyCashflowDescription =
    monthlyAfterLivingAndTax < 0
      ? `${flexibleFreeCashLabel}の通常収入だけでは、生活費と税社保に月平均${compactYen(Math.abs(monthlyAfterLivingAndTax))}不足します。不足分は下の資産活用額で補う計画です。楽しみ支出や追加投資は別に見ます。`
      : `${flexibleFreeCashLabel}の通常収入だけで、生活費と税社保を払った後に月平均${compactYen(monthlyAfterLivingAndTax)}の余力があります。楽しみ支出や追加投資は別に見ます。`;
  const showMonthlyCashflowAssetUseNote = monthlyAfterLivingAndTax < 0 && assetLifeValue === "期間内維持";
  const balanceAt60 = getAnnualBalanceAtAge(result, 60);
  const balanceAt65 = getAnnualBalanceAtAge(result, 65);
  const salaryEndAge = getSalaryEndAge(scenario, result);
  const earlyRetirementText =
    targetBalanceGap >= 0
      ? salaryEndAge
        ? `${salaryEndAge}歳終了案を比較`
        : "現在案は目標達成"
      : "シナリオ比較で確認";
  const enjoymentAnnualAverage = specialExpenseCategoryTotals.enjoyment / Math.max(1, flexibleFreeCashSummary.yearCount);
  const lifeEventAttentionYear = getLifeEventAttentionYear(scenario, result);
  const peakTaxYear = result.annual.reduce<AnnualResult | undefined>((peak, row) => {
    const rowTax = row.taxInsuranceTotal + row.capitalGainsTaxTotal + row.idecoWithholdingTaxTotal;
    const peakTax = peak ? peak.taxInsuranceTotal + peak.capitalGainsTaxTotal + peak.idecoWithholdingTaxTotal : -1;
    return rowTax > peakTax ? row : peak;
  }, undefined);
  const peakTaxTotal = peakTaxYear
    ? peakTaxYear.taxInsuranceTotal + peakTaxYear.capitalGainsTaxTotal + peakTaxYear.idecoWithholdingTaxTotal
    : 0;
  const firstAnnualRow = result.annual[0];
  const firstYearTaxTotal = firstAnnualRow
    ? firstAnnualRow.taxInsuranceTotal + firstAnnualRow.capitalGainsTaxTotal + firstAnnualRow.idecoWithholdingTaxTotal
    : 0;
  const nextAnnualRow = result.annual[1];
  const nextYearTaxTotal = nextAnnualRow
    ? nextAnnualRow.taxInsuranceTotal + nextAnnualRow.capitalGainsTaxTotal + nextAnnualRow.idecoWithholdingTaxTotal
    : 0;
  const taxAttentionText =
    peakTaxYear && peakTaxTotal > 0
      ? `${peakTaxYear.year}年（年末${peakTaxYear.ageYears}歳）に ${compactYen(peakTaxTotal)}`
      : "大きな税社保負担は見つかっていません";
  const nextYearTaxText = nextAnnualRow
    ? `${nextAnnualRow.year}年は ${compactYen(nextYearTaxTotal)}（初年度比 ${compactYen(nextYearTaxTotal - firstYearTaxTotal)}）`
    : "翌年データなし";
  const assetUseWaterfallColors: Record<(typeof assetUseWaterfallRows)[number]["kind"], string> = {
    inflow: "#0f766e",
    outflow: "#dc2626",
    net: flexibleFreeCashSummary.totalFreeCash < 0 ? "#b45309" : "#2563eb",
    assetUse: "#ea580c",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>まず見る結論</CardTitle>
              <CardDescription>
                {preRetirementDashboard
                  ? "60歳・65歳時点資産、働き方、ライフイベント、楽しみ支出を先に確認します。"
                  : "資産寿命、税金・社会保険を払った後の余力、注意が必要な年を先に確認します。"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {dashboardNextCard && (
                <Button variant="outline" size="sm" onClick={() => onOpenInputCard(dashboardNextCard.id)}>
                  {inputCardActionButtonLabel(dashboardNextCard, dashboardRequiredComplete)}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onOpenInputGuide}>
                入力ガイド
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {scenario.id === "base" && (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
              <span className="font-medium">これは入力練習用の匿名サンプルです。</span>{" "}
              年齢・資産・生活費・収入を初回設定から自分用に置き換えて使ってください。
            </div>
          )}
          {preRetirementDashboard && (
            <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950">
              <span className="font-medium">今回の見方:</span> {planningGoalText}。年金や退職金の詳細より先に、今後10〜15年の働き方・積立・大きな支出を確認します。
            </div>
          )}
          {preRetirementDashboard && (
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="rounded-md border bg-teal-50 px-4 py-4">
                <div className="text-sm font-medium text-teal-900">60歳時点の見込み資産</div>
                <div className="mt-2 text-2xl font-semibold text-teal-950">{balanceAt60 === undefined ? "試算範囲外" : compactYen(balanceAt60)}</div>
                <p className="mt-2 text-sm leading-6 text-teal-900">今の収入・積立・ライフイベントを入れた節目残高です。</p>
              </div>
              <div className="rounded-md border bg-cyan-50 px-4 py-4">
                <div className="text-sm font-medium text-cyan-900">65歳時点の見込み資産</div>
                <div className="mt-2 text-2xl font-semibold text-cyan-950">{balanceAt65 === undefined ? "試算範囲外" : compactYen(balanceAt65)}</div>
                <p className="mt-2 text-sm leading-6 text-cyan-900">仕事を続ける・減らす判断の比較基準です。</p>
              </div>
              <div className="rounded-md border bg-blue-50 px-4 py-4">
                <div className="text-sm font-medium text-blue-900">仕事をやめても成立しそうな年齢</div>
                <div className="mt-2 text-2xl font-semibold text-blue-950">{earlyRetirementText}</div>
                <p className="mt-2 text-sm leading-6 text-blue-900">P0では簡易表示です。早期リタイア案は比較タブで確認します。</p>
              </div>
              <div className="rounded-md border bg-rose-50 px-4 py-4">
                <div className="text-sm font-medium text-rose-900">健康なうちの楽しみ年額</div>
                <div className="mt-2 text-2xl font-semibold text-rose-950">{compactYen(enjoymentAnnualAverage)}</div>
                <p className="mt-2 text-sm leading-6 text-rose-900">{flexibleFreeCashLabel} の旅行・趣味・学びの年平均です。</p>
              </div>
              <div className="rounded-md border bg-amber-50 px-4 py-4">
                <div className="text-sm font-medium text-amber-900">ライフイベント注意年</div>
                <div className="mt-2 text-2xl font-semibold text-amber-950">
                  {lifeEventAttentionYear ? `${lifeEventAttentionYear.year}年` : "未登録"}
                </div>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  {lifeEventAttentionYear
                    ? `年末${lifeEventAttentionYear.ageYears}歳に ${compactYen(lifeEventAttentionYear.amount)} が重なります。`
                    : "教育費・住宅ローン・親の介護テンプレートから追加できます。"}
                </p>
              </div>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-md border bg-emerald-50 px-4 py-4">
              <div className="text-sm font-medium text-emerald-900">資産寿命</div>
              <div className="mt-2 text-3xl font-semibold text-emerald-950">{assetLifeValue}</div>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                {scenario.userProfile.targetBalanceAge}歳残高は {compactYen(targetBalance)}。目標との差は {compactYen(targetBalanceGap)} です。
              </p>
            </div>
            <div className="rounded-md border bg-blue-50 px-4 py-4">
              <div className="text-sm font-medium text-blue-900">通常収入だけで見た月平均収支</div>
              <div className={`mt-2 text-3xl font-semibold ${monthlyAfterLivingAndTax >= 0 ? "text-blue-950" : "text-red-700"}`}>
                {compactYen(monthlyAfterLivingAndTax)}
              </div>
              <p className="mt-2 text-sm leading-6 text-blue-900">
                {monthlyIncomeOnlyCashflowDescription}
              </p>
            </div>
            <div className="rounded-md border bg-amber-50 px-4 py-4">
              <div className="text-sm font-medium text-amber-900">税社保の注意年</div>
              <div className="mt-2 text-2xl font-semibold text-amber-950">{taxAttentionText}</div>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                翌年負担: {nextYearTaxText}。所得が出た翌年に負担が増える年は税社保タブで確認します。
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-md border bg-white px-4 py-3">
              <div className="font-medium text-slate-900">{targetStatus}</div>
              <p className="mt-1 leading-6 text-muted-foreground">目標残高は「残高確認年齢」と「その時点で残したい金額」で調整できます。</p>
              <Button className="mt-3" variant="outline" size="sm" onClick={() => onOpenInputCard("profile-family-period")}>
                目標を見直す
              </Button>
            </div>
            <div className="rounded-md border bg-white px-4 py-3">
              <div className={`font-medium ${monthlyAfterAllSpending >= 0 ? "text-slate-900" : "text-red-700"}`}>
                楽しみ支出なども含めた月次収支: {compactYen(monthlyAfterAllSpending)}
              </div>
              <p className="mt-1 leading-6 text-muted-foreground">特別支出、iDeCo手数料、資産活用を含む期間平均です。</p>
              <Button className="mt-3" variant="outline" size="sm" onClick={() => onOpenInputCard("expenses-monthly")}>
                生活費を見直す
              </Button>
            </div>
            <div className="rounded-md border bg-white px-4 py-3">
              <div className="font-medium text-slate-900">楽しみ支出: {compactYen(specialExpenseCategoryTotals.enjoyment)}</div>
              <p className="mt-1 leading-6 text-muted-foreground">{flexibleFreeCashLabel} に登録された旅行・趣味などの合計です。</p>
              <Button className="mt-3" variant="outline" size="sm" onClick={() => onOpenInputCard("special-expenses")}>
                特別支出を確認
              </Button>
            </div>
          </div>
          {showMonthlyCashflowAssetUseNote && (
            <p className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
              退職後は月次収支がマイナスでも、資産活用額と将来残高が十分なら計画上は維持できます。
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="現在資産" value={compactYen(getTotalAssets(scenario))} sub={`取り崩し対象 ${compactYen(getSimulationTargetAssets(scenario))}`} />
        <Metric
          title="生涯総支出"
          value={formatLifetimeExpenseYen(lifetimeTotalExpense.total)}
          sub={`開始月〜${scenario.userProfile.targetBalanceAge}歳。生活費 ${compactYen(lifetimeTotalExpense.living)} / 税社保 ${compactYen(lifetimeTotalExpense.taxAndSocial)} / 特別支出 ${compactYen(lifetimeTotalExpense.special)}`}
        />
        <Metric
          title={`${flexibleFreeCashLabel} 資産活用額`}
          value={compactYen(flexibleFreeCashSummary.assetUtilizationAmount)}
          sub={
            flexibleFreeCashSummary.totalFreeCash < 0
              ? "通常収入だけでは足りない生活費・税社保・特別支出などを資産で補う総額"
              : `通常収入ベースの現金収支余力 ${compactYen(flexibleFreeCashSummary.totalFreeCash)}`
          }
        />
        <Metric title={`${flexibleFreeCashSummary.period.endAge}歳時点残高`} value={compactYen(flexibleFreeCashSummary.periodEndBalance)} sub="指定期間末の年末資産" />
        <Metric title={`${flexibleFreeCashLabel} 楽しみ支出`} value={compactYen(specialExpenseCategoryTotals.enjoyment)} sub="特別支出カテゴリが楽しみの合計" />
        <Metric title={`${flexibleFreeCashLabel} 生活・税社保支出`} value={compactYen(flexibleFreeCashSummary.livingExpenseTotal + flexibleFreeCashSummary.taxAndSocialTotal)} sub="判断用の要約。内訳は下のウォーターフォールで確認" />
        <Metric title={`${flexibleFreeCashLabel} その他特別支出`} value={compactYen(otherSpecialExpenseTotal)} sub="生活維持、住宅・車、医療、家族支援" />
        <Metric
          title="NISA実行額 / 残り枠"
          value={compactYen(flexibleFreeCashSummary.nisaContributionTotal)}
          sub={`残り ${compactLimitYen(flexibleFreeCashSummary.nisaRemainingLifetimeLimit)}`}
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-medium text-muted-foreground">資産活用集計期間</div>
            <div className="mt-1 text-2xl font-semibold">{flexibleFreeCashLabel}</div>
          </div>
          <div className="max-w-3xl text-sm leading-6 text-muted-foreground">
            <span className="font-medium text-slate-800">資産活用額:</span>{" "}
            生活費・税社保・特別支出を現金収入だけで賄えず資産で補った額。追加投資は別指標です。
            <span className="ml-0 block md:ml-2 md:inline">期間変更は基本情報の資産活用年齢で行います。</span>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenFlexibleFreeCashSettings} className="shrink-0">
            期間を設定
          </Button>
        </CardContent>
      </Card>

      {specialExpenseCategoryTotals.enjoyment === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="font-medium">楽しみ支出が未登録です</div>
          <p className="mt-1 leading-6">
            タイムバケットで候補を整理するか、資産活用タブのクイック試算で年額候補を試すと、健康寿命期に使えるお金を判断しやすくなります。
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{flexibleFreeCashLabel} 資産活用ウォーターフォール</CardTitle>
          <CardDescription>
            上の支出カードの根拠です。現金収入と一般口座から流動資金へ戻した額で、生活費・税社保・特別支出をどこまで賄えたかを見ます。NISAなどの追加投資はここには含めません。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <div className="h-[28rem] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assetUseWaterfallChartData} layout="vertical" margin={{ top: 8, right: 28, bottom: 8, left: 36 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} />
                <YAxis dataKey="shortLabel" type="category" width={150} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => yen(Number(value))} />
                <ReferenceArea y1="現金収支" y2="資産活用額" fill="#fef3c7" fillOpacity={0.45} strokeOpacity={0} />
                <Bar dataKey="displayAmount" name="金額" maxBarSize={28}>
                  {assetUseWaterfallChartData.map((row) => (
                    <Cell key={row.key} fill={assetUseWaterfallColors[row.kind]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="table-scroll overflow-auto">
            <Table className="min-w-[520px]">
              <thead>
                <Tr>
                  <Th>区分</Th>
                  <Th>金額</Th>
                  <Th>読み方</Th>
                </Tr>
              </thead>
              <tbody>
                {assetUseWaterfallRows.map((row) => (
                  <Tr key={row.key} className={row.section === "result" ? "bg-amber-50" : ""}>
                    <Td>
                      {row.section === "result" && <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">ネット</span>}
                      {row.label}
                    </Td>
                    <Td className={row.amount < 0 ? "text-red-600" : row.kind === "assetUse" ? "text-amber-700" : ""}>
                      {compactYen(row.amount)}
                    </Td>
                    <Td className="text-sm text-muted-foreground">{row.description}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>資産残高推移</CardTitle>
          <CardDescription>年末資産残高だけを確認します。取り崩しや追加投資の原資不足は、結果タブの詳細で分けて確認します。</CardDescription>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="axisLabel" interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <Tooltip formatter={(value) => yen(Number(value))} />
              <Area dataKey="assets" name="年末資産" stroke="#0f766e" fill="#99f6e4" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{flexibleFreeCashLabel} 楽しみ支出と資産残高</CardTitle>
          <CardDescription>
            健康寿命期に使う楽しみ支出を年齢別に見ます。棒は楽しみ支出、線は年末資産残高です。
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={annualEnjoymentChartData} barCategoryGap="32%" margin={{ top: 8, right: 18, bottom: 54, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={12} />
              <YAxis yAxisId="enjoyment" tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <YAxis yAxisId="assets" orientation="right" tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <Tooltip formatter={(value) => yen(Number(value))} wrapperStyle={{ zIndex: 20 }} />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 18 }} />
              <Bar yAxisId="enjoyment" dataKey="enjoyment" name="楽しみ支出" fill="#e11d48" maxBarSize={22} />
              <Line yAxisId="assets" type="monotone" dataKey="assets" name="年末資産残高" stroke="#0f766e" strokeWidth={3} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{flexibleFreeCashLabel} 資産活用額の年別内訳</CardTitle>
          <CardDescription>
            年ごとの支出要因と、現金収支で足りず資産で補った額を並べます。棒は支出要因、線は資産活用額です。
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={annualAssetUseBreakdownChartData} barCategoryGap="20%" barGap={2} margin={{ top: 8, right: 18, bottom: 54, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={12} />
              <YAxis yAxisId="spending" tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <YAxis yAxisId="assetUse" orientation="right" tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <Tooltip formatter={(value) => yen(Number(value))} wrapperStyle={{ zIndex: 20 }} />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 18 }} />
              <Bar yAxisId="spending" dataKey="living" name="生活費" stackId="spending" fill="#475569" maxBarSize={24} />
              <Bar yAxisId="spending" dataKey="tax" name="税社保・源泉/譲渡益税" stackId="spending" fill="#dc2626" maxBarSize={24} />
              <Bar yAxisId="spending" dataKey="special" name="特別支出" stackId="spending" fill="#ea580c" maxBarSize={24} />
              <Bar yAxisId="spending" dataKey="idecoFee" name="iDeCo手数料" stackId="spending" fill="#7c3aed" maxBarSize={24} />
              <Line yAxisId="assetUse" type="monotone" dataKey="assetUse" name="資産活用額" stroke="#b45309" strokeWidth={3} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{flexibleFreeCashLabel} 譲渡益税と申告対象利益</CardTitle>
          <CardDescription>
            棒は税額、紫の線は翌年の申告・税社保計算に入る運用利益です。紫の線は税額ではありません。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-md border bg-red-50 px-4 py-3 text-red-950">
              <div className="font-medium">棒: その年に直接見える税額</div>
              <p className="mt-1 text-xs leading-5">売却時に差し引かれた譲渡益税、または源泉なし等で翌年扱いにする税額です。</p>
            </div>
            <div className="rounded-md border bg-violet-50 px-4 py-3 text-violet-950">
              <div className="font-medium">紫の線: 翌年申告に入る利益額</div>
              <p className="mt-1 text-xs leading-5">売却時に差し引かれる税額ではなく、翌年の所得税・住民税・国保等の計算に入る利益額です。</p>
            </div>
          </div>
          <div className="h-80">
          {annualCapitalGainsChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={annualCapitalGainsChartData} barCategoryGap="24%" barGap={3} margin={{ top: 8, right: 18, bottom: 54, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={12} />
                <YAxis yAxisId="tax" tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
                <YAxis yAxisId="income" orientation="right" tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
                <Tooltip formatter={(value) => yen(Number(value))} wrapperStyle={{ zIndex: 20 }} />
                <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 18 }} />
                <Bar yAxisId="tax" dataKey="withheld" name="売却時に差し引かれた譲渡益税" fill="#dc2626" maxBarSize={22} />
                <Bar yAxisId="tax" dataKey="deferred" name="源泉なし等の翌年扱い税額" fill="#f97316" maxBarSize={22} />
                <Line yAxisId="income" type="monotone" dataKey="declaredIncome" name="翌年申告に入る運用利益" stroke="#7c3aed" strokeWidth={3} dot />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-sm text-muted-foreground">
              {flexibleFreeCashLabel} に譲渡益課税・申告対象損益はありません。
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{flexibleFreeCashLabel} NISA実行・未実行・残り枠</CardTitle>
          <CardDescription>
            年ごとのNISA実行額と未実行額を棒で、残り生涯枠を線で見ます。左軸は年次額、右軸は残り枠です。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.65fr)]">
          <div className="h-80 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={nisaProgressChartData} barCategoryGap="28%" barGap={3} margin={{ top: 8, right: 18, bottom: 54, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={12} />
                <YAxis yAxisId="annual" tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
                <YAxis yAxisId="limit" orientation="right" tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
                <Tooltip formatter={(value) => yen(Number(value))} wrapperStyle={{ zIndex: 20 }} />
                <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 18 }} />
                <Bar yAxisId="annual" dataKey="executed" name="NISA実行額" fill="#0f766e" maxBarSize={18} />
                <Bar yAxisId="annual" dataKey="skipped" name="NISA未実行額" fill="#dc2626" maxBarSize={18} />
                <Line yAxisId="limit" type="monotone" dataKey="remaining" name="残りNISA枠" stroke="#2563eb" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-lg border bg-slate-50 p-4">
            <div className="text-sm font-medium text-muted-foreground">期間合計</div>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="text-sm text-muted-foreground">NISA実行額</dt>
                <dd className="text-2xl font-semibold text-emerald-700">{compactYen(flexibleFreeCashSummary.nisaContributionTotal)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">NISA未実行額</dt>
                <dd className={`text-2xl font-semibold ${nisaSkippedTotal > 0 ? "text-red-600" : "text-slate-900"}`}>{compactYen(nisaSkippedTotal)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">期間末の残りNISA枠</dt>
                <dd className="text-2xl font-semibold text-blue-700">{compactLimitYen(flexibleFreeCashSummary.nisaRemainingLifetimeLimit)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              未実行額が出る年は、NISA枠そのものではなく、その年の投資原資や流動資金の条件で予定額を入れきれなかった可能性があります。
            </p>
          </div>
        </CardContent>
      </Card>

      <ScenarioDiffSummaryCard baselineScenario={baselineScenario} targetScenario={scenario} diffSummary={diffSummary} />

      <details className="rounded-lg border bg-white px-4 py-3">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
          <span>
            <span className="block font-medium">年別の流動資金（現金・普通預金）フロー</span>
            <span className="text-sm text-muted-foreground">原因調査用の詳細チャートです。必要な時だけ開きます。</span>
          </span>
          <span className="rounded-md border bg-slate-50 px-3 py-1 text-sm text-muted-foreground">開く</span>
        </summary>
        <div className="mt-4 h-[30rem]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashflowChartData} barCategoryGap="18%" barGap={2} maxBarSize={14} margin={{ top: 8, right: 28, bottom: 72, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <Tooltip formatter={(value) => yen(Number(value))} wrapperStyle={{ zIndex: 20 }} />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 18 }} />
              <Bar dataKey="income" name="現金収入" fill="#0f766e" />
              <Bar dataKey="optionSweep" name="一般口座から現金・普通預金へ" fill="#14b8a6" />
              <Bar dataKey="living" name="生活費" fill="#334155" />
              <Bar dataKey="tax" name="税社保支払" fill="#dc2626" />
              <Bar dataKey="special" name="特別支出" fill="#ea580c" />
              <Bar dataKey="assetTransfer" name="原資移動" fill="#64748b" />
              <Bar dataKey="contribution" name="追加投資" fill="#7c3aed" />
              <Bar dataKey="net" name="純現金収支" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </details>
    </div>
  );
}

function ScenarioDiffSummaryCard({
  baselineScenario,
  targetScenario,
  diffSummary,
}: {
  baselineScenario: ScenarioData;
  targetScenario: ScenarioData;
  diffSummary: ScenarioDiffSummary;
}) {
  const isBaseline = baselineScenario.id === targetScenario.id;
  return (
    <ScenarioSyncDetails
      title={`基準との差分（基準: ${baselineScenario.name}）`}
      description="必要な時だけ、表示中シナリオの入力条件が基準とどう違うかを確認します。基準は比較タブの「基準シナリオ」で変更できます。"
    >
      <div className="space-y-3">
        <p className="text-sm leading-6 text-muted-foreground">
          表示中: {targetScenario.name}。シナリオを一番上へ移動する必要はありません。比較タブで選んだ基準シナリオを使います。
        </p>
        {isBaseline ? (
          <p className="text-sm text-muted-foreground">このシナリオが比較基準です。</p>
        ) : diffSummary.headlineItems.length > 0 ? (
          <ul className="space-y-2 text-sm leading-6">
            {diffSummary.headlineItems.map((item) => (
              <li key={item.id} className="rounded-md border bg-slate-50 px-3 py-2">
                {item.summary}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">基準との差分は見つかりません。</p>
        )}
      </div>
    </ScenarioSyncDetails>
  );
}

function Metric({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="break-words text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function ProfileSection({
  scenario,
  scenarios,
  updateScenario,
  updateScenarios,
}: SectionProps & {
  scenarios: ScenarioData[];
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData, backupLabel?: string) => void;
}) {
  const [profileSyncTargetMode, setProfileSyncTargetMode] = useState<AssetSyncTargetMode>("compare");
  const [profileSyncSelectedTargetIds, setProfileSyncSelectedTargetIds] = useState<string[]>([]);
  const [profileSyncSourceScenarioId, setProfileSyncSourceScenarioId] = useState(scenario.id);
  const [excludeCurrentScenarioFromProfileSync, setExcludeCurrentScenarioFromProfileSync] = useState(true);
  const [profileSyncOptions, setProfileSyncOptions] = useState<ProfileSyncOptions>({
    basicProfile: true,
    flexibleFreeCashPeriod: true,
    household: true,
  });
  const [profileSyncMessage, setProfileSyncMessage] = useState<string | null>(null);
  const flexibleFreeCashPeriod = getScenarioFlexibleFreeCashPeriod(scenario);
  const profileSyncSourceScenario = scenarios.find((item) => item.id === profileSyncSourceScenarioId) ?? scenario;
  const profileSyncSourceIsCurrentScenario = profileSyncSourceScenario.id === scenario.id;
  const profileSyncExcludedScenarioIds = useMemo(() => {
    const excludedIds = new Set<string>();
    if (excludeCurrentScenarioFromProfileSync && !profileSyncSourceIsCurrentScenario) excludedIds.add(scenario.id);
    return excludedIds;
  }, [excludeCurrentScenarioFromProfileSync, profileSyncSourceIsCurrentScenario, scenario.id]);
  useEffect(() => {
    if (!scenarios.some((item) => item.id === profileSyncSourceScenarioId)) {
      setProfileSyncSourceScenarioId(scenario.id);
    }
  }, [profileSyncSourceScenarioId, scenario.id, scenarios]);
  const profileSyncSelectedTargetIdSet = useMemo(() => new Set(profileSyncSelectedTargetIds), [profileSyncSelectedTargetIds]);
  const profileSyncTargetCount = countAssetSyncTargets(
    scenarios,
    profileSyncSourceScenario.id,
    profileSyncTargetMode,
    profileSyncExcludedScenarioIds,
    profileSyncSelectedTargetIdSet,
  );
  const profileSyncTargetNames = getAssetSyncTargets(
    scenarios,
    profileSyncSourceScenario.id,
    profileSyncTargetMode,
    profileSyncExcludedScenarioIds,
    profileSyncSelectedTargetIdSet,
  ).map((item) => item.name);
  const hasProfileSyncSelection = Object.values(profileSyncOptions).some(Boolean);
  const selectedProfileSyncLabels = [
    profileSyncOptions.basicProfile ? "年齢・期間・目標残高など" : "",
    profileSyncOptions.flexibleFreeCashPeriod ? "資産活用集計期間" : "",
    profileSyncOptions.household ? "世帯情報・税扶養・国保状態" : "",
  ].filter(Boolean);
  const updateProfileSyncOption = (key: keyof ProfileSyncOptions) => {
    setProfileSyncOptions((current) => ({ ...current, [key]: !current[key] }));
  };
  const toggleProfileSyncTarget = (scenarioId: string) => {
    setProfileSyncSelectedTargetIds((current) =>
      current.includes(scenarioId) ? current.filter((id) => id !== scenarioId) : [...current, scenarioId],
    );
  };
  const applyProfileSync = () => {
    if (profileSyncTargetCount === 0 || !hasProfileSyncSelection) return;
    const source = structuredClone(profileSyncSourceScenario);
    const confirmed = window.confirm(
      `「${source.name}」の ${selectedProfileSyncLabels.join("、")} を、コピー元自身を除く ${profileSyncTargetCount} 件のシナリオへ反映します。` +
        (!profileSyncSourceIsCurrentScenario && excludeCurrentScenarioFromProfileSync
          ? `現在開いている「${scenario.name}」は反映先から外します。`
          : "") +
        `\n\n反映先:\n${formatScenarioNamesForConfirm(profileSyncTargetNames)}\n\nシナリオ名は変更しません。実行しますか？`,
    );
    if (!confirmed) return;
    updateScenarios((target) => {
      if (!isAssetSyncTarget(target, source.id, profileSyncTargetMode, profileSyncExcludedScenarioIds, profileSyncSelectedTargetIdSet)) return target;
      applyProfileSyncFromSource(target, source, profileSyncOptions);
      return target;
    });
    setProfileSyncMessage(
      `${profileSyncTargetCount} 件のシナリオへ基本情報を反映しました: ${formatScenarioNamesForMessage(profileSyncTargetNames)}。実行前の状態は履歴に保存されています。`,
    );
  };
  return (
    <Card id="profile-family-period" data-input-card-id="profile-family-period">
      <CardHeader>
          <CardTitle>基本情報入力</CardTitle>
          <CardDescription>年齢計算、シミュレーション期間、指定年齢残高に使います。</CardDescription>
        </CardHeader>
        <CardContent>
          <FormGrid>
          <Field label="シナリオ名">
            <Input value={scenario.name} onChange={(event) => updateScenario((s) => void (s.name = event.target.value))} />
          </Field>
          <Field label="生年月日">
            <Input
              type="date"
              value={scenario.userProfile.birthDate}
              onChange={(event) =>
                updateScenario((s) => {
                  s.userProfile.birthDate = event.target.value;
                  const self = s.householdMembers.find((member) => member.relationship === "self") ?? s.householdMembers[0];
                  if (self) self.birthDate = event.target.value;
                })
              }
            />
            <p className="mt-1 text-xs leading-5 text-muted-foreground">ここを変えると、下の世帯メンバー「本人」の生年月日も同じ年月日にそろえます。</p>
          </Field>
          <Field label="開始年月">
            <Input type="month" value={scenario.userProfile.simulationStartYearMonth} onChange={(event) => updateScenario((s) => void (s.userProfile.simulationStartYearMonth = event.target.value))} />
          </Field>
          <Field label="終了条件">
            <Select value={scenario.userProfile.simulationEndMode} onChange={(event) => updateScenario((s) => void (s.userProfile.simulationEndMode = event.target.value as "age" | "yearMonth"))}>
              <option value="age">年齢まで</option>
              <option value="yearMonth">指定年月まで</option>
            </Select>
          </Field>
          <Field label="終了年齢">
            <Input
              type="number"
              min={60}
              max={130}
              value={scenario.userProfile.simulationEndAge ?? 95}
              onChange={(event) => updateScenario((s) => void (s.userProfile.simulationEndAge = seniorAgeOrDefault(event.target.value, 95)))}
            />
          </Field>
          <Field label="終了年月">
            <Input type="month" value={scenario.userProfile.simulationEndYearMonth ?? ""} onChange={(event) => updateScenario((s) => void (s.userProfile.simulationEndYearMonth = event.target.value))} />
          </Field>
          <Field label="指定年齢時点残高を見る年齢">
            <Input
              type="number"
              min={60}
              max={130}
              value={scenario.userProfile.targetBalanceAge}
              onChange={(event) => updateScenario((s) => void (s.userProfile.targetBalanceAge = seniorAgeOrDefault(event.target.value, 90)))}
            />
          </Field>
          <Field label="指定年齢時点の目標残高">
            <Input
              type="number"
              min={0}
              value={scenario.userProfile.targetBalanceAmount ?? 0}
              onChange={(event) => updateScenario((s) => void (s.userProfile.targetBalanceAmount = numberOrZero(event.target.value)))}
            />
          </Field>
          <Field label="目標残高に向けた計画取り崩し">
            <Select
              value={scenario.userProfile.plannedDrawdownEnabled ? "on" : "off"}
              onChange={(event) => updateScenario((s) => void (s.userProfile.plannedDrawdownEnabled = event.target.value === "on"))}
            >
              <option value="off">OFF</option>
              <option value="on">ON</option>
            </Select>
          </Field>
          <Field label="流動資金最低保持額">
            <Input
              type="number"
              min={0}
              value={scenario.userProfile.cashReserve}
              onChange={(event) => updateScenario((s) => void (s.userProfile.cashReserve = numberOrZero(event.target.value)))}
            />
            <p className="mt-1 text-xs text-muted-foreground">予備・想定外に備えて保持したい安全資金もここに含めます。</p>
          </Field>
          <Field label="居住自治体">
            <Input
              value={scenario.userProfile.municipality ?? ""}
              onChange={(event) =>
                updateScenario((s) => {
                  s.userProfile.municipality = event.target.value;
                  s.householdProfile.municipality = event.target.value;
                })
              }
            />
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              税金・社会保険の概算で参考にする自治体です。現在の自動計算は東京都大田区などの前提を中心にしています。
            </p>
          </Field>
          <Field label="配偶者有無">
            <Select
              value={scenario.userProfile.hasSpouse ? "yes" : "no"}
              onChange={(event) =>
                updateScenario((s) => {
                  const hasSpouse = event.target.value === "yes";
                  s.userProfile.hasSpouse = hasSpouse;
                  if (hasSpouse) ensureSpouseMember(s);
                })
              }
            >
              <option value="no">なし</option>
              <option value="yes">あり</option>
            </Select>
          </Field>
        </FormGrid>
        <div id="asset-use-period-settings" className="mt-6 scroll-mt-28 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <div className="mb-3">
            <div className="font-medium text-sky-950">資産活用集計期間</div>
            <p className="mt-1 text-sm leading-6 text-sky-900">
              ダッシュボード、資産活用ビュー、比較タブで使う共通期間です。
            </p>
          </div>
          <FlexibleFreeCashPeriodFields period={flexibleFreeCashPeriod} updateScenario={updateScenario} />
        </div>
        <div className="mt-4">
          <Field label="メモ">
            <Textarea value={scenario.userProfile.note ?? ""} onChange={(event) => updateScenario((s) => void (s.userProfile.note = event.target.value))} />
          </Field>
        </div>
        <div className="mt-6">
          <HouseholdSection scenario={scenario} updateScenario={updateScenario} />
        </div>
        <ScenarioSyncDetails
          title="他シナリオへ反映（必要時のみ）"
          description="基本情報、資産活用集計期間、世帯情報を他シナリオへ反映します。"
        >
          <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(220px,320px)_1fr]">
            <Field label="コピー元シナリオ">
              <Select value={profileSyncSourceScenario.id} onChange={(event) => setProfileSyncSourceScenarioId(event.target.value)}>
                {scenarios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            {!profileSyncSourceIsCurrentScenario && (
              <label className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={excludeCurrentScenarioFromProfileSync}
                  onChange={() => setExcludeCurrentScenarioFromProfileSync((current) => !current)}
                />
                現在開いているシナリオを反映先から外す
              </label>
            )}
          </div>
          <ScenarioSyncCard<keyof ProfileSyncOptions>
            title="基本情報を他シナリオへ反映"
            description="コピー元シナリオを選び、基本情報の前提だけを他シナリオへ反映します。シナリオ名、資産、生活費、収入、特別支出は変更しません。"
            targetMode={profileSyncTargetMode}
            setTargetMode={setProfileSyncTargetMode}
            targetCount={profileSyncTargetCount}
            targetNames={profileSyncTargetNames}
            allScenarios={scenarios}
            sourceScenarioId={profileSyncSourceScenario.id}
            excludedScenarioIds={profileSyncExcludedScenarioIds}
            selectedTargetIds={profileSyncSelectedTargetIdSet}
            toggleSelectedTarget={toggleProfileSyncTarget}
            targetSummary={
              `コピー元「${profileSyncSourceScenario.name}」自身を除く ${profileSyncTargetCount} 件に反映します。` +
              (!profileSyncSourceIsCurrentScenario && excludeCurrentScenarioFromProfileSync
                ? `現在開いている「${scenario.name}」は反映先から外します。`
                : "")
            }
            options={[
              { key: "basicProfile", label: "年齢・期間・目標残高など", description: "生年月日、開始/終了条件、指定年齢残高、計画取り崩し、最低流動資金、自治体、配偶者有無" },
              { key: "flexibleFreeCashPeriod", label: "資産活用集計期間", description: "ダッシュボード、資産レビュー、比較タブで使う開始年齢・終了年齢" },
              { key: "household", label: "世帯情報・税扶養・国保状態", description: "世帯主、税社保計算モード、世帯メンバー、税扶養・国保変更、同居状態変更" },
            ]}
            selectedOptions={profileSyncOptions}
            toggleOption={updateProfileSyncOption}
            warningText="シナリオ名はコピーしません。世帯情報を反映すると、既存の収入・退職所得イベントの対象メンバーは続柄や名前が近いメンバーへ付け替えます。"
            onApply={applyProfileSync}
            message={profileSyncMessage}
            applyDisabled={!hasProfileSyncSelection}
          />
        </ScenarioSyncDetails>
      </CardContent>
    </Card>
  );
}

type SectionProps = {
  scenario: ScenarioData;
  updateScenario: (updater: (scenario: ScenarioData) => void) => void;
  targetCardId?: InputCardId | null;
};

type ReviewAcknowledgementInputCardId = Extract<InputCardId, "tax-retirement-overlap" | "income-ideco-lump" | "assets-cost-basis">;

function stableReviewFingerprint(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableReviewFingerprint).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    return `{${Object.keys(objectValue)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableReviewFingerprint(objectValue[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function reviewSourceKey(source: RetirementOverlapAdjustment["currentSource"]) {
  return `${source.kind}:${source.eventId}`;
}

function buildRetirementOverlapReviewFingerprint(scenario: ScenarioData, adjustments: RetirementOverlapAdjustment[]) {
  const recordsBySource = new Map(buildRetirementIncomeRecords(scenario).map((record) => [reviewSourceKey(record.source), record]));
  return stableReviewFingerprint({
    cardId: "tax-retirement-overlap",
    adjustments: adjustments.map((item) => {
      const currentRecord = recordsBySource.get(reviewSourceKey(item.currentSource));
      const priorRecord = recordsBySource.get(reviewSourceKey(item.priorSource));
      return {
        id: item.id,
        targetEventId: item.currentSource.eventId,
        targetSourceKind: item.currentSource.kind,
        targetPaymentYearMonth: item.currentPaymentYearMonth,
        targetAmount: currentRecord?.grossAmount ?? null,
        targetServiceYears: currentRecord?.serviceYears ?? null,
        targetServiceStartDate: currentRecord?.serviceStartDate ?? null,
        targetServiceEndDate: currentRecord?.serviceEndDate ?? null,
        targetAlreadyReceived: currentRecord?.alreadyReceived ?? null,
        targetDeductionUsed: currentRecord?.retirementIncomeDeductionUsed ?? null,
        targetWithholdingTaxPaid: currentRecord?.withholdingTaxPaid ?? null,
        targetResidentTaxMunicipalPaid: currentRecord?.residentTaxMunicipalPaid ?? null,
        targetResidentTaxPrefecturalPaid: currentRecord?.residentTaxPrefecturalPaid ?? null,
        pastEventId: item.priorSource.eventId,
        pastSourceKind: item.priorSource.kind,
        pastPaymentYearMonth: item.priorPaymentYearMonth,
        pastAmount: priorRecord?.grossAmount ?? null,
        pastServiceYears: priorRecord?.serviceYears ?? null,
        pastServiceStartDate: priorRecord?.serviceStartDate ?? null,
        pastServiceEndDate: priorRecord?.serviceEndDate ?? null,
        pastAlreadyReceived: priorRecord?.alreadyReceived ?? null,
        pastDeductionUsed: priorRecord?.retirementIncomeDeductionUsed ?? null,
        pastWithholdingTaxPaid: priorRecord?.withholdingTaxPaid ?? null,
        pastResidentTaxMunicipalPaid: priorRecord?.residentTaxMunicipalPaid ?? null,
        pastResidentTaxPrefecturalPaid: priorRecord?.residentTaxPrefecturalPaid ?? null,
        overlapYears: item.estimatedOverlapYears,
        adjustedDeduction: item.adjustedDeduction,
      };
    }),
  });
}

function isReviewAcknowledged(scenario: ScenarioData, cardId: ReviewAcknowledgementInputCardId, fingerprint: string) {
  return scenario.reviewAcknowledgements?.some((item) => item.cardId === cardId && item.fingerprint === fingerprint) ?? false;
}

function acknowledgeReviewCard(scenario: ScenarioData, cardId: ReviewAcknowledgementInputCardId, fingerprint: string) {
  scenario.reviewAcknowledgements = [
    ...(scenario.reviewAcknowledgements ?? []).filter((item) => item.cardId !== cardId),
    { cardId, fingerprint, acknowledgedAt: new Date().toISOString() },
  ];
}

function statusLabel(status: InputCardStatus) {
  const labels: Record<InputCardStatus, string> = {
    not_started: "未入力",
    incomplete: "不足あり",
    complete: "完了",
    review_recommended: "確認推奨",
    reviewed: "確認済み",
    not_applicable: "対象外",
    inactive: "計算対象外",
  };
  return labels[status];
}

function priorityLabel(priority: InputCardPriority) {
  const labels: Record<InputCardPriority, string> = {
    required: "必須",
    recommended: "推奨",
    detail: "詳細",
    expert: "専門",
  };
  return labels[priority];
}

function inputCardStatusClass(status: InputCardStatus) {
  if (status === "complete") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "reviewed") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (status === "review_recommended") return "border-amber-200 bg-amber-50 text-amber-950";
  if (status === "not_applicable" || status === "inactive") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-rose-200 bg-rose-50 text-rose-950";
}

function inputCardHighlightClass(highlight: InputCardHighlight) {
  if (highlight === "next_required") return "ring-2 ring-amber-300";
  if (highlight === "targeted" || highlight === "current") return "ring-2 ring-sky-300";
  if (highlight === "blocked") return "ring-2 ring-rose-300";
  if (highlight === "review") return "ring-1 ring-amber-200";
  return "";
}

function isInputCardActionable(card: InputCardDefinition) {
  return card.status === "not_started" || card.status === "incomplete" || card.status === "review_recommended";
}

function isInputCardSatisfied(card: InputCardDefinition) {
  return card.status === "complete" || card.status === "reviewed" || card.status === "review_recommended" || card.status === "not_applicable" || card.status === "inactive";
}

function getExpenseOtherShare(monthlyExpenses: MonthlyExpenseProfile, excludeTaxExpense: boolean) {
  const total = getBaseMonthlyExpense(monthlyExpenses, excludeTaxExpense);
  if (total <= 0) return 0;
  return Math.max(0, monthlyExpenses.other ?? 0) / total;
}

function hasLargeUnclassifiedExpense(monthlyExpenses: MonthlyExpenseProfile, excludeTaxExpense: boolean) {
  return getExpenseOtherShare(monthlyExpenses, excludeTaxExpense) >= 0.5;
}

function isPreRetirementScenario(scenario: ScenarioData, result?: ReturnType<typeof simulateScenario>) {
  const firstMonth = result?.monthly[0];
  const currentAge = firstMonth?.ageYears ?? getSelfAgeAtStart(scenario);
  const startYearMonth = scenario.userProfile.simulationStartYearMonth;
  return scenario.incomeEvents.some(
    (event) =>
      event.type === "salary" &&
      event.monthlyAmount > 0 &&
      (!event.endYearMonth || event.endYearMonth >= startYearMonth) &&
      currentAge < 65,
  );
}

function getSelfAgeAtStart(scenario: ScenarioData) {
  const self =
    scenario.householdMembers.find((member) => member.relationship === "self") ??
    scenario.householdMembers.find((member) => member.id === scenario.householdProfile.headMemberId) ??
    scenario.householdMembers[0];
  const birthYear = Number(self?.birthDate?.slice(0, 4));
  const startYear = Number(scenario.userProfile.simulationStartYearMonth?.slice(0, 4));
  if (!Number.isFinite(birthYear) || !Number.isFinite(startYear)) return 0;
  return Math.max(0, startYear - birthYear);
}

function getAnnualBalanceAtAge(result: ReturnType<typeof simulateScenario>, age: number) {
  const row = result.annual.find((item) => item.ageYears >= age);
  return row?.endingAssets;
}

function getSalaryEndAge(scenario: ScenarioData, result: ReturnType<typeof simulateScenario>) {
  const salaryEvents = scenario.incomeEvents.filter((event) => event.type === "salary" && event.monthlyAmount > 0);
  const endYearMonths = salaryEvents.map((event) => event.endYearMonth).filter((yearMonth): yearMonth is string => Boolean(yearMonth));
  if (endYearMonths.length === 0) return undefined;
  const lastEnd = endYearMonths.sort().at(-1);
  if (!lastEnd) return undefined;
  return result.monthly.find((row) => row.yearMonth >= lastEnd)?.ageYears;
}

function getLifeEventExpenses(scenario: ScenarioData) {
  return scenario.specialExpenses.filter((event) => event.note?.includes(lifeEventNoteMarker) || event.name.includes(lifeEventNoteMarker));
}

function getLifeEventAttentionYear(scenario: ScenarioData, result: ReturnType<typeof simulateScenario>) {
  const lifeEvents = getLifeEventExpenses(scenario);
  if (lifeEvents.length === 0) return undefined;
  const rows = result.annual.map((row) => {
    const yearMonths = result.monthly
      .filter((monthlyRow) => Number(monthlyRow.yearMonth.slice(0, 4)) === row.year)
      .map((monthlyRow) => monthlyRow.yearMonth);
    const amount = lifeEvents.reduce((sum, event) => {
      return sum + yearMonths.reduce((monthSum, yearMonth) => monthSum + (isSpecialExpenseActive(event, yearMonth) ? getSpecialExpenseAmountForMonth(scenario, event, yearMonth) : 0), 0);
    }, 0);
    return { year: row.year, ageYears: row.ageYears, amount };
  });
  return rows.reduce<typeof rows[number] | undefined>((peak, row) => {
    if (row.amount <= 0) return peak;
    if (!peak || row.amount > peak.amount) return row;
    return peak;
  }, undefined);
}

function addYearsToYearMonth(yearMonth: string, years: number) {
  const year = Number(yearMonth.slice(0, 4));
  const month = yearMonth.slice(5, 7) || "04";
  return `${year + years}-${month}`;
}

function getNextInputCard(cards: InputCardDefinition[]) {
  const nextRequired = cards.find((card) => card.priority === "required" && (card.status === "not_started" || card.status === "incomplete"));
  if (nextRequired) return nextRequired;
  return cards.find(isInputCardActionable);
}

function getInputCardActionKind(card: InputCardDefinition | undefined, requiredComplete: boolean) {
  if (!card) return "none" as const;
  if (card.priority === "expert") return "expert" as const;
  if (card.status === "review_recommended") return "recommended" as const;
  if (!requiredComplete && card.priority === "required") return "required" as const;
  if (card.priority === "recommended" || requiredComplete) return "recommended" as const;
  return "required" as const;
}

function inputCardActionHeading(card: InputCardDefinition | undefined, requiredComplete: boolean) {
  const kind = getInputCardActionKind(card, requiredComplete);
  if (kind === "required") return "次の意思決定";
  if (kind === "recommended") return "次に確認";
  if (kind === "expert") return "必要なら確認";
  return "主要入力は完了";
}

function inputCardActionButtonLabel(card: InputCardDefinition | undefined, requiredComplete: boolean) {
  if (!card) return "入力ガイドを開く";
  if (card.id === "income-ideco" || card.id === "income-ideco-lump") return "iDeCo受取を確認する";
  const kind = getInputCardActionKind(card, requiredComplete);
  if (kind === "required") return "ここを入力する";
  if (kind === "expert") return "必要なら確認する";
  return "ここを確認する";
}

function inputCardDecisionTitle(card: InputCardDefinition | undefined) {
  if (!card) return "主要入力は完了";
  const decisions: Partial<Record<InputCardId, string>> = {
    "profile-family-period": "何歳時点の資産を見たいか",
    "assets-current": "現在資産と負債をどう置くか",
    "assets-cost-basis": "運用資産の評価益をどこまで入れるか",
    "expenses-monthly": "毎月生活費と未分類支出をどう置くか",
    "income-pension": "何歳まで今の働き方を続けるか",
    "income-ideco": "iDeCoをいつ・どう受け取るか",
    "income-ideco-lump": "iDeCo一時金の受取条件をどう置くか",
    "tax-mode": "税金・社会保険を概算で見るか詳しく見るか",
    "tax-retirement-overlap": "退職金とiDeCo一時金の重なりを確認するか",
    "special-expenses": "教育費・住宅ローン・親の介護・体験支出をどう入れるか",
  };
  return decisions[card.id] ?? card.title;
}

function inputCardActionLabel(card: InputCardDefinition | undefined, requiredComplete: boolean) {
  const kind = getInputCardActionKind(card, requiredComplete);
  if (kind === "required") return "次の意思決定";
  if (kind === "recommended") return "次に確認";
  if (kind === "expert") return "必要なら確認";
  return "";
}

function inputCardLocationLabel(card: InputCardDefinition) {
  return `${inputTabLabels[card.tab]}タブにあります`;
}

function inputCardVisibilityFor(card: Omit<InputCardDefinition, "visibility" | "highlight">): InputCardVisibility {
  if (card.status === "not_applicable") return card.priority === "expert" ? "hidden" : "summary";
  if (card.status === "inactive") return "summary";
  if (card.status === "incomplete" || card.status === "not_started") return "always";
  if (card.priority === "detail" || card.priority === "expert") return "collapsed";
  return "summary";
}

function withInputCardUiState(cards: Array<Omit<InputCardDefinition, "visibility" | "highlight">>): InputCardDefinition[] {
  const nextRequiredCard = cards.find((card) => card.priority === "required" && (card.status === "not_started" || card.status === "incomplete"));
  const nextReviewCard = nextRequiredCard ? undefined : cards.find((card) => isInputCardActionable(card as InputCardDefinition));
  return cards.map((card) => ({
    ...card,
    visibility: inputCardVisibilityFor(card),
    highlight:
      card.id === nextRequiredCard?.id
        ? "next_required"
        : card.id === nextReviewCard?.id
          ? card.priority === "expert" ? "review" : "next_required"
        : card.status === "incomplete" || card.status === "not_started"
          ? "blocked"
          : card.status === "review_recommended"
            ? "review"
            : "none",
  }));
}

function buildInputCards(scenario: ScenarioData): InputCardDefinition[] {
  const selfMember =
    scenario.householdMembers.find((member) => member.relationship === "self") ??
    scenario.householdMembers.find((member) => member.id === scenario.householdProfile.headMemberId) ??
    scenario.householdMembers[0];
  const spouseMember = scenario.householdMembers.find((member) => member.relationship === "spouse");
  const profileMissing = [
    !scenario.userProfile.birthDate && "生年月日",
    !scenario.userProfile.simulationStartYearMonth && "開始年月",
    scenario.userProfile.simulationEndMode === "yearMonth" && !scenario.userProfile.simulationEndYearMonth && "終了年月",
    scenario.userProfile.simulationEndMode === "age" && !scenario.userProfile.simulationEndAge && "終了年齢",
  ].filter(Boolean) as string[];
  const totalAssets = getTotalAssets(scenario);
  const simulationAssets = getSimulationTargetAssets(scenario);
  const excludeTaxExpense = shouldIgnoreTaxExpenseField(scenario);
  const expenseTotal = getBaseMonthlyExpense(scenario.monthlyExpenses, excludeTaxExpense);
  const largeUnclassifiedExpense = hasLargeUnclassifiedExpense(scenario.monthlyExpenses, excludeTaxExpense);
  const preRetirementScenario = isPreRetirementScenario(scenario);
  const pensionSettings = mergePensionPlannerSettings(scenario, selfMember, spouseMember);
  const pensionTotal =
    pensionSettings.selfBasicAnnual +
    pensionSettings.selfEmployeesAnnual +
    pensionSettings.spouseBasicAnnual +
    pensionSettings.spouseEmployeesAnnual;
  const idecoBalance = Math.max(0, scenario.initialAssets.ideco);
  const idecoEvents = scenario.incomeEvents.filter((event) => event.sourceAssetKey === "ideco");
  const idecoLumpSumEvents = idecoEvents.filter((event) => event.type === "oneTime");
  const idecoLumpMissing = Array.from(
    new Set(
        idecoLumpSumEvents.flatMap((event) => [
          !event.startYearMonth && "受取年月",
          event.monthlyAmount <= 0 && "一時金受取額",
          getIdecoLumpSumContributionYears(event, 0) <= 0 && "iDeCo拠出年数",
          !event.idecoLumpSumTaxMode && "退職所得の申告",
        ]).filter(Boolean) as string[],
    ),
  );
  const idecoLumpDateMissing = idecoLumpSumEvents.some(
    (event) => !event.idecoLumpSumContributionStartDate || !event.idecoLumpSumContributionEndDate,
  );
  const taxableAssets = scenario.initialAssets.specificAccount + scenario.initialAssets.ordinaryAccountForOptions;
  const costBasisMissing = taxableAssets > 0 && costBasisKeys.some((key) => {
    if (scenario.initialAssets[key] <= 0) return false;
    return scenario.initialAssetCostBasis[key] <= 0;
  });
  const specialMissing = scenario.specialExpenses.some((event) => !event.yearMonth || event.amount <= 0);
  const lifeEventCount = getLifeEventExpenses(scenario).length;
  const retirementAdjustments = getRetirementOverlapAdjustments(scenario);
  const retirementOverlapFingerprint = buildRetirementOverlapReviewFingerprint(scenario, retirementAdjustments);
  const retirementOverlapReviewed =
    retirementAdjustments.length > 0 && isReviewAcknowledged(scenario, "tax-retirement-overlap", retirementOverlapFingerprint);

  return withInputCardUiState([
    {
      id: "profile-family-period",
      title: "家族・期間",
      priority: "required",
      status: profileMissing.length > 0 ? "incomplete" : "complete",
      summary: `${selfMember?.name ?? "本人"} / ${spouseMember ? "配偶者あり" : "単身"} / ${scenario.userProfile.simulationEndMode === "age" ? `${scenario.userProfile.simulationEndAge ?? 95}歳まで` : `${scenario.userProfile.simulationEndYearMonth ?? "終了年月未設定"}まで`}`,
      missingItems: profileMissing,
      tab: "profile",
      nextCardId: "assets-current",
    },
    {
      id: "assets-current",
      title: "現在資産",
      priority: "required",
      status: "complete",
      summary: `現在資産 ${compactYen(totalAssets)} / 取り崩し対象 ${compactYen(simulationAssets)}${scenario.assetContributionEvents.length > 0 ? " / 積立予定あり" : ""}`,
      missingItems: [],
      tab: "assets",
      nextCardId: "expenses-monthly",
    },
    {
      id: "assets-cost-basis",
      title: "NISA・iDeCo・特定口座などの評価額と評価損益",
      priority: "recommended",
      status: costBasisMissing ? "review_recommended" : "complete",
      summary: costBasisMissing ? "課税口座の取得原価が未設定です" : "取得原価の概算入力があります",
      missingItems: costBasisMissing ? ["取得原価"] : [],
      tab: "assets",
      nextCardId: "expenses-monthly",
    },
    {
      id: "expenses-monthly",
      title: "毎月の生活費",
      priority: "required",
      status: expenseTotal <= 0 ? "incomplete" : largeUnclassifiedExpense ? "review_recommended" : "complete",
      summary: largeUnclassifiedExpense
        ? `月平均生活費 ${compactYen(expenseTotal)} / 生活費の内訳を確認`
        : `月平均生活費 ${compactYen(expenseTotal)}`,
      missingItems: expenseTotal <= 0 ? ["毎月生活費"] : largeUnclassifiedExpense ? ["生活費の内訳"] : [],
      tab: "expenses",
      nextCardId: "income-pension",
    },
    {
      id: "income-pension",
      title: "公的年金",
      priority: preRetirementScenario ? "recommended" : "required",
      status: pensionTotal > 0 ? "complete" : "incomplete",
      summary: preRetirementScenario
        ? `現在収入・働き方を先に確認 / 65歳標準年額 ${compactYen(pensionTotal)}`
        : `65歳標準年額 ${compactYen(pensionTotal)}`,
      missingItems: pensionTotal > 0 ? [] : ["年金見込み額"],
      tab: "income",
      nextCardId: "tax-mode",
    },
    {
      id: "income-ideco",
      title: "iDeCo受取",
      priority: "recommended",
      status: idecoBalance <= 0 ? "not_applicable" : idecoEvents.length > 0 ? "complete" : "review_recommended",
      summary: idecoBalance <= 0 ? "iDeCo残高なし" : idecoEvents.length > 0 ? `iDeCo受取 ${idecoEvents.length}件` : `iDeCo残高 ${compactYen(idecoBalance)} の受取方法を確認`,
      missingItems: idecoBalance > 0 && idecoEvents.length === 0 ? ["iDeCo受取方法"] : [],
      tab: "income",
      nextCardId: "tax-mode",
    },
    {
      id: "income-ideco-lump",
      title: "iDeCo一時金",
      priority: "required",
      status:
        idecoLumpSumEvents.length === 0
          ? "not_applicable"
          : idecoLumpMissing.length > 0
            ? "incomplete"
            : idecoLumpDateMissing
              ? "review_recommended"
              : "complete",
      summary:
        idecoLumpSumEvents.length === 0
          ? "iDeCo一時金なし"
          : idecoLumpDateMissing
            ? "加入開始日/終了日を入れると期間入力ベースになります"
            : `iDeCo一時金 ${idecoLumpSumEvents.length}件`,
      missingItems: idecoLumpMissing.length > 0 ? idecoLumpMissing : idecoLumpDateMissing ? ["加入開始日/終了日"] : [],
      tab: "income",
      nextCardId: "tax-retirement-overlap",
    },
    {
      id: "tax-mode",
      title: "税金・社会保険の計算方法",
      priority: "required",
      status: scenario.householdProfile.taxCalculationMode ? "complete" : "incomplete",
      summary: taxModeHelp[scenario.householdProfile.taxCalculationMode].label,
      missingItems: scenario.householdProfile.taxCalculationMode ? [] : ["計算モード"],
      tab: "tax",
      nextCardId: "special-expenses",
    },
    {
      id: "tax-retirement-overlap",
      title: "退職所得控除の重複調整",
      priority: "expert",
      status: retirementAdjustments.length === 0 ? "not_applicable" : retirementOverlapReviewed ? "reviewed" : "review_recommended",
      summary:
        retirementAdjustments.length === 0
          ? "対象イベントなし"
          : retirementOverlapReviewed
            ? `重複調整 ${retirementAdjustments.length}件を確認済み`
            : `重複調整 ${retirementAdjustments.length}件を確認`,
      missingItems: retirementAdjustments.length > 0 && !retirementOverlapReviewed ? ["退職所得控除の重複調整"] : [],
      tab: "tax",
      nextCardId: "special-expenses",
    },
    {
      id: "special-expenses",
      title: "ライフイベント・やりたいこと",
      priority: "recommended",
      status: scenario.specialExpenses.length === 0 ? "not_applicable" : specialMissing ? "incomplete" : "complete",
      summary:
        scenario.specialExpenses.length === 0
          ? "登録なし"
          : `ライフイベント ${lifeEventCount}件 / 特別支出 ${scenario.specialExpenses.length}件`,
      missingItems: specialMissing ? ["金額または年月"] : [],
      tab: "special",
    },
  ]);
}

function ensureSpouseMember(scenario: ScenarioData) {
  if (scenario.householdMembers.some((member) => member.relationship === "spouse")) return;
  scenario.householdMembers.push({
    id: createId(),
    name: "配偶者",
    relationship: "spouse",
    birthDate: scenario.userProfile.birthDate,
    isResident: true,
    isNationalHealthInsuranceMember: false,
    isLateElderlyMedicalMember: false,
    isLongTermCareInsured: false,
    isDependent: false,
  });
}

function syncOptionInitialAssets(scenario: ScenarioData) {
  const accounts = scenario.optionSubAccounts ?? [];
  scenario.initialAssets.ordinaryAccountForOptions = accounts.reduce((sum, account) => sum + Math.max(0, account.initialValue), 0);
  scenario.initialAssetCostBasis.ordinaryAccountForOptions = accounts.reduce(
    (sum, account) => sum + Math.min(Math.max(0, account.initialCostBasis), Math.max(0, account.initialValue)),
    0,
  );
}

function StatusSelect({
  label,
  value,
  yesLabel,
  noLabel,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  yesLabel: string;
  noLabel: string;
  onChange: (value: boolean | undefined) => void;
}) {
  return (
    <Field label={label}>
      <Select
        value={value === undefined ? "unchanged" : value ? "yes" : "no"}
        onChange={(event) => onChange(event.target.value === "unchanged" ? undefined : event.target.value === "yes")}
      >
        <option value="unchanged">変更しない</option>
        <option value="yes">{yesLabel}</option>
        <option value="no">{noLabel}</option>
      </Select>
    </Field>
  );
}

function HouseholdSection({ scenario, updateScenario }: SectionProps) {
  const selectedTaxMode = taxModeHelp[scenario.householdProfile.taxCalculationMode];
  const addMember = () =>
    updateScenario((s) =>
      s.householdMembers.push({
        id: createId(),
        name: `メンバー${s.householdMembers.length + 1}`,
        relationship: "other",
        birthDate: s.userProfile.birthDate,
        isResident: true,
        isNationalHealthInsuranceMember: false,
        isLateElderlyMedicalMember: false,
        isLongTermCareInsured: false,
        isDependent: false,
      }),
    );
  const addLivingArrangementEvent = () =>
    updateScenario((s) => {
      const targetMember =
        s.householdMembers.find((member) => member.relationship === "child" && member.isResident) ??
        s.householdMembers.find((member) => member.relationship !== "self") ??
        s.householdMembers[0];
      s.householdLivingArrangementEvents.push({
        id: createId(),
        memberId: targetMember?.id ?? s.householdMembers[0]?.id ?? "",
        name: `${targetMember?.name ?? "家族"}の別居`,
        changeType: "moveOut",
        changeYearMonth: s.userProfile.simulationStartYearMonth,
        appliesToLivingExpenses: true,
        expenseKeys: [...defaultHouseholdLivingExpenseKeys],
        reductionMode: "fixedAmount",
        reductionAmount: 0,
        reductionRate: 0,
      });
    });
  const addMemberStatusEventForMember = (memberId?: string) =>
    updateScenario((s) => {
      const targetMember =
        (memberId ? s.householdMembers.find((member) => member.id === memberId) : undefined) ??
        s.householdMembers.find((member) => member.relationship === "child") ??
        s.householdMembers.find((member) => member.relationship !== "self") ??
        s.householdMembers[0];
      s.householdMemberStatusEvents.push({
        id: createId(),
        memberId: targetMember?.id ?? s.householdMembers[0]?.id ?? "",
        name: `${targetMember?.name ?? "家族"}の税扶養・国保変更`,
        changeYearMonth: s.userProfile.simulationStartYearMonth,
        isResident: undefined,
        isNationalHealthInsuranceMember: undefined,
        isDependent: false,
        dependsOnMemberId: undefined,
        isLateElderlyMedicalMember: undefined,
        isLongTermCareInsured: undefined,
      });
    });
  const addMemberStatusEvent = () => addMemberStatusEventForMember();
  const duplicateMemberStatusEvent = (index: number) =>
    updateScenario((s) => {
      const source = s.householdMemberStatusEvents[index];
      if (!source) return;
      s.householdMemberStatusEvents.splice(index + 1, 0, {
        ...structuredClone(source),
        id: createId(),
        name: source.name ? `${source.name} コピー` : "税扶養・国保変更 コピー",
      });
    });
  const duplicateLivingArrangementEvent = (index: number) =>
    updateScenario((s) => {
      const source = s.householdLivingArrangementEvents[index];
      if (!source) return;
      s.householdLivingArrangementEvents.splice(index + 1, 0, {
        ...structuredClone(source),
        id: createId(),
        name: source.name ? `${source.name} コピー` : "別居予定 コピー",
      });
    });
  const toggleLivingExpenseKey = (index: number, key: ExpenseKey) =>
    updateScenario((s) => {
      const event = s.householdLivingArrangementEvents[index];
      if (!event) return;
      event.expenseKeys = event.expenseKeys.includes(key)
        ? event.expenseKeys.filter((item) => item !== key)
        : [...event.expenseKeys, key];
    });
  const headMember = scenario.householdMembers.find((member) => member.id === scenario.householdProfile.headMemberId) ?? scenario.householdMembers[0];

  return (
    <div className="rounded-lg border bg-white">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">世帯情報</h3>
            <p className="text-sm text-muted-foreground">税・社会保険の自動化に備えて、世帯単位の前提を持たせます。</p>
          </div>
        </div>
      </div>
      <div className="space-y-6 p-4">
        <FormGrid>
          <Field label="居住自治体">
            <Input
              value={scenario.householdProfile.municipality}
              onChange={(event) =>
                updateScenario((s) => {
                  s.householdProfile.municipality = event.target.value;
                  s.userProfile.municipality = event.target.value;
                })
              }
            />
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              税金・社会保険の概算で参考にする自治体です。現在の自動計算は東京都大田区などの前提を中心にしています。
            </p>
          </Field>
          <Field label="世帯主">
            <Select
              value={scenario.householdProfile.headMemberId}
              onChange={(event) => updateScenario((s) => void (s.householdProfile.headMemberId = event.target.value))}
            >
              {scenario.householdMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="税社保計算">
            <Select
              value={scenario.householdProfile.taxCalculationMode}
              onChange={(event) => updateScenario((s) => void (s.householdProfile.taxCalculationMode = event.target.value as HouseholdProfile["taxCalculationMode"]))}
            >
              <option value="manual">手入力</option>
              <option value="auto">自動計算</option>
              <option value="autoWithAdjustment">自動計算 + 補正</option>
            </Select>
          </Field>
          <Field label="世帯メモ">
            <Textarea
              value={scenario.householdProfile.notes ?? ""}
              onChange={(event) => updateScenario((s) => void (s.householdProfile.notes = event.target.value))}
              rows={3}
            />
          </Field>
        </FormGrid>
        <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">現在の設定: {selectedTaxMode.label}</p>
          <p>{selectedTaxMode.description}</p>
          <p className="mt-1">通常は `自動計算` を選び、通知書との差だけ直したいときだけ `自動計算 + 補正` を使います。</p>
        </div>

        <div className="rounded-lg border bg-slate-50">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h3 className="font-medium">世帯メンバー</h3>
              <p className="text-sm text-muted-foreground">
                ここは現在時点の状態です。税計算上の扶養・配偶者控除と、国保加入は別々に設定します。将来変わる場合は下の状態変更で年月を登録します。
              </p>
            </div>
            <Button onClick={addMember}>
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
          <div className="space-y-4 p-4">
            {scenario.householdMembers.map((member, index) => (
              <EventEditor
                key={member.id}
                title={member.name || `メンバー${index + 1}`}
                onDelete={() =>
                  updateScenario((s) => {
                    if (s.householdMembers.length <= 1) return;
                    s.householdMembers.splice(index, 1);
                    if (s.householdProfile.headMemberId === member.id) {
                      s.householdProfile.headMemberId = s.householdMembers[0]?.id ?? "";
                    }
                    const removedLivingEventIds = new Set(
                      s.householdLivingArrangementEvents.filter((event) => event.memberId === member.id).map((event) => event.id),
                    );
                    s.householdLivingArrangementEvents = s.householdLivingArrangementEvents.filter((event) => event.memberId !== member.id);
                    s.householdMemberStatusEvents = s.householdMemberStatusEvents.filter((event) => event.memberId !== member.id);
                    s.incomeEvents = s.incomeEvents.map((event) =>
                      event.memberId === member.id || removedLivingEventIds.has(event.linkedHouseholdLivingArrangementEventId ?? "")
                        ? {
                            ...event,
                            memberId: event.memberId === member.id ? s.householdMembers[0]?.id ?? event.memberId : event.memberId,
                            linkedHouseholdLivingArrangementEventId: removedLivingEventIds.has(event.linkedHouseholdLivingArrangementEventId ?? "")
                              ? undefined
                              : event.linkedHouseholdLivingArrangementEventId,
                          }
                        : event,
                    );
                  })
                }
              >
                {member.relationship !== "self" && (
                  <p className="mb-4 text-sm text-muted-foreground">
                    「税計算上の扶養・配偶者控除」を入るにすると、{headMember?.name ?? "世帯主"} の所得税・住民税の控除対象として判定します。
                    会社の健康保険の扶養とは別です。退職後に国保へ加入する場合でも、税計算上の扶養に入ることがあります。
                  </p>
                )}
                <FormGrid>
                  <Field label="名前">
                    <Input
                      value={member.name}
                      onChange={(event) => updateScenario((s) => void (s.householdMembers[index].name = event.target.value))}
                    />
                  </Field>
                  <Field label="続柄">
                    <Select
                      value={member.relationship}
                      onChange={(event) => updateScenario((s) => void (s.householdMembers[index].relationship = event.target.value as HouseholdRelationship))}
                    >
                      {Object.entries(relationshipLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="生年月日">
                    <Input
                      type="date"
                      value={member.birthDate}
                      onChange={(event) =>
                        updateScenario((s) => {
                          s.householdMembers[index].birthDate = event.target.value;
                          if (s.householdMembers[index].relationship === "self") {
                            s.userProfile.birthDate = event.target.value;
                          }
                        })
                      }
                    />
                  </Field>
                  <Field label="居住">
                    <Select
                      value={member.isResident ? "yes" : "no"}
                      onChange={(event) => updateScenario((s) => void (s.householdMembers[index].isResident = event.target.value === "yes"))}
                    >
                      <option value="yes">同居</option>
                      <option value="no">別居</option>
                    </Select>
                  </Field>
                  <Field label="国保加入">
                    <Select
                      value={member.isNationalHealthInsuranceMember ? "yes" : "no"}
                      onChange={(event) =>
                        updateScenario((s) => void (s.householdMembers[index].isNationalHealthInsuranceMember = event.target.value === "yes"))
                      }
                    >
                      <option value="yes">加入</option>
                      <option value="no">対象外</option>
                    </Select>
                  </Field>
                  <Field label="後期高齢者医療">
                    <Select
                      value={member.isLateElderlyMedicalMember ? "yes" : "no"}
                      onChange={(event) =>
                        updateScenario((s) => void (s.householdMembers[index].isLateElderlyMedicalMember = event.target.value === "yes"))
                      }
                    >
                      <option value="yes">対象</option>
                      <option value="no">対象外</option>
                    </Select>
                  </Field>
                  <Field label="介護保険">
                    <Select
                      value={member.isLongTermCareInsured ? "yes" : "no"}
                      onChange={(event) =>
                        updateScenario((s) => void (s.householdMembers[index].isLongTermCareInsured = event.target.value === "yes"))
                      }
                    >
                      <option value="yes">対象</option>
                      <option value="no">対象外</option>
                    </Select>
                  </Field>
                  {member.relationship !== "self" && (
                    <Field label="税計算上の扶養・配偶者控除">
                      <Select
                        value={member.isDependent ? "yes" : "no"}
                        onChange={(event) =>
                          updateScenario((s) => {
                            const isDependent = event.target.value === "yes";
                            s.householdMembers[index].isDependent = isDependent;
                            s.householdMembers[index].dependsOnMemberId = isDependent ? s.householdProfile.headMemberId : undefined;
                          })
                        }
                      >
                        <option value="no">入らない</option>
                        <option value="yes">入る</option>
                      </Select>
                    </Field>
                  )}
                </FormGrid>
                {member.relationship !== "self" && (
                  <div className="mt-4 rounded-md border bg-white px-3 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        将来このメンバーが税計算上の扶養・配偶者控除から外れる、または国保加入が変わる場合は、年月付きの変更予定を追加します。
                      </p>
                      <Button variant="outline" size="sm" onClick={() => addMemberStatusEventForMember(member.id)}>
                        <Plus className="h-4 w-4" />
                        税扶養・国保変更を追加
                      </Button>
                    </div>
                  </div>
                )}
                <div className="mt-4">
                  <Field label="備考">
                    <Textarea
                      value={member.notes ?? ""}
                      onChange={(event) => updateScenario((s) => void (s.householdMembers[index].notes = event.target.value))}
                    />
                  </Field>
                </div>
              </EventEditor>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-slate-50">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h3 className="font-medium">税扶養・国保などの状態変更</h3>
              <p className="text-sm text-muted-foreground">
                就職・退職・独立などで税計算上の扶養・配偶者控除や国保加入が変わる年月を登録します。税扶養はその年の年末判定、国保・国民年金は月単位で反映します。
              </p>
            </div>
            <Button onClick={addMemberStatusEvent}>
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
          <div className="space-y-4 p-4">
            {scenario.householdMemberStatusEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">税扶養・国保などの状態変更はまだありません。</p>
            ) : (
              scenario.householdMemberStatusEvents.map((event, index) => (
                <EventEditor
                  key={event.id}
                  title={event.name || "税扶養・国保変更"}
                  onDelete={() => updateScenario((s) => void s.householdMemberStatusEvents.splice(index, 1))}
                  actions={
                    <Button variant="ghost" size="sm" onClick={() => duplicateMemberStatusEvent(index)}>
                      <Copy className="h-4 w-4" />
                      複製
                    </Button>
                  }
                >
                  <FormGrid>
                    <Field label="名称">
                      <Input
                        value={event.name}
                        onChange={(e) => updateScenario((s) => void (s.householdMemberStatusEvents[index].name = e.target.value))}
                      />
                    </Field>
                    <Field label="対象メンバー">
                      <Select
                        value={event.memberId}
                        onChange={(e) => updateScenario((s) => void (s.householdMemberStatusEvents[index].memberId = e.target.value))}
                      >
                        {scenario.householdMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="変更年月">
                      <Input
                        type="month"
                        value={event.changeYearMonth}
                        onChange={(e) => updateScenario((s) => void (s.householdMemberStatusEvents[index].changeYearMonth = e.target.value))}
                      />
                    </Field>
                    <StatusSelect
                      label="居住"
                      value={event.isResident}
                      yesLabel="同居"
                      noLabel="別居"
                      onChange={(value) => updateScenario((s) => void (s.householdMemberStatusEvents[index].isResident = value))}
                    />
                    <StatusSelect
                      label="国保加入"
                      value={event.isNationalHealthInsuranceMember}
                      yesLabel="加入"
                      noLabel="対象外"
                      onChange={(value) =>
                        updateScenario((s) => void (s.householdMemberStatusEvents[index].isNationalHealthInsuranceMember = value))
                      }
                    />
                    <StatusSelect
                      label="税計算上の扶養・配偶者控除"
                      value={event.isDependent}
                      yesLabel="入る"
                      noLabel="入らない"
                      onChange={(value) =>
                        updateScenario((s) => {
                          s.householdMemberStatusEvents[index].isDependent = value;
                          s.householdMemberStatusEvents[index].dependsOnMemberId = value ? s.householdProfile.headMemberId : undefined;
                        })
                      }
                    />
                    <StatusSelect
                      label="後期高齢者医療"
                      value={event.isLateElderlyMedicalMember}
                      yesLabel="対象"
                      noLabel="対象外"
                      onChange={(value) =>
                        updateScenario((s) => void (s.householdMemberStatusEvents[index].isLateElderlyMedicalMember = value))
                      }
                    />
                    <StatusSelect
                      label="介護保険"
                      value={event.isLongTermCareInsured}
                      yesLabel="対象"
                      noLabel="対象外"
                      onChange={(value) =>
                        updateScenario((s) => void (s.householdMemberStatusEvents[index].isLongTermCareInsured = value))
                      }
                    />
                  </FormGrid>
                  <div className="mt-4">
                    <Field label="備考">
                      <Textarea
                        value={event.note ?? ""}
                        onChange={(e) => updateScenario((s) => void (s.householdMemberStatusEvents[index].note = e.target.value))}
                      />
                    </Field>
                  </div>
                </EventEditor>
              ))
            )}
          </div>
        </div>
        <div className="rounded-lg border bg-slate-50">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h3 className="font-medium">同居状態変更</h3>
              <p className="text-sm text-muted-foreground">
                子どもの別居など、世帯人数が変わる予定を年月で登録します。対象費目だけを減額し、収入イベントの終了月にもリンクできます。
              </p>
            </div>
            <Button onClick={addLivingArrangementEvent}>
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
          <div className="space-y-4 p-4">
            {scenario.householdLivingArrangementEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">同居状態変更はまだありません。</p>
            ) : (
              scenario.householdLivingArrangementEvents.map((event, index) => (
                <EventEditor
                  key={event.id}
                  title={event.name || "同居状態変更"}
                  onDelete={() =>
                    updateScenario((s) => {
                      const removedId = s.householdLivingArrangementEvents[index]?.id;
                      s.householdLivingArrangementEvents.splice(index, 1);
                      if (removedId) {
                        for (const incomeEvent of s.incomeEvents) {
                          if (incomeEvent.linkedHouseholdLivingArrangementEventId === removedId) {
                            incomeEvent.linkedHouseholdLivingArrangementEventId = undefined;
                          }
                        }
                      }
                    })
                  }
                  actions={
                    <Button variant="ghost" size="sm" onClick={() => duplicateLivingArrangementEvent(index)}>
                      <Copy className="h-4 w-4" />
                      複製
                    </Button>
                  }
                >
                  <FormGrid>
                    <Field label="名称">
                      <Input
                        value={event.name}
                        onChange={(e) => updateScenario((s) => void (s.householdLivingArrangementEvents[index].name = e.target.value))}
                      />
                    </Field>
                    <Field label="対象メンバー">
                      <Select
                        value={event.memberId}
                        onChange={(e) => updateScenario((s) => void (s.householdLivingArrangementEvents[index].memberId = e.target.value))}
                      >
                        {scenario.householdMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="変更内容">
                      <Select value={event.changeType} onChange={(e) => updateScenario((s) => void (s.householdLivingArrangementEvents[index].changeType = e.target.value as "moveOut"))}>
                        <option value="moveOut">別居開始</option>
                      </Select>
                    </Field>
                    <Field label="変更年月">
                      <Input
                        type="month"
                        value={event.changeYearMonth}
                        onChange={(e) => updateScenario((s) => void (s.householdLivingArrangementEvents[index].changeYearMonth = e.target.value))}
                      />
                    </Field>
                    <Field label="生活費に反映">
                      <Select
                        value={event.appliesToLivingExpenses ? "yes" : "no"}
                        onChange={(e) => updateScenario((s) => void (s.householdLivingArrangementEvents[index].appliesToLivingExpenses = e.target.value === "yes"))}
                      >
                        <option value="yes">反映する</option>
                        <option value="no">反映しない</option>
                      </Select>
                    </Field>
                    <Field label="変更方法">
                      <Select
                        value={event.reductionMode}
                        onChange={(e) => updateScenario((s) => void (s.householdLivingArrangementEvents[index].reductionMode = e.target.value as HouseholdLivingArrangementEvent["reductionMode"]))}
                      >
                        <option value="fixedAmount">月額を減らす</option>
                        <option value="percentage">割合で減らす</option>
                      </Select>
                    </Field>
                    {event.reductionMode === "fixedAmount" ? (
                      <Field label="月額減少額">
                        <Input
                          type="number"
                          value={event.reductionAmount}
                          onChange={(e) => updateScenario((s) => void (s.householdLivingArrangementEvents[index].reductionAmount = numberOrZero(e.target.value)))}
                        />
                      </Field>
                    ) : (
                      <RateField
                        label="減少率"
                        value={event.reductionRate}
                        onChange={(value) => updateScenario((s) => void (s.householdLivingArrangementEvents[index].reductionRate = value))}
                      />
                    )}
                  </FormGrid>
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="mb-2 text-sm font-medium">対象費目</p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {(Object.keys(expenseLabels) as ExpenseKey[]).map((key) => (
                          <label key={key} className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                            <input
                              type="checkbox"
                              checked={event.expenseKeys.includes(key)}
                              onChange={() => toggleLivingExpenseKey(index, key)}
                            />
                            {expenseLabels[key]}
                          </label>
                        ))}
                      </div>
                    </div>
                    <Field label="備考">
                      <Textarea
                        value={event.note ?? ""}
                        onChange={(e) => updateScenario((s) => void (s.householdLivingArrangementEvents[index].note = e.target.value))}
                      />
                    </Field>
                  </div>
                </EventEditor>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type AssetSyncTargetMode = "compare" | "all" | "selected";

type AssetSyncOptions = {
  liquidAssets: boolean;
  marketAssets: boolean;
  costBasis: boolean;
  optionSubAccounts: boolean;
};

type ProfileSyncOptions = {
  basicProfile: boolean;
  flexibleFreeCashPeriod: boolean;
  household: boolean;
};

type ExpenseSyncOptions = {
  monthlyExpenses: boolean;
  ageAdjustments: boolean;
  expenseInflation: boolean;
};

type IncomeSyncOptions = {
  incomeEvents: boolean;
  optionSubAccounts: boolean;
  pensionPlanner: boolean;
  retirementIncomeEvents: boolean;
  pensionAdjustmentRate: boolean;
};

type SpecialSyncOptions = {
  specialExpenses: boolean;
};

type TaxSocialPaymentSyncOptions = {
  taxSocialPaymentSchedule: boolean;
  recurringTaxSocialPaymentTemplates: boolean;
};

function countAssetSyncTargets(
  scenarios: ScenarioData[],
  sourceScenarioId: string,
  targetMode: AssetSyncTargetMode,
  excludedScenarioIds: Set<string> = new Set(),
  selectedScenarioIds: Set<string> = new Set(),
) {
  return getAssetSyncTargets(scenarios, sourceScenarioId, targetMode, excludedScenarioIds, selectedScenarioIds).length;
}

function getAssetSyncTargets(
  scenarios: ScenarioData[],
  sourceScenarioId: string,
  targetMode: AssetSyncTargetMode,
  excludedScenarioIds: Set<string> = new Set(),
  selectedScenarioIds: Set<string> = new Set(),
) {
  return scenarios.filter(
    (target) =>
      target.id !== sourceScenarioId &&
      !excludedScenarioIds.has(target.id) &&
      (targetMode === "all" || (targetMode === "compare" && target.compare) || (targetMode === "selected" && selectedScenarioIds.has(target.id))),
  );
}

function isAssetSyncTarget(
  target: ScenarioData,
  sourceScenarioId: string,
  targetMode: AssetSyncTargetMode,
  excludedScenarioIds: Set<string> = new Set(),
  selectedScenarioIds: Set<string> = new Set(),
) {
  if (target.id === sourceScenarioId || excludedScenarioIds.has(target.id)) return false;
  if (targetMode === "all") return true;
  if (targetMode === "compare") return target.compare;
  return selectedScenarioIds.has(target.id);
}

function formatScenarioNamesForConfirm(names: string[]) {
  if (names.length === 0) return "なし";
  return names.map((name) => `・${name}`).join("\n");
}

function formatScenarioNamesForMessage(names: string[]) {
  if (names.length === 0) return "対象なし";
  if (names.length <= 3) return names.join("、");
  return `${names.slice(0, 3).join("、")} ほか${names.length - 3}件`;
}

function findMatchingCopiedMemberId(sourceMembers: HouseholdMember[], oldTargetMember?: HouseholdMember) {
  if (!oldTargetMember) return sourceMembers[0]?.id ?? "";
  return (
    sourceMembers.find((member) => member.relationship === oldTargetMember.relationship && member.name === oldTargetMember.name)?.id ??
    sourceMembers.find((member) => member.relationship === oldTargetMember.relationship)?.id ??
    sourceMembers[0]?.id ??
    oldTargetMember.id
  );
}

function applyProfileSyncFromSource(target: ScenarioData, source: ScenarioData, options: ProfileSyncOptions) {
  if (options.basicProfile) {
    target.userProfile = {
      ...target.userProfile,
      birthDate: source.userProfile.birthDate,
      simulationStartYearMonth: source.userProfile.simulationStartYearMonth,
      simulationEndMode: source.userProfile.simulationEndMode,
      simulationEndAge: source.userProfile.simulationEndAge,
      simulationEndYearMonth: source.userProfile.simulationEndYearMonth,
      targetBalanceAge: source.userProfile.targetBalanceAge,
      targetBalanceAmount: source.userProfile.targetBalanceAmount,
      plannedDrawdownEnabled: source.userProfile.plannedDrawdownEnabled,
      cashReserve: source.userProfile.cashReserve,
      municipality: source.userProfile.municipality,
      hasSpouse: source.userProfile.hasSpouse,
    };
  }

  if (options.flexibleFreeCashPeriod) {
    target.userProfile.flexibleFreeCashStartAge = source.userProfile.flexibleFreeCashStartAge;
    target.userProfile.flexibleFreeCashEndAge = source.userProfile.flexibleFreeCashEndAge;
  }

  if (options.household) {
    const oldMembersById = new Map(target.householdMembers.map((member) => [member.id, member]));
    const copiedMembers = structuredClone(source.householdMembers);
    const copiedMemberIds = new Set(copiedMembers.map((member) => member.id));
    target.householdProfile = structuredClone(source.householdProfile);
    target.householdMembers = copiedMembers;
    target.householdMemberStatusEvents = structuredClone(source.householdMemberStatusEvents);
    target.householdLivingArrangementEvents = structuredClone(source.householdLivingArrangementEvents);
    if (!copiedMemberIds.has(target.householdProfile.headMemberId)) {
      target.householdProfile.headMemberId = copiedMembers[0]?.id ?? "";
    }
    target.userProfile.hasSpouse = source.userProfile.hasSpouse;
    target.userProfile.municipality = source.userProfile.municipality;

    target.incomeEvents = target.incomeEvents.map((event) => ({
      ...event,
      memberId: copiedMemberIds.has(event.memberId)
        ? event.memberId
        : findMatchingCopiedMemberId(copiedMembers, oldMembersById.get(event.memberId)),
      linkedHouseholdLivingArrangementEventId: target.householdLivingArrangementEvents.some(
        (livingEvent) => livingEvent.id === event.linkedHouseholdLivingArrangementEventId,
      )
        ? event.linkedHouseholdLivingArrangementEventId
        : undefined,
    }));
    target.retirementIncomeEvents = (target.retirementIncomeEvents ?? []).map((event) => ({
      ...event,
      memberId: copiedMemberIds.has(event.memberId)
        ? event.memberId
        : findMatchingCopiedMemberId(copiedMembers, oldMembersById.get(event.memberId)),
    }));
  }
}

function isOptionIncomeEvent(event: IncomeEvent) {
  return event.sourceAssetKey === "ordinaryAccountForOptions";
}

function resolveIncomeEventOptionSubAccountId(source: ScenarioData, event: IncomeEvent) {
  if (!isOptionIncomeEvent(event)) return undefined;
  if (event.sourceOptionSubAccountId && source.optionSubAccounts.some((account) => account.id === event.sourceOptionSubAccountId)) {
    return event.sourceOptionSubAccountId;
  }
  return (
    resolveOptionSubAccountId(source.optionSubAccounts, event.sourceOptionSubAccountId, event.name) ??
    inferOptionSubAccountIdFromName(source.optionSubAccounts, source.name)
  );
}

function getLinkedOptionSubAccountIdsForIncomeEvents(source: ScenarioData, selectedIncomeEventIds: string[]) {
  const selectedIds = new Set(selectedIncomeEventIds);
  return Array.from(
    new Set(
      source.incomeEvents
        .filter((event) => selectedIds.has(event.id))
        .map((event) => resolveIncomeEventOptionSubAccountId(source, event))
        .filter((id): id is string => Boolean(id)),
    ),
  );
}

function getUnresolvedOptionIncomeEventNames(source: ScenarioData, selectedIncomeEventIds: string[]) {
  const selectedIds = new Set(selectedIncomeEventIds);
  return source.incomeEvents
    .filter((event) => selectedIds.has(event.id) && isOptionIncomeEvent(event) && !resolveIncomeEventOptionSubAccountId(source, event))
    .map((event) => event.name || "名称未設定");
}

function getLinkedIncomeEventIdsForOptionSubAccounts(source: ScenarioData, selectedOptionSubAccountIds: string[]) {
  const selectedIds = new Set(selectedOptionSubAccountIds);
  return source.incomeEvents
    .filter((event) => {
      const accountId = resolveIncomeEventOptionSubAccountId(source, event);
      return accountId ? selectedIds.has(accountId) : false;
    })
    .map((event) => event.id);
}

function applyIncomeEventsSyncFromSource(target: ScenarioData, source: ScenarioData, selectedIncomeEventIds?: string[]) {
  const selectedIds = new Set(selectedIncomeEventIds ?? source.incomeEvents.map((event) => event.id));
  const sourceIncomeEvents = source.incomeEvents.filter((event) => selectedIds.has(event.id));
  const preservedTargetEvents = target.incomeEvents.filter(
    (targetEvent) => !sourceIncomeEvents.some((sourceEvent) => isSameIncomeSyncSlot(targetEvent, sourceEvent)),
  );
  target.incomeEvents = [
    ...sourceIncomeEvents.map((event) => cloneIncomeEventForTarget(target, event)),
    ...preservedTargetEvents.map((event) => structuredClone(event)),
  ];
}

function applyAssetSyncFromSource(
  target: ScenarioData,
  source: ScenarioData,
  options: AssetSyncOptions,
  linkedIncomeEventIds?: string[],
) {
  if (options.liquidAssets) {
    for (const key of liquidAssetKeys) {
      target.initialAssets[key] = source.initialAssets[key];
    }
  }

  if (options.marketAssets) {
    for (const key of marketAssetKeys) {
      target.initialAssets[key] = source.initialAssets[key];
    }
  }

  if (options.costBasis) {
    for (const key of costBasisKeys) {
      target.initialAssetCostBasis[key] = source.initialAssetCostBasis[key];
    }
  }

  if (options.optionSubAccounts) {
    applyOptionSubAccountSyncFromSource(target, source);
  }

  if (linkedIncomeEventIds && linkedIncomeEventIds.length > 0) {
    applyIncomeEventsSyncFromSource(target, source, linkedIncomeEventIds);
  }
}

function applyExpenseSyncFromSource(target: ScenarioData, source: ScenarioData, options: ExpenseSyncOptions) {
  if (options.monthlyExpenses) {
    target.monthlyExpenses = structuredClone(source.monthlyExpenses);
  }

  if (options.ageAdjustments) {
    target.ageExpenseAdjustments = structuredClone(source.ageExpenseAdjustments);
  }

  if (options.expenseInflation) {
    target.inflationSettings = {
      ...target.inflationSettings,
      enabled: source.inflationSettings.enabled,
      livingCostAnnualInflationRate: source.inflationSettings.livingCostAnnualInflationRate,
      medicalAnnualInflationRate: source.inflationSettings.medicalAnnualInflationRate,
      livingCostInflationTargets: structuredClone(source.inflationSettings.livingCostInflationTargets),
      medicalInflationTargets: structuredClone(source.inflationSettings.medicalInflationTargets),
    };
  }
}

function mapMemberIdForTarget(target: ScenarioData, sourceMemberId: string) {
  if (target.householdMembers.some((member) => member.id === sourceMemberId)) return sourceMemberId;
  return target.householdProfile.headMemberId || target.householdMembers[0]?.id || sourceMemberId;
}

function mapOptionSubAccountIdForTarget(target: ScenarioData, sourceOptionSubAccountId?: string) {
  if (!sourceOptionSubAccountId) return undefined;
  if (target.optionSubAccounts.some((account) => account.id === sourceOptionSubAccountId)) return sourceOptionSubAccountId;
  return target.optionSubAccounts[0]?.id;
}

function mapLivingArrangementEventIdForTarget(target: ScenarioData, sourceEventId?: string) {
  if (!sourceEventId) return undefined;
  if (target.householdLivingArrangementEvents.some((event) => event.id === sourceEventId)) return sourceEventId;
  return undefined;
}

function isSameIncomeSyncSlot(targetEvent: IncomeEvent, sourceEvent: IncomeEvent) {
  if (targetEvent.id === sourceEvent.id) return true;
  return (
    targetEvent.name.trim() !== "" &&
    targetEvent.name === sourceEvent.name &&
    targetEvent.type === sourceEvent.type &&
    targetEvent.sourceAssetKey === sourceEvent.sourceAssetKey &&
    targetEvent.sourceOptionSubAccountId === sourceEvent.sourceOptionSubAccountId
  );
}

function cloneIncomeEventForTarget(target: ScenarioData, event: IncomeEvent): IncomeEvent {
  return {
    ...structuredClone(event),
    memberId: mapMemberIdForTarget(target, event.memberId),
    sourceOptionSubAccountId: mapOptionSubAccountIdForTarget(target, event.sourceOptionSubAccountId),
    linkedHouseholdLivingArrangementEventId: mapLivingArrangementEventIdForTarget(target, event.linkedHouseholdLivingArrangementEventId),
  };
}

function isSameOptionSubAccountSyncSlot(targetAccount: ScenarioData["optionSubAccounts"][number], sourceAccount: ScenarioData["optionSubAccounts"][number]) {
  if (targetAccount.id === sourceAccount.id) return true;
  return targetAccount.name.trim() !== "" && targetAccount.name === sourceAccount.name;
}

function syncOptionAggregateInputs(scenario: ScenarioData) {
  const initialValue = scenario.optionSubAccounts.reduce((sum, account) => sum + Math.max(0, account.initialValue), 0);
  const initialCostBasis = scenario.optionSubAccounts.reduce(
    (sum, account) => sum + Math.min(Math.max(0, account.initialCostBasis), Math.max(0, account.initialValue)),
    0,
  );
  scenario.initialAssets.ordinaryAccountForOptions = initialValue;
  scenario.initialAssetCostBasis.ordinaryAccountForOptions = Math.min(initialCostBasis, initialValue);
}

function applyOptionSubAccountSyncFromSource(
  target: ScenarioData,
  source: ScenarioData,
  selectedOptionSubAccountIds?: string[],
) {
  const selectedIds = new Set(selectedOptionSubAccountIds ?? source.optionSubAccounts.map((account) => account.id));
  const sourceOptionSubAccounts = source.optionSubAccounts.filter((account) => selectedIds.has(account.id));
  if (sourceOptionSubAccounts.length === 0) return;
  const copiedAccounts = sourceOptionSubAccounts.map((account) => structuredClone(account));
  const preservedTargetAccounts = target.optionSubAccounts.filter(
    (targetAccount) => !copiedAccounts.some((sourceAccount) => isSameOptionSubAccountSyncSlot(targetAccount, sourceAccount)),
  );
  target.optionSubAccounts = [...copiedAccounts, ...preservedTargetAccounts].sort(
    (a, b) => a.withdrawalPriority - b.withdrawalPriority,
  );
  target.optionAccountRules = structuredClone(source.optionAccountRules);
  target.assetGrowthSettings = {
    ...target.assetGrowthSettings,
    rates: {
      ...target.assetGrowthSettings.rates,
      ordinaryAccountForOptions: source.assetGrowthSettings.rates.ordinaryAccountForOptions,
    },
  };
  syncOptionAggregateInputs(target);
}

function applyIncomeSyncFromSource(
  target: ScenarioData,
  source: ScenarioData,
  options: IncomeSyncOptions,
  selectedIncomeEventIds?: string[],
  selectedOptionSubAccountIds?: string[],
) {
  if (options.optionSubAccounts) {
    applyOptionSubAccountSyncFromSource(target, source, selectedOptionSubAccountIds);
  }

  if (options.incomeEvents) {
    applyIncomeEventsSyncFromSource(target, source, selectedIncomeEventIds);
  }

  if (options.pensionPlanner) {
    target.pensionPlannerSettings = source.pensionPlannerSettings ? structuredClone(source.pensionPlannerSettings) : undefined;
  }

  if (options.retirementIncomeEvents) {
    target.retirementIncomeEvents = source.retirementIncomeEvents?.map((event) => ({
      ...structuredClone(event),
      memberId: mapMemberIdForTarget(target, event.memberId),
    }));
  }

  if (options.pensionAdjustmentRate) {
    target.inflationSettings = {
      ...target.inflationSettings,
      pensionAnnualAdjustmentRate: source.inflationSettings.pensionAnnualAdjustmentRate,
    };
  }
}

function applyTaxSocialPaymentSyncFromSource(
  target: ScenarioData,
  source: ScenarioData,
  options: TaxSocialPaymentSyncOptions,
) {
  if (options.taxSocialPaymentSchedule) {
    target.taxSocialPaymentSchedule = structuredClone(source.taxSocialPaymentSchedule ?? []);
  }

  if (options.recurringTaxSocialPaymentTemplates) {
    target.recurringTaxSocialPaymentTemplates = structuredClone(source.recurringTaxSocialPaymentTemplates ?? []);
  }
}

export const __testHooks = {
  applyAssetSyncFromSource,
  applyIncomeSyncFromSource,
  applyTaxSocialPaymentSyncFromSource,
  countAssetSyncTargets,
  getLinkedIncomeEventIdsForOptionSubAccounts,
  getLinkedOptionSubAccountIdsForIncomeEvents,
};

function applySpecialSyncFromSource(target: ScenarioData, source: ScenarioData, options: SpecialSyncOptions) {
  if (options.specialExpenses) {
    target.specialExpenses = structuredClone(source.specialExpenses);
    const validSpecialExpenseIds = new Set(target.specialExpenses.map((event) => event.id));
    target.timeBucketItems = target.timeBucketItems.map((item) => ({
      ...item,
      convertedSpecialExpenseId:
        item.convertedSpecialExpenseId && validSpecialExpenseIds.has(item.convertedSpecialExpenseId)
          ? item.convertedSpecialExpenseId
          : undefined,
    }));
  }
}

type ScenarioSyncOptionDescriptor<T extends string> = {
  key: T;
  label: string;
  description: string;
};

function ScenarioSyncCard<T extends string>({
  title,
  description,
  targetMode,
  setTargetMode,
  targetCount,
  targetNames,
  targetSummary,
  allScenarios,
  sourceScenarioId,
  excludedScenarioIds = new Set(),
  selectedTargetIds,
  toggleSelectedTarget,
  options,
  selectedOptions,
  toggleOption,
  warningText,
  onApply,
  message,
  applyDisabled = false,
  optionGridClassName = "grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
}: {
  title: string;
  description: string;
  targetMode: AssetSyncTargetMode;
  setTargetMode: (mode: AssetSyncTargetMode) => void;
  targetCount: number;
  targetNames?: string[];
  targetSummary: string;
  allScenarios?: ScenarioData[];
  sourceScenarioId?: string;
  excludedScenarioIds?: Set<string>;
  selectedTargetIds?: Set<string>;
  toggleSelectedTarget?: (scenarioId: string) => void;
  options: ScenarioSyncOptionDescriptor<T>[];
  selectedOptions: Record<T, boolean>;
  toggleOption: (key: T) => void;
  warningText: string;
  onApply: () => void;
  message: string | null;
  applyDisabled?: boolean;
  optionGridClassName?: string;
}) {
  const hasSelection = Object.values(selectedOptions).some(Boolean);
  const visibleTargetNames = targetNames?.slice(0, 6) ?? [];
  const hiddenTargetNameCount = Math.max(0, (targetNames?.length ?? 0) - visibleTargetNames.length);

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,320px)_1fr]">
          <Field label="反映先">
            <Select value={targetMode} onChange={(event) => setTargetMode(event.target.value as AssetSyncTargetMode)}>
              <option value="compare">比較対象にチェック済み</option>
              <option value="selected">個別に選択</option>
              <option value="all">全シナリオ</option>
            </Select>
          </Field>
          <div className="space-y-2 rounded-md border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
            <p>{targetSummary}</p>
            <div className="rounded-md border bg-white px-3 py-2">
              <div className="font-medium text-foreground">今回の反映先</div>
              {targetNames && targetNames.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {visibleTargetNames.map((name) => (
                    <span key={name} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {name}
                    </span>
                  ))}
                  {hiddenTargetNameCount > 0 && (
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">
                      ほか{hiddenTargetNameCount}件
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs">
                  {targetMode === "selected"
                    ? "まだ反映先が選択されていません。下のシナリオカードにチェックを入れてください。"
                    : "対象シナリオはありません。"}
                </p>
              )}
              {targetMode === "compare" && (
                <p className="mt-2 text-xs">
                  比較対象は、シナリオタブで「比較」に入れているシナリオです。任意の反映先だけにしたい場合は「個別に選択」を使います。
                </p>
              )}
              {targetMode === "selected" && (
                <p className="mt-2 text-xs">この画面内のチェックで、反映先を個別に選びます。</p>
              )}
            </div>
          </div>
        </div>
        {targetMode === "selected" && allScenarios && sourceScenarioId && selectedTargetIds && toggleSelectedTarget && (
          <div className="rounded-md border bg-white px-4 py-3">
            <div className="text-sm font-medium">反映先を個別に選択</div>
            <p className="mt-1 text-xs text-muted-foreground">
              コピーしたい先のシナリオ名にチェックを入れると、上の「今回の反映先」と実行ボタンに反映されます。
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {allScenarios
                .filter((item) => item.id !== sourceScenarioId && !excludedScenarioIds.has(item.id))
                .map((item) => {
                  const isSelected = selectedTargetIds.has(item.id);
                  return (
                  <label
                    key={item.id}
                    className={cn(
                      "flex items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                      isSelected ? "border-teal-400 bg-teal-50" : "bg-slate-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectedTarget(item.id)}
                    />
                    <span>
                      <span className="block font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground">{item.compare ? "比較対象" : "比較対象外"}</span>
                    </span>
                  </label>
                );
                })}
            </div>
          </div>
        )}
        <div className={optionGridClassName}>
          {options.map((option) => (
            <label key={option.key} className="flex items-start gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selectedOptions[option.key]}
                onChange={() => toggleOption(option.key)}
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span>{warningText}</span>
          <Button onClick={onApply} disabled={targetCount === 0 || !hasSelection || applyDisabled}>
            他シナリオへ反映
          </Button>
        </div>
        {message && (
          <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
            {message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrustNotice({ collapsed, onExpand }: { collapsed: boolean; onExpand: () => void }) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="block w-full border-b bg-slate-50/60 px-4 py-1 text-left text-xs text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
      >
        <span className="container block">
          概算・端末内保存・重要判断前の確認事項があります。クリックで表示。
        </span>
      </button>
    );
  }

  return (
    <div className="border-b bg-slate-50">
      <div className="container grid gap-3 py-3 text-sm leading-6 text-slate-700 md:grid-cols-3">
        <div>
          <span className="font-medium text-slate-950">概算です。</span>{" "}
          税金・社会保険は2026年度前提を中心にした試算で、通知書や制度改正とは差が出ます。
        </div>
        <div>
          <span className="font-medium text-slate-950">保存先はこのブラウザです。</span>{" "}
          入力内容は端末間で自動同期されません。必要に応じて保存用ファイルを作成してください。
        </div>
        <div>
          <span className="font-medium text-slate-950">重要判断は確認が必要です。</span>{" "}
          退職金、年金、税社保、投資売却を実行する前に専門家や通知書で確認してください。
        </div>
      </div>
    </div>
  );
}

function DataTrustModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/45 px-4 py-6">
      <div className="mx-auto max-w-3xl rounded-lg bg-white shadow-xl">
        <div className="border-b px-5 py-4">
          <p className="text-sm text-teal-700">限定公開版を使う前に</p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal">入力データは、ご利用中の端末内に保存されます</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            アプリ本体はWebページとして開きますが、家計・資産・年金などの入力内容を作成者へ送信する機能はありません。
            協力者ご本人が保存用ファイルや画面の画像を送った場合だけ、その中に含まれる情報が共有されます。
          </p>
        </div>
        <div className="space-y-5 px-5 py-5">
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-md border bg-sky-50 px-4 py-3 text-sky-950">
              <p className="font-medium">1. アプリを開く</p>
              <p className="mt-1 text-sky-900">画面や計算ロジックだけを読み込みます。</p>
            </div>
            <div className="rounded-md border bg-emerald-50 px-4 py-3 text-emerald-950">
              <p className="font-medium">2. 入力する</p>
              <p className="mt-1 text-emerald-900">入力内容は、今使っているパソコンやスマートフォン内に保存されます。</p>
            </div>
            <div className="rounded-md border bg-amber-50 px-4 py-3 text-amber-950">
              <p className="font-medium">3. 共有は自分で選ぶ</p>
              <p className="mt-1 text-amber-900">保存用ファイルや画面の画像を送らない限り、入力内容は配布者に届きません。</p>
            </div>
          </div>

          <div className="grid gap-3 text-sm leading-6 md:grid-cols-2">
            <div className="rounded-md border px-4 py-3">
              <p className="font-medium text-slate-950">通常操作で送られないもの</p>
              <p className="mt-1 text-muted-foreground">年齢、家族構成、資産、収入、支出、年金、税・社会保険の入力内容</p>
            </div>
            <div className="rounded-md border px-4 py-3">
              <p className="font-medium text-slate-950">自分で送る時だけ共有されるもの</p>
              <p className="mt-1 text-muted-foreground">保存用ファイル、月別結果のファイル、画面の画像、フィードバック文に書いた内容</p>
            </div>
          </div>

          <div className="rounded-md border bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-950">
            <p className="font-medium">注意</p>
            <p className="mt-1">
              同じパソコンを家族や職場で共有している場合、そのブラウザを開ける人は保存済みデータを見られる可能性があります。
              使い終わったらデータタブから「この端末の入力データを削除」を実行できます。
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={onClose}>確認しました（次回から表示しない）</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenarioSyncDetails({
  id,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  id?: string;
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details id={id} className="rounded-lg border bg-white px-4 py-3" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
        <span>
          <span className="block font-medium">{title}</span>
          <span className="text-sm text-muted-foreground">{description}</span>
        </span>
        <span className="rounded-md border bg-slate-50 px-3 py-1 text-sm text-muted-foreground">
          {isOpen ? "閉じる" : "開く"}
        </span>
      </summary>
      <div hidden={!isOpen} className="mt-4 space-y-4">{children}</div>
    </details>
  );
}

function GuidedDetails({
  id,
  title,
  description,
  summary,
  priority = "detail",
  defaultOpen = false,
  targetCardId,
  reviewHighlight = false,
  children,
}: {
  id: InputCardId | string;
  title: string;
  description: string;
  summary?: string;
  priority?: InputCardPriority;
  defaultOpen?: boolean;
  targetCardId?: InputCardId | string | null;
  reviewHighlight?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isTargeted = targetCardId === id;
  useEffect(() => {
    if (targetCardId === id) setIsOpen(true);
  }, [id, targetCardId]);

  return (
    <details
      id={id}
      data-input-card-id={id}
      className={cn(
        "rounded-lg border bg-white px-4 py-3 transition-shadow",
        isTargeted ? "border-sky-300 ring-2 ring-sky-200" : "",
        reviewHighlight && !isTargeted ? "border-amber-300 bg-amber-50/50 ring-1 ring-amber-100" : "",
      )}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{title}</span>
            <span className="rounded-md border bg-slate-50 px-2 py-0.5 text-xs text-muted-foreground">{priorityLabel(priority)}</span>
            {isTargeted && (
              <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-950">
                {priority === "required" ? "ここを入力" : priority === "expert" ? "必要なら確認" : "次に確認"}
              </span>
            )}
            {reviewHighlight && !isTargeted && (
              <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-950">確認推奨</span>
            )}
          </span>
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">{summary ?? description}</span>
        </span>
        <span className="rounded-md border bg-slate-50 px-3 py-1 text-sm text-muted-foreground">
          {isOpen ? "閉じる" : "開く"}
        </span>
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        {children}
      </div>
    </details>
  );
}

function InputGuideMini({
  card,
  requiredComplete,
  onOpenCard,
  onOpenGuide,
}: {
  card: InputCardDefinition;
  requiredComplete: boolean;
  onOpenCard: (cardId: InputCardId) => void;
  onOpenGuide: () => void;
}) {
  const heading = inputCardActionHeading(card, requiredComplete);
  const buttonLabel = inputCardActionButtonLabel(card, requiredComplete);
  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm leading-6 text-amber-950">
          <div className="font-semibold">入力ガイド</div>
          <p>
            {requiredComplete
              ? `必須入力は完了しています。${heading}は「${inputCardDecisionTitle(card)}」です。`
              : `主要入力に未入力があります。${heading}は「${inputCardDecisionTitle(card)}」です。`}
          </p>
          <p className="text-xs text-amber-900">{inputCardLocationLabel(card)} / {card.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onOpenCard(card.id)}>{buttonLabel}</Button>
          <Button variant="outline" onClick={onOpenGuide}>
            入力状況を開く
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InputGuidanceSummary({
  cards,
  onOpenCard,
  onOpenResults,
  onOpenOnboarding,
}: {
  cards: InputCardDefinition[];
  onOpenCard: (cardId: InputCardId) => void;
  onOpenResults: () => void;
  onOpenOnboarding: () => void;
}) {
  const requiredCards = cards.filter((card) => card.priority === "required");
  const completedRequiredCount = requiredCards.filter(isInputCardSatisfied).length;
  const requiredComplete = requiredCards.every(isInputCardSatisfied);
  const nextCard = getNextInputCard(cards);
  const reviewCards = cards.filter((card) => card.status === "review_recommended");
  const canShowResults = requiredComplete;
  const requiredMissingCards = requiredCards.filter((card) => !isInputCardSatisfied(card));
  const nextHeading = inputCardActionHeading(nextCard, requiredComplete);
  const nextActionLabel = inputCardActionButtonLabel(nextCard, requiredComplete);

  return (
    <Card id="input-guidance-summary">
      <CardHeader>
        <CardTitle>入力状況サマリー</CardTitle>
        <CardDescription>入力漏れだけでなく、次に考える意思決定を案内します。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm lg:grid-cols-[1fr_1.4fr_1fr]">
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="text-muted-foreground">{requiredComplete ? "必須入力は完了" : "必須入力"}</div>
            <div className="mt-1 text-xl font-semibold">
              {requiredComplete ? `${requiredCards.length}項目すべて入力済み` : `${requiredCards.length}項目中${completedRequiredCount}項目完了`}
            </div>
            {!requiredComplete && (
              <div className="mt-2 text-xs leading-5 text-rose-900">
                未入力: {requiredMissingCards.map((card) => card.title).join("、")}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => nextCard && onOpenCard(nextCard.id)}
            disabled={!nextCard}
            className={cn(
              "rounded-md border px-4 py-3 text-left transition hover:bg-white disabled:cursor-default",
              nextCard ? "border-amber-300 bg-amber-50 text-amber-950 ring-1 ring-amber-200" : "bg-slate-50 text-slate-600",
            )}
          >
            <div className="text-muted-foreground">{nextHeading}</div>
            <div className="mt-1 text-lg font-semibold">{inputCardDecisionTitle(nextCard)}</div>
            {nextCard && (
              <>
                <div className="mt-1 text-xs text-amber-900">対象: {nextCard.title}</div>
                <div className="mt-1 text-sm leading-6">{nextCard.summary}</div>
                <div className="mt-1 text-xs">{inputCardLocationLabel(nextCard)}</div>
                {nextCard.missingItems.length > 0 && <div className="mt-1 text-xs">未確認: {nextCard.missingItems.join("、")}</div>}
                <div className="mt-3 inline-flex rounded-md bg-amber-200 px-2.5 py-1 text-xs font-medium text-amber-950">
                  {nextActionLabel}
                </div>
              </>
            )}
          </button>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="text-muted-foreground">確認推奨</div>
            <div className="mt-1 font-semibold">{reviewCards.length > 0 ? reviewCards.map((card) => card.title).join("、") : "なし"}</div>
            <div className="mt-1 text-xs leading-5">{canShowResults ? "結果は表示できます。" : "結果を見る前に必須入力を確認してください。"}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => nextCard && onOpenCard(nextCard.id)} disabled={!nextCard}>
            {nextActionLabel}
          </Button>
          <Button variant="outline" onClick={onOpenResults}>
            結果を見る
          </Button>
          <Button variant="outline" onClick={onOpenOnboarding}>
            初回設定を開く
          </Button>
        </div>
        <ScenarioSyncDetails
          title="必須入力の内訳を見る"
          description="必須カードだけを確認します。確認推奨や専門項目とは分けています。"
        >
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {requiredCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => onOpenCard(card.id)}
                className={cn("rounded-md border px-3 py-2 text-left text-sm transition hover:bg-white", inputCardStatusClass(card.status))}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{card.title}</span>
                  <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs">{statusLabel(card.status)}</span>
                </span>
                <span className="mt-1 block text-xs leading-5">{card.summary}</span>
                {card.missingItems.length > 0 && <span className="mt-1 block text-xs">未入力: {card.missingItems.join("、")}</span>}
              </button>
            ))}
          </div>
        </ScenarioSyncDetails>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onOpenCard(card.id)}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition hover:bg-white",
                inputCardStatusClass(card.status),
                inputCardHighlightClass(card.highlight),
              )}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{card.title}</span>
                <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs">{priorityLabel(card.priority)}</span>
                <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs">{statusLabel(card.status)}</span>
                {card.highlight === "next_required" && (
                  <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs">
                    {inputCardActionLabel(card, requiredComplete)}
                  </span>
                )}
                {card.highlight === "review" && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">確認推奨</span>}
              </span>
              <span className="mt-1 block text-xs leading-5">{card.summary}</span>
              <span className="mt-1 block text-xs font-medium text-slate-700">意思決定: {inputCardDecisionTitle(card)}</span>
              <span className="mt-1 block text-xs text-slate-600">{inputCardLocationLabel(card)}</span>
              {card.missingItems.length > 0 && <span className="mt-1 block text-xs">未確認: {card.missingItems.join("、")}</span>}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HistoricalRollingStressTestCard({
  estimate,
  state,
  needsRerun,
  targetBalanceAge,
  onRun,
}: {
  estimate: HistoricalRollingBacktestEstimate;
  state: {
    status: "idle" | "running" | "done" | "error";
    result?: HistoricalRollingBacktestResult;
    error?: string;
  };
  needsRerun: boolean;
  targetBalanceAge: number;
  onRun: () => void;
}) {
  const result = state.result;
  const metricLabel = (point?: { value: number; startYearMonth: YearMonth }) =>
    point ? `${compactYen(point.value)}（${point.startYearMonth}開始）` : "-";
  const depletionRateLabel = result ? `${(result.depletionRate * 100).toFixed(1)}%` : "-";
  const runDisabled = state.status === "running";

  return (
    <details className="mb-4 rounded-lg border bg-white px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">過去市場ストレステスト</summary>
      <div className="mt-3 space-y-3 text-sm leading-6">
        <p className="text-muted-foreground">
          指定した過去期間内で、必要月数を満たす全開始月を過去実績に当てはめた検証です。通常の結果やダッシュボードの数値は置き換えません。
          将来を保証するものではありません。
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <Metric title="検証範囲" value={`${estimate.rangeStartYearMonth}〜${estimate.rangeEndYearMonth}`} sub={`${estimate.requiredMonths}か月分の過去データを使用`} />
          <Metric title="対象パス数" value={`${estimate.validPathCount}件`} sub={`除外 ${estimate.excludedPathCount}件 / 候補 ${estimate.totalPathCount}件`} />
          <Metric title="枯渇パス" value={result ? `${result.depletedPathCount}件` : "-"} sub={`枯渇率 ${depletionRateLabel}`} />
        </div>
        {estimate.tooManyPathWarning && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
            候補開始月が多いため、検証には少し時間がかかる可能性があります。実行は「検証する」を押した時だけ行います。
          </p>
        )}
        {needsRerun && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
            入力条件が変わりました。最新条件で見るには再検証してください。
          </p>
        )}
        {state.status === "error" && (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-900">{state.error}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={onRun} disabled={runDisabled || estimate.validPathCount === 0}>
            {runDisabled ? "検証中..." : result ? "再検証する" : "検証する"}
          </Button>
          <span className="text-muted-foreground">
            検証するまで複数シミュレーションは実行しません。データ不足の開始月は平均値で補完せず除外します。
          </span>
        </div>
        {result && (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <Metric title="90歳残高 最悪" value={metricLabel(result.age90Balance?.worst)} sub={`最悪開始月 ${result.worstStartYearMonth ?? "-"}`} />
              <Metric title="90歳残高 中央" value={metricLabel(result.age90Balance?.median)} sub={`下位10% ${metricLabel(result.age90Balance?.p10)}`} />
              <Metric title="90歳残高 最良" value={metricLabel(result.age90Balance?.best)} sub={`最良開始月 ${result.bestStartYearMonth ?? "-"}`} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Metric title={`${targetBalanceAge}歳残高`} value={metricLabel(result.targetAgeBalance?.median)} sub={`最悪 ${metricLabel(result.targetAgeBalance?.worst)}`} />
              <Metric title="最大ドローダウン" value={metricLabel(result.maxDrawdown?.worst)} sub={`中央値 ${metricLabel(result.maxDrawdown?.median)}`} />
              <Metric title="除外理由" value={`${result.excludedPathCount}件`} sub={result.dataInsufficientReason} />
            </div>
            <details className="rounded-lg border bg-slate-50 px-3 py-2">
              <summary className="cursor-pointer font-medium text-slate-900">開始月ごとの結果一覧</summary>
              <div className="mt-3 max-h-96 overflow-auto rounded-md border bg-white">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-muted-foreground">
                    <tr>
                      <Th>開始月</Th>
                      <Th>終了月</Th>
                      <Th>{targetBalanceAge}歳残高</Th>
                      <Th>90歳残高</Th>
                      <Th>枯渇年齢</Th>
                      <Th>最大ドローダウン</Th>
                      <Th>生涯総支出</Th>
                      <Th>資産成長額</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.paths.map((path) => (
                      <Tr key={path.startYearMonth}>
                        <Td>{path.startYearMonth}</Td>
                        <Td>{path.endYearMonth}</Td>
                        <Td>{compactYen(path.targetAgeBalance)}</Td>
                        <Td>{compactYen(path.age90Balance)}</Td>
                        <Td>
                          {path.depleted
                            ? `${path.depletionAgeYears ?? "-"}歳${path.depletionAgeMonths ?? 0}か月`
                            : "-"}
                        </Td>
                        <Td>{compactYen(path.maxDrawdown)}</Td>
                        <Td>{compactYen(path.lifetimeTotalExpense)}</Td>
                        <Td>{compactYen(path.growthAmount)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>
    </details>
  );
}

function AssetsSection({
  scenario,
  scenarios,
  updateScenario,
  updateScenarios,
  targetCardId,
}: SectionProps & {
  scenarios: ScenarioData[];
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData, backupLabel?: string) => void;
}) {
  const [assetSyncTargetMode, setAssetSyncTargetMode] = useState<AssetSyncTargetMode>("compare");
  const [assetSyncSelectedTargetIds, setAssetSyncSelectedTargetIds] = useState<string[]>([]);
  const [assetSyncSourceScenarioId, setAssetSyncSourceScenarioId] = useState(scenario.id);
  const [excludeCurrentScenarioFromAssetSync, setExcludeCurrentScenarioFromAssetSync] = useState(true);
  const [assetSyncOptions, setAssetSyncOptions] = useState<AssetSyncOptions>({
    liquidAssets: true,
    marketAssets: true,
    costBasis: true,
    optionSubAccounts: false,
  });
  const [includeLinkedIncomeEventsWithAssetSync, setIncludeLinkedIncomeEventsWithAssetSync] = useState(true);
  const [assetSyncMessage, setAssetSyncMessage] = useState<string | null>(null);
  const [rollingBacktestState, setRollingBacktestState] = useState<{
    status: "idle" | "running" | "done" | "error";
    fingerprint?: string;
    result?: HistoricalRollingBacktestResult;
    error?: string;
  }>({ status: "idle" });
  const returnModel = getEffectiveReturnModel(scenario.assetGrowthSettings);
  const returnModelMode =
    returnModel.mode === "historicalSinglePath" || returnModel.mode === "historicalRollingRange" ? returnModel.mode : "fixedAnnual";
  const historicalStartYearMonth = returnModel.mode === "historicalSinglePath"
    ? returnModel.startYearMonth
    : defaultHistoricalStartYearMonth;
  const historicalRangeStartYearMonth = returnModel.mode === "historicalRollingRange"
    ? returnModel.rangeStartYearMonth
    : historicalReturnDataset.firstMonth;
  const historicalRangeEndYearMonth = returnModel.mode === "historicalRollingRange"
    ? returnModel.rangeEndYearMonth
    : historicalReturnDataset.lastMonth;
  const requiredHistoricalReturnMonths = getRequiredHistoricalReturnMonths(scenario);
  const historicalAssetMappings =
    returnModel.mode === "historicalSinglePath" || returnModel.mode === "historicalRollingRange" ? returnModel.assetMappings : {};
  const historicalCurrencyMode =
    returnModel.mode === "historicalSinglePath" || returnModel.mode === "historicalRollingRange"
      ? getHistoricalCurrencyMode(returnModel)
      : "indexOnly";
  const historicalDataCoverage = getHistoricalSinglePathDataCoverage(
    historicalStartYearMonth,
    requiredHistoricalReturnMonths,
    historicalAssetMappings,
    historicalCurrencyMode,
  );
  const rollingBacktestEstimate = useMemo(
    () => (returnModel.mode === "historicalRollingRange" ? estimateHistoricalRollingBacktestPaths(scenario, returnModel) : undefined),
    [returnModel, scenario],
  );
  const rollingBacktestFingerprint = useMemo(
    () => (returnModel.mode === "historicalRollingRange" ? createHistoricalRollingBacktestFingerprint(scenario, returnModel) : ""),
    [returnModel, scenario],
  );
  const rollingBacktestNeedsRerun =
    returnModel.mode === "historicalRollingRange" &&
    rollingBacktestState.status === "done" &&
    rollingBacktestState.fingerprint !== rollingBacktestFingerprint;
  const historicalAssetMappingRows = historicalReturnAssetKeys.map((key) => ({
    key,
    label: growthAssetLabels[key],
    presetId: getHistoricalReturnPresetId(historicalAssetMappings[key]),
    presetLabel: getHistoricalReturnPresetLabel(historicalAssetMappings[key]),
  }));
  const activeHistoricalMappingSummary = historicalAssetMappingRows
    .map((row) => `${row.label}: ${row.presetLabel}`)
    .join(" / ");
  const assetSyncSourceScenario = scenarios.find((item) => item.id === assetSyncSourceScenarioId) ?? scenario;
  const assetSyncSourceIsCurrentScenario = assetSyncSourceScenario.id === scenario.id;
  const assetSyncExcludedScenarioIds = useMemo(() => {
    const excludedIds = new Set<string>();
    if (excludeCurrentScenarioFromAssetSync && !assetSyncSourceIsCurrentScenario) excludedIds.add(scenario.id);
    return excludedIds;
  }, [assetSyncSourceIsCurrentScenario, excludeCurrentScenarioFromAssetSync, scenario.id]);
  useEffect(() => {
    if (!scenarios.some((item) => item.id === assetSyncSourceScenarioId)) {
      setAssetSyncSourceScenarioId(scenario.id);
    }
  }, [assetSyncSourceScenarioId, scenario.id, scenarios]);
  const assetSyncSelectedTargetIdSet = useMemo(() => new Set(assetSyncSelectedTargetIds), [assetSyncSelectedTargetIds]);
  const assetSyncTargetCount = countAssetSyncTargets(
    scenarios,
    assetSyncSourceScenario.id,
    assetSyncTargetMode,
    assetSyncExcludedScenarioIds,
    assetSyncSelectedTargetIdSet,
  );
  const assetSyncTargetNames = getAssetSyncTargets(
    scenarios,
    assetSyncSourceScenario.id,
    assetSyncTargetMode,
    assetSyncExcludedScenarioIds,
    assetSyncSelectedTargetIdSet,
  ).map((item) => item.name);
  const assetSyncOptionSubAccountIds = useMemo(
    () => assetSyncSourceScenario.optionSubAccounts.map((account) => account.id),
    [assetSyncSourceScenario.optionSubAccounts],
  );
  const updateHistoricalAssetPreset = (assetKey: GrowthAssetKey, presetId: HistoricalReturnPresetId) => {
    updateScenario((s) => {
      const current = getEffectiveReturnModel(s.assetGrowthSettings);
      const next =
        current.mode === "historicalSinglePath" || current.mode === "historicalRollingRange"
          ? structuredClone(current)
          : createDefaultHistoricalSinglePathReturnModel(historicalStartYearMonth);
      if (next.mode !== "historicalSinglePath" && next.mode !== "historicalRollingRange") return;
      const preset = historicalReturnPresets.find((item) => item.id === presetId) ?? historicalReturnPresets[0];
      next.assetMappings = {
        ...next.assetMappings,
        [assetKey]: structuredClone(preset.mapping),
      };
      s.assetGrowthSettings.returnModel = next;
    });
  };
  const runRollingBacktest = () => {
    if (returnModel.mode !== "historicalRollingRange") return;
    const model = structuredClone(returnModel);
    const fingerprint = rollingBacktestFingerprint;
    setRollingBacktestState({ status: "running", fingerprint });
    window.setTimeout(() => {
      try {
        const result = runHistoricalRollingBacktest(structuredClone(scenario), model);
        setRollingBacktestState({ status: "done", fingerprint, result });
      } catch (error) {
        setRollingBacktestState({
          status: "error",
          fingerprint,
          error: error instanceof Error ? error.message : "範囲検証に失敗しました。",
        });
      }
    }, 0);
  };
  const assetSyncOptionSubAccountIdsKey = assetSyncOptionSubAccountIds.join("|");
  const linkedIncomeEventIdsForAssetSync = useMemo(
    () => getLinkedIncomeEventIdsForOptionSubAccounts(assetSyncSourceScenario, assetSyncOptionSubAccountIds),
    [assetSyncOptionSubAccountIdsKey, assetSyncSourceScenario],
  );
  const linkedIncomeEventsForAssetSync = assetSyncSourceScenario.incomeEvents.filter((event) =>
    linkedIncomeEventIdsForAssetSync.includes(event.id),
  );
  const shouldCopyLinkedIncomeEventsWithAssetSync =
    assetSyncOptions.optionSubAccounts && includeLinkedIncomeEventsWithAssetSync && linkedIncomeEventIdsForAssetSync.length > 0;
  const hasAssetSyncSelection = Object.values(assetSyncOptions).some(Boolean);
  const updateAssetSyncOption = (key: keyof AssetSyncOptions) => {
    setAssetSyncOptions((current) => ({ ...current, [key]: !current[key] }));
  };
  const toggleAssetSyncTarget = (scenarioId: string) => {
    setAssetSyncSelectedTargetIds((current) =>
      current.includes(scenarioId) ? current.filter((id) => id !== scenarioId) : [...current, scenarioId],
    );
  };
  const selectedAssetSyncLabels = [
    assetSyncOptions.liquidAssets ? "現金・預金・対象外資産" : "",
    assetSyncOptions.marketAssets ? "NISA・iDeCo等の評価額" : "",
    assetSyncOptions.costBasis ? "取得原価" : "",
    assetSyncOptions.optionSubAccounts ? "一般口座サブ口座" : "",
    shouldCopyLinkedIncomeEventsWithAssetSync ? `関連収入イベント ${linkedIncomeEventIdsForAssetSync.length}件` : "",
  ].filter(Boolean);
  const applyAssetSync = () => {
    if (assetSyncTargetCount === 0 || !hasAssetSyncSelection) return;
    const source = structuredClone(assetSyncSourceScenario);
    const linkedNames = linkedIncomeEventsForAssetSync.map((event) => event.name || "名称未設定");
    const confirmed = window.confirm(
      `「${source.name}」の ${selectedAssetSyncLabels.join("、")} を、コピー元自身を除く ${assetSyncTargetCount} 件のシナリオへ反映します。` +
        (!assetSyncSourceIsCurrentScenario && excludeCurrentScenarioFromAssetSync
          ? `現在開いている「${scenario.name}」は反映先から外します。`
          : "") +
        (assetSyncOptions.optionSubAccounts
          ? `\n\n主対象:\n・一般口座サブ口座 ${assetSyncOptionSubAccountIds.length}件`
          : "") +
        (shouldCopyLinkedIncomeEventsWithAssetSync
          ? `\n\n関連対象:\n・収入イベント ${linkedIncomeEventIdsForAssetSync.length}件（${linkedNames.join("、")}）`
          : assetSyncOptions.optionSubAccounts && linkedIncomeEventIdsForAssetSync.length > 0
            ? "\n\n注意:\n関連する収入イベントは一緒に反映しません。サブ口座だけでは入金力シナリオとして成立しない可能性があります。"
            : "") +
        `\n\n反映先:\n${formatScenarioNamesForConfirm(assetSyncTargetNames)}\n\n実行しますか？`,
    );
    if (!confirmed) return;
    updateScenarios((target) => {
      if (!isAssetSyncTarget(target, source.id, assetSyncTargetMode, assetSyncExcludedScenarioIds, assetSyncSelectedTargetIdSet)) return target;
      applyAssetSyncFromSource(
        target,
        source,
        assetSyncOptions,
        shouldCopyLinkedIncomeEventsWithAssetSync ? linkedIncomeEventIdsForAssetSync : undefined,
      );
      return target;
    });
    setAssetSyncMessage(
      `${assetSyncTargetCount} 件のシナリオへ反映しました: ${formatScenarioNamesForMessage(assetSyncTargetNames)}。` +
        (shouldCopyLinkedIncomeEventsWithAssetSync ? `関連収入イベント ${linkedIncomeEventIdsForAssetSync.length}件も反映しました。` : "") +
        "実行前の状態は履歴に保存されています。",
    );
  };
  const addOptionSubAccount = () =>
    updateScenario((s) => {
      s.optionSubAccounts.push({
        id: createId(),
        name: `一般口座${s.optionSubAccounts.length + 1}`,
        initialValue: 0,
        initialCostBasis: 0,
        startYearMonth: s.userProfile.simulationStartYearMonth,
        enabled: true,
        minimumBalance: 0,
        targetBalance: 0,
        withdrawalPriority: s.optionSubAccounts.length + 1,
        protectFromWithdrawal: true,
        releaseProtectionAfterEnd: true,
        suspendIncomeWhenBelowMinimum: true,
        profitSweepEnabled: false,
        profitSweepDestination: "bankDeposit",
        profitSweepTiming: "monthly",
        profitSweepMethod: "excessOverTarget",
        fixedSweepAmount: 0,
      });
      syncOptionInitialAssets(s);
    });
  const duplicateOptionSubAccount = (index: number) =>
    updateScenario((s) => {
      const source = s.optionSubAccounts[index];
      if (!source) return;
      s.optionSubAccounts.splice(index + 1, 0, {
        ...structuredClone(source),
        id: createId(),
        name: source.name ? `${source.name} コピー` : "一般口座 コピー",
        withdrawalPriority: s.optionSubAccounts.length + 1,
      });
      syncOptionInitialAssets(s);
    });
  const updateOptionSubAccount = <K extends keyof OptionSubAccount>(
    index: number,
    key: K,
    value: OptionSubAccount[K],
  ) =>
    updateScenario((s) => {
      s.optionSubAccounts[index][key] = value;
      if (key === "initialValue") {
        s.optionSubAccounts[index].initialCostBasis = Math.min(
          s.optionSubAccounts[index].initialCostBasis,
          s.optionSubAccounts[index].initialValue,
        );
      }
      syncOptionInitialAssets(s);
    });
  const deleteOptionSubAccount = (index: number) =>
    updateScenario((s) => {
      s.optionSubAccounts.splice(index, 1);
      syncOptionInitialAssets(s);
    });
  const addContribution = () =>
    updateScenario((s) =>
      s.assetContributionEvents.push({
        id: createId(),
        assetKey: "nisa",
        name: "新しい追加投資",
        startYearMonth: s.userProfile.simulationStartYearMonth,
        monthlyAmount: 0,
        nisaInvestmentSlot: "tsumitate",
        contributionPriority: 1,
        carryOverSkipped: false,
      }),
    );
  const duplicateContribution = (index: number) =>
    updateScenario((s) => {
      const source = s.assetContributionEvents[index];
      if (!source) return;
      s.assetContributionEvents.splice(index + 1, 0, {
        ...structuredClone(source),
        id: createId(),
        name: source.name ? `${source.name} コピー` : "追加投資 コピー",
      });
    });
  const addTransfer = () =>
    updateScenario((s) =>
      s.assetTransferEvents.push({
        id: createId(),
        name: "新しい原資移動",
        yearMonth: s.userProfile.simulationStartYearMonth,
        fromAssetKey: "cash",
        toAssetKey: "ordinaryAccountForOptions",
        toOptionSubAccountId: s.optionSubAccounts[0]?.id,
        amount: 0,
      }),
    );
  const duplicateTransfer = (index: number) =>
    updateScenario((s) => {
      const source = s.assetTransferEvents[index];
      if (!source) return;
      s.assetTransferEvents.splice(index + 1, 0, {
        ...structuredClone(source),
        id: createId(),
        name: source.name ? `${source.name} コピー` : "原資移動 コピー",
      });
    });
  const moveWithdrawalOrder = (index: number, direction: -1 | 1) =>
    updateScenario((s) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= s.withdrawalOrder.length) return;
      const [item] = s.withdrawalOrder.splice(index, 1);
      s.withdrawalOrder.splice(nextIndex, 0, item);
    });
  const nisaLifetimeLimit =
    (scenario.nisaInvestmentRules.lifetimeLimitPerInvestor ?? 18_000_000) * Math.max(1, scenario.nisaInvestmentRules.investorCount);
  const nisaRemainingLifetimeLimit = Math.max(0, nisaLifetimeLimit - (scenario.nisaInvestmentRules.usedLifetimeLimitAtStart ?? 0));
  return (
    <Card id="assets-current" data-input-card-id="assets-current">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>初期資産入力</CardTitle>
            <CardDescription>シミュレーション対象資産は対象外資産を除き、負債を差し引きます。証券系はマネーフォワードの評価額と評価損益をそのまま入れられます。</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormGrid>
          {liquidAssetKeys.map((key) => (
            <Field key={key} label={assetLabels[key]}>
              <Input type="number" value={scenario.initialAssets[key]} onChange={(event) => updateScenario((s) => void (s.initialAssets[key] = numberOrZero(event.target.value)))} />
            </Field>
          ))}
        </FormGrid>
        <GuidedDetails
          id="assets-cost-basis"
          title="NISA・iDeCo・特定口座などの評価額と評価損益"
          description="NISA、iDeCo、特定口座などについて、マネーフォワード等の `評価額` と `評価損益` を入力します。取得原価は自動計算し、課税口座の取り崩し時の税額概算に使います。"
          summary={`課税口座・iDeCoなどの取得原価を確認 / 含み損益対象 ${compactYen(scenario.initialAssets.specificAccount + scenario.initialAssets.ordinaryAccountForOptions + scenario.initialAssets.ideco)}`}
          priority="recommended"
          targetCardId={targetCardId}
          reviewHighlight
        >
            {gainTrackedAssets.filter(({ key }) => key !== "ordinaryAccountForOptions").map(({ key, label }) => {
              const currentValue = scenario.initialAssets[key];
              const costBasis = scenario.initialAssetCostBasis[key];
              const unrealizedGain = currentValue - costBasis;
              return (
                <div key={key} className="rounded-lg border p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-medium">{label}</h3>
                    <div className="text-sm text-muted-foreground">
                      含み益: <span className={unrealizedGain < 0 ? "text-destructive" : "text-primary"}>{yen(unrealizedGain)}</span>
                    </div>
                  </div>
                  <FormGrid>
                    <Field label="評価額">
                      <Input
                        type="number"
                        value={currentValue}
                        onChange={(event) => updateScenario((s) => void (s.initialAssets[key] = numberOrZero(event.target.value)))}
                      />
                    </Field>
                    <Field label="評価損益">
                      <Input
                        type="number"
                        value={unrealizedGain}
                        onChange={(event) =>
                          updateScenario((s) => {
                            const nextGain = numberOrZero(event.target.value);
                            s.initialAssetCostBasis[key] = Math.max(0, s.initialAssets[key] - nextGain);
                          })
                        }
                      />
                    </Field>
                    <Field label="取得原価(自動計算)">
                      <Input type="number" value={costBasis} readOnly />
                    </Field>
                    {key === "specificAccount" && (
                      <Field label="特定口座の税区分">
                        <Select
                          value={scenario.taxableAccountSettings.specificAccountWithholding}
                          onChange={(event) =>
                            updateScenario(
                              (s) =>
                                void (s.taxableAccountSettings.specificAccountWithholding = event.target.value as "withholding" | "noWithholding"),
                            )
                          }
                        >
                          <option value="withholding">源泉徴収あり</option>
                          <option value="noWithholding">源泉徴収なし（翌年支払）</option>
                        </Select>
                      </Field>
                    )}
                  </FormGrid>
                </div>
              );
            })}
        </GuidedDetails>
        <ScenarioSyncDetails
          title="一般口座（申告対象運用）のサブ口座"
          description="詳細設定。通常は閉じたままで構いません。"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="text-sm leading-6 text-muted-foreground">
                <p>申告対象の運用口座などを別口座として管理します。最低維持額、利益移動、取り崩し優先順位を口座ごとに設定できます。</p>
                <p className="mt-1 text-xs">
                  開始年月がシミュレーション開始より後の口座は、その月に現金・普通預金から初期金額を自動移動します。
                </p>
              </div>
              <Button onClick={addOptionSubAccount}>
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>
            <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
              合計評価額 {yen(scenario.initialAssets.ordinaryAccountForOptions)} / 取得原価 {yen(scenario.initialAssetCostBasis.ordinaryAccountForOptions)}
              <div className="mt-1 text-xs">
                開始年月が未来の口座は、シミュレーション開始月までは資金を持たず、開始月に現金・普通預金から自動移動します。
              </div>
            </div>
            {scenario.optionSubAccounts.map((account, index) => {
              const unrealizedGain = account.initialValue - account.initialCostBasis;
              return (
                <EventEditor
                  key={account.id}
                  title={account.name || "一般口座"}
                  onDelete={() => deleteOptionSubAccount(index)}
                  actions={
                    <Button variant="ghost" size="sm" onClick={() => duplicateOptionSubAccount(index)}>
                      <Copy className="h-4 w-4" />
                      複製
                    </Button>
                  }
                >
                  <FormGrid>
                    <Field label="口座名">
                      <Input value={account.name} onChange={(event) => updateOptionSubAccount(index, "name", event.target.value)} />
                    </Field>
                    <Field label="利用">
                      <Select
                        value={account.enabled ? "on" : "off"}
                        onChange={(event) => updateOptionSubAccount(index, "enabled", event.target.value === "on")}
                      >
                        <option value="on">使う</option>
                        <option value="off">使わない</option>
                      </Select>
                    </Field>
                    <Field label="開始年月">
                      <Input
                        type="month"
                        value={account.startYearMonth ?? ""}
                        onChange={(event) => updateOptionSubAccount(index, "startYearMonth", event.target.value || undefined)}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        開始年月がシミュレーション開始より後なら、その月に現金・普通預金から初期金額を自動移動します。
                      </p>
                    </Field>
                    <Field label="終了年月">
                      <Input
                        type="month"
                        value={account.endYearMonth ?? ""}
                        onChange={(event) => updateOptionSubAccount(index, "endYearMonth", event.target.value || undefined)}
                      />
                    </Field>
                    <Field label="評価額">
                      <Input
                        type="number"
                        value={account.initialValue}
                        onChange={(event) => updateOptionSubAccount(index, "initialValue", numberOrZero(event.target.value))}
                      />
                    </Field>
                    <Field label="評価損益">
                      <Input
                        type="number"
                        value={unrealizedGain}
                        onChange={(event) => {
                          const nextGain = numberOrZero(event.target.value);
                          updateOptionSubAccount(index, "initialCostBasis", Math.max(0, account.initialValue - nextGain));
                        }}
                      />
                    </Field>
                    <Field label="取得原価(自動計算)">
                      <Input type="number" value={account.initialCostBasis} readOnly />
                    </Field>
                    <Field label="最低維持証拠金">
                      <Input
                        type="number"
                        value={account.minimumBalance}
                        onChange={(event) => updateOptionSubAccount(index, "minimumBalance", numberOrZero(event.target.value))}
                      />
                    </Field>
                    <Field label="目標残高">
                      <Input
                        type="number"
                        value={account.targetBalance}
                        onChange={(event) => updateOptionSubAccount(index, "targetBalance", numberOrZero(event.target.value))}
                      />
                    </Field>
                    <Field label="取り崩し優先順位">
                      <Input
                        type="number"
                        min={1}
                        value={account.withdrawalPriority}
                        onChange={(event) => updateOptionSubAccount(index, "withdrawalPriority", Math.max(1, numberOrZero(event.target.value)))}
                      />
                    </Field>
                    <Field label="取り崩し保護">
                      <Select
                        value={account.protectFromWithdrawal ? "on" : "off"}
                        onChange={(event) => updateOptionSubAccount(index, "protectFromWithdrawal", event.target.value === "on")}
                      >
                        <option value="on">最低維持額を守る</option>
                        <option value="off">保護しない</option>
                      </Select>
                    </Field>
                    <Field label="終了後の保護">
                      <Select
                        value={account.releaseProtectionAfterEnd ? "release" : "keep"}
                        onChange={(event) => updateOptionSubAccount(index, "releaseProtectionAfterEnd", event.target.value === "release")}
                      >
                        <option value="release">終了後は外す</option>
                        <option value="keep">終了後も守る</option>
                      </Select>
                    </Field>
                    <Field label="証拠金不足時">
                      <Select
                        value={account.suspendIncomeWhenBelowMinimum ? "suspend" : "warnOnly"}
                        onChange={(event) => updateOptionSubAccount(index, "suspendIncomeWhenBelowMinimum", event.target.value === "suspend")}
                      >
                        <option value="suspend">収益を止める</option>
                        <option value="warnOnly">警告のみ</option>
                      </Select>
                    </Field>
                    <Field label="利益移動">
                      <Select
                        value={account.profitSweepEnabled ? "on" : "off"}
                        onChange={(event) => updateOptionSubAccount(index, "profitSweepEnabled", event.target.value === "on")}
                      >
                        <option value="off">しない</option>
                        <option value="on">する</option>
                      </Select>
                    </Field>
                    <Field label="利益移動先">
                      <Select
                        value={account.profitSweepDestination}
                        onChange={(event) => updateOptionSubAccount(index, "profitSweepDestination", event.target.value as "cash" | "bankDeposit")}
                      >
                        <option value="bankDeposit">普通預金</option>
                        <option value="cash">現金</option>
                      </Select>
                    </Field>
                    <Field label="利益移動タイミング">
                      <Select
                        value={account.profitSweepTiming}
                        onChange={(event) => updateOptionSubAccount(index, "profitSweepTiming", event.target.value as "monthly" | "yearEnd")}
                      >
                        <option value="monthly">毎月末</option>
                        <option value="yearEnd">年末</option>
                      </Select>
                    </Field>
                    <Field label="利益移動方法">
                      <Select
                        value={account.profitSweepMethod}
                        onChange={(event) => updateOptionSubAccount(index, "profitSweepMethod", event.target.value as "excessOverTarget" | "fixedAmount")}
                      >
                        <option value="excessOverTarget">目標残高を超えた分</option>
                        <option value="fixedAmount">固定額</option>
                      </Select>
                    </Field>
                    <Field label="固定移動額">
                      <Input
                        type="number"
                        value={account.fixedSweepAmount}
                        onChange={(event) => updateOptionSubAccount(index, "fixedSweepAmount", numberOrZero(event.target.value))}
                      />
                    </Field>
                  </FormGrid>
                </EventEditor>
              );
            })}
          </div>
        </ScenarioSyncDetails>
        <div className="grid gap-4 sm:grid-cols-2">
          <Metric title="初期総資産" value={compactYen(getTotalAssets(scenario))} sub="対象外資産を含む" />
          <Metric title="シミュレーション対象資産" value={compactYen(getSimulationTargetAssets(scenario))} sub="取り崩し計算の起点" />
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>資産別利回り</CardTitle>
            <CardDescription>生活費・税社保・積立・受取はそのまま使い、資産成長率だけを固定年率または過去市場だった場合に切り替えます。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 md:grid-cols-5">
              <Field label="資産成長率反映">
                <Select
                  value={scenario.assetGrowthSettings.enabled ? "on" : "off"}
                  onChange={(event) => updateScenario((s) => void (s.assetGrowthSettings.enabled = event.target.value === "on"))}
                >
                  <option value="on">ON</option>
                  <option value="off">OFF</option>
                </Select>
              </Field>
              <Field label="運用リターン方式">
                <Select
                  value={returnModelMode}
                  onChange={(event) => {
                    const mode = event.target.value;
                    updateScenario((s) => {
                      s.assetGrowthSettings.returnModel =
                        mode === "historicalSinglePath"
                          ? createDefaultHistoricalSinglePathReturnModel(historicalStartYearMonth)
                          : mode === "historicalRollingRange"
                            ? createDefaultHistoricalRollingRangeReturnModel(historicalRangeStartYearMonth, historicalRangeEndYearMonth)
                          : { mode: "fixedAnnual" };
                    });
                  }}
                >
                  <option value="fixedAnnual">固定年率</option>
                  <option value="historicalSinglePath">過去実績・単一期間</option>
                  <option value="historicalRollingRange">過去実績・範囲検証</option>
                </Select>
              </Field>
              <Field label="為替モード">
                <Select
                  value={historicalCurrencyMode}
                  disabled={returnModelMode === "fixedAnnual"}
                  onChange={(event) => updateScenario((s) => {
                    const currencyMode = event.target.value as HistoricalCurrencyMode;
                    const current = getEffectiveReturnModel(s.assetGrowthSettings);
                    if (current.mode === "historicalSinglePath" || current.mode === "historicalRollingRange") {
                      s.assetGrowthSettings.returnModel = { ...current, currencyMode };
                    }
                  })}
                >
                  <option value="indexOnly">{historicalCurrencyModeLabels.indexOnly}</option>
                  <option value="jpyConverted">{historicalCurrencyModeLabels.jpyConverted}</option>
                </Select>
              </Field>
              <Field label="過去開始月">
                <Input
                  type="month"
                  value={historicalStartYearMonth}
                  disabled={returnModelMode !== "historicalSinglePath"}
                  onChange={(event) => updateScenario((s) => {
                    const startYearMonth = event.target.value || defaultHistoricalStartYearMonth;
                    const current = getEffectiveReturnModel(s.assetGrowthSettings);
                    s.assetGrowthSettings.returnModel =
                      current.mode === "historicalSinglePath"
                        ? { ...current, startYearMonth }
                        : createDefaultHistoricalSinglePathReturnModel(startYearMonth);
                  })}
                />
              </Field>
              <Field label="検証範囲開始月">
                <Input
                  type="month"
                  value={historicalRangeStartYearMonth}
                  disabled={returnModelMode !== "historicalRollingRange"}
                  onChange={(event) => updateScenario((s) => {
                    const rangeStartYearMonth = event.target.value || historicalReturnDataset.firstMonth;
                    const current = getEffectiveReturnModel(s.assetGrowthSettings);
                    s.assetGrowthSettings.returnModel =
                      current.mode === "historicalRollingRange"
                        ? { ...current, rangeStartYearMonth }
                        : createDefaultHistoricalRollingRangeReturnModel(rangeStartYearMonth, historicalRangeEndYearMonth);
                  })}
                />
              </Field>
              <Field label="検証範囲終了月">
                <Input
                  type="month"
                  value={historicalRangeEndYearMonth}
                  disabled={returnModelMode !== "historicalRollingRange"}
                  onChange={(event) => updateScenario((s) => {
                    const rangeEndYearMonth = event.target.value || historicalReturnDataset.lastMonth;
                    const current = getEffectiveReturnModel(s.assetGrowthSettings);
                    s.assetGrowthSettings.returnModel =
                      current.mode === "historicalRollingRange"
                        ? { ...current, rangeEndYearMonth }
                        : createDefaultHistoricalRollingRangeReturnModel(historicalRangeStartYearMonth, rangeEndYearMonth);
                  })}
                />
              </Field>
            </div>
            {(returnModelMode === "historicalSinglePath" || returnModelMode === "historicalRollingRange") && (
              <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">過去市場でこの人生設計を検証</div>
                <div>
                  データは{historicalReturnDataset.label}、範囲は{historicalReturnDataset.firstMonth}〜{historicalReturnDataset.lastMonth}です。
                  為替モード: {historicalCurrencyModeLabels[historicalCurrencyMode]}。
                </div>
                {historicalCurrencyMode === "jpyConverted" && (
                  <div>
                    円換算リターンは、選択した過去期間のUSD/JPY変動を米国株・米国債券の月次リターンに重ねて、円建て資産として試算します。
                    現在の為替レートで未来を予測するものではありません。
                  </div>
                )}
                {returnModelMode === "historicalSinglePath" ? (
                  <>
                    <div>
                      この設定では、シナリオ開始月から{scenario.userProfile.targetBalanceAge}歳到達月までに必要な
                      {historicalDataCoverage.requiredMonths}か月分の過去データを使います。
                      使用範囲: {historicalDataCoverage.startYearMonth}〜{historicalDataCoverage.lastRequiredMonth}。
                    </div>
                    {historicalDataCoverage.isSufficient ? (
                      <div>選択した開始月では必要月数分のデータがあります。データが不足する開始月は検証対象から外します。</div>
                    ) : (
                      <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
                        過去データが不足しています。この開始月では{historicalDataCoverage.availableMonths}か月分しか使えず、
                        {historicalDataCoverage.missingMonths}か月不足します。平均リターンや固定年率では補完しません。
                        {historicalDataCoverage.requiresUsdJpy ? " 円換算リターンにはUSD/JPY月次データも必要です。開始月を変更するか、指数リターンのみを選んでください。" : ""}
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    この設定では、シナリオ開始月から{scenario.userProfile.targetBalanceAge}歳到達月までに必要な
                    {rollingBacktestEstimate?.requiredMonths ?? requiredHistoricalReturnMonths}か月分の過去データを使います。
                    検証範囲内の開始月 {rollingBacktestEstimate?.totalPathCount ?? 0}件のうち、
                    対象 {rollingBacktestEstimate?.validPathCount ?? 0}件 / 除外 {rollingBacktestEstimate?.excludedPathCount ?? 0}件です。
                    データ不足分は平均リターンなどで補完しません。
                    {historicalCurrencyMode === "jpyConverted"
                      ? " 円換算リターンにはUSD/JPY月次データが必要です。データが不足する開始月は検証対象から外しています。"
                      : ""}
                  </div>
                )}
                <div>
                  必要データ: {(returnModelMode === "historicalRollingRange" ? rollingBacktestEstimate?.requiredIndexIds : historicalDataCoverage.requiredIndexIds)?.length
                    ? [
                        ...((returnModelMode === "historicalRollingRange" ? rollingBacktestEstimate?.requiredIndexIds : historicalDataCoverage.requiredIndexIds) ?? []),
                        ...(historicalCurrencyMode === "jpyConverted" ? ["USD/JPY"] : []),
                      ].join(" / ")
                    : "なし（固定年率のみ）"}
                </div>
                <div className="mt-3 rounded-md border bg-white/80 p-3">
                  <div className="font-medium text-foreground">資産別の過去実績配分</div>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {historicalAssetMappingRows.map((row) => (
                      <Field key={row.key} label={row.label}>
                        <Select
                          value={row.presetId}
                          onChange={(event) => updateHistoricalAssetPreset(row.key, event.target.value as HistoricalReturnPresetId)}
                        >
                          {historicalReturnPresets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    ))}
                  </div>
                  <div className="mt-2 text-xs">
                    現在の配分: {activeHistoricalMappingSummary}。現金・普通預金・定期預金は固定年率設定を使います。
                  </div>
                </div>
                <div>{historicalReturnDataset.note} 将来を保証するものではありません。</div>
              </div>
            )}
            {returnModelMode === "historicalRollingRange" && rollingBacktestEstimate && (
              <HistoricalRollingStressTestCard
                estimate={rollingBacktestEstimate}
                state={rollingBacktestState}
                needsRerun={rollingBacktestNeedsRerun}
                targetBalanceAge={scenario.userProfile.targetBalanceAge}
                onRun={runRollingBacktest}
              />
            )}
            <FormGrid>
              {editableGrowthAssetKeys.map((key) => (
                <RateField
                  key={key}
                  label={growthAssetLabels[key]}
                  value={scenario.assetGrowthSettings.rates[key]}
                  onChange={(value) => updateScenario((s) => void (s.assetGrowthSettings.rates[key] = value))}
                />
              ))}
            </FormGrid>
          </CardContent>
        </Card>

        {scenario.optionSubAccounts.length === 0 && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>一般口座（オプション用）の運用ルール</CardTitle>
              <CardDescription>サブ口座がない旧形式データ用の一括ルールです。</CardDescription>
            </CardHeader>
            <CardContent>
              <FormGrid>
                <Field label="運用ルール">
                  <Select
                    value={scenario.optionAccountRules.enabled ? "on" : "off"}
                    onChange={(event) => updateScenario((s) => void (s.optionAccountRules.enabled = event.target.value === "on"))}
                  >
                    <option value="on">ON</option>
                    <option value="off">OFF</option>
                  </Select>
                </Field>
                <Field label="最低維持額">
                  <Input
                    type="number"
                    value={scenario.optionAccountRules.minimumBalance}
                    onChange={(event) => updateScenario((s) => void (s.optionAccountRules.minimumBalance = numberOrZero(event.target.value)))}
                  />
                </Field>
                <Field label="目標残高">
                  <Input
                    type="number"
                    value={scenario.optionAccountRules.targetBalance}
                    onChange={(event) => updateScenario((s) => void (s.optionAccountRules.targetBalance = numberOrZero(event.target.value)))}
                  />
                </Field>
                <Field label="取り崩し保護">
                  <Select
                    value={scenario.optionAccountRules.protectFromWithdrawal ? "on" : "off"}
                    onChange={(event) => updateScenario((s) => void (s.optionAccountRules.protectFromWithdrawal = event.target.value === "on"))}
                  >
                    <option value="on">最低維持額を守る</option>
                    <option value="off">保護しない</option>
                  </Select>
                </Field>
                <Field label="最低維持額未満">
                  <Select
                    value={scenario.optionAccountRules.suspendIncomeWhenBelowMinimum ? "suspend" : "warnOnly"}
                    onChange={(event) => updateScenario((s) => void (s.optionAccountRules.suspendIncomeWhenBelowMinimum = event.target.value === "suspend"))}
                  >
                    <option value="suspend">オプション収益を止める</option>
                    <option value="warnOnly">警告のみ</option>
                  </Select>
                </Field>
                <Field label="利益移動">
                  <Select
                    value={scenario.optionAccountRules.profitSweepEnabled ? "on" : "off"}
                    onChange={(event) => updateScenario((s) => void (s.optionAccountRules.profitSweepEnabled = event.target.value === "on"))}
                  >
                    <option value="off">しない</option>
                    <option value="on">する</option>
                  </Select>
                </Field>
                <Field label="利益移動先">
                  <Select
                    value={scenario.optionAccountRules.profitSweepDestination}
                    onChange={(event) => updateScenario((s) => void (s.optionAccountRules.profitSweepDestination = event.target.value as "cash" | "bankDeposit"))}
                  >
                    <option value="bankDeposit">普通預金</option>
                    <option value="cash">現金</option>
                  </Select>
                </Field>
                <Field label="移動タイミング">
                  <Select
                    value={scenario.optionAccountRules.profitSweepTiming}
                    onChange={(event) => updateScenario((s) => void (s.optionAccountRules.profitSweepTiming = event.target.value as "monthly" | "yearEnd"))}
                  >
                    <option value="monthly">毎月末</option>
                    <option value="yearEnd">年末</option>
                  </Select>
                </Field>
                <Field label="移動方法">
                  <Select
                    value={scenario.optionAccountRules.profitSweepMethod}
                    onChange={(event) => updateScenario((s) => void (s.optionAccountRules.profitSweepMethod = event.target.value as "excessOverTarget" | "fixedAmount"))}
                  >
                    <option value="excessOverTarget">目標残高を超えた分</option>
                    <option value="fixedAmount">固定額</option>
                  </Select>
                </Field>
                <Field label="固定移動額">
                  <Input
                    type="number"
                    value={scenario.optionAccountRules.fixedSweepAmount}
                    onChange={(event) => updateScenario((s) => void (s.optionAccountRules.fixedSweepAmount = numberOrZero(event.target.value)))}
                  />
                </Field>
              </FormGrid>
            </CardContent>
          </Card>
        )}

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>NISA投資計画ルール</CardTitle>
            <CardDescription>NISAを売ってNISAへ入れる矛盾を避け、年間投資枠と原資不足を管理します。</CardDescription>
          </CardHeader>
          <CardContent>
            <FormGrid>
              <Field label="年間投資枠">
                <Input
                  type="number"
                  value={scenario.nisaInvestmentRules.annualLimit}
                  onChange={(event) => updateScenario((s) => void (s.nisaInvestmentRules.annualLimit = numberOrZero(event.target.value)))}
                />
              </Field>
              <Field label="利用人数">
                <Input
                  type="number"
                  min={1}
                  value={scenario.nisaInvestmentRules.investorCount}
                  onChange={(event) => updateScenario((s) => void (s.nisaInvestmentRules.investorCount = Math.max(1, numberOrZero(event.target.value))))}
                />
              </Field>
              <Field label="生涯投資枠（1人）">
                <Input
                  type="number"
                  value={scenario.nisaInvestmentRules.lifetimeLimitPerInvestor ?? 18_000_000}
                  onChange={(event) => updateScenario((s) => void (s.nisaInvestmentRules.lifetimeLimitPerInvestor = numberOrZero(event.target.value)))}
                />
              </Field>
              <Field label="開始時点の利用済み枠（世帯合計）">
                <Input
                  type="number"
                  value={scenario.nisaInvestmentRules.usedLifetimeLimitAtStart ?? 0}
                  onChange={(event) => updateScenario((s) => void (s.nisaInvestmentRules.usedLifetimeLimitAtStart = numberOrZero(event.target.value)))}
                />
              </Field>
              <Metric title="開始時点の残りNISA枠" value={compactYen(nisaRemainingLifetimeLimit)} sub={`生涯枠 ${compactYen(nisaLifetimeLimit)} から利用済み枠を控除`} />
              <Field label="年間枠チェック">
                <Select
                  value={scenario.nisaInvestmentRules.enforceAnnualLimit ? "on" : "off"}
                  onChange={(event) => updateScenario((s) => void (s.nisaInvestmentRules.enforceAnnualLimit = event.target.value === "on"))}
                >
                  <option value="on">枠を超えた分は未実行</option>
                  <option value="off">警告のみ</option>
                </Select>
              </Field>
              <Field label="積立中のNISA">
                <Select
                  value={scenario.nisaInvestmentRules.protectDuringContribution ? "on" : "off"}
                  onChange={(event) => updateScenario((s) => void (s.nisaInvestmentRules.protectDuringContribution = event.target.value === "on"))}
                >
                  <option value="on">取り崩し禁止</option>
                  <option value="off">取り崩し順に従う</option>
                </Select>
              </Field>
              <Field label="原資不足時">
                <Select
                  value={scenario.nisaInvestmentRules.insufficientFundingMode}
                  onChange={(event) => updateScenario((s) => void (s.nisaInvestmentRules.insufficientFundingMode = event.target.value as "skip" | "withdrawOtherAssets"))}
                >
                  <option value="skip">不足分は積立未実行</option>
                  <option value="withdrawOtherAssets">他資産から補填</option>
                </Select>
              </Field>
              <Field label="未実行分">
                <Select
                  value={scenario.nisaInvestmentRules.carryOverSkippedMode}
                  onChange={(event) =>
                    updateScenario(
                      (s) =>
                        void (s.nisaInvestmentRules.carryOverSkippedMode = event.target.value as "none" | "withinYear" | "acrossYears"),
                    )
                  }
                >
                  <option value="none">その月だけ未実行</option>
                  <option value="withinYear">同じ年内で繰り越す</option>
                  <option value="acrossYears">翌年以降も繰り越す</option>
                </Select>
              </Field>
            </FormGrid>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>口座への原資移動</CardTitle>
                <CardDescription>開始前や途中で、現金・預金から運用口座へ一回だけ資金を移します。運用口座の開始月に必要な原資移動などに使えます。</CardDescription>
              </div>
              <Button onClick={addTransfer}>
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {scenario.assetTransferEvents.map((event, index) => (
              <EventEditor
                key={event.id}
                title={event.name || "原資移動"}
                onDelete={() => updateScenario((s) => void s.assetTransferEvents.splice(index, 1))}
                actions={
                  <Button variant="ghost" size="sm" onClick={() => duplicateTransfer(index)}>
                    <Copy className="h-4 w-4" />
                    複製
                  </Button>
                }
              >
                <FormGrid>
                  <Field label="名称">
                    <Input value={event.name} onChange={(e) => updateScenario((s) => void (s.assetTransferEvents[index].name = e.target.value))} />
                  </Field>
                  <Field label="移動元">
                    <Select
                      value={event.fromAssetKey}
                      onChange={(e) => updateScenario((s) => void (s.assetTransferEvents[index].fromAssetKey = e.target.value as AssetTransferSourceKey))}
                    >
                      {Object.entries(assetTransferSourceLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="移動先">
                    <Select
                      value={event.toAssetKey}
                      onChange={(e) =>
                        updateScenario((s) => {
                          s.assetTransferEvents[index].toAssetKey = e.target.value as AssetTransferTargetKey;
                          if (s.assetTransferEvents[index].toAssetKey !== "ordinaryAccountForOptions") {
                            s.assetTransferEvents[index].toOptionSubAccountId = undefined;
                          }
                        })
                      }
                    >
                      {Object.entries(assetTransferTargetLabels)
                        .filter(([key]) => key !== event.fromAssetKey)
                        .map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  {event.toAssetKey === "ordinaryAccountForOptions" && scenario.optionSubAccounts.length > 0 && (
                    <Field label="移動先サブ口座">
                      <Select
                        value={event.toOptionSubAccountId ?? scenario.optionSubAccounts[0]?.id ?? ""}
                        onChange={(e) => updateScenario((s) => void (s.assetTransferEvents[index].toOptionSubAccountId = e.target.value))}
                      >
                        {scenario.optionSubAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  <Field label="移動年月">
                    <Input type="month" value={event.yearMonth} onChange={(e) => updateScenario((s) => void (s.assetTransferEvents[index].yearMonth = e.target.value))} />
                  </Field>
                  <Field label="金額">
                    <Input type="number" value={event.amount} onChange={(e) => updateScenario((s) => void (s.assetTransferEvents[index].amount = numberOrZero(e.target.value)))} />
                  </Field>
                </FormGrid>
              </EventEditor>
            ))}
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>取り崩し順</CardTitle>
            <CardDescription>流動資金で不足を吸収しきれないとき、どの口座から先に取り崩すかをシナリオごとに並べ替えます。比較タブで順番違いを比較できます。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {scenario.withdrawalOrder.map((key, index) => (
              <div key={key} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div className="text-sm">
                  {index + 1}. {withdrawalOrderLabels[key]}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => moveWithdrawalOrder(index, -1)} disabled={index === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveWithdrawalOrder(index, 1)}
                    disabled={index === scenario.withdrawalOrder.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>将来の積立予定</CardTitle>
                <CardDescription>
                  現在の資産額ではなく、開始月以降に毎月投資する予定額です。生活費・税社保を払った後の資金から実行されます。
                </CardDescription>
              </div>
              <Button onClick={addContribution}>
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {scenario.assetContributionEvents.length === 0 && (
              <div className="rounded-md border border-dashed bg-slate-50 px-4 py-3 text-sm leading-6 text-muted-foreground">
                積立予定はまだありません。NISA積立などを将来も続ける場合だけ追加します。
              </div>
            )}
            {scenario.assetContributionEvents.map((event, index) => (
              <EventEditor
                key={event.id}
                title={event.name || "追加投資"}
                onDelete={() => updateScenario((s) => void s.assetContributionEvents.splice(index, 1))}
                actions={
                  <Button variant="ghost" size="sm" onClick={() => duplicateContribution(index)}>
                    <Copy className="h-4 w-4" />
                    複製
                  </Button>
                }
              >
                <FormGrid>
                  <Field label="名称">
                    <Input value={event.name} onChange={(e) => updateScenario((s) => void (s.assetContributionEvents[index].name = e.target.value))} />
                  </Field>
                  <Field label="対象資産">
                    <Select
                      value={event.assetKey}
                      onChange={(e) => updateScenario((s) => void (s.assetContributionEvents[index].assetKey = e.target.value as GrowthAssetKey))}
                    >
                      {Object.entries(growthAssetLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="開始年月">
                    <Input type="month" value={event.startYearMonth} onChange={(e) => updateScenario((s) => void (s.assetContributionEvents[index].startYearMonth = e.target.value))} />
                  </Field>
                  <Field label="終了年月">
                    <Input
                      type="month"
                      value={event.endYearMonth ?? ""}
                      onChange={(e) => updateScenario((s) => void (s.assetContributionEvents[index].endYearMonth = e.target.value || undefined))}
                    />
                  </Field>
                  <Field label="月額">
                    <Input
                      type="number"
                      value={event.monthlyAmount}
                      onChange={(e) => updateScenario((s) => void (s.assetContributionEvents[index].monthlyAmount = numberOrZero(e.target.value)))}
                    />
                  </Field>
                  {event.assetKey === "nisa" && (
                    <>
                      <Field label="NISA枠">
                        <Select
                          value={event.nisaInvestmentSlot ?? "tsumitate"}
                          onChange={(e) =>
                            updateScenario((s) => {
                              const slot = e.target.value as "tsumitate" | "growth";
                              const target = s.assetContributionEvents[index];
                              target.nisaInvestmentSlot = slot;
                              target.contributionPriority = slot === "growth" ? 2 : 1;
                              target.carryOverSkipped = slot === "growth";
                            })
                          }
                        >
                          <option value="tsumitate">積立投資枠（優先）</option>
                          <option value="growth">成長投資枠（一括・繰越）</option>
                        </Select>
                      </Field>
                      <Field label="優先順位">
                        <Input
                          type="number"
                          value={event.contributionPriority ?? (event.nisaInvestmentSlot === "growth" ? 2 : 1)}
                          onChange={(e) => updateScenario((s) => void (s.assetContributionEvents[index].contributionPriority = Math.max(1, numberOrZero(e.target.value))))}
                        />
                      </Field>
                      <Field label="原資不足時">
                        <Select
                          value={event.carryOverSkipped ? "carry" : "skip"}
                          onChange={(e) => updateScenario((s) => void (s.assetContributionEvents[index].carryOverSkipped = e.target.value === "carry"))}
                        >
                          <option value="skip">その月は未実行</option>
                          <option value="carry">未実行分を繰り越す</option>
                        </Select>
                      </Field>
                    </>
                  )}
                </FormGrid>
              </EventEditor>
            ))}
          </CardContent>
        </Card>
        <ScenarioSyncDetails
          title="他シナリオへ反映（必要時のみ）"
          description="初期資産前提をまとめてコピーする時だけ開きます。"
        >
        <div className="rounded-lg border bg-white px-4 py-3">
          <div className="grid gap-4 lg:grid-cols-[minmax(260px,420px)_1fr]">
            <Field label="コピー元シナリオ">
              <Select value={assetSyncSourceScenario.id} onChange={(event) => setAssetSyncSourceScenarioId(event.target.value)}>
                {scenarios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
              現在のコピー元は「{assetSyncSourceScenario.name}」です。初期資産の反映だけに使い、表示中シナリオの入力欄は切り替えません。
            </div>
          </div>
          {!assetSyncSourceIsCurrentScenario && (
            <label className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <input
                type="checkbox"
                checked={excludeCurrentScenarioFromAssetSync}
                onChange={(event) => setExcludeCurrentScenarioFromAssetSync(event.target.checked)}
              />
              <span>
                <span className="block font-medium">現在開いているシナリオは上書きしない</span>
                <span className="text-xs">
                  「{scenario.name}」を見ながら別シナリオをコピー元にする場合の誤反映を防ぎます。意図して現在のシナリオにも反映する場合だけ外してください。
                </span>
              </span>
            </label>
          )}
        </div>
        <ScenarioSyncCard<keyof AssetSyncOptions>
          title="初期資産前提を他シナリオへ反映"
          description="コピー元シナリオを選び、初期資産の前提だけを他シナリオへ反映します。計算ロジックや生活費・収入・特別支出は変更しません。"
          targetMode={assetSyncTargetMode}
          setTargetMode={setAssetSyncTargetMode}
          targetCount={assetSyncTargetCount}
          targetNames={assetSyncTargetNames}
          allScenarios={scenarios}
          sourceScenarioId={assetSyncSourceScenario.id}
          excludedScenarioIds={assetSyncExcludedScenarioIds}
          selectedTargetIds={assetSyncSelectedTargetIdSet}
          toggleSelectedTarget={toggleAssetSyncTarget}
          targetSummary={
            `コピー元「${assetSyncSourceScenario.name}」自身を除く ${assetSyncTargetCount} 件に反映します。` +
            (!assetSyncSourceIsCurrentScenario && excludeCurrentScenarioFromAssetSync
              ? `現在開いている「${scenario.name}」も誤操作防止のため反映先から外します。`
              : "")
          }
          options={[
            { key: "liquidAssets", label: "現金・預金・対象外資産", description: "現金、普通預金、定期預金、対象外資産、負債" },
            { key: "marketAssets", label: "NISA・iDeCo等の評価額", description: "NISA、特定口座、iDeCoの評価額" },
            { key: "costBasis", label: "取得原価", description: "譲渡益税の前提。評価額更新時は通常一緒に反映" },
            { key: "optionSubAccounts", label: "一般口座サブ口座", description: "口座構成、評価額、取得原価、運用ルールも反映" },
          ]}
          selectedOptions={assetSyncOptions}
          toggleOption={updateAssetSyncOption}
          warningText="反映は明示実行時だけです。シナリオ別に意図して変えた資産前提がある場合は、反映先を確認してください。"
          onApply={applyAssetSync}
          message={assetSyncMessage}
        />
        {assetSyncOptions.optionSubAccounts && linkedIncomeEventsForAssetSync.length > 0 && (
          <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950">
            <div className="font-medium">関連する収入イベントがあります</div>
            <p className="mt-1">この一般口座サブ口座を原資にする収入イベントがあります。</p>
            <label className="mt-3 flex items-start gap-2 rounded-md border bg-white/70 px-3 py-2">
              <input
                type="checkbox"
                checked={includeLinkedIncomeEventsWithAssetSync}
                onChange={(event) => setIncludeLinkedIncomeEventsWithAssetSync(event.target.checked)}
              />
              <span>
                <span className="block font-medium">関連する収入イベントも一緒に反映する（推奨）</span>
                <span className="text-xs text-muted-foreground">
                  サブ口座だけを反映すると、反映先シナリオで収入イベントが作られず、入金力シナリオとしては成立しない可能性があります。
                </span>
              </span>
            </label>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {linkedIncomeEventsForAssetSync.map((event) => {
                const accountId = resolveIncomeEventOptionSubAccountId(assetSyncSourceScenario, event);
                const account = assetSyncSourceScenario.optionSubAccounts.find((item) => item.id === accountId);
                return (
                  <div key={event.id} className="rounded-md border bg-white px-3 py-2">
                    <div className="font-medium">{event.name || "名称未設定"}</div>
                    <div className="text-xs text-muted-foreground">
                      月額 {compactYen(event.monthlyAmount)} / {account?.name ?? "関連サブ口座未特定"} /{" "}
                      {event.sourceAssetPayoutMode === "retainInSourceAsset" ? "口座内積上" : "現金収入"}
                    </div>
                  </div>
                );
              })}
            </div>
            {!includeLinkedIncomeEventsWithAssetSync && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                サブ口座だけを反映すると、反映先シナリオで収入イベントが作られず、入金力シナリオとしては成立しない可能性があります。
              </div>
            )}
          </div>
        )}
        </ScenarioSyncDetails>
      </CardContent>
    </Card>
  );
}

function ExpensesSection({
  scenario,
  scenarios,
  updateScenario,
  updateScenarios,
}: SectionProps & {
  scenarios: ScenarioData[];
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData, backupLabel?: string) => void;
}) {
  const [expenseSyncTargetMode, setExpenseSyncTargetMode] = useState<AssetSyncTargetMode>("compare");
  const [expenseSyncSelectedTargetIds, setExpenseSyncSelectedTargetIds] = useState<string[]>([]);
  const [expenseSyncSourceScenarioId, setExpenseSyncSourceScenarioId] = useState(scenario.id);
  const [excludeCurrentScenarioFromExpenseSync, setExcludeCurrentScenarioFromExpenseSync] = useState(true);
  const [expenseSyncOptions, setExpenseSyncOptions] = useState<ExpenseSyncOptions>({
    monthlyExpenses: true,
    ageAdjustments: true,
    expenseInflation: true,
  });
  const [expenseSyncMessage, setExpenseSyncMessage] = useState<string | null>(null);
  const expenseSyncSourceScenario = scenarios.find((item) => item.id === expenseSyncSourceScenarioId) ?? scenario;
  const expenseSyncSourceIsCurrentScenario = expenseSyncSourceScenario.id === scenario.id;
  const expenseSyncExcludedScenarioIds = useMemo(() => {
    const excludedIds = new Set<string>();
    if (excludeCurrentScenarioFromExpenseSync && !expenseSyncSourceIsCurrentScenario) excludedIds.add(scenario.id);
    return excludedIds;
  }, [excludeCurrentScenarioFromExpenseSync, expenseSyncSourceIsCurrentScenario, scenario.id]);
  useEffect(() => {
    if (!scenarios.some((item) => item.id === expenseSyncSourceScenarioId)) {
      setExpenseSyncSourceScenarioId(scenario.id);
    }
  }, [expenseSyncSourceScenarioId, scenario.id, scenarios]);
  const expenseSyncSelectedTargetIdSet = useMemo(() => new Set(expenseSyncSelectedTargetIds), [expenseSyncSelectedTargetIds]);
  const expenseSyncTargetCount = countAssetSyncTargets(
    scenarios,
    expenseSyncSourceScenario.id,
    expenseSyncTargetMode,
    expenseSyncExcludedScenarioIds,
    expenseSyncSelectedTargetIdSet,
  );
  const expenseSyncTargetNames = getAssetSyncTargets(
    scenarios,
    expenseSyncSourceScenario.id,
    expenseSyncTargetMode,
    expenseSyncExcludedScenarioIds,
    expenseSyncSelectedTargetIdSet,
  ).map((item) => item.name);
  const hasExpenseSyncSelection = Object.values(expenseSyncOptions).some(Boolean);
  const selectedExpenseSyncLabels = [
    expenseSyncOptions.monthlyExpenses ? "月額生活費" : "",
    expenseSyncOptions.ageAdjustments ? "年齢別の生活費変更" : "",
    expenseSyncOptions.expenseInflation ? "生活費・医療費インフレ設定" : "",
  ].filter(Boolean);
  const updateExpenseSyncOption = (key: keyof ExpenseSyncOptions) => {
    setExpenseSyncOptions((current) => ({ ...current, [key]: !current[key] }));
  };
  const toggleExpenseSyncTarget = (scenarioId: string) => {
    setExpenseSyncSelectedTargetIds((current) =>
      current.includes(scenarioId) ? current.filter((id) => id !== scenarioId) : [...current, scenarioId],
    );
  };
  const applyExpenseSync = () => {
    if (expenseSyncTargetCount === 0 || !hasExpenseSyncSelection) return;
    const source = structuredClone(expenseSyncSourceScenario);
    const confirmed = window.confirm(
      `「${source.name}」の ${selectedExpenseSyncLabels.join("、")} を、コピー元自身を除く ${expenseSyncTargetCount} 件のシナリオへ反映します。` +
        (!expenseSyncSourceIsCurrentScenario && excludeCurrentScenarioFromExpenseSync
          ? `現在開いている「${scenario.name}」は反映先から外します。`
          : "") +
        `\n\n反映先:\n${formatScenarioNamesForConfirm(expenseSyncTargetNames)}\n\n実行しますか？`,
    );
    if (!confirmed) return;
    updateScenarios((target) => {
      if (!isAssetSyncTarget(target, source.id, expenseSyncTargetMode, expenseSyncExcludedScenarioIds, expenseSyncSelectedTargetIdSet)) return target;
      applyExpenseSyncFromSource(target, source, expenseSyncOptions);
      return target;
    });
    setExpenseSyncMessage(
      `${expenseSyncTargetCount} 件のシナリオへ生活費前提を反映しました: ${formatScenarioNamesForMessage(expenseSyncTargetNames)}。実行前の状態は履歴に保存されています。`,
    );
  };
  const excludeTaxExpense = shouldIgnoreTaxExpenseField(scenario);
  const warnings = getExpenseAdjustmentWarnings(scenario.ageExpenseAdjustments);
  const expenseKeys = Object.keys(expenseLabels) as ExpenseKey[];
  const livingInflationTargets =
    scenario.inflationSettings.livingCostInflationTargets ?? expenseKeys.filter((key) => key !== "healthMedical");
  const medicalInflationTargets = scenario.inflationSettings.medicalInflationTargets ?? ["healthMedical"];
  const addAdjustment = () =>
    updateScenario((s) =>
      s.ageExpenseAdjustments.push({
        id: createId(),
        name: "60歳から",
        startAge: 60,
        target: "all",
        targets: ["all"],
        mode: "multiplier",
        value: 1,
      }),
    );
  const toggleAgeExpenseTarget = (index: number, target: ExpenseAdjustmentTarget) =>
    updateScenario((s) => {
      const adjustment = s.ageExpenseAdjustments[index];
      const current = getAgeExpenseAdjustmentTargets(adjustment);
      const next: ExpenseAdjustmentTarget[] =
        target === "all"
          ? ["all"]
          : current.includes(target)
            ? current.filter((item) => item !== target && item !== "all")
            : [...current.filter((item) => item !== "all"), target];
      adjustment.targets = next.length ? next : ["all"];
      adjustment.target = adjustment.targets[0] ?? "all";
    });
  const toggleInflationTarget = (kind: "living" | "medical", key: ExpenseKey) =>
    updateScenario((s) => {
      const living = new Set(s.inflationSettings.livingCostInflationTargets ?? expenseKeys.filter((item) => item !== "healthMedical"));
      const medical = new Set(s.inflationSettings.medicalInflationTargets ?? ["healthMedical"]);
      const targetSet = kind === "living" ? living : medical;
      const oppositeSet = kind === "living" ? medical : living;
      if (targetSet.has(key)) {
        targetSet.delete(key);
      } else {
        targetSet.add(key);
        oppositeSet.delete(key);
      }
      s.inflationSettings.livingCostInflationTargets = [...living];
      s.inflationSettings.medicalInflationTargets = [...medical];
    });
  const baseMonthlyExpense = getBaseMonthlyExpense(scenario.monthlyExpenses, excludeTaxExpense);
  const otherExpense = Math.max(0, scenario.monthlyExpenses.other ?? 0);
  const largeUnclassifiedExpense = hasLargeUnclassifiedExpense(scenario.monthlyExpenses, excludeTaxExpense);
  const quickSplitOtherExpense = () =>
    updateScenario((s) => {
      const amount = Math.max(0, s.monthlyExpenses.other ?? 0);
      if (amount <= 0) return;
      s.monthlyExpenses.food += Math.round(amount * 0.4);
      s.monthlyExpenses.dailyGoods += Math.round(amount * 0.2);
      s.monthlyExpenses.utilities += Math.round(amount * 0.25);
      s.monthlyExpenses.communication += amount - Math.round(amount * 0.4) - Math.round(amount * 0.2) - Math.round(amount * 0.25);
      s.monthlyExpenses.other = 0;
    });
  const keepUnclassifiedExpense = () =>
    updateScenario((s) => {
      s.monthlyExpenses.other = Math.max(0, s.monthlyExpenses.other ?? 0);
    });

  return (
    <Card id="expenses-monthly" data-input-card-id="expenses-monthly">
      <CardHeader>
        <CardTitle>生活費入力</CardTitle>
        <CardDescription>月平均額を費目別に入力します。インフレON時は月次複利で反映します。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {excludeTaxExpense && (
          <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
            税・社会保険は `税・社会保険` タブで計算するため、このタブの `税・社会保険` はシミュレーションでは使いません。
          </div>
        )}
        <div className="rounded-lg border bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
          生活費は費目別に分けると、将来の変化やインフレの見通しを確認しやすくなります。初回設定で入れた合計のうち、住宅費や医療費として分けた分以外は「その他（未分類）」に入っています。
          食費・日用品・光熱費などへ分けると、下の「月平均生活費」は同じ合計のまま、内訳だけが分かりやすくなります。
        </div>
        {largeUnclassifiedExpense && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-medium">生活費の「その他（未分類）」が多めです</p>
                <p className="mt-1">
                  その他が月平均生活費の {Math.round(getExpenseOtherShare(scenario.monthlyExpenses, excludeTaxExpense) * 100)}%（{compactYen(otherExpense)}）あります。
                  必須ではありませんが、食費・日用品・光熱費などへ分けると見直しやすくなります。
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={keepUnclassifiedExpense}>
                  ざっくりのまま進む
                </Button>
                <Button size="sm" onClick={quickSplitOtherExpense}>
                  費目別に分ける
                </Button>
              </div>
            </div>
          </div>
        )}
        <FormGrid>
          {(Object.keys(expenseLabels) as ExpenseKey[]).map((key) => (
            <Field
              key={key}
              label={
                key === "other" && largeUnclassifiedExpense
                  ? "その他（未分類が多め）"
                  : key === "other"
                    ? "その他（未分類）"
                    : expenseLabels[key]
              }
            >
              <Input type="number" value={scenario.monthlyExpenses[key]} onChange={(event) => updateScenario((s) => void (s.monthlyExpenses[key] = numberOrZero(event.target.value)))} />
            </Field>
          ))}
        </FormGrid>
        <div className="grid gap-4 md:grid-cols-4">
          <Metric
            title="月平均生活費"
            value={compactYen(baseMonthlyExpense)}
            sub={excludeTaxExpense ? "税・社会保険を除く現在入力値" : "現在入力値"}
          />
          <Field label="インフレ反映">
            <Select value={scenario.inflationSettings.enabled ? "on" : "off"} onChange={(event) => updateScenario((s) => void (s.inflationSettings.enabled = event.target.value === "on"))}>
              <option value="on">ON</option>
              <option value="off">OFF</option>
            </Select>
          </Field>
          <RateField label="生活費インフレ率" value={scenario.inflationSettings.livingCostAnnualInflationRate} onChange={(value) => updateScenario((s) => void (s.inflationSettings.livingCostAnnualInflationRate = value))} />
          <RateField label="医療費上昇率" value={scenario.inflationSettings.medicalAnnualInflationRate} onChange={(value) => updateScenario((s) => void (s.inflationSettings.medicalAnnualInflationRate = value))} />
        </div>
        <GuidedDetails
          id="expenses-inflation-targets"
          title="インフレ対象費目"
          description="健康・医療は医療費上昇率、その他は生活費インフレ率を使う想定です。保険など上昇させない費目はチェックを外してください。"
          summary={`生活費対象 ${livingInflationTargets.length}費目 / 医療費対象 ${medicalInflationTargets.length}費目`}
          priority="detail"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">生活費インフレ率をかける費目</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {expenseKeys.map((key) => (
                  <label key={key} className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={livingInflationTargets.includes(key)}
                      onChange={() => toggleInflationTarget("living", key)}
                    />
                    {expenseLabels[key]}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">医療費上昇率をかける費目</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {expenseKeys.map((key) => (
                  <label key={key} className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={medicalInflationTargets.includes(key)}
                      onChange={() => toggleInflationTarget("medical", key)}
                    />
                    {expenseLabels[key]}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </GuidedDetails>
        <GuidedDetails
          id="expenses-age-adjustments"
          title="年齢別の生活費変更"
          description="現在生活費基準、開始前年基準、前年同月比、月額指定を選べます。期間固定は開始前年基準、毎年変化は前年同月比を使います。"
          summary={scenario.ageExpenseAdjustments.length === 0 ? "年齢別変更なし" : `年齢別変更 ${scenario.ageExpenseAdjustments.length}件`}
          priority="detail"
        >
          <div className="flex justify-end">
            <Button onClick={addAdjustment}>
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
          <div className="space-y-4">
            {warnings.length > 0 && (
              <div className="space-y-2">
                {warnings.some((warning) => warning.severity === "warning") && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <p className="font-medium">同じ費目の年齢範囲が重複しています</p>
                    {warnings
                      .filter((warning) => warning.severity === "warning")
                      .map((warning) => (
                        <p key={warning.message}>{warning.message}</p>
                      ))}
                  </div>
                )}
                {warnings.some((warning) => warning.severity === "info") && (
                  <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                    <p className="font-medium">生活費全体と個別費目の重ね合わせがあります</p>
                    {warnings
                      .filter((warning) => warning.severity === "info")
                      .map((warning) => (
                        <p key={warning.message}>{warning.message}</p>
                      ))}
                  </div>
                )}
              </div>
            )}
            {scenario.ageExpenseAdjustments.length === 0 ? (
              <p className="text-sm text-muted-foreground">年齢別の変更はまだありません。</p>
            ) : (
              scenario.ageExpenseAdjustments.map((adjustment, index) => (
                <EventEditor
                  key={adjustment.id}
                  title={adjustment.name || "年齢別変更"}
                  onDelete={() => updateScenario((s) => void s.ageExpenseAdjustments.splice(index, 1))}
                >
                  <FormGrid>
                    <Field label="名称">
                      <Input
                        value={adjustment.name}
                        onChange={(event) => updateScenario((s) => void (s.ageExpenseAdjustments[index].name = event.target.value))}
                      />
                    </Field>
                    <Field label="開始年齢">
                      <Input
                        type="number"
                        min={60}
                        max={130}
                        value={adjustment.startAge}
                        onChange={(event) => updateScenario((s) => void (s.ageExpenseAdjustments[index].startAge = seniorAgeOrDefault(event.target.value)))}
                      />
                    </Field>
                    <Field label="終了年齢">
                      <Input
                        type="number"
                        min={60}
                        max={130}
                        value={adjustment.endAge ?? ""}
                        onChange={(event) =>
                          updateScenario((s) => void (s.ageExpenseAdjustments[index].endAge = event.target.value === "" ? undefined : seniorAgeOrDefault(event.target.value)))
                        }
                      />
                    </Field>
                    <Field label="変更方法">
                      <Select
                        value={adjustment.mode}
                        onChange={(event) => updateScenario((s) => void (s.ageExpenseAdjustments[index].mode = event.target.value as AgeExpenseAdjustment["mode"]))}
                      >
                        <option value="multiplier">現在生活費基準の倍率</option>
                        <option value="startPreviousYearMultiplier">開始前年基準の倍率</option>
                        <option value="yearOverYearMultiplier">毎年、前年同月比の倍率</option>
                        <option value="setAmount">月額に変更</option>
                      </Select>
                    </Field>
                    {adjustment.mode === "multiplier" || adjustment.mode === "yearOverYearMultiplier" || adjustment.mode === "startPreviousYearMultiplier" ? (
                      <RateField
                        label={
                          adjustment.mode === "yearOverYearMultiplier"
                            ? "前年同月比"
                            : adjustment.mode === "startPreviousYearMultiplier"
                              ? "開始前年基準の倍率"
                              : "現在生活費基準の倍率"
                        }
                        value={adjustment.value}
                        onChange={(value) => updateScenario((s) => void (s.ageExpenseAdjustments[index].value = value))}
                      />
                    ) : (
                      <Field label="月額">
                        <Input
                          type="number"
                          value={adjustment.value}
                          onChange={(event) => updateScenario((s) => void (s.ageExpenseAdjustments[index].value = numberOrZero(event.target.value)))}
                        />
                      </Field>
                    )}
                  </FormGrid>
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium">対象費目</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={getAgeExpenseAdjustmentTargets(adjustment).includes("all")}
                          onChange={() => toggleAgeExpenseTarget(index, "all")}
                        />
                        生活費全体
                      </label>
                      {expenseKeys.map((key) => (
                        <label key={key} className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={getAgeExpenseAdjustmentTargets(adjustment).includes(key)}
                            onChange={() => toggleAgeExpenseTarget(index, key)}
                          />
                          {expenseLabels[key]}
                        </label>
                      ))}
                    </div>
                  </div>
                </EventEditor>
              ))
            )}
          </div>
        </GuidedDetails>
        {scenario.householdLivingArrangementEvents.length > 0 && (
          <div className="rounded-lg border bg-white">
            <div className="border-b px-4 py-3">
              <h3 className="font-medium">世帯構成変更による生活費調整</h3>
              <p className="text-sm text-muted-foreground">基本情報で登録した別居などのイベントが、どの費目に効くかを確認できます。</p>
            </div>
            <Table>
              <thead>
                <Tr>
                  <Th>変更年月</Th>
                  <Th>メンバー</Th>
                  <Th>内容</Th>
                  <Th>対象費目</Th>
                  <Th>減額</Th>
                </Tr>
              </thead>
              <tbody>
                {scenario.householdLivingArrangementEvents.map((event) => {
                  const member = scenario.householdMembers.find((item) => item.id === event.memberId);
                  return (
                    <Tr key={event.id}>
                      <Td>{event.changeYearMonth}</Td>
                      <Td>{member?.name ?? "未設定"}</Td>
                      <Td>{event.changeType === "moveOut" ? "別居開始" : event.changeType}</Td>
                      <Td>{event.expenseKeys.map((key) => expenseLabels[key]).join("、") || "-"}</Td>
                      <Td>{event.reductionMode === "fixedAmount" ? compactYen(event.reductionAmount) : `${Math.round(event.reductionRate * 100)}%`}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
        <ScenarioSyncDetails
          title="他シナリオへ反映（必要時のみ）"
          description="生活費前提をまとめてコピーする時だけ開きます。"
        >
        <div className="rounded-lg border bg-white px-4 py-3">
          <div className="grid gap-4 lg:grid-cols-[minmax(260px,420px)_1fr]">
            <Field label="コピー元シナリオ">
              <Select value={expenseSyncSourceScenario.id} onChange={(event) => setExpenseSyncSourceScenarioId(event.target.value)}>
                {scenarios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
              現在のコピー元は「{expenseSyncSourceScenario.name}」です。生活費前提の反映だけに使い、表示中シナリオの入力欄は切り替えません。
            </div>
          </div>
          {!expenseSyncSourceIsCurrentScenario && (
            <label className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <input
                type="checkbox"
                checked={excludeCurrentScenarioFromExpenseSync}
                onChange={(event) => setExcludeCurrentScenarioFromExpenseSync(event.target.checked)}
              />
              <span>
                <span className="block font-medium">現在開いているシナリオは上書きしない</span>
                <span className="text-xs">
                  「{scenario.name}」を見ながら別シナリオをコピー元にする場合の誤反映を防ぎます。意図して現在のシナリオにも反映する場合だけ外してください。
                </span>
              </span>
            </label>
          )}
        </div>
        <ScenarioSyncCard<keyof ExpenseSyncOptions>
          title="生活費前提を他シナリオへ反映"
          description="コピー元シナリオを選び、生活費まわりの前提を他シナリオへ反映します。"
          targetMode={expenseSyncTargetMode}
          setTargetMode={setExpenseSyncTargetMode}
          targetCount={expenseSyncTargetCount}
          targetNames={expenseSyncTargetNames}
          allScenarios={scenarios}
          sourceScenarioId={expenseSyncSourceScenario.id}
          excludedScenarioIds={expenseSyncExcludedScenarioIds}
          selectedTargetIds={expenseSyncSelectedTargetIdSet}
          toggleSelectedTarget={toggleExpenseSyncTarget}
          targetSummary={
            `コピー元「${expenseSyncSourceScenario.name}」自身を除く ${expenseSyncTargetCount} 件に反映します。` +
            (!expenseSyncSourceIsCurrentScenario && excludeCurrentScenarioFromExpenseSync
              ? `現在開いている「${scenario.name}」も誤操作防止のため反映先から外します。`
              : "") +
            "生活費だけをそろえたい場合は、必要な項目だけを選んで実行してください。"
          }
          options={[
            { key: "monthlyExpenses", label: "月額生活費", description: "費目別の月額入力" },
            { key: "ageAdjustments", label: "年齢別変更", description: "60歳以降などの変更ルール" },
            { key: "expenseInflation", label: "インフレ設定", description: "生活費・医療費の上昇率と対象費目" },
          ]}
          selectedOptions={expenseSyncOptions}
          toggleOption={updateExpenseSyncOption}
          warningText="反映は明示実行時だけです。シナリオごとに違う生活費を置いている場合は、反映先を確認してください。"
          onApply={applyExpenseSync}
          message={expenseSyncMessage}
          optionGridClassName="grid gap-2 sm:grid-cols-3"
        />
        </ScenarioSyncDetails>
      </CardContent>
    </Card>
  );
}

function pensionClaimRateLabel(member: HouseholdMember, claimStartYearMonth: string) {
  const monthsFromStandardStart = pensionClaimMonthsFromStandardStart(member, claimStartYearMonth);
  const rate = pensionClaimRateForStartYearMonth(member, claimStartYearMonth);
  if (monthsFromStandardStart < 0) return `65歳標準開始月より${Math.abs(monthsFromStandardStart)}か月早いので ${((1 - rate) * 100).toFixed(1)}%減額`;
  if (monthsFromStandardStart > 0) return `65歳標準開始月より${monthsFromStandardStart}か月遅いので ${((rate - 1) * 100).toFixed(1)}%増額`;
  return "65歳標準開始月と同じため増減なし";
}

function PensionPlannerSection({ scenario, updateScenario }: SectionProps) {
  const { selfMember, spouseMember } = getPensionPlannerMembers(scenario);
  const plannerSettings = mergePensionPlannerSettings(scenario, selfMember, spouseMember);
  const updatePlannerSettings = (patch: Partial<PensionPlannerSettings>) =>
    updateScenario((draft) => {
      const draftSelfMember =
        draft.householdMembers.find((member) => member.relationship === "self") ??
        draft.householdMembers.find((member) => member.id === draft.householdProfile.headMemberId) ??
        draft.householdMembers[0];
      const draftSpouseMember = draft.householdMembers.find((member) => member.relationship === "spouse");
      draft.pensionPlannerSettings = {
        ...mergePensionPlannerSettings(draft, draftSelfMember, draftSpouseMember),
        ...patch,
      };
    });
  const {
    selfBasicAnnual,
    selfEmployeesAnnual,
    spouseBasicAnnual,
    spouseEmployeesAnnual,
    selfClaimAge,
    spouseClaimAge,
    selfClaimStartYearMonth,
    spouseClaimStartYearMonth,
    projectionEndAge,
    applyToSimulation,
    kakyuEligible,
    kakyuAmount,
    hasOldAgeEmployeesPension,
    employeesPensionMonths,
    spouseDependentForKakyu,
  } = plannerSettings;

  const planner = useMemo(() => {
    if (!selfMember) return null;
    const selfStandardAnnual = selfBasicAnnual + selfEmployeesAnnual;
    const spouseStandardAnnual = spouseBasicAnnual + spouseEmployeesAnnual;
    const canonicalSelfClaimStart = selfClaimStartYearMonth ?? defaultPensionClaimStartYearMonth(selfMember, selfClaimAge);
    const canonicalSpouseClaimStart =
      spouseMember && spouseClaimStartYearMonth ? spouseClaimStartYearMonth : spouseMember ? defaultPensionClaimStartYearMonth(spouseMember, spouseClaimAge) : undefined;
    const selfRate = pensionClaimRateForStartYearMonth(selfMember, canonicalSelfClaimStart);
    const spouseRate = spouseMember && canonicalSpouseClaimStart ? pensionClaimRateForStartYearMonth(spouseMember, canonicalSpouseClaimStart) : pensionClaimRate(spouseClaimAge);
    const selfAdjustedAnnual = Math.round(selfStandardAnnual * selfRate);
    const spouseAdjustedAnnual = Math.round(spouseStandardAnnual * spouseRate);
    const startYear = yearMemberTurnsAge(selfMember, 60);
    const endYear = yearMemberTurnsAge(selfMember, projectionEndAge);
    let cumulative = 0;
    const rows = [];
    for (let year = startYear; year <= endYear; year += 1) {
      const selfAge = memberAgeAtEndOfYear(selfMember, year);
      const spouseAge = spouseMember ? memberAgeAtEndOfYear(spouseMember, year) : undefined;
      const months = yearMonthRangeForYear(year);
      const selfPensionMonths = months.filter((yearMonth) => yearMonth >= canonicalSelfClaimStart).length;
      const spousePensionMonths = spouseMember && canonicalSpouseClaimStart ? months.filter((yearMonth) => yearMonth >= canonicalSpouseClaimStart).length : 0;
      const kakyuMonths =
        kakyuEligible && spouseMember && hasOldAgeEmployeesPension && employeesPensionMonths >= 240 && spouseDependentForKakyu
          ? months.filter((yearMonth) => {
              const monthlySelfAge = memberAgeAtEndOfMonth(selfMember, yearMonth);
              const monthlySpouseAge = memberAgeAtEndOfMonth(spouseMember, yearMonth);
              return monthlySelfAge >= PENSION_STANDARD_CLAIM_AGE && monthlySpouseAge < PENSION_STANDARD_CLAIM_AGE;
            }).length
          : 0;
      const selfPension = Math.round((selfAdjustedAnnual / 12) * selfPensionMonths);
      const spousePension = Math.round((spouseAdjustedAnnual / 12) * spousePensionMonths);
      const kakyuPension = Math.round((kakyuAmount / 12) * kakyuMonths);
      const annualTotal = selfPension + spousePension + kakyuPension;
      cumulative += annualTotal;
      rows.push({
        year,
        selfAge,
        spouseAge,
        selfPensionMonths,
        spousePensionMonths,
        kakyuMonths,
        selfPension,
        spousePension,
        kakyuPension,
        annualTotal,
        cumulative,
      });
    }
    return {
      selfStandardAnnual,
      spouseStandardAnnual,
      selfRate,
      spouseRate,
      selfAdjustedAnnual,
      spouseAdjustedAnnual,
      selfClaimStartYearMonth: canonicalSelfClaimStart,
      spouseClaimStartYearMonth: canonicalSpouseClaimStart,
      rows,
    };
  }, [
    kakyuAmount,
    kakyuEligible,
    projectionEndAge,
    employeesPensionMonths,
    hasOldAgeEmployeesPension,
    selfBasicAnnual,
    selfClaimAge,
    selfClaimStartYearMonth,
    selfEmployeesAnnual,
    selfMember,
    spouseBasicAnnual,
    spouseClaimAge,
    spouseClaimStartYearMonth,
    spouseDependentForKakyu,
    spouseEmployeesAnnual,
    spouseMember,
  ]);

  const comparisonRows = useMemo(() => {
    if (!selfMember) return [];
    const selfStandardAnnual = selfBasicAnnual + selfEmployeesAnnual;
    return PENSION_PLANNER_COMPARE_AGES.map((claimAge) => {
      const claimStartYearMonth = defaultPensionClaimStartYearMonth(selfMember, claimAge);
      const rate = pensionClaimRateForStartYearMonth(selfMember, claimStartYearMonth);
      const annual = Math.round(selfStandardAnnual * rate);
      const startYear = yearMemberTurnsAge(selfMember, 60);
      const endYear = yearMemberTurnsAge(selfMember, projectionEndAge);
      const receivingMonths = Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, index) => startYear + index)
        .flatMap((year) => yearMonthRangeForYear(year))
        .filter((yearMonth) => yearMonth >= claimStartYearMonth).length;
      return {
        claimAge,
        claimStartYearMonth,
        rate,
        annual,
        cumulative: Math.round((annual / 12) * receivingMonths),
      };
    });
  }, [projectionEndAge, selfBasicAnnual, selfEmployeesAnnual, selfMember]);

  if (!selfMember) return null;

  const spouse65Year = spouseMember ? yearMemberTurnsAge(spouseMember, 65) : undefined;
  const self65Year = yearMemberTurnsAge(selfMember, 65);
  const kakyuConditionMet = Boolean(kakyuEligible && spouseMember && hasOldAgeEmployeesPension && employeesPensionMonths >= 240 && spouseDependentForKakyu);
  const kakyuStartYear = self65Year;
  const kakyuEndYear = spouse65Year;
  const kakyuMonthCount = planner?.rows.reduce((sum, row) => sum + row.kakyuMonths, 0) ?? 0;
  const kakyuReason = !spouseMember
    ? "配偶者が登録されていません"
    : !kakyuEligible
      ? "加給年金を試算に含めない設定です"
      : !hasOldAgeEmployeesPension
        ? "本人の老齢厚生年金を受け取る前提がOFFです"
        : employeesPensionMonths < 240
          ? "本人の厚生年金加入月数が240月未満です"
          : !spouseDependentForKakyu
            ? "配偶者を生計維持対象にしない設定です"
            : kakyuMonthCount > 0
              ? "条件を満たす月だけ月割りで加算します"
              : "本人65歳以降かつ配偶者65歳未満の月がありません";

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-2 border-b pb-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-medium">年金受給プランナー（試算）</h3>
          <p className="text-sm text-muted-foreground">
            65歳標準年額を入れ、繰上げ・繰下げ後の年額と累計を確認します。標準では試算のみで、既存の収入イベントはそのまま使います。
          </p>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <Field label="シミュレーション反映">
            <Select
              value={applyToSimulation ? "on" : "off"}
              onChange={(event) => updatePlannerSettings({ applyToSimulation: event.target.value === "on" })}
            >
              <option value="off">試算のみ</option>
              <option value="on">反映する</option>
            </Select>
          </Field>
          <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {applyToSimulation
              ? "本人・配偶者の既存公的年金イベントを置き換えて本計算に反映します"
              : "ダッシュボードと税計算は既存の収入イベントを使います"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-md border bg-slate-50 p-3">
          <div className="text-sm font-medium">{selfMember.name === "本人" ? "本人" : `${selfMember.name}（本人）`}</div>
          <FormGrid>
            <Field label="老齢基礎年金 65歳標準年額">
              <Input type="number" value={selfBasicAnnual} onChange={(event) => updatePlannerSettings({ selfBasicAnnual: numberOrZero(event.target.value) })} />
            </Field>
            <Field label="老齢厚生年金 65歳標準年額">
              <Input type="number" value={selfEmployeesAnnual} onChange={(event) => updatePlannerSettings({ selfEmployeesAnnual: numberOrZero(event.target.value) })} />
            </Field>
            <Field label={`受給開始年齢 ${selfClaimAge}歳`}>
              <Input
                type="range"
                min={60}
                max={75}
                step={1}
                value={selfClaimAge}
                onChange={(event) => {
                  const nextAge = Number(event.target.value);
                  updatePlannerSettings({
                    selfClaimAge: nextAge,
                    selfClaimStartYearMonth: defaultPensionClaimStartYearMonth(selfMember, nextAge),
                  });
                }}
              />
            </Field>
            <Field label="受給開始年月">
              <Input
                type="month"
                value={planner?.selfClaimStartYearMonth ?? ""}
                onChange={(event) => {
                  const nextStart = event.target.value || defaultPensionClaimStartYearMonth(selfMember, selfClaimAge);
                  updatePlannerSettings({
                    selfClaimStartYearMonth: nextStart,
                    selfClaimAge: pensionClaimAgeFromStartYearMonth(selfMember, nextStart),
                  });
                }}
              />
            </Field>
            <Field label="調整後年額">
              <Input value={yen(planner?.selfAdjustedAnnual ?? 0)} readOnly />
            </Field>
          </FormGrid>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p>
              誕生日から見た65歳標準開始月: {pensionStandardStartYearMonth(selfMember)} / 入力した受給開始月: {planner?.selfClaimStartYearMonth}
            </p>
            <p>
              {planner ? pensionClaimRateLabel(selfMember, planner.selfClaimStartYearMonth) : ""}。65歳標準年額 {yen(planner?.selfStandardAnnual ?? 0)} ×{" "}
              {(planner?.selfRate ?? 1).toFixed(3)} = {yen(planner?.selfAdjustedAnnual ?? 0)}
            </p>
          </div>
        </div>

        <div className="rounded-md border bg-slate-50 p-3">
          <div className="text-sm font-medium">{spouseMember ? (spouseMember.name === "配偶者" ? "配偶者" : `${spouseMember.name}（配偶者）`) : "配偶者"}</div>
          <FormGrid>
            <Field label="老齢基礎年金 65歳標準年額">
              <Input
                type="number"
                value={spouseBasicAnnual}
                onChange={(event) => updatePlannerSettings({ spouseBasicAnnual: numberOrZero(event.target.value) })}
                disabled={!spouseMember}
              />
            </Field>
            <Field label="老齢厚生年金 65歳標準年額">
              <Input
                type="number"
                value={spouseEmployeesAnnual}
                onChange={(event) => updatePlannerSettings({ spouseEmployeesAnnual: numberOrZero(event.target.value) })}
                disabled={!spouseMember}
              />
            </Field>
            <Field label={`受給開始年齢 ${spouseClaimAge}歳`}>
              <Input
                type="range"
                min={60}
                max={75}
                step={1}
                value={spouseClaimAge}
                onChange={(event) => {
                  if (!spouseMember) return;
                  const nextAge = Number(event.target.value);
                  updatePlannerSettings({
                    spouseClaimAge: nextAge,
                    spouseClaimStartYearMonth: defaultPensionClaimStartYearMonth(spouseMember, nextAge),
                  });
                }}
                disabled={!spouseMember}
              />
            </Field>
            <Field label="受給開始年月">
              <Input
                type="month"
                value={planner?.spouseClaimStartYearMonth ?? ""}
                onChange={(event) => {
                  if (!spouseMember) return;
                  const nextStart = event.target.value || defaultPensionClaimStartYearMonth(spouseMember, spouseClaimAge);
                  updatePlannerSettings({
                    spouseClaimStartYearMonth: nextStart,
                    spouseClaimAge: pensionClaimAgeFromStartYearMonth(spouseMember, nextStart),
                  });
                }}
                disabled={!spouseMember}
              />
            </Field>
            <Field label="調整後年額">
              <Input value={spouseMember ? yen(planner?.spouseAdjustedAnnual ?? 0) : "-"} readOnly />
            </Field>
          </FormGrid>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {spouseMember && planner?.spouseClaimStartYearMonth ? (
              <>
                <p>
                  誕生日から見た65歳標準開始月: {pensionStandardStartYearMonth(spouseMember)} / 入力した受給開始月: {planner.spouseClaimStartYearMonth}
                </p>
                <p>
                  {pensionClaimRateLabel(spouseMember, planner.spouseClaimStartYearMonth)}。65歳標準年額 {yen(planner?.spouseStandardAnnual ?? 0)} ×{" "}
                  {(planner?.spouseRate ?? 1).toFixed(3)} = {yen(planner?.spouseAdjustedAnnual ?? 0)}
                </p>
              </>
            ) : (
              <p>配偶者が基本情報に登録されていないため、配偶者分は試算しません。</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <div className="rounded-md border bg-white p-3">
          <div className="text-sm font-medium">加給年金の目安</div>
          <FormGrid>
            <Field label="本人の老齢厚生年金">
              <Select value={hasOldAgeEmployeesPension ? "yes" : "no"} onChange={(event) => updatePlannerSettings({ hasOldAgeEmployeesPension: event.target.value === "yes" })}>
                <option value="yes">受け取る前提</option>
                <option value="no">受け取らない前提</option>
              </Select>
            </Field>
            <Field label="本人の厚生年金加入月数">
              <Input type="number" min={0} value={employeesPensionMonths} onChange={(event) => updatePlannerSettings({ employeesPensionMonths: numberOrZero(event.target.value) })} />
            </Field>
            <Field label="加給年金を試算に含める">
              <Select value={kakyuEligible ? "yes" : "no"} onChange={(event) => updatePlannerSettings({ kakyuEligible: event.target.value === "yes" })} disabled={!spouseMember}>
                <option value="yes">含める</option>
                <option value="no">含めない</option>
              </Select>
            </Field>
            <Field label="配偶者の生計維持">
              <Select value={spouseDependentForKakyu ? "yes" : "no"} onChange={(event) => updatePlannerSettings({ spouseDependentForKakyu: event.target.value === "yes" })} disabled={!spouseMember}>
                <option value="yes">対象にする</option>
                <option value="no">対象にしない</option>
              </Select>
            </Field>
            <Field label="加給年金 年額">
              <Input type="number" value={kakyuAmount} onChange={(event) => updatePlannerSettings({ kakyuAmount: numberOrZero(event.target.value) })} disabled={!spouseMember || !kakyuEligible} />
            </Field>
          </FormGrid>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p>
              表示条件: 本人が月末65歳以上、配偶者が月末65歳未満、本人の厚生年金加入月数が240月以上の月だけ加算します。
            </p>
            <p>
              試算期間: {kakyuConditionMet && kakyuMonthCount > 0 ? `${kakyuStartYear}年から${kakyuEndYear}年の間で${kakyuMonthCount}か月分` : "該当月なし"}
            </p>
            <p>判定: {kakyuReason}</p>
            <p>式: 加給年金年額 {yen(kakyuAmount)} ÷ 12 × 対象月数。繰上げ・繰下げの調整率は加給年金には掛けません。</p>
          </div>
        </div>

        <div className="rounded-md border bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">本人の受給開始年齢別 比較</div>
              <p className="text-xs text-muted-foreground">本人の65歳標準年額だけで比較します。累計は受給開始月以降を月割りで足します。</p>
            </div>
            <Field label="累計比較の終了年齢">
              <Input type="number" min={70} max={105} value={projectionEndAge} onChange={(event) => updatePlannerSettings({ projectionEndAge: numberOrZero(event.target.value) })} />
            </Field>
          </div>
          <Table className="mt-2">
            <thead>
              <Tr>
                <Th>受給開始</Th>
                <Th>開始年月</Th>
                <Th>調整率</Th>
                <Th>年額</Th>
                <Th>{projectionEndAge}歳まで累計</Th>
              </Tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <Tr key={row.claimAge}>
                  <Td>{row.claimAge}歳</Td>
                  <Td>{row.claimStartYearMonth}</Td>
                  <Td>{(row.rate * 100).toFixed(1)}%</Td>
                  <Td>{yen(row.annual)}</Td>
                  <Td>{yen(row.cumulative)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>

      <div className="mt-4 rounded-md border bg-white">
        <div className="border-b px-3 py-2">
          <div className="text-sm font-medium">年次受取イメージ</div>
          <p className="text-xs text-muted-foreground">
            各年の金額は対象月数で月割りします。シミュレーション反映が「試算のみ」の場合、本計算には使いません。
          </p>
        </div>
        <Table>
          <thead>
            <Tr>
              <Th>年</Th>
              <Th>本人年齢</Th>
              <Th>配偶者年齢</Th>
              <Th>本人月数</Th>
              <Th>配偶者月数</Th>
              <Th>加給月数</Th>
              <Th>本人年金</Th>
              <Th>配偶者年金</Th>
              <Th>加給年金</Th>
              <Th>年額合計</Th>
              <Th>累計</Th>
            </Tr>
          </thead>
          <tbody>
            {(planner?.rows ?? []).slice(0, 36).map((row) => (
              <Tr key={row.year}>
                <Td>{row.year}</Td>
                <Td>{row.selfAge}歳</Td>
                <Td>{row.spouseAge !== undefined ? `${row.spouseAge}歳` : "-"}</Td>
                <Td>{row.selfPensionMonths}か月</Td>
                <Td>{row.spousePensionMonths}か月</Td>
                <Td>{row.kakyuMonths}か月</Td>
                <Td>{yen(row.selfPension)}</Td>
                <Td>{yen(row.spousePension)}</Td>
                <Td>{yen(row.kakyuPension)}</Td>
                <Td>{yen(row.annualTotal)}</Td>
                <Td>{yen(row.cumulative)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

function IncomeSection({
  scenario,
  scenarios,
  updateScenario,
  updateScenarios,
  targetCardId,
}: SectionProps & {
  scenarios: ScenarioData[];
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData, backupLabel?: string) => void;
}) {
  const [incomeSyncTargetMode, setIncomeSyncTargetMode] = useState<AssetSyncTargetMode>("compare");
  const [incomeSyncSelectedTargetIds, setIncomeSyncSelectedTargetIds] = useState<string[]>([]);
  const [incomeSyncSourceScenarioId, setIncomeSyncSourceScenarioId] = useState(scenario.id);
  const [excludeCurrentScenarioFromIncomeSync, setExcludeCurrentScenarioFromIncomeSync] = useState(true);
  const [incomeSyncOptions, setIncomeSyncOptions] = useState<IncomeSyncOptions>({
    incomeEvents: true,
    optionSubAccounts: false,
    pensionPlanner: true,
    retirementIncomeEvents: true,
    pensionAdjustmentRate: true,
  });
  const [includeLinkedOptionSubAccountsWithIncomeSync, setIncludeLinkedOptionSubAccountsWithIncomeSync] = useState(true);
  const incomeSyncSourceScenario = scenarios.find((item) => item.id === incomeSyncSourceScenarioId) ?? scenario;
  const incomeSyncExcludedScenarioIds = useMemo(() => {
    const excludedIds = new Set<string>();
    if (excludeCurrentScenarioFromIncomeSync && scenario.id !== incomeSyncSourceScenario.id) excludedIds.add(scenario.id);
    return excludedIds;
  }, [excludeCurrentScenarioFromIncomeSync, incomeSyncSourceScenario.id, scenario.id]);
  const incomeEventIds = useMemo(
    () => incomeSyncSourceScenario.incomeEvents.map((event) => event.id),
    [incomeSyncSourceScenario.incomeEvents],
  );
  const incomeEventIdsKey = incomeEventIds.join("|");
  const [selectedIncomeEventIds, setSelectedIncomeEventIds] = useState<string[]>(() => incomeEventIds);
  const optionSubAccountIds = useMemo(
    () => incomeSyncSourceScenario.optionSubAccounts.map((account) => account.id),
    [incomeSyncSourceScenario.optionSubAccounts],
  );
  const optionSubAccountIdsKey = optionSubAccountIds.join("|");
  const [selectedOptionSubAccountIds, setSelectedOptionSubAccountIds] = useState<string[]>(() => optionSubAccountIds);
  const [incomeSyncMessage, setIncomeSyncMessage] = useState<string | null>(null);
  const [targetedIncomeDetailId, setTargetedIncomeDetailId] = useState<string | null>(null);
  const incomePlannerMembers = getPensionPlannerMembers(scenario);
  const incomePlannerSettings = mergePensionPlannerSettings(scenario, incomePlannerMembers.selfMember, incomePlannerMembers.spouseMember);
  const pensionPlannerAnnualTotal =
    incomePlannerSettings.selfBasicAnnual +
    incomePlannerSettings.selfEmployeesAnnual +
    incomePlannerSettings.spouseBasicAnnual +
    incomePlannerSettings.spouseEmployeesAnnual;
  const pensionPlannerTargetId = targetCardId === "income-pension" ? "income-pension-planner" : targetedIncomeDetailId;
  useEffect(() => {
    if (!scenarios.some((item) => item.id === incomeSyncSourceScenarioId)) {
      setIncomeSyncSourceScenarioId(scenario.id);
    }
  }, [incomeSyncSourceScenarioId, scenario.id, scenarios]);
  useEffect(() => {
    setSelectedIncomeEventIds((current) => {
      const availableIds = new Set(incomeEventIds);
      const retainedIds = current.filter((id) => availableIds.has(id));
      const addedIds = incomeEventIds.filter((id) => !current.includes(id));
      return [...retainedIds, ...addedIds];
    });
  }, [incomeEventIdsKey]);
  useEffect(() => {
    setSelectedOptionSubAccountIds((current) => {
      const availableIds = new Set(optionSubAccountIds);
      const retainedIds = current.filter((id) => availableIds.has(id));
      const addedIds = optionSubAccountIds.filter((id) => !current.includes(id));
      return [...retainedIds, ...addedIds];
    });
  }, [optionSubAccountIdsKey]);
  useEffect(() => {
    if (!targetedIncomeDetailId) return undefined;
    const timer = window.setTimeout(() => setTargetedIncomeDetailId(null), 4500);
    return () => window.clearTimeout(timer);
  }, [targetedIncomeDetailId]);
  const incomeSyncSelectedTargetIdSet = useMemo(() => new Set(incomeSyncSelectedTargetIds), [incomeSyncSelectedTargetIds]);
  const incomeSyncTargetCount = countAssetSyncTargets(
    scenarios,
    incomeSyncSourceScenario.id,
    incomeSyncTargetMode,
    incomeSyncExcludedScenarioIds,
    incomeSyncSelectedTargetIdSet,
  );
  const incomeSyncTargetNames = getAssetSyncTargets(
    scenarios,
    incomeSyncSourceScenario.id,
    incomeSyncTargetMode,
    incomeSyncExcludedScenarioIds,
    incomeSyncSelectedTargetIdSet,
  ).map((item) => item.name);
  const selectedIncomeEventIdSet = useMemo(() => new Set(selectedIncomeEventIds), [selectedIncomeEventIds]);
  const selectedIncomeEventCount = incomeSyncSourceScenario.incomeEvents.filter((event) => selectedIncomeEventIdSet.has(event.id)).length;
  const selectedOptionSubAccountIdSet = useMemo(() => new Set(selectedOptionSubAccountIds), [selectedOptionSubAccountIds]);
  const selectedOptionSubAccountCount = incomeSyncSourceScenario.optionSubAccounts.filter((account) =>
    selectedOptionSubAccountIdSet.has(account.id),
  ).length;
  const linkedOptionSubAccountIdsForIncomeSync = useMemo(
    () => getLinkedOptionSubAccountIdsForIncomeEvents(incomeSyncSourceScenario, selectedIncomeEventIds),
    [incomeSyncSourceScenario, selectedIncomeEventIds],
  );
  const unresolvedOptionIncomeEventNames = useMemo(
    () => getUnresolvedOptionIncomeEventNames(incomeSyncSourceScenario, selectedIncomeEventIds),
    [incomeSyncSourceScenario, selectedIncomeEventIds],
  );
  const linkedOptionSubAccountsForIncomeSync = incomeSyncSourceScenario.optionSubAccounts.filter((account) =>
    linkedOptionSubAccountIdsForIncomeSync.includes(account.id),
  );
  const shouldCopyLinkedOptionSubAccountsWithIncomeSync =
    incomeSyncOptions.incomeEvents &&
    includeLinkedOptionSubAccountsWithIncomeSync &&
    linkedOptionSubAccountIdsForIncomeSync.length > 0;
  const optionSubAccountIdsForIncomeSync = Array.from(
    new Set([
      ...(incomeSyncOptions.optionSubAccounts ? selectedOptionSubAccountIds : []),
      ...(shouldCopyLinkedOptionSubAccountsWithIncomeSync ? linkedOptionSubAccountIdsForIncomeSync : []),
    ]),
  );
  const sourceIsCurrentScenario = incomeSyncSourceScenario.id === scenario.id;
  const hasIncomeSyncSelection =
    (incomeSyncOptions.incomeEvents && selectedIncomeEventCount > 0) ||
    (incomeSyncOptions.optionSubAccounts && selectedOptionSubAccountCount > 0) ||
    incomeSyncOptions.pensionPlanner ||
    incomeSyncOptions.retirementIncomeEvents ||
    incomeSyncOptions.pensionAdjustmentRate;
  const selectedIncomeSyncLabels = [
    incomeSyncOptions.incomeEvents ? `収入イベント ${selectedIncomeEventCount}件` : "",
    incomeSyncOptions.optionSubAccounts ? `CFD・米国株オプション設定 ${selectedOptionSubAccountCount}件` : "",
    shouldCopyLinkedOptionSubAccountsWithIncomeSync ? `関連サブ口座 ${linkedOptionSubAccountIdsForIncomeSync.length}件` : "",
    incomeSyncOptions.pensionPlanner ? "年金プランナー設定" : "",
    incomeSyncOptions.retirementIncomeEvents ? "退職所得イベント" : "",
    incomeSyncOptions.pensionAdjustmentRate ? "年金改定率" : "",
  ].filter(Boolean);
  const incomeSyncWarningText = [
    incomeSyncOptions.incomeEvents
      ? `下のメニューで選んだ収入イベント ${selectedIncomeEventCount} 件だけをコピーします。`
      : "収入イベントは反映しません。",
    incomeSyncOptions.optionSubAccounts
      ? `CFD・米国株オプション設定は選んだ ${selectedOptionSubAccountCount} 件だけをコピーします。`
      : "CFD・米国株オプション設定は反映しません。",
    shouldCopyLinkedOptionSubAccountsWithIncomeSync
      ? `関連する一般口座サブ口座 ${linkedOptionSubAccountIdsForIncomeSync.length} 件も一緒に反映します。`
      : incomeSyncOptions.incomeEvents && linkedOptionSubAccountIdsForIncomeSync.length > 0
        ? "関連する一般口座サブ口座は一緒に反映しません。"
        : "",
    "未選択または反映先にだけある項目は残します。",
  ].filter(Boolean).join(" ");
  const incomeSyncTargetSummary =
    `コピー元自身を除く ${incomeSyncTargetCount} 件に反映します。` +
    (!sourceIsCurrentScenario && excludeCurrentScenarioFromIncomeSync
      ? `現在開いている「${scenario.name}」も誤操作防止のため反映先から外します。`
      : "") +
    "世帯メンバーIDが違うシナリオでは、世帯主または先頭メンバーへ安全に割り当てます。";
  const updateIncomeSyncOption = (key: keyof IncomeSyncOptions) => {
    setIncomeSyncOptions((current) => ({ ...current, [key]: !current[key] }));
  };
  const toggleIncomeEventSyncTarget = (eventId: string) => {
    setSelectedIncomeEventIds((current) =>
      current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId],
    );
  };
  const toggleOptionSubAccountSyncTarget = (accountId: string) => {
    setSelectedOptionSubAccountIds((current) =>
      current.includes(accountId) ? current.filter((id) => id !== accountId) : [...current, accountId],
    );
  };
  const toggleIncomeSyncTarget = (scenarioId: string) => {
    setIncomeSyncSelectedTargetIds((current) =>
      current.includes(scenarioId) ? current.filter((id) => id !== scenarioId) : [...current, scenarioId],
    );
  };
  const selectAllIncomeEventsForSync = () => {
    setSelectedIncomeEventIds(incomeEventIds);
  };
  const clearIncomeEventsForSync = () => {
    setSelectedIncomeEventIds([]);
  };
  const selectAllOptionSubAccountsForSync = () => {
    setSelectedOptionSubAccountIds(optionSubAccountIds);
  };
  const clearOptionSubAccountsForSync = () => {
    setSelectedOptionSubAccountIds([]);
  };
  const getIncomeSyncEventOptionSubAccountName = (event: IncomeEvent) =>
    event.sourceAssetKey === "ordinaryAccountForOptions"
      ? incomeSyncSourceScenario.optionSubAccounts.find((account) => account.id === event.sourceOptionSubAccountId)?.name
      : undefined;
  const getIncomeSyncEventTitle = (event: IncomeEvent) => {
    const optionSubAccountName = getIncomeSyncEventOptionSubAccountName(event);
    if (optionSubAccountName && (!event.name.trim() || event.name === "新しい収入")) return `${optionSubAccountName}の収入イベント`;
    return event.name || "名称未設定";
  };
  const getIncomeSyncEventSourceLabel = (event: IncomeEvent) => {
    if (!event.sourceAssetKey) return "外部収入";
    const baseLabel = `${growthAssetLabels[event.sourceAssetKey]}から受取`;
    const optionSubAccountName = getIncomeSyncEventOptionSubAccountName(event);
    return optionSubAccountName ? `${baseLabel}（${optionSubAccountName}）` : baseLabel;
  };
  const applyIncomeSync = () => {
    if (incomeSyncTargetCount === 0 || !hasIncomeSyncSelection) return;
    const source = structuredClone(incomeSyncSourceScenario);
    const copiedOptionNames = optionSubAccountIdsForIncomeSync
      .map((accountId) => incomeSyncSourceScenario.optionSubAccounts.find((account) => account.id === accountId)?.name || "名称未設定")
      .join("、");
    const confirmed = window.confirm(
      `「${source.name}」の ${selectedIncomeSyncLabels.join("、")} を、コピー元自身を除く ${incomeSyncTargetCount} 件のシナリオへ反映します。` +
        (!sourceIsCurrentScenario && excludeCurrentScenarioFromIncomeSync
          ? `現在開いている「${scenario.name}」は反映先から外します。`
          : "") +
        (incomeSyncOptions.incomeEvents
          ? `\n\n主対象:\n・収入イベント ${selectedIncomeEventCount}件`
          : "") +
        (optionSubAccountIdsForIncomeSync.length > 0
          ? `\n\n関連対象:\n・一般口座サブ口座 ${optionSubAccountIdsForIncomeSync.length}件（${copiedOptionNames}）`
          : incomeSyncOptions.incomeEvents && linkedOptionSubAccountIdsForIncomeSync.length > 0
            ? "\n\n注意:\n関連する一般口座サブ口座は一緒に反映しません。収入イベントだけでは原資口座の初期条件が未設定または古いままになる可能性があります。"
            : "") +
        (unresolvedOptionIncomeEventNames.length > 0
          ? `\n\n注意:\n関連サブ口座を特定できない収入イベントがあります（${unresolvedOptionIncomeEventNames.join("、")}）。`
          : "") +
        `\n\n反映先:\n${formatScenarioNamesForConfirm(incomeSyncTargetNames)}\n\n実行しますか？`,
    );
    if (!confirmed) return;
    updateScenarios((target) => {
      if (!isAssetSyncTarget(target, source.id, incomeSyncTargetMode, incomeSyncExcludedScenarioIds, incomeSyncSelectedTargetIdSet)) return target;
      applyIncomeSyncFromSource(
        target,
        source,
        { ...incomeSyncOptions, optionSubAccounts: incomeSyncOptions.optionSubAccounts || shouldCopyLinkedOptionSubAccountsWithIncomeSync },
        selectedIncomeEventIds,
        optionSubAccountIdsForIncomeSync,
      );
      return target;
    });
    setIncomeSyncMessage(
      `${incomeSyncTargetCount} 件のシナリオへ収入前提を反映しました: ${formatScenarioNamesForMessage(incomeSyncTargetNames)}。` +
        (optionSubAccountIdsForIncomeSync.length > 0 ? `関連する一般口座サブ口座 ${optionSubAccountIdsForIncomeSync.length}件も反映しました。` : "") +
        "実行前の状態は履歴に保存されています。",
    );
  };
  const livingArrangementEvents = scenario.householdLivingArrangementEvents ?? [];
  const add = () =>
      updateScenario((s) =>
        s.incomeEvents.push({
          id: createId(),
          memberId: s.householdProfile.headMemberId || s.householdMembers[0]?.id || "",
          name: "新しい収入",
          type: "other",
          startYearMonth: s.userProfile.simulationStartYearMonth,
          monthlyAmount: 0,
          taxTreatment: "taxable",
          sourceAssetPayoutMode: "cash",
          idecoPensionPayoutMode: "fixedMonthly",
        }),
      );
  const addIdecoIncome = () =>
      updateScenario((s) =>
        s.incomeEvents.push({
          id: createId(),
          memberId: s.householdProfile.headMemberId || s.householdMembers[0]?.id || "",
          name: "iDeCo受取",
          type: "pension",
          startYearMonth: s.userProfile.simulationStartYearMonth,
          monthlyAmount: 0,
          taxTreatment: "taxable",
          sourceAssetKey: "ideco",
          sourceAssetPayoutMode: "cash",
          idecoPensionPayoutMode: "monexSchedule",
          idecoPensionYears: 10,
          idecoPensionPaymentsPerYear: 6,
        }),
      );
  const duplicate = (index: number) =>
    updateScenario((s) => {
      const source = s.incomeEvents[index];
      if (!source) return;
      s.incomeEvents.splice(index + 1, 0, {
        ...structuredClone(source),
        id: createId(),
        name: source.name ? `${source.name} コピー` : "収入 コピー",
      });
    });
  const openPensionPlanner = () => {
    setTargetedIncomeDetailId("income-pension-planner");
    window.setTimeout(() => {
      document.getElementById("income-pension-planner")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };
  return (
    <Card id="income-pension" data-input-card-id="income-pension">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>収入イベント入力</CardTitle>
            <CardDescription>
              開始月から終了月まで有効。公的年金は年金受給プランナーを正として使い、iDeCoは原資資産を選ぶと年金受取・一時金（一括受取）を選べます。
            </CardDescription>
          </div>
          <Button onClick={add}>
            <Plus className="h-4 w-4" />
            追加
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          id="income-ideco"
          data-input-card-id="income-ideco"
          className={cn(
            "rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950 transition-shadow",
            targetCardId === "income-ideco" ? "border-amber-300 ring-2 ring-amber-200" : "",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 font-medium">
                <span>iDeCo受取</span>
                {targetCardId === "income-ideco" && (
                  <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-950">次に確認</span>
                )}
              </div>
              <p className="mt-1">
                原資資産を `iDeCo から受取` にすると、受取方法を `iDeCo年金受取（雑所得）` または `iDeCo一時金（一括受取・退職所得）` から選べます。
                一時金は国保・後期高齢者医療の所得割には含めない前提で概算し、過去退職金がある場合は税・社会保険タブで重複調整を確認します。
              </p>
            </div>
            {scenario.initialAssets.ideco > 0 && scenario.incomeEvents.filter((event) => event.sourceAssetKey === "ideco").length === 0 && (
              <Button data-input-focus-id="income-ideco" variant="outline" size="sm" onClick={addIdecoIncome}>
                iDeCo受取イベントを追加
              </Button>
            )}
          </div>
        </div>
        {scenario.incomeEvents.some((event) => event.type === "oneTime" && event.sourceAssetKey === "ideco") && (
          <div id="income-ideco-lump" data-input-card-id="income-ideco-lump" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            <div className="font-medium">iDeCo一時金の確認</div>
            <p className="mt-1">
              受取年月、受取額モード、iDeCo拠出年数（1年未満切上げ）、退職所得の申告を確認してください。推奨モードでは受取月時点のiDeCo残高を全額一括受取として計算します。
            </p>
          </div>
        )}
        <GuidedDetails
          id="income-pension-planner"
          title="年金受給プランナー"
          description="65歳標準年額を入れ、繰上げ・繰下げ後の年額と累計を確認します。反映する設定の場合、本人・配偶者の外部公的年金イベントは本計算から外れます。"
          summary={`${incomePlannerSettings.applyToSimulation ? "本計算へ反映" : "試算のみ"} / 65歳標準年額 ${compactYen(pensionPlannerAnnualTotal)}`}
          priority={incomePlannerSettings.applyToSimulation ? "required" : "detail"}
          targetCardId={pensionPlannerTargetId}
        >
          <PensionPlannerSection scenario={scenario} updateScenario={updateScenario} />
        </GuidedDetails>
        {scenario.incomeEvents.map((event, index) => {
          const replacedByPensionPlanner = isPensionPlannerReplacingEvent(scenario, event);
          const isExternalPublicPension = event.type === "pension" && !event.sourceAssetKey;
          const eventMember = scenario.householdMembers.find((member) => member.id === event.memberId);
          const incomeTypeOptions = getIncomeTypeSelectOptions(event.sourceAssetKey, event.type);
          const isIdecoLumpSumEvent = event.type === "oneTime" && event.sourceAssetKey === "ideco";
          const idecoLumpSumAmountMode = event.idecoLumpSumAmountMode ?? "currentBalance";
          const isIdecoLumpSumFullWithdrawal = isIdecoLumpSumCurrentBalanceMode({
            ...event,
            idecoLumpSumAmountMode,
          });
          const estimatedIdecoLumpSumGross = getIdecoLumpSumEstimatedGrossAmount(scenario, {
            ...event,
            idecoLumpSumAmountMode: "currentBalance",
          });
          const idecoLumpSumEstimatedGrowth = estimatedIdecoLumpSumGross - scenario.initialAssets.ideco;
          const manualIdecoLumpSumMayLeaveBalance =
            isIdecoLumpSumEvent && idecoLumpSumAmountMode === "manual" && event.monthlyAmount > 0 && event.monthlyAmount < estimatedIdecoLumpSumGross - 1;
          const editor = (
            <EventEditor
              key={event.id}
              title={event.name || "収入"}
              onDelete={() => updateScenario((s) => void s.incomeEvents.splice(index, 1))}
              inputCardId={event.sourceAssetKey === "ideco" && event.type === "oneTime" ? "income-ideco-lump" : undefined}
              actions={
                <Button variant="ghost" size="sm" onClick={() => duplicate(index)}>
                  <Copy className="h-4 w-4" />
                  複製
                </Button>
              }
            >
              {replacedByPensionPlanner ? (
                <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
                  年金受給プランナーを反映中のため、この外部公的年金イベントは本計算では使っていません。年金額・受給開始年月は上のプランナー側を正として保存・計算します。
                </div>
              ) : isExternalPublicPension ? (
                <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  これは外部収入として直接入力する公的年金です。年金受給プランナーを「反映する」にすると、本人・配偶者の外部公的年金イベントはプランナー値に置き換わります。
                </div>
              ) : null}
            <FormGrid>
              <Field label="名称">
                <Input value={event.name} onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].name = e.target.value))} />
              </Field>
              <Field label="世帯メンバー">
                <Select
                  value={event.memberId}
                  onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].memberId = e.target.value))}
                >
                  {scenario.householdMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={event.sourceAssetKey === "ideco" ? "iDeCo受取方法" : "種別"}>
                <Select
                  data-input-focus-id={event.sourceAssetKey === "ideco" ? "income-ideco" : undefined}
                  value={event.type}
                  onChange={(e) =>
                    updateScenario((s) => {
                      const nextType = e.target.value as IncomeEvent["type"];
                      s.incomeEvents[index].type = nextType;
                        if (nextType === "oneTime") {
                          s.incomeEvents[index].linkedHouseholdLivingArrangementEventId = undefined;
                        }
                        if (nextType === "unemployment") {
                          s.incomeEvents[index].taxTreatment = "nonTaxable";
                        }
                        if (nextType === "oneTime" && s.incomeEvents[index].sourceAssetKey === "ideco") {
                        s.incomeEvents[index].endYearMonth = s.incomeEvents[index].startYearMonth;
                        s.incomeEvents[index].idecoLumpSumAmountMode ??= "currentBalance";
                        s.incomeEvents[index].idecoLumpSumContributionYears ??= 20;
                        s.incomeEvents[index].idecoLumpSumTaxMode ??= "retirementIncomeDeclaration";
                      }
                    })
                  }
                >
                  {incomeTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {getIncomeTypeSelectLabel(type, event.sourceAssetKey)}
                    </option>
                  ))}
                </Select>
              </Field>
              {!isIdecoLumpSumEvent && (
                <Field label="開始年月">
                  <Input
                    type="month"
                    value={event.startYearMonth}
                    onChange={(e) =>
                      updateScenario((s) => {
                        s.incomeEvents[index].startYearMonth = e.target.value;
                        applyIncomeEventCurrentAmountInput(s.incomeEvents[index]);
                      })
                    }
                  />
                </Field>
              )}
              <Field label="原資資産">
                <Select
                  value={event.sourceAssetKey ?? ""}
                  onChange={(e) =>
                    updateScenario((s) => {
                      const nextValue = e.target.value === "" ? undefined : (e.target.value as GrowthAssetKey);
                      s.incomeEvents[index].sourceAssetKey = nextValue;
                      if (!nextValue) {
                        s.incomeEvents[index].sourceAssetPayoutMode = "cash";
                        s.incomeEvents[index].sourceOptionSubAccountId = undefined;
                      }
                      if (nextValue !== "ordinaryAccountForOptions") {
                        s.incomeEvents[index].sourceOptionSubAccountId = undefined;
                      }
                      if (nextValue === "ordinaryAccountForOptions") {
                        s.incomeEvents[index].sourceOptionSubAccountId ??= s.optionSubAccounts[0]?.id;
                      }
                      if (nextValue === "ideco" && !isIdecoIncomeType(s.incomeEvents[index].type)) {
                        s.incomeEvents[index].type = "pension";
                      }
                      if (nextValue === "ideco" && s.incomeEvents[index].type === "pension") {
                        s.incomeEvents[index].sourceAssetPayoutMode = "cash";
                        s.incomeEvents[index].idecoPensionPayoutMode ??= "monexSchedule";
                        s.incomeEvents[index].idecoPensionYears ??= 10;
                        s.incomeEvents[index].idecoPensionPaymentsPerYear ??= 6;
                      }
                      if (nextValue === "ideco" && s.incomeEvents[index].type === "oneTime") {
                        s.incomeEvents[index].sourceAssetPayoutMode = "cash";
                        s.incomeEvents[index].endYearMonth = s.incomeEvents[index].startYearMonth;
                        s.incomeEvents[index].idecoLumpSumAmountMode ??= "currentBalance";
                        s.incomeEvents[index].idecoLumpSumContributionYears ??= 20;
                        s.incomeEvents[index].idecoLumpSumTaxMode ??= "retirementIncomeDeclaration";
                      }
                    })
                  }
                >
                  <option value="">外部収入</option>
                  {(Object.keys(growthAssetLabels) as GrowthAssetKey[]).map((key) => (
                    <option key={key} value={key}>
                      {growthAssetLabels[key]} から受取
                    </option>
                  ))}
                </Select>
              </Field>
              {event.sourceAssetKey === "ordinaryAccountForOptions" && scenario.optionSubAccounts.length > 0 && (
                <Field label="原資サブ口座">
                  <Select
                    value={event.sourceOptionSubAccountId ?? scenario.optionSubAccounts[0]?.id ?? ""}
                    onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].sourceOptionSubAccountId = e.target.value))}
                  >
                    {scenario.optionSubAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {event.sourceAssetKey === "ordinaryAccountForOptions" && (
                  <Field label="利益の反映先">
                    <Select
                      value={event.sourceAssetPayoutMode ?? "cash"}
                      onChange={(e) =>
                        updateScenario((s) => void (s.incomeEvents[index].sourceAssetPayoutMode = e.target.value as "cash" | "retainInSourceAsset"))
                      }
                    >
                      <option value="cash">現金収入にする</option>
                      <option value="retainInSourceAsset">原資口座内で積み上げる</option>
                    </Select>
                  </Field>
                )}
              {event.sourceAssetKey &&
                event.sourceAssetKey !== "ordinaryAccountForOptions" &&
                event.sourceAssetPayoutMode === "retainInSourceAsset" && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    この収入イベントは旧設定の「原資口座内で積み上げる」が残っています。NISA・特定口座・iDeCoでは現金化も残高加算もせず、計算では無効扱いにします。
                    受け取りとして使う場合は、いったん原資資産を外してから再度選び直してください。
                  </div>
                )}
              <Field label="課税区分">
                <Select
                  value={event.taxTreatment ?? "taxable"}
                  onChange={(e) =>
                    updateScenario((s) => void (s.incomeEvents[index].taxTreatment = e.target.value as "taxable" | "withholding" | "nonTaxable"))
                  }
                >
                  <option value="taxable">課税</option>
                  <option value="withholding">源泉徴収</option>
                  <option value="nonTaxable">非課税</option>
                </Select>
              </Field>
              {event.type !== "oneTime" && (
                <Field label="終了リンク">
                  <Select
                    value={event.linkedHouseholdLivingArrangementEventId ?? ""}
                    onChange={(e) =>
                      updateScenario((s) => {
                        s.incomeEvents[index].linkedHouseholdLivingArrangementEventId = e.target.value || undefined;
                      })
                    }
                  >
                    <option value="">手入力の終了年月を使う</option>
                    {livingArrangementEvents.map((livingEvent) => (
                      <option key={livingEvent.id} value={livingEvent.id}>
                        {livingEvent.name} の前月まで
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {event.type === "pension" && event.sourceAssetKey === "ideco" ? (
                <>
                  <Field label="受取設定">
                    <Select
                      value={event.idecoPensionPayoutMode ?? "monexSchedule"}
                      onChange={(e) =>
                        updateScenario((s) => void (s.incomeEvents[index].idecoPensionPayoutMode = e.target.value as "fixedMonthly" | "monexSchedule"))
                      }
                    >
                      <option value="monexSchedule">マネックス証券の年金受取</option>
                      <option value="fixedMonthly">月額固定で受取</option>
                    </Select>
                  </Field>
                  {(event.idecoPensionPayoutMode ?? "monexSchedule") === "monexSchedule" ? (
                    <>
                      <Field label="受取期間">
                        <Select
                          value={String(event.idecoPensionYears ?? 10)}
                          onChange={(e) =>
                            updateScenario((s) => void (s.incomeEvents[index].idecoPensionYears = Number(e.target.value) as 5 | 10 | 15 | 20))
                          }
                        >
                          <option value="5">5年</option>
                          <option value="10">10年</option>
                          <option value="15">15年</option>
                          <option value="20">20年</option>
                        </Select>
                      </Field>
                      <Field label="年間支給回数">
                        <Select
                          value={String(event.idecoPensionPaymentsPerYear ?? 6)}
                          onChange={(e) =>
                            updateScenario((s) => void (s.incomeEvents[index].idecoPensionPaymentsPerYear = Number(e.target.value) as 1 | 2 | 4 | 6))
                          }
                        >
                          <option value="1">年1回</option>
                          <option value="2">年2回</option>
                          <option value="4">年4回</option>
                          <option value="6">年6回</option>
                        </Select>
                      </Field>
                      <Field label="初回支給月(自動)">
                        <Input type="month" value={getIdecoMonexFirstPayoutYearMonth(event) ?? ""} readOnly />
                      </Field>
                      <Field label="受取終了年月(自動)">
                        <Input type="month" value={getIdecoMonexEndYearMonth(event) ?? ""} readOnly />
                      </Field>
                      <Field label="推定1回あたり受取額">
                        <Input type="number" value={Math.round(getIdecoMonexEstimatedPerPayment(scenario, event))} readOnly />
                      </Field>
                      <Field label="推定年額">
                        <Input
                          type="number"
                          value={Math.round(getIdecoMonexEstimatedPerPayment(scenario, event) * (event.idecoPensionPaymentsPerYear ?? 6))}
                          readOnly
                        />
                      </Field>
                    </>
                  ) : (
                    <>
                      <Field label="終了年月">
                        <Input
                          type="month"
                          value={event.endYearMonth ?? ""}
                          readOnly={Boolean(event.linkedHouseholdLivingArrangementEventId)}
                          onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].endYearMonth = e.target.value || undefined))}
                        />
                      </Field>
                      <Field label="月額">
                        <Input type="number" value={event.monthlyAmount} onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].monthlyAmount = numberOrZero(e.target.value)))} />
                      </Field>
                    </>
                  )}
                </>
              ) : event.type === "oneTime" && event.sourceAssetKey === "ideco" ? (
                <>
                  <Field label="受取年月">
                    <Input
                      type="month"
                      value={event.startYearMonth}
                      onChange={(e) =>
                        updateScenario((s) => {
                          s.incomeEvents[index].startYearMonth = e.target.value;
                          s.incomeEvents[index].endYearMonth = e.target.value;
                        })
                      }
                    />
                  </Field>
                  <Field label="受取額モード">
                    <Select
                      value={idecoLumpSumAmountMode}
                      onChange={(e) =>
                        updateScenario((s) => {
                          s.incomeEvents[index].idecoLumpSumAmountMode = e.target.value as "currentBalance" | "manual";
                        })
                      }
                    >
                      <option value="currentBalance">受取月時点のiDeCo残高を全額受取（推奨）</option>
                      <option value="manual">一時金額を手入力する</option>
                    </Select>
                  </Field>
                  {isIdecoLumpSumFullWithdrawal ? (
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950 md:col-span-2">
                      <div className="font-medium">受取月時点の残高を一括受取として計算します</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div>現在のiDeCo評価額: {yen(scenario.initialAssets.ideco)}</div>
                        <div>受取月時点の見込一時金額: {yen(estimatedIdecoLumpSumGross)}</div>
                        <div>受取月までの見込成長額: {yen(idecoLumpSumEstimatedGrowth)}</div>
                        <div>税概算対象額: {yen(estimatedIdecoLumpSumGross)}</div>
                      </div>
                      <p className="mt-2 text-xs text-sky-800">
                        現在のiDeCo評価額を初期資産に入れておけば、受取月まで年率設定で成長させた見込残高を一括受取として計算します。税引後の受取額は普通預金へ入ります。
                      </p>
                    </div>
                  ) : (
                    <Field label="受取月時点の一時金見込額（手入力）">
                      <Input type="number" value={event.monthlyAmount} onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].monthlyAmount = numberOrZero(e.target.value)))} />
                    </Field>
                  )}
                  {!isIdecoLumpSumFullWithdrawal && (
                    <div className={cn("rounded-lg border px-4 py-3 text-sm leading-6 md:col-span-2", manualIdecoLumpSumMayLeaveBalance ? "border-amber-300 bg-amber-50 text-amber-950" : "bg-slate-50 text-muted-foreground")}>
                      現在残高ではなく、受取月時点で実際に受け取る見込額を入れてください。現在残高から自動試算したい場合は「受取月時点のiDeCo残高を全額受取」を選びます。
                      {manualIdecoLumpSumMayLeaveBalance && (
                        <div className="mt-1 font-medium">
                          手入力額が受取月時点の見込iDeCo残高を下回るため、受取後もiDeCo残高が残ります。一括受取のつもりなら全額受取モードを使ってください。
                        </div>
                      )}
                    </div>
                  )}
                    <Field label="iDeCo拠出年数（1年未満切上げ）">
                      <Input
                        type="number"
                        value={event.idecoLumpSumContributionYears ?? 20}
                        onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].idecoLumpSumContributionYears = numberOrZero(e.target.value)))}
                      />
                    </Field>
                    <Field label="拠出月数（任意・日付優先）">
                      <Input
                        type="number"
                        value={event.idecoLumpSumContributionMonths ?? ""}
                        onChange={(e) =>
                          updateScenario((s) => {
                            s.incomeEvents[index].idecoLumpSumContributionMonths = e.target.value === "" ? undefined : numberOrZero(e.target.value);
                          })
                        }
                      />
                    </Field>
                    <Field label="加入・拠出開始日（任意）">
                      <Input
                      type="date"
                      data-input-focus-id={
                        event.sourceAssetKey === "ideco" && event.type === "oneTime" && !event.idecoLumpSumContributionStartDate
                          ? "income-ideco-lump"
                          : undefined
                      }
                      value={event.idecoLumpSumContributionStartDate ?? ""}
                      onChange={(e) =>
                        updateScenario((s) => {
                          s.incomeEvents[index].idecoLumpSumContributionStartDate = e.target.value || undefined;
                        })
                      }
                    />
                  </Field>
                    <Field label="加入・拠出終了日（任意）">
                    <Input
                      type="date"
                      data-input-focus-id={
                        event.sourceAssetKey === "ideco" &&
                        event.type === "oneTime" &&
                        event.idecoLumpSumContributionStartDate &&
                        !event.idecoLumpSumContributionEndDate
                          ? "income-ideco-lump"
                          : undefined
                      }
                      value={event.idecoLumpSumContributionEndDate ?? ""}
                      onChange={(e) =>
                        updateScenario((s) => {
                          s.incomeEvents[index].idecoLumpSumContributionEndDate = e.target.value || undefined;
                        })
                      }
                    />
                  </Field>
                  <Field label="退職所得の申告">
                    <Select
                      value={event.idecoLumpSumTaxMode ?? "retirementIncomeDeclaration"}
                      onChange={(e) =>
                        updateScenario(
                          (s) =>
                            void (s.incomeEvents[index].idecoLumpSumTaxMode = e.target.value as "retirementIncomeDeclaration" | "noDeclaration"),
                        )
                      }
                    >
                        <option value="retirementIncomeDeclaration">提出あり（退職所得税額を概算）</option>
                      <option value="noDeclaration">提出なし（20.42%源泉徴収）</option>
                    </Select>
                  </Field>
                </>
              ) : (
                <>
                  <Field label="終了年月">
                    <Input
                      type="month"
                      value={event.endYearMonth ?? ""}
                      readOnly={Boolean(event.linkedHouseholdLivingArrangementEventId)}
                      onChange={(e) =>
                        updateScenario((s) => {
                          s.incomeEvents[index].endYearMonth = e.target.value || undefined;
                          applyIncomeEventCurrentAmountInput(s.incomeEvents[index]);
                        })
                      }
                    />
                  </Field>
                  <Field label="入力単位">
                    <Select
                      value={event.amountInputMode ?? "monthly"}
                      onChange={(e) =>
                        updateScenario((s) => {
                          const nextMode = e.target.value as IncomeEventAmountInputMode;
                          applyIncomeEventAmountInput(s.incomeEvents[index], nextMode, getIncomeEventInputAmount(s.incomeEvents[index]));
                        })
                      }
                    >
                      <option value="monthly">月額</option>
                      <option value="annual">年額</option>
                      <option value="periodTotal">期間合計</option>
                    </Select>
                  </Field>
                  <Field label={incomeAmountInputLabel(event.amountInputMode ?? "monthly")}>
                    <Input
                      type="number"
                      value={getIncomeEventInputAmount(event)}
                      onChange={(e) =>
                        updateScenario((s) =>
                          applyIncomeEventAmountInput(s.incomeEvents[index], s.incomeEvents[index].amountInputMode ?? "monthly", numberOrZero(e.target.value)),
                        )
                      }
                    />
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        describeIncomeEventAmountConversion(event).warning ? "text-amber-700" : "text-muted-foreground",
                      )}
                    >
                      {incomeAmountConversionText(event)}
                    </p>
                  </Field>
                </>
              )}
            </FormGrid>
            {event.linkedHouseholdLivingArrangementEventId && (
              <p className="mt-3 text-sm text-muted-foreground">
                終了年月は同居状態変更イベントから自動設定しています。別居開始月の前月までを収入期間として扱います。
              </p>
            )}
            {event.sourceAssetKey === "ideco" && (
              <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  iDeCo年金受取は公的年金等の雑所得、一時金（一括受取）は退職所得として扱います。一時金は過去退職金との重複調整後の退職所得控除で、所得税等と住民税（市区町村6% + 都道府県4%）を概算します。国保・後期高齢者医療の所得割には含めません。加入・拠出開始日/終了日があれば拠出月数から1年未満切上げ、未入力なら拠出年数ベースで概算します。
              </div>
            )}
            {event.type === "pension" && event.sourceAssetKey === "ideco" && (event.idecoPensionPayoutMode ?? "monexSchedule") === "monexSchedule" && (
              <p className="mt-3 text-sm text-muted-foreground">
                開始年月が偶数月でない場合、初回支給月は翌偶数月に自動補正します。受取期間と年間支給回数から、初回支給月と終了年月を自動生成します。
                金額は現在の iDeCo 評価額を総支給回数で割った概算です。
              </p>
            )}
            </EventEditor>
          );
          if (replacedByPensionPlanner) {
            return (
              <GuidedDetails
                key={event.id}
                id={`inactive-income-${event.id}`}
                title={`計算対象外: ${eventMember?.name ?? "世帯メンバー"}の公的年金イベント`}
                description="年金受給プランナーを反映中のため、この外部公的年金イベントの年金額と受給開始年月は本計算では使いません。必要な場合だけ詳細を開いて内容を確認してください。"
                summary={`${event.name || "公的年金イベント"} / 月額 ${compactYen(event.monthlyAmount)} は計算対象外`}
                priority="detail"
              >
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={openPensionPlanner}>
                    プランナーを確認
                  </Button>
                </div>
                {editor}
              </GuidedDetails>
            );
          }
          return editor;
        })}
        <div className="grid gap-4 md:grid-cols-2">
          <RateField label="年金改定率" value={scenario.inflationSettings.pensionAnnualAdjustmentRate} onChange={(value) => updateScenario((s) => void (s.inflationSettings.pensionAnnualAdjustmentRate = value))} />
        </div>
        <ScenarioSyncDetails
          title="他シナリオへ反映（必要時のみ）"
          description="収入・年金前提をまとめてコピーする時だけ開きます。"
        >
        <div className="rounded-lg border bg-white px-4 py-3">
          <div className="grid gap-4 lg:grid-cols-[minmax(260px,420px)_1fr]">
            <Field label="コピー元シナリオ">
              <Select
                value={incomeSyncSourceScenario.id}
                onChange={(event) => setIncomeSyncSourceScenarioId(event.target.value)}
              >
                {scenarios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
              現在のコピー元は「{incomeSyncSourceScenario.name}」です。下の収入イベント選択メニューも、このコピー元シナリオの内容に切り替わります。
            </div>
          </div>
          {!sourceIsCurrentScenario && (
            <label className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <input
                type="checkbox"
                checked={excludeCurrentScenarioFromIncomeSync}
                onChange={(event) => setExcludeCurrentScenarioFromIncomeSync(event.target.checked)}
              />
              <span>
                <span className="block font-medium">現在開いているシナリオは上書きしない</span>
                <span className="text-xs">
                  「{scenario.name}」を見ながら別シナリオをコピー元にする場合の誤反映を防ぎます。意図して現在のシナリオにも反映する場合だけ外してください。
                </span>
              </span>
            </label>
          )}
        </div>
        <ScenarioSyncCard<keyof IncomeSyncOptions>
          title="収入前提を他シナリオへ反映"
          description={`コピー元シナリオを選び、収入・年金まわりの前提を他シナリオへ反映します。コピー元自身は反映先から外します。`}
          targetMode={incomeSyncTargetMode}
          setTargetMode={setIncomeSyncTargetMode}
          targetCount={incomeSyncTargetCount}
          targetNames={incomeSyncTargetNames}
          allScenarios={scenarios}
          sourceScenarioId={incomeSyncSourceScenario.id}
          excludedScenarioIds={incomeSyncExcludedScenarioIds}
          selectedTargetIds={incomeSyncSelectedTargetIdSet}
          toggleSelectedTarget={toggleIncomeSyncTarget}
          targetSummary={incomeSyncTargetSummary}
          options={[
            { key: "incomeEvents", label: "収入イベント", description: "給与、年金、iDeCo受取、単発入金など" },
            { key: "optionSubAccounts", label: "CFD・米国株オプション設定", description: "サブ口座、評価額、取得原価、保護・スイープ設定" },
            { key: "pensionPlanner", label: "年金プランナー", description: "受給開始年齢、標準年額、加給年金設定" },
            { key: "retirementIncomeEvents", label: "退職所得イベント", description: "退職金、iDeCo一時金など" },
            { key: "pensionAdjustmentRate", label: "年金改定率", description: "収入タブの年金改定率のみ" },
          ]}
          selectedOptions={incomeSyncOptions}
          toggleOption={updateIncomeSyncOption}
          warningText={incomeSyncWarningText}
          onApply={applyIncomeSync}
          message={incomeSyncMessage}
          applyDisabled={!hasIncomeSyncSelection}
          optionGridClassName="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
        />
        {incomeSyncOptions.incomeEvents && (linkedOptionSubAccountsForIncomeSync.length > 0 || unresolvedOptionIncomeEventNames.length > 0) && (
          <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950">
            <div className="font-medium">関連する初期資産があります</div>
            <p className="mt-1">選択した収入イベントは、一般口座サブ口座を原資にしています。</p>
            {linkedOptionSubAccountsForIncomeSync.length > 0 && (
              <label className="mt-3 flex items-start gap-2 rounded-md border bg-white/70 px-3 py-2">
                <input
                  type="checkbox"
                  checked={includeLinkedOptionSubAccountsWithIncomeSync}
                  onChange={(event) => setIncludeLinkedOptionSubAccountsWithIncomeSync(event.target.checked)}
                />
                <span>
                  <span className="block font-medium">関連する一般口座サブ口座の初期条件も一緒に反映する（推奨）</span>
                  <span className="text-xs text-muted-foreground">
                    収入イベントだけを反映すると、反映先シナリオの一般口座サブ口座が未設定または古いままになる可能性があります。
                  </span>
                </span>
              </label>
            )}
            {linkedOptionSubAccountsForIncomeSync.length > 0 && (
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {linkedOptionSubAccountsForIncomeSync.map((account) => (
                  <div key={account.id} className="rounded-md border bg-white px-3 py-2">
                    <div className="font-medium">{account.name || "名称未設定"}</div>
                    <div className="text-xs text-muted-foreground">
                      評価額 {compactYen(account.initialValue)} / 取得原価 {compactYen(account.initialCostBasis)} / 最低維持証拠金 {compactYen(account.minimumBalance)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {unresolvedOptionIncomeEventNames.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                関連サブ口座未特定: {unresolvedOptionIncomeEventNames.join("、")}。収入イベント名またはサブ口座名を確認してください。
              </div>
            )}
            {linkedOptionSubAccountsForIncomeSync.length > 0 && !includeLinkedOptionSubAccountsWithIncomeSync && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                収入イベントだけを反映すると、反映先シナリオの一般口座サブ口座が未設定または古いままになる可能性があります。
              </div>
            )}
          </div>
        )}
        {incomeSyncOptions.incomeEvents && (
          <div className="rounded-lg border bg-white px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">コピーする収入イベントを選択</div>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  チェックしたイベントだけを他シナリオへ反映します。チェックを外したイベントと、反映先にだけある収入イベントは残します。
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllIncomeEventsForSync}>全選択</Button>
                <Button variant="outline" size="sm" onClick={clearIncomeEventsForSync}>全解除</Button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {incomeSyncSourceScenario.incomeEvents.map((event) => (
                <label key={event.id} className="flex items-start gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIncomeEventIdSet.has(event.id)}
                    onChange={() => toggleIncomeEventSyncTarget(event.id)}
                  />
                  <span>
                    <span className="block font-medium">{getIncomeSyncEventTitle(event)}</span>
                    <span className="text-xs text-muted-foreground">
                      {incomeTypeLabels[event.type]} / 月額 {compactYen(event.monthlyAmount)}
                      {` / ${getIncomeSyncEventSourceLabel(event)}`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {incomeSyncSourceScenario.optionSubAccounts.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-950">
                CFDや米国株オプションは収入イベントではなく、一般口座オプションのサブ口座設定です。コピーする場合は上の「CFD・米国株オプション設定」にチェックを入れ、下の専用リストで選びます。
              </div>
            )}
          </div>
        )}
        {incomeSyncOptions.optionSubAccounts && (
          <div className="rounded-lg border bg-white px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">コピーするCFD・米国株オプション設定を選択</div>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  チェックしたサブ口座の評価額、取得原価、開始月、保護・スイープ設定を他シナリオへ反映します。収入イベントとは別の設定です。
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllOptionSubAccountsForSync}>全選択</Button>
                <Button variant="outline" size="sm" onClick={clearOptionSubAccountsForSync}>全解除</Button>
              </div>
            </div>
            {incomeSyncSourceScenario.optionSubAccounts.length > 0 ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {incomeSyncSourceScenario.optionSubAccounts.map((account) => (
                  <label
                    key={account.id}
                    className={cn(
                      "flex items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                      selectedOptionSubAccountIdSet.has(account.id) ? "border-teal-400 bg-teal-50" : "bg-slate-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedOptionSubAccountIdSet.has(account.id)}
                      onChange={() => toggleOptionSubAccountSyncTarget(account.id)}
                    />
                    <span>
                      <span className="block font-medium">{account.name || "名称未設定"}</span>
                      <span className="text-xs text-muted-foreground">
                        評価額 {compactYen(account.initialValue)} / 取得原価 {compactYen(account.initialCostBasis)}
                        {account.startYearMonth ? ` / 開始 ${account.startYearMonth}` : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-md border bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
                コピー元シナリオにCFD・米国株オプション設定がありません。
              </div>
            )}
          </div>
        )}
        </ScenarioSyncDetails>
      </CardContent>
    </Card>
  );
}

const retirementIncomeTypeLabels: Record<RetirementIncomeEvent["type"], string> = {
  idecoLumpSum: "iDeCo一時金",
  companyRetirementAllowance: "会社退職金",
  corporateDcLumpSum: "企業型DC一時金",
  dbLumpSum: "DB一時金",
  otherRetirementAllowance: "その他退職手当",
};

function RetirementIncomeSection({ scenario, updateScenario }: SectionProps) {
  const events = scenario.retirementIncomeEvents ?? [];
  const add = () =>
    updateScenario((s) => {
      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
      s.retirementIncomeEvents.push({
        id: createId(),
        memberId: s.householdProfile.headMemberId || s.householdMembers[0]?.id || "",
        name: "退職所得イベント",
        type: "companyRetirementAllowance",
        paymentYearMonth: s.userProfile.simulationStartYearMonth,
        grossAmount: 0,
        serviceYears: 20,
        serviceStartDate: "",
        serviceEndDate: "",
        alreadyReceived: false,
        retirementIncomeDeductionUsed: false,
        withholdingTaxPaid: 0,
        residentTaxMunicipalPaid: 0,
        residentTaxPrefecturalPaid: 0,
      });
    });
  const duplicate = (index: number) =>
    updateScenario((s) => {
      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
      const source = s.retirementIncomeEvents[index];
      if (!source) return;
      s.retirementIncomeEvents.splice(index + 1, 0, {
        ...structuredClone(source),
        id: createId(),
        name: source.name ? `${source.name} コピー` : "退職所得 コピー",
      });
    });

  const typeOptions = Object.entries(retirementIncomeTypeLabels) as Array<[RetirementIncomeEvent["type"], string]>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>退職所得履歴</CardTitle>
            <CardDescription>
              会社退職金や iDeCo 一時金の受取履歴を登録します。源泉徴収税額に加えて、市町村民税と道府県民税も記録できます。過去の退職金も入れて、iDeCo との間隔ルールを警告表示します。
            </CardDescription>
          </div>
          <Button onClick={add}>
            <Plus className="h-4 w-4" />
            追加
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {events.length === 0 && <p className="text-sm text-muted-foreground">退職所得イベントは未登録です。過去の退職金がある場合はここに追加してください。</p>}
        {events.map((event, index) => (
          <EventEditor
            key={event.id}
            title={event.name || retirementIncomeTypeLabels[event.type]}
            onDelete={() => updateScenario((s) => void s.retirementIncomeEvents?.splice(index, 1))}
            actions={
              <Button variant="ghost" size="sm" onClick={() => duplicate(index)}>
                <Copy className="h-4 w-4" />
                複製
              </Button>
            }
          >
            <FormGrid>
              <Field label="名称">
                <Input
                  value={event.name}
                  onChange={(e) =>
                    updateScenario((s) => {
                      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
                      s.retirementIncomeEvents[index].name = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label="世帯メンバー">
                <Select
                  value={event.memberId}
                  onChange={(e) =>
                    updateScenario((s) => {
                      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
                      s.retirementIncomeEvents[index].memberId = e.target.value;
                    })
                  }
                >
                  {scenario.householdMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="種別">
                <Select
                  value={event.type}
                  onChange={(e) =>
                    updateScenario((s) => {
                      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
                      s.retirementIncomeEvents[index].type = e.target.value as RetirementIncomeEvent["type"];
                    })
                  }
                >
                  {typeOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="受取年月">
                <Input
                  type="month"
                  value={event.paymentYearMonth}
                  onChange={(e) =>
                    updateScenario((s) => {
                      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
                      s.retirementIncomeEvents[index].paymentYearMonth = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label="受取額">
                <Input
                  type="number"
                  value={event.grossAmount}
                  onChange={(e) =>
                    updateScenario((s) => {
                      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
                      s.retirementIncomeEvents[index].grossAmount = numberOrZero(e.target.value);
                    })
                  }
                />
              </Field>
              <Field label="勤続/加入年数">
                <Input
                  type="number"
                  value={event.serviceYears}
                  onChange={(e) =>
                    updateScenario((s) => {
                      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
                      s.retirementIncomeEvents[index].serviceYears = numberOrZero(e.target.value);
                    })
                  }
                />
              </Field>
              <Field label="勤続/加入開始日">
                <Input
                  type="date"
                  value={event.serviceStartDate ?? ""}
                  onChange={(e) =>
                    updateScenario((s) => {
                      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
                      s.retirementIncomeEvents[index].serviceStartDate = e.target.value || undefined;
                    })
                  }
                />
              </Field>
              <Field label="勤続/加入終了日">
                <Input
                  type="date"
                  value={event.serviceEndDate ?? ""}
                  onChange={(e) =>
                    updateScenario((s) => {
                      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
                      s.retirementIncomeEvents[index].serviceEndDate = e.target.value || undefined;
                    })
                  }
                />
              </Field>
              <Field label="既受給">
                <Select
                  value={event.alreadyReceived ? "yes" : "no"}
                  onChange={(e) =>
                    updateScenario((s) => {
                      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
                      s.retirementIncomeEvents[index].alreadyReceived = e.target.value === "yes";
                      if (e.target.value === "yes") s.retirementIncomeEvents[index].retirementIncomeDeductionUsed = true;
                    })
                  }
                >
                  <option value="no">これから受給</option>
                  <option value="yes">過去に受給済み</option>
                </Select>
              </Field>
              <Field label="控除使用済み">
                <Select
                  value={event.retirementIncomeDeductionUsed ? "yes" : "no"}
                  onChange={(e) =>
                    updateScenario((s) => {
                      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
                      s.retirementIncomeEvents[index].retirementIncomeDeductionUsed = e.target.value === "yes";
                    })
                  }
                >
                  <option value="no">未使用</option>
                  <option value="yes">使用済み</option>
                </Select>
              </Field>
              <Field label="源泉徴収税額">
                <Input
                  type="number"
                  value={event.withholdingTaxPaid ?? 0}
                  onChange={(e) =>
                    updateScenario((s) => {
                      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
                      s.retirementIncomeEvents[index].withholdingTaxPaid = numberOrZero(e.target.value);
                    })
                  }
                />
              </Field>
              <Field label="市町村民税">
                <Input
                  type="number"
                  value={event.residentTaxMunicipalPaid ?? 0}
                  onChange={(e) =>
                    updateScenario((s) => {
                      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
                      s.retirementIncomeEvents[index].residentTaxMunicipalPaid = numberOrZero(e.target.value);
                    })
                  }
                />
              </Field>
              <Field label="道府県民税">
                <Input
                  type="number"
                  value={event.residentTaxPrefecturalPaid ?? 0}
                  onChange={(e) =>
                    updateScenario((s) => {
                      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
                      s.retirementIncomeEvents[index].residentTaxPrefecturalPaid = numberOrZero(e.target.value);
                    })
                  }
                />
              </Field>
              <Field label="メモ">
                <Input
                  value={event.note ?? ""}
                  onChange={(e) =>
                    updateScenario((s) => {
                      if (!s.retirementIncomeEvents) s.retirementIncomeEvents = [];
                      s.retirementIncomeEvents[index].note = e.target.value;
                    })
                  }
                />
              </Field>
            </FormGrid>
          </EventEditor>
        ))}
      </CardContent>
    </Card>
  );
}

function TaxPublicSummary({
  mode,
  premiseYearLabel,
  totalPremiseTax,
  averagePremiseTax,
  peakPremiseTax,
  peakPaymentYear,
  nextPaymentRows,
  autoDetailCount,
}: {
  mode: HouseholdProfile["taxCalculationMode"];
  premiseYearLabel: string;
  totalPremiseTax: number;
  averagePremiseTax: number;
  peakPremiseTax?: {
    row: TaxInsuranceByFiscalYear;
    taxTotal: number;
    capitalGainsTaxAnnual: number;
    nationalPensionAnnual: number;
  };
  peakPaymentYear?: AnnualResult;
  nextPaymentRows: Array<{
    year: number;
    ageYears: number;
    taxTotal: number;
    incomeTaxSettlement: number;
    residentTax: number;
    nationalHealthInsurance: number;
    lateElderlyMedical: number;
    nationalPension: number;
    nursingCare: number;
    capitalGainsTax: number;
  }>;
  autoDetailCount: number;
}) {
  const modeLabel = taxModeHelp[mode].label;
  const peakPaymentTax = peakPaymentYear
    ? peakPaymentYear.taxInsuranceTotal + peakPaymentYear.capitalGainsTaxTotal + peakPaymentYear.idecoWithholdingTaxTotal
    : 0;
  const firstPaymentRow = nextPaymentRows[0];
  const firstPaymentText = firstPaymentRow ? `${firstPaymentRow.year}年 ${compactYen(firstPaymentRow.taxTotal)}` : "まだありません";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border bg-amber-50 px-4 py-4">
          <div className="text-sm font-medium text-amber-900">この試算の税社保総額</div>
          <div className="mt-2 text-3xl font-semibold text-amber-950">{compactYen(totalPremiseTax)}</div>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            {premiseYearLabel} の所得発生年度ベースです。年平均は {compactYen(averagePremiseTax)} です。
          </p>
        </div>
        <div className="rounded-md border bg-blue-50 px-4 py-4">
          <div className="text-sm font-medium text-blue-900">最も負担が大きい所得年</div>
          <div className="mt-2 text-2xl font-semibold text-blue-950">
            {peakPremiseTax ? `${peakPremiseTax.row.fiscalYear}年度 ${compactYen(peakPremiseTax.taxTotal)}` : "未作成"}
          </div>
          <p className="mt-2 text-sm leading-6 text-blue-900">
            所得税・住民税・国保等に、売却時の譲渡益税を加えた概算です。
          </p>
        </div>
        <div className="rounded-md border bg-rose-50 px-4 py-4">
          <div className="text-sm font-medium text-rose-900">現金で出ていく注意年</div>
          <div className="mt-2 text-2xl font-semibold text-rose-950">
            {peakPaymentYear ? `${peakPaymentYear.year}年 ${compactYen(peakPaymentTax)}` : "未作成"}
          </div>
          <p className="mt-2 text-sm leading-6 text-rose-900">
            住民税・国保などは所得の翌年側に出やすいため、所得年と支払年を分けて見ます。
          </p>
        </div>
      </div>

      <div className="grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-md border bg-white px-4 py-3">
          <div className="font-medium text-slate-900">計算モード: {modeLabel}</div>
          <p className="mt-1 leading-6 text-muted-foreground">
            {mode === "manual" ? "手入力の年度金額を使います。" : mode === "auto" ? "収入と世帯情報から自動概算します。" : "自動概算に補正額を足します。"}
          </p>
        </div>
        <div className="rounded-md border bg-white px-4 py-3">
          <div className="font-medium text-slate-900">初年度の支払目安: {firstPaymentText}</div>
          <p className="mt-1 leading-6 text-muted-foreground">下の表で、直近5年の支払タイミングを確認できます。</p>
        </div>
        <div className="rounded-md border bg-white px-4 py-3">
          <div className="font-medium text-slate-900">概算・対応年度</div>
          <p className="mt-1 leading-6 text-muted-foreground">
            2026年度前提を中心にした概算です。自治体差、制度改正、通知書との差は補正してください。自動計算年度数: {autoDetailCount}。
          </p>
        </div>
      </div>

      {nextPaymentRows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[760px]">
            <thead>
              <Tr>
                <Th>支払年</Th>
                <Th>年末年齢</Th>
                <Th>支払合計</Th>
                <Th>所得税精算</Th>
                <Th>住民税</Th>
                <Th>国保</Th>
                <Th>後期高齢</Th>
                <Th>年金</Th>
                <Th>介護</Th>
                <Th>譲渡益税</Th>
              </Tr>
            </thead>
            <tbody>
              {nextPaymentRows.map((row) => (
                <Tr key={`tax-public-payment-${row.year}`}>
                  <Td>{row.year}</Td>
                  <Td>{row.ageYears}歳</Td>
                  <Td className="font-medium">{compactYen(row.taxTotal)}</Td>
                  <Td>{compactYen(row.incomeTaxSettlement)}</Td>
                  <Td>{compactYen(row.residentTax)}</Td>
                  <Td>{compactYen(row.nationalHealthInsurance)}</Td>
                  <Td>{compactYen(row.lateElderlyMedical)}</Td>
                  <Td>{compactYen(row.nationalPension)}</Td>
                  <Td>{compactYen(row.nursingCare)}</Td>
                  <Td>{compactYen(row.capitalGainsTax)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

const spouseWorkstyleBoundaries = [
  { amount: 1_170_000, label: "117万円", note: "給与所得43万円。国保の所得割基礎が0円に収まる目安。" },
  { amount: 1_190_000, label: "119万円", note: "給与所得45万円。大田区/23区の単身住民税非課税の目安。" },
  { amount: 1_300_000, label: "130万円", note: "勤務先社保に入らない場合の扶養・国保判定で確認されやすい収入帯。" },
  { amount: 1_360_000, label: "136万円", note: "所得税・住民税の配偶者控除から配偶者特別控除へ名称が変わる境界。" },
  { amount: 1_690_000, label: "169万円", note: "所得税の配偶者特別控除が最大額から下がり始める境界。" },
  { amount: 1_740_000, label: "174万円", note: "住民税の配偶者特別控除が最大額から下がり始める境界。" },
  { amount: 1_780_000, label: "178万円", note: "2026/2027年分の所得税で、給与所得と基礎控除が並ぶ目安。" },
  { amount: 2_070_000, label: "207万円", note: "配偶者特別控除が0円になる目安。" },
] as const;

type WorkplaceApplicabilityValue = "unknown" | "notApplicable" | "applicable";

function workplaceApplicabilityValue(settings: WorkplaceSocialInsuranceSettings): WorkplaceApplicabilityValue {
  if (settings.isApplicableWorkplace === undefined) return "unknown";
  return settings.isApplicableWorkplace ? "applicable" : "notApplicable";
}

function workplaceSocialInsuranceReasonLabel(judgment: WorkplaceSocialInsuranceJudgment) {
  if (judgment.reason === "threeQuarter") return "通常労働者の4分の3以上のため加入対象";
  if (judgment.reason === "shortTimeWorker") return "短時間労働者の拡大要件で加入対象";
  if (judgment.reason === "notApplicableWorkplace") return "適用事業所ではない";
  return "勤務先社保の加入要件未満";
}

function workplaceSocialInsuranceStatusLabel(
  spouse: HouseholdMember | undefined,
  settings: WorkplaceSocialInsuranceSettings,
  judgment: WorkplaceSocialInsuranceJudgment,
) {
  if (!spouse) return "配偶者が未登録です";
  if (settings.isApplicableWorkplace === undefined) return "要確認: 適用事業所未確認";
  if (settings.isApplicableWorkplace === false) return "適用事業所ではない";
  return workplaceSocialInsuranceReasonLabel(judgment);
}

function updateWorkplaceSocialInsuranceSetting(
  updateScenario: SectionProps["updateScenario"],
  memberId: string,
  updater: (current: WorkplaceSocialInsuranceSettings) => WorkplaceSocialInsuranceSettings,
) {
  updateScenario((s) => {
    const member = s.householdMembers.find((item) => item.id === memberId);
    if (!member) return;
    member.workplaceSocialInsurance = updater(member.workplaceSocialInsurance ?? {});
  });
}

function SpouseWorkstyleTaxSocialCard({
  scenario,
  scenarios,
  updateScenario,
  updateScenarios,
  highlightKey,
  onOpenSpouseIncomeEvents,
  onOpenSpousePartIncomeCompare,
}: {
  scenario: ScenarioData;
  scenarios: ScenarioData[];
  updateScenario: SectionProps["updateScenario"];
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData, backupLabel?: string) => void;
  highlightKey: number;
  onOpenSpouseIncomeEvents: () => void;
  onOpenSpousePartIncomeCompare: () => void;
}) {
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const spouse = scenario.householdMembers.find((member) => member.relationship === "spouse");
  const settings = spouse?.workplaceSocialInsurance ?? {};
  const judgmentYearMonth = settings.joinStartYearMonth || scenario.userProfile.simulationStartYearMonth;
  const judgment = judgeWorkplaceSocialInsurance(settings, judgmentYearMonth);
  const applicabilityValue = workplaceApplicabilityValue(settings);
  const statusLabel = workplaceSocialInsuranceStatusLabel(spouse, settings, judgment);
  const compareTargetScenarios = scenarios.filter((item) => item.compare && item.id !== scenario.id);
  useEffect(() => {
    if (highlightKey <= 0) return undefined;
    setIsHighlighted(true);
    const timer = window.setTimeout(() => setIsHighlighted(false), 4500);
    return () => window.clearTimeout(timer);
  }, [highlightKey]);
  const setSetting = (updater: (current: WorkplaceSocialInsuranceSettings) => WorkplaceSocialInsuranceSettings) => {
    if (!spouse) return;
    updateWorkplaceSocialInsuranceSetting(updateScenario, spouse.id, updater);
  };
  const updateNumber = (key: keyof WorkplaceSocialInsuranceSettings, value: string) => {
    setSetting((current) => ({ ...current, [key]: value === "" ? undefined : numberOrZero(value) }));
  };
  const updateBoolean = (key: keyof WorkplaceSocialInsuranceSettings, value: boolean) => {
    setSetting((current) => ({ ...current, [key]: value }));
  };
  const updateApplicability = (value: WorkplaceApplicabilityValue) => {
    setSetting((current) => {
      const next = { ...current };
      if (value === "unknown") {
        delete next.isApplicableWorkplace;
      } else {
        next.isApplicableWorkplace = value === "applicable";
      }
      return next;
    });
  };
  const applySpouseWorkstyleToCompareTargets = () => {
    if (!spouse || compareTargetScenarios.length === 0) return;
    const targetIds = new Set(compareTargetScenarios.map((item) => item.id));
    const targetNames = compareTargetScenarios.map((item) => item.name);
    const sourceSettings = spouse.workplaceSocialInsurance ? structuredClone(spouse.workplaceSocialInsurance) : undefined;
    updateScenarios((target) => {
      if (!targetIds.has(target.id)) return target;
      const targetSpouse = target.householdMembers.find((member) => member.relationship === "spouse");
      if (!targetSpouse) return target;
      targetSpouse.workplaceSocialInsurance = sourceSettings ? structuredClone(sourceSettings) : undefined;
      return target;
    }, "配偶者社保設定反映前");
    setSyncMessage(`${targetNames.length}件の比較対象へ配偶者社保設定を反映しました: ${formatScenarioNamesForMessage(targetNames)}。`);
  };

  return (
    <div
      id="spouse-workstyle-tax-social-card"
      className={cn(
        "rounded-lg border bg-white px-4 py-4 space-y-4 transition-shadow",
        isHighlighted ? "border-sky-300 ring-2 ring-sky-200 ring-offset-2" : "",
      )}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-medium">配偶者の働き方・社保判定</h3>
          <p className="text-sm text-muted-foreground">
            年収130万円だけでは判定しません。国保世帯か、勤務先社保の加入要件を満たすかで変わります。
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            妻のパート収入そのものは収入タブで入力します。このカードは、勤務先社保に入るか、配偶者控除・国保・国民年金の判定がどう変わるかを確認するための条件入力です。
            年収別の損得は、比較タブの「配偶者パート収入の実質手残り比較」で確認します。
          </p>
        </div>
        <div className="space-y-2">
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              settings.isApplicableWorkplace === undefined
                ? "bg-amber-50 text-amber-900"
                : judgment.covered
                  ? "bg-sky-50 text-sky-900"
                  : "bg-slate-50 text-slate-700",
            )}
          >
            {statusLabel}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onOpenSpouseIncomeEvents}>
              妻の収入イベントを開く
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onOpenSpousePartIncomeCompare}>
              比較で手残りを見る
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={!spouse || compareTargetScenarios.length === 0} onClick={applySpouseWorkstyleToCompareTargets}>
              この配偶者社保設定を比較対象へ反映
            </Button>
          </div>
          {syncMessage && <p className="text-xs leading-5 text-teal-700">{syncMessage}</p>}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        {spouseWorkstyleBoundaries.map((item) => (
          <div key={item.amount} className="rounded-md border bg-slate-50 px-3 py-2 text-sm">
            <div className="font-semibold text-slate-900">{item.label}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.note}</p>
          </div>
        ))}
      </div>

      {spouse ? (
        <FormGrid>
          <Field label="勤務先社保 加入開始年月">
            <Input
              type="month"
              value={settings.joinStartYearMonth ?? ""}
              onChange={(event) => setSetting((current) => ({ ...current, joinStartYearMonth: event.target.value || undefined }))}
            />
          </Field>
          <Field label="週所定労働時間">
            <Input type="number" value={settings.weeklyScheduledHours ?? ""} onChange={(event) => updateNumber("weeklyScheduledHours", event.target.value)} />
          </Field>
          <Field label="月所定労働日数">
            <Input type="number" value={settings.monthlyScheduledDays ?? ""} onChange={(event) => updateNumber("monthlyScheduledDays", event.target.value)} />
          </Field>
          <Field label="通常労働者 週時間">
            <Input
              type="number"
              value={settings.regularWorkerWeeklyHours ?? 40}
              onChange={(event) => updateNumber("regularWorkerWeeklyHours", event.target.value)}
            />
          </Field>
          <Field label="通常労働者 月日数">
            <Input
              type="number"
              value={settings.regularWorkerMonthlyDays ?? 20}
              onChange={(event) => updateNumber("regularWorkerMonthlyDays", event.target.value)}
            />
          </Field>
          <Field label="所定内賃金 月額">
            <Input type="number" value={settings.monthlyStandardWage ?? ""} onChange={(event) => updateNumber("monthlyStandardWage", event.target.value)} />
          </Field>
          <Field label="厚生年金被保険者数">
            <Input type="number" value={settings.workplaceEmployeeCount ?? ""} onChange={(event) => updateNumber("workplaceEmployeeCount", event.target.value)} />
          </Field>
          <Field label="勤務先保険料 月額（手入力時）">
            <Input type="number" value={settings.manualPremiumMonthly ?? ""} onChange={(event) => updateNumber("manualPremiumMonthly", event.target.value)} />
          </Field>
          <Field label="勤務先は社会保険の適用事業所ですか">
            <Select value={applicabilityValue} onChange={(event) => updateApplicability(event.target.value as WorkplaceApplicabilityValue)}>
              <option value="unknown">未確認</option>
              <option value="notApplicable">適用事業所ではない</option>
              <option value="applicable">適用事業所である</option>
            </Select>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              勤務先が社会保険の適用事業所ではない場合は「適用事業所ではない」を選びます。未確認のままだと、比較表では要確認として表示します。
            </p>
          </Field>
          <Field label="任意特定適用事業所">
            <label className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={settings.isVoluntarySpecifiedWorkplace ?? false}
                onChange={(event) => updateBoolean("isVoluntarySpecifiedWorkplace", event.target.checked)}
              />
              <span>短時間労働者の企業規模要件を満たす</span>
            </label>
          </Field>
          <Field label="学生">
            <label className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
              <input type="checkbox" checked={settings.isStudent ?? false} onChange={(event) => updateBoolean("isStudent", event.target.checked)} />
              <span>学生として扱う</span>
            </label>
          </Field>
          <Field label="保険料方式">
            <Select
              value={settings.premiumMode ?? "estimate"}
              onChange={(event) =>
                setSetting((current) => ({
                  ...current,
                  premiumMode: event.target.value as WorkplaceSocialInsuranceSettings["premiumMode"],
                }))
              }
            >
              <option value="estimate">概算</option>
              <option value="manual">手入力</option>
              <option value="detail">詳細</option>
            </Select>
          </Field>
        </FormGrid>
      ) : (
        <p className="text-sm text-muted-foreground">配偶者を基本情報に追加すると、勤務先社保の加入判定を入力できます。</p>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        4分の3基準は週時間と月日数の両方で判定します。短時間労働者は、2026年は厚生年金被保険者51人以上または任意特定適用事業所、週20時間以上、学生でないこと、
        2026年9月までは月額賃金8.8万円以上を確認します。
      </p>
    </div>
  );
}

function TaxSection({
  scenario,
  scenarios,
  updateScenario,
  updateScenarios,
  targetCardId,
  onOpenTaxCashPaymentTiming,
  onOpenSpouseIncomeEvents,
  onOpenSpousePartIncomeCompare,
  spouseWorkstyleHighlightKey,
}: SectionProps & {
  scenarios: ScenarioData[];
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData, backupLabel?: string) => void;
  onOpenTaxCashPaymentTiming: () => void;
  onOpenSpouseIncomeEvents: () => void;
  onOpenSpousePartIncomeCompare: () => void;
  spouseWorkstyleHighlightKey: number;
}) {
  const [taxSocialPaymentSyncTargetMode, setTaxSocialPaymentSyncTargetMode] = useState<AssetSyncTargetMode>("compare");
  const [taxSocialPaymentSyncSelectedTargetIds, setTaxSocialPaymentSyncSelectedTargetIds] = useState<string[]>([]);
  const [taxSocialPaymentSyncSourceScenarioId, setTaxSocialPaymentSyncSourceScenarioId] = useState(scenario.id);
  const [excludeCurrentScenarioFromTaxSocialPaymentSync, setExcludeCurrentScenarioFromTaxSocialPaymentSync] = useState(true);
  const [taxSocialPaymentSyncOptions, setTaxSocialPaymentSyncOptions] = useState<TaxSocialPaymentSyncOptions>({
    taxSocialPaymentSchedule: true,
    recurringTaxSocialPaymentTemplates: true,
  });
  const [taxSocialPaymentSyncMessage, setTaxSocialPaymentSyncMessage] = useState<string | null>(null);
  const mode = scenario.householdProfile.taxCalculationMode;
  const simulationResult = useMemo(() => simulateScenario(scenario), [scenario]);
  const autoDetails = useMemo(() => calculateAutoTaxDetails(scenario), [scenario]);
  const autoRows = useMemo(() => calculateAutoTaxRows(scenario), [scenario]);
  const effectiveRows = useMemo(() => getEffectiveTaxRows(scenario), [scenario]);
  const retirementFilingAdvice = useMemo(() => getRetirementFilingAdvice(scenario), [scenario]);
  const taxFilingAdvice = useMemo(() => getTaxFilingAdvice(autoDetails), [autoDetails]);
  const capitalGainsTaxByFiscalYear = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of simulationResult.monthly) {
      const summaryYear = getTaxSummaryYear(row.yearMonth);
      map.set(summaryYear, (map.get(summaryYear) ?? 0) + row.capitalGainsTaxTotal);
    }
    return map;
  }, [simulationResult]);
  const isManual = mode === "manual";
  const isAuto = mode === "auto";
  const retirementOverlapWarnings = useMemo(() => getRetirementOverlapWarnings(scenario), [scenario]);
  const retirementOverlapAdjustments = useMemo(() => getRetirementOverlapAdjustments(scenario), [scenario]);
  const retirementOverlapFingerprint = useMemo(
    () => buildRetirementOverlapReviewFingerprint(scenario, retirementOverlapAdjustments),
    [scenario, retirementOverlapAdjustments],
  );
  const retirementOverlapReviewed =
    retirementOverlapAdjustments.length > 0 && isReviewAcknowledged(scenario, "tax-retirement-overlap", retirementOverlapFingerprint);
  const premiseRows = isManual ? scenario.taxInsurance : mode === "autoWithAdjustment" ? effectiveRows : autoRows;
  const premiseYears = premiseRows.map((row) => row.fiscalYear).filter((year) => Number.isFinite(year));
  const premiseYearLabel =
    premiseYears.length === 0
      ? "未作成"
      : Math.min(...premiseYears) === Math.max(...premiseYears)
        ? `${Math.min(...premiseYears)}年度`
        : `${Math.min(...premiseYears)}〜${Math.max(...premiseYears)}年度`;
  const premiseSummaryRows = premiseRows.map((row) => {
    const capitalGainsTaxAnnual = capitalGainsTaxByFiscalYear.get(row.fiscalYear) ?? 0;
    const nationalPensionAnnual = row.nationalPensionAnnual ?? row.nationalPensionMonthly * 12;
    const taxTotal =
      row.residentTaxAnnual +
      row.incomeTaxAnnual +
      row.nationalHealthInsuranceAnnual +
      (row.lateElderlyMedicalAnnual ?? 0) +
      nationalPensionAnnual +
      row.nursingCareAnnual +
      capitalGainsTaxAnnual +
      row.otherPublicCostAnnual;
    return { row, capitalGainsTaxAnnual, nationalPensionAnnual, taxTotal };
  });
  const totalPremiseTax = premiseSummaryRows.reduce((sum, row) => sum + row.taxTotal, 0);
  const averagePremiseTax = premiseSummaryRows.length ? totalPremiseTax / premiseSummaryRows.length : 0;
  const peakPremiseTax = premiseSummaryRows.reduce<(typeof premiseSummaryRows)[number] | undefined>(
    (peak, row) => (row.taxTotal > (peak?.taxTotal ?? -1) ? row : peak),
    undefined,
  );
  const peakPaymentYear = simulationResult.annual.reduce<AnnualResult | undefined>((peak, row) => {
    const rowTax = row.taxInsuranceTotal + row.capitalGainsTaxTotal + row.idecoWithholdingTaxTotal;
    const peakTax = peak ? peak.taxInsuranceTotal + peak.capitalGainsTaxTotal + peak.idecoWithholdingTaxTotal : -1;
    return rowTax > peakTax ? row : peak;
  }, undefined);
  const nextPaymentRows = simulationResult.annual.slice(0, 5).map((row) => ({
    year: row.year,
    ageYears: row.ageYears,
    taxTotal: row.taxInsuranceTotal + row.capitalGainsTaxTotal + row.idecoWithholdingTaxTotal,
    incomeTaxSettlement: row.taxCashBreakdown.incomeTaxSettlement,
    residentTax: row.taxCashBreakdown.residentTax,
    nationalHealthInsurance: row.taxCashBreakdown.nationalHealthInsurance,
    lateElderlyMedical: row.taxCashBreakdown.lateElderlyMedical,
    nationalPension: row.taxCashBreakdown.nationalPension,
    nursingCare: row.taxCashBreakdown.nursingCare,
    capitalGainsTax: row.capitalGainsTaxTotal + row.taxCashBreakdown.deferredCapitalGainsTax,
  }));
  const ordinaryOptionIncomeEventCount = scenario.incomeEvents.filter(
    (event) =>
      event.sourceAssetKey === "ordinaryAccountForOptions" &&
      (event.type === "investmentIncome" || event.type === "dividend" || event.type === "other"),
  ).length;
  const retainedOrdinaryOptionIncomeEventCount = scenario.incomeEvents.filter(
    (event) =>
      event.sourceAssetKey === "ordinaryAccountForOptions" &&
      (event.type === "investmentIncome" || event.type === "dividend" || event.type === "other") &&
      event.sourceAssetPayoutMode === "retainInSourceAsset",
  ).length;
  const taxSocialPaymentSyncSourceScenario = scenarios.find((item) => item.id === taxSocialPaymentSyncSourceScenarioId) ?? scenario;
  const taxSocialPaymentSyncSourceIsCurrentScenario = taxSocialPaymentSyncSourceScenario.id === scenario.id;
  const taxSocialPaymentSyncExcludedScenarioIds = useMemo(() => {
    const excludedIds = new Set<string>();
    if (excludeCurrentScenarioFromTaxSocialPaymentSync && !taxSocialPaymentSyncSourceIsCurrentScenario) excludedIds.add(scenario.id);
    return excludedIds;
  }, [excludeCurrentScenarioFromTaxSocialPaymentSync, scenario.id, taxSocialPaymentSyncSourceIsCurrentScenario]);
  useEffect(() => {
    if (!scenarios.some((item) => item.id === taxSocialPaymentSyncSourceScenarioId)) {
      setTaxSocialPaymentSyncSourceScenarioId(scenario.id);
    }
  }, [scenario.id, scenarios, taxSocialPaymentSyncSourceScenarioId]);
  const taxSocialPaymentSyncSelectedTargetIdSet = useMemo(
    () => new Set(taxSocialPaymentSyncSelectedTargetIds),
    [taxSocialPaymentSyncSelectedTargetIds],
  );
  const taxSocialPaymentSyncTargetCount = countAssetSyncTargets(
    scenarios,
    taxSocialPaymentSyncSourceScenario.id,
    taxSocialPaymentSyncTargetMode,
    taxSocialPaymentSyncExcludedScenarioIds,
    taxSocialPaymentSyncSelectedTargetIdSet,
  );
  const taxSocialPaymentSyncTargetNames = getAssetSyncTargets(
    scenarios,
    taxSocialPaymentSyncSourceScenario.id,
    taxSocialPaymentSyncTargetMode,
    taxSocialPaymentSyncExcludedScenarioIds,
    taxSocialPaymentSyncSelectedTargetIdSet,
  ).map((item) => item.name);
  const hasTaxSocialPaymentSyncSelection = Object.values(taxSocialPaymentSyncOptions).some(Boolean);
  const taxSocialPaymentScheduleCount = taxSocialPaymentSyncSourceScenario.taxSocialPaymentSchedule?.length ?? 0;
  const recurringTaxSocialPaymentTemplateCount = taxSocialPaymentSyncSourceScenario.recurringTaxSocialPaymentTemplates?.length ?? 0;
  const updateTaxSocialPaymentSyncOption = (key: keyof TaxSocialPaymentSyncOptions) => {
    setTaxSocialPaymentSyncOptions((current) => ({ ...current, [key]: !current[key] }));
  };
  const toggleTaxSocialPaymentSyncTarget = (scenarioId: string) => {
    setTaxSocialPaymentSyncSelectedTargetIds((current) =>
      current.includes(scenarioId) ? current.filter((id) => id !== scenarioId) : [...current, scenarioId],
    );
  };
  const selectedTaxSocialPaymentSyncLabels = [
    taxSocialPaymentSyncOptions.taxSocialPaymentSchedule ? `通知書実額支払 ${taxSocialPaymentScheduleCount}件` : "",
    taxSocialPaymentSyncOptions.recurringTaxSocialPaymentTemplates
      ? `固定資産税などの継続支払見込み ${recurringTaxSocialPaymentTemplateCount}件`
      : "",
  ].filter(Boolean);
  const applyTaxSocialPaymentSync = () => {
    if (taxSocialPaymentSyncTargetCount === 0 || !hasTaxSocialPaymentSyncSelection) return;
    const source = structuredClone(taxSocialPaymentSyncSourceScenario);
    const confirmed = window.confirm(
      `コピー元「${source.name}」の税・社会保険通知書実額支払を、コピー元自身を除く ${taxSocialPaymentSyncTargetCount} 件のシナリオへ反映します。` +
        (!taxSocialPaymentSyncSourceIsCurrentScenario && excludeCurrentScenarioFromTaxSocialPaymentSync
          ? `\n現在開いている「${scenario.name}」は反映先から外します。`
          : "") +
        `\n\n反映するもの:\n${formatScenarioNamesForConfirm(selectedTaxSocialPaymentSyncLabels)}` +
        "\n\n反映しないもの:\n・収入\n・生活費\n・初期資産\n・iDeCo受取\n・退職所得イベント\n・制度上の自動概算" +
        `\n\n反映先:\n${formatScenarioNamesForConfirm(taxSocialPaymentSyncTargetNames)}\n\n実行しますか？`,
    );
    if (!confirmed) return;
    updateScenarios((target) => {
      if (
        !isAssetSyncTarget(
          target,
          source.id,
          taxSocialPaymentSyncTargetMode,
          taxSocialPaymentSyncExcludedScenarioIds,
          taxSocialPaymentSyncSelectedTargetIdSet,
        )
      ) {
        return target;
      }
      applyTaxSocialPaymentSyncFromSource(target, source, taxSocialPaymentSyncOptions);
      return target;
    }, "税・社会保険通知書実額反映前");
    setTaxSocialPaymentSyncMessage(
      `${taxSocialPaymentSyncTargetCount} 件のシナリオへ税・社会保険通知書実額支払を反映しました: ${formatScenarioNamesForMessage(taxSocialPaymentSyncTargetNames)}。` +
        `通知書実額支払 ${taxSocialPaymentScheduleCount}件、固定資産税などの継続支払見込み ${recurringTaxSocialPaymentTemplateCount}件をコピーしました。` +
        "実行前の状態は履歴に保存されています。",
    );
  };

  const add = () =>
    updateScenario((s) =>
      s.taxInsurance.push({
        id: createId(),
        fiscalYear: new Date().getFullYear(),
        residentTaxAnnual: 0,
        incomeTaxAnnual: 0,
        nationalHealthInsuranceAnnual: 0,
        lateElderlyMedicalAnnual: 0,
        nationalPensionMonthly: 0,
        nursingCareAnnual: 0,
        otherPublicCostAnnual: 0,
        }),
    );

  const copyLatest = () =>
    updateScenario((s) => {
      const latest = [...s.taxInsurance].sort((a, b) => a.fiscalYear - b.fiscalYear).at(-1);
      if (!latest) {
        s.taxInsurance.push({
          id: createId(),
          fiscalYear: new Date().getFullYear(),
          residentTaxAnnual: 0,
          incomeTaxAnnual: 0,
          nationalHealthInsuranceAnnual: 0,
          lateElderlyMedicalAnnual: 0,
          nationalPensionMonthly: 0,
          nursingCareAnnual: 0,
          otherPublicCostAnnual: 0,
        });
        return;
      }
      s.taxInsurance.push({
        ...structuredClone(latest),
        id: createId(),
        fiscalYear: latest.fiscalYear + 1,
      });
      s.taxInsurance.sort((a, b) => a.fiscalYear - b.fiscalYear);
      });

  const adjustmentLabel = isManual ? "空欄追加" : "補正追加";
  const copyLabel = isManual ? "前年度コピー" : "前年度補正コピー";
  const acknowledgeRetirementOverlapReview = () =>
    updateScenario((s) => {
      const nextAdjustments = getRetirementOverlapAdjustments(s);
      if (nextAdjustments.length === 0) return;
      acknowledgeReviewCard(s, "tax-retirement-overlap", buildRetirementOverlapReviewFingerprint(s, nextAdjustments));
    });

  return (
    <Card id="tax-mode" data-input-card-id="tax-mode">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>税・社会保険入力</CardTitle>
            <CardDescription>{taxModeHelp[mode].description}</CardDescription>
          </div>
          {!isAuto && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={copyLatest}>
                <Copy className="h-4 w-4" />
                {copyLabel}
              </Button>
              <Button onClick={add}>
                <Plus className="h-4 w-4" />
                {adjustmentLabel}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <TaxPublicSummary
          mode={mode}
          premiseYearLabel={premiseYearLabel}
          totalPremiseTax={totalPremiseTax}
          averagePremiseTax={averagePremiseTax}
          peakPremiseTax={peakPremiseTax}
          peakPaymentYear={peakPaymentYear}
          nextPaymentRows={nextPaymentRows}
          autoDetailCount={autoDetails.length}
        />
        <div className="grid gap-3 text-sm leading-6 md:grid-cols-3">
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="font-medium">このタブで見ること</div>
            <p className="mt-1 text-muted-foreground">税・社会保険の入力、補正、自動計算の根拠を確認します。</p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="font-medium">通常見るところ</div>
            <p className="mt-1 text-muted-foreground">モード説明、通知書実額、制度上の自動概算、反映後の税・社会保険を確認します。</p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="font-medium">詳細確認</div>
            <p className="mt-1 text-muted-foreground">控除、退職所得、負担率、計算式の分解は必要な時だけ開きます。</p>
          </div>
        </div>
        <div className="grid gap-3 text-sm leading-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="text-muted-foreground">計算モード</div>
            <div className="mt-1 font-semibold text-slate-900">{taxModeHelp[mode].label}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === "manual" ? "入力年度の金額をそのまま使用" : mode === "auto" ? "制度上の自動概算を使用" : "自動概算 + 補正額を使用"}
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="text-muted-foreground">年度ラベル</div>
            <div className="mt-1 font-semibold text-slate-900">{premiseYearLabel}</div>
            <p className="mt-1 text-xs text-muted-foreground">表の年度は所得発生年度です。住民税・国保などの現金支払は主に翌年側へ出ます。</p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="text-muted-foreground">料率・制度前提</div>
            <div className="mt-1 font-semibold text-slate-900">概算テーブル</div>
            <p className="mt-1 text-xs text-muted-foreground">所得税・住民税の概算、国保は大田区、後期高齢者医療は東京都の概算ルールです。</p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="text-muted-foreground">申告対象の運用利益</div>
            <div className="mt-1 font-semibold text-slate-900">
              {ordinaryOptionIncomeEventCount === 0 ? "対象イベントなし" : `${ordinaryOptionIncomeEventCount}件`}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              口座内積上げでも、申告対象損益は翌年の所得税・住民税・国保などの所得に入ります。
              {retainedOrdinaryOptionIncomeEventCount > 0 && ` 口座内積上げ設定は${retainedOrdinaryOptionIncomeEventCount}件です。`}
            </p>
          </div>
        </div>
        <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
          {mode === "manual" && (
            <p>このモードでは、ここで入力した年度金額だけを使います。生活費タブの `税・社会保険` は 0 円にしてください。</p>
          )}
          {mode === "auto" && (
            <p>このモードでは、世帯情報と収入から概算します。自動計算の収入集計は暦年ベースです。生活費タブの `税・社会保険` は自動で計算対象から外します。</p>
          )}
          {mode === "autoWithAdjustment" && (
            <p>
              このモードでは、自動計算をベースにここで差額だけ補正します。たとえば通知書との差分だけ入れてください。生活費タブの `税・社会保険`
              は自動で計算対象から外します。収入集計は暦年ベースです。
            </p>
          )}
          <p className="mt-2">
            課税口座の取り崩しでは、譲渡益部分に 20.315% の課税を掛けて差し引きます。NISA には掛けません。
          </p>
          <p className="mt-2">
            反復計算が収束しない年度が出た場合は、このタブの詳細根拠で警告として扱います。現時点の制度上の自動概算には未収束警告はありません。
          </p>
        </div>

        <NoticeActualTaxSocialPaymentCard
          scenario={scenario}
          updateScenario={updateScenario}
          effectiveRows={effectiveRows}
          simulationResult={simulationResult}
          onOpenTaxCashPaymentTiming={onOpenTaxCashPaymentTiming}
        />

        <SpouseWorkstyleTaxSocialCard
          scenario={scenario}
          scenarios={scenarios}
          updateScenario={updateScenario}
          updateScenarios={updateScenarios}
          highlightKey={spouseWorkstyleHighlightKey}
          onOpenSpouseIncomeEvents={onOpenSpouseIncomeEvents}
          onOpenSpousePartIncomeCompare={onOpenSpousePartIncomeCompare}
        />

        <ScenarioSyncDetails
          title="他シナリオへ反映（必要時のみ）"
          description="通知書実額支払と固定資産税などの継続前提を、他のシナリオへ反映します。収入・生活費・iDeCo受取・退職所得イベントは変更しません。"
        >
          <div className="space-y-4">
            <Field label="コピー元シナリオ">
              <Select
                value={taxSocialPaymentSyncSourceScenario.id}
                onChange={(event) => setTaxSocialPaymentSyncSourceScenarioId(event.target.value)}
              >
                {scenarios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                現在のコピー元は「{taxSocialPaymentSyncSourceScenario.name}」です。通知書実額支払と継続支払見込みだけを反映します。
              </p>
            </Field>
            {!taxSocialPaymentSyncSourceIsCurrentScenario && (
              <label className="flex items-start gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={excludeCurrentScenarioFromTaxSocialPaymentSync}
                  onChange={(event) => setExcludeCurrentScenarioFromTaxSocialPaymentSync(event.target.checked)}
                />
                <span>
                  <span className="block font-medium">表示中シナリオを反映先から外す</span>
                  <span className="text-xs text-muted-foreground">
                    「{scenario.name}」を見ながら別シナリオをコピー元にする場合の誤反映を防ぎます。意図して現在のシナリオにも反映する場合だけ外してください。
                  </span>
                </span>
              </label>
            )}
            <ScenarioSyncCard<keyof TaxSocialPaymentSyncOptions>
              title="税・社会保険通知書実額支払の反映"
              description="コピー元シナリオを選び、通知書実額支払と固定資産税などの継続前提だけを他シナリオへ反映します。"
              targetMode={taxSocialPaymentSyncTargetMode}
              setTargetMode={setTaxSocialPaymentSyncTargetMode}
              targetCount={taxSocialPaymentSyncTargetCount}
              targetNames={taxSocialPaymentSyncTargetNames}
              targetSummary={
                `コピー元「${taxSocialPaymentSyncSourceScenario.name}」自身を除く ${taxSocialPaymentSyncTargetCount} 件に反映します。` +
                (!taxSocialPaymentSyncSourceIsCurrentScenario && excludeCurrentScenarioFromTaxSocialPaymentSync ? `「${scenario.name}」は除外中です。` : "")
              }
              allScenarios={scenarios}
              sourceScenarioId={taxSocialPaymentSyncSourceScenario.id}
              excludedScenarioIds={taxSocialPaymentSyncExcludedScenarioIds}
              selectedTargetIds={taxSocialPaymentSyncSelectedTargetIdSet}
              toggleSelectedTarget={toggleTaxSocialPaymentSyncTarget}
              options={[
                {
                  key: "taxSocialPaymentSchedule",
                  label: "通知書実額支払",
                  description: `${taxSocialPaymentScheduleCount}件。反映先の既存データはコピー元で置き換えます。`,
                },
                {
                  key: "recurringTaxSocialPaymentTemplates",
                  label: "固定資産税などの継続支払見込み",
                  description: `${recurringTaxSocialPaymentTemplateCount}件。将来の継続前提をコピーします。`,
                },
              ]}
              selectedOptions={taxSocialPaymentSyncOptions}
              toggleOption={updateTaxSocialPaymentSyncOption}
              warningText="反映先の既存の通知書実額支払と継続支払見込みは、コピー元の内容で置き換わります。収入・生活費・初期資産・iDeCo受取・退職所得イベント・制度上の自動概算は変更しません。"
              onApply={applyTaxSocialPaymentSync}
              message={taxSocialPaymentSyncMessage}
              applyDisabled={!hasTaxSocialPaymentSyncSelection}
              optionGridClassName="grid gap-2 md:grid-cols-2"
            />
          </div>
        </ScenarioSyncDetails>

        <GuidedDetails
          id="tax-retirement-overlap"
          title="詳細入力・専門補正"
          description="退職所得、所得控除、補正額は必要な時だけ開きます。退職所得控除の重複調整もここで確認します。"
          summary={retirementOverlapAdjustments.length > 0 ? `退職所得控除の重複調整 ${retirementOverlapAdjustments.length}件` : "退職所得・控除・補正の専門入力"}
          priority="expert"
          targetCardId={targetCardId}
        >
        <div className="space-y-5">
          <RetirementIncomeSection scenario={scenario} updateScenario={updateScenario} />
          <TaxDeductionSection scenario={scenario} updateScenario={updateScenario} />
          <div className="rounded-lg border bg-white px-4 py-3 space-y-3">
            <div>
              <h3 className="font-medium">退職所得の重複ルール確認</h3>
              <p className="text-sm text-muted-foreground">iDeCo一時金と退職金の受取間隔、同一年合算、既受給履歴を確認します。</p>
            </div>
            {retirementOverlapWarnings.length === 0 ? (
              <p className="text-sm text-muted-foreground">現時点で重複ルールの警告はありません。</p>
            ) : (
              <div className="space-y-2">
                {retirementOverlapWarnings.map((warning) => (
                  <div
                    key={warning.id}
                    className={
                      warning.severity === "warning"
                        ? "rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                        : "rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                    }
                  >
                    <div className="font-medium">{warning.memberName}</div>
                    <div>{warning.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-white px-4 py-3 space-y-3">
            <div>
              <h3 className="font-medium">退職所得控除の重複調整概算</h3>
              <p className="text-sm text-muted-foreground">
                重複ルールに該当するイベントについて、勤続/加入期間の重複分を概算します。収入イベントとして登録したiDeCo一時金は、この調整後控除を税額計算に使います。
              </p>
            </div>
            {retirementOverlapAdjustments.length > 0 && (
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-md border px-4 py-3 text-sm md:flex-row md:items-center md:justify-between",
                  retirementOverlapReviewed ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950",
                )}
              >
                <div>
                  <div className="font-medium">{retirementOverlapReviewed ? "この内容は確認済みです" : "この内容は未確認です"}</div>
                  <p className="mt-1 leading-6">
                    内容を確認済みにすると、入力状況サマリーでは未確認扱いから外れます。金額や日付を変更すると再確認が必要になります。
                  </p>
                </div>
                <Button
                  type="button"
                  variant={retirementOverlapReviewed ? "outline" : "default"}
                  onClick={acknowledgeRetirementOverlapReview}
                  disabled={retirementOverlapReviewed}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {retirementOverlapReviewed ? "確認済み" : "この内容を確認済みにする"}
                </Button>
              </div>
            )}
            {retirementOverlapAdjustments.length === 0 ? (
              <p className="text-sm text-muted-foreground">概算調整が必要な退職所得イベントはありません。</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <thead>
                    <Tr>
                      <Th>対象</Th>
                      <Th>過去イベント</Th>
                      <Th>重複年数</Th>
                      <Th>調整前控除</Th>
                      <Th>重複控除概算</Th>
                      <Th>調整後控除</Th>
                      <Th>退職所得 概算前</Th>
                      <Th>退職所得 概算後</Th>
                      <Th>根拠</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {retirementOverlapAdjustments.map((item) => (
                      <Tr key={item.id}>
                        <Td>
                          <div className="font-medium">{item.currentEventName}</div>
                          <div className="text-xs text-muted-foreground">{item.currentPaymentYearMonth}</div>
                        </Td>
                        <Td>
                          <div>{item.priorEventName}</div>
                          <div className="text-xs text-muted-foreground">{item.priorPaymentYearMonth}</div>
                        </Td>
                        <Td>{item.estimatedOverlapYears}年</Td>
                        <Td>{yen(item.baseDeduction)}</Td>
                        <Td>{yen(item.estimatedOverlapDeduction)}</Td>
                        <Td>{yen(item.adjustedDeduction)}</Td>
                        <Td>{yen(item.estimatedIncomeBeforeAdjustment)}</Td>
                        <Td>{yen(item.estimatedIncomeAfterAdjustment)}</Td>
                        <Td className="min-w-[18rem] text-sm text-muted-foreground">
                          {item.precision === "dateBased" ? "期間入力ベース" : "年数ベース"}。{item.note}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-white px-4 py-3 space-y-3">
            <div>
              <h3 className="font-medium">退職所得の申告確認メモ</h3>
              <p className="text-sm text-muted-foreground">
                源泉徴収税額・住民税内訳・重複ルールを、申告や実績照合の確認材料として整理します。税額本体の判定ではありません。
              </p>
            </div>
            {retirementFilingAdvice.length === 0 ? (
              <p className="text-sm text-muted-foreground">退職所得の確認対象はまだありません。</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {retirementFilingAdvice.map((item) => (
                  <div
                    key={item.id}
                    className={
                      item.status === "attention"
                        ? "rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950"
                        : item.status === "review"
                          ? "rounded-md border border-sky-300 bg-sky-50 px-3 py-3 text-sm text-sky-950"
                          : "rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700"
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{item.memberName}</div>
                        <div className="text-xs opacity-75">
                          {item.paymentYearMonth} / {item.eventName}
                        </div>
                      </div>
                      <div className="text-xs font-medium">
                        {item.status === "attention" ? "実績あり" : item.status === "review" ? "要確認" : "参考"}
                      </div>
                    </div>
                    <div className="mt-2">{item.message}</div>
                    <div className="mt-2 text-xs opacity-80">
                      税額記録: {yen(item.taxPaidTotal)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </GuidedDetails>

        {(isAuto || mode === "autoWithAdjustment") && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">制度上の自動概算（所得発生年度ベース）</h3>
              <p className="text-sm text-muted-foreground">
                この表は所得が発生した年度ごとの制度概算です。通知書・実額支払はここには混ぜず、実際の現金支出は通知書カードと結果タブの「税金・社会保険のキャッシュ支払タイミング」に反映します。
              </p>
            </div>
            <TaxRowsSummary rows={autoRows} capitalGainsTaxByFiscalYear={capitalGainsTaxByFiscalYear} emptyLabel="自動計算できる年度がまだありません。" />
            <RealizedGainDetailsSummary details={simulationResult.monthly.flatMap((row) => row.realizedGainDetails)} />
            <TaxFilingAdviceSummary advice={taxFilingAdvice} />
            <TaxCashTimingSummary details={autoDetails} annualRows={simulationResult.annual} />
            <ScenarioSyncDetails
              title="税・社会保険の詳細根拠"
              description="後期高齢者の負担率、計算式の分解、所得水準別の負担率を確認します。"
            >
              <LateElderlyBurdenRatioTable details={autoDetails} />
              <TaxCalculationDetails details={autoDetails} retirementOverlapAdjustments={retirementOverlapAdjustments} />
              <TaxSocialSensitivityTable scenario={scenario} details={autoDetails} />
            </ScenarioSyncDetails>
          </div>
        )}

        {mode === "autoWithAdjustment" && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">手入力の補正額</h3>
              <p className="text-sm text-muted-foreground">
                各年度の差額だけ入れてください。未入力年度は 0 として扱います。
              </p>
            </div>
            {scenario.taxInsurance.length === 0 && <p className="text-sm text-muted-foreground">補正はまだありません。</p>}
            {scenario.taxInsurance.map((row, index) => (
              <EventEditor key={row.id} title={`${row.fiscalYear}年度の補正`} onDelete={() => updateScenario((s) => void s.taxInsurance.splice(index, 1))}>
                <FormGrid>
                  {taxFields.map(([key, label]) => (
                    <Field key={key} label={label}>
                      <Input
                        type="number"
                        value={row[key] ?? 0}
                        onChange={(e) => updateScenario((s) => void (s.taxInsurance[index][key] = numberOrZero(e.target.value)))}
                      />
                    </Field>
                  ))}
                </FormGrid>
              </EventEditor>
            ))}
            <div>
              <h3 className="font-medium">反映後の税・社会保険</h3>
              <p className="text-sm text-muted-foreground">自動計算と補正を合算した、シミュレーションに使う最終値です。</p>
            </div>
            <TaxRowsSummary rows={effectiveRows} capitalGainsTaxByFiscalYear={capitalGainsTaxByFiscalYear} emptyLabel="反映後の年度データはまだありません。" />
            <TaxFilingAdviceSummary advice={taxFilingAdvice} />
            <TaxCashTimingSummary details={autoDetails} annualRows={simulationResult.annual} />
            <ScenarioSyncDetails
              title="税・社会保険の詳細根拠"
              description="後期高齢者の負担率、計算式の分解、所得水準別の負担率を確認します。"
            >
              <LateElderlyBurdenRatioTable details={autoDetails} />
              <TaxCalculationDetails details={autoDetails} retirementOverlapAdjustments={retirementOverlapAdjustments} />
              <TaxSocialSensitivityTable scenario={scenario} details={autoDetails} />
            </ScenarioSyncDetails>
          </div>
        )}

        {isManual && (
          <>
            <p className="text-sm text-muted-foreground">
              入力済みの直近年度を以後の年度にも引き継ぎます。変わる年度だけ追加してください。
            </p>
            {scenario.taxInsurance.map((row, index) => (
              <EventEditor key={row.id} title={`${row.fiscalYear}年度`} onDelete={() => updateScenario((s) => void s.taxInsurance.splice(index, 1))}>
                <FormGrid>
                  {taxFields.map(([key, label]) => (
                    <Field key={key} label={label}>
                      <Input
                        type="number"
                        value={row[key] ?? 0}
                        onChange={(e) => updateScenario((s) => void (s.taxInsurance[index][key] = numberOrZero(e.target.value)))}
                      />
                    </Field>
                  ))}
                </FormGrid>
              </EventEditor>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TaxDeductionSection({ scenario, updateScenario }: SectionProps) {
  const add = () =>
    updateScenario((s) =>
      s.taxDeductionEvents.push({
        id: createId(),
        fiscalYear: new Date().getFullYear(),
        memberId: s.householdProfile.headMemberId ?? s.householdMembers[0]?.id ?? "member-self",
        socialInsuranceDeductionAnnual: 0,
        medicalExpenseDeductionAnnual: 0,
      }),
    );

  const copyLatest = () =>
    updateScenario((s) => {
      const latest = [...s.taxDeductionEvents].sort((a, b) => a.fiscalYear - b.fiscalYear).at(-1);
      if (!latest) {
        s.taxDeductionEvents.push({
          id: createId(),
          fiscalYear: new Date().getFullYear(),
          memberId: s.householdProfile.headMemberId ?? s.householdMembers[0]?.id ?? "member-self",
          socialInsuranceDeductionAnnual: 0,
          medicalExpenseDeductionAnnual: 0,
        });
        return;
      }
      s.taxDeductionEvents.push({
        ...structuredClone(latest),
        id: createId(),
        fiscalYear: latest.fiscalYear + 1,
      });
      s.taxDeductionEvents.sort((a, b) => a.fiscalYear - b.fiscalYear);
    });

  return (
    <div className="rounded-lg border bg-white px-4 py-3 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">所得控除入力</h3>
          <p className="text-sm text-muted-foreground">
            社会保険料控除と医療費控除を年度・メンバーごとに入力します。自動計算の所得税・住民税の課税ベースから差し引きます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyLatest}>
            <Copy className="h-4 w-4" />
            前年度コピー
          </Button>
          <Button onClick={add}>
            <Plus className="h-4 w-4" />
            控除追加
          </Button>
        </div>
      </div>

      {scenario.taxDeductionEvents.length === 0 && <p className="text-sm text-muted-foreground">所得控除はまだありません。</p>}
      {scenario.taxDeductionEvents.map((row, index) => (
        <EventEditor
          key={row.id}
          title={`${row.fiscalYear}年度の控除`}
          onDelete={() => updateScenario((s) => void s.taxDeductionEvents.splice(index, 1))}
        >
          <FormGrid>
            <Field label="年度">
              <Input
                type="number"
                value={row.fiscalYear}
                onChange={(e) => updateScenario((s) => void (s.taxDeductionEvents[index].fiscalYear = numberOrZero(e.target.value)))}
              />
            </Field>
            <Field label="世帯メンバー">
              <Select
                value={row.memberId}
                onChange={(e) => updateScenario((s) => void (s.taxDeductionEvents[index].memberId = e.target.value))}
              >
                {scenario.householdMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="社会保険料控除">
              <Input
                type="number"
                value={row.socialInsuranceDeductionAnnual}
                onChange={(e) =>
                  updateScenario((s) => void (s.taxDeductionEvents[index].socialInsuranceDeductionAnnual = numberOrZero(e.target.value)))
                }
              />
            </Field>
            <Field label="医療費控除">
              <Input
                type="number"
                value={row.medicalExpenseDeductionAnnual}
                onChange={(e) =>
                  updateScenario((s) => void (s.taxDeductionEvents[index].medicalExpenseDeductionAnnual = numberOrZero(e.target.value)))
                }
              />
            </Field>
          </FormGrid>
        </EventEditor>
      ))}
    </div>
  );
}

function TaxRowsSummary({
  rows,
  emptyLabel,
  capitalGainsTaxByFiscalYear,
}: {
  rows: TaxInsuranceByFiscalYear[];
  emptyLabel: string;
  capitalGainsTaxByFiscalYear?: Map<number, number>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        この表は所得が発生した年度ベースの概算です。実際に現金が出ていく年は、結果タブの「税金・社会保険のキャッシュ支払タイミング」で確認します。
        申告対象の運用利益は、売却時譲渡益税ではなく翌年の所得税・住民税・国保などに反映されます。
      </p>
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <thead>
          <Tr>
            <Th>所得発生年度</Th>
            <Th>住民税(通常+退職)</Th>
            <Th>所得税(通常+退職)</Th>
            <Th>国保</Th>
            <Th>後期高齢者医療</Th>
            <Th>国民年金(年額)</Th>
            <Th>介護</Th>
            <Th>売却時譲渡益税</Th>
            <Th>その他</Th>
            <Th>年間合計目安</Th>
          </Tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const capitalGainsTaxAnnual = capitalGainsTaxByFiscalYear?.get(row.fiscalYear) ?? 0;
            const annualTotal =
              row.residentTaxAnnual +
              row.incomeTaxAnnual +
              row.nationalHealthInsuranceAnnual +
              (row.lateElderlyMedicalAnnual ?? 0) +
              (row.nationalPensionAnnual ?? row.nationalPensionMonthly * 12) +
              row.nursingCareAnnual +
              capitalGainsTaxAnnual +
              row.otherPublicCostAnnual;
            return (
              <Tr key={row.id}>
                <Td>{row.fiscalYear}</Td>
                <Td>{yen(row.residentTaxAnnual)}</Td>
                <Td>{yen(row.incomeTaxAnnual)}</Td>
                <Td>{yen(row.nationalHealthInsuranceAnnual)}</Td>
                <Td>{yen(row.lateElderlyMedicalAnnual ?? 0)}</Td>
                <Td>{yen(row.nationalPensionAnnual ?? row.nationalPensionMonthly * 12)}</Td>
                <Td>{yen(row.nursingCareAnnual)}</Td>
                <Td>{yen(capitalGainsTaxAnnual)}</Td>
                <Td>{yen(row.otherPublicCostAnnual)}</Td>
                <Td className="font-medium">{yen(annualTotal)}</Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </div>
    </div>
  );
}

function getTaxSummaryYear(yearMonth: YearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);
  return month >= 4 ? year : year - 1;
}

type RealizedGainSummaryRow = {
  fiscalYear: number;
  accountName: string;
  assetKey: RealizedGainDetail["assetKey"];
  grossWithdrawal: number;
  costPortion: number;
  realizedGain: number;
  taxWithheld: number;
  deferredTax: number;
  declaredIncome: number;
  netCashAdded: number;
  reasons: Set<RealizedGainDetail["reason"]>;
  treatments: Set<RealizedGainDetail["taxTreatment"]>;
  details: RealizedGainDetail[];
};

const realizedGainReasonLabels: Record<RealizedGainDetail["reason"], string> = {
  deficitFunding: "不足補填売却",
  sourceAssetIncome: "予定受取",
  retainedSourceIncome: "口座内積上げ利益",
  optionSweep: "利益移動",
  optionRelease: "終了後戻し",
  plannedDrawdown: "計画取り崩し",
};

const realizedGainTreatmentLabels: Record<RealizedGainDetail["taxTreatment"], string> = {
  withheldAtSale: "売却時に控除",
  deferredToNextYear: "翌年申告扱い",
  declaredIncome: "申告対象損益",
  nonTaxable: "課税なし",
};

function summarizeRealizedGainDetails(details: RealizedGainDetail[]) {
  const map = new Map<string, RealizedGainSummaryRow>();
  for (const detail of details) {
    const key = `${detail.fiscalYear}:${detail.assetKey}:${detail.accountName}:${detail.reason}:${detail.taxTreatment}`;
    const current =
      map.get(key) ??
      ({
        fiscalYear: detail.fiscalYear,
        accountName: detail.accountName,
        assetKey: detail.assetKey,
        grossWithdrawal: 0,
        costPortion: 0,
        realizedGain: 0,
        taxWithheld: 0,
        deferredTax: 0,
        declaredIncome: 0,
        netCashAdded: 0,
        reasons: new Set<RealizedGainDetail["reason"]>(),
        treatments: new Set<RealizedGainDetail["taxTreatment"]>(),
        details: [],
      } satisfies RealizedGainSummaryRow);
    current.grossWithdrawal += detail.grossWithdrawal;
    current.costPortion += detail.costPortion;
    current.realizedGain += detail.realizedGain;
    current.taxWithheld += detail.taxWithheld;
    current.deferredTax += detail.deferredTax;
    current.declaredIncome += detail.declaredIncome;
    current.netCashAdded += detail.netCashAdded;
    current.reasons.add(detail.reason);
    current.treatments.add(detail.taxTreatment);
    current.details.push(detail);
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => a.fiscalYear - b.fiscalYear || a.accountName.localeCompare(b.accountName, "ja"));
}

function joinLabels<T extends string>(values: Iterable<T>, labels: Record<T, string>) {
  return [...values].map((value) => labels[value]).join(" / ");
}

function affectsTaxOrFiling(detail: RealizedGainDetail) {
  return detail.taxWithheld > 0 || detail.deferredTax > 0 || detail.declaredIncome > 0;
}

function isNonTaxableCashMovement(detail: RealizedGainDetail) {
  return detail.grossWithdrawal > 0 && detail.realizedGain === 0 && detail.taxWithheld === 0 && detail.deferredTax === 0 && detail.declaredIncome === 0;
}

function RealizedGainDetailsSummary({ details }: { details: RealizedGainDetail[] }) {
  const taxableDetails = useMemo(() => details.filter(affectsTaxOrFiling), [details]);
  const nonTaxableCashMovementDetails = useMemo(() => details.filter(isNonTaxableCashMovement), [details]);
  const summaryRows = useMemo(() => summarizeRealizedGainDetails(taxableDetails), [taxableDetails]);
  const totals = useMemo(
    () =>
      details.reduce(
        (sum, detail) => ({
          grossWithdrawal: sum.grossWithdrawal + detail.grossWithdrawal,
          realizedGain: sum.realizedGain + detail.realizedGain,
          taxWithheld: sum.taxWithheld + detail.taxWithheld,
          deferredTax: sum.deferredTax + detail.deferredTax,
          declaredIncome: sum.declaredIncome + detail.declaredIncome,
        }),
        { grossWithdrawal: 0, realizedGain: 0, taxWithheld: 0, deferredTax: 0, declaredIncome: 0 },
      ),
    [details],
  );

  return (
    <ScenarioSyncDetails
      title="譲渡益課税の根拠"
      description="売却時譲渡益税や一般口座オプションの申告対象損益が、どの口座・年月から出たかを確認します。"
    >
      <div className="grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-md border bg-slate-50 px-4 py-3">
          <div className="text-muted-foreground">売却時譲渡益税</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{yen(totals.taxWithheld)}</div>
          <p className="mt-1 text-xs text-muted-foreground">特定口座の売却時に、譲渡益部分から差し引く税額です。</p>
        </div>
        <div className="rounded-md border bg-slate-50 px-4 py-3">
          <div className="text-muted-foreground">一般口座オプション申告損益</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{yen(totals.declaredIncome)}</div>
          <p className="mt-1 text-xs text-muted-foreground">売却時に差し引く税額ではなく、翌年の所得税・住民税・国保などの計算に入ります。</p>
        </div>
        <div className="rounded-md border bg-slate-50 px-4 py-3">
          <div className="text-muted-foreground">源泉なし等の翌年分</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{yen(totals.deferredTax)}</div>
          <p className="mt-1 text-xs text-muted-foreground">源泉なし設定の特定口座など、売却時ではなく翌年扱いにする税額です。</p>
        </div>
      </div>
      {summaryRows.length === 0 ? (
        <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
          譲渡益課税の対象になる売却・申告対象損益はありません。NISAとiDeCoはこの表には含めません。
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <thead>
                <Tr>
                  <Th>所得発生年度</Th>
                  <Th>口座</Th>
                  <Th>売却・移動/発生額</Th>
                  <Th>取得原価部分</Th>
                  <Th>実現譲渡益</Th>
                  <Th>売却時譲渡益税</Th>
                  <Th>翌年・申告扱い</Th>
                  <Th>手取り額</Th>
                  <Th>理由</Th>
                  <Th>扱い</Th>
                </Tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => (
                  <Tr key={`${row.fiscalYear}-${row.assetKey}-${row.accountName}-${joinLabels(row.reasons, realizedGainReasonLabels)}-${joinLabels(row.treatments, realizedGainTreatmentLabels)}`}>
                    <Td>{row.fiscalYear}</Td>
                    <Td>
                      <div className="font-medium">{row.accountName}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.assetKey === "specificAccount" ? "特定口座" : "一般口座オプション"}
                      </div>
                    </Td>
                    <Td>{yen(row.grossWithdrawal)}</Td>
                    <Td>{yen(row.costPortion)}</Td>
                    <Td>{yen(row.realizedGain)}</Td>
                    <Td>{yen(row.taxWithheld)}</Td>
                    <Td>{yen(row.deferredTax + row.declaredIncome)}</Td>
                    <Td>{yen(row.netCashAdded)}</Td>
                    <Td className="min-w-[10rem]">{joinLabels(row.reasons, realizedGainReasonLabels)}</Td>
                    <Td className="min-w-[10rem]">{joinLabels(row.treatments, realizedGainTreatmentLabels)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          <details className="rounded-lg border bg-white px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-medium">月別明細を開く</summary>
            <div className="mt-3 overflow-x-auto rounded-lg border">
              <Table>
                <thead>
                  <Tr>
                    <Th>年月</Th>
                    <Th>所得発生年度</Th>
                    <Th>口座</Th>
                    <Th>売却・移動/発生額</Th>
                    <Th>取得原価部分</Th>
                    <Th>実現譲渡益</Th>
                    <Th>売却時譲渡益税</Th>
                    <Th>翌年・申告扱い</Th>
                    <Th>手取り額</Th>
                    <Th>理由</Th>
                    <Th>扱い</Th>
                  </Tr>
                </thead>
                <tbody>
                  {taxableDetails.map((detail, index) => (
                    <Tr key={`${detail.yearMonth}-${detail.accountName}-${index}`}>
                      <Td>{detail.yearMonth}</Td>
                      <Td>{detail.fiscalYear}</Td>
                      <Td>{detail.accountName}</Td>
                      <Td>{yen(detail.grossWithdrawal)}</Td>
                      <Td>{yen(detail.costPortion)}</Td>
                      <Td>{yen(detail.realizedGain)}</Td>
                      <Td>{yen(detail.taxWithheld)}</Td>
                      <Td>{yen(detail.deferredTax + detail.declaredIncome)}</Td>
                      <Td>{yen(detail.netCashAdded)}</Td>
                      <Td>{realizedGainReasonLabels[detail.reason]}</Td>
                      <Td>{realizedGainTreatmentLabels[detail.taxTreatment]}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </details>
        </div>
      )}
      {nonTaxableCashMovementDetails.length > 0 && (
        <details className="rounded-lg border bg-white px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-medium">
            課税されない資金移動を開く ({nonTaxableCashMovementDetails.length}件)
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">
            すでに申告対象化済みの原資移動など、売却時譲渡益税や申告対象損益に影響しない移動です。
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border">
            <Table>
              <thead>
                <Tr>
                  <Th>年月</Th>
                  <Th>所得発生年度</Th>
                  <Th>口座</Th>
                  <Th>移動額</Th>
                  <Th>取得原価部分</Th>
                  <Th>手取り額</Th>
                  <Th>理由</Th>
                  <Th>扱い</Th>
                </Tr>
              </thead>
              <tbody>
                {nonTaxableCashMovementDetails.map((detail, index) => (
                  <Tr key={`${detail.yearMonth}-${detail.accountName}-non-tax-${index}`}>
                    <Td>{detail.yearMonth}</Td>
                    <Td>{detail.fiscalYear}</Td>
                    <Td>{detail.accountName}</Td>
                    <Td>{yen(detail.grossWithdrawal)}</Td>
                    <Td>{yen(detail.costPortion)}</Td>
                    <Td>{yen(detail.netCashAdded)}</Td>
                    <Td>{realizedGainReasonLabels[detail.reason]}</Td>
                    <Td>{realizedGainTreatmentLabels[detail.taxTreatment]}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </details>
      )}
    </ScenarioSyncDetails>
  );
}

function TaxFilingAdviceSummary({ advice }: { advice: TaxFilingAdvice[] }) {
  if (advice.length === 0) return null;

  const visibleAdvice = advice.filter((item) => item.status !== "notRequiredLikely" || item.pensionGrossAnnual > 0);
  if (visibleAdvice.length === 0) return null;
  const priorityAdvice = visibleAdvice.filter((item) => item.status === "attention" || item.status === "review");
  const routineAdvice = visibleAdvice.filter((item) => item.status === "notRequiredLikely");
  const routineGroups = groupRoutineTaxFilingAdvice(routineAdvice);

  const styleByStatus: Record<TaxFilingAdvice["status"], string> = {
    attention: "border-amber-300 bg-amber-50 text-amber-950",
    review: "border-sky-300 bg-sky-50 text-sky-950",
    notRequiredLikely: "border-slate-200 bg-slate-50 text-slate-700",
  };
  const labelByStatus: Record<TaxFilingAdvice["status"], string> = {
    attention: "要確認",
    review: "申告確認",
    notRequiredLikely: "申告不要制度の可能性",
  };

  return (
    <div className="space-y-3 rounded-lg border bg-white px-4 py-3">
      <div>
        <h3 className="font-medium">申告不要・申告確認の判定</h3>
        <p className="text-sm text-muted-foreground">
          公的年金等の申告不要制度を、年金収入400万円以下・年金以外の所得20万円以下を目安に判定します。住民税申告や還付申告の要否は別確認です。
          本人・配偶者などメンバー別に判定します。
        </p>
      </div>
      <div className="space-y-2">
        {priorityAdvice.length === 0 ? (
          <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            目立つ確認年はありません。申告不要制度の可能性がある年度は下の折りたたみで確認できます。
          </div>
        ) : (
          priorityAdvice.map((item) => (
            <div key={item.id} className={cn("rounded-md border px-4 py-3 text-sm leading-6", styleByStatus[item.status])}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{item.fiscalYear}年 {item.memberName}</span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs">{labelByStatus[item.status]}</span>
              </div>
              <p className="mt-1">{item.message}</p>
              <p className="mt-1 text-xs">
                年金収入 {yen(item.pensionGrossAnnual)} / 年金以外 {yen(item.nonPensionIncomeAnnual)} / 所得税 {yen(item.incomeTaxAnnual)} / 住民税 {yen(item.residentTaxAnnual)}
              </p>
            </div>
          ))
        )}
      </div>
      {routineGroups.length > 0 && (
        <details className="rounded-lg border bg-slate-50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">申告不要制度の可能性が続く年度を開く</summary>
          <div className="mt-3 space-y-2">
            {routineGroups.map((group) => (
              <div key={group.id} className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700">
                <span className="font-medium">{group.label}</span>
                <span className="ml-2 text-muted-foreground">{group.memberName}: {group.message}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      <details className="rounded-lg border bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">全年度の判定表を開く</summary>
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <Table>
            <thead>
              <Tr>
                <Th>年度</Th>
                <Th>メンバー</Th>
                <Th>判定</Th>
                <Th>理由</Th>
                <Th>年金収入</Th>
                <Th>年金以外</Th>
                <Th>所得税</Th>
                <Th>住民税</Th>
              </Tr>
            </thead>
            <tbody>
              {visibleAdvice.map((item) => (
                <Tr key={item.id} className={styleByStatus[item.status]}>
                  <Td>{item.fiscalYear}</Td>
                  <Td>{item.memberName}</Td>
                  <Td>
                    <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-xs">{labelByStatus[item.status]}</span>
                  </Td>
                  <Td className="min-w-[28rem] text-sm">{item.message}</Td>
                  <Td>{yen(item.pensionGrossAnnual)}</Td>
                  <Td>{yen(item.nonPensionIncomeAnnual)}</Td>
                  <Td>{yen(item.incomeTaxAnnual)}</Td>
                  <Td>{yen(item.residentTaxAnnual)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </details>
    </div>
  );
}

function groupRoutineTaxFilingAdvice(items: TaxFilingAdvice[]) {
  const sorted = [...items].sort((a, b) => {
    if (a.memberName !== b.memberName) return a.memberName.localeCompare(b.memberName);
    return a.fiscalYear - b.fiscalYear;
  });
  const groups: Array<{ id: string; memberName: string; startYear: number; endYear: number; message: string; label: string }> = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.memberName === item.memberName && last.message === item.message && last.endYear + 1 === item.fiscalYear) {
      last.endYear = item.fiscalYear;
      last.label = `${last.startYear}〜${last.endYear}年`;
    } else {
      groups.push({
        id: item.id,
        memberName: item.memberName,
        startYear: item.fiscalYear,
        endYear: item.fiscalYear,
        message: item.message,
        label: `${item.fiscalYear}年`,
      });
    }
  }
  return groups;
}

function TaxCashTimingSummary({
  details,
  annualRows,
}: {
  details: AutoTaxYearDetail[];
  annualRows: AnnualResult[];
}) {
  if (details.length === 0) return null;

  const rows = details.map((detail) => {
    const regularIncomeTaxTotal = detail.memberDetails.reduce((sum, member) => sum + member.incomeTaxAnnual, 0);
    const regularResidentTaxTotal = detail.memberDetails.reduce((sum, member) => sum + member.residentTaxAnnual, 0);
    const retirementIncomeTaxTotal = detail.memberDetails.reduce((sum, member) => sum + member.retirementIncomeTaxAnnual, 0);
    const retirementResidentTaxTotal = detail.memberDetails.reduce((sum, member) => sum + member.retirementResidentTaxAnnual, 0);
    const nationalPensionAnnualTotal = detail.memberDetails.reduce((sum, member) => sum + member.nationalPensionAnnual, 0);
    const nextYearPaymentBasis =
      regularIncomeTaxTotal +
      regularResidentTaxTotal +
      retirementIncomeTaxTotal +
      retirementResidentTaxTotal +
      detail.nationalHealthInsuranceAnnual +
      detail.lateElderlyMedicalAnnual +
      detail.nursingCareAnnual +
      detail.otherPublicCostAnnual;
    const paymentYear = detail.fiscalYear + 1;
    const paymentRow = annualRows.find((row) => row.year === paymentYear);
    return {
      incomeYear: detail.fiscalYear,
      paymentYear,
      nextYearPaymentBasis,
      nationalPensionAnnualTotal,
      simulatedPaymentTotal: paymentRow?.taxInsuranceTotal ?? 0,
    };
  });

  return (
    <div className="space-y-3 rounded-lg border bg-white px-4 py-3">
      <div>
        <h3 className="font-medium">税・社会保険の発生年と支払年</h3>
        <p className="text-sm text-muted-foreground">
          自動計算では、所得税精算・住民税・国保・介護は原則として翌年の現金支出に回します。国民年金は対象年の月額支払として扱います。
            iDeCo年金の源泉徴収、一時金の退職所得税額見積、売却時譲渡益税は、結果タブの支払タイミングで別に確認します。
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <thead>
            <Tr>
              <Th>所得年</Th>
              <Th>翌年支払対象</Th>
              <Th>国民年金(当年)</Th>
              <Th>主な支払年</Th>
              <Th>シミュレーション上の支払額</Th>
            </Tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={`tax-cash-basis-${row.incomeYear}`}>
                <Td>{row.incomeYear}</Td>
                <Td>{yen(row.nextYearPaymentBasis)}</Td>
                <Td>{yen(row.nationalPensionAnnualTotal)}</Td>
                <Td>{row.paymentYear}</Td>
                <Td>{yen(row.simulatedPaymentTotal)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

function LateElderlyBurdenRatioTable({ details }: { details: AutoTaxYearDetail[] }) {
  const rows = details.flatMap((detail) => detail.lateElderlyBurdenRatios);
  if (rows.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-white px-4 py-3">
      <div>
        <h3 className="font-medium">後期高齢者医療の窓口負担割合</h3>
        <p className="text-sm text-muted-foreground">
          判定所得年の収入・住民税課税所得をもとに、翌年8月から翌々年7月までの1割・2割・3割を表示します。
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <thead>
            <Tr>
              <Th>適用期間</Th>
              <Th>メンバー</Th>
              <Th>判定所得年</Th>
              <Th>住民税課税所得</Th>
              <Th>本人 年金収入+その他所得</Th>
              <Th>世帯合計</Th>
              <Th>被保険者数</Th>
              <Th>窓口負担</Th>
              <Th>判定理由</Th>
            </Tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={`${row.memberId}-${row.incomeYear}`}>
                <Td className="whitespace-nowrap">
                  {row.periodStartYearMonth} - {row.periodEndYearMonth}
                </Td>
                <Td>{row.memberName}</Td>
                <Td>{row.incomeYear}</Td>
                <Td>{yen(row.residentTaxBaseAnnual)}</Td>
                <Td>{yen(row.pensionAndOtherIncomeAnnual)}</Td>
                <Td>{yen(row.householdPensionAndOtherIncomeAnnual)}</Td>
                <Td>{row.insuredMemberCount}人</Td>
                <Td className="font-medium">{Math.round(row.burdenRatio * 10)}割</Td>
                <Td className="min-w-[26rem] text-sm text-muted-foreground">
                  {row.category}: {row.reason}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

function FormulaBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-md border bg-slate-50 px-3 py-3">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-2 space-y-1 font-mono text-xs leading-6 text-slate-700">
        {lines.filter(Boolean).map((line, index) => (
          <div key={`${title}-${index}`}>{line}</div>
        ))}
      </div>
    </div>
  );
}

function TaxSocialSensitivityTable({ scenario, details }: { scenario: ScenarioData; details: AutoTaxYearDetail[] }) {
  const [selectedYear, setSelectedYear] = useState(details[0]?.fiscalYear ?? new Date().getFullYear());
  const availableYears = details.map((detail) => detail.fiscalYear);
  const fiscalYear = availableYears.includes(selectedYear) ? selectedYear : availableYears[0];
  const headMemberId = scenario.householdProfile.headMemberId || scenario.householdMembers[0]?.id;

  const rows = useMemo(() => {
    if (!headMemberId || fiscalYear === undefined) return [];
    const calculated = TAX_SOCIAL_SENSITIVITY_STEPS.map((extraIncome) => {
      const declaredIncome = new Map<number, Map<string, number>>();
      declaredIncome.set(fiscalYear, new Map([[headMemberId, extraIncome]]));
      const detail = calculateAutoTaxDetails(scenario, declaredIncome).find((item) => item.fiscalYear === fiscalYear);
      if (!detail) return null;
      return {
        extraIncome,
        detail,
        totals: autoTaxDetailTotal(detail),
      };
    }).filter((row): row is { extraIncome: number; detail: AutoTaxYearDetail; totals: ReturnType<typeof autoTaxDetailTotal> } => Boolean(row));
    const baseTotal = calculated[0]?.totals.total ?? 0;
    return calculated.map((row, index) => {
      const previous = calculated[index - 1];
      const totalDelta = row.totals.total - baseTotal;
      const incrementalBurden = previous ? row.totals.total - previous.totals.total : 0;
      const incrementalIncome = previous ? row.extraIncome - previous.extraIncome : 0;
      return {
        ...row,
        totalDelta,
        incrementalBurden,
        marginalRate: incrementalIncome > 0 ? incrementalBurden / incrementalIncome : 0,
        burdenRate: row.extraIncome > 0 ? totalDelta / row.extraIncome : 0,
      };
    });
  }, [fiscalYear, headMemberId, scenario]);

  if (!headMemberId || fiscalYear === undefined || rows.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">所得水準別の税・社会保険負担テーブル</h3>
          <p className="text-sm text-muted-foreground">
            選んだ所得年に、世帯主へ一般口座申告所得が追加で発生した場合の試算です。本体シナリオには保存せず、負担の増え方を見るためだけに一時計算します。
          </p>
        </div>
        <div className="w-40">
          <Select value={fiscalYear} onChange={(event) => setSelectedYear(numberOrZero(event.target.value))}>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}年
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[1200px]">
          <thead>
            <Tr>
              <Th>追加申告所得</Th>
              <Th>所得税</Th>
              <Th>住民税</Th>
              <Th>国民年金</Th>
              <Th>国保</Th>
              <Th>後期高齢者医療</Th>
              <Th>介護</Th>
              <Th>合計負担</Th>
              <Th>基準比増分</Th>
              <Th>直前の所得行からの負担増</Th>
              <Th>直前行から見た負担率</Th>
            </Tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={`tax-social-sensitivity-${fiscalYear}-${row.extraIncome}`}>
                <Td>{yen(row.extraIncome)}</Td>
                <Td>{yen(row.totals.incomeTax)}</Td>
                <Td>{yen(row.totals.residentTax)}</Td>
                <Td>{yen(row.totals.nationalPension)}</Td>
                <Td>{yen(row.totals.nationalHealthInsurance)}</Td>
                <Td>{yen(row.totals.lateElderlyMedical)}</Td>
                <Td>{yen(row.totals.nursingCare)}</Td>
                <Td className="font-medium">{yen(row.totals.total)}</Td>
                <Td className={row.totalDelta > 0 ? "text-red-600" : ""}>{yen(row.totalDelta)}</Td>
                <Td>{row.extraIncome === 0 ? "-" : yen(row.incrementalBurden)}</Td>
                <Td>{row.extraIncome === 0 ? "-" : `${(row.marginalRate * 100).toFixed(1)}%`}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        直前の所得行とは、この表の1つ上の行です。前年度という意味ではありません。たとえば100万円行なら、50万円行から所得が50万円増えたときの追加負担を見ます。
        直前行から見た負担率は「直前行から所得が増えた分に対して、税・社会保険の合計負担が何%増えたか」です。
      </p>
    </div>
  );
}

function TaxCalculationDetails({
  details,
  retirementOverlapAdjustments = [],
}: {
  details: AutoTaxYearDetail[];
  retirementOverlapAdjustments?: RetirementOverlapAdjustment[];
}) {
  if (details.length === 0) {
    return <p className="text-sm text-muted-foreground">自動計算の根拠はまだありません。</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm leading-7 text-muted-foreground">
        <p className="font-medium text-foreground">計算の考え方</p>
        <p>所得税と住民税は、課税対象収入から給与所得控除・公的年金等控除・基礎控除・扶養控除などを差し引いて概算します。</p>
        <p>iDeCoの年金受取は、収入イベントの「種別」を「年金」、「課税区分」を「課税」にすると、公的年金等控除を使う年金収入として扱います。</p>
        <p>社会保険料控除と医療費控除は、`所得控除入力` で入れた年度・メンバーごとの金額を所得税と住民税の課税ベースから差し引きます。</p>
        <p>国民年金は、国保加入が「加入」で20歳から59歳までの対象月数に年度額を掛けて月額換算します。</p>
        <p>国保は大田区の概算ルールで、世帯の国保加入者ごとの所得を集計して見ます。</p>
        <p>譲渡益課税は、特定口座と一般口座（オプション用）の売却時に、売却額のうち含み益部分へ 20.315% を掛けて概算します。取得原価は初期資産タブの入力値を使い、積立分はそのまま取得原価へ加算します。</p>
      </div>

      {details.map((detail) => {
        const regularIncomeTaxTotal = detail.memberDetails.reduce((sum, member) => sum + member.incomeTaxAnnual, 0);
        const regularResidentTaxTotal = detail.memberDetails.reduce((sum, member) => sum + member.residentTaxAnnual, 0);
        const retirementIncomeTaxTotal = detail.memberDetails.reduce((sum, member) => sum + member.retirementIncomeTaxAnnual, 0);
        const retirementResidentTaxTotal = detail.memberDetails.reduce((sum, member) => sum + member.retirementResidentTaxAnnual, 0);
        const nationalPensionAnnualTotal = detail.memberDetails.reduce((sum, member) => sum + member.nationalPensionAnnual, 0);
        const annualTotal =
          regularIncomeTaxTotal +
          regularResidentTaxTotal +
          retirementIncomeTaxTotal +
          retirementResidentTaxTotal +
          nationalPensionAnnualTotal +
          detail.nationalHealthInsuranceAnnual +
          detail.lateElderlyMedicalAnnual +
          detail.nursingCareAnnual +
          detail.otherPublicCostAnnual;
        const monthlyEquivalent = Math.round(annualTotal / 12);
        const retirementAdjustmentsForYear = retirementOverlapAdjustments.filter(
          (item) => Number(item.currentPaymentYearMonth.slice(0, 4)) === detail.fiscalYear,
        );

        return (
          <details key={detail.fiscalYear} className="rounded-lg border bg-white px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <span className="font-medium">{detail.fiscalYear}年度の根拠</span>
              <span className="text-sm text-muted-foreground">
                年間合計目安 {yen(annualTotal)} / 月平均 {yen(monthlyEquivalent)}
              </span>
            </summary>
            <div className="mt-4 space-y-6">
              <section className="space-y-3">
                <h4 className="font-medium">年度税額の内訳</h4>
                <p className="text-sm text-muted-foreground">
                  通常所得分と退職一時金分を分けて表示します。自動計算の最終行では、これらを合算した所得税・住民税を使います。
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <thead>
                      <Tr>
                        <Th>区分</Th>
                        <Th>所得税</Th>
                        <Th>住民税</Th>
                        <Th>国民年金</Th>
                        <Th>国保</Th>
                        <Th>後期高齢者医療</Th>
                        <Th>介護</Th>
                        <Th>その他</Th>
                        <Th>年額合計</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      <Tr>
                        <Td>通常所得分</Td>
                        <Td>{yen(regularIncomeTaxTotal)}</Td>
                        <Td>{yen(regularResidentTaxTotal)}</Td>
                        <Td>{yen(nationalPensionAnnualTotal)}</Td>
                        <Td>{yen(detail.nationalHealthInsuranceAnnual)}</Td>
                        <Td>{yen(detail.lateElderlyMedicalAnnual)}</Td>
                        <Td>{yen(detail.nursingCareAnnual)}</Td>
                        <Td>{yen(detail.otherPublicCostAnnual)}</Td>
                        <Td className="font-medium">
                          {yen(
                            regularIncomeTaxTotal +
                              regularResidentTaxTotal +
                              nationalPensionAnnualTotal +
                              detail.nationalHealthInsuranceAnnual +
                              detail.lateElderlyMedicalAnnual +
                              detail.nursingCareAnnual +
                              detail.otherPublicCostAnnual,
                          )}
                        </Td>
                      </Tr>
                      <Tr>
                        <Td>退職一時金分</Td>
                        <Td>{yen(retirementIncomeTaxTotal)}</Td>
                        <Td>{yen(retirementResidentTaxTotal)}</Td>
                        <Td>{yen(0)}</Td>
                        <Td>{yen(0)}</Td>
                        <Td>{yen(0)}</Td>
                        <Td>{yen(0)}</Td>
                        <Td>{yen(0)}</Td>
                        <Td className="font-medium">{yen(retirementIncomeTaxTotal + retirementResidentTaxTotal)}</Td>
                      </Tr>
                      <Tr>
                        <Td className="font-medium">合計</Td>
                        <Td>{yen(regularIncomeTaxTotal + retirementIncomeTaxTotal)}</Td>
                        <Td>{yen(regularResidentTaxTotal + retirementResidentTaxTotal)}</Td>
                        <Td>{yen(nationalPensionAnnualTotal)}</Td>
                        <Td>{yen(detail.nationalHealthInsuranceAnnual)}</Td>
                        <Td>{yen(detail.lateElderlyMedicalAnnual)}</Td>
                        <Td>{yen(detail.nursingCareAnnual)}</Td>
                        <Td>{yen(detail.otherPublicCostAnnual)}</Td>
                        <Td className="font-medium">{yen(annualTotal)}</Td>
                      </Tr>
                    </tbody>
                  </Table>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="font-medium">国民年金の個人別内訳</h4>
                <p className="text-sm text-muted-foreground">
                  国民年金は世帯合計だけでなく、メンバー別の対象月数で確認します。20歳以上60歳未満、国保加入、後期高齢者医療対象外の月だけを数えます。
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <thead>
                      <Tr>
                        <Th>メンバー</Th>
                        <Th>年末年齢</Th>
                        <Th>対象月数</Th>
                        <Th>月額</Th>
                        <Th>年額</Th>
                        <Th className="min-w-[320px]">読み方</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {detail.memberDetails.map((member) => {
                        const eligibleMonths =
                          member.nationalPensionMonthly > 0 ? Math.round(member.nationalPensionAnnual / member.nationalPensionMonthly) : 0;
                        return (
                          <Tr key={`${detail.fiscalYear}-${member.memberId}-national-pension`}>
                            <Td>
                              <div className="font-medium">{member.memberName}</div>
                              <div className="text-xs text-muted-foreground">{relationshipLabels[member.relationship]}</div>
                            </Td>
                            <Td>{taxYearEndAgeLabel(member.ageAtYearEnd)}</Td>
                            <Td>{eligibleMonths}か月</Td>
                            <Td>{yen(member.nationalPensionMonthly)}</Td>
                            <Td className={member.nationalPensionAnnual > 0 ? "font-medium" : ""}>{yen(member.nationalPensionAnnual)}</Td>
                            <Td className="min-w-[320px] text-sm text-muted-foreground">
                              {eligibleMonths > 0
                                ? `${member.memberName}がこの年に${eligibleMonths}か月分の国民年金対象です。`
                                : `${member.memberName}はこの年の国民年金対象月がありません。`}
                            </Td>
                          </Tr>
                        );
                      })}
                      <Tr>
                        <Td className="font-medium">世帯合計</Td>
                        <Td>-</Td>
                        <Td>{detail.memberDetails.reduce(
                          (sum, member) =>
                            sum + (member.nationalPensionMonthly > 0 ? Math.round(member.nationalPensionAnnual / member.nationalPensionMonthly) : 0),
                          0,
                        )}か月</Td>
                        <Td>-</Td>
                        <Td className="font-medium">{yen(nationalPensionAnnualTotal)}</Td>
                        <Td className="min-w-[320px] text-sm text-muted-foreground">
                          年度税額の内訳に出る国民年金は、この個人別年額の合計です。
                        </Td>
                      </Tr>
                    </tbody>
                  </Table>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="font-medium">メンバー別の課税対象収入と控除</h4>
                <p className="text-sm text-muted-foreground">この表の収入は {detail.fiscalYear}年1月から12月までの課税対象収入を集計しています。</p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <thead>
                      <Tr>
                        <Th>メンバー</Th>
                        <Th>給与収入</Th>
                        <Th>給与控除</Th>
                        <Th>年金収入</Th>
                        <Th>年金控除</Th>
                        <Th>雑所得</Th>
                        <Th>退職一時金</Th>
                        <Th>退職所得控除</Th>
                        <Th>退職所得</Th>
                        <Th>社保控除</Th>
                        <Th>自動社保控除</Th>
                        <Th>手入力社保控除</Th>
                        <Th>医療費控除</Th>
                        <Th>基礎控除前</Th>
                        <Th>基礎控除</Th>
                        <Th>扶養控除(所得税)</Th>
                        <Th>扶養控除(住民税)</Th>
                        <Th>うち配偶者特別控除(所得税)</Th>
                        <Th>うち配偶者特別控除(住民税)</Th>
                        <Th>所得税課税ベース</Th>
                        <Th>住民税課税ベース</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {detail.memberDetails.map((member) => (
                        <Tr key={member.memberId}>
                          <Td>
                            <div className="font-medium">{member.memberName}</div>
                            <div className="text-xs text-muted-foreground">
                              {relationshipLabels[member.relationship]} / {taxYearEndAgeLabel(member.ageAtYearEnd)}
                            </div>
                          </Td>
                          <Td>{yen(member.salaryGrossAnnual)}</Td>
                          <Td>{yen(member.salaryDeductionAnnual)}</Td>
                          <Td>{yen(member.pensionGrossAnnual)}</Td>
                          <Td>{yen(member.pensionDeductionAnnual)}</Td>
                          <Td>{yen(member.miscellaneousIncomeAnnual)}</Td>
                          <Td>{yen(member.retirementGrossAnnual)}</Td>
                          <Td>{yen(member.retirementIncomeDeductionAnnual)}</Td>
                          <Td>{yen(member.retirementIncomeAnnual)}</Td>
                          <Td>{yen(member.socialInsuranceDeductionAnnual)}</Td>
                          <Td>{yen(member.autoSocialInsuranceDeductionAnnual)}</Td>
                          <Td>{yen(member.manualSocialInsuranceDeductionAnnual)}</Td>
                          <Td>{yen(member.medicalExpenseDeductionAnnual)}</Td>
                          <Td>{yen(member.taxableIncomeBeforeBasicDeductionAnnual)}</Td>
                          <Td>{yen(member.basicDeductionAnnual)}</Td>
                          <Td>{yen(member.dependentDeductionsIncomeTaxAnnual)}</Td>
                          <Td>{yen(member.dependentDeductionsResidentTaxAnnual)}</Td>
                          <Td>{yen(member.spouseSpecialDeductionIncomeTaxAnnual)}</Td>
                          <Td>{yen(member.spouseSpecialDeductionResidentTaxAnnual)}</Td>
                          <Td>{yen(member.incomeTaxBaseAnnual)}</Td>
                          <Td>{yen(member.residentTaxBaseAnnual)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="font-medium">計算式ビュー</h4>
                <p className="text-sm text-muted-foreground">
                  自動計算で使った中間値を、式に代入して表示します。ここでは再計算せず、上の表と同じ値を式として読める形にしています。
                </p>
                <div className="grid gap-3 lg:grid-cols-2">
                  {detail.memberDetails.map((member) => {
                    const salaryIncome = Math.max(0, member.salaryGrossAnnual - member.salaryDeductionAnnual);
                    const pensionIncome = Math.max(0, member.pensionGrossAnnual - member.pensionDeductionAnnual);
                    const incomeTaxBaseBeforeClamp =
                      member.taxableIncomeBeforeBasicDeductionAnnual -
                      member.basicDeductionAnnual -
                      member.dependentDeductionsIncomeTaxAnnual -
                      member.socialInsuranceDeductionAnnual -
                      member.medicalExpenseDeductionAnnual;
                    const residentTaxBaseBeforeClamp =
                      member.taxableIncomeBeforeBasicDeductionAnnual -
                      RESIDENT_TAX_BASIC_DEDUCTION_FOR_DISPLAY -
                      member.dependentDeductionsResidentTaxAnnual -
                      member.socialInsuranceDeductionAnnual -
                      member.medicalExpenseDeductionAnnual;
                    return (
                      <div key={`${detail.fiscalYear}-${member.memberId}-formula`} className="space-y-3 rounded-lg border bg-white p-3">
                        <div>
                          <div className="font-medium">{member.memberName}</div>
                          <div className="text-xs text-muted-foreground">
                            {relationshipLabels[member.relationship]} / {taxYearEndAgeLabel(member.ageAtYearEnd)}
                          </div>
                        </div>
                        <FormulaBlock
                          title="合計所得"
                          lines={[
                            "給与所得 = 給与収入 - 給与所得控除。ただしマイナスなら0円",
                            `= ${yen(member.salaryGrossAnnual)} - ${yen(member.salaryDeductionAnnual)} → ${yen(salaryIncome)}`,
                            "公的年金等雑所得 = 年金収入 - 公的年金等控除。ただしマイナスなら0円",
                            `= ${yen(member.pensionGrossAnnual)} - ${yen(member.pensionDeductionAnnual)} → ${yen(pensionIncome)}`,
                            "合計所得 = 給与所得 + 公的年金等雑所得 + その他雑所得",
                            `= ${yen(salaryIncome)} + ${yen(pensionIncome)} + ${yen(member.miscellaneousIncomeAnnual)}`,
                            `= ${yen(member.taxableIncomeBeforeBasicDeductionAnnual)}`,
                          ]}
                        />
                        <FormulaBlock
                          title="所得税課税所得"
                          lines={[
                            "所得税課税所得 = 合計所得 - 基礎控除 - 扶養/配偶者控除 - 社会保険料控除 - 医療費控除",
                            `= ${yen(member.taxableIncomeBeforeBasicDeductionAnnual)} - ${yen(member.basicDeductionAnnual)} - ${yen(member.dependentDeductionsIncomeTaxAnnual)} - ${yen(member.socialInsuranceDeductionAnnual)} - ${yen(member.medicalExpenseDeductionAnnual)}`,
                            `= ${yen(incomeTaxBaseBeforeClamp)}`,
                            zeroFloorLine("所得税課税所得", incomeTaxBaseBeforeClamp),
                            `= ${yen(member.incomeTaxBaseAnnual)}`,
                          ]}
                        />
                        <FormulaBlock title="所得税" lines={incomeTaxFormulaSubstitution(member.incomeTaxBaseAnnual, member.incomeTaxAnnual)} />
                        <FormulaBlock
                          title="住民税課税所得"
                          lines={[
                            "住民税課税所得 = 合計所得 - 基礎控除 - 扶養/配偶者控除 - 社会保険料控除 - 医療費控除",
                            `= ${yen(member.taxableIncomeBeforeBasicDeductionAnnual)} - ${yen(RESIDENT_TAX_BASIC_DEDUCTION_FOR_DISPLAY)} - ${yen(member.dependentDeductionsResidentTaxAnnual)} - ${yen(member.socialInsuranceDeductionAnnual)} - ${yen(member.medicalExpenseDeductionAnnual)}`,
                            `= ${yen(residentTaxBaseBeforeClamp)}`,
                            zeroFloorLine("住民税課税所得", residentTaxBaseBeforeClamp),
                            `= ${yen(member.residentTaxBaseAnnual)}`,
                          ]}
                        />
                        <FormulaBlock title="住民税" lines={residentTaxFormulaSubstitution(member.residentTaxBaseAnnual, member.residentTaxAnnual)} />
                        <FormulaBlock
                          title="国民年金"
                          lines={[
                            "国民年金 = 対象月数 × 月額保険料",
                            `= ${member.nationalPensionMonthly > 0 ? Math.round(member.nationalPensionAnnual / member.nationalPensionMonthly) : 0}か月 × ${yen(member.nationalPensionMonthly)}`,
                            `= ${yen(member.nationalPensionAnnual)}`,
                          ]}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="font-medium">所得控除の反映確認</h4>
                <p className="text-sm text-muted-foreground">
                  自動計算した公的保険料と、所得控除入力で入れた社会保険料控除・医療費控除が、所得税・住民税の課税ベースをどれだけ下げたかを確認します。
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <thead>
                      <Tr>
                        <Th>メンバー</Th>
                        <Th>社保控除</Th>
                        <Th>医療費控除</Th>
                        <Th>所得税ベース 控除前</Th>
                        <Th>所得税ベース 控除後</Th>
                        <Th>所得税ベース減少</Th>
                        <Th>住民税ベース 控除前</Th>
                        <Th>住民税ベース 控除後</Th>
                        <Th>住民税ベース減少</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {detail.memberDetails.map((member) => {
                        const incomeTaxBaseBeforeManualDeductions = Math.max(
                          0,
                          member.taxableIncomeBeforeBasicDeductionAnnual -
                            member.basicDeductionAnnual -
                            member.dependentDeductionsIncomeTaxAnnual,
                        );
                        const residentTaxBaseBeforeManualDeductions = Math.max(
                          0,
                          member.taxableIncomeBeforeBasicDeductionAnnual -
                            RESIDENT_TAX_BASIC_DEDUCTION_FOR_DISPLAY -
                            member.dependentDeductionsResidentTaxAnnual,
                        );
                        return (
                          <Tr key={`${member.memberId}-deduction-impact`}>
                            <Td>{member.memberName}</Td>
                            <Td>{yen(member.socialInsuranceDeductionAnnual)}</Td>
                            <Td>{yen(member.medicalExpenseDeductionAnnual)}</Td>
                            <Td>{yen(incomeTaxBaseBeforeManualDeductions)}</Td>
                            <Td>{yen(member.incomeTaxBaseAnnual)}</Td>
                            <Td>{yen(Math.max(0, incomeTaxBaseBeforeManualDeductions - member.incomeTaxBaseAnnual))}</Td>
                            <Td>{yen(residentTaxBaseBeforeManualDeductions)}</Td>
                            <Td>{yen(member.residentTaxBaseAnnual)}</Td>
                            <Td>{yen(Math.max(0, residentTaxBaseBeforeManualDeductions - member.residentTaxBaseAnnual))}</Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              </section>

              {retirementAdjustmentsForYear.length > 0 && (
                <section className="space-y-3">
                  <h4 className="font-medium">退職所得控除の重複調整概算</h4>
                  <p className="text-sm text-muted-foreground">
                    この年に受け取る退職所得イベントについて、過去の退職金やiDeCo一時金との重複期間を概算しています。収入イベントとして登録したiDeCo一時金は、この調整後控除を税額計算に反映します。
                  </p>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <thead>
                        <Tr>
                          <Th>対象</Th>
                          <Th>過去イベント</Th>
                          <Th>重複年数</Th>
                          <Th>調整前控除</Th>
                          <Th>重複控除概算</Th>
                          <Th>調整後控除</Th>
                          <Th>退職所得 概算前</Th>
                          <Th>退職所得 概算後</Th>
                          <Th>根拠</Th>
                        </Tr>
                      </thead>
                      <tbody>
                        {retirementAdjustmentsForYear.map((item) => (
                          <Tr key={`${detail.fiscalYear}-${item.id}`}>
                            <Td>
                              <div className="font-medium">{item.currentEventName}</div>
                              <div className="text-xs text-muted-foreground">{item.currentPaymentYearMonth}</div>
                            </Td>
                            <Td>
                              <div>{item.priorEventName}</div>
                              <div className="text-xs text-muted-foreground">{item.priorPaymentYearMonth}</div>
                            </Td>
                            <Td>{item.estimatedOverlapYears}年</Td>
                            <Td>{yen(item.baseDeduction)}</Td>
                            <Td>{yen(item.estimatedOverlapDeduction)}</Td>
                            <Td>{yen(item.adjustedDeduction)}</Td>
                            <Td>{yen(item.estimatedIncomeBeforeAdjustment)}</Td>
                            <Td>{yen(item.estimatedIncomeAfterAdjustment)}</Td>
                            <Td className="min-w-[18rem] text-sm text-muted-foreground">
                              {item.precision === "dateBased" ? "期間入力ベース" : "年数ベース"}。{item.note}
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <h4 className="font-medium">所得税と住民税の結果</h4>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <thead>
                      <Tr>
                        <Th>メンバー</Th>
                        <Th>所得税(通常所得)</Th>
                        <Th>住民税(通常所得)</Th>
                        <Th>所得税(退職一時金)</Th>
                        <Th>住民税(退職一時金)</Th>
                        <Th>所得税合計</Th>
                        <Th>住民税合計</Th>
                        <Th>国民年金(月額)</Th>
                        <Th>国民年金(年額)</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {detail.memberDetails.map((member) => (
                        <Tr key={`${member.memberId}-tax`}>
                          <Td>{member.memberName}</Td>
                          <Td>{yen(member.incomeTaxAnnual)}</Td>
                          <Td>{yen(member.residentTaxAnnual)}</Td>
                          <Td>{yen(member.retirementIncomeTaxAnnual)}</Td>
                          <Td>{yen(member.retirementResidentTaxAnnual)}</Td>
                          <Td>{yen(member.incomeTaxAnnual + member.retirementIncomeTaxAnnual)}</Td>
                          <Td>{yen(member.residentTaxAnnual + member.retirementResidentTaxAnnual)}</Td>
                          <Td>{yen(member.nationalPensionMonthly)}</Td>
                          <Td>{yen(member.nationalPensionAnnual)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
                <p className="text-sm text-muted-foreground">
                  所得税は課税ベースに税率表を当て、復興特別税 2.1% を上乗せしています。住民税は課税ベースにおおむね 10% と均等割を足した概算です。
                </p>
              </section>

              <section className="space-y-3">
                <h4 className="font-medium">所得税・住民税の計算式確認</h4>
                <p className="text-sm text-muted-foreground">
                  課税ベースに対して、どの税率式を当てているかを確認します。ここは通知書との差異確認用で、表示値は自動計算結果と同じ値を分解しています。
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <thead>
                      <Tr>
                        <Th>メンバー</Th>
                        <Th>所得税課税ベース</Th>
                        <Th>所得税の式</Th>
                        <Th>所得税</Th>
                        <Th>住民税課税ベース</Th>
                        <Th>住民税の式</Th>
                        <Th>住民税</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {detail.memberDetails.map((member) => (
                        <Tr key={`${member.memberId}-tax-formula`}>
                          <Td>{member.memberName}</Td>
                          <Td>{yen(member.incomeTaxBaseAnnual)}</Td>
                          <Td className="min-w-[16rem] text-sm text-muted-foreground">{incomeTaxFormulaLabel(member.incomeTaxBaseAnnual)}</Td>
                          <Td>{yen(member.incomeTaxAnnual)}</Td>
                          <Td>{yen(member.residentTaxBaseAnnual)}</Td>
                          <Td className="min-w-[14rem] text-sm text-muted-foreground">{residentTaxFormulaLabel(member.residentTaxBaseAnnual)}</Td>
                          <Td>{yen(member.residentTaxAnnual)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="font-medium">公的医療・介護保険の概算</h4>
                <div className="grid gap-3 lg:grid-cols-2">
                  {(() => {
                    const nhi = detail.nationalHealthInsuranceBreakdown;
                    const medicalCalculated =
                      Math.round(nhi.totalBaseIncome * OTA_NHI_RATES_FOR_DISPLAY.medicalIncomeRate) +
                      Math.round(nhi.insuredMemberCount * OTA_NHI_RATES_FOR_DISPLAY.medicalPerCapita) -
                      nhi.medicalEqualReductionAmount;
                    const supportCalculated =
                      Math.round(nhi.totalBaseIncome * OTA_NHI_RATES_FOR_DISPLAY.supportIncomeRate) +
                      Math.round(nhi.insuredMemberCount * OTA_NHI_RATES_FOR_DISPLAY.supportPerCapita) -
                      nhi.supportEqualReductionAmount;
                    const childSupportCalculated =
                      Math.round(nhi.totalBaseIncome * OTA_NHI_RATES_FOR_DISPLAY.childSupportIncomeRate) +
                      Math.round(nhi.insuredMemberCount * OTA_NHI_RATES_FOR_DISPLAY.childSupportPerCapita) -
                      nhi.childSupportEqualReductionAmount;
                    const careCalculated =
                      Math.round(nhi.careBaseIncome * OTA_NHI_RATES_FOR_DISPLAY.careIncomeRate) +
                      Math.round(nhi.careMemberCount * OTA_NHI_RATES_FOR_DISPLAY.carePerCapita) -
                      nhi.careEqualReductionAmount;
                    return (
                      <>
                        <FormulaBlock
                          title="国保 医療分"
                          lines={[
                            "医療分 = 所得割 + 均等割。ただし上限額を超えた分は切り捨てます",
                            `所得割 = 加入者基礎所得合計 ${yen(nhi.totalBaseIncome)} × ${(OTA_NHI_RATES_FOR_DISPLAY.medicalIncomeRate * 100).toFixed(2)}%`,
                            `均等割 = ${personMonthLabel(nhi.insuredMemberCount)} × ${yen(OTA_NHI_RATES_FOR_DISPLAY.medicalPerCapita)}`,
                            nhi.medicalEqualReductionAmount > 0
                              ? `${nhi.equalReductionLabel} = -${yen(nhi.medicalEqualReductionAmount)}（判定所得 ${yen(nhi.equalReductionJudgmentIncome)} / 閾値 ${yen(nhi.equalReductionThreshold)}）`
                              : "",
                            ...capSelectionLines("医療分", medicalCalculated, OTA_NHI_RATES_FOR_DISPLAY.medicalCap, nhi.medical),
                          ]}
                        />
                        <FormulaBlock
                          title="国保 支援分"
                          lines={[
                            "支援分 = 所得割 + 均等割。ただし上限額を超えた分は切り捨てます",
                            `所得割 = 加入者基礎所得合計 ${yen(nhi.totalBaseIncome)} × ${(OTA_NHI_RATES_FOR_DISPLAY.supportIncomeRate * 100).toFixed(2)}%`,
                            `均等割 = ${personMonthLabel(nhi.insuredMemberCount)} × ${yen(OTA_NHI_RATES_FOR_DISPLAY.supportPerCapita)}`,
                            nhi.supportEqualReductionAmount > 0
                              ? `${nhi.equalReductionLabel} = -${yen(nhi.supportEqualReductionAmount)}（判定所得 ${yen(nhi.equalReductionJudgmentIncome)} / 閾値 ${yen(nhi.equalReductionThreshold)}）`
                              : "",
                            ...capSelectionLines("支援分", supportCalculated, OTA_NHI_RATES_FOR_DISPLAY.supportCap, nhi.support),
                          ]}
                        />
                        <FormulaBlock
                          title="国保 こども分"
                          lines={[
                            "こども分 = 所得割 + 均等割。ただし上限額を超えた分は切り捨てます",
                            `所得割 = 加入者基礎所得合計 ${yen(nhi.totalBaseIncome)} × ${(OTA_NHI_RATES_FOR_DISPLAY.childSupportIncomeRate * 100).toFixed(2)}%`,
                            `均等割 = ${personMonthLabel(nhi.insuredMemberCount)} × ${yen(OTA_NHI_RATES_FOR_DISPLAY.childSupportPerCapita)}`,
                            nhi.childSupportEqualReductionAmount > 0
                              ? `${nhi.equalReductionLabel} = -${yen(nhi.childSupportEqualReductionAmount)}（判定所得 ${yen(nhi.equalReductionJudgmentIncome)} / 閾値 ${yen(nhi.equalReductionThreshold)}）`
                              : "",
                            ...capSelectionLines("こども分", childSupportCalculated, OTA_NHI_RATES_FOR_DISPLAY.childSupportCap, nhi.childSupport),
                          ]}
                        />
                        <FormulaBlock
                          title="国保 介護分"
                          lines={[
                            "介護分 = 所得割 + 均等割。ただし上限額を超えた分は切り捨てます",
                            `所得割 = 40-64歳対象基礎所得 ${yen(nhi.careBaseIncome)} × ${(OTA_NHI_RATES_FOR_DISPLAY.careIncomeRate * 100).toFixed(2)}%`,
                            `均等割 = ${personMonthLabel(nhi.careMemberCount)} × ${yen(OTA_NHI_RATES_FOR_DISPLAY.carePerCapita)}`,
                            nhi.careEqualReductionAmount > 0
                              ? `${nhi.equalReductionLabel} = -${yen(nhi.careEqualReductionAmount)}（判定所得 ${yen(nhi.equalReductionJudgmentIncome)} / 閾値 ${yen(nhi.equalReductionThreshold)}）`
                              : "",
                            ...capSelectionLines("介護分", careCalculated, OTA_NHI_RATES_FOR_DISPLAY.careCap, detail.nursingCareAnnual),
                          ]}
                        />
                      </>
                    );
                  })()}
                  {detail.lateElderlyMedicalBreakdown.insuredMemberCount > 0 && (
                    <>
                      <FormulaBlock
                        title="後期高齢者医療 均等割軽減"
                        lines={[
                          "均等割軽減は、世帯の判定所得が軽減判定の閾値以下かで決まります",
                          "閾値は固定ではありません。被保険者数と給与/年金所得者数に応じて変わります",
                          `判定所得 ${yen(detail.lateElderlyMedicalBreakdown.equalReductionJudgmentIncome)} / 閾値 ${yen(detail.lateElderlyMedicalBreakdown.equalReductionThreshold)}`,
                          `判定結果 = ${detail.lateElderlyMedicalBreakdown.equalReductionLabel}`,
                          `均等割軽減額 = ${yen(detail.lateElderlyMedicalBreakdown.medicalEqualReductionAmount + detail.lateElderlyMedicalBreakdown.childSupportEqualReductionAmount)}`,
                        ]}
                      />
                      <FormulaBlock
                        title="後期高齢者医療 医療分"
                        lines={[
                          "医療分 = 所得割 + 均等割 - 軽減額。ただし上限額を超えた分は切り捨てます",
                          `所得割目安 = ${yen(detail.lateElderlyMedicalBreakdown.totalBaseIncome)} × ${(TOKYO_LATE_ELDERLY_MEDICAL_FOR_DISPLAY.medicalIncomeRate * 100).toFixed(2)}%`,
                          `均等割目安 = ${personMonthLabel(detail.lateElderlyMedicalBreakdown.insuredMemberCount)} × ${yen(TOKYO_LATE_ELDERLY_MEDICAL_FOR_DISPLAY.medicalPerCapita)}`,
                          `軽減額 = 均等割 ${yen(detail.lateElderlyMedicalBreakdown.medicalEqualReductionAmount)} + 所得割 ${yen(detail.lateElderlyMedicalBreakdown.medicalIncomeReductionAmount)}`,
                          `= ${yen(detail.lateElderlyMedicalBreakdown.medical)}`,
                        ]}
                      />
                      <FormulaBlock
                        title="後期高齢者医療 支援分"
                        lines={[
                          "支援分 = 所得割 + 均等割 - 軽減額。ただし上限額を超えた分は切り捨てます",
                          `所得割目安 = ${yen(detail.lateElderlyMedicalBreakdown.totalBaseIncome)} × ${(TOKYO_LATE_ELDERLY_MEDICAL_FOR_DISPLAY.childSupportIncomeRate * 100).toFixed(2)}%`,
                          `均等割目安 = ${personMonthLabel(detail.lateElderlyMedicalBreakdown.insuredMemberCount)} × ${yen(TOKYO_LATE_ELDERLY_MEDICAL_FOR_DISPLAY.childSupportPerCapita)}`,
                          `軽減額 = 均等割 ${yen(detail.lateElderlyMedicalBreakdown.childSupportEqualReductionAmount)} + 所得割 ${yen(detail.lateElderlyMedicalBreakdown.childSupportIncomeReductionAmount)}`,
                          `= ${yen(detail.lateElderlyMedicalBreakdown.childSupport)}`,
                        ]}
                      />
                      {detail.lateElderlyBurdenRatios.length > 0 && (
                        <FormulaBlock
                          title="後期高齢者医療 窓口負担割合"
                          lines={[
                            "窓口負担割合は、住民税課税所得と年金収入+その他所得で判定します",
                            ...detail.lateElderlyBurdenRatios.map(
                              (row) =>
                                `${row.memberName}: 住民税課税所得 ${yen(row.residentTaxBaseAnnual)} / 本人収入判定 ${yen(row.pensionAndOtherIncomeAnnual)} / 世帯判定 ${yen(row.householdPensionAndOtherIncomeAnnual)} → ${Math.round(row.burdenRatio * 10)}割`,
                            ),
                          ]}
                        />
                      )}
                    </>
                  )}
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <thead>
                      <Tr>
                        <Th>区分</Th>
                        <Th>人数 / 合計所得</Th>
                        <Th>金額</Th>
                        <Th>内訳</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      <Tr>
                        <Td>国保加入者</Td>
                        <Td>
                          {personMonthLabel(detail.nationalHealthInsuranceBreakdown.insuredMemberCount)} / {yen(detail.nationalHealthInsuranceBreakdown.totalBaseIncome)}
                        </Td>
                        <Td>{yen(detail.nationalHealthInsuranceAnnual)}</Td>
                        <Td>
                          医療 {yen(detail.nationalHealthInsuranceBreakdown.medical)} / 支援 {yen(detail.nationalHealthInsuranceBreakdown.support)} / こども
                          {yen(detail.nationalHealthInsuranceBreakdown.childSupport)}
                        </Td>
                      </Tr>
                      <Tr>
                        <Td>介護</Td>
                        <Td>{yen(detail.nationalHealthInsuranceBreakdown.care)}</Td>
                        <Td>{yen(detail.nursingCareAnnual)}</Td>
                        <Td>40歳から64歳の国保加入者の所得をもとに概算</Td>
                      </Tr>
                      <Tr>
                        <Td>後期高齢者医療</Td>
                        <Td>
                          {personMonthLabel(detail.lateElderlyMedicalBreakdown.insuredMemberCount)} / {yen(detail.lateElderlyMedicalBreakdown.totalBaseIncome)}
                        </Td>
                        <Td>{yen(detail.lateElderlyMedicalAnnual)}</Td>
                        <Td>
                          医療 {yen(detail.lateElderlyMedicalBreakdown.medical)} / 子ども
                          {yen(detail.lateElderlyMedicalBreakdown.childSupport)}
                          <br />
                          軽減 {detail.lateElderlyMedicalBreakdown.equalReductionLabel} / 所得割軽減
                          {yen(detail.lateElderlyMedicalBreakdown.incomeReductionAmount)}
                        </Td>
                      </Tr>
                    </tbody>
                  </Table>
                </div>
                {detail.nationalHealthInsuranceBreakdown.insuredMemberDetails.length > 0 && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>国保は大田区の概算で、加入者ごとの baseIncome を集計しています。</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {detail.nationalHealthInsuranceBreakdown.insuredMemberDetails.map((member) => (
                        <li key={member.memberId}>
                          {member.memberName} {taxYearEndAgeLabel(member.ageAtYearEnd)}: baseIncome {yen(member.baseIncome)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {detail.lateElderlyMedicalBreakdown.insuredMemberDetails.length > 0 && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>後期高齢者医療は東京都広域連合の料率で、被保険者ごとの baseIncome を集計しています。</p>
                    <p>
                      均等割軽減判定所得 {yen(detail.lateElderlyMedicalBreakdown.equalReductionJudgmentIncome)} / 閾値
                      {yen(detail.lateElderlyMedicalBreakdown.equalReductionThreshold)} / 均等割軽減
                      {yen(detail.lateElderlyMedicalBreakdown.medicalEqualReductionAmount + detail.lateElderlyMedicalBreakdown.childSupportEqualReductionAmount)}
                    </p>
                    <ul className="list-disc space-y-1 pl-5">
                      {detail.lateElderlyMedicalBreakdown.insuredMemberDetails.map((member) => (
                        <li key={member.memberId}>
                          {member.memberName} {taxYearEndAgeLabel(member.ageAtYearEnd)}: baseIncome {yen(member.baseIncome)} / 所得割軽減 {member.incomeReductionLabel}
                          {member.incomeReductionAmount > 0 ? ` ${yen(member.incomeReductionAmount)}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="rounded-md border bg-slate-50 px-3 py-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">保険料率メモ</p>
                  <p>国保: 医療分は所得割7.51%・均等割47,600円、支援分は所得割2.80%・均等割17,600円、こども分は所得割0.27%・均等割1,873円で概算します。</p>
                  <p>国保の介護分: 40歳から64歳の国保加入者について、所得割2.43%・均等割17,800円で概算します。</p>
                  <p>後期高齢者医療: 東京都の令和8・9年度料率として、医療分は所得割9.88%・均等割53,300円、子ども分は所得割0.26%・均等割1,300円で概算します。</p>
                </div>
              </section>
            </div>
          </details>
        );
      })}
    </div>
  );
}

type TaxNumberKey = Exclude<keyof TaxInsuranceByFiscalYear, "id">;

const taxFields: [TaxNumberKey, string][] = [
  ["fiscalYear", "年度"],
  ["residentTaxAnnual", "住民税年額"],
  ["incomeTaxAnnual", "所得税年額"],
  ["nationalHealthInsuranceAnnual", "国民健康保険料年額"],
  ["lateElderlyMedicalAnnual", "後期高齢者医療保険料年額"],
  ["nationalPensionMonthly", "国民年金月額"],
  ["nursingCareAnnual", "介護保険関連年額"],
  ["otherPublicCostAnnual", "その他公的負担年額"],
];

const taxSocialPaymentCategoryLabels: Record<TaxSocialPaymentCategory, string> = {
  residentTax: "住民税",
  nationalHealthInsurance: "国民健康保険料",
  nationalPension: "国民年金",
  lateElderlyMedical: "後期高齢者医療",
  nursingCare: "介護保険",
  propertyTax: "固定資産税・都市計画税",
  otherPublicCost: "その他公的負担",
};

const taxSocialPaymentCategoryShortLabels: Record<TaxSocialPaymentCategory, string> = {
  residentTax: "住民税",
  nationalHealthInsurance: "国保",
  nationalPension: "国民年金",
  lateElderlyMedical: "後期高齢者",
  nursingCare: "介護",
  propertyTax: "固定資産税",
  otherPublicCost: "その他公的負担",
};

const taxSocialPaymentCategoryAnnualKey: Partial<Record<TaxSocialPaymentCategory, keyof TaxInsuranceByFiscalYear>> = {
  residentTax: "residentTaxAnnual",
  nationalHealthInsurance: "nationalHealthInsuranceAnnual",
  lateElderlyMedical: "lateElderlyMedicalAnnual",
  nursingCare: "nursingCareAnnual",
  otherPublicCost: "otherPublicCostAnnual",
};

function getTaxSocialPaymentAutoAnnualAmount(category: TaxSocialPaymentCategory, row: TaxInsuranceByFiscalYear | undefined) {
  if (!row) return 0;
  if (category === "nationalPension") return row.nationalPensionAnnual ?? row.nationalPensionMonthly * 12;
  if (category === "propertyTax") return 0;
  const key = taxSocialPaymentCategoryAnnualKey[category];
  return key ? Number(row[key] ?? 0) : 0;
}

function getTaxSocialPaymentMemberLabel(scenario: ScenarioData, item: TaxSocialPaymentScheduleItem) {
  const memberId = item.coveredMemberId ?? item.memberId;
  if (!memberId) return "";
  const member = scenario.householdMembers.find((candidate) => candidate.id === memberId);
  return member ? ` / ${member.name}` : "";
}

function getRecurringTemplateAnnualAmount(template: RecurringTaxSocialPaymentTemplate) {
  return (template.items ?? []).reduce((sum, item) => sum + item.amount, 0);
}

function formatRecurringTemplateMonths(template: RecurringTaxSocialPaymentTemplate) {
  return (template.items ?? [])
    .map((item) => `${item.fiscalYearOffset === 1 ? "翌" : ""}${item.dueMonth}月 ${yen(item.amount)}`)
    .join(" / ");
}

function NoticeActualTaxSocialPaymentCard({
  scenario,
  updateScenario,
  effectiveRows,
  simulationResult,
  onOpenTaxCashPaymentTiming,
}: {
  scenario: ScenarioData;
  updateScenario: (updater: (scenario: ScenarioData) => void) => void;
  effectiveRows: TaxInsuranceByFiscalYear[];
  simulationResult: ReturnType<typeof simulateScenario>;
  onOpenTaxCashPaymentTiming: () => void;
}) {
  const schedule = (scenario.taxSocialPaymentSchedule ?? [])
    .filter((item) => item.dueYearMonth && item.category && Number.isFinite(item.amount))
    .sort((a, b) => a.dueYearMonth.localeCompare(b.dueYearMonth) || a.category.localeCompare(b.category));
  const recurringPropertyTaxTemplates = (scenario.recurringTaxSocialPaymentTemplates ?? []).filter(
    (template) => template.category === "propertyTax",
  );
  const nextPaymentSummary = getNextNoticePaymentMonthSummary(schedule, scenario.userProfile.simulationStartYearMonth);
  const paymentYearSummaries = summarizeNoticePaymentsByPaymentYear(schedule);
  const groups = new Map<string, {
    fiscalYear?: number;
    category: TaxSocialPaymentCategory;
    total: number;
    months: Set<string>;
    notes: string[];
    members: Set<string>;
  }>();
  for (const item of schedule) {
    const key = `${item.fiscalYear ?? "年度未設定"}-${item.category}`;
    const group = groups.get(key) ?? {
      fiscalYear: item.fiscalYear,
      category: item.category,
      total: 0,
      months: new Set<string>(),
      notes: [],
      members: new Set<string>(),
    };
    group.total += item.amount;
    group.months.add(item.dueYearMonth);
    if (item.note) group.notes.push(item.note);
    const memberLabel = getTaxSocialPaymentMemberLabel(scenario, item).replace(" / ", "");
    if (memberLabel) group.members.add(memberLabel);
    groups.set(key, group);
  }
  const pensionNeedsReview = schedule.some(
    (item) => item.category === "nationalPension" && (item.note?.includes("要確認") || item.note?.includes("確認")),
  );
  const formatCategoryTotals = (items: { category: TaxSocialPaymentCategory; total: number }[]) =>
    items.map((item) => `${taxSocialPaymentCategoryShortLabels[item.category]} ${compactYen(item.total)}`).join(" / ");
  const formatResultCashBreakdown = (summary: NoticePaymentYearSummary) => {
    const annualRow = simulationResult.annual.find((row) => row.year === summary.year);
    if (!annualRow) return "";
    const breakdown = annualRow.taxCashBreakdown;
    const parts = summary.categories.flatMap((item) => {
      if (item.category === "residentTax") return [`住民税 ${compactYen(breakdown.residentTax)}`];
      if (item.category === "nationalHealthInsurance") return [`国保 ${compactYen(breakdown.nationalHealthInsurance)}`];
      if (item.category === "nationalPension") return [`国民年金 ${compactYen(breakdown.nationalPension)}`];
      if (item.category === "propertyTax") return [`固定資産税 ${compactYen(breakdown.propertyTax)}`];
      return [];
    });
    return parts.length ? `結果タブ確認: ${parts.join(" / ")}` : "";
  };

  return (
    <div className="rounded-lg border bg-white px-4 py-4 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-medium">通知書・実額支払</h3>
          <p className="text-sm text-muted-foreground">
            住民税、国保、国民年金、固定資産税など、通知書どおりに支払う金額を任意で登録できます。通知書がある期間は、こちらを現金支出として優先します。
          </p>
        </div>
        <div className={cn("rounded-md border px-3 py-2 text-sm", pensionNeedsReview ? "border-amber-300 bg-amber-50 text-amber-950" : "bg-slate-50 text-slate-700")}>
          国民年金: {pensionNeedsReview ? "要確認" : schedule.some((item) => item.category === "nationalPension") ? "登録済み" : "未登録"}
        </div>
      </div>
      <div>
        <Button type="button" variant="outline" onClick={onOpenTaxCashPaymentTiming}>
          <ArrowDown className="h-4 w-4" />
          実際の支払タイミングを見る
        </Button>
      </div>
      <NoticePaymentScheduleEditor scenario={scenario} updateScenario={updateScenario} />

      {schedule.length === 0 ? (
        <div className="rounded-md border bg-slate-50 px-3 py-3 text-sm text-muted-foreground">
          通知書実額はまだ登録されていません。通知書が届いたら、住民税・国保・国民年金・固定資産税などを支払月ごとに保存用JSONで補正できます。未登録でも通常の自動概算は利用できます。
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-slate-50 px-3 py-3 text-sm">
              <div className="text-muted-foreground">次回支払</div>
              <div className="mt-1 font-semibold text-slate-900">
                {nextPaymentSummary ? `${nextPaymentSummary.yearMonth} 合計 ${compactYen(nextPaymentSummary.total)}` : "なし"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {nextPaymentSummary ? formatCategoryTotals(nextPaymentSummary.categories) : "支払予定はありません。"}
              </div>
            </div>
            <div className="rounded-md border bg-slate-50 px-3 py-3 text-sm">
              <div className="text-muted-foreground">登録件数</div>
              <div className="mt-1 font-semibold text-slate-900">{schedule.length}件</div>
              <div className="mt-1 text-xs text-muted-foreground">同じ月の複数通知は月次計算で合算します。</div>
            </div>
            <div className="rounded-md border bg-slate-50 px-3 py-3 text-sm">
              <div className="text-muted-foreground">実額支払合計</div>
              <div className="mt-1 font-semibold text-slate-900">{compactYen(schedule.reduce((sum, item) => sum + item.amount, 0))}</div>
              <div className="mt-1 text-xs text-muted-foreground">固定資産税は「その他」ではなく別枠で集計します。</div>
            </div>
          </div>
          <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            <div className="font-medium">通知書実額の反映先</div>
            <div className="mt-2 space-y-2">
              {paymentYearSummaries.map((summary) => {
                const resultLine = formatResultCashBreakdown(summary);
                return (
                  <div key={summary.year}>
                    <div>
                      {summary.year}年の現金支払に反映済み: {formatCategoryTotals(summary.categories)}
                    </div>
                    {resultLine && <div className="text-xs text-sky-800">{resultLine}</div>}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-sky-800">
              ここは支払年ベースです。下の制度上の自動概算は所得発生年度ベースなので、通知書実額は混ぜていません。
            </p>
          </div>
        </>
      )}

      {recurringPropertyTaxTemplates.length > 0 && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <div className="font-medium">固定資産税・都市計画税の将来見込み</div>
          <div className="mt-2 space-y-2">
            {recurringPropertyTaxTemplates.map((template) => (
              <div key={template.id}>
                <div>{template.startFiscalYear}年度以降: 年{yen(getRecurringTemplateAnnualAmount(template))}を同じ期別で継続</div>
                <div className="text-xs text-emerald-800">
                  {formatRecurringTemplateMonths(template)} / 増減率 {((template.annualIncreaseRate ?? 0) * 100).toFixed(1)}%
                </div>
                {template.note && <div className="text-xs text-emerald-800">{template.note}</div>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-emerald-800">
            ここは通知書実額ではなく、登録した通知書などを基準にした将来見込みです。固定資産税は所得連動の自動概算には含めません。
          </p>
        </div>
      )}

      {schedule.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <thead>
                <Tr>
                  <Th>年度</Th>
                  <Th>カテゴリ</Th>
                  <Th>支払月</Th>
                  <Th>対象者</Th>
                  <Th>実額合計</Th>
                  <Th>通知書年額 − 自動概算</Th>
                  <Th>確認</Th>
                </Tr>
              </thead>
              <tbody>
                {[...groups.values()].map((group) => {
                  const annualRow = group.fiscalYear === undefined
                    ? undefined
                    : effectiveRows.find((row) => row.fiscalYear === group.fiscalYear);
                  const autoAnnual = getTaxSocialPaymentAutoAnnualAmount(group.category, annualRow);
                  const needsReview = group.notes.some((note) => note.includes("要確認") || note.includes("確認"));
                  return (
                    <Tr key={`${group.fiscalYear ?? "none"}-${group.category}`}>
                      <Td>{group.fiscalYear ? `${group.fiscalYear}年度` : "年度未設定"}</Td>
                      <Td>{taxSocialPaymentCategoryLabels[group.category]}</Td>
                      <Td>{[...group.months].sort().join(" / ")}</Td>
                      <Td>{group.members.size > 0 ? [...group.members].join(" / ") : "-"}</Td>
                      <Td>{compactYen(group.total)}</Td>
                      <Td>{compactYen(group.total - autoAnnual)}</Td>
                      <Td>{needsReview ? <span className="font-medium text-amber-700">要確認</span> : "登録済み"}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">差額は比較用です。現金支払には通知書実額を優先しています。</p>
        </>
      )}
    </div>
  );
}

function SpecialSection({
  scenario,
  scenarios,
  updateScenario,
  updateScenarios,
  onOpenTimeBucket,
}: SectionProps & {
  scenarios: ScenarioData[];
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData, backupLabel?: string) => void;
  onOpenTimeBucket: () => void;
}) {
  const [specialSyncTargetMode, setSpecialSyncTargetMode] = useState<AssetSyncTargetMode>("compare");
  const [specialSyncSelectedTargetIds, setSpecialSyncSelectedTargetIds] = useState<string[]>([]);
  const [specialSyncSourceScenarioId, setSpecialSyncSourceScenarioId] = useState(scenario.id);
  const [excludeCurrentScenarioFromSpecialSync, setExcludeCurrentScenarioFromSpecialSync] = useState(true);
  const [specialSyncOptions, setSpecialSyncOptions] = useState<SpecialSyncOptions>({
    specialExpenses: true,
  });
  const [specialSyncMessage, setSpecialSyncMessage] = useState<string | null>(null);
  const specialSyncSourceScenario = scenarios.find((item) => item.id === specialSyncSourceScenarioId) ?? scenario;
  const specialSyncSourceIsCurrentScenario = specialSyncSourceScenario.id === scenario.id;
  const specialSyncExcludedScenarioIds = useMemo(() => {
    const excludedIds = new Set<string>();
    if (excludeCurrentScenarioFromSpecialSync && !specialSyncSourceIsCurrentScenario) excludedIds.add(scenario.id);
    return excludedIds;
  }, [excludeCurrentScenarioFromSpecialSync, scenario.id, specialSyncSourceIsCurrentScenario]);
  useEffect(() => {
    if (!scenarios.some((item) => item.id === specialSyncSourceScenarioId)) {
      setSpecialSyncSourceScenarioId(scenario.id);
    }
  }, [scenario.id, scenarios, specialSyncSourceScenarioId]);
  const specialSyncSelectedTargetIdSet = useMemo(() => new Set(specialSyncSelectedTargetIds), [specialSyncSelectedTargetIds]);
  const specialSyncTargetCount = countAssetSyncTargets(
    scenarios,
    specialSyncSourceScenario.id,
    specialSyncTargetMode,
    specialSyncExcludedScenarioIds,
    specialSyncSelectedTargetIdSet,
  );
  const specialSyncTargetNames = getAssetSyncTargets(
    scenarios,
    specialSyncSourceScenario.id,
    specialSyncTargetMode,
    specialSyncExcludedScenarioIds,
    specialSyncSelectedTargetIdSet,
  ).map((item) => item.name);
  const hasSpecialSyncSelection = Object.values(specialSyncOptions).some(Boolean);
  const selectedSpecialSyncLabels = [specialSyncOptions.specialExpenses ? "特別支出リスト" : ""].filter(Boolean);
  const updateSpecialSyncOption = (key: keyof SpecialSyncOptions) => {
    setSpecialSyncOptions((current) => ({ ...current, [key]: !current[key] }));
  };
  const toggleSpecialSyncTarget = (scenarioId: string) => {
    setSpecialSyncSelectedTargetIds((current) =>
      current.includes(scenarioId) ? current.filter((id) => id !== scenarioId) : [...current, scenarioId],
    );
  };
  const applySpecialSync = () => {
    if (specialSyncTargetCount === 0 || !hasSpecialSyncSelection) return;
    const source = structuredClone(specialSyncSourceScenario);
    const confirmed = window.confirm(
      `「${source.name}」の ${selectedSpecialSyncLabels.join("、")} を、コピー元自身を除く ${specialSyncTargetCount} 件のシナリオへ反映します。` +
        (!specialSyncSourceIsCurrentScenario && excludeCurrentScenarioFromSpecialSync
          ? `現在開いている「${scenario.name}」は反映先から外します。`
          : "") +
        `\n\n反映先:\n${formatScenarioNamesForConfirm(specialSyncTargetNames)}\n\n実行しますか？`,
    );
    if (!confirmed) return;
    updateScenarios((target) => {
      if (!isAssetSyncTarget(target, source.id, specialSyncTargetMode, specialSyncExcludedScenarioIds, specialSyncSelectedTargetIdSet)) return target;
      applySpecialSyncFromSource(target, source, specialSyncOptions);
      return target;
    });
    setSpecialSyncMessage(
      `${specialSyncTargetCount} 件のシナリオへ特別支出前提を反映しました: ${formatScenarioNamesForMessage(specialSyncTargetNames)}。実行前の状態は履歴に保存されています。`,
    );
  };
  const categoryWarnings = findSpecialExpenseCategoryWarnings(scenario.specialExpenses);
  const enjoymentExpenseCount = scenario.specialExpenses.filter((event) => (event.category ?? "lifeMaintenance") === "enjoyment").length;
  const emphasizeTimeBucketLead = scenario.specialExpenses.length === 0 || enjoymentExpenseCount === 0;
  const timeBucketSpecialExpenseIds = useMemo(
    () => new Set(scenario.timeBucketItems.map((item) => item.convertedSpecialExpenseId).filter((id): id is string => Boolean(id))),
    [scenario.timeBucketItems],
  );
  const add = () =>
    updateScenario((s) =>
      s.specialExpenses.push({
        id: createId(),
        name: "新しい特別支出",
        yearMonth: s.userProfile.simulationStartYearMonth,
        amount: 0,
        category: "lifeMaintenance",
        schedule: "once",
        repeatIntervalMonths: 12,
      }),
    );
  const addLifeEventTemplate = (template: "education" | "housing" | "care" | "travel") =>
    updateScenario((s) => {
      const start = s.userProfile.simulationStartYearMonth;
      if (template === "education") {
        s.specialExpenses.push({
          id: createId(),
          name: "ライフイベント由来: 教育費",
          yearMonth: start,
          endYearMonth: addYearsToYearMonth(start, 4),
          amount: 80_000,
          category: "familySupport",
          schedule: "monthly",
          inflationMode: "livingCost",
          note: `${lifeEventNoteMarker}: 教育費テンプレート。対象者名、期間、毎月費用、一時金はこの通常入力で調整してください。`,
        });
        s.specialExpenses.push({
          id: createId(),
          name: "ライフイベント由来: 入学金・一時金",
          yearMonth: start,
          amount: 500_000,
          category: "familySupport",
          schedule: "once",
          inflationMode: "livingCost",
          note: `${lifeEventNoteMarker}: 教育費テンプレートの一時金です。`,
        });
      }
      if (template === "housing") {
        s.specialExpenses.push({
          id: createId(),
          name: "ライフイベント由来: 住宅ローン・住まい",
          yearMonth: start,
          endYearMonth: addYearsToYearMonth(start, 10),
          amount: 120_000,
          category: "housingCar",
          schedule: "monthly",
          inflationMode: "none",
          note: `${lifeEventNoteMarker}: 住宅ローン・住まいテンプレート。返済終了年月、固定資産税、リフォーム予定は通常入力で調整してください。`,
        });
        s.specialExpenses.push({
          id: createId(),
          name: "ライフイベント由来: リフォーム一時金",
          yearMonth: addYearsToYearMonth(start, 8),
          amount: 1_500_000,
          category: "housingCar",
          schedule: "once",
          inflationMode: "livingCost",
          note: `${lifeEventNoteMarker}: 住宅ローン・住まいテンプレートのリフォーム一時金です。`,
        });
      }
      if (template === "care") {
        s.specialExpenses.push({
          id: createId(),
          name: "ライフイベント由来: 親の介護・支援",
          yearMonth: addYearsToYearMonth(start, 5),
          endYearMonth: addYearsToYearMonth(start, 9),
          amount: 50_000,
          category: "familySupport",
          schedule: "monthly",
          inflationMode: "livingCost",
          note: `${lifeEventNoteMarker}: 親の介護・支援テンプレート。確度が可能性ありの場合は別シナリオでも確認してください。`,
        });
      }
      if (template === "travel") {
        const specialExpenseId = createId();
        s.specialExpenses.push({
          id: specialExpenseId,
          name: "ライフイベント由来: 家族旅行・体験",
          yearMonth: addYearsToYearMonth(start, 1),
          endYearMonth: addYearsToYearMonth(start, 10),
          amount: 300_000,
          category: "enjoyment",
          schedule: "yearly",
          inflationMode: "livingCost",
          note: `${lifeEventNoteMarker}: 家族旅行・体験テンプレート。タイムバケットにも候補として追加済みです。`,
        });
        s.timeBucketItems.push({
          id: createId(),
          title: "家族旅行・体験",
          bucketId: "todo",
          convertedSpecialExpenseId: specialExpenseId,
          note: "ライフイベントテンプレートから追加しました。",
        });
      }
    });
  const duplicate = (index: number) =>
    updateScenario((s) => {
      const source = s.specialExpenses[index];
      if (!source) return;
      s.specialExpenses.splice(index + 1, 0, {
        ...structuredClone(source),
        id: createId(),
        name: source.name ? `${source.name} コピー` : "特別支出 コピー",
      });
    });
  const deleteSpecialExpense = (index: number) =>
    updateScenario((s) => {
      const [removed] = s.specialExpenses.splice(index, 1);
      if (!removed) return;
      for (const item of s.timeBucketItems) {
        if (item.convertedSpecialExpenseId === removed.id) {
          item.convertedSpecialExpenseId = undefined;
        }
      }
    });
  const moveSpecialExpense = (fromIndex: number, toIndex: number) =>
    updateScenario((s) => {
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || fromIndex >= s.specialExpenses.length) return;
      const boundedToIndex = Math.max(0, Math.min(toIndex, s.specialExpenses.length - 1));
      const [event] = s.specialExpenses.splice(fromIndex, 1);
      if (!event) return;
      s.specialExpenses.splice(boundedToIndex, 0, event);
    });
  return (
    <Card id="special-expenses" data-input-card-id="special-expenses">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>特別支出入力</CardTitle>
            <CardDescription>旅行、修繕、家電買替など、該当月のみ反映します。</CardDescription>
          </div>
          <Button onClick={add}>
            <Plus className="h-4 w-4" />
            追加
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm leading-6",
            emphasizeTimeBucketLead ? "border-amber-200 bg-amber-50 text-amber-950" : "bg-slate-50 text-slate-800",
          )}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-medium">やりたいことから作る</p>
              <p className="mt-1">
                旅行・趣味・家族イベントなどは、資産活用のタイムバケットで整理してから、計算に入れるものだけ特別支出に変換できます。
              </p>
              <p className="mt-1 text-xs">
                現在の特別支出 {scenario.specialExpenses.length}件 / 楽しみカテゴリ {enjoymentExpenseCount}件
              </p>
            </div>
            <Button className="shrink-0" onClick={onOpenTimeBucket}>
              資産活用でやりたいことを整理
            </Button>
          </div>
        </div>
        {categoryWarnings.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-medium">楽しみ支出として扱う可能性がある項目があります</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {categoryWarnings.map((warning) => (
                <li key={warning.eventId}>
                  {warning.eventName}: {warning.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm leading-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-medium text-slate-900">ライフイベントテンプレート</p>
              <p className="mt-1 text-muted-foreground">
                教育費、住宅ローン・住まい、親の介護・支援、家族旅行・体験を見落とさないための入力補助です。追加後は通常の特別支出として編集できます。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => addLifeEventTemplate("education")}>
                教育費
              </Button>
              <Button variant="outline" size="sm" onClick={() => addLifeEventTemplate("housing")}>
                住宅ローン・住まい
              </Button>
              <Button variant="outline" size="sm" onClick={() => addLifeEventTemplate("care")}>
                親の介護・支援
              </Button>
              <Button variant="outline" size="sm" onClick={() => addLifeEventTemplate("travel")}>
                家族旅行・体験
              </Button>
            </div>
          </div>
        </div>
        {scenario.specialExpenses.map((event, index) => {
          const isEnjoyment = (event.category ?? "lifeMaintenance") === "enjoyment";
          const linkedTimeBucketItem = scenario.timeBucketItems.find((item) => item.convertedSpecialExpenseId === event.id);
          const isFromTimeBucket = Boolean(linkedTimeBucketItem) || timeBucketSpecialExpenseIds.has(event.id);
          return (
          <EventEditor
            key={event.id}
            title={event.name || "特別支出"}
            className={isEnjoyment ? "border-rose-200 bg-rose-50/40 shadow-sm" : undefined}
            onDelete={() => deleteSpecialExpense(index)}
            actions={
              <>
                {isEnjoyment && (
                  <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800">
                    楽しみ
                  </span>
                )}
                {isFromTimeBucket && (
                  <>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                      タイムバケット由来{linkedTimeBucketItem ? `: ${linkedTimeBucketItem.title}` : ""}
                    </span>
                    <Button variant="ghost" size="sm" onClick={onOpenTimeBucket}>
                      タイムバケットへ
                    </Button>
                  </>
                )}
                {(event.note?.includes(lifeEventNoteMarker) || event.name.includes(lifeEventNoteMarker)) && (
                  <span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-medium text-teal-800">
                    ライフイベント由来
                  </span>
                )}
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  順番
                  <Select
                    className="h-8 w-24 py-1 text-xs"
                    value={String(index)}
                    onChange={(event) => moveSpecialExpense(index, Number(event.target.value))}
                    aria-label={`${event.name || "特別支出"} の順番`}
                  >
                    {scenario.specialExpenses.map((item, orderIndex) => (
                      <option key={item.id} value={orderIndex}>
                        {orderIndex + 1}番目
                      </option>
                    ))}
                  </Select>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveSpecialExpense(index, index - 1)}
                  disabled={index === 0}
                  title="上へ移動"
                >
                  <ArrowUp className="h-4 w-4" />
                  上へ
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveSpecialExpense(index, index + 1)}
                  disabled={index === scenario.specialExpenses.length - 1}
                  title="下へ移動"
                >
                  <ArrowDown className="h-4 w-4" />
                  下へ
                </Button>
                <Button variant="ghost" size="sm" onClick={() => duplicate(index)}>
                  <Copy className="h-4 w-4" />
                  複製
                </Button>
              </>
            }
          >
            <FormGrid>
              <Field label="名称">
                <Input value={event.name} onChange={(e) => updateScenario((s) => void (s.specialExpenses[index].name = e.target.value))} />
              </Field>
              <Field label="計算方式">
                <Select
                  value={event.schedule ?? "once"}
                  onChange={(e) =>
                    updateScenario((s) => {
                      const schedule = e.target.value as SpecialExpenseEvent["schedule"];
                      s.specialExpenses[index].schedule = schedule;
                      if (schedule === "quarterly") s.specialExpenses[index].repeatIntervalMonths = 3;
                      else if (schedule === "semiannual") s.specialExpenses[index].repeatIntervalMonths = 6;
                      else if (schedule === "yearly") s.specialExpenses[index].repeatIntervalMonths = 12;
                      else if (schedule === "seasonalMonthly") {
                        s.specialExpenses[index].repeatIntervalMonths = 1;
                        s.specialExpenses[index].activeStartMonth = s.specialExpenses[index].activeStartMonth ?? 3;
                        s.specialExpenses[index].activeEndMonth = s.specialExpenses[index].activeEndMonth ?? 11;
                      }
                      else if (schedule === "monthly") s.specialExpenses[index].repeatIntervalMonths = 1;
                      else if (schedule === "once") s.specialExpenses[index].repeatIntervalMonths = undefined;
                      else s.specialExpenses[index].repeatIntervalMonths = s.specialExpenses[index].repeatIntervalMonths ?? 12;
                    })
                  }
                >
                  <option value="once">単発</option>
                  <option value="monthly">毎月発生</option>
                  <option value="quarterly">四半期に1回</option>
                  <option value="semiannual">半年に1回</option>
                  <option value="yearly">毎年発生</option>
                  <option value="seasonalMonthly">毎年 指定月だけ毎月</option>
                  <option value="customInterval">任意の月数ごと</option>
                </Select>
              </Field>
              <Field label="カテゴリ">
                <Select
                  value={event.category ?? "lifeMaintenance"}
                  onChange={(e) => updateScenario((s) => void (s.specialExpenses[index].category = e.target.value as SpecialExpenseCategory))}
                >
                  {Object.entries(specialExpenseCategoryLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={event.schedule && event.schedule !== "once" ? "開始年月" : "年月"}>
                <Input
                  type="month"
                  value={event.yearMonth}
                  onChange={(e) => updateScenario((s) => void (s.specialExpenses[index].yearMonth = e.target.value))}
                />
              </Field>
              <Field label="終了年月">
                <Input
                  type="month"
                  value={event.endYearMonth ?? ""}
                  onChange={(e) => updateScenario((s) => void (s.specialExpenses[index].endYearMonth = e.target.value || undefined))}
                />
              </Field>
              {event.schedule === "customInterval" && (
                <Field label="何か月ごと">
                  <Input
                    type="number"
                    min={1}
                    value={event.repeatIntervalMonths ?? 12}
                    onChange={(e) =>
                      updateScenario((s) => void (s.specialExpenses[index].repeatIntervalMonths = Math.max(1, numberOrZero(e.target.value))))
                    }
                  />
                </Field>
              )}
              {event.schedule === "seasonalMonthly" && (
                <>
                  <Field label="発生開始月">
                    <Select
                      value={String(event.activeStartMonth ?? 3)}
                      onChange={(e) => updateScenario((s) => void (s.specialExpenses[index].activeStartMonth = numberOrZero(e.target.value)))}
                    >
                      {monthOptions.map((month) => (
                        <option key={month} value={month}>
                          {month}月
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="発生終了月">
                    <Select
                      value={String(event.activeEndMonth ?? 11)}
                      onChange={(e) => updateScenario((s) => void (s.specialExpenses[index].activeEndMonth = numberOrZero(e.target.value)))}
                    >
                      {monthOptions.map((month) => (
                        <option key={month} value={month}>
                          {month}月
                        </option>
                      ))}
                    </Select>
                  </Field>
                </>
              )}
              <Field label="金額">
                <Input type="number" value={event.amount} onChange={(e) => updateScenario((s) => void (s.specialExpenses[index].amount = numberOrZero(e.target.value)))} />
              </Field>
              <Field label="インフレ反映">
                <Select
                  value={event.inflationMode ?? "none"}
                  onChange={(e) =>
                    updateScenario((s) => {
                      const mode = e.target.value as NonNullable<SpecialExpenseEvent["inflationMode"]>;
                      s.specialExpenses[index].inflationMode = mode;
                      if (mode === "custom") {
                        s.specialExpenses[index].customAnnualInflationRate = s.specialExpenses[index].customAnnualInflationRate ?? 0.02;
                      }
                    })
                  }
                >
                  <option value="none">反映しない</option>
                  <option value="livingCost">生活費インフレ率を使う</option>
                  <option value="medical">医療インフレ率を使う</option>
                  <option value="custom">個別指定</option>
                </Select>
              </Field>
              {event.inflationMode === "custom" && (
                <RateField
                  label="特別支出インフレ率"
                  value={event.customAnnualInflationRate ?? 0}
                  onChange={(value) => updateScenario((s) => void (s.specialExpenses[index].customAnnualInflationRate = value))}
                />
              )}
            </FormGrid>
          </EventEditor>
          );
        })}
        <ScenarioSyncDetails
          title="他シナリオへ反映（必要時のみ）"
          description="特別支出リストをまとめてコピーする時だけ開きます。"
        >
        <div className="rounded-lg border bg-white px-4 py-3">
          <div className="grid gap-4 lg:grid-cols-[minmax(260px,420px)_1fr]">
            <Field label="コピー元シナリオ">
              <Select value={specialSyncSourceScenario.id} onChange={(event) => setSpecialSyncSourceScenarioId(event.target.value)}>
                {scenarios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
              現在のコピー元は「{specialSyncSourceScenario.name}」です。特別支出リストの反映だけに使い、表示中シナリオの入力欄は切り替えません。
            </div>
          </div>
          {!specialSyncSourceIsCurrentScenario && (
            <label className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <input
                type="checkbox"
                checked={excludeCurrentScenarioFromSpecialSync}
                onChange={(event) => setExcludeCurrentScenarioFromSpecialSync(event.target.checked)}
              />
              <span>
                <span className="block font-medium">現在開いているシナリオは上書きしない</span>
                <span className="text-xs">
                  「{scenario.name}」を見ながら別シナリオをコピー元にする場合の誤反映を防ぎます。意図して現在のシナリオにも反映する場合だけ外してください。
                </span>
              </span>
            </label>
          )}
        </div>
        <ScenarioSyncCard<keyof SpecialSyncOptions>
          title="特別支出前提を他シナリオへ反映"
          description="コピー元シナリオを選び、旅行・修繕・家電買替などの特別支出リストを他シナリオへ反映します。"
          targetMode={specialSyncTargetMode}
          setTargetMode={setSpecialSyncTargetMode}
          targetCount={specialSyncTargetCount}
          targetNames={specialSyncTargetNames}
          allScenarios={scenarios}
          sourceScenarioId={specialSyncSourceScenario.id}
          excludedScenarioIds={specialSyncExcludedScenarioIds}
          selectedTargetIds={specialSyncSelectedTargetIdSet}
          toggleSelectedTarget={toggleSpecialSyncTarget}
          targetSummary={
            `コピー元「${specialSyncSourceScenario.name}」自身を除く ${specialSyncTargetCount} 件に反映します。` +
            (!specialSyncSourceIsCurrentScenario && excludeCurrentScenarioFromSpecialSync
              ? `現在開いている「${scenario.name}」も誤操作防止のため反映先から外します。`
              : "") +
            "反映先の既存の特別支出リストは、コピー元のリストで置き換わります。"
          }
          options={[
            { key: "specialExpenses", label: "特別支出リスト", description: "名称、年月、金額、カテゴリ、繰り返し設定、インフレ設定" },
          ]}
          selectedOptions={specialSyncOptions}
          toggleOption={updateSpecialSyncOption}
          warningText="反映は明示実行時だけです。シナリオごとに違う旅行・修繕などを置いている場合は、反映先を確認してください。"
          onApply={applySpecialSync}
          message={specialSyncMessage}
          optionGridClassName="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        />
        </ScenarioSyncDetails>
      </CardContent>
    </Card>
  );
}

function ScenariosSection(props: {
  scenarios: ScenarioData[];
  activeScenarioId: string;
  setActiveScenario: (id: string) => void;
  duplicateScenario: (id: string) => void;
  deleteScenario: (id: string) => void;
  moveScenario: (id: string, direction: "up" | "down") => void;
  toggleScenarioCompare: (id: string) => void;
  updateScenario: (updater: (scenario: ScenarioData) => void) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>シナリオ管理</CardTitle>
        <CardDescription>複製して生活費や収入だけを変え、比較対象に含めるかを切り替えます。</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <thead>
            <Tr>
              <Th>シナリオ</Th>
              <Th>比較</Th>
              <Th>対象資産</Th>
              <Th>月生活費</Th>
              <Th>操作</Th>
            </Tr>
          </thead>
          <tbody>
            {props.scenarios.map((scenario, index) => (
              <Tr key={scenario.id}>
                <Td>
                  <button className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => props.setActiveScenario(scenario.id)}>
                    {scenario.name}
                  </button>
                  {scenario.id === props.activeScenarioId && <span className="ml-2 text-xs text-muted-foreground">選択中</span>}
                </Td>
                <Td>
                  <input type="checkbox" checked={scenario.compare} onChange={() => props.toggleScenarioCompare(scenario.id)} />
                </Td>
                <Td>{compactYen(getSimulationTargetAssets(scenario))}</Td>
                <Td>{compactYen(getBaseMonthlyExpense(scenario.monthlyExpenses, shouldIgnoreTaxExpenseField(scenario)))}</Td>
                <Td className="space-x-2 whitespace-nowrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => props.moveScenario(scenario.id, "up")}
                    disabled={index === 0}
                    title="上へ移動"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => props.moveScenario(scenario.id, "down")}
                    disabled={index === props.scenarios.length - 1}
                    title="下へ移動"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => props.duplicateScenario(scenario.id)}>
                    <Copy className="h-4 w-4" />
                    複製
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => props.deleteScenario(scenario.id)}>
                    <Trash2 className="h-4 w-4" />
                    削除
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ResultsSection({
  scenario,
  result,
  onOpenInputCard,
  inputCards,
  onOpenInputGuide,
}: {
  scenario: ScenarioData;
  result: ReturnType<typeof simulateScenario>;
  onOpenInputCard: (cardId: InputCardId) => void;
  inputCards: InputCardDefinition[];
  onOpenInputGuide: () => void;
}) {
  const annualIncome = result.annual.reduce((sum, row) => sum + row.incomeTotal, 0);
  const annualRetainedSourceIncome = result.annual.reduce((sum, row) => sum + row.retainedSourceAssetIncomeTotal, 0);
  const annualAssetTransfer = result.annual.reduce((sum, row) => sum + row.assetTransferTotal, 0);
  const annualOptionRelease = result.annual.reduce((sum, row) => sum + row.optionAccountReleaseTotal, 0);
  const annualOptionSweep = result.annual.reduce((sum, row) => sum + row.optionProfitSweepTotal, 0);
  const annualOptionSuspended = result.annual.reduce((sum, row) => sum + row.optionIncomeSuspendedTotal, 0);
  const annualNisaSkipped = result.annual.reduce((sum, row) => sum + row.nisaContributionSkippedTotal, 0);
  const annualNisaLimitExceeded = result.annual.reduce((sum, row) => sum + row.nisaAnnualLimitExceededTotal, 0);
  const annualLiving = result.annual.reduce((sum, row) => sum + row.livingExpenseTotal, 0);
  const annualTaxSocial = result.annual.reduce((sum, row) => sum + row.taxInsuranceTotal, 0);
  const annualCapitalGainsTax = result.annual.reduce((sum, row) => sum + row.capitalGainsTaxTotal, 0);
  const annualIdecoWithholding = result.annual.reduce((sum, row) => sum + row.idecoWithholdingTaxTotal, 0);
  const annualSpecial = result.annual.reduce((sum, row) => sum + row.specialExpenseTotal, 0);
  const annualContribution = result.annual.reduce((sum, row) => sum + row.assetContributionTotal, 0);
  const annualContributionGap = result.annual.reduce((sum, row) => sum + row.assetContributionFundingGap, 0);
  const annualIdecoFee = result.annual.reduce((sum, row) => sum + row.idecoFeeTotal, 0);
  const annualReserveTopUp = result.annual.reduce((sum, row) => sum + row.cashReserveTopUpAmount, 0);
  const annualGrossWithdrawal = result.annual.reduce((sum, row) => sum + row.grossAssetWithdrawalAmount, 0);
  const annualPlannedDrawdown = result.annual.reduce((sum, row) => sum + row.plannedDrawdownTotal, 0);
  const annualNet = result.annual.reduce((sum, row) => sum + row.netCashFlow, 0);
  const latestAnnual = result.annual.at(-1);
  const latestNisaCumulativeInvestment = latestAnnual?.nisaCumulativeInvestment ?? 0;
  const latestNisaRemainingLifetimeLimit = latestAnnual?.nisaRemainingLifetimeLimit ?? 0;
  const latestTrackedGainTotal = latestAnnual
    ? gainTrackedAssets.reduce((sum, asset) => sum + latestAnnual.endingTrackedAssetUnrealizedGains[asset.key], 0)
    : 0;
  const liquidFlowSummaryData = result.annual.map((row) => {
    const cashOut =
      row.livingExpenseTotal +
      row.taxInsuranceTotal +
      row.capitalGainsTaxTotal +
      row.idecoWithholdingTaxTotal +
      row.idecoFeeTotal +
      row.specialExpenseTotal +
      row.assetContributionTotal;

    return {
      ...row,
      label: yearEndAgeLabel(row.year, row.ageYears),
      startLiquid: row.startingLiquidBuffer,
      endLiquid: row.endingLiquidBuffer,
      liquidChange: row.endingLiquidBuffer - row.startingLiquidBuffer,
      cashIn: row.incomeTotal,
      internalIn: row.optionProfitSweepTotal + row.optionAccountReleaseTotal,
      internalOut: -row.assetTransferTotal,
      cashOut: -cashOut,
      net: row.netCashFlow,
    };
  });
  const assetTransferRows = result.annual.filter((row) => row.assetTransferTotal > 0);
  const optionReleaseRows = result.annual.filter((row) => row.optionAccountReleaseTotal > 0);
  const optionProfitVisibilityRows = result.annual.filter(
    (row) =>
      row.declaredCapitalGainsIncomeTotal > 0 ||
      row.retainedSourceAssetIncomeTotal > 0 ||
      row.optionProfitSweepTotal > 0 ||
      row.optionAccountReleaseTotal > 0 ||
      row.optionIncomeSuspendedTotal > 0,
  );
  const unrealizedGainChartData = result.annual.map((row) => ({
    label: yearEndAgeLabel(row.year, row.ageYears),
    total: gainTrackedAssets.reduce((sum, asset) => sum + row.endingTrackedAssetUnrealizedGains[asset.key], 0),
    nisa: row.endingTrackedAssetUnrealizedGains.nisa,
    specificAccount: row.endingTrackedAssetUnrealizedGains.specificAccount,
    ordinaryAccountForOptions: row.endingTrackedAssetUnrealizedGains.ordinaryAccountForOptions,
    ideco: row.endingTrackedAssetUnrealizedGains.ideco,
  }));
  const optionsCollateralChartData = result.annual.map((row) => ({
    label: yearEndAgeLabel(row.year, row.ageYears),
    balance: row.endingTrackedAssetBalances.ordinaryAccountForOptions,
    basis: row.endingTrackedAssetCostBasis.ordinaryAccountForOptions,
    gain: row.endingTrackedAssetUnrealizedGains.ordinaryAccountForOptions,
  }));
  const optionsRealizedProfitChartData = result.annual.map((row) => ({
    label: yearEndAgeLabel(row.year, row.ageYears),
    declaredProfit: row.declaredCapitalGainsIncomeTotal,
    retainedProfit: row.retainedSourceAssetIncomeTotal,
    sweptProfit: row.optionProfitSweepTotal,
    releasedCollateral: row.optionAccountReleaseTotal,
    suspendedProfit: row.optionIncomeSuspendedTotal,
  }));
  const nisaLimitChartData = result.annual.map((row) => ({
    label: yearEndAgeLabel(row.year, row.ageYears),
    cumulative: row.nisaCumulativeInvestment,
    remaining: Number.isFinite(row.nisaRemainingLifetimeLimit) ? row.nisaRemainingLifetimeLimit : 0,
    annualContribution: row.nisaContributionTotal,
    skipped: row.nisaContributionSkippedTotal,
  }));
  const monthlyDiagnosticRows = result.monthly.filter((row) => row.yearMonth >= "2035-12" && row.yearMonth <= "2038-01");
  const declaredGainImpactRows = result.annual
    .map((incomeYearRow) => {
      const paymentYearRow = result.annual.find((row) => row.year === incomeYearRow.year + 1);
      const taxCash = paymentYearRow?.taxCashBreakdown;
      const declaredOptionTax = declaredOptionTaxBreakdownForDisplay(incomeYearRow.declaredCapitalGainsIncomeTotal);
      const taxTotal = taxCash
        ? taxCash.incomeTaxSettlement + taxCash.residentTax + taxCash.deferredCapitalGainsTax
        : 0;
      const socialInsuranceTotal = taxCash
        ? taxCash.nationalPension +
          taxCash.nationalHealthInsurance +
          taxCash.lateElderlyMedical +
          taxCash.nursingCare +
          taxCash.propertyTax +
          taxCash.otherPublicCost
        : 0;

      return {
        incomeYear: incomeYearRow.year,
        incomeAgeYears: incomeYearRow.ageYears,
        declaredGain: incomeYearRow.declaredCapitalGainsIncomeTotal,
        declaredIncomeTaxEquivalent: declaredOptionTax.incomeTaxEquivalent,
        declaredResidentTaxEquivalent: declaredOptionTax.residentTaxEquivalent,
        declaredTaxEquivalentTotal: declaredOptionTax.totalEquivalent,
        paymentYear: paymentYearRow?.year,
        paymentAgeYears: paymentYearRow?.ageYears,
        incomeTaxSettlement: taxCash?.incomeTaxSettlement ?? 0,
        residentTax: taxCash?.residentTax ?? 0,
        deferredCapitalGainsTax: taxCash?.deferredCapitalGainsTax ?? 0,
        nationalHealthInsurance: taxCash?.nationalHealthInsurance ?? 0,
        lateElderlyMedical: taxCash?.lateElderlyMedical ?? 0,
        nursingCare: taxCash?.nursingCare ?? 0,
        nationalPension: taxCash?.nationalPension ?? 0,
        propertyTax: taxCash?.propertyTax ?? 0,
        otherPublicCost: taxCash?.otherPublicCost ?? 0,
        taxTotal,
        socialInsuranceTotal,
      };
    })
    .filter((row) => row.declaredGain > 0);
  const incomeBurdenGuideRows = result.annual
    .map((paymentYearRow) => {
      const incomeYearRow = result.annual.find((row) => row.year === paymentYearRow.year - 1);
      const taxCash = paymentYearRow.taxCashBreakdown;
      const taxTotal =
        taxCash.incomeTaxSettlement + taxCash.residentTax + taxCash.deferredCapitalGainsTax + paymentYearRow.capitalGainsTaxTotal;
      const socialInsuranceTotal =
        taxCash.nationalPension +
        taxCash.nationalHealthInsurance +
        taxCash.lateElderlyMedical +
        taxCash.nursingCare +
        taxCash.propertyTax +
        taxCash.otherPublicCost;

      return {
        paymentYear: paymentYearRow.year,
        paymentAgeYears: paymentYearRow.ageYears,
        incomeYear: incomeYearRow?.year,
        incomeAgeYears: incomeYearRow?.ageYears,
        previousCashIncome: incomeYearRow?.incomeTotal ?? 0,
        previousDeclaredGain: incomeYearRow?.declaredCapitalGainsIncomeTotal ?? 0,
        previousReferenceIncome: (incomeYearRow?.incomeTotal ?? 0) + (incomeYearRow?.declaredCapitalGainsIncomeTotal ?? 0),
        incomeTaxSettlement: taxCash.incomeTaxSettlement,
        residentTax: taxCash.residentTax,
        nationalPension: taxCash.nationalPension,
        nationalHealthInsurance: taxCash.nationalHealthInsurance,
        lateElderlyMedical: taxCash.lateElderlyMedical,
        nursingCare: taxCash.nursingCare,
        propertyTax: taxCash.propertyTax,
        socialInsuranceTotal,
        taxAndSocialTotal: taxTotal + socialInsuranceTotal,
      };
    })
    .filter(
      (row) =>
        row.incomeYear !== undefined &&
        (row.previousCashIncome > 0 || row.previousDeclaredGain > 0 || row.taxAndSocialTotal > 0),
    );
  const showSourceFreeDeferredCapitalGainsTax = result.annual.some(
    (row) => row.taxCashBreakdown.deferredCapitalGainsTax > 0,
  );
  const resultStickyHeaderClass = "sticky left-0 z-30 bg-white shadow-[1px_0_0_#cbd5e1]";
  const resultStickyCellClass = "sticky left-0 z-20 bg-white shadow-[1px_0_0_#cbd5e1]";
  const resultsRequiredComplete = inputCards.filter((card) => card.priority === "required").every(isInputCardSatisfied);
  const resultsNextCard = getNextInputCard(inputCards);
  const resultReturnModel = getEffectiveReturnModel(scenario.assetGrowthSettings);
  const resultReturnModeLabel =
    resultReturnModel.mode === "historicalSinglePath"
      ? "過去実績・単一期間"
      : resultReturnModel.mode === "historicalRollingRange"
        ? "過去実績・範囲検証"
        : "固定年率";
  const resultReturnSummaryRows =
    resultReturnModel.mode === "historicalSinglePath" || resultReturnModel.mode === "historicalRollingRange"
      ? historicalReturnAssetKeys.map((key) => `${growthAssetLabels[key]}: ${getHistoricalReturnPresetLabel(resultReturnModel.assetMappings[key])}`)
      : [];
  const resultHistoricalCurrencyMode =
    resultReturnModel.mode === "historicalSinglePath" || resultReturnModel.mode === "historicalRollingRange"
      ? getHistoricalCurrencyMode(resultReturnModel)
      : "indexOnly";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>次に確認すること</CardTitle>
              <CardDescription>結果で気になる数字がある場合は、該当する入力カードや根拠へ戻れます。</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {resultsNextCard && (
                <Button variant="outline" size="sm" onClick={() => onOpenInputCard(resultsNextCard.id)}>
                  {inputCardActionButtonLabel(resultsNextCard, resultsRequiredComplete)}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onOpenInputGuide}>
                入力ガイド
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenInputCard("expenses-monthly")}>
            生活費を見直す
          </Button>
          <Button variant="outline" onClick={() => onOpenInputCard("income-pension")}>
            収入を確認する
          </Button>
          <Button variant="outline" onClick={() => onOpenInputCard("tax-mode")}>
            税社保の根拠を見る
          </Button>
          <Button variant="outline" onClick={() => onOpenInputCard("assets-cost-basis")}>
            取得原価を確認する
          </Button>
        </CardContent>
      </Card>
      <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm leading-6">
        <div className="font-medium">運用リターン設定</div>
        <p className="mt-1 text-muted-foreground">方式: {resultReturnModeLabel}</p>
        {resultReturnModel.mode === "historicalSinglePath" || resultReturnModel.mode === "historicalRollingRange" ? (
          <div className="text-muted-foreground">
            <p>
              データ: {historicalReturnDataset.label}（{historicalReturnDataset.firstMonth}〜{historicalReturnDataset.lastMonth}） / 為替モード:
              {" "}{historicalCurrencyModeLabels[resultHistoricalCurrencyMode]}
            </p>
            <p>配分: {resultReturnSummaryRows.join(" / ")}</p>
            {resultHistoricalCurrencyMode === "jpyConverted" && (
              <p>円換算リターンは、過去のUSD/JPY変動を同じ月の米国株・米国債券リターンに重ねた検証です。将来の為替を保証するものではありません。</p>
            )}
            {resultReturnModel.mode === "historicalRollingRange" && (
              <p>通常結果は範囲検証の中央値や最悪ケースへ置き換えません。過去市場ストレステストは初期資産タブで実行します。</p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">資産別固定年率を使っています。</p>
        )}
      </div>
      <div className="grid gap-3 text-sm leading-6 md:grid-cols-3">
        <div className="rounded-md border bg-slate-50 px-4 py-3">
          <div className="font-medium">このタブで見ること</div>
          <p className="mt-1 text-muted-foreground">年次・月次の資産推移と、現金が詰まる原因を確認します。</p>
        </div>
        <div className="rounded-md border bg-slate-50 px-4 py-3">
          <div className="font-medium">先に見る表</div>
          <p className="mt-1 text-muted-foreground">年別収支表と月別収支表です。累計サマリーは必要な時だけ開きます。</p>
        </div>
        <div className="rounded-md border bg-slate-50 px-4 py-3">
          <div className="font-medium">原因を深掘りする時</div>
          <p className="mt-1 text-muted-foreground">投資計画、税支払タイミング、一般口座損益、月次診断を順に確認します。</p>
        </div>
      </div>
      <ScenarioSyncDetails
        title="累計サマリー"
        description="収入、支出、投資、税社保、資産移動の累計をまとめて確認します。"
      >
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Metric title="累計現金収入" value={compactYen(annualIncome)} sub="源泉・手数料控除後" />
        <Metric title="累計口座内積上" value={compactYen(annualRetainedSourceIncome)} sub="現金化せず原資口座に残した利益" />
        <Metric title="累計原資移動" value={compactYen(annualAssetTransfer)} sub="現金・預金から運用口座へ移した額" />
        <Metric title="累計一般口座利益移動" value={compactYen(annualOptionSweep)} sub="目標残高超過分などの移動" />
        <Metric title="累計一般口座終了戻し" value={compactYen(annualOptionRelease)} sub="終了後に普通預金へ戻した残高" />
        <Metric title="累計証拠金不足停止" value={compactYen(annualOptionSuspended)} sub="最低維持額未満で止めた収益" />
        <Metric title="累計NISA未実行" value={compactYen(annualNisaSkipped)} sub="原資不足で実行しなかった積立" />
        <Metric title="累計NISA枠超過" value={compactYen(annualNisaLimitExceeded)} sub="年間枠を超えた予定額" />
        <Metric title="NISA累計投資額" value={compactYen(latestNisaCumulativeInvestment)} sub={latestAnnual ? `${latestAnnual.year}年末時点` : "年末時点"} />
        <Metric title="残りNISA枠" value={compactLimitYen(latestNisaRemainingLifetimeLimit)} sub="生涯投資枠の残り" />
        <Metric title="累計生活費" value={compactYen(annualLiving)} sub="税社保を除く生活費" />
        <Metric title="累計税社保支払" value={compactYen(annualTaxSocial)} sub="前年所得等に対する現金支出" />
        <Metric title="累計譲渡益税" value={compactYen(annualCapitalGainsTax)} sub="課税口座売却時または翌年反映" />
        <Metric title="累計iDeCo源泉" value={compactYen(annualIdecoWithholding)} sub="受取時に差し引き" />
        <Metric title="累計特別支出" value={compactYen(annualSpecial)} sub="単発支出" />
        <Metric title="累計追加投資" value={compactYen(annualContribution)} sub="毎月の積立" />
        <Metric title="累計追加投資原資不足" value={compactYen(annualContributionGap)} sub="現金・普通預金でも賄えなかった積立額" />
        <Metric title="累計iDeCo手数料" value={compactYen(annualIdecoFee)} sub="受取期間中の管理・振込手数料" />
        <Metric title="累計流動資金（現金・普通預金）補充" value={compactYen(annualReserveTopUp)} sub="現金と普通預金の最低保持額まで戻した分" />
        <Metric title="累計資産売却総額" value={compactYen(annualGrossWithdrawal)} sub="実際に口座から動かした総額" />
        <Metric title="累計計画取り崩し" value={compactYen(annualPlannedDrawdown)} sub="目標残高へ向けた追加支出" />
        <Metric title="累計収支" value={compactYen(annualNet)} sub={annualNet >= 0 ? "黒字" : "赤字"} />
        <Metric title="期末評価損益" value={compactYen(latestTrackedGainTotal)} sub={latestAnnual ? `${latestAnnual.year}年末の合計` : "年末時点"} />
      </div>
      {annualContributionGap > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">追加投資の原資不足があります</p>
              <p className="mt-1">将来の積立予定が生活費・税社保後の資金で賄えない月があります。積立額や期間を確認してください。</p>
            </div>
            <Button variant="outline" onClick={() => onOpenInputCard("assets-current")}>
              将来の積立予定を確認
            </Button>
          </div>
        </div>
      )}
      </ScenarioSyncDetails>

      <ScenarioSyncDetails
        id="results-diagnostics-details"
        title="原因調査用の詳細表・チャート"
        description="投資計画、税支払タイミング、NISA枠、月次・年次表などは必要な時だけ開きます。"
      >
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>投資計画チェック</CardTitle>
          <CardDescription>
            NISAへ実際に入金できた額、未実行額、一般口座（オプション用）の運用制約に引っかかった年を確認します。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-scroll max-h-[520px] overflow-auto">
          <Table>
            <thead>
              <Tr>
                <Th>年</Th>
                <Th>NISA実行</Th>
                <Th>NISA未実行</Th>
                <Th>NISA枠超過</Th>
                <Th>証拠金不足停止</Th>
                <Th>一般口座利益移動</Th>
                <Th>確認ポイント</Th>
              </Tr>
            </thead>
            <tbody>
              {result.annual
                .filter(
                  (row) =>
                    row.nisaContributionTotal > 0 ||
                    row.nisaContributionSkippedTotal > 0 ||
                    row.nisaAnnualLimitExceededTotal > 0 ||
                    row.optionIncomeSuspendedTotal > 0 ||
                    row.optionProfitSweepTotal > 0,
                )
                .map((row) => (
                  <Tr key={`plan-check-${row.year}`}>
                    <Td>{yearEndAgeLabel(row.year, row.ageYears)}</Td>
                    <Td>{compactYen(row.nisaContributionTotal)}</Td>
                    <Td className={row.nisaContributionSkippedTotal > 0 ? "text-destructive" : ""}>{compactYen(row.nisaContributionSkippedTotal)}</Td>
                    <Td className={row.nisaAnnualLimitExceededTotal > 0 ? "text-destructive" : ""}>{compactYen(row.nisaAnnualLimitExceededTotal)}</Td>
                    <Td className={row.optionIncomeSuspendedTotal > 0 ? "text-destructive" : ""}>{compactYen(row.optionIncomeSuspendedTotal)}</Td>
                    <Td>{compactYen(row.optionProfitSweepTotal)}</Td>
                    <Td className="min-w-[360px] text-sm text-muted-foreground">
                      {[
                        row.nisaContributionSkippedTotal > 0 ? "NISA積立の一部が原資不足で未実行です。" : "",
                        row.nisaAnnualLimitExceededTotal > 0 ? "NISA年間枠を超えた予定があります。" : "",
                        row.optionIncomeSuspendedTotal > 0 ? "一般口座が最低維持額未満となり、予定収益を停止しています。" : "",
                        row.optionProfitSweepTotal > 0 ? "一般口座の超過利益を流動資金へ移動しています。" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </Td>
                  </Tr>
                ))}
            </tbody>
          </Table>
          {!result.annual.some(
            (row) =>
              row.nisaContributionTotal > 0 ||
              row.nisaContributionSkippedTotal > 0 ||
              row.nisaAnnualLimitExceededTotal > 0 ||
              row.optionIncomeSuspendedTotal > 0 ||
              row.optionProfitSweepTotal > 0,
          ) && <p className="text-sm text-muted-foreground">投資計画上の警告はありません。</p>}
        </CardContent>
      </Card>

      <Card id="tax-cash-payment-timing" className="scroll-mt-28">
        <CardHeader>
          <CardTitle>税金・社会保険のキャッシュ支払タイミング</CardTitle>
          <CardDescription>
            実際に現金が出ていく年で、税金と社会保険等を分けて確認します。所得税精算・住民税・国保・介護は原則として前年所得に対する当年支払いです。
            一般口座（オプション用）の申告対象損益は、翌年の所得税精算・住民税・国保などの全所得計算に入ります。申告分離の税相当額は目安として別表示します。
            固定資産税は所得連動ではなく、登録した通知書実額または継続支払予定をそのまま反映します。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-scroll max-h-[520px] overflow-auto">
          <Table className="min-w-[1500px]">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <Tr>
                <Th className={resultStickyHeaderClass}>支払年</Th>
                <Th>対象所得年</Th>
                <Th>前年一般口座<br />申告対象損益</Th>
                <Th>一般口座申告分<br />税相当目安</Th>
                <Th>所得税精算<br />全所得</Th>
                <Th>住民税<br />全所得</Th>
                {showSourceFreeDeferredCapitalGainsTax && <Th>源泉なし等<br />売却益税翌年分</Th>}
                <Th>売却時譲渡益税</Th>
                <Th>iDeCo源泉<br />受取時</Th>
                <Th>税金合計</Th>
                <Th>国民年金</Th>
                <Th>国保</Th>
                <Th>後期高齢者</Th>
                <Th>介護</Th>
                <Th>固定資産税<br />都市計画税</Th>
                <Th>その他公的負担</Th>
                <Th>社会保険等合計</Th>
                <Th>支払合計</Th>
              </Tr>
            </thead>
            <tbody>
              {result.annual.map((row) => {
                const previousIncomeYearRow = result.annual.find((incomeRow) => incomeRow.year === row.year - 1);
                const previousDeclaredGain = previousIncomeYearRow?.declaredCapitalGainsIncomeTotal ?? 0;
                const declaredOptionTax = declaredOptionTaxBreakdownForDisplay(previousDeclaredGain);
                const taxTotal =
                  row.taxCashBreakdown.incomeTaxSettlement +
                  row.taxCashBreakdown.residentTax +
                  row.taxCashBreakdown.deferredCapitalGainsTax +
                  row.capitalGainsTaxTotal +
                  row.idecoWithholdingTaxTotal;
                const socialInsuranceTotal =
                  row.taxCashBreakdown.nationalPension +
                  row.taxCashBreakdown.nationalHealthInsurance +
                  row.taxCashBreakdown.lateElderlyMedical +
                  row.taxCashBreakdown.nursingCare +
                  row.taxCashBreakdown.propertyTax +
                  row.taxCashBreakdown.otherPublicCost;
                const cashPaymentTotal = taxTotal + socialInsuranceTotal;
                return (
                  <Tr key={`tax-cash-${row.year}`}>
                    <Td className={resultStickyCellClass}>{yearEndAgeLabel(row.year, row.ageYears)}</Td>
                    <Td>{row.year - 1}年</Td>
                    <Td>{compactYen(previousDeclaredGain)}</Td>
                    <Td>
                      <div>{compactYen(declaredOptionTax.totalEquivalent)}</div>
                      {declaredOptionTax.totalEquivalent > 0 && (
                        <div className="text-xs text-muted-foreground">
                          所得税相当 {compactYen(declaredOptionTax.incomeTaxEquivalent)} / 住民税相当{" "}
                          {compactYen(declaredOptionTax.residentTaxEquivalent)}
                        </div>
                      )}
                    </Td>
                    <Td>{compactYen(row.taxCashBreakdown.incomeTaxSettlement)}</Td>
                    <Td>{compactYen(row.taxCashBreakdown.residentTax)}</Td>
                    {showSourceFreeDeferredCapitalGainsTax && <Td>{compactYen(row.taxCashBreakdown.deferredCapitalGainsTax)}</Td>}
                    <Td>{compactYen(row.capitalGainsTaxTotal)}</Td>
                    <Td>{compactYen(row.idecoWithholdingTaxTotal)}</Td>
                    <Td className="font-medium">{compactYen(taxTotal)}</Td>
                    <Td>{compactYen(row.taxCashBreakdown.nationalPension)}</Td>
                    <Td>{compactYen(row.taxCashBreakdown.nationalHealthInsurance)}</Td>
                    <Td>{compactYen(row.taxCashBreakdown.lateElderlyMedical)}</Td>
                    <Td>{compactYen(row.taxCashBreakdown.nursingCare)}</Td>
                    <Td>{compactYen(row.taxCashBreakdown.propertyTax)}</Td>
                    <Td>{compactYen(row.taxCashBreakdown.otherPublicCost)}</Td>
                    <Td className="font-medium">{compactYen(socialInsuranceTotal)}</Td>
                    <Td className="font-medium">{compactYen(cashPaymentTotal)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-3 text-sm text-muted-foreground">
            iDeCo源泉は年金受取時に 7.6575% を所得税の前払いとして差し引く扱いです。翌年の所得税精算では、前年の所得税額から前年に差し引かれたiDeCo源泉を控除しているため、
            所得税として二重には引いていません。「一般口座申告分 税相当目安」は、一般口座オプションの申告対象損益に 20.315% を掛けた参考内訳です。
            実際の現金支払いは「所得税精算 全所得」「住民税 全所得」「国保」などに含まれるため、税金合計には二重加算していません。
            源泉なし等の売却益税が全期間0円の場合、その列は非表示にしています。
            国民年金は、世帯内で20歳以上60歳未満・国保加入・後期高齢者医療対象外のメンバー分を数えます。本人が60歳以降でも、配偶者や子どもが該当すれば表示されます。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>一般口座申告損益と翌年負担</CardTitle>
          <CardDescription>
            一般口座（オプション用）で申告対象になった損益を、翌年の税・社会保険支払と並べて確認します。
            「申告分離税相当」は一般口座損益だけに20.315%を掛けた参考額です。翌年負担は公的年金・iDeCo・一般口座損益などを合算した全体額で、一般口座損益だけの増分ではありません。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-scroll max-h-[520px] overflow-auto">
          <Table className="min-w-[1680px]">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <Tr>
                <Th className={resultStickyHeaderClass}>所得年</Th>
                <Th>一般口座申告対象損益</Th>
                <Th>申告分離税相当<br />20.315%目安</Th>
                <Th>支払年</Th>
                <Th>翌年所得税精算<br />全所得</Th>
                <Th>翌年住民税<br />全所得</Th>
                {showSourceFreeDeferredCapitalGainsTax && <Th>翌年源泉なし等<br />売却益税</Th>}
                <Th>翌年税金合計<br />全所得</Th>
                <Th>翌年国保<br />全所得</Th>
                <Th>翌年後期高齢者<br />全所得</Th>
                <Th>翌年介護<br />全所得</Th>
                <Th>翌年社会保険等<br />全所得</Th>
                <Th className="min-w-[360px]">読み方</Th>
              </Tr>
            </thead>
            <tbody>
              {declaredGainImpactRows.map((row) => (
                <Tr key={`declared-gain-impact-${row.incomeYear}`}>
                  <Td className={resultStickyCellClass}>{`${row.incomeYear} / ${yearEndAgeValue(row.incomeAgeYears)}`}</Td>
                  <Td>{compactYen(row.declaredGain)}</Td>
                  <Td>
                    <div>{compactYen(row.declaredTaxEquivalentTotal)}</div>
                    {row.declaredTaxEquivalentTotal > 0 && (
                      <div className="text-xs text-muted-foreground">
                        所得税相当 {compactYen(row.declaredIncomeTaxEquivalent)} / 住民税相当{" "}
                        {compactYen(row.declaredResidentTaxEquivalent)}
                      </div>
                    )}
                  </Td>
                  <Td>{row.paymentYear ? `${row.paymentYear} / ${yearEndAgeValue(row.paymentAgeYears)}` : "-"}</Td>
                  <Td>{compactYen(row.incomeTaxSettlement)}</Td>
                  <Td>{compactYen(row.residentTax)}</Td>
                  {showSourceFreeDeferredCapitalGainsTax && <Td>{compactYen(row.deferredCapitalGainsTax)}</Td>}
                  <Td className="font-medium">{compactYen(row.taxTotal)}</Td>
                  <Td>{compactYen(row.nationalHealthInsurance)}</Td>
                  <Td>{compactYen(row.lateElderlyMedical)}</Td>
                  <Td>{compactYen(row.nursingCare)}</Td>
                  <Td className="font-medium">{compactYen(row.socialInsuranceTotal)}</Td>
                  <Td className="min-w-[360px] text-sm text-muted-foreground">
                    {row.paymentYear
                      ? `${row.incomeYear}年の申告対象損益を、${row.paymentYear}年の所得税精算・住民税・国保等に反映しています。`
                      : "シミュレーション期間外の翌年支払いになるため、支払額は表示対象外です。"}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {declaredGainImpactRows.length === 0 && (
            <p className="text-sm text-muted-foreground">一般口座（オプション用）の申告対象損益はありません。</p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            ここでいう一般口座申告対象損益は、税・社会保険タブの自動計算に渡す所得年ベースの金額です。
            申告分離税相当は「この損益だけなら税率上どの程度か」を見るための目安です。実際の翌年の税・社会保険は、一般口座損益だけでなく公的年金・iDeCo受取・各種控除を合算して計算します。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>所得水準別の税・社会保険目安</CardTitle>
          <CardDescription>
            現在のシナリオから、前年所得水準と翌年支払の関係を並べた早見表です。制度の汎用料率表ではなく、入力済みの世帯・自治体・年齢条件に基づく目安です。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-scroll max-h-[520px] overflow-auto">
          <Table className="min-w-[1580px]">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <Tr>
                <Th className={resultStickyHeaderClass}>支払年</Th>
                <Th>判定所得年</Th>
                <Th>前年現金収入</Th>
                <Th>前年一般口座<br />申告損益</Th>
                <Th>参考所得合計</Th>
                <Th>所得税精算</Th>
                <Th>住民税</Th>
                <Th>国民年金</Th>
                <Th>国保</Th>
                <Th>後期高齢者</Th>
                <Th>介護</Th>
                <Th>社会保険等合計</Th>
                <Th>支払合計</Th>
              </Tr>
            </thead>
            <tbody>
              {incomeBurdenGuideRows.map((row) => (
                <Tr key={`income-burden-guide-${row.paymentYear}`}>
                  <Td className={resultStickyCellClass}>{yearEndAgeLabel(row.paymentYear, row.paymentAgeYears)}</Td>
                  <Td>{row.incomeYear ? `${row.incomeYear} / ${yearEndAgeValue(row.incomeAgeYears)}` : "-"}</Td>
                  <Td>{compactYen(row.previousCashIncome)}</Td>
                  <Td>{compactYen(row.previousDeclaredGain)}</Td>
                  <Td>{compactYen(row.previousReferenceIncome)}</Td>
                  <Td>{compactYen(row.incomeTaxSettlement)}</Td>
                  <Td>{compactYen(row.residentTax)}</Td>
                  <Td>{compactYen(row.nationalPension)}</Td>
                  <Td>{compactYen(row.nationalHealthInsurance)}</Td>
                  <Td>{compactYen(row.lateElderlyMedical)}</Td>
                  <Td>{compactYen(row.nursingCare)}</Td>
                  <Td className="font-medium">{compactYen(row.socialInsuranceTotal)}</Td>
                  <Td className="font-medium">{compactYen(row.taxAndSocialTotal)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {incomeBurdenGuideRows.length === 0 && (
            <p className="text-sm text-muted-foreground">所得水準別の目安を表示できる年がありません。</p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            「参考所得合計」は、この表で比較しやすいように前年現金収入と前年一般口座申告損益を足した補助値です。実際の課税計算では、公的年金等控除、基礎控除、扶養控除、社会保険料控除などを別途反映します。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NISA枠の進捗</CardTitle>
          <CardDescription>累計投資額、残り生涯枠、年ごとの追加投資と未実行額を確認します。</CardDescription>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={nisaLimitChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <Tooltip formatter={(value) => yen(Number(value))} />
              <Legend />
              <Line dataKey="cumulative" name="NISA累計投資額" stroke="#0f766e" strokeWidth={3} dot={false} />
              <Line dataKey="remaining" name="残りNISA枠" stroke="#2563eb" strokeWidth={3} dot={false} />
              <Line dataKey="annualContribution" name="年内追加投資" stroke="#7c3aed" dot={false} />
              <Line dataKey="skipped" name="NISA未実行" stroke="#dc2626" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>年別の流動資金（現金・普通預金）フロー</CardTitle>
          <CardDescription>
            外部から普通預金へ入る受取収入、運用口座から普通預金へ戻した内部移動、生活費・税社保・投資で出ていく金額を分けて確認します。
            流動資金は「現金 + 普通預金」として扱います。
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[30rem]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={liquidFlowSummaryData} barCategoryGap="22%" barGap={2} maxBarSize={18} margin={{ top: 8, right: 28, bottom: 72, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <Tooltip formatter={(value) => yen(Number(value))} wrapperStyle={{ zIndex: 20 }} />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 18 }} />
              <Bar dataKey="cashIn" name="入金: 受取収入（普通預金へ）" fill="#0f766e" />
              <Bar dataKey="internalIn" name="内部移動: 運用口座から普通預金へ" fill="#14b8a6" />
              <Bar dataKey="internalOut" name="内部移動: 運用口座への原資移動" fill="#64748b" />
              <Bar dataKey="cashOut" name="出金: 生活費・税社保・投資" fill="#dc2626" />
              <Bar dataKey="net" name="純収支" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>流動資金（現金・普通預金）フロー内訳</CardTitle>
          <CardDescription>
            チャートの区分を年ごとに分解します。受取収入は公的年金・iDeCo年金・家族からの入金などが普通預金へ入る扱いです。
            運用口座から普通預金へは、一般口座利益移動と終了後戻しを合算しています。年始・年末の流動資金は「現金 + 普通預金」です。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-scroll max-h-[520px] overflow-auto">
          <Table className="min-w-[1100px]">
            <thead>
              <Tr>
                <Th className="sticky left-0 z-10 bg-card">年 / 年末年齢</Th>
                <Th>年始流動資金<br />（現金・普通預金）</Th>
                <Th>受取収入<br />普通預金へ</Th>
                <Th>運用口座から<br />普通預金へ</Th>
                <Th>生活費</Th>
                <Th>税社保支払</Th>
                <Th>特別支出</Th>
                <Th>追加投資</Th>
                <Th>純収支</Th>
                <Th>年末流動資金<br />（現金・普通預金）</Th>
              </Tr>
            </thead>
            <tbody>
              {liquidFlowSummaryData.map((row) => (
                <Tr key={`liquid-flow-${row.year}`}>
                  <Td className="sticky left-0 z-10 whitespace-nowrap bg-card">{yearEndAgeLabel(row.year, row.ageYears)}</Td>
                  <Td>{compactYen(row.startLiquid)}</Td>
                  <Td>{compactYen(row.incomeTotal)}</Td>
                  <Td>{compactYen(row.optionProfitSweepTotal + row.optionAccountReleaseTotal)}</Td>
                  <Td>{row.livingExpenseTotal > 0 ? `-${compactYen(row.livingExpenseTotal)}` : "¥0"}</Td>
                  <Td>
                    {row.taxInsuranceTotal + row.capitalGainsTaxTotal > 0
                      ? `-${compactYen(row.taxInsuranceTotal + row.capitalGainsTaxTotal)}`
                      : "¥0"}
                  </Td>
                  <Td>{row.specialExpenseTotal > 0 ? `-${compactYen(row.specialExpenseTotal)}` : "¥0"}</Td>
                  <Td>{row.assetContributionTotal > 0 ? `-${compactYen(row.assetContributionTotal)}` : "¥0"}</Td>
                  <Td className={row.netCashFlow < 0 ? "text-destructive" : "text-teal-700"}>{compactYen(row.netCashFlow)}</Td>
                  <Td>{compactYen(row.endLiquid)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>原資移動の発生履歴</CardTitle>
          <CardDescription>
            普通預金などから運用口座へ移した内部移動だけを表示します。生活費の支出や外部収入とは別扱いです。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-scroll max-h-[520px] overflow-auto">
          {assetTransferRows.length > 0 ? (
            <Table>
              <thead>
                <Tr>
                  <Th>年 / 年末年齢</Th>
                  <Th>移動額</Th>
                  <Th>移動内容</Th>
                </Tr>
              </thead>
              <tbody>
                {assetTransferRows.map((row) => (
                  <Tr key={`asset-transfer-${row.year}`}>
                    <Td>{yearEndAgeLabel(row.year, row.ageYears)}</Td>
                    <Td className="text-destructive">-{compactYen(row.assetTransferTotal)}</Td>
                    <Td className="min-w-[360px] text-sm text-muted-foreground">
                      {row.assetTransferDetails.length > 0 ? row.assetTransferDetails.join(" / ") : "移動詳細なし"}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">このシナリオでは原資移動は発生していません。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>一般口座終了後の戻し履歴</CardTitle>
          <CardDescription>
            運用終了後に一般口座サブ口座から普通預金へ戻した残高だけを表示します。戻した資金は同月以降の生活費やNISA未実行分の原資に使えます。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-scroll max-h-[520px] overflow-auto">
          {optionReleaseRows.length > 0 ? (
            <Table>
              <thead className="sticky top-0 z-10 bg-white shadow-sm">
                <Tr>
                  <Th className="sticky left-0 z-20 bg-white shadow-[1px_0_0_#cbd5e1]">年 / 年末年齢</Th>
                  <Th>戻し額</Th>
                  <Th>戻し内容</Th>
                </Tr>
              </thead>
              <tbody>
                {optionReleaseRows.map((row) => (
                  <Tr key={`option-release-${row.year}`}>
                    <Td className="sticky left-0 z-10 whitespace-nowrap bg-white shadow-[1px_0_0_#cbd5e1]">{yearEndAgeLabel(row.year, row.ageYears)}</Td>
                    <Td>{compactYen(row.optionAccountReleaseTotal)}</Td>
                    <Td className="min-w-[360px] text-sm text-muted-foreground">
                      {row.optionAccountReleaseDetails.length > 0 ? row.optionAccountReleaseDetails.join(" / ") : "戻し詳細なし"}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">このシナリオでは一般口座終了後の戻しは発生していません。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>評価損益の推移</CardTitle>
          <CardDescription>
            積立、利回り、取り崩しのあとで、各口座の評価損益がどう動くかを年ごとに確認します。
            一般口座オプションの月次利益は実現損益として扱うため、評価損益には出ません。下の「一般口座オプション損益」で確認します。
          </CardDescription>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={unrealizedGainChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <Tooltip formatter={(value) => yen(Number(value))} />
              <Legend />
              <Line dataKey="total" name="合計評価損益" stroke="#0f766e" strokeWidth={3} dot={false} />
              <Line dataKey="nisa" name="NISA" stroke="#2563eb" dot={false} />
              <Line dataKey="specificAccount" name="特定口座" stroke="#dc2626" dot={false} />
              <Line dataKey="ordinaryAccountForOptions" name="一般口座（オプション用）" stroke="#7c3aed" dot={false} />
              <Line dataKey="ideco" name="iDeCo" stroke="#ea580c" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>一般口座（オプション用）の証拠金推移</CardTitle>
          <CardDescription>
            口座残高、取引原価、含み損益を年ごとに確認します。口座内積上を選ぶと、残高と取引原価が同時に増えるため、評価損益は0のままになることがあります。
            月次利益は実現損益なので、このチャートではなく下の実現損益で確認します。
          </CardDescription>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={optionsCollateralChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <Tooltip formatter={(value) => yen(Number(value))} />
              <Legend />
              <Line dataKey="balance" name="口座残高" stroke="#0f766e" strokeWidth={3} dot={false} />
              <Line dataKey="basis" name="取引原価" stroke="#2563eb" dot={false} />
              <Line dataKey="gain" name="評価損益" stroke="#7c3aed" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>一般口座オプション損益の見える化</CardTitle>
          <CardDescription>
            一般口座（オプション用）の利益は、評価損益ではなく実現損益・申告対象所得として扱います。
            口座内に積み上げた利益、普通預金へ移した利益、終了後に戻した残高を分けて確認します。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-scroll max-h-[520px] overflow-auto">
          {optionProfitVisibilityRows.length > 0 ? (
            <div className="space-y-6">
              <div className="h-80 min-w-[900px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={optionsRealizedProfitChartData} barCategoryGap="22%" barGap={2} maxBarSize={18} margin={{ top: 8, right: 28, bottom: 72, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={12} />
                    <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
                    <Tooltip formatter={(value) => yen(Number(value))} wrapperStyle={{ zIndex: 20 }} />
                    <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 18 }} />
                    <Bar dataKey="declaredProfit" name="申告対象損益" fill="#dc2626" />
                    <Bar dataKey="sweptProfit" name="普通預金へ移動" fill="#0f766e" />
                    <Bar dataKey="retainedProfit" name="口座内積上" fill="#2563eb" />
                    <Bar dataKey="releasedCollateral" name="終了後戻し" fill="#14b8a6" />
                    <Bar dataKey="suspendedProfit" name="証拠金不足停止" fill="#7c3aed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Table className="min-w-[1200px]">
                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                  <Tr>
                    <Th className={resultStickyHeaderClass}>年 / 年末年齢</Th>
                    <Th>申告対象損益</Th>
                    <Th>口座内積上</Th>
                    <Th>普通預金へ移動</Th>
                    <Th>終了後戻し</Th>
                    <Th>証拠金不足停止</Th>
                    <Th className="min-w-[420px]">読み方</Th>
                  </Tr>
                </thead>
                <tbody>
                  {optionProfitVisibilityRows.map((row) => (
                    <Tr key={`option-profit-visibility-${row.year}`}>
                      <Td className={resultStickyCellClass}>{yearEndAgeLabel(row.year, row.ageYears)}</Td>
                      <Td>{compactYen(row.declaredCapitalGainsIncomeTotal)}</Td>
                      <Td>{compactYen(row.retainedSourceAssetIncomeTotal)}</Td>
                      <Td>{compactYen(row.optionProfitSweepTotal)}</Td>
                      <Td>{compactYen(row.optionAccountReleaseTotal)}</Td>
                      <Td className={row.optionIncomeSuspendedTotal > 0 ? "text-destructive" : ""}>{compactYen(row.optionIncomeSuspendedTotal)}</Td>
                      <Td className="min-w-[420px] text-sm text-muted-foreground">
                        {[
                          row.retainedSourceAssetIncomeTotal > 0 ? "利益を原資口座内に積み上げています。" : "",
                          row.optionProfitSweepTotal > 0 ? "目標残高を超えた利益を普通預金へ移しています。" : "",
                          row.optionAccountReleaseTotal > 0 ? "運用終了後の残高を普通預金へ戻しています。" : "",
                          row.optionIncomeSuspendedTotal > 0 ? "最低維持証拠金未満のため予定利益を止めています。" : "",
                        ]
                          .filter(Boolean)
                          .join(" ") || "申告対象損益だけが発生しています。"}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">一般口座（オプション用）の実現損益はありません。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>年末の評価額・取得原価・評価損益</CardTitle>
          <CardDescription>課税口座の取り崩し時課税の元になる取得原価と、年末時点の含み損益を確認します。</CardDescription>
        </CardHeader>
        <CardContent className="table-scroll max-h-[520px] overflow-auto">
          <Table className="min-w-[1400px]">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <Tr>
                <Th className={resultStickyHeaderClass}>年</Th>
                {gainTrackedAssets.map((asset) => (
                  <Th key={`${asset.key}-value`}>{asset.label} 評価額</Th>
                ))}
                {gainTrackedAssets.map((asset) => (
                  <Th key={`${asset.key}-basis`}>{asset.label} 取得原価</Th>
                ))}
                {gainTrackedAssets.map((asset) => (
                  <Th key={`${asset.key}-gain`}>{asset.label} 評価損益</Th>
                ))}
              </Tr>
            </thead>
            <tbody>
              {result.annual.map((row) => (
                <Tr key={`gain-${row.year}`}>
                  <Td className={resultStickyCellClass}>{yearEndAgeLabel(row.year, row.ageYears)}</Td>
                  {gainTrackedAssets.map((asset) => (
                    <Td key={`${row.year}-${asset.key}-value`}>{compactYen(row.endingTrackedAssetBalances[asset.key])}</Td>
                  ))}
                  {gainTrackedAssets.map((asset) => (
                    <Td key={`${row.year}-${asset.key}-basis`}>{compactYen(row.endingTrackedAssetCostBasis[asset.key])}</Td>
                  ))}
                  {gainTrackedAssets.map((asset) => (
                    <Td
                      key={`${row.year}-${asset.key}-gain`}
                      className={row.endingTrackedAssetUnrealizedGains[asset.key] < 0 ? "text-destructive" : "text-primary"}
                    >
                      {compactYen(row.endingTrackedAssetUnrealizedGains[asset.key])}
                    </Td>
                  ))}
                </Tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2036年前後の月次診断</CardTitle>
          <CardDescription>
            2035年12月から2038年1月までを、年次集計ではなく月次内部値のまま抜き出します。不足補填・流動資金補充・NISA未実行・一般口座戻しの発生月を切り分けるための表です。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-scroll max-h-[520px] overflow-auto">
          <Table className="min-w-[2600px]">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <Tr>
                <Th>年月</Th>
                <Th>年齢</Th>
                <Th>当月開始流動資金<br />（現金・普通預金）</Th>
                <Th>現金収入</Th>
                <Th>一般口座利益移動</Th>
                <Th>一般口座終了戻し</Th>
                <Th>生活費</Th>
                <Th>税社保</Th>
                <Th>譲渡益税</Th>
                <Th>特別支出</Th>
                <Th>追加投資</Th>
                <Th>NISA実行</Th>
                <Th>NISA未実行</Th>
                <Th>NISA枠超過</Th>
                <Th>不足補填売却</Th>
                <Th className="min-w-[280px]">不足補填元</Th>
                <Th>流動資金補充<br />（現金・普通預金）</Th>
                <Th>月末流動資金<br />（現金・普通預金）</Th>
                <Th>月末総資産</Th>
                <Th>特定口座</Th>
                <Th>一般口座<br />オプション</Th>
                <Th>NISA</Th>
                <Th>iDeCo</Th>
              </Tr>
            </thead>
            <tbody>
              {monthlyDiagnosticRows.map((row) => (
                <Tr key={`diagnostic-${row.yearMonth}`}>
                  <Td>{row.yearMonth}</Td>
                  <Td>{row.ageYears}歳{row.ageMonths}か月</Td>
                  <Td>{compactYen(row.startingLiquidBuffer)}</Td>
                  <Td>{compactYen(row.incomeTotal)}</Td>
                  <Td>{compactYen(row.optionProfitSweepTotal)}</Td>
                  <Td>{compactYen(row.optionAccountReleaseTotal)}</Td>
                  <Td>{compactYen(row.livingExpenseTotal)}</Td>
                  <Td>{compactYen(row.taxInsuranceTotal)}</Td>
                  <Td>{compactYen(row.capitalGainsTaxTotal)}</Td>
                  <Td>{compactYen(row.specialExpenseTotal)}</Td>
                  <Td>{compactYen(row.assetContributionTotal)}</Td>
                  <Td>{compactYen(row.nisaContributionTotal)}</Td>
                  <Td className={row.nisaContributionSkippedTotal > 0 ? "text-destructive" : ""}>{compactYen(row.nisaContributionSkippedTotal)}</Td>
                  <Td className={row.nisaAnnualLimitExceededTotal > 0 ? "text-destructive" : ""}>{compactYen(row.nisaAnnualLimitExceededTotal)}</Td>
                  <Td>{compactYen(row.deficitAssetWithdrawalAmount)}</Td>
                  <Td className="min-w-[280px] whitespace-pre-line break-words text-sm leading-5 text-muted-foreground">
                    {formatWithdrawalSources(row.deficitWithdrawalBreakdown) || "-"}
                  </Td>
                  <Td>{compactYen(row.cashReserveTopUpAmount)}</Td>
                  <Td>{compactYen(row.endingLiquidBuffer)}</Td>
                  <Td>{compactYen(row.endingAssets)}</Td>
                  <Td>{compactYen(row.endingTrackedAssetBalances.specificAccount)}</Td>
                  <Td>{compactYen(row.endingTrackedAssetBalances.ordinaryAccountForOptions)}</Td>
                  <Td>{compactYen(row.endingTrackedAssetBalances.nisa)}</Td>
                  <Td>{compactYen(row.endingTrackedAssetBalances.ideco)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>月別収支表</CardTitle>
          <CardDescription>
            現金不足は生活費・税社保・特別支出・追加投資などに対して、現金収入と流動資金だけでは足りなかった額です。iDeCoは設定した受取予定として表示します。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-scroll max-h-[520px] overflow-auto">
          <ResultTable rows={result.monthly.slice(0, 360)} period="month" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>年別収支表</CardTitle>
          <CardDescription>
            年間現金不足、予定受取元、不足補填売却元、税・社会保険負担を確認します。iDeCoは任意売却ではなく、受取設定に従う予定受取元として扱います。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-scroll max-h-[520px] overflow-auto">
          <ResultTable rows={result.annual} period="year" />
        </CardContent>
      </Card>
      </div>
      </ScenarioSyncDetails>
    </div>
  );
}

function CompareSection({
  items,
  scenarios,
  baselineScenario,
  baselineScenarioId,
  setBaselineScenarioId,
  periodSourceScenario,
  updateScenario,
  onOpenSpouseWorkstyleSettings,
}: {
  items: { scenario: ScenarioData; result: ReturnType<typeof simulateScenario> }[];
  scenarios: ScenarioData[];
  baselineScenario: ScenarioData;
  baselineScenarioId: string;
  setBaselineScenarioId: (id: string) => void;
  periodSourceScenario: ScenarioData;
  updateScenario: SectionProps["updateScenario"];
  onOpenSpouseWorkstyleSettings: (scenarioId: string) => void;
}) {
  const flexibleFreeCashPeriod = getScenarioFlexibleFreeCashPeriod(periodSourceScenario);
  const flexibleFreeCashLabel = flexibleFreeCashPeriodLabel(flexibleFreeCashPeriod);
  const compareRows = items.map(({ scenario, result }) => {
    const flexibleFreeCash = calculateFlexibleFreeCashSummary(result, flexibleFreeCashPeriod);
    const specialExpenseCategoryTotals = calculateSpecialExpenseCategoryTotals(scenario, result, flexibleFreeCashPeriod);
    const targetBalanceAnalysis = calculateTargetBalanceAnalysis(scenario, result);
    const lifetimeTotalExpense = calculateLifetimeTotalExpenseSummary(result, scenario.userProfile.targetBalanceAge);
    const scenarioDiff = buildScenarioDiffSummary(baselineScenario, scenario);
    const yearCount = Math.max(1, result.annual.length);
    const deficitAssetSale = result.annual.reduce((sum, row) => sum + row.deficitAssetWithdrawalAmount, 0);
    const sourceAssetIncome = result.annual.reduce((sum, row) => sum + row.sourceAssetIncomeWithdrawalAmount, 0);
    const plannedDrawdown = result.annual.reduce((sum, row) => sum + row.plannedDrawdownTotal, 0);
    const optionToLiquid = result.annual.reduce((sum, row) => sum + row.optionProfitSweepTotal + row.optionAccountReleaseTotal, 0);
    const declaredOptionProfit = result.annual.reduce((sum, row) => sum + row.declaredCapitalGainsIncomeTotal, 0);
    const optionIncomeSuspended = result.annual.reduce((sum, row) => sum + row.optionIncomeSuspendedTotal, 0);
    const cashIncome = result.annual.reduce((sum, row) => sum + row.incomeTotal, 0);
    const assetGrowth = result.annual.reduce((sum, row) => sum + row.growthAmount, 0);
    const nisaExecuted = result.annual.reduce((sum, row) => sum + row.nisaContributionTotal, 0);
    const nisaSkipped = result.annual.reduce((sum, row) => sum + row.nisaContributionSkippedTotal, 0);
    const finalNisaRemainingLifetimeLimit = result.annual.at(-1)?.nisaRemainingLifetimeLimit ?? 0;
    const additionalInvestment = result.annual.reduce((sum, row) => sum + row.assetContributionTotal, 0);
    const taxSocial = result.annual.reduce(
      (sum, row) => sum + row.taxInsuranceTotal + row.capitalGainsTaxTotal + row.idecoWithholdingTaxTotal,
      0,
    );
    const livingAndTaxNeed = result.annual.reduce(
      (sum, row) =>
        sum +
        Math.max(
          0,
          row.livingExpenseTotal +
            row.specialExpenseTotal +
            row.taxInsuranceTotal +
            row.capitalGainsTaxTotal +
            row.idecoWithholdingTaxTotal +
            row.idecoFeeTotal -
            (row.incomeTotal + row.optionProfitSweepTotal + row.optionAccountReleaseTotal),
        ),
      0,
    );
    const afterLivingCapacity = result.annual.reduce(
      (sum, row) =>
        sum +
        row.incomeTotal +
        row.optionProfitSweepTotal +
        row.optionAccountReleaseTotal -
        row.livingExpenseTotal -
        row.specialExpenseTotal -
        row.taxInsuranceTotal -
        row.capitalGainsTaxTotal -
        row.idecoWithholdingTaxTotal -
        row.idecoFeeTotal,
      0,
    );
    const investmentIncludedNeed = result.totalWithdrawal;
    return {
      scenario,
      result,
      yearCount,
      deficitAssetSale,
      sourceAssetIncome,
      plannedDrawdown,
      optionToLiquid,
      declaredOptionProfit,
      optionIncomeSuspended,
      cashIncome,
      assetGrowth,
      nisaExecuted,
      nisaSkipped,
      finalNisaRemainingLifetimeLimit,
      additionalInvestment,
      taxSocial,
      livingAndTaxNeed,
      afterLivingCapacity,
      investmentIncludedNeed,
      flexibleFreeCash,
      specialExpenseCategoryTotals,
      targetBalanceAnalysis,
      lifetimeTotalExpense,
      scenarioDiff,
    };
  });
  const longevityChartData = compareRows.map(({ scenario, result, deficitAssetSale, sourceAssetIncome, plannedDrawdown, livingAndTaxNeed }) => ({
    name: scenario.name,
    target: result.targetAgeBalance ?? 0,
    livingAndTaxNeed,
    assetMoved: deficitAssetSale + sourceAssetIncome + plannedDrawdown,
  }));
  const efficiencyChartData = compareRows.map(({ scenario, yearCount, cashIncome, optionToLiquid, taxSocial, afterLivingCapacity }) => ({
    name: scenario.name,
    cashIncomeAverage: cashIncome / yearCount,
    optionToLiquidAverage: optionToLiquid / yearCount,
    taxSocialAverage: taxSocial / yearCount,
    afterLivingCapacityAverage: afterLivingCapacity / yearCount,
  }));
  const baselineCompareRow = compareRows.find((row) => row.scenario.id === baselineScenario.id) ?? compareRows[0];
  const optionTaxSocialImpactRows = compareRows.map((row) => {
    const baselineTaxSocial = baselineCompareRow?.taxSocial ?? 0;
    const baselineOptionToLiquid = baselineCompareRow?.optionToLiquid ?? 0;
    const baselineNisaExecuted = baselineCompareRow?.nisaExecuted ?? 0;
    const baselineNisaSkipped = baselineCompareRow?.nisaSkipped ?? 0;
    const baselineNisaRemainingLifetimeLimit = baselineCompareRow?.finalNisaRemainingLifetimeLimit ?? 0;
    const baselineTargetBalance = baselineCompareRow?.result.targetAgeBalance ?? 0;
    const baselineAfterLivingCapacity = baselineCompareRow?.afterLivingCapacity ?? 0;
    const baselineAssetGrowth = baselineCompareRow?.assetGrowth ?? 0;
    const referenceTax = declaredOptionTaxBreakdownForDisplay(row.declaredOptionProfit).totalEquivalent;
    const taxSocialDelta = row.taxSocial - baselineTaxSocial;
    return {
      ...row,
      referenceTax,
      taxSocialDelta,
      taxSocialBurdenRate: row.declaredOptionProfit > 0 ? taxSocialDelta / row.declaredOptionProfit : null,
      optionToLiquidDelta: row.optionToLiquid - baselineOptionToLiquid,
      nisaExecutedDelta: row.nisaExecuted - baselineNisaExecuted,
      nisaSkippedDelta: row.nisaSkipped - baselineNisaSkipped,
      nisaRemainingLifetimeLimitDelta: row.finalNisaRemainingLifetimeLimit - baselineNisaRemainingLifetimeLimit,
      targetBalanceDelta: (row.result.targetAgeBalance ?? 0) - baselineTargetBalance,
      assetGrowthDelta: row.assetGrowth - baselineAssetGrowth,
      afterLivingCapacityDelta: row.afterLivingCapacity - baselineAfterLivingCapacity,
    };
  });
  const spousePartCompareScenarios = useMemo(() => items.map((item) => item.scenario), [items]);
  const spousePartFallbackYear = Number(baselineScenario.userProfile.simulationStartYearMonth.slice(0, 4));
  const spousePartCompareYears = useMemo(
    () => getSpousePartIncomeCompareYears(spousePartCompareScenarios.length > 0 ? spousePartCompareScenarios : [baselineScenario]),
    [baselineScenario, spousePartCompareScenarios],
  );
  const spousePartDefaultCompareYear = useMemo(
    () => getDefaultSpousePartIncomeCompareYear(spousePartCompareScenarios.length > 0 ? spousePartCompareScenarios : [baselineScenario], spousePartFallbackYear),
    [baselineScenario, spousePartCompareScenarios, spousePartFallbackYear],
  );
  const [spousePartCompareYear, setSpousePartCompareYear] = useState(spousePartDefaultCompareYear);
  const [spousePartAggregationMode, setSpousePartAggregationMode] = useState<SpousePartIncomeAggregationMode>("incomeYear");
  const [highlightedDiffScenarioId, setHighlightedDiffScenarioId] = useState<string | null>(null);
  const spousePartCompareYearKey = spousePartCompareYears.join(",");
  useEffect(() => {
    setSpousePartCompareYear((current) => (spousePartCompareYears.includes(current) ? current : spousePartDefaultCompareYear));
  }, [spousePartCompareYearKey, spousePartCompareYears, spousePartDefaultCompareYear]);
  useEffect(() => {
    if (!highlightedDiffScenarioId) return undefined;
    const timer = window.setTimeout(() => setHighlightedDiffScenarioId(null), 4500);
    return () => window.clearTimeout(timer);
  }, [highlightedDiffScenarioId]);
  const openScenarioDiffDetails = (scenarioId: string) => {
    setHighlightedDiffScenarioId(scenarioId);
    window.setTimeout(() => {
      const detail = document.getElementById("scenario-input-diff-details") as HTMLDetailsElement | null;
      if (detail && !detail.open) {
        detail.open = true;
        detail.dispatchEvent(new Event("toggle", { bubbles: true }));
      }
      window.setTimeout(() => {
        document.getElementById(`scenario-input-diff-${scenarioId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }, 20);
  };
  const spousePartRows = useMemo(
    () =>
      buildSpousePartIncomeEfficiencyRows(
        spousePartCompareScenarios.length > 0 ? spousePartCompareScenarios : [baselineScenario],
        baselineScenario.id,
        spousePartCompareYear,
        spousePartAggregationMode,
      ),
    [baselineScenario, spousePartAggregationMode, spousePartCompareScenarios, spousePartCompareYear],
  );
  const hasSpousePartSalaryDifferences = new Set(spousePartRows.map((row) => row.spouseSalaryIncome)).size > 1;
  const spousePartRateClass = (row: SpousePartIncomeEfficiencyRow) => {
    if (row.incomeDelta > 0 && row.netTakeHomeDelta <= 0) return "text-red-600";
    if (row.takeHomeRate === null) return "";
    if (row.takeHomeRate >= 0.8) return "text-teal-700";
    if (row.takeHomeRate >= 0.6) return "";
    if (row.takeHomeRate >= 0.4) return "text-amber-700";
    return "text-red-600";
  };
  const getOptionImpactSummary = (row: (typeof optionTaxSocialImpactRows)[number]) => {
    if (baselineCompareRow?.scenario.id === row.scenario.id) {
      return "比較基準です。";
    }
    const idecoReceiptDiff = row.scenarioDiff.items.find((item) => item.summary.includes("iDeCo一時金受取年月"));
    if (idecoReceiptDiff) {
      const match = idecoReceiptDiff.summary.match(/基準 ([0-9/]+) \/ このシナリオ ([0-9/]+)/);
      const timing = match ? `iDeCo一括を${match[1]}から${match[2]}へ変更。` : "iDeCo一括の受取年月を変更。";
      return `${timing}全期間の資産成長差 ${signedCompactYen(row.assetGrowthDelta)}、税・社会保険等影響 ${signedCompactYen(-row.taxSocialDelta)}。指定年齢残高差は、受取月までの差だけでなく、その後に残った資産が指定年齢まで運用された影響も含めて確認してください。公的年金等控除の年齢切替は、税・社会保険タブ > 所得税・住民税の計算式確認 > メンバー別の課税対象収入と控除 で確認できます。`;
    }
    if (row.declaredOptionProfit <= 0 && row.optionToLiquidDelta <= 0) {
      return `一般口座オプション利益はありません。指定年齢残高差は、全期間の資産成長差 ${signedCompactYen(row.assetGrowthDelta)}、税・社会保険等影響 ${signedCompactYen(-row.taxSocialDelta)}、NISA実行差を分けて確認してください。`;
    }
    if (row.taxSocialDelta > row.optionToLiquidDelta && row.nisaSkippedDelta > 0) {
      return row.nisaExecutedDelta > 0
        ? "NISA実行額は増えていますが、追加の投資予定も増えたため未実行差も増えています。実行額と未実行差を分けて確認してください。"
        : "利益移動より税社保増分と投資資金需要の影響が大きく、NISA未実行が増えています。";
    }
    if (row.taxSocialDelta > row.optionToLiquidDelta) {
      return "一般口座利益はありますが、税社保増分が利益移動増分を上回っています。";
    }
    if (row.nisaSkippedDelta > 0) {
      return row.nisaExecutedDelta > 0
        ? "利益移動とNISA実行額は増えていますが、未実行差も増えています。資金不足か枠上限かは残り生涯枠も確認してください。"
        : "利益移動は増えていますが、NISA未実行も増えています。生活費・税社保・投資枠の配分を確認してください。";
    }
    return "一般口座利益により流動資金が増え、税社保増分を上回っています。";
  };
  const getScenarioInputDiffLabel = (row: (typeof optionTaxSocialImpactRows)[number]) => {
    if (baselineCompareRow?.scenario.id === row.scenario.id) return "比較基準";
    const items = row.scenarioDiff.headlineItems.length > 0 ? row.scenarioDiff.headlineItems : row.scenarioDiff.items;
    if (items.length === 0) return "入力差分なし";
    return items.slice(0, 2).map((item) => item.summary).join(" / ");
  };
  const getMainCauseMemo = (row: (typeof optionTaxSocialImpactRows)[number]) => {
    if (baselineCompareRow?.scenario.id === row.scenario.id) return "比較基準";
    const parts = [
      `運用 ${signedCompactYen(row.assetGrowthDelta)}`,
      `税社保 ${signedCompactYen(-row.taxSocialDelta)}`,
    ];
    if (row.nisaExecutedDelta !== 0) parts.push(`NISA実行 ${signedCompactYen(row.nisaExecutedDelta)}`);
    if (row.nisaSkippedDelta !== 0) parts.push(`NISA未実行 ${signedCompactYen(-row.nisaSkippedDelta)}`);
    return parts.join(" / ");
  };
  const decisionRows = optionTaxSocialImpactRows.map((row) => {
    const isBaseline = baselineCompareRow?.scenario.id === row.scenario.id;
    const targetBalanceDelta = row.targetBalanceDelta;
    const afterLivingCapacityDelta = row.afterLivingCapacityDelta;
    const taxSocialDelta = row.taxSocialDelta;
    const score =
      targetBalanceDelta / 1_000_000 +
      afterLivingCapacityDelta / 1_000_000 -
      Math.max(0, taxSocialDelta) / 1_000_000 -
      Math.max(0, row.nisaSkippedDelta) / 1_000_000;
    const depletionLabel = row.result.depletionYearMonth
      ? `${row.result.depletionAgeYears}歳${row.result.depletionAgeMonths}か月`
      : "期間内維持";
    const headline = isBaseline
      ? "比較基準"
      : targetBalanceDelta >= 0 && afterLivingCapacityDelta >= 0
        ? "残高と余力が改善"
        : targetBalanceDelta >= 0
          ? "残高は改善、余力は要確認"
          : afterLivingCapacityDelta >= 0
            ? "余力は改善、残高は要確認"
            : "残高と余力が悪化";
    const reason =
      isBaseline
        ? "このシナリオを基準に差分を見ています。"
        : taxSocialDelta > 0 && afterLivingCapacityDelta < 0
          ? "税社保負担の増加が手取り余力を押し下げています。"
          : taxSocialDelta < 0 && afterLivingCapacityDelta >= 0
            ? "税社保負担が下がり、生活後余力が改善しています。"
            : targetBalanceDelta > 0
              ? "指定年齢残高が基準より増えています。"
              : "指定年齢残高が基準より減っています。";
    return {
      ...row,
      isBaseline,
      score,
      depletionLabel,
      headline,
      reason,
    };
  });
  const rankedDecisionRows = [...decisionRows].sort((a, b) => {
    if (a.isBaseline !== b.isBaseline) return a.isBaseline ? 1 : -1;
    return b.score - a.score;
  });
  const bestDecisionRow = rankedDecisionRows.find((row) => !row.isBaseline) ?? rankedDecisionRows[0];
  const worstDecisionRow = [...decisionRows]
    .filter((row) => !row.isBaseline)
    .sort((a, b) => a.score - b.score)[0];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>比較の結論</CardTitle>
          <CardDescription>
            基準シナリオ「{baselineScenario.name}」と比べて、資産寿命、目標残高、税社保増分、生活後余力を分けて見ます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-md border bg-emerald-50 px-4 py-4">
              <div className="text-sm font-medium text-emerald-900">最も良さそうな案</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-950">{bestDecisionRow?.scenario.name ?? "-"}</div>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                目標残高差 {compactYen(bestDecisionRow?.targetBalanceDelta ?? 0)}、生活後余力差 {compactYen(bestDecisionRow?.afterLivingCapacityDelta ?? 0)}。
              </p>
            </div>
            <div className="rounded-md border bg-amber-50 px-4 py-4">
              <div className="text-sm font-medium text-amber-900">注意して見る案</div>
              <div className="mt-2 text-2xl font-semibold text-amber-950">{worstDecisionRow?.scenario.name ?? "-"}</div>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                目標残高差 {compactYen(worstDecisionRow?.targetBalanceDelta ?? 0)}、税社保増分 {compactYen(worstDecisionRow?.taxSocialDelta ?? 0)}。
              </p>
            </div>
            <div className="rounded-md border bg-blue-50 px-4 py-4">
              <div className="text-sm font-medium text-blue-900">比較期間</div>
              <div className="mt-2 text-2xl font-semibold text-blue-950">{flexibleFreeCashLabel}</div>
              <p className="mt-2 text-sm leading-6 text-blue-900">
                この期間の生活後余力と資産活用額を共通条件で比較しています。
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-[1040px]">
              <thead>
                <Tr>
                  <Th>シナリオ</Th>
                  <Th>判定</Th>
                  <Th>資産寿命</Th>
                  <Th>目標残高差</Th>
                  <Th>主因メモ</Th>
                  <Th>税社保増分</Th>
                  <Th>生活後余力差</Th>
                  <Th>NISA未実行差</Th>
                  <Th>読み方</Th>
                </Tr>
              </thead>
              <tbody>
                {decisionRows.map((row) => (
                  <Tr key={`decision-${row.scenario.id}`} className={row.isBaseline ? "bg-slate-50" : ""}>
                    <Td className="font-medium">{row.scenario.name}</Td>
                    <Td>{row.headline}</Td>
                    <Td>{row.depletionLabel}</Td>
                    <Td className={row.targetBalanceDelta < 0 ? "text-red-600" : row.targetBalanceDelta > 0 ? "text-teal-700" : ""}>
                      {row.isBaseline ? "-" : compactYen(row.targetBalanceDelta)}
                    </Td>
                    <Td className="min-w-[260px] text-sm text-muted-foreground">{getMainCauseMemo(row)}</Td>
                    <Td className={row.taxSocialDelta > 0 ? "text-red-600" : row.taxSocialDelta < 0 ? "text-teal-700" : ""}>
                      {row.isBaseline ? "-" : compactYen(row.taxSocialDelta)}
                    </Td>
                    <Td className={row.afterLivingCapacityDelta < 0 ? "text-red-600" : row.afterLivingCapacityDelta > 0 ? "text-teal-700" : ""}>
                      {row.isBaseline ? "-" : compactYen(row.afterLivingCapacityDelta)}
                    </Td>
                    <Td className={row.nisaSkippedDelta > 0 ? "text-red-600" : row.nisaSkippedDelta < 0 ? "text-teal-700" : ""}>
                      {row.isBaseline ? "-" : compactYen(row.nisaSkippedDelta)}
                    </Td>
                    <Td className="min-w-[300px] text-sm text-muted-foreground">{row.reason}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            赤は基準より悪化または負担増、青緑は基準より改善または負担減です。税社保増分は支出の増減、生活後余力差は税社保を払った後に残る余力の増減として分けています。
            主因メモでは税社保増を残高へのマイナス影響として表示します。
          </p>
        </CardContent>
      </Card>

      <ScenarioSyncDetails
        id="spouse-part-income-efficiency-compare"
        title="配偶者パート収入の実質手残り比較"
        description="基準シナリオに対して、配偶者の給与収入増、税・社会保険料増、世帯の実質手残りを比較します。妻のパート年収別シナリオを作ったときに使います。"
        defaultOpen={hasSpousePartSalaryDifferences}
      >
        <Card>
          <CardHeader>
            <CardTitle>配偶者給与収入の手残り効率</CardTitle>
            <CardDescription>
              既存の比較基準「{baselineScenario.name}」との差分です。主計算では、妻の給与・働き方設定だけを基準シナリオへ差し替えて比較します。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="比較対象年">
                <Select value={String(spousePartCompareYear)} onChange={(event) => setSpousePartCompareYear(numberOrZero(event.target.value))}>
                  {spousePartCompareYears.map((year) => (
                    <option key={year} value={year}>
                      {year}年
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="集計モード">
                <Select
                  value={spousePartAggregationMode}
                  onChange={(event) => setSpousePartAggregationMode(event.target.value as SpousePartIncomeAggregationMode)}
                >
                  <option value="incomeYear">所得発生年ベース</option>
                  <option value="cashPaymentYear">現金支払年ベース</option>
                </Select>
              </Field>
            </div>
            <div className="rounded-md border bg-slate-50 px-4 py-3 text-sm leading-6 text-muted-foreground">
              所得発生年ベースは、その年の給与収入に対する所得税・住民税・国保・勤務先社保などの制度上の判定で見ます。
              現金支払年ベースは、結果タブの支払タイミングに合わせ、その年に実際に出ていく税・社会保険の現金流出で見ます。
              妻の給与以外にも条件差がある行は、主計算ではその差を除外し、入力差分セクションで確認できるようにしています。
            </div>
            <div className="table-scroll overflow-auto">
              <Table className="min-w-[1800px]">
                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                  <Tr>
                    <Th className="sticky-col left-0 z-30 bg-white">シナリオ</Th>
                    <Th>配偶者<br />給与収入</Th>
                    <Th>収入増<br />基準比</Th>
                    <Th>税・社保増<br />基準比</Th>
                    <Th>うち所得税<br />住民税</Th>
                    <Th>うち<br />社会保険料</Th>
                    <Th>控除影響</Th>
                    <Th>実質手残り増<br />基準比</Th>
                    <Th>実質<br />手残り率</Th>
                    <Th>負担率</Th>
                    <Th>社保判定</Th>
                    <Th className="min-w-[420px]">読み方</Th>
                  </Tr>
                </thead>
                <tbody>
                  {spousePartRows.map((row) => (
                    <Tr key={`spouse-part-${row.scenarioId}`}>
                      <Td className="sticky-col left-0 z-20 bg-white font-medium">
                        <div>{row.scenarioName}</div>
                        {row.hasOtherConditionDifferences && !row.isBaseline && (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className="inline-flex rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                              title="この行は妻の給与以外にも条件差があります。手残り効率の主計算では、妻の給与・働き方設定だけを基準シナリオへ差し替えて比較しています。"
                            >
                              他条件差あり（主計算から除外）
                            </span>
                            <Button variant="outline" size="sm" onClick={() => openScenarioDiffDetails(row.scenarioId)}>
                              他条件を見る
                            </Button>
                          </div>
                        )}
                      </Td>
                      <Td>{compactYen(row.spouseSalaryIncome)}</Td>
                      <Td className={row.incomeDelta > 0 ? "text-teal-700" : row.incomeDelta < 0 ? "text-red-600" : ""}>{preciseSmallDeltaYen(row.incomeDelta)}</Td>
                      <Td className={row.taxSocialDelta > 0 ? "text-red-600" : row.taxSocialDelta < 0 ? "text-teal-700" : ""}>
                        {preciseSmallDeltaYen(row.taxSocialDelta)}
                      </Td>
                      <Td className={row.incomeResidentTaxDelta > 0 ? "text-red-600" : row.incomeResidentTaxDelta < 0 ? "text-teal-700" : ""}>
                        {preciseSmallDeltaYen(row.incomeResidentTaxDelta)}
                      </Td>
                      <Td className={row.socialInsuranceDelta > 0 ? "text-red-600" : row.socialInsuranceDelta < 0 ? "text-teal-700" : ""}>
                        {preciseSmallDeltaYen(row.socialInsuranceDelta)}
                      </Td>
                      <Td>{row.deductionImpactLabel}</Td>
                      <Td className={row.netTakeHomeDelta > 0 ? "text-teal-700" : row.netTakeHomeDelta < 0 ? "text-red-600" : ""}>
                        {preciseSmallDeltaYen(row.netTakeHomeDelta)}
                      </Td>
                      <Td className={spousePartRateClass(row)}>{row.takeHomeRate === null ? "-" : compactPercent(row.takeHomeRate)}</Td>
                      <Td className={row.burdenRate !== null && row.burdenRate > 0.4 ? "text-red-600" : ""}>
                        {row.burdenRate === null ? "-" : compactPercent(row.burdenRate)}
                      </Td>
                      <Td>
                        <div>{row.socialInsuranceJudgmentLabel}</div>
                        {row.socialInsuranceJudgmentLabel.includes("要確認") && (
                          <Button variant="outline" size="sm" className="mt-2" onClick={() => onOpenSpouseWorkstyleSettings(row.scenarioId)}>
                            社保設定を確認
                          </Button>
                        )}
                      </Td>
                      <Td className="min-w-[420px] text-sm text-muted-foreground">{row.reading}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </ScenarioSyncDetails>

      <Card>
        <CardHeader>
          <CardTitle>複数シナリオ詳細比較表</CardTitle>
          <CardDescription>
            まず資産寿命、目標残高、生涯総支出、資産活用額、楽しみ支出、NISA実行額を横並びで見ます。現在の比較基準は「{baselineScenario.name}」です。
          </CardDescription>
        </CardHeader>
        <CardContent className="border-b">
          <div className="max-w-xl">
            <FlexibleFreeCashPeriodFields period={flexibleFreeCashPeriod} updateScenario={updateScenario} />
          </div>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            比較表の資産活用額は、ここで指定した同じ年齢範囲で全シナリオを集計します。この入力欄は基本情報の資産活用集計期間と同期します。
            基準シナリオの変更と入力差分の確認は、表の下の「比較基準と入力差分」で行います。
          </p>
        </CardContent>
        <CardContent className="table-scroll overflow-auto">
          <Table className="min-w-[1120px]">
            <thead>
              <Tr>
                <Th className="sticky-col left-0 z-30 bg-white">シナリオ</Th>
                <Th>枯渇時期</Th>
                <Th>枯渇年齢</Th>
                <Th>{periodSourceScenario.userProfile.targetBalanceAge}歳<br />残高</Th>
                <Th>生涯総支出</Th>
                <Th>指定年齢残高差<br />基準比</Th>
                <Th>主因メモ</Th>
                <Th>目標残高<br />との差額</Th>
                <Th>{flexibleFreeCashLabel}<br />資産活用額</Th>
                <Th>{flexibleFreeCashPeriod.endAge}歳<br />期間末残高</Th>
                <Th>{flexibleFreeCashLabel}<br />楽しみ支出</Th>
                <Th>NISA実行額</Th>
                <Th>NISA残り枠</Th>
              </Tr>
            </thead>
            <tbody>
              {compareRows.map(
                ({
                  scenario,
                  result,
                  nisaExecuted,
                  finalNisaRemainingLifetimeLimit,
                  flexibleFreeCash,
                  specialExpenseCategoryTotals,
                  targetBalanceAnalysis,
                  lifetimeTotalExpense,
                }) => (
                <Tr key={scenario.id}>
                  <Td className="sticky-col left-0 z-20 bg-white font-medium">{scenario.name}</Td>
                  <Td>{result.depletionYearMonth ?? "期間内維持"}</Td>
                  <Td>{result.depletionAgeYears ? `${result.depletionAgeYears}歳${result.depletionAgeMonths}か月` : "-"}</Td>
                  <Td>{compactYen(result.targetAgeBalance ?? 0)}</Td>
                  <Td>{formatLifetimeExpenseYen(lifetimeTotalExpense.total)}</Td>
                  {(() => {
                    const detailRow = optionTaxSocialImpactRows.find((row) => row.scenario.id === scenario.id);
                    return (
                      <>
                        <Td className={(detailRow?.targetBalanceDelta ?? 0) < 0 ? "text-red-600" : (detailRow?.targetBalanceDelta ?? 0) > 0 ? "text-teal-700" : ""}>
                          {detailRow && baselineCompareRow?.scenario.id !== scenario.id ? compactYen(detailRow.targetBalanceDelta) : "-"}
                        </Td>
                        <Td className="min-w-[260px] text-sm text-muted-foreground">{detailRow ? getMainCauseMemo(detailRow) : "-"}</Td>
                      </>
                    );
                  })()}
                  <Td className={targetBalanceStatusClassNames[targetBalanceAnalysis.status]}>{compactYen(targetBalanceAnalysis.gap)}</Td>
                  <Td className={flexibleFreeCash.assetUtilizationAmount > 0 ? "text-amber-700" : "text-teal-700"}>{compactYen(flexibleFreeCash.assetUtilizationAmount)}</Td>
                  <Td>{compactYen(flexibleFreeCash.periodEndBalance)}</Td>
                  <Td>{compactYen(specialExpenseCategoryTotals.enjoyment)}</Td>
                  <Td>{compactYen(nisaExecuted)}</Td>
                  <Td>{compactLimitYen(finalNisaRemainingLifetimeLimit)}</Td>
                </Tr>
                ),
              )}
            </tbody>
          </Table>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            資産活用額、期間末残高、楽しみ支出は上で指定した年齢範囲で集計します。不足補填売却、収入化した原資、計画取り崩し、NISA未実行、追加投資は下の詳細比較や結果タブで確認します。
            年齢範囲内の収支感は「資産活用額」を主に見て、追加投資やNISA未実行とは分けて確認してください。
          </p>
        </CardContent>
      </Card>
      <ScenarioSyncDetails
        id="scenario-input-diff-details"
        title={`比較基準と入力差分（基準: ${baselineScenario.name}）`}
        description="基準シナリオの変更と、各シナリオの入力条件差分を必要な時だけ確認します。"
      >
        <Card>
          <CardHeader>
            <CardTitle>比較基準</CardTitle>
            <CardDescription>
              ここで選んだシナリオを基準に、詳細比較の差分を計算します。シナリオを一番上に移動する必要はありません。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="基準シナリオ">
              <Select value={baselineScenarioId} onChange={(event) => setBaselineScenarioId(event.target.value)} className="max-w-xl">
                {scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              {compareRows.map((row) => (
                <div
                  id={`scenario-input-diff-${row.scenario.id}`}
                  key={`diff-${row.scenario.id}`}
                  className={cn(
                    "scroll-mt-28 rounded-md border bg-slate-50 px-4 py-3 text-sm leading-6 transition-shadow",
                    highlightedDiffScenarioId === row.scenario.id ? "border-amber-300 ring-2 ring-amber-200 ring-offset-2" : "",
                  )}
                >
                  <div className="font-medium">{row.scenario.name}</div>
                  <div className="mt-1 text-muted-foreground">
                    {row.scenario.id === baselineScenario.id ? "比較基準です。" : formatScenarioDiffHeadline(row.scenarioDiff)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </ScenarioSyncDetails>
      <ScenarioSyncDetails
        title="このタブの読み方"
        description="表で先に見る列と、原因調査へ進む時の確認先を開きます。"
      >
        <div className="grid gap-3 text-sm leading-6 md:grid-cols-3">
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="font-medium">このタブで見ること</div>
            <p className="mt-1 text-muted-foreground">シナリオごとの差です。個別シナリオの詳細原因は、結果タブや税・社会保険タブで確認します。</p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="font-medium">最初に見る列</div>
            <p className="mt-1 text-muted-foreground">資産寿命、目標残高との差額、資産活用額、楽しみ支出、NISA実行額を先に見ます。</p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <div className="font-medium">原因を見る時</div>
            <p className="mt-1 text-muted-foreground">一般口座利益、税社保増分、NISA未実行は下の詳細比較で確認します。</p>
          </div>
        </div>
      </ScenarioSyncDetails>
      <ScenarioSyncDetails
        title="差分分解（税社保・運用・NISA）"
        description="基準シナリオとの差分を、指定年齢残高、資産成長、税・社会保険等、生活後余力、NISAに分けて確認します。"
      >
      <Card>
        <CardHeader>
          <CardTitle>差分分解（税社保・運用・NISA）</CardTitle>
          <CardDescription>
            選択した基準シナリオ「{baselineScenario.name}」に対して、シナリオ全体の差分が指定年齢残高へどう影響したかを確認します。一般口座オプションだけでなく、iDeCo受取年月、税支払タイミング、NISA実行差もここで分解します。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-scroll overflow-auto">
          <Table className="min-w-[1880px]">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <Tr>
                <Th className="sticky-col left-0 z-30 bg-white">シナリオ</Th>
                <Th className="min-w-[360px]">主な入力差分</Th>
                <Th>指定年齢残高差<br />基準比</Th>
                <Th>全期間の<br />資産成長差<br />基準比</Th>
                <Th>税・社会保険等差<br />基準比</Th>
                <Th>生活後余力差<br />基準比</Th>
                <Th>NISA実行額差<br />基準比</Th>
                <Th>NISA未実行差<br />基準比</Th>
                <Th>申告対象<br />運用損益</Th>
                <Th>運用口座から<br />現金・普通預金へ</Th>
                <Th className="min-w-[420px]">読み方</Th>
              </Tr>
            </thead>
            <tbody>
              {optionTaxSocialImpactRows.map((row) => (
                <Tr key={`option-impact-${row.scenario.id}`}>
                  <Td className="sticky-col left-0 z-20 bg-white font-medium">{row.scenario.name}</Td>
                  <Td className="min-w-[360px] text-sm text-muted-foreground">{getScenarioInputDiffLabel(row)}</Td>
                  <Td className={row.targetBalanceDelta < 0 ? "text-red-600" : row.targetBalanceDelta > 0 ? "text-teal-700" : ""}>
                    {baselineCompareRow?.scenario.id === row.scenario.id ? "-" : compactYen(row.targetBalanceDelta)}
                  </Td>
                  <Td className={row.assetGrowthDelta < 0 ? "text-red-600" : row.assetGrowthDelta > 0 ? "text-teal-700" : ""}>
                    {baselineCompareRow?.scenario.id === row.scenario.id ? "-" : compactYen(row.assetGrowthDelta)}
                  </Td>
                  <Td className={row.taxSocialDelta > 0 ? "text-red-600" : row.taxSocialDelta < 0 ? "text-teal-700" : ""}>
                    {baselineCompareRow?.scenario.id === row.scenario.id ? "-" : compactYen(row.taxSocialDelta)}
                  </Td>
                  <Td className={row.afterLivingCapacityDelta < 0 ? "text-red-600" : row.afterLivingCapacityDelta > 0 ? "text-teal-700" : ""}>
                    {baselineCompareRow?.scenario.id === row.scenario.id ? "-" : compactYen(row.afterLivingCapacityDelta)}
                  </Td>
                  <Td className={row.nisaExecutedDelta < 0 ? "text-red-600" : row.nisaExecutedDelta > 0 ? "text-teal-700" : ""}>
                    {baselineCompareRow?.scenario.id === row.scenario.id ? "-" : compactYen(row.nisaExecutedDelta)}
                  </Td>
                  <Td className={row.nisaSkippedDelta > 0 ? "text-red-600" : row.nisaSkippedDelta < 0 ? "text-teal-700" : ""}>
                    {baselineCompareRow?.scenario.id === row.scenario.id ? "-" : compactYen(row.nisaSkippedDelta)}
                  </Td>
                  <Td>{compactYen(row.declaredOptionProfit)}</Td>
                  <Td>{compactYen(row.optionToLiquid)}</Td>
                  <Td className="min-w-[420px] text-sm text-muted-foreground">{getOptionImpactSummary(row)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            税・社会保険等差は支出増なら赤、支出減なら青緑です。主因メモでは残高への影響として符号を反転し、税社保増をマイナス要因として読めるようにしています。
            申告対象の運用損益は後方列に置き、関係する比較だけで確認します。公的年金等控除の年齢切替は、税・社会保険タブ &gt; 所得税・住民税の計算式確認 &gt; メンバー別の課税対象収入と控除 で確認できます。
          </p>
        </CardContent>
      </Card>
      </ScenarioSyncDetails>
      <ScenarioSyncDetails
        title="比較チャート"
        description="表で気になる差が出た時に、棒グラフで傾向を確認します。"
      >
      <Card>
        <CardHeader>
          <CardTitle>資産寿命と生活資金不足</CardTitle>
          <CardDescription>赤い棒は追加投資を除いた生活資金不足、グレーは実際に資産から動いた額です。緑の棒が指定年齢時点の残高です。</CardDescription>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={longevityChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <Tooltip formatter={(value) => yen(Number(value))} />
              <Bar dataKey="target" name="指定年齢残高" fill="#0f766e" />
              <Bar dataKey="livingAndTaxNeed" name="生活資金不足" fill="#e11d48" />
              <Bar dataKey="assetMoved" name="実際に資産から動いた額" fill="#64748b" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>税社保と手取り効率</CardTitle>
          <CardDescription>
            年平均で、現金収入・一般口座から流動資金へ戻した資金・税社保負担・生活費等を払った後の余力を比較します。
            税社保負担は支出額なのでプラス表示、生活費・税社保後余力は不足するとマイナス表示です。
          </CardDescription>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={efficiencyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <Tooltip formatter={(value) => yen(Number(value))} />
              <Bar dataKey="cashIncomeAverage" name="年平均現金収入" fill="#0f766e" />
              <Bar dataKey="optionToLiquidAverage" name="年平均 一般口座から流動資金へ" fill="#14b8a6" />
              <Bar dataKey="taxSocialAverage" name="年平均税社保負担（支出）" fill="#dc2626" />
              <Bar dataKey="afterLivingCapacityAverage" name="生活費・税社保後余力" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      </ScenarioSyncDetails>
    </div>
  );
}

function ManualSection() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>信頼性と注意事項</CardTitle>
          <CardDescription>このアプリの計算結果を読む前に確認する前提です。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm leading-7 md:grid-cols-2">
          <div className="rounded-md border bg-amber-50 px-4 py-3 text-amber-950">
            <p className="font-medium">計算は概算です</p>
            <p className="mt-1">
              税金・社会保険は2026年度前提を中心にした概算です。所得税、住民税、国保、後期高齢者医療、介護保険、譲渡益税を扱いますが、通知書の金額と一致する保証はありません。
            </p>
          </div>
          <div className="rounded-md border bg-sky-50 px-4 py-3 text-sky-950">
            <p className="font-medium">自治体差と制度改正があります</p>
            <p className="mt-1">
              国保は大田区、後期高齢者医療は東京都の概算ルールを使っています。居住地や年度が変わると保険料、軽減、上限額が変わります。
            </p>
          </div>
          <div className="rounded-md border bg-emerald-50 px-4 py-3 text-emerald-950">
            <p className="font-medium">保存先はこのブラウザです</p>
            <p className="mt-1">
              入力内容はご利用中の端末内に保存されます。クラウド同期や別端末への自動共有はありません。必要な時はデータタブから保存用ファイルを作成してください。
            </p>
          </div>
          <div className="rounded-md border bg-rose-50 px-4 py-3 text-rose-950">
            <p className="font-medium">重要判断は専門家確認が必要です</p>
            <p className="mt-1">
              年金繰上げ・繰下げ、退職金、iDeCo受取、資産売却、確定申告、社会保険の切替は、通知書、年金事務所、自治体、税理士、社労士、FPなどで確認してください。
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>プライバシーとフィードバック</CardTitle>
          <CardDescription>限定公開中のデータの扱いと連絡方法です。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-7">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-sky-50 px-4 py-3 text-sky-950">
              <p className="font-medium">アプリ置き場</p>
              <p className="mt-1">画面と計算ロジックだけを読み込みます。</p>
            </div>
            <div className="rounded-md border bg-emerald-50 px-4 py-3 text-emerald-950">
              <p className="font-medium">ご利用中の端末</p>
              <p className="mt-1">入力内容はここに保存されます。</p>
            </div>
            <div className="rounded-md border bg-amber-50 px-4 py-3 text-amber-950">
              <p className="font-medium">配布者・作成者</p>
              <p className="mt-1">通常操作では入力内容は届きません。</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <p className="font-medium">入力内容は送信されません</p>
              <p className="mt-1 text-muted-foreground">
                この版はご利用中の端末に保存します。通常操作で家計・資産・年金情報が運営側へ自動送信されることはありません。
              </p>
            </div>
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <p className="font-medium">共有は自分で選びます</p>
              <p className="mt-1 text-muted-foreground">
                保存用ファイル、月別結果のファイル、画面の画像、フィードバック文を送った場合だけ、その中に含まれる情報が相手に渡ります。
              </p>
            </div>
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <p className="font-medium">消したい時はデータタブ</p>
              <p className="mt-1 text-muted-foreground">
                共有端末で試した後などは、データタブからこの端末の入力データと履歴バックアップを削除できます。
              </p>
            </div>
          </div>
          <div className="rounded-md border bg-rose-50 px-4 py-3 text-rose-950">
            保存用ファイルや画面の画像には家計情報が含まれます。送付前に金額や個人情報を伏せるか、必要範囲だけ共有してください。
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>最初からやり直すには</CardTitle>
          <CardDescription>試しに入れた数字を消して、初回状態から入力し直す方法です。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
          <p>
            上部メニューの「データ」を開き、「この端末の入力データを削除」を押すと、このブラウザに保存された入力データと履歴バックアップを削除できます。
            確認画面が表示されるため、内容を確認してから実行してください。
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border bg-rose-50 px-4 py-3 text-rose-950">
              <p className="font-medium">削除されるもの</p>
              <p className="mt-1">このブラウザに保存された入力データと履歴バックアップが削除されます。削除後は、初期サンプルと初回設定からやり直せます。</p>
            </div>
            <div className="rounded-md border bg-sky-50 px-4 py-3 text-sky-950">
              <p className="font-medium">削除されないもの</p>
              <p className="mt-1">過去に作成した保存用JSONファイルは自動では削除されません。不要な保存用JSONファイルは、端末上で別途削除してください。</p>
            </div>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3 text-slate-700">
            <p className="font-medium text-slate-900">「サンプルに戻す」との違い</p>
            <p className="mt-1">
              「サンプルに戻す」は、現在の入力内容をサンプルへ戻す操作です。完全に初回状態から試したい場合は、「この端末の入力データを削除」を使ってください。
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            このアプリは
          </CardTitle>
          <CardDescription>生活費、税金・社会保険、資産形成と取り崩しをまとめて見積もるためのシミュレーションアプリです。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
          <p>
            生活費、収入、税・社会保険、資産残高、iDeCo受取、追加投資をまとめて入力し、月別・年別の資産推移を確認できます。
          </p>
          <p>
            資産寿命だけでなく、税金・社会保険を払った後に本当に使えるお金を確認できます。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>用語の読み替え</CardTitle>
          <CardDescription>画面で使う言葉の意味を簡単に確認します。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm leading-7 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">資産寿命</p>
            <p className="text-muted-foreground">試算期間内で、生活費や税社保などを払った後に資産が尽きる時期です。尽きない場合は「期間内維持」と表示します。</p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">生活費・税社保後の余力</p>
            <p className="text-muted-foreground">現金収入等から生活費と税社保を引いた後の目安です。楽しみ支出や追加投資は別に確認します。</p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">目標残高</p>
            <p className="text-muted-foreground">指定した年齢時点で残したい金額です。初期サンプルでは90歳時点500万円を目安にしています。</p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">支出化</p>
            <p className="text-muted-foreground">やりたいことを、年月・金額・カテゴリ付きの特別支出に変換し、試算結果に反映することです。</p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">補正</p>
            <p className="text-muted-foreground">通知書や実額が分かる場合に、自動概算との差額を入力して近づけるための調整です。</p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">保存用ファイル</p>
            <p className="text-muted-foreground">入力内容をファイルとして残す操作です。別のブラウザや端末へ移す時にも使います。</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>使い方の順番</CardTitle>
          <CardDescription>迷ったらこの順番で入力してください。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-7">
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>基本情報で、生年月日、開始年月、終了条件、指定年齢を入れます。</li>
            <li>世帯情報で、居住自治体、世帯主、世帯メンバーを入れます。</li>
            <li>初期資産で、現金、預金、NISA、特定口座、iDeCoなどの残高を入れます。</li>
            <li>生活費で、現在の月額費用と、年齢に応じた変更ルールを入れます。</li>
            <li>収入で、給与、年金、iDeCo受取などのイベントと、対象メンバーを入れます。</li>
            <li>税・社会保険は、変化する年度だけ入力し、他年度は直近値を引き継ぎます。</li>
            <li>必要なら特別支出、シナリオ複製、比較を使います。</li>
            <li>資産を有効に使う余地は、資産活用ビューでタイムバケット、クイック試算、資産レビュー、入金力診断の順に確認します。</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>資産活用ビューの読み方</CardTitle>
          <CardDescription>健康寿命期にどれだけ楽しみに使えるかを見るための順番です。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm leading-7 md:grid-cols-2">
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">1. タイムバケット</p>
            <p className="mt-1 text-muted-foreground">
              旅行・趣味・家族イベントなど、何をしたいかを先に整理します。計算に入れるものだけ特別支出へ変換します。
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">2. 追加支出クイック試算</p>
            <p className="mt-1 text-muted-foreground">
              保存データを変えずに、60〜72歳などの期間へ年50万円、年100万円と追加した場合の90歳残高と資産寿命を確認します。
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">3. 資産レビュー</p>
            <p className="mt-1 text-muted-foreground">
              90歳目標との差額、資産活用中かどうか、楽しみ比率を見ます。安全余力が不足している場合は、追加支出より先に安全性側を直します。
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">4. 入金力診断</p>
            <p className="mt-1 text-muted-foreground">
              一般口座オプション収入を仮に月0〜50万円へ置き換え、税・社会保険を引いた実質手残りと、楽しみに増やせる年額の分岐点を見ます。
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>入金力別診断の読み方</CardTitle>
          <CardDescription>入金を増やした時に、税・社会保険を差し引いて楽しみに回せる余地を見る表です。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm leading-7 md:grid-cols-2">
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">診断対象</p>
            <p className="mt-1 text-muted-foreground">
              収入タブで原資資産を「一般口座（オプション用）」にしている収入イベント数です。ここが0件なら、入金力別診断は計算できません。
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">分岐点</p>
            <p className="mt-1 text-muted-foreground">
              月0万、10万、20万のように仮入金力を上げた時、90歳目標残高を守りながら楽しみ支出を増やせる最初の候補です。
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">最大候補</p>
            <p className="mt-1 text-muted-foreground">
              診断した候補の中で、90歳目標残高を守ったうえで楽しみに増やせる年額が最も大きい候補です。
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">効率がよい候補</p>
            <p className="mt-1 text-muted-foreground">
              入金総額に対して、税・社会保険を引いた実質手残りの割合が高い候補です。これは資産寿命ではなく、入金そのものの手残り効率を見ます。
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3 md:col-span-2">
            <p className="font-medium">診断表の詳細</p>
            <p className="mt-1 text-muted-foreground">
              「前段からの差分」は、月0万から月10万、月10万から月20万のように一段増やした時の変化です。
              入金増、税・社保増、手残り増、楽しみ支出の増減を並べて、どの段階から効率が落ちるかを確認します。
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>追加投資の扱い</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <p>毎月の追加投資は、当月の収入と流動資金を先に使い、不足した分は定期預金や投資資産から補います。</p>
            <p>追加投資そのものは収入ではなく、資産の振替です。総資産を増やす効果はありません。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>iDeCo受取の扱い</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <p>収入イベントで「原資資産」を iDeCo にすると、受取額は流動資金に入ります。</p>
            <p>同時に iDeCo 残高はその分だけ減ります。残高が足りなければ、その月に受け取れる額も残高までに制限されます。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>取り崩しの順番</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <p>不足分は、まず現金と普通預金の流動資金で吸収し、流動資金が最低保持額を下回る場合に定期預金や投資資産から補います。</p>
            <p>現在の実装では、流動資金の次に 定期預金 → 特定口座 → 一般口座（オプション用） → NISA → iDeCo の順です。</p>
            <p>取り崩し対象外資産と負債は、この取り崩し順の対象外です。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>生活費の年齢変更</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <p>年齢別の生活費変更は、満年齢に応じて毎月自動適用されます。</p>
            <p>倍率指定は、その時点の生活費に対する倍率です。最初の年だけに固定で掛かる方式ではありません。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>税・社会保険</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <p>`自動計算` を選ぶと、税・社会保険タブに年度ごとの自動計算結果が表示され、その金額が支出として月次計算に入ります。</p>
            <p>`自動計算 + 補正` では、自動計算結果を見ながら差額だけ補正できます。</p>
            <p>生活費タブの `税・社会保険` は、税社保タブを使うときは自動で計算対象から外れます。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
          <CardTitle>保存と復元</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <p>入力内容はご利用中の端末に自動保存されます。</p>
            <p>「履歴に保存」で手動バックアップを残し、「保存用バックアップ作成」でファイルとしても保存できます。</p>
            <p>別のブラウザや端末には自動同期されません。必要に応じて保存用ファイルを作成してください。</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>よく使う確認先</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm leading-7 md:grid-cols-4">
          <div>
            <p className="font-medium">ダッシュボード</p>
            <p className="text-muted-foreground">資産寿命、指定年齢時点残高、チャートを確認します。</p>
          </div>
          <div>
            <p className="font-medium">資産活用ビュー</p>
            <p className="text-muted-foreground">やりたいことの整理、年額試算、安全余力、入金力別の手残りを順に確認します。</p>
          </div>
          <div>
            <p className="font-medium">比較</p>
            <p className="text-muted-foreground">シナリオ間の差を横並びで見ます。</p>
          </div>
          <div>
            <p className="font-medium">データ</p>
            <p className="text-muted-foreground">保存、履歴、保存用ファイルの入出力をまとめて扱います。</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>画面マップ</CardTitle>
          <CardDescription>目的ごとに見るタブを分けます。迷った時は、先に目的を決めてからタブを開いてください。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm leading-7 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">入力する</p>
            <p className="mt-1 text-muted-foreground">
              基本情報、初期資産、生活費、収入、税・社会保険、特別支出で前提を入れます。シナリオ間コピーは、各入力欄の折りたたみから使います。
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">結論を見る</p>
            <p className="mt-1 text-muted-foreground">
              ダッシュボードで現在資産、資産寿命、指定年齢時点残高を見ます。細かい年次推移は結果タブで確認します。
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">使い方を探す</p>
            <p className="mt-1 text-muted-foreground">
              資産活用ビューで、やりたいことの整理、追加支出クイック試算、資産レビュー、入金力診断を確認します。
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 px-4 py-3">
            <p className="font-medium">差と原因を見る</p>
            <p className="mt-1 text-muted-foreground">
              比較タブでシナリオ差を横並びにし、税・社会保険タブや結果タブで負担増、資産推移、月次の詰まりを確認します。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DataSection(props: {
  exportJson: () => void;
  createBackupAndExport: () => void;
  exportCsv: () => void;
  importJson: () => void;
  resetToSample: () => void;
  clearLocalData: () => void;
  onOpenOnboarding: () => void;
  lastSavedAt?: string;
  backups: PlanBackup[];
  createBackup: (label?: string) => void;
  restoreBackup: (id: string) => void;
  deleteBackup: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>データ入出力</CardTitle>
        <CardDescription>
          ご利用中の端末に自動保存されます。最終保存: {props.lastSavedAt ? formatSavedAt(props.lastSavedAt) : "未保存"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
          <p className="font-medium">保存場所について</p>
          <p className="mt-1">
            入力内容はご利用中の端末に保存されます。通常操作で作成者や配布者へ自動送信されることはありません。
            別のブラウザや端末へは自動同期されません。
          </p>
        </div>
        <div className="grid gap-3 text-sm leading-6 md:grid-cols-3">
          <div className="rounded-lg border bg-white px-4 py-3">
            <p className="font-medium text-slate-950">この画面で保存されるもの</p>
            <p className="mt-1 text-muted-foreground">入力内容、シナリオ、履歴バックアップ</p>
          </div>
          <div className="rounded-lg border bg-white px-4 py-3">
            <p className="font-medium text-slate-950">自分で作るファイル</p>
            <p className="mt-1 text-muted-foreground">保存用ファイルや月別結果のファイルには入力内容や試算結果が含まれます。</p>
          </div>
          <div className="rounded-lg border bg-white px-4 py-3">
            <p className="font-medium text-slate-950">削除したい時</p>
            <p className="mt-1 text-muted-foreground">この端末の入力データと履歴をまとめて削除できます。</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={props.exportJson}>
            <FileJson className="h-4 w-4" />
            保存用ファイル出力
          </Button>
          <Button variant="outline" onClick={props.createBackupAndExport}>
            <Download className="h-4 w-4" />
            保存用バックアップ作成
          </Button>
          <Button variant="outline" onClick={props.importJson}>
            <Upload className="h-4 w-4" />
            保存用ファイル読込
          </Button>
          <Button variant="outline" onClick={props.exportCsv}>
            <Download className="h-4 w-4" />
            月次表ファイル出力
          </Button>
          <Button variant="outline" onClick={() => props.createBackup("手動バックアップ")}>
            <FileJson className="h-4 w-4" />
            履歴に保存
          </Button>
          <Button variant="outline" onClick={props.onOpenOnboarding}>
            初回設定をやり直す
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (window.confirm("サンプルデータに戻しますか？現在の状態は復元前履歴として保存されます。")) {
                props.resetToSample();
              }
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            サンプルに戻す
          </Button>
          <Button variant="destructive" onClick={props.clearLocalData}>
            <Trash2 className="h-4 w-4" />
            この端末の入力データを削除
          </Button>
        </div>

        <div className="rounded-lg border bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          保存用ファイルには入力した家計・資産・年金情報が含まれます。共有や送付をする場合は、内容を確認し、必要なら金額や個人情報を伏せてください。
        </div>

        <div className="rounded-lg border bg-white">
          <div className="border-b px-4 py-3">
            <h3 className="font-medium">この端末内の履歴バックアップ</h3>
            <p className="text-sm text-muted-foreground">最大5件まで保持します。復元前にも現在状態を履歴へ残します。</p>
          </div>
          {props.backups.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">履歴バックアップはまだありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <Tr>
                    <Th>作成時刻</Th>
                    <Th>内容</Th>
                    <Th>シナリオ数</Th>
                    <Th>操作</Th>
                  </Tr>
                </thead>
                <tbody>
                  {props.backups.map((backup) => (
                    <Tr key={backup.id}>
                      <Td>{formatSavedAt(backup.savedAt)}</Td>
                      <Td>{backup.label}</Td>
                      <Td>{backup.state.scenarios.length}</Td>
                      <Td className="space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (window.confirm("この履歴バックアップを復元しますか？現在の状態は復元前履歴として保存されます。")) {
                              props.restoreBackup(backup.id);
                            }
                          }}
                        >
                          復元
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => props.deleteBackup(backup.id)}>
                          削除
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatSavedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatWithdrawalSources(breakdown: AnnualResult["withdrawalSourceBreakdown"] | MonthlyResult["withdrawalSourceBreakdown"]) {
  return (Object.entries(breakdown) as [GrowthAssetKey, number][])
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${growthAssetLabels[key]} ${compactYen(value)}`)
    .join("\n");
}

function formatDetails(details: string[]) {
  return details.length ? details.join("\n") : "-";
}

function parseCompactYenText(value: string) {
  const normalized = value.replace(/[¥￥,\s]/g, "");
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(億円|万円|円)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  if (match[2] === "億円") return amount * 100_000_000;
  if (match[2] === "万円") return amount * 10_000;
  return amount;
}

function summarizeAnnualDetails(details: string[]) {
  const parsed = new Map<string, { route: string; suffix: string; total: number; count: number }>();
  const unparsed = new Map<string, number>();

  details.forEach((detail) => {
    const trimmed = detail.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^(.*?)\s+([¥￥]?-?[\d,.]+(?:億円|万円|円))(（[^）]+）)?$/);
    if (!match) {
      unparsed.set(trimmed, (unparsed.get(trimmed) ?? 0) + 1);
      return;
    }

    const route = match[1].trim();
    const amount = parseCompactYenText(match[2]);
    const suffix = match[3] ?? "";
    if (amount === null || !route) {
      unparsed.set(trimmed, (unparsed.get(trimmed) ?? 0) + 1);
      return;
    }

    const key = `${route}|${suffix}`;
    const current = parsed.get(key) ?? { route, suffix, total: 0, count: 0 };
    current.total += amount;
    current.count += 1;
    parsed.set(key, current);
  });

  const lines = Array.from(parsed.values()).map(({ route, suffix, total, count }) =>
    `${route} ${compactYen(total)}${suffix}${count > 1 ? `（${count}回）` : ""}`,
  );
  Array.from(unparsed.entries()).forEach(([detail, count]) => {
    lines.push(count > 1 ? `${detail}（${count}回）` : detail);
  });

  return lines.length ? lines.join("\n") : "-";
}

function formatDetailsForPeriod(details: string[], period: "month" | "year") {
  return period === "year" ? summarizeAnnualDetails(details) : formatDetails(details);
}

function compactLimitYen(value: number) {
  return Number.isFinite(value) ? compactYen(value) : "制限なし";
}

function compactPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function signedCompactYen(value: number) {
  if (value > 0) return `+${compactYen(value)}`;
  return compactYen(value);
}

function preciseSmallDeltaYen(value: number) {
  const rounded = Math.round(value);
  const absolute = Math.abs(rounded);
  if (absolute < 100_000) return `${rounded.toLocaleString("ja-JP")}円`;
  if (absolute < 1_000_000) return `${(rounded / 10_000).toFixed(1)}万円`;
  return compactYen(rounded);
}

function ResultTable(props: { rows: MonthlyResult[]; period: "month" } | { rows: AnnualResult[]; period: "year" }) {
  const { rows, period } = props;
  const stickyHeaderClass = "sticky left-0 z-30 bg-white shadow-[1px_0_0_#cbd5e1]";
  const stickyCellClass = "sticky left-0 z-20 bg-white shadow-[1px_0_0_#cbd5e1]";
  const showPlannedDrawdown = rows.some((row) => row.plannedDrawdownTotal > 0);
  const shortageLabel = period === "month" ? "当月現金不足" : "年間現金不足";
  return (
    <Table className="min-w-[2400px]">
      <thead className="sticky top-0 z-10 bg-white shadow-sm">
        <Tr>
          <Th className={stickyHeaderClass}>{period === "month" ? "年月" : "年 / 年末年齢"}</Th>
          {period === "month" && <Th>月末年齢</Th>}
          <Th>現金収入</Th>
          <Th>生活費</Th>
          <Th>税社保支払</Th>
          <Th>譲渡益税</Th>
          <Th>申告対象譲渡益</Th>
          <Th>特別支出</Th>
          <Th>純収支</Th>
          {showPlannedDrawdown && <Th>手入力計画取り崩し</Th>}
          <Th>{shortageLabel}</Th>
          <Th>予定受取額</Th>
          <Th className="min-w-[300px]">予定受取元</Th>
          <Th>不足補填売却</Th>
          <Th className="min-w-[300px]">不足補填売却元</Th>
          <Th>追加投資</Th>
          <Th>NISA実行</Th>
          <Th>NISA未実行</Th>
          <Th>NISA枠超過</Th>
          <Th>NISA累計投資</Th>
          <Th>残りNISA枠</Th>
          <Th>追加投資原資不足</Th>
          <Th>口座内積上</Th>
          <Th>原資移動</Th>
          <Th className="min-w-[320px]">原資移動内訳</Th>
          <Th>一般口座利益移動</Th>
          <Th className="min-w-[320px]">利益移動内訳</Th>
          <Th>一般口座終了戻し</Th>
          <Th className="min-w-[320px]">終了戻し内訳</Th>
          <Th>証拠金不足停止</Th>
          <Th>iDeCo源泉</Th>
          <Th>iDeCo手数料</Th>
          <Th>運用益</Th>
          <Th>流動資金補充</Th>
          <Th>残高</Th>
        </Tr>
      </thead>
      <tbody>
        {period === "month" &&
          rows.map((row) => (
            <Tr key={row.yearMonth}>
              <Td className={stickyCellClass}>{row.yearMonth}</Td>
              <Td>{`${row.ageYears}歳${row.ageMonths}か月`}</Td>
              <Td>{compactYen(row.incomeTotal)}</Td>
              <Td>{compactYen(row.livingExpenseTotal)}</Td>
              <Td>{compactYen(row.taxInsuranceTotal)}</Td>
              <Td>{compactYen(row.capitalGainsTaxTotal)}</Td>
              <Td>{compactYen(row.declaredCapitalGainsIncomeTotal)}</Td>
              <Td>{compactYen(row.specialExpenseTotal)}</Td>
              <Td className={row.netCashFlow < 0 ? "text-destructive" : "text-primary"}>{compactYen(row.netCashFlow)}</Td>
              {showPlannedDrawdown && <Td>{compactYen(row.plannedDrawdownTotal)}</Td>}
              <Td>{compactYen(row.withdrawalAmount)}</Td>
              <Td>{compactYen(row.sourceAssetIncomeWithdrawalAmount)}</Td>
              <Td className="min-w-[300px] whitespace-pre-line break-words text-sm leading-5 text-muted-foreground">
                {formatWithdrawalSources(row.sourceAssetIncomeBreakdown) || "-"}
              </Td>
              <Td>{compactYen(row.deficitAssetWithdrawalAmount)}</Td>
              <Td className="min-w-[300px] whitespace-pre-line break-words text-sm leading-5 text-muted-foreground">
                {formatWithdrawalSources(row.deficitWithdrawalBreakdown) || "-"}
              </Td>
              <Td>{compactYen(row.assetContributionTotal)}</Td>
              <Td>{compactYen(row.nisaContributionTotal)}</Td>
              <Td className={row.nisaContributionSkippedTotal > 0 ? "text-destructive" : ""}>{compactYen(row.nisaContributionSkippedTotal)}</Td>
              <Td className={row.nisaAnnualLimitExceededTotal > 0 ? "text-destructive" : ""}>{compactYen(row.nisaAnnualLimitExceededTotal)}</Td>
              <Td>{compactYen(row.nisaCumulativeInvestment)}</Td>
              <Td>{compactLimitYen(row.nisaRemainingLifetimeLimit)}</Td>
              <Td className={row.assetContributionFundingGap > 0 ? "text-destructive" : ""}>{compactYen(row.assetContributionFundingGap)}</Td>
              <Td>{compactYen(row.retainedSourceAssetIncomeTotal)}</Td>
              <Td>{compactYen(row.assetTransferTotal)}</Td>
              <Td className="min-w-[320px] whitespace-pre-line break-words text-sm leading-5 text-muted-foreground">
                {formatDetailsForPeriod(row.assetTransferDetails, period)}
              </Td>
              <Td>{compactYen(row.optionProfitSweepTotal)}</Td>
              <Td className="min-w-[320px] whitespace-pre-line break-words text-sm leading-5 text-muted-foreground">
                {formatDetailsForPeriod(row.optionProfitSweepDetails, period)}
              </Td>
              <Td>{compactYen(row.optionAccountReleaseTotal)}</Td>
              <Td className="min-w-[320px] whitespace-pre-line break-words text-sm leading-5 text-muted-foreground">
                {formatDetailsForPeriod(row.optionAccountReleaseDetails, period)}
              </Td>
              <Td className={row.optionIncomeSuspendedTotal > 0 ? "text-destructive" : ""}>{compactYen(row.optionIncomeSuspendedTotal)}</Td>
              <Td>{compactYen(row.idecoWithholdingTaxTotal)}</Td>
              <Td>{compactYen(row.idecoFeeTotal)}</Td>
              <Td>{compactYen(row.growthAmount)}</Td>
              <Td>{compactYen(row.cashReserveTopUpAmount)}</Td>
              <Td>{compactYen(row.endingAssets)}</Td>
            </Tr>
          ))}
        {period === "year" &&
          rows.map((row) => (
            <Tr key={row.year}>
              <Td className={stickyCellClass}>{yearEndAgeLabel(row.year, row.ageYears)}</Td>
              <Td>{compactYen(row.incomeTotal)}</Td>
              <Td>{compactYen(row.livingExpenseTotal)}</Td>
              <Td>{compactYen(row.taxInsuranceTotal)}</Td>
              <Td>{compactYen(row.capitalGainsTaxTotal)}</Td>
              <Td>{compactYen(row.declaredCapitalGainsIncomeTotal)}</Td>
              <Td>{compactYen(row.specialExpenseTotal)}</Td>
              <Td className={row.netCashFlow < 0 ? "text-destructive" : "text-primary"}>{compactYen(row.netCashFlow)}</Td>
              {showPlannedDrawdown && <Td>{compactYen(row.plannedDrawdownTotal)}</Td>}
              <Td>{compactYen(row.withdrawalAmount)}</Td>
              <Td>{compactYen(row.sourceAssetIncomeWithdrawalAmount)}</Td>
              <Td className="min-w-[300px] whitespace-pre-line break-words text-sm leading-5 text-muted-foreground">
                {formatWithdrawalSources(row.sourceAssetIncomeBreakdown) || "-"}
              </Td>
              <Td>{compactYen(row.deficitAssetWithdrawalAmount)}</Td>
              <Td className="min-w-[300px] whitespace-pre-line break-words text-sm leading-5 text-muted-foreground">
                {formatWithdrawalSources(row.deficitWithdrawalBreakdown) || "-"}
              </Td>
              <Td>{compactYen(row.assetContributionTotal)}</Td>
              <Td>{compactYen(row.nisaContributionTotal)}</Td>
              <Td className={row.nisaContributionSkippedTotal > 0 ? "text-destructive" : ""}>{compactYen(row.nisaContributionSkippedTotal)}</Td>
              <Td className={row.nisaAnnualLimitExceededTotal > 0 ? "text-destructive" : ""}>{compactYen(row.nisaAnnualLimitExceededTotal)}</Td>
              <Td>{compactYen(row.nisaCumulativeInvestment)}</Td>
              <Td>{compactLimitYen(row.nisaRemainingLifetimeLimit)}</Td>
              <Td className={row.assetContributionFundingGap > 0 ? "text-destructive" : ""}>{compactYen(row.assetContributionFundingGap)}</Td>
              <Td>{compactYen(row.retainedSourceAssetIncomeTotal)}</Td>
              <Td>{compactYen(row.assetTransferTotal)}</Td>
              <Td className="min-w-[320px] whitespace-pre-line break-words text-sm leading-5 text-muted-foreground">
                {formatDetailsForPeriod(row.assetTransferDetails, period)}
              </Td>
              <Td>{compactYen(row.optionProfitSweepTotal)}</Td>
              <Td className="min-w-[320px] whitespace-pre-line break-words text-sm leading-5 text-muted-foreground">
                {formatDetailsForPeriod(row.optionProfitSweepDetails, period)}
              </Td>
              <Td>{compactYen(row.optionAccountReleaseTotal)}</Td>
              <Td className="min-w-[320px] whitespace-pre-line break-words text-sm leading-5 text-muted-foreground">
                {formatDetailsForPeriod(row.optionAccountReleaseDetails, period)}
              </Td>
              <Td className={row.optionIncomeSuspendedTotal > 0 ? "text-destructive" : ""}>{compactYen(row.optionIncomeSuspendedTotal)}</Td>
              <Td>{compactYen(row.idecoWithholdingTaxTotal)}</Td>
              <Td>{compactYen(row.idecoFeeTotal)}</Td>
              <Td>{compactYen(row.growthAmount)}</Td>
              <Td>{compactYen(row.cashReserveTopUpAmount)}</Td>
              <Td>{compactYen(row.endingAssets)}</Td>
            </Tr>
          ))}
      </tbody>
    </Table>
  );
}

function EventEditor({
  title,
  onDelete,
  children,
  actions,
  className,
  inputCardId,
}: {
  title: string;
  onDelete: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  inputCardId?: InputCardId;
}) {
  return (
    <div data-input-card-id={inputCardId} className={`rounded-lg border bg-white p-4 ${className ?? ""}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            削除
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

function RateField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Field label={`${label}（%）`}>
      <Input type="number" step="0.1" value={Math.round(value * 1000) / 10} onChange={(event) => onChange(numberOrZero(event.target.value) / 100)} />
    </Field>
  );
}

function getExpenseAdjustmentWarnings(adjustments: AgeExpenseAdjustment[]) {
  const warnings: { severity: "warning" | "info"; message: string }[] = [];
  for (let i = 0; i < adjustments.length; i += 1) {
    for (let j = i + 1; j < adjustments.length; j += 1) {
      const first = adjustments[i];
      const second = adjustments[j];
      const firstEnd = first.endAge ?? 130;
      const secondEnd = second.endAge ?? 130;
      const ageOverlaps = first.startAge <= secondEnd && second.startAge <= firstEnd;
      const firstTargets = getAgeExpenseAdjustmentTargets(first);
      const secondTargets = getAgeExpenseAdjustmentTargets(second);
      const targetOverlaps =
        firstTargets.includes("all") ||
        secondTargets.includes("all") ||
        firstTargets.some((target) => target !== "all" && secondTargets.includes(target));
      if (!ageOverlaps || !targetOverlaps) continue;

      const from = Math.max(first.startAge, second.startAge);
      const to = Math.min(firstEnd, secondEnd);
      const message = `${first.name || `${first.startAge}歳`} と ${second.name || `${second.startAge}歳`} が ${from}〜${to}歳で重複しています。`;
      const sameTarget =
        firstTargets.includes("all") && secondTargets.includes("all")
          ? true
          : firstTargets.some((target) => target !== "all" && secondTargets.includes(target));
      warnings.push({
        severity: sameTarget ? "warning" : "info",
        message:
          sameTarget
            ? message
            : `${message} 上から順に適用されるため、生活費全体の変更後に個別費目を上書き・調整する用途なら問題ありません。`,
      });
    }
  }
  return warnings;
}

function getAgeExpenseAdjustmentTargets(adjustment: AgeExpenseAdjustment) {
  const expenseKeys = Object.keys(expenseLabels) as ExpenseKey[];
  const targets = adjustment.targets?.length ? adjustment.targets : [adjustment.target ?? "all"];
  const validTargets = targets.filter((target) => target === "all" || expenseKeys.includes(target));
  if (validTargets.includes("all")) return ["all"] as ExpenseAdjustmentTarget[];
  return validTargets.length ? validTargets : (["all"] as ExpenseAdjustmentTarget[]);
}

function seniorAgeOrDefault(value: string | number, fallback = 60) {
  const age = Math.round(numberOrZero(value));
  if (!Number.isFinite(age)) return fallback;
  return Math.min(130, Math.max(60, age));
}

export default App;
