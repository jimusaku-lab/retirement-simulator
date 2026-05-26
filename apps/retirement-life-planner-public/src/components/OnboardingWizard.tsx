import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormGrid } from "@/components/Field";
import { simulateScenario } from "@/lib/simulation";
import { compactYen } from "@/lib/utils";
import type {
  AgeExpenseAdjustment,
  GrowthSettings,
  HouseholdMember,
  IncomeEvent,
  MonthlyExpenseProfile,
  ScenarioData,
  SpecialExpenseEvent,
  TimeBucketItem,
} from "@/types";

type OnboardingStep = "family" | "assets" | "income" | "expenses" | "assumptions" | "wishes" | "result";
type InflationPreset = "low" | "standard" | "high" | "custom";
type ReturnPreset = "low" | "standard" | "high" | "custom";
type AgeExpensePreset = "none" | "standard" | "custom";
type TaxModeDraft = "auto" | "autoWithAdjustment" | "manual";

export type OnboardingDraft = {
  selfAge: number;
  hasSpouse: boolean;
  spouseAge: number;
  retirementStatus: "planned" | "retired";
  startYearMonth: string;
  simulationEndAge: number;
  targetBalanceAge: number;
  targetBalanceAmount: number;
  cashAndDeposits: number;
  nisa: number;
  ideco: number;
  taxableAccount: number;
  otherInvestments: number;
  otherAssets: number;
  debt: number;
  selfPensionAnnual: number;
  spousePensionAnnual: number;
  pensionStartAge: number;
  workIncomeMonthly: number;
  workIncomeEndAge: number;
  idecoPlan: "later" | "pension" | "lumpSum";
  retirementAllowance: boolean;
  monthlyLivingCost: number;
  housingMonthly: number;
  medicalMonthly: number;
  plannedLargeExpense: number;
  ageExpensePreset: AgeExpensePreset;
  inflationPreset: InflationPreset;
  customInflationRate: number;
  returnPreset: ReturnPreset;
  taxMode: TaxModeDraft;
  detailedTaxSetup: boolean;
  wishesText: string;
  annualEnjoymentBudget: number;
};

const steps: { key: OnboardingStep; label: string }[] = [
  { key: "family", label: "家族" },
  { key: "assets", label: "資産" },
  { key: "income", label: "収入" },
  { key: "expenses", label: "支出" },
  { key: "assumptions", label: "前提" },
  { key: "wishes", label: "やりたいこと" },
  { key: "result", label: "結果" },
];
const DEFAULT_ONBOARDING_MONTHLY_LIVING_COST = 320_000;

const inflationPresetLabels: Record<InflationPreset, string> = {
  low: "低め（年1.5%）",
  standard: "標準（年2.0%）",
  high: "高め（年2.5%）",
  custom: "個別入力",
};

const returnPresetLabels: Record<ReturnPreset, string> = {
  low: "低め（預金0.1〜0.2% / NISA3.0% / 課税2.0% / iDeCo2.5%）",
  standard: "標準（預金0.1〜0.2% / NISA5.0% / 課税3.0% / iDeCo3.5%）",
  high: "高め（預金0.2〜0.4% / NISA6.5% / 課税4.5% / iDeCo5.0%）",
  custom: "後で個別入力",
};

const expenseKeys: (keyof MonthlyExpenseProfile)[] = [
  "food",
  "dailyGoods",
  "hobbyEntertainment",
  "social",
  "transportation",
  "clothingBeauty",
  "healthMedical",
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
];

