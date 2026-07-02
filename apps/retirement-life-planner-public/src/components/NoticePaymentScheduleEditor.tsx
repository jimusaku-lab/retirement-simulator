import { useMemo, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Field, FormGrid } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addTaxSocialPaymentScheduleItem,
  buildInstallmentTaxSocialPaymentScheduleItems,
  buildNationalPensionMonthlyScheduleItems,
  buildPropertyTaxRecurringTemplate,
  createTaxSocialPaymentScheduleItem,
  deleteTaxSocialPaymentScheduleItem,
  duplicateTaxSocialPaymentScheduleItem,
  noticePaymentSourceOptions,
  taxSocialPaymentCategoryOrder,
  updateTaxSocialPaymentScheduleItem,
  type TaxSocialPaymentInstallmentInput,
  type TaxSocialPaymentSource,
} from "@/lib/taxSocialPaymentScheduleEditor";
import { numberOrZero, yen } from "@/lib/utils";
import type { ScenarioData, TaxSocialPaymentCategory, TaxSocialPaymentScheduleItem, YearMonth } from "@/types";

type TemplateKind = "residentTax" | "nationalHealthInsurance" | "nationalPension" | "propertyTax";
type SegmentKey = "all" | "residentTax" | "nationalHealthInsurance" | "nationalPension" | "propertyTax" | "other";

const categoryLabels: Record<TaxSocialPaymentCategory, string> = {
  residentTax: "住民税",
  nationalHealthInsurance: "国民健康保険料",
  nationalPension: "国民年金",
  lateElderlyMedical: "後期高齢者医療",
  nursingCare: "介護保険",
  propertyTax: "固定資産税・都市計画税",
  otherPublicCost: "その他公的負担",
};

const categoryShortLabels: Record<TaxSocialPaymentCategory, string> = {
  residentTax: "住民税",
  nationalHealthInsurance: "国保",
  nationalPension: "国民年金",
  lateElderlyMedical: "後期高齢者",
  nursingCare: "介護",
  propertyTax: "固定資産税",
  otherPublicCost: "その他",
};

const sourceLabels: Record<TaxSocialPaymentSource, string> = {
  notice: "通知書",
  manual: "手入力",
  autoAdjustment: "自動補正",
};

const templateLabels: Record<TemplateKind, string> = {
  residentTax: "住民税 4期",
  nationalHealthInsurance: "国民健康保険料 10期",
  nationalPension: "国民年金 月次",
  propertyTax: "固定資産税・都市計画税 4期",
};

const segmentOptions: Array<{ key: SegmentKey; label: string }> = [
  { key: "all", label: "すべて" },
  { key: "residentTax", label: "住民税" },
  { key: "nationalHealthInsurance", label: "国保" },
  { key: "nationalPension", label: "国民年金" },
  { key: "propertyTax", label: "固定資産税" },
  { key: "other", label: "その他" },
];

const otherCategories: TaxSocialPaymentCategory[] = ["lateElderlyMedical", "nursingCare", "otherPublicCost"];

function defaultYearMonth(year: number, month: number): YearMonth {
  return `${year}-${String(month).padStart(2, "0")}` as YearMonth;
}

function createDefaultInstallments(kind: TemplateKind, fiscalYear: number): TaxSocialPaymentInstallmentInput[] {
  if (kind === "residentTax") {
    return [
      { label: "第1期", dueYearMonth: defaultYearMonth(fiscalYear, 6), amount: 0 },
      { label: "第2期", dueYearMonth: defaultYearMonth(fiscalYear, 8), amount: 0 },
      { label: "第3期", dueYearMonth: defaultYearMonth(fiscalYear, 11), amount: 0 },
      { label: "第4期", dueYearMonth: defaultYearMonth(fiscalYear + 1, 2), amount: 0 },
    ];
  }
  if (kind === "propertyTax") {
    return [
      { label: "第1期", dueYearMonth: defaultYearMonth(fiscalYear, 6), amount: 0 },
      { label: "第2期", dueYearMonth: defaultYearMonth(fiscalYear, 9), amount: 0 },
      { label: "第3期", dueYearMonth: defaultYearMonth(fiscalYear, 12), amount: 0 },
      { label: "第4期", dueYearMonth: defaultYearMonth(fiscalYear + 1, 3), amount: 0 },
    ];
  }
  return [
    { label: "6月期", dueYearMonth: defaultYearMonth(fiscalYear, 6), amount: 0 },
    { label: "7月期", dueYearMonth: defaultYearMonth(fiscalYear, 7), amount: 0 },
    { label: "8月期", dueYearMonth: defaultYearMonth(fiscalYear, 8), amount: 0 },
    { label: "9月期", dueYearMonth: defaultYearMonth(fiscalYear, 9), amount: 0 },
    { label: "10月期", dueYearMonth: defaultYearMonth(fiscalYear, 11), amount: 0 },
    { label: "11月期", dueYearMonth: defaultYearMonth(fiscalYear, 11), amount: 0 },
    { label: "12月期", dueYearMonth: defaultYearMonth(fiscalYear + 1, 1), amount: 0 },
    { label: "1月期", dueYearMonth: defaultYearMonth(fiscalYear + 1, 2), amount: 0 },
    { label: "2月期", dueYearMonth: defaultYearMonth(fiscalYear + 1, 3), amount: 0 },
    { label: "3月期", dueYearMonth: defaultYearMonth(fiscalYear + 1, 3), amount: 0 },
  ];
}

