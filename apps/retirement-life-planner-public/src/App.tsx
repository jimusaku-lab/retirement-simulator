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
  ArrowUp,
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
import { calculateAutoTaxDetails, calculateAutoTaxRows, getEffectiveTaxRows, type AutoTaxYearDetail } from "@/lib/taxEngine";
import {
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
  getIdecoMonexEndYearMonth,
  getIdecoMonexEstimatedPerPayment,
  getIdecoMonexFirstPayoutYearMonth,
} from "@/lib/incomeEvents";
import { syncLinkedIncomeEndYearMonths } from "@/lib/householdEvents";
import { inferMonthlyOptionIncomeFromScenarioName } from "@/lib/optionIncomeHints";
import { inferOptionSubAccountIdFromName, resolveOptionSubAccountId } from "@/lib/optionSubAccounts";
import { buildScenarioDiffSummary, formatScenarioDiffHeadline, type ScenarioDiffSummary } from "@/lib/scenarioDiff";
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
import { compactYen, downloadText, numberOrZero, yen } from "@/lib/utils";
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
  RetirementPlanState,
  ScenarioData,
  SpecialExpenseEvent,
  TaxInsuranceByFiscalYear,
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

type TabKey = "dashboard" | "manual" | (typeof tabs)[number]["key"];
type TabGroup = (typeof tabs)[number]["group"];
type AppMode = "safety" | "assetUse";
type AssetUseTab = "timeBucket" | "quickTrial" | "review" | "incomePower";
type PrimaryNavKey = "dashboard" | "safety" | "assetUse" | "results" | "compare" | "data";
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
const ONBOARDING_COMPLETED_KEY = "retirement-life-planner-public-onboarding-completed-v1";
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
  oneTime: "単発入金",
};