export function createOnboardingDraft(scenario: ScenarioData): OnboardingDraft {
  const self = scenario.householdMembers.find((member) => member.relationship === "self") ?? scenario.householdMembers[0];
  const spouse = scenario.householdMembers.find((member) => member.relationship === "spouse");
  const birthYear = Number(self?.birthDate?.slice(0, 4)) || new Date().getFullYear() - 60;
  const spouseBirthYear = Number(spouse?.birthDate?.slice(0, 4)) || birthYear + 1;
  const currentYear = new Date().getFullYear();
  const pensionEvent = scenario.incomeEvents.find((event) => event.type === "pension" && event.memberId === self?.id);
  const spousePensionEvent = spouse ? scenario.incomeEvents.find((event) => event.type === "pension" && event.memberId === spouse.id) : undefined;
  const workEvent = scenario.incomeEvents.find((event) => event.type === "salary");
  const totalLiving = expenseKeys.reduce((sum, key) => sum + (scenario.monthlyExpenses[key] ?? 0), 0);
  const livingWithoutTax = Math.max(0, totalLiving - (scenario.monthlyExpenses.taxSocialInsurance ?? 0));
  const inflationRate = scenario.inflationSettings.livingCostAnnualInflationRate ?? 0.02;

  return {
    selfAge: Math.max(20, currentYear - birthYear),
    hasSpouse: Boolean(spouse ?? scenario.userProfile.hasSpouse),
    spouseAge: Math.max(20, currentYear - spouseBirthYear),
    retirementStatus: "planned",
    startYearMonth: nextMonthYearMonth(),
    simulationEndAge: scenario.userProfile.simulationEndAge ?? 95,
    targetBalanceAge: scenario.userProfile.targetBalanceAge,
    targetBalanceAmount: scenario.userProfile.targetBalanceAmount ?? 5_000_000,
    cashAndDeposits: scenario.initialAssets.cash + scenario.initialAssets.bankDeposit + scenario.initialAssets.timeDeposit,
    nisa: scenario.initialAssets.nisa,
    ideco: scenario.initialAssets.ideco,
    taxableAccount: scenario.initialAssets.specificAccount,
    otherInvestments: scenario.initialAssets.ordinaryAccountForOptions,
    otherAssets: scenario.initialAssets.excludedAssets,
    debt: scenario.initialAssets.debt,
    selfPensionAnnual: Math.round((pensionEvent?.monthlyAmount ?? 150_000) * 12),
    spousePensionAnnual: Math.round((spousePensionEvent?.monthlyAmount ?? 100_000) * 12),
    pensionStartAge: 65,
    workIncomeMonthly: workEvent?.monthlyAmount ?? 0,
    workIncomeEndAge: 65,
    idecoPlan: scenario.initialAssets.ideco > 0 ? "later" : "later",
    retirementAllowance: false,
    monthlyLivingCost: livingWithoutTax > 0 ? Math.min(livingWithoutTax, DEFAULT_ONBOARDING_MONTHLY_LIVING_COST) : DEFAULT_ONBOARDING_MONTHLY_LIVING_COST,
    housingMonthly: scenario.monthlyExpenses.housing ?? 0,
    medicalMonthly: scenario.monthlyExpenses.healthMedical ?? 0,
    plannedLargeExpense: 0,
    ageExpensePreset: scenario.ageExpenseAdjustments.length > 0 ? "standard" : "none",
    inflationPreset: inflationRate <= 0.015 ? "low" : inflationRate >= 0.025 ? "high" : "standard",
    customInflationRate: inflationRate,
    returnPreset: "standard",
    taxMode: scenario.householdProfile.taxCalculationMode,
    detailedTaxSetup: false,
    wishesText: "",
    annualEnjoymentBudget: 300_000,
  };
}