function optionalNumber(value: string) {
  return value.trim() === "" ? undefined : numberOrZero(value);
}

function updateInstallment(
  installments: TaxSocialPaymentInstallmentInput[],
  index: number,
  updater: (item: TaxSocialPaymentInstallmentInput) => TaxSocialPaymentInstallmentInput,
) {
  return installments.map((item, currentIndex) => (currentIndex === index ? updater(item) : item));
}

function isReviewItem(item: TaxSocialPaymentScheduleItem) {
  return Boolean(item.note?.includes("要確認") || item.note?.includes("確認"));
}

function segmentMatches(segment: SegmentKey, item: TaxSocialPaymentScheduleItem) {
  if (segment === "all") return true;
  if (segment === "other") return otherCategories.includes(item.category);
  return item.category === segment;
}

function memberLabel(scenario: ScenarioData, memberId: string | undefined) {
  if (!memberId) return "世帯共通";
  return scenario.householdMembers.find((member) => member.id === memberId)?.name ?? "不明";
}

function categoryFromSegment(segment: SegmentKey): TaxSocialPaymentCategory {
  if (segment === "all") return "residentTax";
  if (segment === "other") return "otherPublicCost";
  return segment;
}

function getPensionStatus(items: TaxSocialPaymentScheduleItem[]) {
  if (items.some(isReviewItem)) return "要確認";
  const positiveAmounts = items.map((item) => item.amount).filter((amount) => amount > 0);
  if (positiveAmounts.length === 0) return "-";
  return Math.min(...positiveAmounts) < 10_000 ? "減免" : "通常";
}

