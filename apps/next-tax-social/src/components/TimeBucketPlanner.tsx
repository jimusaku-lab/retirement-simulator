import { FormEvent, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { compactYen, numberOrZero } from "@/lib/utils";
import type { HouseholdMember, ScenarioData, SpecialExpenseEvent, TimeBucketBucketId, TimeBucketItem } from "@/types";

const buckets: { id: TimeBucketBucketId; label: string; tone: string }[] = [
  { id: "todo", label: "やりたいことリスト", tone: "bg-white text-slate-800" },
  { id: "20s", label: "20代", tone: "bg-emerald-50 text-emerald-800" },
  { id: "30s", label: "30代", tone: "bg-cyan-50 text-cyan-800" },
  { id: "40s", label: "40代", tone: "bg-sky-50 text-sky-800" },
  { id: "50s", label: "50代", tone: "bg-indigo-50 text-indigo-800" },
  { id: "60s", label: "60代", tone: "bg-amber-50 text-amber-800" },
  { id: "70s", label: "70代", tone: "bg-orange-50 text-orange-800" },
  { id: "80s", label: "80代", tone: "bg-rose-50 text-rose-800" },
];

type ConversionDraft = {
  itemId: string;
  yearMonth: string;
  amount: number;
  category: NonNullable<SpecialExpenseEvent["category"]>;
  schedule: NonNullable<SpecialExpenseEvent["schedule"]>;
  activeStartMonth: number;
  activeEndMonth: number;
  inflationMode: NonNullable<SpecialExpenseEvent["inflationMode"]>;
  customAnnualInflationRate: number;
  endYearMonth: string;
  note: string;
};

type TimeBucketPlannerProps = {
  scenario: ScenarioData;
  scenarios: ScenarioData[];
  updateScenario: (updater: (scenario: ScenarioData) => void) => void;
  updateScenarios: (updater: (scenario: ScenarioData) => ScenarioData) => void;
  onOpenSpecialExpenses: () => void;
};

function ageFromBucket(bucketId: TimeBucketBucketId) {
  if (bucketId === "todo") return undefined;
  return Number(bucketId.replace("s", ""));
}

function ageAtYearMonth(birthDate: string, yearMonth: string) {
  const [birthYear, birthMonth] = birthDate.split("-").map(Number);
  const [targetYear, targetMonth] = yearMonth.split("-").map(Number);
  if (!birthYear || !birthMonth || !targetYear || !targetMonth) return undefined;
  let age = targetYear - birthYear;
  if (targetMonth < birthMonth) age -= 1;
  return age;
}

function decadeStartForAge(age: number | undefined) {
  if (age === undefined) return 20;
  return Math.max(20, Math.min(80, Math.floor(age / 10) * 10));
}

function memberAgeLabel(member: HouseholdMember, scenario: ScenarioData) {
  const age = ageAtYearMonth(member.birthDate, scenario.userProfile.simulationStartYearMonth);
  if (age === undefined) return undefined;
  const label = member.relationship === "self" ? "本人" : member.relationship === "spouse" ? "配偶者" : member.name;
  return `${label}${age}才`;
}

function bucketMemberAgeLabels(bucketId: TimeBucketBucketId, scenario: ScenarioData) {
  const bucketAge = ageFromBucket(bucketId);
  if (bucketAge === undefined) return [];
  return scenario.householdMembers
    .filter((member) => member.relationship === "self" || member.relationship === "spouse")
    .filter((member) => decadeStartForAge(ageAtYearMonth(member.birthDate, scenario.userProfile.simulationStartYearMonth)) === bucketAge)
    .map((member) => memberAgeLabel(member, scenario))
    .filter((label): label is string => Boolean(label));
}

function yearMonthForAge(birthDate: string, age: number | undefined, fallback: string) {
  if (age === undefined) return fallback;
  const [birthYear, birthMonth] = birthDate.split("-").map(Number);
  if (!birthYear || !birthMonth) return fallback;
  return `${birthYear + age}-${String(birthMonth).padStart(2, "0")}`;
}

function createDraft(scenario: ScenarioData, itemId: string, bucketId: TimeBucketBucketId): ConversionDraft {
  return {
    itemId,
    yearMonth: yearMonthForAge(scenario.userProfile.birthDate, ageFromBucket(bucketId), scenario.userProfile.simulationStartYearMonth),
    amount: 0,
    category: "enjoyment",
    schedule: "once",
    activeStartMonth: 1,
    activeEndMonth: 12,
    inflationMode: "none",
    customAnnualInflationRate: 0.02,
    endYearMonth: "",
    note: "",
  };
}

const specialExpenseCategoryLabels: Record<NonNullable<SpecialExpenseEvent["category"]>, string> = {
  enjoyment: "楽しみ",
  lifeMaintenance: "生活維持",
  housingCar: "住宅・車",
  medicalCare: "医療・介護",
  familySupport: "家族支援",
};

const inflationModeLabels: Record<NonNullable<SpecialExpenseEvent["inflationMode"]>, string> = {
  none: "インフレ反映なし",
  livingCost: "生活費インフレ率",
  medical: "医療費上昇率",
  custom: "個別インフレ率",
};

function scheduleLabel(event: Pick<SpecialExpenseEvent, "schedule" | "activeStartMonth" | "activeEndMonth">) {
  const schedule = event.schedule ?? "once";
  if (schedule === "once") return "単発";
  if (schedule === "yearly") return "毎年";
  if (schedule === "seasonalMonthly") {
    return `毎年${event.activeStartMonth ?? 1}月〜${event.activeEndMonth ?? 12}月`;
  }
  if (schedule === "monthly") return "毎月";
  if (schedule === "quarterly") return "四半期に1回";
  if (schedule === "semiannual") return "半年に1回";
  return "カスタム間隔";
}

function convertedSummary(event: SpecialExpenseEvent) {
  return `${event.yearMonth} ${scheduleLabel(event)} ${compactYen(event.amount)} ${specialExpenseCategoryLabels[event.category ?? "lifeMaintenance"]} ${inflationModeLabels[event.inflationMode ?? "none"]}`;
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

function cloneTimeBucketSetForTarget(source: ScenarioData, includeLinkedSpecialExpenses: boolean) {
  const linkedSourceExpenses = new Map(source.specialExpenses.map((event) => [event.id, event]));
  const linkedExpenseIdMap = new Map<string, string>();
  const clonedSpecialExpenses: SpecialExpenseEvent[] = [];
  const clonedItems: TimeBucketItem[] = source.timeBucketItems.map((item) => {
    const linkedExpense = item.convertedSpecialExpenseId ? linkedSourceExpenses.get(item.convertedSpecialExpenseId) : undefined;
    if (!includeLinkedSpecialExpenses || !linkedExpense) {
      return { ...structuredClone(item), convertedSpecialExpenseId: undefined };
    }
    const newExpenseId = crypto.randomUUID();
    linkedExpenseIdMap.set(linkedExpense.id, newExpenseId);
    clonedSpecialExpenses.push({
      ...structuredClone(linkedExpense),
      id: newExpenseId,
    });
    return { ...structuredClone(item), convertedSpecialExpenseId: newExpenseId };
  });

  return { clonedItems, clonedSpecialExpenses, linkedExpenseIdMap };
}

export function TimeBucketPlanner({ scenario, scenarios, updateScenario, updateScenarios, onOpenSpecialExpenses }: TimeBucketPlannerProps) {
  const [newTitle, setNewTitle] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverBucketId, setDragOverBucketId] = useState<TimeBucketBucketId | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [conversionDraft, setConversionDraft] = useState<ConversionDraft | null>(null);
  const [syncSourceScenarioId, setSyncSourceScenarioId] = useState(scenario.id);
  const [syncTargetMode, setSyncTargetMode] = useState<"compare" | "selected" | "all">("compare");
  const [syncSelectedTargetIds, setSyncSelectedTargetIds] = useState<string[]>([]);
  const [syncIncludeLinkedExpenses, setSyncIncludeLinkedExpenses] = useState(false);
  const [syncDetailsOpen, setSyncDetailsOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const currentAge = ageAtYearMonth(scenario.userProfile.birthDate, scenario.userProfile.simulationStartYearMonth);
  const firstVisibleDecade = decadeStartForAge(currentAge);
  const visibleBuckets = buckets.filter((bucket) => bucket.id === "todo" || (ageFromBucket(bucket.id) ?? 0) >= firstVisibleDecade);
  const convertingItem = scenario.timeBucketItems.find((item) => item.id === conversionDraft?.itemId);
  const syncSourceScenario = scenarios.find((item) => item.id === syncSourceScenarioId) ?? scenario;
  const syncSelectedTargetIdSet = new Set(syncSelectedTargetIds);
  const syncTargets = scenarios.filter(
    (target) =>
      target.id !== syncSourceScenario.id &&
      (syncTargetMode === "all" ||
        (syncTargetMode === "compare" && target.compare) ||
        (syncTargetMode === "selected" && syncSelectedTargetIdSet.has(target.id))),
  );
  const syncTargetCount = syncTargets.length;
  const visibleSyncTargets = syncTargets.slice(0, 6);
  const hiddenSyncTargetCount = Math.max(0, syncTargets.length - visibleSyncTargets.length);
  const syncLinkedExpenseCount = syncSourceScenario.timeBucketItems.filter((item) =>
    syncSourceScenario.specialExpenses.some((event) => event.id === item.convertedSpecialExpenseId),
  ).length;

  const addItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    updateScenario((draft) => {
      draft.timeBucketItems.unshift({
        id: crypto.randomUUID(),
        title,
        bucketId: "todo",
      });
    });
    setNewTitle("");
  };

  const removeItem = (itemId: string) => {
    updateScenario((draft) => {
      const item = draft.timeBucketItems.find((entry) => entry.id === itemId);
      const linkedSpecialExpenseId = item?.convertedSpecialExpenseId;
      const shouldDeleteLinked =
        linkedSpecialExpenseId && draft.specialExpenses.some((event) => event.id === linkedSpecialExpenseId)
          ? window.confirm("リンク先の特別支出も削除しますか？\nOK: タイムバケットと特別支出を削除\nキャンセル: タイムバケットだけ削除")
          : false;
      draft.timeBucketItems = draft.timeBucketItems.filter((entry) => entry.id !== itemId);
      if (shouldDeleteLinked) {
        draft.specialExpenses = draft.specialExpenses.filter((event) => event.id !== linkedSpecialExpenseId);
      }
    });
    if (conversionDraft?.itemId === itemId) setConversionDraft(null);
  };

  const unlinkSpecialExpense = (itemId: string) => {
    updateScenario((draft) => {
      const item = draft.timeBucketItems.find((entry) => entry.id === itemId);
      if (item) item.convertedSpecialExpenseId = undefined;
    });
  };

  const deleteLinkedSpecialExpense = (itemId: string, specialExpenseId: string) => {
    if (!window.confirm("リンク先の特別支出を削除しますか？タイムバケット項目は残ります。")) return;
    updateScenario((draft) => {
      draft.specialExpenses = draft.specialExpenses.filter((event) => event.id !== specialExpenseId);
      const item = draft.timeBucketItems.find((entry) => entry.id === itemId);
      if (item?.convertedSpecialExpenseId === specialExpenseId) item.convertedSpecialExpenseId = undefined;
    });
  };

  const moveItem = (itemId: string, bucketId: TimeBucketBucketId, beforeItemId?: string) => {
    updateScenario((draft) => {
      const movingItem = draft.timeBucketItems.find((item) => item.id === itemId);
      if (!movingItem) return;

      const remainingItems = draft.timeBucketItems.filter((item) => item.id !== itemId);
      const movedItem = { ...movingItem, bucketId };
      if (!beforeItemId || beforeItemId === itemId) {
        draft.timeBucketItems = [...remainingItems, movedItem];
        return;
      }

      const targetIndex = remainingItems.findIndex((item) => item.id === beforeItemId);
      if (targetIndex < 0) {
        draft.timeBucketItems = [...remainingItems, movedItem];
        return;
      }

      draft.timeBucketItems = [...remainingItems.slice(0, targetIndex), movedItem, ...remainingItems.slice(targetIndex)];
    });
  };

  const convertToSpecialExpense = () => {
    if (!conversionDraft || !convertingItem) return;
    const specialExpenseId = crypto.randomUUID();
    updateScenario((draft) => {
      draft.specialExpenses.push({
        id: specialExpenseId,
        name: convertingItem.title,
        yearMonth: conversionDraft.yearMonth,
        amount: conversionDraft.amount,
        category: conversionDraft.category,
        schedule: conversionDraft.schedule,
        repeatIntervalMonths:
          conversionDraft.schedule === "monthly"
            ? 1
            : conversionDraft.schedule === "quarterly"
              ? 3
              : conversionDraft.schedule === "semiannual"
                ? 6
                : conversionDraft.schedule === "yearly"
                  ? 12
                  : undefined,
        activeStartMonth: conversionDraft.schedule === "seasonalMonthly" ? conversionDraft.activeStartMonth : undefined,
        activeEndMonth: conversionDraft.schedule === "seasonalMonthly" ? conversionDraft.activeEndMonth : undefined,
        inflationMode: conversionDraft.inflationMode,
        customAnnualInflationRate: conversionDraft.inflationMode === "custom" ? conversionDraft.customAnnualInflationRate : undefined,
        endYearMonth: conversionDraft.endYearMonth || undefined,
        note: conversionDraft.note || `タイムバケット「${convertingItem.title}」から作成`,
      });
      const source = draft.timeBucketItems.find((item) => item.id === convertingItem.id);
      if (source) source.convertedSpecialExpenseId = specialExpenseId;
    });
    setConversionDraft(null);
  };

  const applyTimeBucketSync = () => {
    if (syncTargetCount === 0) return;
    const source = structuredClone(syncSourceScenario);
    const linkedLabel = syncIncludeLinkedExpenses ? `支出化済み特別支出 ${syncLinkedExpenseCount} 件も含めて` : "タイムバケット項目だけ";
    const confirmed = window.confirm(
      `「${source.name}」のタイムバケットを、コピー元自身を除く ${syncTargetCount} 件のシナリオへ反映します。\n` +
        `${linkedLabel}反映します。\n\n反映先:\n${formatScenarioNamesForConfirm(syncTargets.map((target) => target.name))}\n\n実行しますか？`,
    );
    if (!confirmed) return;
    updateScenarios((target) => {
      if (target.id === source.id) return target;
      if (syncTargetMode === "compare" && !target.compare) return target;
      if (syncTargetMode === "selected" && !syncSelectedTargetIdSet.has(target.id)) return target;
      const targetLinkedExpenseIds = new Set(
        target.timeBucketItems.map((item) => item.convertedSpecialExpenseId).filter((id): id is string => Boolean(id)),
      );
      const { clonedItems, clonedSpecialExpenses } = cloneTimeBucketSetForTarget(source, syncIncludeLinkedExpenses);
      target.timeBucketItems = clonedItems;
      if (syncIncludeLinkedExpenses) {
        target.specialExpenses = [
          ...target.specialExpenses.filter((event) => !targetLinkedExpenseIds.has(event.id)),
          ...clonedSpecialExpenses,
        ];
      }
      return target;
    });
    setSyncMessage(
      `${syncTargetCount} 件のシナリオへタイムバケットを反映しました: ${formatScenarioNamesForMessage(syncTargets.map((target) => target.name))}。`,
    );
  };
  const toggleSyncTarget = (scenarioId: string) => {
    setSyncSelectedTargetIds((current) =>
      current.includes(scenarioId) ? current.filter((id) => id !== scenarioId) : [...current, scenarioId],
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>タイムバケット・プランナー</CardTitle>
          <CardDescription>人生でやりたいことを年代ごとに整理し、必要なものだけ楽しみ支出へ変換します。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={addItem} className="rounded-lg border bg-slate-50 p-4">
            <label htmlFor="time-bucket-new-title" className="text-sm font-medium">
              やりたいことを追加
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                id="time-bucket-new-title"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="例：オーロラを見る"
              />
              <Button type="submit">
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>
          </form>
          <div className="rounded-md border bg-white px-4 py-3 text-sm text-muted-foreground">
            基本情報の生年月日とシミュレーション開始年月から、開始時点の年齢を
            <span className="font-medium text-foreground"> {currentAge ?? "-"}歳 </span>
            として扱い、{firstVisibleDecade}代以降のバケットだけを表示しています。
          </div>

          {conversionDraft && convertingItem && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-blue-950">楽しみ支出へ変換</div>
                  <div className="mt-1 text-sm text-blue-900">{convertingItem.title}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setConversionDraft(null)}>
                  閉じる
                </Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">実施年月</span>
                  <Input
                    type="month"
                    value={conversionDraft.yearMonth}
                    onChange={(event) => setConversionDraft((current) => current && { ...current, yearMonth: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">金額</span>
                  <Input
                    type="number"
                    value={conversionDraft.amount}
                    onChange={(event) => setConversionDraft((current) => current && { ...current, amount: numberOrZero(event.target.value) })}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">カテゴリ</span>
                  <Select
                    value={conversionDraft.category}
                    onChange={(event) =>
                      setConversionDraft((current) =>
                        current ? { ...current, category: event.target.value as NonNullable<SpecialExpenseEvent["category"]> } : current,
                      )
                    }
                  >
                    {Object.entries(specialExpenseCategoryLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">計算方式</span>
                  <Select
                    value={conversionDraft.schedule}
                    onChange={(event) =>
                      setConversionDraft((current) =>
                        current ? { ...current, schedule: event.target.value as ConversionDraft["schedule"] } : current,
                      )
                    }
                  >
                    <option value="once">単発</option>
                    <option value="yearly">毎年発生</option>
                    <option value="seasonalMonthly">毎年指定月だけ毎月発生</option>
                  </Select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">終了年月</span>
                  <Input
                    type="month"
                    value={conversionDraft.endYearMonth}
                    onChange={(event) => setConversionDraft((current) => current && { ...current, endYearMonth: event.target.value })}
                  />
                </label>
                {conversionDraft.schedule === "seasonalMonthly" && (
                  <>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">発生開始月</span>
                      <Select
                        value={conversionDraft.activeStartMonth}
                        onChange={(event) =>
                          setConversionDraft((current) =>
                            current ? { ...current, activeStartMonth: Number(event.target.value) } : current,
                          )
                        }
                      >
                        {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                          <option key={month} value={month}>
                            {month}月
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">発生終了月</span>
                      <Select
                        value={conversionDraft.activeEndMonth}
                        onChange={(event) =>
                          setConversionDraft((current) =>
                            current ? { ...current, activeEndMonth: Number(event.target.value) } : current,
                          )
                        }
                      >
                        {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                          <option key={month} value={month}>
                            {month}月
                          </option>
                        ))}
                      </Select>
                    </label>
                  </>
                )}
                <label className="space-y-1 text-sm">
                  <span className="font-medium">インフレ反映</span>
                  <Select
                    value={conversionDraft.inflationMode}
                    onChange={(event) =>
                      setConversionDraft((current) =>
                        current ? { ...current, inflationMode: event.target.value as NonNullable<SpecialExpenseEvent["inflationMode"]> } : current,
                      )
                    }
                  >
                    <option value="none">反映しない</option>
                    <option value="livingCost">生活費インフレ率を使う</option>
                    <option value="medical">医療費上昇率を使う</option>
                    <option value="custom">個別指定</option>
                  </Select>
                </label>
                {conversionDraft.inflationMode === "custom" && (
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">個別インフレ率</span>
                    <Input
                      type="number"
                      step={0.001}
                      value={conversionDraft.customAnnualInflationRate}
                      onChange={(event) =>
                        setConversionDraft((current) =>
                          current ? { ...current, customAnnualInflationRate: numberOrZero(event.target.value) } : current,
                        )
                      }
                    />
                  </label>
                )}
              </div>
              <label className="mt-3 block space-y-1 text-sm">
                <span className="font-medium">メモ</span>
                <Textarea
                  value={conversionDraft.note}
                  onChange={(event) => setConversionDraft((current) => current && { ...current, note: event.target.value })}
                  placeholder="任意"
                />
              </label>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button onClick={convertToSpecialExpense}>楽しみ支出に追加</Button>
                <span className="text-sm text-muted-foreground">
                  {conversionDraft.yearMonth || "-"} / {scheduleLabel(conversionDraft)} / {compactYen(conversionDraft.amount)} / {specialExpenseCategoryLabels[conversionDraft.category]} / {inflationModeLabels[conversionDraft.inflationMode]}
                </span>
              </div>
              <p className="mt-2 text-xs leading-6 text-blue-900">
                金額は入力時点の価格で入れます。将来価格に膨らませたい場合だけ、インフレ反映を選んでください。
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleBuckets.map((bucket) => {
          const bucketItems = scenario.timeBucketItems.filter((item) => item.bucketId === bucket.id);
          const ageLabels = bucketMemberAgeLabels(bucket.id, scenario);
          return (
            <section
              key={bucket.id}
              className={[
                "flex min-h-64 flex-col rounded-lg border bg-white p-4 shadow-sm transition",
                dragOverBucketId === bucket.id ? "border-blue-500 shadow-md ring-2 ring-blue-100" : "",
              ].join(" ")}
              onDragEnter={() => setDragOverBucketId(bucket.id)}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverBucketId(bucket.id);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverBucketId(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggingId) moveItem(draggingId, bucket.id);
                setDraggingId(null);
                setDragOverBucketId(null);
                setDragOverItemId(null);
              }}
            >
              <h3 className={`rounded-md px-3 py-3 text-center text-lg font-semibold ${bucket.tone}`}>
                <span className="block">{bucket.label}</span>
                {ageLabels.length > 0 && (
                  <span className="mt-1 block text-xs font-medium text-slate-600">{ageLabels.join("、")}</span>
                )}
              </h3>
              <div className="mt-4 flex flex-1 flex-col gap-3">
                {bucketItems.map((item) => {
                  const linkedSpecialExpense = scenario.specialExpenses.find((event) => event.id === item.convertedSpecialExpenseId);
                  const converted = Boolean(linkedSpecialExpense);
                  const linkMissing = Boolean(item.convertedSpecialExpenseId && !converted);
                  return (
                    <article
                      key={item.id}
                      draggable
                      onDragStart={() => setDraggingId(item.id)}
                      onDragEnter={() => {
                        if (draggingId !== item.id) setDragOverItemId(item.id);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (draggingId !== item.id) setDragOverItemId(item.id);
                      }}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverItemId(null);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (draggingId && draggingId !== item.id) moveItem(draggingId, bucket.id, item.id);
                        setDraggingId(null);
                        setDragOverBucketId(null);
                        setDragOverItemId(null);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverBucketId(null);
                        setDragOverItemId(null);
                      }}
                      className={[
                        "rounded-md border bg-white p-3 text-sm shadow-sm transition",
                        dragOverItemId === item.id ? "border-blue-500 shadow-md ring-2 ring-blue-100" : "border-slate-200",
                      ].join(" ")}
                    >
                      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-2">
                        <GripVertical className="mt-0.5 h-4 w-4 text-slate-400" />
                        <span className="min-w-0 break-words leading-6">{item.title}</span>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
                          aria-label={`${item.title}を削除`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {converted ? (
                          <>
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                              支出化済み: {linkedSpecialExpense ? convertedSummary(linkedSpecialExpense) : ""}
                            </span>
                            <Button variant="ghost" size="sm" onClick={onOpenSpecialExpenses}>
                              特別支出を見る
                            </Button>
                            {linkedSpecialExpense && (
                              <Button variant="ghost" size="sm" onClick={() => deleteLinkedSpecialExpense(item.id, linkedSpecialExpense.id)}>
                                特別支出を削除
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => unlinkSpecialExpense(item.id)}>
                              リンク解除
                            </Button>
                          </>
                        ) : linkMissing ? (
                          <>
                            <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">リンク先の特別支出が見つかりません</span>
                            <Button variant="ghost" size="sm" onClick={() => unlinkSpecialExpense(item.id)}>
                              リンク解除
                            </Button>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setConversionDraft(createDraft(scenario, item.id, item.bucketId))}>
                            楽しみ支出へ
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
                {bucketItems.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400">
                    ここに移動
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <details className="rounded-lg border bg-white px-4 py-3" onToggle={(event) => setSyncDetailsOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
          <span>
            <span className="block font-medium">他シナリオへ反映（必要時のみ）</span>
            <span className="text-sm text-muted-foreground">タイムバケットを他シナリオにも使う時だけ開きます。</span>
          </span>
          <span className="rounded-md border bg-slate-50 px-3 py-1 text-sm text-muted-foreground">
            {syncDetailsOpen ? "閉じる" : "開く"}
          </span>
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(240px,360px)_minmax(220px,280px)_1fr]">
            <label className="space-y-1 text-sm">
              <span className="font-medium">コピー元シナリオ</span>
              <Select value={syncSourceScenario.id} onChange={(event) => setSyncSourceScenarioId(event.target.value)}>
                {scenarios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">反映先</span>
              <Select value={syncTargetMode} onChange={(event) => setSyncTargetMode(event.target.value as "compare" | "selected" | "all")}>
                <option value="compare">比較対象にチェック済み</option>
                <option value="selected">個別に選択</option>
                <option value="all">全シナリオ</option>
              </Select>
            </label>
            <div className="space-y-2 rounded-md border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
              <p>コピー元自身を除く {syncTargetCount} 件へ反映します。反映先の既存タイムバケットはコピー元の内容で置き換わります。</p>
              <div className="rounded-md border bg-white px-3 py-2">
                <div className="font-medium text-foreground">今回の反映先</div>
                {syncTargets.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {visibleSyncTargets.map((target) => (
                      <span key={target.id} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        {target.name}
                      </span>
                    ))}
                    {hiddenSyncTargetCount > 0 && (
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">
                        ほか{hiddenSyncTargetCount}件
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs">対象シナリオはありません。</p>
                )}
                {syncTargetMode === "compare" && (
                  <p className="mt-2 text-xs">
                    比較対象は、シナリオタブで「比較」に入れているシナリオです。任意の反映先だけにしたい場合は「個別に選択」を使います。
                  </p>
                )}
                {syncTargetMode === "selected" && <p className="mt-2 text-xs">この画面内のチェックで、反映先を個別に選びます。</p>}
              </div>
            </div>
          </div>
          {syncTargetMode === "selected" && (
            <div className="rounded-md border bg-white px-4 py-3">
              <div className="text-sm font-medium">反映先を個別に選択</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {scenarios
                  .filter((item) => item.id !== syncSourceScenario.id)
                  .map((item) => (
                    <label key={item.id} className="flex items-start gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={syncSelectedTargetIdSet.has(item.id)}
                        onChange={() => toggleSyncTarget(item.id)}
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
          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex items-start gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
              <input type="radio" checked={!syncIncludeLinkedExpenses} onChange={() => setSyncIncludeLinkedExpenses(false)} />
              <span>
                <span className="block font-medium">タイムバケットだけコピー</span>
                <span className="text-xs text-muted-foreground">支出化済みリンクは外します。計算結果はコピー先で変わりません。</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
              <input type="radio" checked={syncIncludeLinkedExpenses} onChange={() => setSyncIncludeLinkedExpenses(true)} />
              <span>
                <span className="block font-medium">支出化済み特別支出もコピー</span>
                <span className="text-xs text-muted-foreground">
                  {syncLinkedExpenseCount} 件の特別支出を新しいIDで作り直し、タイムバケットと再リンクします。
                </span>
              </span>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span>特別支出まで含めるとコピー先の計算結果が変わります。タイムバケットだけなら計算には入りません。</span>
            <Button onClick={applyTimeBucketSync} disabled={syncTargetCount === 0 || syncSourceScenario.timeBucketItems.length === 0}>
              他シナリオへ反映
            </Button>
          </div>
          {syncMessage && <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">{syncMessage}</div>}
        </div>
      </details>
    </div>
  );
}
