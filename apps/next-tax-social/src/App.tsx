import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
import { sampleState } from "@/data/sampleData";
import { calculateAutoTaxDetails, calculateAutoTaxRows, getEffectiveTaxRows, type AutoTaxYearDetail } from "@/lib/taxEngine";
import {
  getIdecoMonexEndYearMonth,
  getIdecoMonexEstimatedPerPayment,
  getIdecoMonexFirstPayoutYearMonth,
} from "@/lib/incomeEvents";
import { compactYen, downloadText, numberOrZero, yen } from "@/lib/utils";
import {
  getBaseMonthlyExpense,
  getSimulationTargetAssets,
  getTotalAssets,
  simulateScenario,
} from "@/lib/simulation";
import { usePlanStore } from "@/store/usePlanStore";
import type {
  AnnualResult,
  IncomeEvent,
  InitialAssets,
  MonthlyResult,
  MonthlyExpenseProfile,
  HouseholdMember,
  HouseholdProfile,
  RetirementPlanState,
  ScenarioData,
  SpecialExpenseEvent,
  TaxInsuranceByFiscalYear,
  GrowthAssetKey,
  PlanBackup,
  ExpenseAdjustmentTarget,
  AgeExpenseAdjustment,
  AssetTransferSourceKey,
  AssetTransferTargetKey,
  WithdrawalAssetKey,
  OptionSubAccount,
} from "@/types";

const tabs = [
  ["dashboard", "ダッシュボード"],
  ["profile", "基本情報"],
  ["assets", "初期資産"],
  ["expenses", "生活費"],
  ["income", "収入"],
  ["tax", "税・社会保険"],
  ["special", "特別支出"],
  ["scenarios", "シナリオ"],
  ["results", "結果"],
  ["compare", "比較"],
  ["manual", "マニュアル"],
  ["data", "データ"],
] as const;

type TabKey = (typeof tabs)[number][0];
type ExpenseKey = keyof MonthlyExpenseProfile;
type AssetKey = keyof InitialAssets;
type HouseholdRelationship = HouseholdMember["relationship"];

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

const assetLabels: Record<AssetKey, string> = {
  cash: "現金",
  bankDeposit: "普通預金",
  timeDeposit: "定期預金",
  nisa: "NISA非課税口座",
  specificAccount: "特定口座",
  ordinaryAccountForOptions: "普通口座（オプション用）",
  ideco: "iDeCo",
  excludedAssets: "取り崩し対象外資産",
  debt: "負債残高",
};

const gainTrackedAssets = [
  { key: "nisa", label: "NISA非課税口座" },
  { key: "specificAccount", label: "特定口座" },
  { key: "ordinaryAccountForOptions", label: "普通口座（オプション用）" },
  { key: "ideco", label: "iDeCo" },
] as const;

const growthAssetLabels: Record<GrowthAssetKey, string> = {
  cash: "現金",
  bankDeposit: "普通預金",
  timeDeposit: "定期預金",
  nisa: "NISA非課税口座",
  specificAccount: "特定口座",
  ordinaryAccountForOptions: "普通口座（オプション用）",
  ideco: "iDeCo",
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
  ordinaryAccountForOptions: "普通口座（オプション用）",
  ideco: "iDeCo",
};