export function NoticePaymentScheduleEditor({
  scenario,
  updateScenario,
}: {
  scenario: ScenarioData;
  updateScenario: (updater: (scenario: ScenarioData) => void) => void;
}) {
  const baseYear = Number(scenario.userProfile.simulationStartYearMonth.slice(0, 4)) || new Date().getFullYear();
  const schedule = useMemo(
    () =>
      (scenario.taxSocialPaymentSchedule ?? [])
        .filter((item) => item.dueYearMonth && item.category)
        .sort((a, b) => a.dueYearMonth.localeCompare(b.dueYearMonth) || a.category.localeCompare(b.category)),
    [scenario.taxSocialPaymentSchedule],
  );
  const reviewCount = schedule.filter(isReviewItem).length;
  const hasNationalPensionReview = schedule.some((item) => item.category === "nationalPension" && isReviewItem(item));
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeSegment, setActiveSegment] = useState<SegmentKey>(hasNationalPensionReview ? "nationalPension" : "all");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingPensionMonth, setEditingPensionMonth] = useState<YearMonth | null>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [templateKind, setTemplateKind] = useState<TemplateKind | null>(null);
  const [templateFiscalYear, setTemplateFiscalYear] = useState(baseYear);
  const [templateIncomeYear, setTemplateIncomeYear] = useState(baseYear - 1);
  const [installments, setInstallments] = useState<TaxSocialPaymentInstallmentInput[]>(() =>
    createDefaultInstallments("residentTax", baseYear),
  );
  const [nationalPensionMemberId, setNationalPensionMemberId] = useState(scenario.householdMembers[0]?.id ?? "");
  const [nationalPensionStart, setNationalPensionStart] = useState(scenario.userProfile.simulationStartYearMonth);
  const [nationalPensionEnd, setNationalPensionEnd] = useState(scenario.userProfile.simulationStartYearMonth);
  const [nationalPensionAmount, setNationalPensionAmount] = useState(0);
  const [nationalPensionNote, setNationalPensionNote] = useState("");
  const [propertyRecurring, setPropertyRecurring] = useState(false);

  const memberOptions = scenario.householdMembers.map((member) => ({ id: member.id, name: member.name }));
  const selfMember = scenario.householdMembers.find((member) => member.relationship === "self") ?? scenario.householdMembers[0];
  const spouseMember = scenario.householdMembers.find((member) => member.relationship === "spouse");
  const categoryTotals = taxSocialPaymentCategoryOrder
    .map((category) => ({
      category,
      total: schedule.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0),
      count: schedule.filter((item) => item.category === category).length,
    }))
    .filter((item) => item.count > 0);
  const filteredSchedule = schedule.filter((item) => segmentMatches(activeSegment, item));
  const visibleNonPension = filteredSchedule.filter((item) => item.category !== "nationalPension");
  const activeEditItem = schedule.find((item) => item.id === editingItemId);
  const positivePensionAmounts = schedule
    .filter((item) => item.category === "nationalPension" && item.amount > 0)
    .map((item) => item.amount);
  const reducedPensionAmount = positivePensionAmounts.length ? Math.min(...positivePensionAmounts) : 0;
  const standardPensionAmount = positivePensionAmounts.length ? Math.max(...positivePensionAmounts) : 0;
  const pensionRows = useMemo(() => {
    const byMonth = new Map<YearMonth, TaxSocialPaymentScheduleItem[]>();
    for (const item of schedule.filter((candidate) => candidate.category === "nationalPension")) {
      byMonth.set(item.dueYearMonth, [...(byMonth.get(item.dueYearMonth) ?? []), item]);
    }
    return [...byMonth.entries()].map(([yearMonth, items]) => ({
      yearMonth,
      items,
      selfItem: items.find((item) => item.coveredMemberId === selfMember?.id),
      spouseItem: items.find((item) => item.coveredMemberId === spouseMember?.id),
      status: getPensionStatus(items),
    }));
  }, [schedule, selfMember?.id, spouseMember?.id]);

  const resetInstallments = (kind: TemplateKind, fiscalYear = templateFiscalYear) => {
    setInstallments(createDefaultInstallments(kind, fiscalYear));
  };
  const openSegment = (segment: SegmentKey) => {
    setIsDetailOpen(true);
    setActiveSegment(segment);
    setEditingItemId(null);
    setEditingPensionMonth(null);
  };
  const showTemplate = (kind: TemplateKind) => {
    setTemplateKind(kind);
    resetInstallments(kind);
    setIsAddMenuOpen(false);
    setIsDetailOpen(true);
  };
  const addBlankItem = () => {
    updateScenario((s) =>
      addTaxSocialPaymentScheduleItem(
        s,
        createTaxSocialPaymentScheduleItem({
          name: "通知書実額支払",
          category: categoryFromSegment(activeSegment),
          dueYearMonth: s.userProfile.simulationStartYearMonth,
          amount: 0,
          fiscalYear: Number(s.userProfile.simulationStartYearMonth.slice(0, 4)),
          source: "notice",
        }),
      ),
    );
    setIsAddMenuOpen(false);
    setIsDetailOpen(true);
  };
  const addTemplateItems = () => {
    if (!templateKind) return;
    updateScenario((s) => {
      if (templateKind === "nationalPension") {
        const member = s.householdMembers.find((item) => item.id === nationalPensionMemberId);
        const items = buildNationalPensionMonthlyScheduleItems({
          coveredMemberId: nationalPensionMemberId || undefined,
          coveredMemberName: member?.name,
          startYearMonth: nationalPensionStart,
          endYearMonth: nationalPensionEnd,
          amount: nationalPensionAmount,
          fiscalYear: templateFiscalYear,
          note: nationalPensionNote || undefined,
        });
        items.forEach((item) => addTaxSocialPaymentScheduleItem(s, item));
        return;
      }
      const items = buildInstallmentTaxSocialPaymentScheduleItems({
        category: templateKind,
        fiscalYear: templateFiscalYear,
        incomeYear: templateKind === "residentTax" ? templateIncomeYear : undefined,
        namePrefix: categoryLabels[templateKind],
        installments,
        source: "notice",
      });
      items.forEach((item) => addTaxSocialPaymentScheduleItem(s, item));
      if (templateKind === "propertyTax" && propertyRecurring) {
        s.recurringTaxSocialPaymentTemplates = [
          ...(s.recurringTaxSocialPaymentTemplates ?? []),
          buildPropertyTaxRecurringTemplate({
            fiscalYear: templateFiscalYear,
            startYearMonth: defaultYearMonth(templateFiscalYear + 1, 6),
            installments,
            note: "画面入力した固定資産税・都市計画税を翌年度以降も同じ期別で継続する見込み。",
          }),
        ];
      }
    });
    setTemplateKind(null);
  };
  const applyPensionRange = (yearMonth: YearMonth, mode: "reducedUntil" | "standardFrom") => {
    if (!reducedPensionAmount || !standardPensionAmount) return;
    updateScenario((s) => {
      for (const item of s.taxSocialPaymentSchedule ?? []) {
        if (item.category !== "nationalPension") continue;
        const inRange = mode === "reducedUntil" ? item.dueYearMonth <= yearMonth : item.dueYearMonth >= yearMonth;
        if (!inRange) continue;
        item.amount = mode === "reducedUntil" ? reducedPensionAmount : standardPensionAmount;
        const label = item.coveredMemberId === selfMember?.id ? "本人" : item.coveredMemberId === spouseMember?.id ? "配偶者" : memberLabel(s, item.coveredMemberId);
        item.name = mode === "reducedUntil" ? `国民年金 減免月 ${label} ${item.dueYearMonth}` : `国民年金 通常月 ${label} ${item.dueYearMonth}`;
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-slate-50 px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-medium">通知書明細の確認</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {hasNationalPensionReview
                ? "国民年金の減免月だけ確認してください。7月まで減免額、8月以降が通常額になっていれば完了です。"
                : "明細はカテゴリ別テーブルで確認し、編集したい1件だけフォームを開きます。"}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {categoryTotals.map((item) => (
                <span key={item.category} className="rounded-full border bg-white px-2 py-1 text-slate-700">
                  {categoryShortLabels[item.category]} {item.count}件 / {yen(item.total)}
                </span>
              ))}
              <span className={reviewCount > 0 ? "rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900" : "rounded-full border bg-white px-2 py-1 text-slate-700"}>
                要確認 {reviewCount}件
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => openSegment("nationalPension")}>
              国民年金だけ確認
            </Button>
            <Button type="button" variant="outline" onClick={() => openSegment("all")}>
              全明細を見る
            </Button>
            <div className="relative">
              <Button type="button" onClick={() => setIsAddMenuOpen((current) => !current)}>
                <Plus className="h-4 w-4" />
                通知書を追加
              </Button>
              {isAddMenuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border bg-white p-2 text-sm shadow-lg">
                  <button type="button" className="block w-full rounded px-3 py-2 text-left hover:bg-slate-50" onClick={() => showTemplate("residentTax")}>
                    住民税4期を追加
                  </button>
                  <button type="button" className="block w-full rounded px-3 py-2 text-left hover:bg-slate-50" onClick={() => showTemplate("nationalHealthInsurance")}>
                    国保10期を追加
                  </button>
                  <button type="button" className="block w-full rounded px-3 py-2 text-left hover:bg-slate-50" onClick={() => showTemplate("nationalPension")}>
                    国民年金月別を追加
                  </button>
                  <button type="button" className="block w-full rounded px-3 py-2 text-left hover:bg-slate-50" onClick={() => showTemplate("propertyTax")}>
                    固定資産税4期を追加
                  </button>
                  <button type="button" className="block w-full rounded px-3 py-2 text-left hover:bg-slate-50" onClick={addBlankItem}>
                    明細を1件追加
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {templateKind && (
        <TemplateInputPanel
          templateKind={templateKind}
          templateFiscalYear={templateFiscalYear}
          templateIncomeYear={templateIncomeYear}
          installments={installments}
          memberOptions={memberOptions}
          nationalPensionMemberId={nationalPensionMemberId}
          nationalPensionStart={nationalPensionStart}
          nationalPensionEnd={nationalPensionEnd}
          nationalPensionAmount={nationalPensionAmount}
          nationalPensionNote={nationalPensionNote}
          propertyRecurring={propertyRecurring}
          onTemplateKindChange={(kind) => {
            setTemplateKind(kind);
            resetInstallments(kind);
          }}
          onFiscalYearChange={(fiscalYear) => {
            setTemplateFiscalYear(fiscalYear);
            resetInstallments(templateKind, fiscalYear);
          }}
          onIncomeYearChange={setTemplateIncomeYear}
          onInstallmentsChange={setInstallments}
          onNationalPensionMemberIdChange={setNationalPensionMemberId}
          onNationalPensionStartChange={setNationalPensionStart}
          onNationalPensionEndChange={setNationalPensionEnd}
          onNationalPensionAmountChange={setNationalPensionAmount}
          onNationalPensionNoteChange={setNationalPensionNote}
          onPropertyRecurringChange={setPropertyRecurring}
          onAdd={addTemplateItems}
          onCancel={() => setTemplateKind(null)}
        />
      )}

      <details open={isDetailOpen} onToggle={(event) => setIsDetailOpen(event.currentTarget.open)} className="rounded-lg border bg-white px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="font-medium">明細を確認・編集</span>
          <span className="text-sm text-muted-foreground">{schedule.length}件登録中。編集フォームは選択した1件だけ開きます。</span>
        </summary>
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {segmentOptions.map((segment) => (
              <button
                key={segment.key}
                type="button"
                className={`rounded-full border px-3 py-1 text-sm ${
                  activeSegment === segment.key ? "border-sky-700 bg-sky-700 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
                onClick={() => {
                  setActiveSegment(segment.key);
                  setEditingItemId(null);
                  setEditingPensionMonth(null);
                }}
              >
                {segment.label}
              </button>
            ))}
          </div>

          {(activeSegment === "all" || activeSegment === "nationalPension") && (
            <NationalPensionMatrix
              rows={pensionRows}
              selfName={selfMember?.name ?? "本人"}
              spouseName={spouseMember?.name ?? "配偶者"}
              editingMonth={editingPensionMonth}
              updateScenario={updateScenario}
              onEditMonth={(yearMonth) => {
                setEditingPensionMonth(editingPensionMonth === yearMonth ? null : yearMonth);
                setEditingItemId(null);
              }}
              onReducedUntil={(yearMonth) => applyPensionRange(yearMonth, "reducedUntil")}
              onStandardFrom={(yearMonth) => applyPensionRange(yearMonth, "standardFrom")}
            />
          )}

          {activeSegment === "all" ? (
            <div className="space-y-4">
              {(["residentTax", "nationalHealthInsurance", "propertyTax"] as TaxSocialPaymentCategory[]).map((category) => (
                <NoticePaymentTable
                  key={category}
                  title={categoryLabels[category]}
                  scenario={scenario}
                  items={schedule.filter((item) => item.category === category)}
                  editingItemId={editingItemId}
                  updateScenario={updateScenario}
                  onEdit={setEditingItemId}
                />
              ))}
              <NoticePaymentTable
                title="その他"
                scenario={scenario}
                items={schedule.filter((item) => otherCategories.includes(item.category))}
                editingItemId={editingItemId}
                updateScenario={updateScenario}
                onEdit={setEditingItemId}
              />
            </div>
          ) : activeSegment !== "nationalPension" ? (
            <NoticePaymentTable
              title={segmentOptions.find((segment) => segment.key === activeSegment)?.label ?? "明細"}
              scenario={scenario}
              items={visibleNonPension}
              editingItemId={editingItemId}
              updateScenario={updateScenario}
              onEdit={setEditingItemId}
            />
          ) : null}

          <p className="text-xs text-muted-foreground">
            比較シナリオにも同じ通知書前提を使う場合は、このカード下の「他シナリオへ反映」からコピーしてください。
          </p>
        </div>
      </details>
    </div>
  );
}

function TemplateInputPanel({
  templateKind,
  templateFiscalYear,
  templateIncomeYear,
  installments,
  memberOptions,
  nationalPensionMemberId,
  nationalPensionStart,
  nationalPensionEnd,
  nationalPensionAmount,
  nationalPensionNote,
  propertyRecurring,
  onTemplateKindChange,
  onFiscalYearChange,
  onIncomeYearChange,
  onInstallmentsChange,
  onNationalPensionMemberIdChange,
  onNationalPensionStartChange,
  onNationalPensionEndChange,
  onNationalPensionAmountChange,
  onNationalPensionNoteChange,
  onPropertyRecurringChange,
  onAdd,
  onCancel,
}: {
  templateKind: TemplateKind;
  templateFiscalYear: number;
  templateIncomeYear: number;
  installments: TaxSocialPaymentInstallmentInput[];
  memberOptions: Array<{ id: string; name: string }>;
  nationalPensionMemberId: string;
  nationalPensionStart: YearMonth;
  nationalPensionEnd: YearMonth;
  nationalPensionAmount: number;
  nationalPensionNote: string;
  propertyRecurring: boolean;
  onTemplateKindChange: (kind: TemplateKind) => void;
  onFiscalYearChange: (fiscalYear: number) => void;
  onIncomeYearChange: (incomeYear: number) => void;
  onInstallmentsChange: (items: TaxSocialPaymentInstallmentInput[]) => void;
  onNationalPensionMemberIdChange: (memberId: string) => void;
  onNationalPensionStartChange: (yearMonth: YearMonth) => void;
  onNationalPensionEndChange: (yearMonth: YearMonth) => void;
  onNationalPensionAmountChange: (amount: number) => void;
  onNationalPensionNoteChange: (note: string) => void;
  onPropertyRecurringChange: (enabled: boolean) => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-medium">通知書を追加</div>
          <p className="text-sm text-muted-foreground">選んだテンプレートだけ入力欄を表示します。</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            追加
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            閉じる
          </Button>
        </div>
      </div>
      <div className="mt-3">
        <FormGrid>
          <Field label="テンプレート">
            <Select value={templateKind} onChange={(event) => onTemplateKindChange(event.target.value as TemplateKind)}>
              {Object.entries(templateLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="年度">
            <Input type="number" value={templateFiscalYear} onChange={(event) => onFiscalYearChange(numberOrZero(event.target.value))} />
          </Field>
          {templateKind === "residentTax" && (
            <Field label="所得年">
              <Input type="number" value={templateIncomeYear} onChange={(event) => onIncomeYearChange(numberOrZero(event.target.value))} />
            </Field>
          )}
          {templateKind === "propertyTax" && (
            <Field label="翌年度以降の継続">
              <Select value={propertyRecurring ? "yes" : "no"} onChange={(event) => onPropertyRecurringChange(event.target.value === "yes")}>
                <option value="no">作らない</option>
                <option value="yes">同じ期別で作る</option>
              </Select>
            </Field>
          )}
        </FormGrid>
      </div>
      {templateKind === "nationalPension" ? (
        <div className="mt-3">
          <FormGrid>
            <Field label="対象者">
              <Select value={nationalPensionMemberId} onChange={(event) => onNationalPensionMemberIdChange(event.target.value)}>
                <option value="">世帯共通</option>
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="開始月">
              <Input type="month" value={nationalPensionStart} onChange={(event) => onNationalPensionStartChange(event.target.value as YearMonth)} />
            </Field>
            <Field label="終了月">
              <Input type="month" value={nationalPensionEnd} onChange={(event) => onNationalPensionEndChange(event.target.value as YearMonth)} />
            </Field>
            <Field label="月額">
              <Input type="number" value={nationalPensionAmount} onChange={(event) => onNationalPensionAmountChange(numberOrZero(event.target.value))} />
            </Field>
            <Field label="メモ">
              <Input value={nationalPensionNote} onChange={(event) => onNationalPensionNoteChange(event.target.value)} placeholder="要確認など" />
            </Field>
          </FormGrid>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {installments.map((installment, index) => (
            <div key={`${installment.label}-${index}`} className="grid gap-2 md:grid-cols-[1fr_10rem_10rem]">
              <Input
                value={installment.label ?? ""}
                onChange={(event) => onInstallmentsChange(updateInstallment(installments, index, (item) => ({ ...item, label: event.target.value })))}
                placeholder="期別"
              />
              <Input
                type="month"
                value={installment.dueYearMonth}
                onChange={(event) => onInstallmentsChange(updateInstallment(installments, index, (item) => ({ ...item, dueYearMonth: event.target.value as YearMonth })))}
              />
              <Input
                type="number"
                value={installment.amount}
                onChange={(event) => onInstallmentsChange(updateInstallment(installments, index, (item) => ({ ...item, amount: numberOrZero(event.target.value) })))}
                placeholder="金額"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NationalPensionMatrix({
  rows,
  selfName,
  spouseName,
  editingMonth,
  updateScenario,
  onEditMonth,
  onReducedUntil,
  onStandardFrom,
}: {
  rows: Array<{
    yearMonth: YearMonth;
    items: TaxSocialPaymentScheduleItem[];
    selfItem?: TaxSocialPaymentScheduleItem;
    spouseItem?: TaxSocialPaymentScheduleItem;
    status: string;
  }>;
  selfName: string;
  spouseName: string;
  editingMonth: YearMonth | null;
  updateScenario: (updater: (scenario: ScenarioData) => void) => void;
  onEditMonth: (yearMonth: YearMonth) => void;
  onReducedUntil: (yearMonth: YearMonth) => void;
  onStandardFrom: (yearMonth: YearMonth) => void;
}) {
  if (rows.length === 0) return null;
  const updateAmount = (item: TaxSocialPaymentScheduleItem | undefined, amount: number) => {
    if (!item) return;
    updateScenario((scenario) =>
      updateTaxSocialPaymentScheduleItem(scenario, item.id, (target) => {
        target.amount = amount;
      }),
    );
  };
  return (
    <div className="rounded-lg border bg-slate-50 px-4 py-3">
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h4 className="font-medium">国民年金 月別確認</h4>
          <p className="text-sm text-muted-foreground">本人・配偶者の月別金額だけを横並びで確認します。</p>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto rounded-md border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">支払月</th>
              <th className="px-3 py-2 text-right font-medium">{selfName}</th>
              <th className="px-3 py-2 text-right font-medium">{spouseName}</th>
              <th className="px-3 py-2 font-medium">状態</th>
              <th className="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <>
                <tr key={row.yearMonth} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2">{row.yearMonth}</td>
                  <td className="px-3 py-2 text-right">{row.selfItem ? yen(row.selfItem.amount) : "-"}</td>
                  <td className="px-3 py-2 text-right">{row.spouseItem ? yen(row.spouseItem.amount) : "-"}</td>
                  <td className="px-3 py-2">
                    <span className={row.status === "要確認" ? "rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800" : "text-slate-700"}>{row.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => onEditMonth(row.yearMonth)}>
                        編集
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => onReducedUntil(row.yearMonth)}>
                        この月まで減免額にする
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => onStandardFrom(row.yearMonth)}>
                        この月から通常額に戻す
                      </Button>
                    </div>
                  </td>
                </tr>
                {editingMonth === row.yearMonth && (
                  <tr key={`${row.yearMonth}-edit`} className="border-t bg-sky-50/50">
                    <td colSpan={5} className="px-3 py-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label={`${selfName}の金額`}>
                          <Input
                            type="number"
                            value={row.selfItem?.amount ?? ""}
                            disabled={!row.selfItem}
                            onChange={(event) => updateAmount(row.selfItem, numberOrZero(event.target.value))}
                          />
                        </Field>
                        <Field label={`${spouseName}の金額`}>
                          <Input
                            type="number"
                            value={row.spouseItem?.amount ?? ""}
                            disabled={!row.spouseItem}
                            onChange={(event) => updateAmount(row.spouseItem, numberOrZero(event.target.value))}
                          />
                        </Field>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NoticePaymentTable({
  title,
  scenario,
  items,
  editingItemId,
  updateScenario,
  onEdit,
}: {
  title: string;
  scenario: ScenarioData;
  items: TaxSocialPaymentScheduleItem[];
  editingItemId: string | null;
  updateScenario: (updater: (scenario: ScenarioData) => void) => void;
  onEdit: (id: string | null) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border bg-white px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="font-medium">{title}</h4>
        <span className="text-sm text-muted-foreground">{items.length}件</span>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-slate-50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">支払月</th>
              <th className="px-3 py-2 font-medium">名称</th>
              <th className="px-3 py-2 font-medium">対象者</th>
              <th className="px-3 py-2 text-right font-medium">金額</th>
              <th className="px-3 py-2 font-medium">年度</th>
              <th className="px-3 py-2 font-medium">確認状態</th>
              <th className="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <>
                <tr key={item.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2">{item.dueYearMonth}</td>
                  <td className="max-w-[260px] truncate px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{memberLabel(scenario, item.coveredMemberId ?? item.memberId)}</td>
                  <td className="px-3 py-2 text-right">{yen(item.amount)}</td>
                  <td className="px-3 py-2">{item.fiscalYear ? `${item.fiscalYear}年度` : "-"}</td>
                  <td className="px-3 py-2">
                    {isReviewItem(item) ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">要確認</span> : "登録済み"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => onEdit(editingItemId === item.id ? null : item.id)}>
                        編集
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => updateScenario((s) => duplicateTaxSocialPaymentScheduleItem(s, item.id))}>
                        <Copy className="h-4 w-4" />
                        複製
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => updateScenario((s) => deleteTaxSocialPaymentScheduleItem(s, item.id))}>
                        <Trash2 className="h-4 w-4" />
                        削除
                      </Button>
                    </div>
                  </td>
                </tr>
                {editingItemId === item.id && (
                  <tr key={`${item.id}-edit`} className="border-t bg-sky-50/40">
                    <td colSpan={7} className="px-3 py-3">
                      <NoticePaymentScheduleItemEditor item={item} scenario={scenario} updateScenario={updateScenario} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NoticePaymentScheduleItemEditor({
  item,
  scenario,
  updateScenario,
}: {
  item: TaxSocialPaymentScheduleItem;
  scenario: ScenarioData;
  updateScenario: (updater: (scenario: ScenarioData) => void) => void;
}) {
  const memberOptions = scenario.householdMembers.map((member) => ({ id: member.id, name: member.name }));
  const updateItem = (updater: (target: TaxSocialPaymentScheduleItem) => void) =>
    updateScenario((targetScenario) => updateTaxSocialPaymentScheduleItem(targetScenario, item.id, updater));
  const setOptionalMemberId = (
    key: "memberId" | "coveredMemberId" | "deductionPayerMemberId",
    value: string,
  ) =>
    updateItem((target) => {
      target[key] = value || undefined;
    });

  return (
    <div className="rounded-md border bg-white px-3 py-3">
      <FormGrid>
        <Field label="名称">
          <Input value={item.name} onChange={(event) => updateItem((target) => { target.name = event.target.value; })} />
        </Field>
        <Field label="カテゴリ">
          <Select value={item.category} onChange={(event) => updateItem((target) => { target.category = event.target.value as TaxSocialPaymentCategory; })}>
            {taxSocialPaymentCategoryOrder.map((category) => (
              <option key={category} value={category}>
                {categoryLabels[category]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="支払月">
          <Input type="month" value={item.dueYearMonth} onChange={(event) => updateItem((target) => { target.dueYearMonth = event.target.value as YearMonth; })} />
        </Field>
        <Field label="金額">
          <Input type="number" value={item.amount} onChange={(event) => updateItem((target) => { target.amount = numberOrZero(event.target.value); })} />
        </Field>
        <Field label="対象者">
          <Select value={item.coveredMemberId ?? ""} onChange={(event) => setOptionalMemberId("coveredMemberId", event.target.value)}>
            <option value="">世帯共通</option>
            {memberOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
      </FormGrid>
      <details className="mt-3 rounded-md border bg-slate-50 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">詳細項目を開く</summary>
        <div className="mt-3">
          <FormGrid>
            <Field label="年度">
              <Input type="number" value={item.fiscalYear ?? ""} onChange={(event) => updateItem((target) => { target.fiscalYear = optionalNumber(event.target.value); })} />
            </Field>
            <Field label="所得年">
              <Input type="number" value={item.incomeYear ?? ""} onChange={(event) => updateItem((target) => { target.incomeYear = optionalNumber(event.target.value); })} />
            </Field>
            <Field label="支払者">
              <Select value={item.memberId ?? ""} onChange={(event) => setOptionalMemberId("memberId", event.target.value)}>
                <option value="">未指定</option>
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="控除対象者">
              <Select value={item.deductionPayerMemberId ?? ""} onChange={(event) => setOptionalMemberId("deductionPayerMemberId", event.target.value)}>
                <option value="">未指定</option>
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="登録元">
              <Select value={item.source ?? "notice"} onChange={(event) => updateItem((target) => { target.source = event.target.value as TaxSocialPaymentSource; })}>
                {noticePaymentSourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {sourceLabels[source]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="メモ">
              <Textarea value={item.note ?? ""} onChange={(event) => updateItem((target) => { target.note = event.target.value || undefined; })} />
            </Field>
          </FormGrid>
        </div>
      </details>
    </div>
  );
}