export function applyOnboardingDraftToScenario(scenario: ScenarioData, draft: OnboardingDraft) {
  const selfId = "member-self";
  const spouseId = "member-spouse";
  const selfBirthDate = birthDateFromAge(draft.selfAge);
  const spouseBirthDate = birthDateFromAge(draft.spouseAge);
  const selfMember: HouseholdMember = {
    id: selfId,
    name: "本人",
    relationship: "self",
    birthDate: selfBirthDate,
    isResident: true,
    isNationalHealthInsuranceMember: true,
    isLateElderlyMedicalMember: false,
    isLongTermCareInsured: draft.selfAge >= 65,
    isDependent: false,
  };
  const spouseMember: HouseholdMember = {
    id: spouseId,
    name: "配偶者",
    relationship: "spouse",
    birthDate: spouseBirthDate,
    isResident: true,
    isNationalHealthInsuranceMember: true,
    isLateElderlyMedicalMember: false,
    isLongTermCareInsured: draft.spouseAge >= 65,
    isDependent: false,
  };

  scenario.name = "標準ケース";
  scenario.description = "初回設定ウィザードで作成した標準ケース";
  scenario.userProfile.birthDate = selfBirthDate;
  scenario.userProfile.simulationStartYearMonth = draft.startYearMonth;
  scenario.userProfile.simulationEndMode = "age";
  scenario.userProfile.simulationEndAge = draft.simulationEndAge;
  scenario.userProfile.targetBalanceAge = draft.targetBalanceAge;
  scenario.userProfile.targetBalanceAmount = draft.targetBalanceAmount;
  scenario.userProfile.hasSpouse = draft.hasSpouse;
  scenario.userProfile.flexibleFreeCashStartAge = draft.selfAge;
  scenario.userProfile.flexibleFreeCashEndAge = Math.max(draft.selfAge, 75);
  scenario.householdProfile.headMemberId = selfId;
  scenario.householdProfile.taxCalculationMode = draft.taxMode;
  scenario.householdProfile.notes = draft.detailedTaxSetup
    ? "初回設定で、税金・社会保険を後から詳しく補正する前提にしました。"
    : "初回設定で、税金・社会保険を標準前提で自動概算する前提にしました。";
  scenario.householdMembers = draft.hasSpouse ? [selfMember, spouseMember] : [selfMember];

  scenario.initialAssets = {
    cash: 0,
    bankDeposit: draft.cashAndDeposits,
    timeDeposit: 0,
    nisa: draft.nisa,
    specificAccount: draft.taxableAccount + draft.otherInvestments,
    ordinaryAccountForOptions: 0,
    ideco: draft.ideco,
    excludedAssets: draft.otherAssets,
    debt: draft.debt,
  };
  scenario.initialAssetCostBasis = {
    nisa: Math.round(draft.nisa * 0.9),
    specificAccount: Math.round((draft.taxableAccount + draft.otherInvestments) * 0.9),
    ordinaryAccountForOptions: 0,
    ideco: Math.round(draft.ideco * 0.9),
  };

  scenario.monthlyExpenses = createMonthlyExpenses(draft);
  scenario.ageExpenseAdjustments = createAgeExpenseAdjustments(draft);
  scenario.incomeEvents = createIncomeEvents(draft, selfId, draft.hasSpouse ? spouseId : undefined);
  scenario.specialExpenses = createSpecialExpenses(draft);
  scenario.timeBucketItems = createTimeBucketItems(draft);
  scenario.assetGrowthSettings = createAssetGrowthSettings(draft);
  scenario.inflationSettings = {
    ...scenario.inflationSettings,
    enabled: true,
    livingCostAnnualInflationRate: inflationRateForDraft(draft),
    medicalAnnualInflationRate: Math.max(inflationRateForDraft(draft), 0.02),
    pensionAnnualAdjustmentRate: 0.015,
  };
  scenario.optionAccountRules.enabled = false;
  scenario.optionSubAccounts = [];
  scenario.withdrawalOrder = ["bankDeposit", "timeDeposit", "specificAccount", "nisa", "ideco"];
}

