import type { IncomeEvent, NisaInvestmentRules, OptionSubAccount, ScenarioData, SpecialExpenseEvent } from "@/types";

export type ScenarioDiffSeverity = "changed" | "added" | "removed";

export type ScenarioDiffCategory =
  | "income"
  | "nisa"
  | "specialExpense"
  | "monthlyExpense"
  | "taxSocial"
  | "optionAccount";

export type ScenarioDiffItem = {
  id: string;
  category: ScenarioDiffCategory;
  label: string;
  summary: string;
  baselineValue?: string;
  targetValue?: string;
  severity: ScenarioDiffSeverity;
};

export type ScenarioDiffSummary = {
  baselineScenarioId: string;
  targetScenarioId: string;
  headlineItems: ScenarioDiffItem[];
  items: ScenarioDiffItem[];
};

const categoryPriority: Record<ScenarioDiffCategory, number> = {
  income: 1,
  optionAccount: 2,
  nisa: 3,
  specialExpense: 4,
  monthlyExpense: 5,
  taxSocial: 6,
};

function yen(value: number) {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function monthLabel(yearMonth?: string) {
  if (!yearMonth) return "終了なし";
  return yearMonth.replace("-", "/");
}

function periodLabel(start?: string, end?: string) {
  return `${monthLabel(start)}〜${monthLabel(end)}`;
}

function incomeKey(event: IncomeEvent) {
  return event.id || `${event.memberId}:${event.type}:${event.name}`;
}

function specialExpenseKey(event: SpecialExpenseEvent) {
  return event.id || `${event.name}:${event.yearMonth}:${event.category ?? "lifeMaintenance"}`;
}

function mapByKey<T>(items: T[], keyOf: (item: T) => string) {
  return new Map(items.map((item) => [keyOf(item), item]));
}

function isEmptyIncomeEvent(event: IncomeEvent) {
  return (event.name.trim() === "" || event.name === "新しい収入") && Math.max(0, event.monthlyAmount ?? 0) === 0;
}

function incomeValue(event: IncomeEvent) {
  const payout =
    event.sourceAssetKey === "ordinaryAccountForOptions"
      ? event.sourceAssetPayoutMode === "retainInSourceAsset"
        ? "口座内積上"
        : "現金収入"
      : event.sourceAssetKey === "ideco"
        ? `iDeCo ${event.idecoPensionYears ?? "-"}年受取`
      : undefined;
  return [
    yen(event.monthlyAmount ?? 0),
    periodLabel(event.startYearMonth, event.endYearMonth),
    payout,
  ].filter(Boolean).join(" / ");
}

function incomeChangeSummary(label: string, baselineEvent: IncomeEvent, targetEvent: IncomeEvent) {
  const changes: string[] = [];
  if (baselineEvent.monthlyAmount !== targetEvent.monthlyAmount) {
    changes.push(`月額 ${yen(baselineEvent.monthlyAmount ?? 0)} → ${yen(targetEvent.monthlyAmount ?? 0)}`);
  }
  if (baselineEvent.startYearMonth !== targetEvent.startYearMonth || baselineEvent.endYearMonth !== targetEvent.endYearMonth) {
    changes.push(`期間 ${periodLabel(baselineEvent.startYearMonth, baselineEvent.endYearMonth)} → ${periodLabel(targetEvent.startYearMonth, targetEvent.endYearMonth)}`);
  }
  if (baselineEvent.sourceAssetPayoutMode !== targetEvent.sourceAssetPayoutMode) {
    const baselineMode = baselineEvent.sourceAssetPayoutMode === "retainInSourceAsset" ? "口座内積上" : "現金収入";
    const targetMode = targetEvent.sourceAssetPayoutMode === "retainInSourceAsset" ? "口座内積上" : "現金収入";
    changes.push(`反映先 ${baselineMode} → ${targetMode}`);
  }
  if (baselineEvent.sourceOptionSubAccountId !== targetEvent.sourceOptionSubAccountId) {
    changes.push("普通口座サブ口座の紐付け変更");
  }
  if (baselineEvent.idecoPensionYears !== targetEvent.idecoPensionYears) {
    changes.push(`受取年数 ${baselineEvent.idecoPensionYears ?? "-"}年 → ${targetEvent.idecoPensionYears ?? "-"}年`);
  }
  return changes.length ? `${label}: ${changes.join(" / ")}` : `${label}: 設定変更`;
}

function specialExpenseValue(event: SpecialExpenseEvent) {
  return [
    yen(event.amount ?? 0),
    periodLabel(event.yearMonth, event.endYearMonth),
    event.category ?? "lifeMaintenance",
    event.schedule ?? "once",
  ].join(" / ");
}

function monthlyExpenseTotal(scenario: ScenarioData) {
  return Object.values(scenario.monthlyExpenses).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

function addFieldDiff<T extends string | number | boolean | undefined>(
  items: ScenarioDiffItem[],
  id: string,
  category: ScenarioDiffCategory,
  label: string,
  baselineValue: T,
  targetValue: T,
  format: (value: NonNullable<T>) => string = (value) => String(value),
) {
  if (baselineValue === targetValue) return;
  items.push({
    id,
    category,
    label,
    summary: `${label}: ${baselineValue === undefined ? "未設定" : format(baselineValue)} → ${targetValue === undefined ? "未設定" : format(targetValue)}`,
    baselineValue: baselineValue === undefined ? undefined : format(baselineValue),
    targetValue: targetValue === undefined ? undefined : format(targetValue),
    severity: "changed",
  });
}

function compareIncomeEvents(baseline: ScenarioData, target: ScenarioData): ScenarioDiffItem[] {
  const items: ScenarioDiffItem[] = [];
  const baselineEvents = mapByKey(baseline.incomeEvents.filter((event) => !isEmptyIncomeEvent(event)), incomeKey);
  const targetEvents = mapByKey(target.incomeEvents.filter((event) => !isEmptyIncomeEvent(event)), incomeKey);
  const keys = new Set([...baselineEvents.keys(), ...targetEvents.keys()]);

  for (const key of keys) {
    const baselineEvent = baselineEvents.get(key);
    const targetEvent = targetEvents.get(key);
    const label = targetEvent?.name || baselineEvent?.name || "収入";
    if (!baselineEvent && targetEvent) {
      items.push({
        id: `income-added-${key}`,
        category: "income",
        label,
        summary: `${label}: 表示中シナリオで追加 ${incomeValue(targetEvent)}`,
        targetValue: incomeValue(targetEvent),
        severity: "added",
      });
      continue;
    }
    if (baselineEvent && !targetEvent) {
      items.push({
        id: `income-removed-${key}`,
        category: "income",
        label,
        summary: `${label}: 基準にだけあり ${incomeValue(baselineEvent)}`,
        baselineValue: incomeValue(baselineEvent),
        severity: "removed",
      });
      continue;
    }
    if (!baselineEvent || !targetEvent) continue;

    if (
      baselineEvent.monthlyAmount !== targetEvent.monthlyAmount ||
      baselineEvent.startYearMonth !== targetEvent.startYearMonth ||
      baselineEvent.endYearMonth !== targetEvent.endYearMonth ||
      baselineEvent.sourceAssetPayoutMode !== targetEvent.sourceAssetPayoutMode ||
      baselineEvent.sourceOptionSubAccountId !== targetEvent.sourceOptionSubAccountId ||
      baselineEvent.idecoPensionYears !== targetEvent.idecoPensionYears
    ) {
      items.push({
        id: `income-changed-${key}`,
        category: "income",
        label,
        summary: incomeChangeSummary(label, baselineEvent, targetEvent),
        baselineValue: incomeValue(baselineEvent),
        targetValue: incomeValue(targetEvent),
        severity: "changed",
      });
    }
  }

  return items;
}

function compareSpecialExpenses(baseline: ScenarioData, target: ScenarioData): ScenarioDiffItem[] {
  const items: ScenarioDiffItem[] = [];
  const baselineEvents = mapByKey(baseline.specialExpenses, specialExpenseKey);
  const targetEvents = mapByKey(target.specialExpenses, specialExpenseKey);
  const keys = new Set([...baselineEvents.keys(), ...targetEvents.keys()]);

  for (const key of keys) {
    const baselineEvent = baselineEvents.get(key);
    const targetEvent = targetEvents.get(key);
    const label = targetEvent?.name || baselineEvent?.name || "特別支出";
    if (!baselineEvent && targetEvent) {
      items.push({
        id: `special-added-${key}`,
        category: "specialExpense",
        label,
        summary: `${label}: 追加 ${specialExpenseValue(targetEvent)}`,
        targetValue: specialExpenseValue(targetEvent),
        severity: "added",
      });
      continue;
    }
    if (baselineEvent && !targetEvent) {
      items.push({
        id: `special-removed-${key}`,
        category: "specialExpense",
        label,
        summary: `${label}: 削除 ${specialExpenseValue(baselineEvent)}`,
        baselineValue: specialExpenseValue(baselineEvent),
        severity: "removed",
      });
      continue;
    }
    if (!baselineEvent || !targetEvent) continue;

    if (
      baselineEvent.amount !== targetEvent.amount ||
      baselineEvent.yearMonth !== targetEvent.yearMonth ||
      baselineEvent.endYearMonth !== targetEvent.endYearMonth ||
      baselineEvent.category !== targetEvent.category ||
      baselineEvent.schedule !== targetEvent.schedule ||
      baselineEvent.inflationMode !== targetEvent.inflationMode
    ) {
      items.push({
        id: `special-changed-${key}`,
        category: "specialExpense",
        label,
        summary: `${label}: ${specialExpenseValue(baselineEvent)} → ${specialExpenseValue(targetEvent)}`,
        baselineValue: specialExpenseValue(baselineEvent),
        targetValue: specialExpenseValue(targetEvent),
        severity: "changed",
      });
    }
  }

  return items;
}

function compareNisaRules(baseline: NisaInvestmentRules, target: NisaInvestmentRules): ScenarioDiffItem[] {
  const items: ScenarioDiffItem[] = [];
  addFieldDiff(items, "nisa-annual-limit", "nisa", "NISA年間枠", baseline.annualLimit, target.annualLimit, yen);
  addFieldDiff(items, "nisa-investor-count", "nisa", "NISA投資人数", baseline.investorCount, target.investorCount);
  addFieldDiff(items, "nisa-used-limit", "nisa", "NISA開始時点使用済み枠", baseline.usedLifetimeLimitAtStart, target.usedLifetimeLimitAtStart, yen);
  addFieldDiff(items, "nisa-carry-over", "nisa", "NISA未実行繰越", baseline.carryOverSkippedMode, target.carryOverSkippedMode);
  addFieldDiff(items, "nisa-funding-mode", "nisa", "NISA原資不足時", baseline.insufficientFundingMode, target.insufficientFundingMode);
  return items;
}

function compareOptionSubAccounts(baseline: OptionSubAccount[], target: OptionSubAccount[]): ScenarioDiffItem[] {
  const items: ScenarioDiffItem[] = [];
  const baselineAccounts = mapByKey(baseline, (account) => account.id || account.name);
  const targetAccounts = mapByKey(target, (account) => account.id || account.name);
  const keys = new Set([...baselineAccounts.keys(), ...targetAccounts.keys()]);

  for (const key of keys) {
    const baselineAccount = baselineAccounts.get(key);
    const targetAccount = targetAccounts.get(key);
    const label = targetAccount?.name || baselineAccount?.name || "普通口座オプション";
    if (!baselineAccount && targetAccount) {
      items.push({
        id: `option-added-${key}`,
        category: "optionAccount",
        label,
        summary: `${label}: サブ口座追加`,
        severity: "added",
      });
      continue;
    }
    if (baselineAccount && !targetAccount) {
      items.push({
        id: `option-removed-${key}`,
        category: "optionAccount",
        label,
        summary: `${label}: サブ口座削除`,
        severity: "removed",
      });
      continue;
    }
    if (!baselineAccount || !targetAccount) continue;

    if (
      baselineAccount.minimumBalance !== targetAccount.minimumBalance ||
      baselineAccount.targetBalance !== targetAccount.targetBalance ||
      baselineAccount.profitSweepEnabled !== targetAccount.profitSweepEnabled ||
      baselineAccount.profitSweepDestination !== targetAccount.profitSweepDestination ||
      baselineAccount.profitSweepMethod !== targetAccount.profitSweepMethod ||
      baselineAccount.fixedSweepAmount !== targetAccount.fixedSweepAmount ||
      baselineAccount.suspendIncomeWhenBelowMinimum !== targetAccount.suspendIncomeWhenBelowMinimum
    ) {
      items.push({
        id: `option-changed-${key}`,
        category: "optionAccount",
        label,
        summary: `${label}: 最低維持額・利益移動などの設定変更`,
        severity: "changed",
      });
    }
  }

  return items;
}

export function buildScenarioDiffSummary(baseline: ScenarioData, target: ScenarioData): ScenarioDiffSummary {
  if (baseline.id === target.id) {
    return {
      baselineScenarioId: baseline.id,
      targetScenarioId: target.id,
      headlineItems: [],
      items: [],
    };
  }

  const items: ScenarioDiffItem[] = [
    ...compareIncomeEvents(baseline, target),
    ...compareNisaRules(baseline.nisaInvestmentRules, target.nisaInvestmentRules),
    ...compareSpecialExpenses(baseline, target),
    ...compareOptionSubAccounts(baseline.optionSubAccounts, target.optionSubAccounts),
  ];

  const baselineMonthlyExpenseTotal = monthlyExpenseTotal(baseline);
  const targetMonthlyExpenseTotal = monthlyExpenseTotal(target);
  if (baselineMonthlyExpenseTotal !== targetMonthlyExpenseTotal) {
    items.push({
      id: "monthly-expense-total",
      category: "monthlyExpense",
      label: "生活費月額合計",
      summary: `生活費月額合計: ${yen(baselineMonthlyExpenseTotal)} → ${yen(targetMonthlyExpenseTotal)}`,
      baselineValue: yen(baselineMonthlyExpenseTotal),
      targetValue: yen(targetMonthlyExpenseTotal),
      severity: "changed",
    });
  }

  if (baseline.householdProfile.taxCalculationMode !== target.householdProfile.taxCalculationMode) {
    items.push({
      id: "tax-calculation-mode",
      category: "taxSocial",
      label: "税・社会保険計算",
      summary: `税・社会保険計算: ${baseline.householdProfile.taxCalculationMode} → ${target.householdProfile.taxCalculationMode}`,
      baselineValue: baseline.householdProfile.taxCalculationMode,
      targetValue: target.householdProfile.taxCalculationMode,
      severity: "changed",
    });
  }

  const sortedItems = items.sort((a, b) => categoryPriority[a.category] - categoryPriority[b.category] || a.label.localeCompare(b.label, "ja"));

  return {
    baselineScenarioId: baseline.id,
    targetScenarioId: target.id,
    headlineItems: sortedItems.slice(0, 5),
    items: sortedItems,
  };
}

export function formatScenarioDiffHeadline(diff: ScenarioDiffSummary, emptyText = "基準との差分なし") {
  if (diff.headlineItems.length === 0) return emptyText;
  return diff.headlineItems.map((item) => item.summary).join(" / ");
}