const editableGrowthAssetKeys: GrowthAssetKey[] = [
  "timeDeposit",
  "nisa",
  "specificAccount",
  "ordinaryAccountForOptions",
  "ideco",
];

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
  };

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
            <h1 className="text-2xl font-semibold tracking-normal">退職後生活シミュレーション</h1>
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
            <Button variant="outline" onClick={() => setShowOnboarding(true)}>
              初回設定
            </Button>
            <Button variant="outline" onClick={() => setShowDataTrustModal(true)}>
              データの扱い
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
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 ${activeTab === tab.key ? tabGroupClassNames[tab.group].active : tabGroupClassNames[tab.group].inactive}`}
            >
              {tab.label}
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
            {activeTab === "dashboard" && (
              <Dashboard
                scenario={activeScenario}
                result={result}
                baselineScenario={baselineScenario}
                onOpenFlexibleFreeCashSettings={openFlexibleFreeCashSettings}
              />
            )}
            {activeTab === "profile" && (
              <ProfileSection
                scenario={activeScenario}
                scenarios={scenarios}
                updateScenario={updateScenario}
                updateScenarios={updateScenarios}
              />
            )}
            {activeTab === "assets" && (
              <AssetsSection
                scenario={activeScenario}
                scenarios={scenarios}
                updateScenario={updateScenario}
                updateScenarios={updateScenarios}
              />
            )}
            {activeTab === "expenses" && (
              <ExpensesSection
                scenario={activeScenario}
                scenarios={scenarios}
                updateScenario={updateScenario}
                updateScenarios={updateScenarios}
              />
            )}
            {activeTab === "income" && (
              <IncomeSection
                scenario={activeScenario}
                scenarios={scenarios}
                updateScenario={updateScenario}
                updateScenarios={updateScenarios}
              />
            )}
            {activeTab === "tax" && <TaxSection scenario={activeScenario} updateScenario={updateScenario} />}
            {activeTab === "special" && (
              <SpecialSection
                scenario={activeScenario}
                scenarios={scenarios}
                updateScenario={updateScenario}
                updateScenarios={updateScenarios}
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
            {activeTab === "results" && <ResultsSection result={result} />}
            {activeTab === "compare" && (
              <CompareSection
                items={allResults}
                scenarios={scenarios}
                baselineScenario={baselineScenario}
                baselineScenarioId={baselineScenario.id}
                setBaselineScenarioId={setBaselineScenario}
                periodSourceScenario={activeScenario}
                updateScenario={updateScenario}
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
      {showOnboarding && (
        <OnboardingWizard
          scenario={activeScenario}
          onApply={completeOnboarding}
          onClose={closeOnboarding}
        />
      )}
      {showDataTrustModal && <DataTrustModal onClose={closeDataTrustModal} />}
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
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData) => void;
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
}: {
  scenario: ScenarioData;
  result: ReturnType<typeof simulateScenario>;
  baselineScenario: ScenarioData;
  onOpenFlexibleFreeCashSettings: () => void;
}) {
  const flexibleFreeCashPeriod = getScenarioFlexibleFreeCashPeriod(scenario);
  const flexibleFreeCashSummary = calculateFlexibleFreeCashSummary(result, flexibleFreeCashPeriod);
  const assetUseWaterfallRows = calculateAssetUseWaterfallRows(result, flexibleFreeCashPeriod);
  const specialExpenseCategoryTotals = calculateSpecialExpenseCategoryTotals(scenario, result, flexibleFreeCashPeriod);
  const diffSummary = buildScenarioDiffSummary(baselineScenario, scenario);
  const flexibleFreeCashLabel = flexibleFreeCashPeriodLabel(flexibleFreeCashSummary.period);
  const assetLifeValue = result.depletionYearMonth ? `${result.depletionAgeYears}歳${result.depletionAgeMonths}か月` : "期間内維持";
  const assetLifeSub = `${scenario.userProfile.targetBalanceAge}歳時点 ${compactYen(result.targetAgeBalance ?? 0)}`;
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
          <CardTitle>まず見る結論</CardTitle>
          <CardDescription>
            資産寿命、税金・社会保険を払った後の余力、注意が必要な年を先に確認します。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-md border bg-emerald-50 px-4 py-4">
              <div className="text-sm font-medium text-emerald-900">資産寿命</div>
              <div className="mt-2 text-3xl font-semibold text-emerald-950">{assetLifeValue}</div>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                {scenario.userProfile.targetBalanceAge}歳残高は {compactYen(targetBalance)}。目標との差は {compactYen(targetBalanceGap)} です。
              </p>
            </div>
            <div className="rounded-md border bg-blue-50 px-4 py-4">
              <div className="text-sm font-medium text-blue-900">生活費・税社保後の月次余力</div>
              <div className={`mt-2 text-3xl font-semibold ${monthlyAfterLivingAndTax >= 0 ? "text-blue-950" : "text-red-700"}`}>
                {compactYen(monthlyAfterLivingAndTax)}
              </div>
              <p className="mt-2 text-sm leading-6 text-blue-900">
                {flexibleFreeCashLabel} の現金収入等から生活費と税社保を引いた目安です。楽しみ支出や追加投資は別に見ます。
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
            </div>
            <div className="rounded-md border bg-white px-4 py-3">
              <div className={`font-medium ${monthlyAfterAllSpending >= 0 ? "text-slate-900" : "text-red-700"}`}>
                楽しみ支出なども含めた月次収支: {compactYen(monthlyAfterAllSpending)}
              </div>
              <p className="mt-1 leading-6 text-muted-foreground">特別支出、iDeCo手数料、資産活用を含む期間平均です。</p>
            </div>
            <div className="rounded-md border bg-white px-4 py-3">
              <div className="font-medium text-slate-900">楽しみ支出: {compactYen(specialExpenseCategoryTotals.enjoyment)}</div>
              <p className="mt-1 leading-6 text-muted-foreground">{flexibleFreeCashLabel} に登録された旅行・趣味などの合計です。</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="現在資産" value={compactYen(getTotalAssets(scenario))} sub={`取り崩し対象 ${compactYen(getSimulationTargetAssets(scenario))}`} />
        <Metric title={`資産寿命 / ${scenario.userProfile.targetBalanceAge}歳残高`} value={assetLifeValue} sub={assetLifeSub} />
        <Metric
          title={`${flexibleFreeCashLabel} 資産活用額`}
          value={compactYen(flexibleFreeCashSummary.assetUtilizationAmount)}
          sub={flexibleFreeCashSummary.totalFreeCash < 0 ? "現金収入等で足りず資産で補った額" : `現金収支余力 ${compactYen(flexibleFreeCashSummary.totalFreeCash)}`}
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
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData) => void;
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
    <Card>
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
            <Input type="date" value={scenario.userProfile.birthDate} onChange={(event) => updateScenario((s) => void (s.userProfile.birthDate = event.target.value))} />
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
            <Input value={scenario.userProfile.municipality ?? ""} onChange={(event) => updateScenario((s) => void (s.userProfile.municipality = event.target.value))} />
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
};

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
            <Input
              value={scenario.householdProfile.notes ?? ""}
              onChange={(event) => updateScenario((s) => void (s.householdProfile.notes = event.target.value))}
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
                      onChange={(event) => updateScenario((s) => void (s.householdMembers[index].birthDate = event.target.value))}
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
  pensionPlanner: boolean;
  retirementIncomeEvents: boolean;
  pensionAdjustmentRate: boolean;
};

type SpecialSyncOptions = {
  specialExpenses: boolean;
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

function applyAssetSyncFromSource(target: ScenarioData, source: ScenarioData, options: AssetSyncOptions) {
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
    target.optionSubAccounts = structuredClone(source.optionSubAccounts);
    target.optionAccountRules = structuredClone(source.optionAccountRules);
    target.initialAssets.ordinaryAccountForOptions = source.initialAssets.ordinaryAccountForOptions;
    target.initialAssetCostBasis.ordinaryAccountForOptions = source.initialAssetCostBasis.ordinaryAccountForOptions;
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
    targetEvent.sourceAssetKey === sourceEvent.sourceAssetKey
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

function applyIncomeSyncFromSource(
  target: ScenarioData,
  source: ScenarioData,
  options: IncomeSyncOptions,
  selectedIncomeEventIds?: string[],
) {
  if (options.incomeEvents) {
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

export const __testHooks = {
  applyIncomeSyncFromSource,
  countAssetSyncTargets,
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
                <p className="mt-1 text-xs">対象シナリオはありません。</p>
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
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {allScenarios
                .filter((item) => item.id !== sourceScenarioId && !excludedScenarioIds.has(item.id))
                .map((item) => (
                  <label key={item.id} className="flex items-start gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedTargetIds.has(item.id)}
                      onChange={() => toggleSelectedTarget(item.id)}
                    />
                    <span>
                      <span className="block font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground">{item.compare ? "比較対象" : "比較対象外"}</span>
                    </span>
                  </label>
                ))}
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
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details className="rounded-lg border bg-white px-4 py-3" onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
        <span>
          <span className="block font-medium">{title}</span>
          <span className="text-sm text-muted-foreground">{description}</span>
        </span>
        <span className="rounded-md border bg-slate-50 px-3 py-1 text-sm text-muted-foreground">
          {isOpen ? "閉じる" : "開く"}
        </span>
      </summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}

function AssetsSection({
  scenario,
  scenarios,
  updateScenario,
  updateScenarios,
}: SectionProps & {
  scenarios: ScenarioData[];
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData) => void;
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
  const [assetSyncMessage, setAssetSyncMessage] = useState<string | null>(null);
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
    assetSyncOptions.marketAssets ? "証券・iDeCo評価額" : "",
    assetSyncOptions.costBasis ? "取得原価" : "",
    assetSyncOptions.optionSubAccounts ? "一般口座サブ口座" : "",
  ].filter(Boolean);
  const applyAssetSync = () => {
    if (assetSyncTargetCount === 0 || !hasAssetSyncSelection) return;
    const source = structuredClone(assetSyncSourceScenario);
    const confirmed = window.confirm(
      `「${source.name}」の ${selectedAssetSyncLabels.join("、")} を、コピー元自身を除く ${assetSyncTargetCount} 件のシナリオへ反映します。` +
        (!assetSyncSourceIsCurrentScenario && excludeCurrentScenarioFromAssetSync
          ? `現在開いている「${scenario.name}」は反映先から外します。`
          : "") +
        `\n\n反映先:\n${formatScenarioNamesForConfirm(assetSyncTargetNames)}\n\n実行しますか？`,
    );
    if (!confirmed) return;
    updateScenarios((target) => {
      if (!isAssetSyncTarget(target, source.id, assetSyncTargetMode, assetSyncExcludedScenarioIds, assetSyncSelectedTargetIdSet)) return target;
      applyAssetSyncFromSource(target, source, assetSyncOptions);
      return target;
    });
    setAssetSyncMessage(
      `${assetSyncTargetCount} 件のシナリオへ反映しました: ${formatScenarioNamesForMessage(assetSyncTargetNames)}。実行前の状態は履歴に保存されています。`,
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
    <Card>
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
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>証券・iDeCoの評価額と評価損益</CardTitle>
            <CardDescription>
              マネーフォワードの `評価額` と `評価損益` を入れてください。取得原価は自動計算し、特定口座と一般口座の取り崩し課税に使います。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>一般口座（申告対象運用）のサブ口座</CardTitle>
                <CardDescription>
                  申告対象の運用口座などを別口座として管理します。最低維持額、利益移動、取り崩し優先順位を口座ごとに設定できます。
                </CardDescription>
                <p className="mt-2 text-xs text-muted-foreground">
                  開始年月がシミュレーション開始より後の口座は、その月に現金・普通預金から初期金額を自動移動します。
                </p>
              </div>
              <Button onClick={addOptionSubAccount}>
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Metric title="初期総資産" value={compactYen(getTotalAssets(scenario))} sub="対象外資産を含む" />
          <Metric title="シミュレーション対象資産" value={compactYen(getSimulationTargetAssets(scenario))} sub="取り崩し計算の起点" />
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>資産別利回り</CardTitle>
            <CardDescription>現金と普通預金は流動資金として扱い、利回り計算の対象外です。年率を入力すると月次複利で反映します。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-3">
              <Field label="資産成長率反映">
                <Select
                  value={scenario.assetGrowthSettings.enabled ? "on" : "off"}
                  onChange={(event) => updateScenario((s) => void (s.assetGrowthSettings.enabled = event.target.value === "on"))}
                >
                  <option value="on">ON</option>
                  <option value="off">OFF</option>
                </Select>
              </Field>
            </div>
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
                <CardTitle>毎月の追加投資</CardTitle>
                <CardDescription>指定口座へ毎月積み増す金額を設定します。開始月から終了月まで有効です。</CardDescription>
              </div>
              <Button onClick={addContribution}>
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
            { key: "marketAssets", label: "証券・iDeCo評価額", description: "NISA、特定口座、iDeCoの評価額" },
            { key: "costBasis", label: "取得原価", description: "譲渡益税の前提。評価額更新時は通常一緒に反映" },
            { key: "optionSubAccounts", label: "一般口座サブ口座", description: "口座構成、評価額、取得原価、運用ルールも反映" },
          ]}
          selectedOptions={assetSyncOptions}
          toggleOption={updateAssetSyncOption}
          warningText="反映は明示実行時だけです。シナリオ別に意図して変えた資産前提がある場合は、反映先を確認してください。"
          onApply={applyAssetSync}
          message={assetSyncMessage}
        />
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
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData) => void;
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

  return (
    <Card>
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
        <FormGrid>
          {(Object.keys(expenseLabels) as ExpenseKey[]).map((key) => (
            <Field key={key} label={expenseLabels[key]}>
              <Input type="number" value={scenario.monthlyExpenses[key]} onChange={(event) => updateScenario((s) => void (s.monthlyExpenses[key] = numberOrZero(event.target.value)))} />
            </Field>
          ))}
        </FormGrid>
        <div className="grid gap-4 md:grid-cols-4">
          <Metric
            title="月平均生活費"
            value={compactYen(getBaseMonthlyExpense(scenario.monthlyExpenses, excludeTaxExpense))}
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
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-3">
            <h3 className="font-medium">インフレ対象費目</h3>
            <p className="text-sm text-muted-foreground">
              健康・医療は医療費上昇率、その他は生活費インフレ率を使う想定です。保険など上昇させない費目はチェックを外してください。
            </p>
          </div>
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
        </div>
        <div className="rounded-lg border bg-white">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h3 className="font-medium">年齢別の生活費変更</h3>
              <p className="text-sm text-muted-foreground">
                現在生活費基準、開始前年基準、前年同月比、月額指定を選べます。期間固定は開始前年基準、毎年変化は前年同月比を使います。
              </p>
            </div>
            <Button onClick={addAdjustment}>
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
          <div className="space-y-4 p-4">
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
        </div>
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
}: SectionProps & {
  scenarios: ScenarioData[];
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData) => void;
}) {
  const [incomeSyncTargetMode, setIncomeSyncTargetMode] = useState<AssetSyncTargetMode>("compare");
  const [incomeSyncSelectedTargetIds, setIncomeSyncSelectedTargetIds] = useState<string[]>([]);
  const [incomeSyncSourceScenarioId, setIncomeSyncSourceScenarioId] = useState(scenario.id);
  const [excludeCurrentScenarioFromIncomeSync, setExcludeCurrentScenarioFromIncomeSync] = useState(true);
  const [incomeSyncOptions, setIncomeSyncOptions] = useState<IncomeSyncOptions>({
    incomeEvents: true,
    pensionPlanner: true,
    retirementIncomeEvents: true,
    pensionAdjustmentRate: true,
  });
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
  const [incomeSyncMessage, setIncomeSyncMessage] = useState<string | null>(null);
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
  const sourceIsCurrentScenario = incomeSyncSourceScenario.id === scenario.id;
  const hasIncomeSyncSelection =
    (incomeSyncOptions.incomeEvents && selectedIncomeEventCount > 0) ||
    incomeSyncOptions.pensionPlanner ||
    incomeSyncOptions.retirementIncomeEvents ||
    incomeSyncOptions.pensionAdjustmentRate;
  const selectedIncomeSyncLabels = [
    incomeSyncOptions.incomeEvents ? `収入イベント ${selectedIncomeEventCount}件` : "",
    incomeSyncOptions.pensionPlanner ? "年金プランナー設定" : "",
    incomeSyncOptions.retirementIncomeEvents ? "退職所得イベント" : "",
    incomeSyncOptions.pensionAdjustmentRate ? "年金改定率" : "",
  ].filter(Boolean);
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
  const applyIncomeSync = () => {
    if (incomeSyncTargetCount === 0 || !hasIncomeSyncSelection) return;
    const source = structuredClone(incomeSyncSourceScenario);
    const confirmed = window.confirm(
      `「${source.name}」の ${selectedIncomeSyncLabels.join("、")} を、コピー元自身を除く ${incomeSyncTargetCount} 件のシナリオへ反映します。` +
        (!sourceIsCurrentScenario && excludeCurrentScenarioFromIncomeSync
          ? `現在開いている「${scenario.name}」は反映先から外します。`
          : "") +
        (incomeSyncOptions.incomeEvents
          ? "チェックした収入イベントだけをコピーし、未選択または反映先にだけある収入イベントは残します。"
          : "") +
        `\n\n反映先:\n${formatScenarioNamesForConfirm(incomeSyncTargetNames)}\n\n実行しますか？`,
    );
    if (!confirmed) return;
    updateScenarios((target) => {
      if (!isAssetSyncTarget(target, source.id, incomeSyncTargetMode, incomeSyncExcludedScenarioIds, incomeSyncSelectedTargetIdSet)) return target;
      applyIncomeSyncFromSource(target, source, incomeSyncOptions, selectedIncomeEventIds);
      return target;
    });
    setIncomeSyncMessage(
      `${incomeSyncTargetCount} 件のシナリオへ収入前提を反映しました: ${formatScenarioNamesForMessage(incomeSyncTargetNames)}。実行前の状態は履歴に保存されています。`,
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
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>収入イベント入力</CardTitle>
            <CardDescription>
              開始月から終了月まで有効。公的年金は年金受給プランナーを正として使い、iDeCoなど資産からの年金型受取は原資資産を選んで登録します。
            </CardDescription>
          </div>
          <Button onClick={add}>
            <Plus className="h-4 w-4" />
            追加
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <PensionPlannerSection scenario={scenario} updateScenario={updateScenario} />
        {scenario.incomeEvents.map((event, index) => {
          const replacedByPensionPlanner = isPensionPlannerReplacingEvent(scenario, event);
          const isExternalPublicPension = event.type === "pension" && !event.sourceAssetKey;
          return (
            <EventEditor
              key={event.id}
              title={event.name || "収入"}
              onDelete={() => updateScenario((s) => void s.incomeEvents.splice(index, 1))}
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
              <Field label="種別">
                <Select
                  value={event.type}
                  onChange={(e) =>
                    updateScenario((s) => {
                      const nextType = e.target.value as IncomeEvent["type"];
                      s.incomeEvents[index].type = nextType;
                      if (nextType === "oneTime") {
                        s.incomeEvents[index].linkedHouseholdLivingArrangementEventId = undefined;
                      }
                      if (nextType === "oneTime" && s.incomeEvents[index].sourceAssetKey === "ideco") {
                        s.incomeEvents[index].endYearMonth = s.incomeEvents[index].startYearMonth;
                        s.incomeEvents[index].idecoLumpSumContributionYears ??= 20;
                        s.incomeEvents[index].idecoLumpSumTaxMode ??= "retirementIncomeDeclaration";
                      }
                    })
                  }
                >
                  <option value="unemployment">失業手当</option>
                  <option value="pension">年金</option>
                  <option value="salary">就労収入</option>
                  <option value="investmentIncome">投資由来の定期入金</option>
                  <option value="dividend">配当・利息</option>
                  <option value="other">その他</option>
                  <option value="oneTime">単発入金</option>
                </Select>
              </Field>
              <Field label="開始年月">
                <Input type="month" value={event.startYearMonth} onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].startYearMonth = e.target.value))} />
              </Field>
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
                      if (nextValue === "ideco" && s.incomeEvents[index].type === "pension") {
                        s.incomeEvents[index].sourceAssetPayoutMode = "cash";
                        s.incomeEvents[index].idecoPensionPayoutMode ??= "monexSchedule";
                        s.incomeEvents[index].idecoPensionYears ??= 10;
                        s.incomeEvents[index].idecoPensionPaymentsPerYear ??= 6;
                      }
                      if (nextValue === "ideco" && s.incomeEvents[index].type === "oneTime") {
                        s.incomeEvents[index].sourceAssetPayoutMode = "cash";
                        s.incomeEvents[index].endYearMonth = s.incomeEvents[index].startYearMonth;
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
                  <Field label="一時金受取額">
                    <Input type="number" value={event.monthlyAmount} onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].monthlyAmount = numberOrZero(e.target.value)))} />
                  </Field>
                  <Field label="加入年数">
                    <Input
                      type="number"
                      value={event.idecoLumpSumContributionYears ?? 20}
                      onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].idecoLumpSumContributionYears = numberOrZero(e.target.value)))}
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
                      <option value="retirementIncomeDeclaration">提出あり（退職所得控除で概算）</option>
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
                      onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].endYearMonth = e.target.value || undefined))}
                    />
                  </Field>
                  <Field label="月額">
                    <Input type="number" value={event.monthlyAmount} onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].monthlyAmount = numberOrZero(e.target.value)))} />
                  </Field>
                </>
              )}
            </FormGrid>
            {event.linkedHouseholdLivingArrangementEventId && (
              <p className="mt-3 text-sm text-muted-foreground">
                終了年月は同居状態変更イベントから自動設定しています。別居開始月の前月までを収入期間として扱います。
              </p>
            )}
            {event.type === "pension" && event.sourceAssetKey === "ideco" && (event.idecoPensionPayoutMode ?? "monexSchedule") === "monexSchedule" && (
              <p className="mt-3 text-sm text-muted-foreground">
                開始年月が偶数月でない場合、初回支給月は翌偶数月に自動補正します。受取期間と年間支給回数から、初回支給月と終了年月を自動生成します。
                金額は現在の iDeCo 評価額を総支給回数で割った概算です。
              </p>
            )}
            </EventEditor>
          );
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
            { key: "pensionPlanner", label: "年金プランナー", description: "受給開始年齢、標準年額、加給年金設定" },
            { key: "retirementIncomeEvents", label: "退職所得イベント", description: "退職金、iDeCo一時金など" },
            { key: "pensionAdjustmentRate", label: "年金改定率", description: "収入タブの年金改定率のみ" },
          ]}
          selectedOptions={incomeSyncOptions}
          toggleOption={updateIncomeSyncOption}
          warningText={
            incomeSyncOptions.incomeEvents
              ? `下のメニューで選んだ収入イベント ${selectedIncomeEventCount} 件だけをコピーします。未選択または反映先にだけある収入イベントは残します。`
              : "収入イベントは反映しません。年金プランナーや退職所得など、チェックした前提だけを反映します。"
          }
          onApply={applyIncomeSync}
          message={incomeSyncMessage}
          applyDisabled={!hasIncomeSyncSelection}
        />
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
                    <span className="block font-medium">{event.name || "名称未設定"}</span>
                    <span className="text-xs text-muted-foreground">
                      {incomeTypeLabels[event.type]} / 月額 {compactYen(event.monthlyAmount)}
                      {event.sourceAssetKey ? ` / ${growthAssetLabels[event.sourceAssetKey]}から受取` : " / 外部収入"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
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

function TaxSection({ scenario, updateScenario }: SectionProps) {
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

  return (
    <Card>
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
            <p className="mt-1 text-muted-foreground">モード説明、自動計算結果、反映後の税・社会保険を確認します。</p>
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
              {mode === "manual" ? "入力年度の金額をそのまま使用" : mode === "auto" ? "自動計算結果を使用" : "自動計算 + 補正額を使用"}
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
            反復計算が収束しない年度が出た場合は、このタブの詳細根拠で警告として扱います。現時点の自動計算結果には未収束警告はありません。
          </p>
        </div>

        <details className="rounded-lg border bg-white px-4 py-3">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
            <span>
              <span className="block font-medium">詳細入力・専門補正</span>
              <span className="text-sm text-muted-foreground">退職所得、所得控除、補正額は必要な時だけ開きます。</span>
            </span>
            <span className="rounded-md border bg-slate-50 px-3 py-1 text-sm text-muted-foreground">開く</span>
          </summary>
        <div className="mt-4 space-y-5">
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
        </details>

        {(isAuto || mode === "autoWithAdjustment") && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">自動計算結果</h3>
              <p className="text-sm text-muted-foreground">
                現時点では、所得税・住民税・国民年金・大田区の国民健康保険・東京都の後期高齢者医療の概算に加え、課税口座の取り崩し時の譲渡益課税を反映します。収入集計は暦年ベースです。通知書との差がある場合は補正してください。
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
      <div className="overflow-x-auto rounded-lg border">
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
    </div>
  );
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
          iDeCo源泉徴収と売却時譲渡益税は、結果タブの支払タイミングで別に確認します。
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
        {lines.map((line, index) => (
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
                      Math.round(nhi.insuredMemberCount * OTA_NHI_RATES_FOR_DISPLAY.medicalPerCapita);
                    const supportCalculated =
                      Math.round(nhi.totalBaseIncome * OTA_NHI_RATES_FOR_DISPLAY.supportIncomeRate) +
                      Math.round(nhi.insuredMemberCount * OTA_NHI_RATES_FOR_DISPLAY.supportPerCapita);
                    const childSupportCalculated =
                      Math.round(nhi.totalBaseIncome * OTA_NHI_RATES_FOR_DISPLAY.childSupportIncomeRate) +
                      Math.round(nhi.childMemberCount * OTA_NHI_RATES_FOR_DISPLAY.childSupportPerCapita);
                    const careCalculated =
                      Math.round(nhi.careBaseIncome * OTA_NHI_RATES_FOR_DISPLAY.careIncomeRate) +
                      Math.round(nhi.careMemberCount * OTA_NHI_RATES_FOR_DISPLAY.carePerCapita);
                    return (
                      <>
                        <FormulaBlock
                          title="国保 医療分"
                          lines={[
                            "医療分 = 所得割 + 均等割。ただし上限額を超えた分は切り捨てます",
                            `所得割 = 加入者基礎所得合計 ${yen(nhi.totalBaseIncome)} × ${(OTA_NHI_RATES_FOR_DISPLAY.medicalIncomeRate * 100).toFixed(2)}%`,
                            `均等割 = ${personMonthLabel(nhi.insuredMemberCount)} × ${yen(OTA_NHI_RATES_FOR_DISPLAY.medicalPerCapita)}`,
                            ...capSelectionLines("医療分", medicalCalculated, OTA_NHI_RATES_FOR_DISPLAY.medicalCap, nhi.medical),
                          ]}
                        />
                        <FormulaBlock
                          title="国保 支援分"
                          lines={[
                            "支援分 = 所得割 + 均等割。ただし上限額を超えた分は切り捨てます",
                            `所得割 = 加入者基礎所得合計 ${yen(nhi.totalBaseIncome)} × ${(OTA_NHI_RATES_FOR_DISPLAY.supportIncomeRate * 100).toFixed(2)}%`,
                            `均等割 = ${personMonthLabel(nhi.insuredMemberCount)} × ${yen(OTA_NHI_RATES_FOR_DISPLAY.supportPerCapita)}`,
                            ...capSelectionLines("支援分", supportCalculated, OTA_NHI_RATES_FOR_DISPLAY.supportCap, nhi.support),
                          ]}
                        />
                        <FormulaBlock
                          title="国保 こども分"
                          lines={[
                            "こども分 = 所得割 + 均等割。ただし上限額を超えた分は切り捨てます",
                            `所得割 = 加入者基礎所得合計 ${yen(nhi.totalBaseIncome)} × ${(OTA_NHI_RATES_FOR_DISPLAY.childSupportIncomeRate * 100).toFixed(2)}%`,
                            `均等割 = ${personMonthLabel(nhi.childMemberCount)} × ${yen(OTA_NHI_RATES_FOR_DISPLAY.childSupportPerCapita)}`,
                            ...capSelectionLines("こども分", childSupportCalculated, OTA_NHI_RATES_FOR_DISPLAY.childSupportCap, nhi.childSupport),
                          ]}
                        />
                        <FormulaBlock
                          title="国保 介護分"
                          lines={[
                            "介護分 = 所得割 + 均等割。ただし上限額を超えた分は切り捨てます",
                            `所得割 = 40-64歳対象基礎所得 ${yen(nhi.careBaseIncome)} × ${(OTA_NHI_RATES_FOR_DISPLAY.careIncomeRate * 100).toFixed(2)}%`,
                            `均等割 = ${personMonthLabel(nhi.careMemberCount)} × ${yen(OTA_NHI_RATES_FOR_DISPLAY.carePerCapita)}`,
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

function SpecialSection({
  scenario,
  scenarios,
  updateScenario,
  updateScenarios,
  onOpenTimeBucket,
}: SectionProps & {
  scenarios: ScenarioData[];
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData) => void;
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
    <Card>
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

function ResultsSection({ result }: { result: ReturnType<typeof simulateScenario> }) {
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

  return (
    <div className="space-y-6">
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
      </ScenarioSyncDetails>

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

      <Card>
        <CardHeader>
          <CardTitle>税金・社会保険のキャッシュ支払タイミング</CardTitle>
          <CardDescription>
            実際に現金が出ていく年で、税金と社会保険等を分けて確認します。所得税精算・住民税・国保・介護は原則として前年所得に対する当年支払いです。
            一般口座（オプション用）の申告対象損益は、翌年の所得税精算・住民税・国保などの全所得計算に入ります。申告分離の税相当額は目安として別表示します。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-scroll max-h-[520px] overflow-auto">
          <Table className="min-w-[1500px]">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <Tr>
                <Th className={resultStickyHeaderClass}>支払年</Th>
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
                  row.taxCashBreakdown.otherPublicCost;
                const cashPaymentTotal = taxTotal + socialInsuranceTotal;
                return (
                  <Tr key={`tax-cash-${row.year}`}>
                    <Td className={resultStickyCellClass}>{yearEndAgeLabel(row.year, row.ageYears)}</Td>
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
}: {
  items: { scenario: ScenarioData; result: ReturnType<typeof simulateScenario> }[];
  scenarios: ScenarioData[];
  baselineScenario: ScenarioData;
  baselineScenarioId: string;
  setBaselineScenarioId: (id: string) => void;
  periodSourceScenario: ScenarioData;
  updateScenario: SectionProps["updateScenario"];
}) {
  const flexibleFreeCashPeriod = getScenarioFlexibleFreeCashPeriod(periodSourceScenario);
  const flexibleFreeCashLabel = flexibleFreeCashPeriodLabel(flexibleFreeCashPeriod);
  const compareRows = items.map(({ scenario, result }) => {
    const flexibleFreeCash = calculateFlexibleFreeCashSummary(result, flexibleFreeCashPeriod);
    const specialExpenseCategoryTotals = calculateSpecialExpenseCategoryTotals(scenario, result, flexibleFreeCashPeriod);
    const targetBalanceAnalysis = calculateTargetBalanceAnalysis(scenario, result);
    const scenarioDiff = buildScenarioDiffSummary(baselineScenario, scenario);
    const yearCount = Math.max(1, result.annual.length);
    const deficitAssetSale = result.annual.reduce((sum, row) => sum + row.deficitAssetWithdrawalAmount, 0);
    const sourceAssetIncome = result.annual.reduce((sum, row) => sum + row.sourceAssetIncomeWithdrawalAmount, 0);
    const plannedDrawdown = result.annual.reduce((sum, row) => sum + row.plannedDrawdownTotal, 0);
    const optionToLiquid = result.annual.reduce((sum, row) => sum + row.optionProfitSweepTotal + row.optionAccountReleaseTotal, 0);
    const declaredOptionProfit = result.annual.reduce((sum, row) => sum + row.declaredCapitalGainsIncomeTotal, 0);
    const optionIncomeSuspended = result.annual.reduce((sum, row) => sum + row.optionIncomeSuspendedTotal, 0);
    const cashIncome = result.annual.reduce((sum, row) => sum + row.incomeTotal, 0);
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
      afterLivingCapacityDelta: row.afterLivingCapacity - baselineAfterLivingCapacity,
    };
  });
  const getOptionImpactSummary = (row: (typeof optionTaxSocialImpactRows)[number]) => {
    if (baselineCompareRow?.scenario.id === row.scenario.id) {
      return "比較基準です。";
    }
    if (row.declaredOptionProfit <= 0 && row.optionToLiquidDelta <= 0) {
      return "一般口座オプション利益はありません。";
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
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>複数シナリオ詳細比較表</CardTitle>
          <CardDescription>
            まず資産寿命、目標残高との差額、資産活用額、楽しみ支出、NISA実行額を横並びで見ます。現在の比較基準は「{baselineScenario.name}」です。
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
          <Table className="min-w-[1040px]">
            <thead>
              <Tr>
                <Th className="sticky-col left-0 z-30 bg-white">シナリオ</Th>
                <Th>枯渇時期</Th>
                <Th>枯渇年齢</Th>
                <Th>{periodSourceScenario.userProfile.targetBalanceAge}歳<br />残高</Th>
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
                }) => (
                <Tr key={scenario.id}>
                  <Td className="sticky-col left-0 z-20 bg-white font-medium">{scenario.name}</Td>
                  <Td>{result.depletionYearMonth ?? "期間内維持"}</Td>
                  <Td>{result.depletionAgeYears ? `${result.depletionAgeYears}歳${result.depletionAgeMonths}か月` : "-"}</Td>
                  <Td>{compactYen(result.targetAgeBalance ?? 0)}</Td>
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
                <div key={`diff-${row.scenario.id}`} className="rounded-md border bg-slate-50 px-4 py-3 text-sm leading-6">
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
        title="運用利益・税社保・NISAの詳細比較"
        description="基準シナリオとの差分原因を確認する時だけ開きます。"
      >
      <Card>
        <CardHeader>
          <CardTitle>申告対象の運用利益と税社保増分</CardTitle>
          <CardDescription>
            選択した基準シナリオ「{baselineScenario.name}」に対して、申告対象の運用損益が、税社保・NISA未実行・指定年齢残高にどう影響したかを確認します。
          </CardDescription>
        </CardHeader>
        <CardContent className="table-scroll overflow-auto">
          <Table className="min-w-[1600px]">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <Tr>
                <Th className="sticky-col left-0 z-30 bg-white">シナリオ</Th>
                <Th>申告対象<br />運用損益</Th>
                <Th>参考税額<br />20.315%</Th>
                <Th>運用口座から<br />現金・普通預金へ</Th>
                <Th>税社保増分<br />基準比</Th>
                <Th>税社保<br />負担率</Th>
                <Th>生活後余力</Th>
                <Th>生活後余力差<br />基準比</Th>
                <Th>NISA実行額</Th>
                <Th>NISA実行額差<br />基準比</Th>
                <Th>NISA未実行差<br />基準比</Th>
                <Th>NISA残り生涯枠</Th>
                <Th>NISA残り生涯枠差<br />基準比</Th>
                <Th>指定年齢残高差<br />基準比</Th>
                <Th>証拠金不足停止</Th>
                <Th className="min-w-[420px]">読み方</Th>
              </Tr>
            </thead>
            <tbody>
              {optionTaxSocialImpactRows.map((row) => (
                <Tr key={`option-impact-${row.scenario.id}`}>
                  <Td className="sticky-col left-0 z-20 bg-white font-medium">{row.scenario.name}</Td>
                  <Td>{compactYen(row.declaredOptionProfit)}</Td>
                  <Td>{compactYen(row.referenceTax)}</Td>
                  <Td>{compactYen(row.optionToLiquid)}</Td>
                  <Td className={row.taxSocialDelta > 0 ? "text-red-600" : row.taxSocialDelta < 0 ? "text-teal-700" : ""}>
                    {compactYen(row.taxSocialDelta)}
                  </Td>
                  <Td className={row.taxSocialBurdenRate !== null && row.taxSocialBurdenRate > 0.35 ? "text-red-600" : ""}>
                    {row.taxSocialBurdenRate === null ? "-" : compactPercent(row.taxSocialBurdenRate)}
                  </Td>
                  <Td>{compactYen(row.afterLivingCapacity)}</Td>
                  <Td className={row.afterLivingCapacityDelta < 0 ? "text-red-600" : row.afterLivingCapacityDelta > 0 ? "text-teal-700" : ""}>
                    {compactYen(row.afterLivingCapacityDelta)}
                  </Td>
                  <Td>{compactYen(row.nisaExecuted)}</Td>
                  <Td className={row.nisaExecutedDelta < 0 ? "text-red-600" : row.nisaExecutedDelta > 0 ? "text-teal-700" : ""}>
                    {compactYen(row.nisaExecutedDelta)}
                  </Td>
                  <Td className={row.nisaSkippedDelta > 0 ? "text-red-600" : row.nisaSkippedDelta < 0 ? "text-teal-700" : ""}>
                    {compactYen(row.nisaSkippedDelta)}
                  </Td>
                  <Td>{compactLimitYen(row.finalNisaRemainingLifetimeLimit)}</Td>
                  <Td className={row.nisaRemainingLifetimeLimitDelta < 0 ? "text-red-600" : row.nisaRemainingLifetimeLimitDelta > 0 ? "text-teal-700" : ""}>
                    {compactLimitYen(row.nisaRemainingLifetimeLimitDelta)}
                  </Td>
                  <Td className={row.targetBalanceDelta < 0 ? "text-red-600" : row.targetBalanceDelta > 0 ? "text-teal-700" : ""}>
                    {compactYen(row.targetBalanceDelta)}
                  </Td>
                  <Td className={row.optionIncomeSuspended > 0 ? "text-red-600" : ""}>{compactYen(row.optionIncomeSuspended)}</Td>
                  <Td className="min-w-[420px] text-sm text-muted-foreground">{getOptionImpactSummary(row)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            ここは「運用利益だけの税額」ではなく、シナリオ全体の差分です。申告対象利益は翌年の所得税精算・住民税・国保等に合算されるため、
            税社保増分として見ます。参考税額20.315%は申告対象損益だけに税率を掛けた目安で、実際の所得税・住民税・国保等の増分とは一致しない場合があります。
            NISA未実行差は基準シナリオに対する未実行額の差で、NISA実行額そのものの増減ではありません。資金不足と枠上限を切り分けるため、NISA実行額とNISA残り生涯枠を併せて確認します。
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
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            このアプリは
          </CardTitle>
          <CardDescription>退職後の生活資金を、税金・社会保険まで含めて見積もるためのシミュレーションアプリです。</CardDescription>
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
}: {
  title: string;
  onDelete: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border bg-white p-4 ${className ?? ""}`}>
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