export function OnboardingWizard({
  scenario,
  onApply,
  onClose,
}: {
  scenario: ScenarioData;
  onApply: (draft: OnboardingDraft) => void;
  onClose: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState(() => createOnboardingDraft(scenario));
  const step = steps[stepIndex];
  const canGoNext = stepIndex < steps.length - 1;
  const validationMessage = getValidationMessage(draft);
  const resultSummary = useMemo(() => {
    const previewScenario = structuredClone(scenario);
    applyOnboardingDraftToScenario(previewScenario, draft);
    const previewResult = simulateScenario(previewScenario);
    const depletion = previewResult.depletionYearMonth
      ? `${previewResult.depletionAgeYears}歳${previewResult.depletionAgeMonths}か月`
      : "期間内維持";
    return [
      { label: "現在の資産寿命", value: depletion },
      { label: `${draft.targetBalanceAge}歳時点残高`, value: compactYen(previewResult.targetAgeBalance ?? 0) },
      { label: "平均月次取り崩し", value: compactYen(previewResult.averageMonthlyWithdrawal) },
    ];
  }, [draft, scenario]);

  const update = <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const applyAndClose = () => {
    const message = getValidationMessage(draft);
    if (message) return;
    onApply(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/50 px-4 py-6">
      <Card className="mx-auto max-w-5xl bg-white shadow-xl">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>初回設定</CardTitle>
              <CardDescription>標準入力だけで、まず将来の資産と生活費の試算を作ります。詳細条件は後から開けます。</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              閉じる
            </Button>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-7">
            {steps.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={`rounded-md border px-2 py-2 text-xs font-medium ${
                  index === stepIndex ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700"
                }`}
                onClick={() => setStepIndex(index)}
              >
                {index + 1}. {item.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 py-6">
          {step.key === "family" && (
            <WizardPanel title="家族" description="年齢、配偶者、シミュレーション期間を設定します。">
              <FormGrid>
                <NumberField label="本人の年齢" value={draft.selfAge} min={20} onChange={(value) => update("selfAge", value)} />
                <Field label="配偶者">
                  <Select value={draft.hasSpouse ? "yes" : "no"} onChange={(event) => update("hasSpouse", event.target.value === "yes")}>
                    <option value="no">なし</option>
                    <option value="yes">あり</option>
                  </Select>
                </Field>
                {draft.hasSpouse && <NumberField label="配偶者の年齢" value={draft.spouseAge} min={20} onChange={(value) => update("spouseAge", value)} />}
                <Field label="退職状況">
                  <Select value={draft.retirementStatus} onChange={(event) => update("retirementStatus", event.target.value as OnboardingDraft["retirementStatus"])}>
                    <option value="planned">退職予定</option>
                    <option value="retired">退職済み</option>
                  </Select>
                </Field>
                <Field label="試算を始める年月">
                  <Input type="month" value={draft.startYearMonth} onChange={(event) => update("startYearMonth", event.target.value)} />
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    この月から将来の収入・支出・資産残高を計算します。迷ったら来月か、計画を始めたい月にしてください。
                  </p>
                </Field>
                <NumberField label="何歳まで見るか" value={draft.simulationEndAge} min={draft.selfAge} onChange={(value) => update("simulationEndAge", value)} />
                <NumberField label="残高確認年齢" value={draft.targetBalanceAge} min={draft.selfAge} onChange={(value) => update("targetBalanceAge", value)} />
                <NumberField label="その時点で残したい金額" value={draft.targetBalanceAmount} min={0} step={100_000} onChange={(value) => update("targetBalanceAmount", value)} />
              </FormGrid>
            </WizardPanel>
          )}

          {step.key === "assets" && (
            <WizardPanel title="資産" description="現在の資産を大まかに入れます。証券口座の取得原価などは後から詳細設定できます。">
              <FormGrid>
                <NumberField label="現金・預金" value={draft.cashAndDeposits} min={0} step={100_000} onChange={(value) => update("cashAndDeposits", value)} />
                <NumberField label="NISA" value={draft.nisa} min={0} step={100_000} onChange={(value) => update("nisa", value)} />
                <NumberField label="iDeCo" value={draft.ideco} min={0} step={100_000} onChange={(value) => update("ideco", value)} />
                <NumberField
                  label="証券の課税口座"
                  value={draft.taxableAccount}
                  min={0}
                  step={100_000}
                  onChange={(value) => update("taxableAccount", value)}
                  helpText="証券会社の特定口座・一般口座など、利益に税金がかかる投資口座です。"
                />
                <NumberField
                  label="その他運用資産"
                  value={draft.otherInvestments}
                  min={0}
                  step={100_000}
                  onChange={(value) => update("otherInvestments", value)}
                  helpText="NISA、iDeCo、証券の課税口座以外で、値動きや利回りを見たい運用資産です。"
                />
                <NumberField
                  label="その他資産"
                  value={draft.otherAssets}
                  min={0}
                  step={100_000}
                  onChange={(value) => update("otherAssets", value)}
                  helpText="自宅以外の不動産、車、売却予定のない資産など、生活費の取り崩しに使わない資産です。"
                />
                <NumberField label="負債" value={draft.debt} min={0} step={100_000} onChange={(value) => update("debt", value)} />
              </FormGrid>
            </WizardPanel>
          )}

          {step.key === "income" && (
            <WizardPanel title="収入" description="年金、働く収入、退職金などの主な収入を設定します。細かい条件は後から補正できます。">
              <FormGrid>
                <NumberField label="本人の年金見込み額（年額）" value={draft.selfPensionAnnual} min={0} step={10_000} onChange={(value) => update("selfPensionAnnual", value)} />
                {draft.hasSpouse && (
                  <NumberField label="配偶者の年金見込み額（年額）" value={draft.spousePensionAnnual} min={0} step={10_000} onChange={(value) => update("spousePensionAnnual", value)} />
                )}
                <NumberField label="年金受給開始年齢" value={draft.pensionStartAge} min={60} max={75} onChange={(value) => update("pensionStartAge", value)} />
                <NumberField label="給与・パート等（月額）" value={draft.workIncomeMonthly} min={0} step={10_000} onChange={(value) => update("workIncomeMonthly", value)} />
                <NumberField label="給与・パート等の終了年齢" value={draft.workIncomeEndAge} min={draft.selfAge} onChange={(value) => update("workIncomeEndAge", value)} />
                <Field label="iDeCo受取予定">
                  <Select value={draft.idecoPlan} onChange={(event) => update("idecoPlan", event.target.value as OnboardingDraft["idecoPlan"])}>
                    <option value="later">後で設定</option>
                    <option value="pension">年金形式</option>
                    <option value="lumpSum">一時金</option>
                  </Select>
                </Field>
                <Field label="退職金・一時金">
                  <Select value={draft.retirementAllowance ? "yes" : "no"} onChange={(event) => update("retirementAllowance", event.target.value === "yes")}>
                    <option value="no">今は入れない</option>
                    <option value="yes">後で詳しく設定する</option>
                  </Select>
                </Field>
              </FormGrid>
            </WizardPanel>
          )}

          {step.key === "expenses" && (
            <WizardPanel title="支出" description="毎月の生活費と、年齢による変化を設定します。">
              <div className="rounded-md border bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
                ここでは毎月の生活費の合計を先に入れます。「うち住宅費」「うち医療・介護費」を入れると、その分を除いた残りが「その他」として自動で入ります。
                後で生活費入力タブの費目を細かく直すと、その費目別合計が試算に使われます。
              </div>
              <FormGrid>
                <NumberField label="毎月の生活費" value={draft.monthlyLivingCost} min={0} step={10_000} onChange={(value) => update("monthlyLivingCost", value)} />
                <NumberField label="うち住宅費" value={draft.housingMonthly} min={0} step={10_000} onChange={(value) => update("housingMonthly", value)} />
                <NumberField label="うち医療・介護費" value={draft.medicalMonthly} min={0} step={10_000} onChange={(value) => update("medicalMonthly", value)} />
                <NumberField label="大きな予定支出" value={draft.plannedLargeExpense} min={0} step={100_000} onChange={(value) => update("plannedLargeExpense", value)} />
                <Field label="年齢別生活費変更">
                  <Select value={draft.ageExpensePreset} onChange={(event) => update("ageExpensePreset", event.target.value as AgeExpensePreset)}>
                    <option value="none">変えない</option>
                    <option value="standard">70歳以降少し下げ、75歳以降医療費を増やす</option>
                    <option value="custom">後で詳しく設定する</option>
                  </Select>
                </Field>
              </FormGrid>
            </WizardPanel>
          )}

          {step.key === "assumptions" && (
            <WizardPanel title="前提調整" description="結果に効く標準前提を選びます。細かい率は後から変更できます。">
              <FormGrid>
                <Field label="インフレ率">
                  <Select value={draft.inflationPreset} onChange={(event) => update("inflationPreset", event.target.value as InflationPreset)}>
                    <option value="low">{inflationPresetLabels.low}</option>
                    <option value="standard">{inflationPresetLabels.standard}</option>
                    <option value="high">{inflationPresetLabels.high}</option>
                    <option value="custom">{inflationPresetLabels.custom}</option>
                  </Select>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">生活費の物価上昇に使います。医療・介護費は、この値以上のやや高めとして扱います。</p>
                </Field>
                {draft.inflationPreset === "custom" && (
                  <NumberField label="インフレ率（年率）" value={draft.customInflationRate * 100} min={0} step={0.1} onChange={(value) => update("customInflationRate", value / 100)} />
                )}
                <Field label="資産別利回り">
                  <Select value={draft.returnPreset} onChange={(event) => update("returnPreset", event.target.value as ReturnPreset)}>
                    <option value="low">{returnPresetLabels.low}</option>
                    <option value="standard">{returnPresetLabels.standard}</option>
                    <option value="high">{returnPresetLabels.high}</option>
                    <option value="custom">{returnPresetLabels.custom}</option>
                  </Select>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">預金、NISA、課税口座、iDeCoに入る年率です。詳細入力で資産ごとに変更できます。</p>
                </Field>
                <Field label="税金・社会保険">
                  <Select value={draft.taxMode} onChange={(event) => update("taxMode", event.target.value as TaxModeDraft)}>
                    <option value="auto">自動概算</option>
                    <option value="autoWithAdjustment">自動概算 + 後で補正</option>
                    <option value="manual">詳しく設定する</option>
                  </Select>
                </Field>
                <Field label="詳細な税社保設定">
                  <Select value={draft.detailedTaxSetup ? "yes" : "no"} onChange={(event) => update("detailedTaxSetup", event.target.value === "yes")}>
                    <option value="no">今は標準前提で進む</option>
                    <option value="yes">後で詳しく設定する</option>
                  </Select>
                </Field>
              </FormGrid>
            </WizardPanel>
          )}

          {step.key === "wishes" && (
            <WizardPanel title="やりたいこと" description="健康寿命期に使いたいお金を仮置きします。金額未定でも後から変更できます。">
              <FormGrid>
                <NumberField label="楽しみ支出の年額目安" value={draft.annualEnjoymentBudget} min={0} step={10_000} onChange={(value) => update("annualEnjoymentBudget", value)} />
              </FormGrid>
              <Field label="やりたいことメモ">
                <Textarea value={draft.wishesText} onChange={(event) => update("wishesText", event.target.value)} placeholder="旅行、趣味、家族イベント、学び、住まいなど" />
              </Field>
            </WizardPanel>
          )}

          {step.key === "result" && (
            <WizardPanel title="結果" description="保存してダッシュボードで試算結果を確認します。">
              {validationMessage && <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{validationMessage}</div>}
              <div className="grid gap-3 md:grid-cols-3">
                {resultSummary.map((item) => (
                  <div key={item.label} className="rounded-md border bg-slate-50 px-4 py-3">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-md border bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
                初回設定を保存すると、現在のシナリオへ反映してダッシュボードに戻ります。税金・社会保険、取得原価、扶養などの詳細は後から入力できます。
              </div>
            </WizardPanel>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setStepIndex(Math.max(0, stepIndex - 1))} disabled={stepIndex === 0}>
              戻る
            </Button>
            <div className="flex flex-wrap gap-2">
              {canGoNext ? (
                <Button onClick={() => setStepIndex(Math.min(steps.length - 1, stepIndex + 1))}>次へ</Button>
              ) : (
                <Button onClick={applyAndClose} disabled={Boolean(validationMessage)}>
                  保存して結果を見る
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WizardPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  helpText,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  helpText?: string;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
      {helpText && <p className="mt-1 text-xs leading-5 text-muted-foreground">{helpText}</p>}
    </Field>
  );
}

function getValidationMessage(draft: OnboardingDraft) {
  if (draft.selfAge <= 0) return "本人の年齢を入力してください。";
  if (draft.hasSpouse && draft.spouseAge <= 0) return "配偶者の年齢を入力してください。";
  if (!draft.startYearMonth) return "開始年月を入力してください。";
  if (draft.simulationEndAge < draft.selfAge) return "何歳まで見るかは、現在年齢以上にしてください。";
  if (draft.targetBalanceAge < draft.selfAge) return "残高確認年齢は、現在年齢以上にしてください。";
  if (draft.monthlyLivingCost <= 0) return "毎月の生活費を入力してください。";
  return "";
}

function birthDateFromAge(age: number) {
  return `${new Date().getFullYear() - Math.max(0, Math.trunc(age))}-04-01`;
}

function nextMonthYearMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function yearMonthAtAge(currentAge: number, targetAge: number) {
  return `${new Date().getFullYear() + Math.max(0, Math.trunc(targetAge) - Math.trunc(currentAge))}-04`;
}

function createMonthlyExpenses(draft: OnboardingDraft): MonthlyExpenseProfile {
  const total = Math.max(0, draft.monthlyLivingCost);
  const housing = Math.min(total, Math.max(0, draft.housingMonthly));
  const healthMedical = Math.min(total - housing, Math.max(0, draft.medicalMonthly));
  const other = Math.max(0, total - housing - healthMedical);
  return {
    food: 0,
    dailyGoods: 0,
    hobbyEntertainment: 0,
    social: 0,
    transportation: 0,
    clothingBeauty: 0,
    healthMedical,
    car: 0,
    educationCulture: 0,
    specialExpense: 0,
    cashCard: 0,
    utilities: 0,
    communication: 0,
    housing,
    taxSocialInsurance: 0,
    insurance: 0,
    other,
  };
}

function createAgeExpenseAdjustments(draft: OnboardingDraft): AgeExpenseAdjustment[] {
  if (draft.ageExpensePreset === "none") return [];
  return [
    {
      id: "onboarding-living-70",
      name: "70歳以降の生活費調整",
      startAge: 70,
      target: "all",
      mode: "multiplier",
      value: 0.95,
    },
    {
      id: "onboarding-medical-75",
      name: "75歳以降の医療・介護費調整",
      startAge: 75,
      target: "healthMedical",
      mode: "setAmount",
      value: Math.max(draft.medicalMonthly + 20_000, draft.medicalMonthly),
    },
  ];
}

function createIncomeEvents(draft: OnboardingDraft, selfId: string, spouseId?: string): IncomeEvent[] {
  const events: IncomeEvent[] = [
    {
      id: "onboarding-self-pension",
      memberId: selfId,
      name: "本人の年金",
      type: "pension",
      startYearMonth: yearMonthAtAge(draft.selfAge, draft.pensionStartAge),
      monthlyAmount: Math.round(draft.selfPensionAnnual / 12),
      taxTreatment: "taxable",
    },
  ];
  if (spouseId && draft.spousePensionAnnual > 0) {
    events.push({
      id: "onboarding-spouse-pension",
      memberId: spouseId,
      name: "配偶者の年金",
      type: "pension",
      startYearMonth: yearMonthAtAge(draft.spouseAge, draft.pensionStartAge),
      monthlyAmount: Math.round(draft.spousePensionAnnual / 12),
      taxTreatment: "taxable",
    });
  }
  if (draft.workIncomeMonthly > 0) {
    events.push({
      id: "onboarding-work-income",
      memberId: selfId,
      name: "給与・パート等",
      type: "salary",
      startYearMonth: draft.startYearMonth,
      endYearMonth: yearMonthAtAge(draft.selfAge, draft.workIncomeEndAge),
      monthlyAmount: draft.workIncomeMonthly,
      taxTreatment: "taxable",
    });
  }
  return events;
}

function createSpecialExpenses(draft: OnboardingDraft): SpecialExpenseEvent[] {
  const events: SpecialExpenseEvent[] = [];
  if (draft.plannedLargeExpense > 0) {
    events.push({
      id: "onboarding-large-expense",
      name: "大きな予定支出",
      yearMonth: yearMonthAtAge(draft.selfAge, Math.min(draft.simulationEndAge, draft.selfAge + 5)),
      amount: draft.plannedLargeExpense,
      category: "lifeMaintenance",
    });
  }
  if (draft.annualEnjoymentBudget > 0) {
    events.push({
      id: "onboarding-enjoyment",
      name: "健康寿命期の楽しみ支出",
      yearMonth: yearMonthAtAge(draft.selfAge, Math.max(draft.selfAge, 60)),
      amount: draft.annualEnjoymentBudget,
      category: "enjoyment",
      schedule: "yearly",
      endYearMonth: yearMonthAtAge(draft.selfAge, Math.max(Math.max(draft.selfAge, 60), 72)),
    });
  }
  return events;
}

function createTimeBucketItems(draft: OnboardingDraft): TimeBucketItem[] {
  const lines = draft.wishesText
    .split(/\r?\n|、|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
  return lines.map((title, index) => ({
    id: `onboarding-wish-${index + 1}`,
    title,
    bucketId: "todo",
  }));
}

function createAssetGrowthSettings(draft: OnboardingDraft): GrowthSettings {
  const rates =
    draft.returnPreset === "low"
      ? { bankDeposit: 0.001, timeDeposit: 0.002, nisa: 0.03, specificAccount: 0.02, ideco: 0.025 }
      : draft.returnPreset === "high"
        ? { bankDeposit: 0.002, timeDeposit: 0.004, nisa: 0.065, specificAccount: 0.045, ideco: 0.05 }
        : { bankDeposit: 0.001, timeDeposit: 0.002, nisa: 0.05, specificAccount: 0.03, ideco: 0.035 };
  return {
    enabled: true,
    rates: {
      cash: 0,
      bankDeposit: rates.bankDeposit,
      timeDeposit: rates.timeDeposit,
      nisa: rates.nisa,
      specificAccount: rates.specificAccount,
      ordinaryAccountForOptions: 0,
      ideco: rates.ideco,
    },
  };
}

function inflationRateForDraft(draft: OnboardingDraft) {
  if (draft.inflationPreset === "low") return 0.015;
  if (draft.inflationPreset === "high") return 0.025;
  if (draft.inflationPreset === "custom") return draft.customInflationRate;
  return 0.02;
}