const withdrawalOrderLabels: Record<WithdrawalAssetKey, string> = {
  bankDeposit: "普通預金",
  timeDeposit: "定期預金",
  specificAccount: "特定口座",
  ordinaryAccountForOptions: "普通口座（オプション用）",
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
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    scenarios,
    activeScenarioId,
    setActiveScenario,
    updateActiveScenario,
    duplicateScenario,
    deleteScenario,
    toggleScenarioCompare,
    replaceState,
    resetToSample,
    lastSavedAt,
    backups,
    createBackup,
    restoreBackup,
    deleteBackup,
  } = usePlanStore();

  const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0];
  const result = useMemo(() => simulateScenario(activeScenario), [activeScenario]);
  const allResults = useMemo(
    () => scenarios.filter((scenario) => scenario.compare).map((scenario) => ({ scenario, result: simulateScenario(scenario) })),
    [scenarios],
  );
  const isLikelySampleState =
    scenarios.length === sampleState.scenarios.length &&
    scenarios.every((scenario, index) => scenario.name === sampleState.scenarios[index]?.name);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("restore") !== "chrome5173") return;

    let cancelled = false;
    fetch("/recovered_retirement_5173_from_chrome.json")
      .then((response) => {
        if (!response.ok) throw new Error("復旧JSONを読み込めませんでした。");
        return response.json() as Promise<RetirementPlanState>;
      })
      .then((restoredState) => {
        if (cancelled) return;
        replaceState(restoredState);
        setRestoreMessage("Chrome 5173側に残っていた実データを復旧しました。計算ロジックは現在の修正版のままです。");
        window.history.replaceState({}, "", window.location.pathname);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRestoreMessage(error instanceof Error ? error.message : "復旧処理に失敗しました。");
      });

    return () => {
      cancelled = true;
    };
  }, [replaceState]);

  useEffect(() => {
    if (!restoreMessage) return undefined;
    const timer = window.setTimeout(() => setRestoreMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [restoreMessage]);

  const updateScenario = (updater: (scenario: ScenarioData) => void) => {
    updateActiveScenario((scenario) => {
      updater(scenario);
      return scenario;
    });
  };

  const exportJson = () => {
    const state: RetirementPlanState = { version: 1, activeScenarioId, scenarios, lastSavedAt, backups };
    downloadText("retirement-simulation.json", JSON.stringify(state, null, 2));
  };

  const createBackupAndExport = () => {
    const savedAt = new Date().toISOString();
    createBackup("JSON出力時バックアップ");
    const state: RetirementPlanState = { version: 1, activeScenarioId, scenarios, lastSavedAt: savedAt, backups };
    const timestamp = savedAt.replaceAll(":", "").slice(0, 15);
    downloadText(`retirement-simulation-backup-${timestamp}.json`, JSON.stringify(state, null, 2));
  };

  const exportCsv = () => {
    const rows = [
      [
        "年月",
        "年齢",
        "現金収入",
        "口座内積上",
        "原資移動",
        "普通口座利益移動",
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
        row.optionProfitSweepTotal,
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

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text) as RetirementPlanState;
    if (parsed.version !== 1 || !Array.isArray(parsed.scenarios) || parsed.scenarios.length === 0) {
      throw new Error("未対応のJSON形式です。");
    }
    replaceState(parsed);
    event.target.value = "";
  };

  const restoreBundledRecovery = async () => {
    if (!window.confirm("復旧JSONから実データを復元しますか？現在の状態は復元前履歴として保存されます。")) return;
    try {
      const response = await fetch("/recovered_retirement_5173_from_chrome.json");
      if (!response.ok) throw new Error("復旧JSONを読み込めませんでした。");
      const restoredState = (await response.json()) as RetirementPlanState;
      if (!Array.isArray(restoredState.scenarios) || restoredState.scenarios.length === 0) {
        throw new Error("復旧JSONの形式が正しくありません。");
      }
      replaceState(restoredState);
      setActiveTab("dashboard");
      setRestoreMessage("復旧JSONから実データを復元しました。計算ロジックは現在の修正版のままです。");
    } catch (error) {
      setRestoreMessage(error instanceof Error ? error.message : "復旧処理に失敗しました。");
    }
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
      {isLikelySampleState && !restoreMessage && (
        <div className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-950">
          <div className="container flex flex-wrap items-center justify-between gap-2">
            <span>現在はサンプルシナリオが表示されています。実データが消えたように見える場合は復旧できます。</span>
            <Button variant="outline" size="sm" onClick={restoreBundledRecovery}>
              <RefreshCcw className="h-4 w-4" />
              実データを復旧
            </Button>
          </div>
        </div>
      )}
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="container flex flex-col gap-4 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">本人専用MVP</p>
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
          </div>
        </div>
        <nav className="container flex gap-2 overflow-x-auto pb-3">
          {tabs.map(([key, label]) => (
            <Button
              key={key}
              variant={activeTab === key ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(key)}
              className="shrink-0"
            >
              {label}
            </Button>
          ))}
        </nav>
      </header>

      <main className="container space-y-6 py-6">
        {activeTab === "dashboard" && <Dashboard scenario={activeScenario} result={result} />}
        {activeTab === "profile" && <ProfileSection scenario={activeScenario} updateScenario={updateScenario} />}
        {activeTab === "assets" && <AssetsSection scenario={activeScenario} updateScenario={updateScenario} />}
        {activeTab === "expenses" && <ExpensesSection scenario={activeScenario} updateScenario={updateScenario} />}
        {activeTab === "income" && <IncomeSection scenario={activeScenario} updateScenario={updateScenario} />}
        {activeTab === "tax" && <TaxSection scenario={activeScenario} updateScenario={updateScenario} />}
        {activeTab === "special" && <SpecialSection scenario={activeScenario} updateScenario={updateScenario} />}
        {activeTab === "scenarios" && (
          <ScenariosSection
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            setActiveScenario={setActiveScenario}
            duplicateScenario={duplicateScenario}
            deleteScenario={deleteScenario}
            toggleScenarioCompare={toggleScenarioCompare}
            updateScenario={updateScenario}
          />
        )}
        {activeTab === "results" && <ResultsSection result={result} />}
        {activeTab === "compare" && <CompareSection items={allResults} />}
        {activeTab === "manual" && <ManualSection />}
        {activeTab === "data" && (
          <DataSection
            exportJson={exportJson}
            createBackupAndExport={createBackupAndExport}
            exportCsv={exportCsv}
            importJson={() => fileInputRef.current?.click()}
            resetToSample={resetToSample}
            restoreBundledRecovery={restoreBundledRecovery}
            lastSavedAt={lastSavedAt}
            backups={backups}
            createBackup={createBackup}
            restoreBackup={restoreBackup}
            deleteBackup={deleteBackup}
          />
        )}
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={importJson} />
      </main>
    </div>
  );
}

function Dashboard({ scenario, result }: { scenario: ScenarioData; result: ReturnType<typeof simulateScenario> }) {
  const excludeTaxExpense = shouldIgnoreTaxExpenseField(scenario);
  const chartData = result.annual.map((row) => ({
    year: String(row.year),
    age: `${row.ageYears}歳`,
    axisLabel: `${row.year} / ${row.ageYears}歳`,
    assets: row.endingAssets,
    withdrawal: row.withdrawalAmount,
  }));
  const cashflowChartData = result.annual.map((row) => ({
    label: `${row.year} / ${row.ageYears}歳`,
    income: row.incomeTotal,
    living: -row.livingExpenseTotal,
    tax: -(row.taxInsuranceTotal + row.capitalGainsTaxTotal),
    withholding: -row.idecoWithholdingTaxTotal,
    special: -row.specialExpenseTotal,
    contribution: -row.assetContributionTotal,
    net: row.netCashFlow,
  }));
  const averageIncome =
    result.monthly.length ? result.monthly.reduce((sum, row) => sum + row.incomeTotal, 0) / result.monthly.length : 0;
  const averageContribution =
    result.monthly.length ? result.monthly.reduce((sum, row) => sum + row.assetContributionTotal, 0) / result.monthly.length : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="現在総資産" value={compactYen(getTotalAssets(scenario))} sub={`対象資産 ${compactYen(getSimulationTargetAssets(scenario))}`} />
        <Metric
          title="月平均生活費"
          value={compactYen(getBaseMonthlyExpense(scenario.monthlyExpenses, excludeTaxExpense))}
          sub={excludeTaxExpense ? "税・社会保険を除く入力値" : "入力値ベース"}
        />
        <Metric title="月平均取り崩し" value={compactYen(result.averageMonthlyWithdrawal)} sub={`累計 ${compactYen(result.totalWithdrawal)}`} />
        <Metric
          title="資産寿命"
          value={result.depletionYearMonth ? `${result.depletionAgeYears}歳${result.depletionAgeMonths}か月` : "期間内は維持"}
          sub={result.depletionYearMonth ?? "枯渇なし"}
        />
        <Metric title={`${scenario.userProfile.targetBalanceAge}歳時点残高`} value={compactYen(result.targetAgeBalance ?? 0)} sub="月末残高" />
        <Metric title="流動資金最低保持額" value={compactYen(scenario.userProfile.cashReserve)} sub="現金と普通預金で維持したい額" />
        <Metric title="月平均現金収入" value={compactYen(averageIncome)} sub="源泉・手数料控除後" />
        <Metric title="月平均追加投資" value={compactYen(averageContribution)} sub="資産別の積立" />
        <Metric title="最大赤字月" value={compactYen(Math.abs(result.maxDeficitMonth?.netCashFlow ?? 0))} sub={result.maxDeficitMonth?.yearMonth ?? "-"} />
        <Metric title="世帯人数" value={`${scenario.householdMembers.length}人`} sub={scenario.householdProfile.municipality} />
        <Metric title="選択シナリオ" value={scenario.name} sub={scenario.compare ? "比較対象" : "比較対象外"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>年別キャッシュフロー</CardTitle>
          <CardDescription>現金として入る収入と、生活費・税社保・追加投資で出ていく金額を確認します。</CardDescription>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashflowChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <Tooltip formatter={(value) => yen(Number(value))} />
              <Legend />
              <Bar dataKey="income" name="現金収入" fill="#0f766e" />
              <Bar dataKey="living" name="生活費" fill="#334155" />
              <Bar dataKey="tax" name="税社保支払" fill="#dc2626" />
              <Bar dataKey="withholding" name="iDeCo源泉" fill="#f97316" />
              <Bar dataKey="special" name="特別支出" fill="#ea580c" />
              <Bar dataKey="contribution" name="追加投資" fill="#7c3aed" />
              <Bar dataKey="net" name="純現金収支" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>資産残高と取り崩しの推移</CardTitle>
          <CardDescription>年末資産残高と、生活費や投資不足を埋めるために必要だった年間不足分を確認します。普通預金は流動資金として扱います。</CardDescription>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="axisLabel" interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <Tooltip formatter={(value) => yen(Number(value))} />
              <Area dataKey="assets" name="年末資産" stroke="#0f766e" fill="#99f6e4" />
              <Line dataKey="withdrawal" name="年間取り崩し" stroke="#e11d48" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
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

function ProfileSection({ scenario, updateScenario }: SectionProps) {
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
        <div className="mt-4">
          <Field label="メモ">
            <Textarea value={scenario.userProfile.note ?? ""} onChange={(event) => updateScenario((s) => void (s.userProfile.note = event.target.value))} />
          </Field>
        </div>
        <div className="mt-6">
          <HouseholdSection scenario={scenario} updateScenario={updateScenario} />
        </div>
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
    id: crypto.randomUUID(),
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

function HouseholdSection({ scenario, updateScenario }: SectionProps) {
  const selectedTaxMode = taxModeHelp[scenario.householdProfile.taxCalculationMode];
  const addMember = () =>
    updateScenario((s) =>
      s.householdMembers.push({
        id: crypto.randomUUID(),
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
              <p className="text-sm text-muted-foreground">本人は扶養外で固定です。配偶者や家族は「世帯主の扶養に入るか」だけ選んでください。</p>
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
                    s.incomeEvents = s.incomeEvents.map((event) =>
                      event.memberId === member.id ? { ...event, memberId: s.householdMembers[0]?.id ?? event.memberId } : event,
                    );
                  })
                }
              >
                {member.relationship !== "self" && (
                  <p className="mb-4 text-sm text-muted-foreground">
                    扶養に入るを選ぶと、{headMember?.name ?? "世帯主"} の扶養として扱います。
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
                    <Field label="世帯主の扶養">
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
      </div>
    </div>
  );
}

function AssetsSection({ scenario, updateScenario }: SectionProps) {
  const addOptionSubAccount = () =>
    updateScenario((s) => {
      s.optionSubAccounts.push({
        id: crypto.randomUUID(),
        name: `普通口座${s.optionSubAccounts.length + 1}`,
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
        id: crypto.randomUUID(),
        name: source.name ? `${source.name} コピー` : "普通口座 コピー",
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
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
        name: source.name ? `${source.name} コピー` : "追加投資 コピー",
      });
    });
  const addTransfer = () =>
    updateScenario((s) =>
      s.assetTransferEvents.push({
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
          {(["cash", "bankDeposit", "timeDeposit", "excludedAssets", "debt"] as AssetKey[]).map((key) => (
            <Field key={key} label={assetLabels[key]}>
              <Input type="number" value={scenario.initialAssets[key]} onChange={(event) => updateScenario((s) => void (s.initialAssets[key] = numberOrZero(event.target.value)))} />
            </Field>
          ))}
        </FormGrid>
        {scenario.optionSubAccounts.length === 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>証券・iDeCoの評価額と評価損益</CardTitle>
            <CardDescription>
              マネーフォワードの `評価額` と `評価損益` を入れてください。取得原価は自動計算し、特定口座と普通口座の取り崩し課税に使います。
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
        )}
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>普通口座（オプション用）のサブ口座</CardTitle>
                <CardDescription>
                  CFD、米国株オプションなどを別口座として管理します。最低維持額、利益移動、取り崩し優先順位を口座ごとに設定できます。
                </CardDescription>
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
            </div>
            {scenario.optionSubAccounts.map((account, index) => {
              const unrealizedGain = account.initialValue - account.initialCostBasis;
              return (
                <EventEditor
                  key={account.id}
                  title={account.name || "普通口座"}
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
              <CardTitle>普通口座（オプション用）の運用ルール</CardTitle>
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
                <CardDescription>開始前や途中で、現金・預金から運用口座へ一回だけ資金を移します。米国株オプション開始月の証拠金投入に使えます。</CardDescription>
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
      </CardContent>
    </Card>
  );
}

function ExpensesSection({ scenario, updateScenario }: SectionProps) {
  const excludeTaxExpense = shouldIgnoreTaxExpenseField(scenario);
  const warnings = getExpenseAdjustmentWarnings(scenario.ageExpenseAdjustments);
  const addAdjustment = () =>
    updateScenario((s) =>
      s.ageExpenseAdjustments.push({
        id: crypto.randomUUID(),
        name: "60歳から",
        startAge: 60,
        target: "all",
        mode: "multiplier",
        value: 1,
      }),
    );

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
        <div className="rounded-lg border bg-white">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h3 className="font-medium">年齢別の生活費変更</h3>
              <p className="text-sm text-muted-foreground">現在の生活費を起点に、満年齢で変更します。範囲が重なると上から順に重複適用されます。</p>
            </div>
            <Button onClick={addAdjustment}>
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
          <div className="space-y-4 p-4">
            {warnings.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <p className="font-medium">年齢範囲が重複しています</p>
                {warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
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
                    <Field label="対象">
                      <Select
                        value={adjustment.target}
                        onChange={(event) => updateScenario((s) => void (s.ageExpenseAdjustments[index].target = event.target.value as ExpenseAdjustmentTarget))}
                      >
                        <option value="all">生活費全体</option>
                        {(Object.keys(expenseLabels) as ExpenseKey[]).map((key) => (
                          <option key={key} value={key}>
                            {expenseLabels[key]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="変更方法">
                      <Select
                        value={adjustment.mode}
                        onChange={(event) => updateScenario((s) => void (s.ageExpenseAdjustments[index].mode = event.target.value as "setAmount" | "multiplier"))}
                      >
                        <option value="multiplier">現在生活費基準の倍率</option>
                        <option value="setAmount">月額に変更</option>
                      </Select>
                    </Field>
                    {adjustment.mode === "multiplier" ? (
                      <RateField
                        label="現在生活費基準の倍率"
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
                </EventEditor>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IncomeSection({ scenario, updateScenario }: SectionProps) {
  const add = () =>
      updateScenario((s) =>
        s.incomeEvents.push({
          id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
        name: source.name ? `${source.name} コピー` : "収入 コピー",
      });
    });
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>収入イベント入力</CardTitle>
            <CardDescription>開始月から終了月まで有効。終了月なしの場合は継続します。iDeCo受取は原資資産を iDeCo にしてください。</CardDescription>
          </div>
          <Button onClick={add}>
            <Plus className="h-4 w-4" />
            追加
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {scenario.incomeEvents.map((event, index) => (
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
                        <Input type="month" value={event.endYearMonth ?? ""} onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].endYearMonth = e.target.value || undefined))} />
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
                    <Input type="month" value={event.endYearMonth ?? ""} onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].endYearMonth = e.target.value || undefined))} />
                  </Field>
                  <Field label="月額">
                    <Input type="number" value={event.monthlyAmount} onChange={(e) => updateScenario((s) => void (s.incomeEvents[index].monthlyAmount = numberOrZero(e.target.value)))} />
                  </Field>
                </>
              )}
            </FormGrid>
            {event.type === "pension" && event.sourceAssetKey === "ideco" && (event.idecoPensionPayoutMode ?? "monexSchedule") === "monexSchedule" && (
              <p className="mt-3 text-sm text-muted-foreground">
                開始年月が偶数月でない場合、初回支給月は翌偶数月に自動補正します。受取期間と年間支給回数から、初回支給月と終了年月を自動生成します。
                金額は現在の iDeCo 評価額を総支給回数で割った概算です。
              </p>
            )}
          </EventEditor>
        ))}
        <div className="grid gap-4 md:grid-cols-2">
          <RateField label="年金改定率" value={scenario.inflationSettings.pensionAnnualAdjustmentRate} onChange={(value) => updateScenario((s) => void (s.inflationSettings.pensionAnnualAdjustmentRate = value))} />
        </div>
      </CardContent>
    </Card>
  );
}

function TaxSection({ scenario, updateScenario }: SectionProps) {
  const mode = scenario.householdProfile.taxCalculationMode;
  const simulationResult = useMemo(() => simulateScenario(scenario), [scenario]);
  const autoDetails = useMemo(() => calculateAutoTaxDetails(scenario), [scenario]);
  const autoRows = useMemo(() => calculateAutoTaxRows(scenario), [scenario]);
  const effectiveRows = useMemo(() => getEffectiveTaxRows(scenario), [scenario]);
  const capitalGainsTaxByFiscalYear = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of simulationResult.monthly) {
      const [year, month] = row.yearMonth.split("-").map(Number);
      const fiscalYear = month >= 4 ? year : year - 1;
      map.set(fiscalYear, (map.get(fiscalYear) ?? 0) + row.capitalGainsTaxTotal);
    }
    return map;
  }, [simulationResult]);
  const isManual = mode === "manual";
  const isAuto = mode === "auto";

  const add = () =>
    updateScenario((s) =>
      s.taxInsurance.push({
        id: crypto.randomUUID(),
        fiscalYear: new Date().getFullYear(),
        residentTaxAnnual: 0,
        incomeTaxAnnual: 0,
        nationalHealthInsuranceAnnual: 0,
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
          id: crypto.randomUUID(),
          fiscalYear: new Date().getFullYear(),
          residentTaxAnnual: 0,
          incomeTaxAnnual: 0,
          nationalHealthInsuranceAnnual: 0,
          nationalPensionMonthly: 0,
          nursingCareAnnual: 0,
          otherPublicCostAnnual: 0,
        });
        return;
      }
      s.taxInsurance.push({
        ...structuredClone(latest),
        id: crypto.randomUUID(),
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
            特定口座と普通口座（オプション用）の取り崩しでは、譲渡益部分に 20.315% の課税を掛けて差し引きます。NISA には掛けません。
          </p>
        </div>

        {(isAuto || mode === "autoWithAdjustment") && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">自動計算結果</h3>
              <p className="text-sm text-muted-foreground">
                現時点では、所得税・住民税・国民年金・大田区の国民健康保険概算に加え、特定口座と普通口座（オプション用）の取り崩し時の譲渡益課税を反映します。収入集計は暦年ベースです。通知書との差がある場合は補正してください。
              </p>
            </div>
            <TaxRowsSummary rows={autoRows} capitalGainsTaxByFiscalYear={capitalGainsTaxByFiscalYear} emptyLabel="自動計算できる年度がまだありません。" />
            <TaxCalculationDetails details={autoDetails} />
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
                        value={row[key]}
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
            <TaxCalculationDetails details={autoDetails} />
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
                        value={row[key]}
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
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <thead>
          <Tr>
            <Th>年度</Th>
            <Th>住民税</Th>
            <Th>所得税</Th>
            <Th>国保</Th>
            <Th>国民年金(月額)</Th>
            <Th>介護</Th>
            <Th>譲渡益課税</Th>
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
              row.nationalPensionMonthly * 12 +
              row.nursingCareAnnual +
              capitalGainsTaxAnnual +
              row.otherPublicCostAnnual;
            return (
              <Tr key={row.id}>
                <Td>{row.fiscalYear}</Td>
                <Td>{yen(row.residentTaxAnnual)}</Td>
                <Td>{yen(row.incomeTaxAnnual)}</Td>
                <Td>{yen(row.nationalHealthInsuranceAnnual)}</Td>
                <Td>{yen(row.nationalPensionMonthly)}</Td>
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
  );
}

function TaxCalculationDetails({ details }: { details: AutoTaxYearDetail[] }) {
  if (details.length === 0) {
    return <p className="text-sm text-muted-foreground">自動計算の根拠はまだありません。</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm leading-7 text-muted-foreground">
        <p className="font-medium text-foreground">計算の考え方</p>
        <p>所得税と住民税は、課税対象収入から給与所得控除・公的年金等控除・基礎控除・扶養控除などを差し引いて概算します。</p>
        <p>iDeCoの年金受取は、収入イベントの「種別」を「年金」、「課税区分」を「課税」にすると、公的年金等控除を使う年金収入として扱います。</p>
        <p>国民年金は、20歳から59歳までの対象月数に年度額を掛けて月額換算します。</p>
        <p>国保は大田区の概算ルールで、世帯の国保加入者ごとの所得を集計して見ます。</p>
        <p>譲渡益課税は、特定口座と普通口座（オプション用）の売却時に、売却額のうち含み益部分へ 20.315% を掛けて概算します。取得原価は初期資産タブの入力値を使い、積立分はそのまま取得原価へ加算します。</p>
      </div>

      {details.map((detail) => {
        const annualTotal =
          detail.memberDetails.reduce((sum, member) => sum + member.incomeTaxAnnual + member.residentTaxAnnual + member.nationalPensionAnnual, 0) +
          detail.nationalHealthInsuranceAnnual +
          detail.nursingCareAnnual +
          detail.otherPublicCostAnnual;
        const monthlyEquivalent = Math.round(annualTotal / 12);

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
                        <Th>基礎控除前</Th>
                        <Th>基礎控除</Th>
                        <Th>扶養控除(所得税)</Th>
                        <Th>扶養控除(住民税)</Th>
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
                              {relationshipLabels[member.relationship]} / {member.ageAtYearEnd}歳
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
                          <Td>{yen(member.taxableIncomeBeforeBasicDeductionAnnual)}</Td>
                          <Td>{yen(member.basicDeductionAnnual)}</Td>
                          <Td>{yen(member.dependentDeductionsIncomeTaxAnnual)}</Td>
                          <Td>{yen(member.dependentDeductionsResidentTaxAnnual)}</Td>
                          <Td>{yen(member.incomeTaxBaseAnnual)}</Td>
                          <Td>{yen(member.residentTaxBaseAnnual)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="font-medium">所得税と住民税の結果</h4>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <thead>
                      <Tr>
                        <Th>メンバー</Th>
                        <Th>所得税</Th>
                        <Th>住民税</Th>
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
                <h4 className="font-medium">国民健康保険と介護保険の概算</h4>
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
                          {detail.nationalHealthInsuranceBreakdown.insuredMemberCount}人 / {yen(detail.nationalHealthInsuranceBreakdown.totalBaseIncome)}
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
                    </tbody>
                  </Table>
                </div>
                {detail.nationalHealthInsuranceBreakdown.insuredMemberDetails.length > 0 && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>国保は大田区の概算で、加入者ごとの baseIncome を集計しています。</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {detail.nationalHealthInsuranceBreakdown.insuredMemberDetails.map((member) => (
                        <li key={member.memberId}>
                          {member.memberName} {member.ageAtYearEnd}歳: baseIncome {yen(member.baseIncome)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
  ["nationalPensionMonthly", "国民年金月額"],
  ["nursingCareAnnual", "介護保険関連年額"],
  ["otherPublicCostAnnual", "その他公的負担年額"],
];

function SpecialSection({ scenario, updateScenario }: SectionProps) {
  const add = () =>
    updateScenario((s) =>
      s.specialExpenses.push({
        id: crypto.randomUUID(),
        name: "新しい特別支出",
        yearMonth: s.userProfile.simulationStartYearMonth,
        amount: 0,
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
        id: crypto.randomUUID(),
        name: source.name ? `${source.name} コピー` : "特別支出 コピー",
      });
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
        {scenario.specialExpenses.map((event, index) => (
          <EventEditor
            key={event.id}
            title={event.name || "特別支出"}
            onDelete={() => updateScenario((s) => void s.specialExpenses.splice(index, 1))}
            actions={
              <Button variant="ghost" size="sm" onClick={() => duplicate(index)}>
                <Copy className="h-4 w-4" />
                複製
              </Button>
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
                  <option value="customInterval">任意の月数ごと</option>
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
              <Field label="金額">
                <Input type="number" value={event.amount} onChange={(e) => updateScenario((s) => void (s.specialExpenses[index].amount = numberOrZero(e.target.value)))} />
              </Field>
            </FormGrid>
          </EventEditor>
        ))}
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
            {props.scenarios.map((scenario) => (
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
                <Td className="space-x-2">
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
  const annualOptionSweep = result.annual.reduce((sum, row) => sum + row.optionProfitSweepTotal, 0);
  const annualOptionSuspended = result.annual.reduce((sum, row) => sum + row.optionIncomeSuspendedTotal, 0);
  const annualNisaSkipped = result.annual.reduce((sum, row) => sum + row.nisaContributionSkippedTotal, 0);
  const annualNisaLimitExceeded = result.annual.reduce((sum, row) => sum + row.nisaAnnualLimitExceededTotal, 0);
  const annualLiving = result.annual.reduce((sum, row) => sum + row.livingExpenseTotal, 0);
  const annualTax = result.annual.reduce((sum, row) => sum + row.taxInsuranceTotal + row.capitalGainsTaxTotal, 0);
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
  const cashflowChartData = result.annual.map((row) => ({
    label: `${row.year} / ${row.ageYears}歳`,
    income: row.incomeTotal,
    living: -row.livingExpenseTotal,
    tax: -(row.taxInsuranceTotal + row.capitalGainsTaxTotal),
    withholding: -row.idecoWithholdingTaxTotal,
    special: -row.specialExpenseTotal,
    contribution: -row.assetContributionTotal,
    plannedDrawdown: -row.plannedDrawdownTotal,
    contributionGap: row.assetContributionFundingGap,
    net: row.netCashFlow,
  }));
  const unrealizedGainChartData = result.annual.map((row) => ({
    label: `${row.year} / ${row.ageYears}歳`,
    total: gainTrackedAssets.reduce((sum, asset) => sum + row.endingTrackedAssetUnrealizedGains[asset.key], 0),
    nisa: row.endingTrackedAssetUnrealizedGains.nisa,
    specificAccount: row.endingTrackedAssetUnrealizedGains.specificAccount,
    ordinaryAccountForOptions: row.endingTrackedAssetUnrealizedGains.ordinaryAccountForOptions,
    ideco: row.endingTrackedAssetUnrealizedGains.ideco,
  }));
  const optionsCollateralChartData = result.annual.map((row) => ({
    label: `${row.year} / ${row.ageYears}歳`,
    balance: row.endingTrackedAssetBalances.ordinaryAccountForOptions,
    basis: row.endingTrackedAssetCostBasis.ordinaryAccountForOptions,
    gain: row.endingTrackedAssetUnrealizedGains.ordinaryAccountForOptions,
  }));
  const nisaLimitChartData = result.annual.map((row) => ({
    label: `${row.year} / ${row.ageYears}歳`,
    cumulative: row.nisaCumulativeInvestment,
    remaining: Number.isFinite(row.nisaRemainingLifetimeLimit) ? row.nisaRemainingLifetimeLimit : 0,
    annualContribution: row.nisaContributionTotal,
    skipped: row.nisaContributionSkippedTotal,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Metric title="累計現金収入" value={compactYen(annualIncome)} sub="源泉・手数料控除後" />
        <Metric title="累計口座内積上" value={compactYen(annualRetainedSourceIncome)} sub="現金化せず原資口座に残した利益" />
        <Metric title="累計原資移動" value={compactYen(annualAssetTransfer)} sub="現金・預金から運用口座へ移した額" />
        <Metric title="累計普通口座利益移動" value={compactYen(annualOptionSweep)} sub="目標残高超過分などの移動" />
        <Metric title="累計証拠金不足停止" value={compactYen(annualOptionSuspended)} sub="最低維持額未満で止めた収益" />
        <Metric title="累計NISA未実行" value={compactYen(annualNisaSkipped)} sub="原資不足で実行しなかった積立" />
        <Metric title="累計NISA枠超過" value={compactYen(annualNisaLimitExceeded)} sub="年間枠を超えた予定額" />
        <Metric title="NISA累計投資額" value={compactYen(latestNisaCumulativeInvestment)} sub={latestAnnual ? `${latestAnnual.year}年末時点` : "年末時点"} />
        <Metric title="残りNISA枠" value={compactLimitYen(latestNisaRemainingLifetimeLimit)} sub="生涯投資枠の残り" />
        <Metric title="累計生活費" value={compactYen(annualLiving)} sub="税社保を除く生活費" />
        <Metric title="累計税社保支払" value={compactYen(annualTax)} sub="翌年反映分を含む現金支出" />
        <Metric title="累計iDeCo源泉" value={compactYen(annualIdecoWithholding)} sub="受取時に差し引き" />
        <Metric title="累計特別支出" value={compactYen(annualSpecial)} sub="単発支出" />
        <Metric title="累計追加投資" value={compactYen(annualContribution)} sub="毎月の積立" />
        <Metric title="累計追加投資原資不足" value={compactYen(annualContributionGap)} sub="流動資金でも賄えなかった積立額" />
        <Metric title="累計iDeCo手数料" value={compactYen(annualIdecoFee)} sub="受取期間中の管理・振込手数料" />
        <Metric title="累計流動資金補充" value={compactYen(annualReserveTopUp)} sub="現金と普通預金の最低保持額まで戻した分" />
        <Metric title="累計資産売却総額" value={compactYen(annualGrossWithdrawal)} sub="実際に口座から動かした総額" />
        <Metric title="累計計画取り崩し" value={compactYen(annualPlannedDrawdown)} sub="目標残高へ向けた追加支出" />
        <Metric title="累計収支" value={compactYen(annualNet)} sub={annualNet >= 0 ? "黒字" : "赤字"} />
        <Metric title="期末評価損益" value={compactYen(latestTrackedGainTotal)} sub={latestAnnual ? `${latestAnnual.year}年末の合計` : "年末時点"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>投資計画チェック</CardTitle>
          <CardDescription>NISA積立と普通口座（オプション用）の運用制約に引っかかった年を確認します。</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <thead>
              <Tr>
                <Th>年</Th>
                <Th>NISA未実行</Th>
                <Th>NISA枠超過</Th>
                <Th>証拠金不足停止</Th>
                <Th>普通口座利益移動</Th>
                <Th>確認ポイント</Th>
              </Tr>
            </thead>
            <tbody>
              {result.annual
                .filter(
                  (row) =>
                    row.nisaContributionSkippedTotal > 0 ||
                    row.nisaAnnualLimitExceededTotal > 0 ||
                    row.optionIncomeSuspendedTotal > 0 ||
                    row.optionProfitSweepTotal > 0,
                )
                .map((row) => (
                  <Tr key={`plan-check-${row.year}`}>
                    <Td>{`${row.year} / ${row.ageYears}歳`}</Td>
                    <Td className={row.nisaContributionSkippedTotal > 0 ? "text-destructive" : ""}>{compactYen(row.nisaContributionSkippedTotal)}</Td>
                    <Td className={row.nisaAnnualLimitExceededTotal > 0 ? "text-destructive" : ""}>{compactYen(row.nisaAnnualLimitExceededTotal)}</Td>
                    <Td className={row.optionIncomeSuspendedTotal > 0 ? "text-destructive" : ""}>{compactYen(row.optionIncomeSuspendedTotal)}</Td>
                    <Td>{compactYen(row.optionProfitSweepTotal)}</Td>
                    <Td className="min-w-[360px] text-sm text-muted-foreground">
                      {[
                        row.nisaContributionSkippedTotal > 0 ? "NISA積立の一部が原資不足で未実行です。" : "",
                        row.nisaAnnualLimitExceededTotal > 0 ? "NISA年間枠を超えた予定があります。" : "",
                        row.optionIncomeSuspendedTotal > 0 ? "普通口座が最低維持額未満となり、予定収益を停止しています。" : "",
                        row.optionProfitSweepTotal > 0 ? "普通口座の超過利益を流動資金へ移動しています。" : "",
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
              row.nisaContributionSkippedTotal > 0 ||
              row.nisaAnnualLimitExceededTotal > 0 ||
              row.optionIncomeSuspendedTotal > 0 ||
              row.optionProfitSweepTotal > 0,
          ) && <p className="text-sm text-muted-foreground">投資計画上の警告はありません。</p>}
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
          <CardTitle>年別キャッシュフローの見える化</CardTitle>
          <CardDescription>現金入金、生活費、翌年反映の税・社会保険、iDeCo源泉徴収、追加投資を年ごとに確認します。</CardDescription>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashflowChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <Tooltip formatter={(value) => yen(Number(value))} />
              <Legend />
              <Bar dataKey="income" name="現金収入" fill="#0f766e" />
              <Bar dataKey="living" name="生活費" fill="#334155" />
              <Bar dataKey="tax" name="税社保支払" fill="#dc2626" />
              <Bar dataKey="withholding" name="iDeCo源泉" fill="#f97316" />
              <Bar dataKey="special" name="特別支出" fill="#ea580c" />
              <Bar dataKey="contribution" name="追加投資" fill="#7c3aed" />
              <Bar dataKey="plannedDrawdown" name="計画取り崩し" fill="#be123c" />
              <Bar dataKey="contributionGap" name="追加投資原資不足" fill="#b91c1c" />
              <Bar dataKey="net" name="純収支" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>評価損益の推移</CardTitle>
          <CardDescription>積立、利回り、取り崩しのあとで、各口座の評価損益がどう動くかを年ごとに確認します。</CardDescription>
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
              <Line dataKey="ordinaryAccountForOptions" name="普通口座（オプション用）" stroke="#7c3aed" dot={false} />
              <Line dataKey="ideco" name="iDeCo" stroke="#ea580c" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>普通口座（オプション用）の証拠金推移</CardTitle>
          <CardDescription>口座残高、取引原価、含み損益を年ごとに確認します。口座内積上を選ぶと、残高と取引原価がここで増えます。</CardDescription>
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
          <CardTitle>年末の評価額・取得原価・評価損益</CardTitle>
          <CardDescription>課税口座の取り崩し時課税の元になる取得原価と、年末時点の含み損益を確認します。</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <thead>
              <Tr>
                <Th>年</Th>
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
                  <Td>{`${row.year} / ${row.ageYears}歳`}</Td>
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
          <CardTitle>月別収支表</CardTitle>
          <CardDescription>当月不足分、流動資金最低保持額の補充、実際にどの資産から取り崩したかを確認できます。</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[520px] overflow-auto">
          <ResultTable rows={result.monthly.slice(0, 360)} period="month" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>年別収支表</CardTitle>
          <CardDescription>年末資産残高、年間不足分、現金補充、取り崩し元、税・社会保険負担を確認します。</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <ResultTable rows={result.annual} period="year" />
        </CardContent>
      </Card>
    </div>
  );
}

function CompareSection({ items }: { items: { scenario: ScenarioData; result: ReturnType<typeof simulateScenario> }[] }) {
  const chartData = items.map(({ scenario, result }) => ({
    name: scenario.name,
    target: result.targetAgeBalance ?? 0,
    withdrawal: result.totalWithdrawal,
  }));
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>複数シナリオ比較表</CardTitle>
          <CardDescription>資産寿命、指定年齢残高、取り崩し額を横並びで比較します。</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <thead>
              <Tr>
                <Th>シナリオ</Th>
                <Th>枯渇時期</Th>
                <Th>枯渇年齢</Th>
                <Th>指定年齢残高</Th>
                <Th>累計取り崩し</Th>
                <Th>月平均取り崩し</Th>
                <Th>年平均赤字</Th>
              </Tr>
            </thead>
            <tbody>
              {items.map(({ scenario, result }) => (
                <Tr key={scenario.id}>
                  <Td className="font-medium">{scenario.name}</Td>
                  <Td>{result.depletionYearMonth ?? "期間内維持"}</Td>
                  <Td>{result.depletionAgeYears ? `${result.depletionAgeYears}歳${result.depletionAgeMonths}か月` : "-"}</Td>
                  <Td>{compactYen(result.targetAgeBalance ?? 0)}</Td>
                  <Td>{compactYen(result.totalWithdrawal)}</Td>
                  <Td>{compactYen(result.averageMonthlyWithdrawal)}</Td>
                  <Td>{compactYen(result.averageAnnualDeficit)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>指定年齢残高と累計取り崩し</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10_000)}万`} width={72} />
              <Tooltip formatter={(value) => yen(Number(value))} />
              <Bar dataKey="target" name="指定年齢残高" fill="#0f766e" />
              <Bar dataKey="withdrawal" name="累計取り崩し" fill="#e11d48" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function ManualSection() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            このアプリは
          </CardTitle>
          <CardDescription>本人の老後資金を、月次ベースで見積もるためのシミュレーションアプリです。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
          <p>
            生活費、収入、税・社会保険、資産残高、iDeCo受取、追加投資をまとめて入力し、月別・年別の資産推移を確認できます。
          </p>
          <p>
            まずは本人専用の実用版として使い、将来の一般化や外販にもつなげられる構造を保っています。
          </p>
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
          </ol>
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
            <p>現在の実装では、流動資金の次に 定期預金 → 特定口座 → 普通口座（オプション用） → NISA → iDeCo の順です。</p>
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
            <p>入力内容はブラウザ内の LocalStorage に自動保存されます。</p>
            <p>「履歴に保存」で手動バックアップを残し、「JSONバックアップ作成」でファイルとしても保存できます。</p>
            <p>デスクトップのショートカットからアプリを開き、上部タブの「マニュアル」をクリックするとこの画面を開けます。</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>よく使う確認先</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm leading-7 md:grid-cols-3">
          <div>
            <p className="font-medium">ダッシュボード</p>
            <p className="text-muted-foreground">資産寿命、指定年齢時点残高、チャートを確認します。</p>
          </div>
          <div>
            <p className="font-medium">比較</p>
            <p className="text-muted-foreground">シナリオ間の差を横並びで見ます。</p>
          </div>
          <div>
            <p className="font-medium">データ</p>
            <p className="text-muted-foreground">保存、履歴、JSON入出力をまとめて扱います。</p>
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
  restoreBundledRecovery: () => void;
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
          LocalStorageには自動保存されます。最終保存: {props.lastSavedAt ? formatSavedAt(props.lastSavedAt) : "未保存"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <Button onClick={props.exportJson}>
            <FileJson className="h-4 w-4" />
            JSONエクスポート
          </Button>
          <Button variant="outline" onClick={props.createBackupAndExport}>
            <Download className="h-4 w-4" />
            JSONバックアップ作成
          </Button>
          <Button variant="outline" onClick={props.importJson}>
            <Upload className="h-4 w-4" />
            JSONインポート
          </Button>
          <Button variant="outline" onClick={props.restoreBundledRecovery}>
            <RefreshCcw className="h-4 w-4" />
            実データを復旧
          </Button>
          <Button variant="outline" onClick={props.exportCsv}>
            <Download className="h-4 w-4" />
            月次CSV出力
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
        </div>

        <div className="rounded-lg border bg-amber-50 px-4 py-3 text-sm text-amber-900">
          シナリオが「現状ケース」などのサンプルに戻った場合は、まず「実データを復旧」を押してください。
          復旧前の状態も履歴へ残します。
        </div>

        <div className="rounded-lg border bg-white">
          <div className="border-b px-4 py-3">
            <h3 className="font-medium">LocalStorage内の履歴バックアップ</h3>
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

function compactLimitYen(value: number) {
  return Number.isFinite(value) ? compactYen(value) : "制限なし";
}

function ResultTable(props: { rows: MonthlyResult[]; period: "month" } | { rows: AnnualResult[]; period: "year" }) {
  const { rows, period } = props;
  const stickyHeaderClass = "sticky left-0 z-30 bg-white shadow-[1px_0_0_#cbd5e1]";
  const stickyCellClass = "sticky left-0 z-20 bg-white shadow-[1px_0_0_#cbd5e1]";
  return (
    <Table className="min-w-[2400px]">
      <thead className="sticky top-0 z-10 bg-white shadow-sm">
        <Tr>
          <Th className={stickyHeaderClass}>{period === "month" ? "年月" : "年 / 年齢"}</Th>
          {period === "month" && <Th>年齢</Th>}
          <Th>現金収入</Th>
          <Th>生活費</Th>
          <Th>税社保支払</Th>
          <Th>特別支出</Th>
          <Th>純収支</Th>
          <Th>計画取り崩し</Th>
          <Th>当月不足分</Th>
          <Th>収入化した原資</Th>
          <Th className="min-w-[300px]">収入化元</Th>
          <Th>不足補填売却</Th>
          <Th className="min-w-[300px]">不足補填元</Th>
          <Th>追加投資</Th>
          <Th>NISA実行</Th>
          <Th>NISA未実行</Th>
          <Th>NISA枠超過</Th>
          <Th>NISA累計投資</Th>
          <Th>残りNISA枠</Th>
          <Th>追加投資原資不足</Th>
          <Th>口座内積上</Th>
          <Th>原資移動</Th>
          <Th>普通口座利益移動</Th>
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
              <Td>{compactYen(row.taxInsuranceTotal + row.capitalGainsTaxTotal)}</Td>
              <Td>{compactYen(row.specialExpenseTotal)}</Td>
              <Td className={row.netCashFlow < 0 ? "text-destructive" : "text-primary"}>{compactYen(row.netCashFlow)}</Td>
              <Td>{compactYen(row.plannedDrawdownTotal)}</Td>
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
              <Td>{compactYen(row.optionProfitSweepTotal)}</Td>
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
              <Td className={stickyCellClass}>{`${row.year} / ${row.ageYears}歳`}</Td>
              <Td>{compactYen(row.incomeTotal)}</Td>
              <Td>{compactYen(row.livingExpenseTotal)}</Td>
              <Td>{compactYen(row.taxInsuranceTotal + row.capitalGainsTaxTotal)}</Td>
              <Td>{compactYen(row.specialExpenseTotal)}</Td>
              <Td className={row.netCashFlow < 0 ? "text-destructive" : "text-primary"}>{compactYen(row.netCashFlow)}</Td>
              <Td>{compactYen(row.plannedDrawdownTotal)}</Td>
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
              <Td>{compactYen(row.optionProfitSweepTotal)}</Td>
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
}: {
  title: string;
  onDelete: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <div className="flex items-center gap-2">
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
  const warnings: string[] = [];
  for (let i = 0; i < adjustments.length; i += 1) {
    for (let j = i + 1; j < adjustments.length; j += 1) {
      const first = adjustments[i];
      const second = adjustments[j];
      const firstEnd = first.endAge ?? 130;
      const secondEnd = second.endAge ?? 130;
      const ageOverlaps = first.startAge <= secondEnd && second.startAge <= firstEnd;
      const targetOverlaps = first.target === second.target || first.target === "all" || second.target === "all";
      if (!ageOverlaps || !targetOverlaps) continue;

      const from = Math.max(first.startAge, second.startAge);
      const to = Math.min(firstEnd, secondEnd);
      warnings.push(`${first.name || `${first.startAge}歳`} と ${second.name || `${second.startAge}歳`} が ${from}〜${to}歳で重複しています。`);
    }
  }
  return warnings;
}

function seniorAgeOrDefault(value: string | number, fallback = 60) {
  const age = Math.round(numberOrZero(value));
  if (!Number.isFinite(age)) return fallback;
  return Math.min(130, Math.max(60, age));
}

export default App;
