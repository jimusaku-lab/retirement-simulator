import { useMemo, useRef, useState } from "react";
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
  type TaxSocialPaymentInstallmentInput,
  type TaxSocialPaymentSource,
} from "@/lib/taxSocialPaymentScheduleEditor";
import { numberOrZero, yen } from "@/lib/utils";
import type { ScenarioData, TaxSocialPaymentCategory, TaxSocialPaymentScheduleItem, YearMonth } from "@/types";

type TemplateKind = "residentTax" | "nationalHealthInsurance" | "nationalPension" | "propertyTax";
type CategoryFilter = TaxSocialPaymentCategory | "all";

const categoryLabels: Record<TaxSocialPaymentCategory, string> = {
  residentTax: "住民税",
  nationalHealthInsurance: "国民健康保険料",
  nationalPension: "国民年金",
  lateElderlyMedical: "後期高齢者医療",
  nursingCare: "介護保険",
  propertyTax: "固定資産税・都市計画税",
  otherPublicCost: "その他公的負担",
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

export function NoticePaymentScheduleEditor({
  scenario,
  updateScenario,
}: {
  scenario: ScenarioData;
  updateScenario: (updater: (scenario: ScenarioData) => void) => void;
}) {
  const baseYear = Number(scenario.userProfile.simulationStartYearMonth.slice(0, 4)) || new Date().getFullYear();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [templateKind, setTemplateKind] = useState<TemplateKind>("residentTax");
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
  const editorRef = useRef<HTMLDetailsElement>(null);

  const schedule = useMemo(
    () =>
      (scenario.taxSocialPaymentSchedule ?? [])
        .filter((item) => item.dueYearMonth && item.category)
        .sort((a, b) => a.dueYearMonth.localeCompare(b.dueYearMonth) || a.category.localeCompare(b.category)),
    [scenario.taxSocialPaymentSchedule],
  );
  const filteredSchedule = categoryFilter === "all" ? schedule : schedule.filter((item) => item.category === categoryFilter);
  const memberOptions = scenario.householdMembers.map((member) => ({ id: member.id, name: member.name }));
  const hasNationalPensionReview = schedule.some(
    (item) => item.category === "nationalPension" && (item.note?.includes("要確認") || item.note?.includes("確認")),
  );

  const resetInstallments = (kind = templateKind, fiscalYear = templateFiscalYear) => {
    setInstallments(createDefaultInstallments(kind, fiscalYear));
  };
  const openNationalPensionEditor = () => {
    setIsEditorOpen(true);
    setCategoryFilter("nationalPension");
    window.requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const addBlankItem = () => {
    updateScenario((s) =>
      addTaxSocialPaymentScheduleItem(
        s,
        createTaxSocialPaymentScheduleItem({
          name: "通知書実額支払",
          category: categoryFilter === "all" ? "residentTax" : categoryFilter,
          dueYearMonth: s.userProfile.simulationStartYearMonth,
          amount: 0,
          fiscalYear: Number(s.userProfile.simulationStartYearMonth.slice(0, 4)),
          source: "notice",
        }),
      ),
    );
    setIsEditorOpen(true);
  };
  const addTemplateItems = () => {
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
      const category = templateKind;
      const items = buildInstallmentTaxSocialPaymentScheduleItems({
        category,
        fiscalYear: templateFiscalYear,
        incomeYear: templateKind === "residentTax" ? templateIncomeYear : undefined,
        namePrefix: categoryLabels[category],
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
    setIsEditorOpen(true);
  };

  return (
    <div className="space-y-3">
      {hasNationalPensionReview && (
        <div className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-medium">国民年金の明細に確認メモがあります</div>
            <div className="text-xs">減免月数や支払月が確定したら、金額・メモをここで修正してください。</div>
          </div>
          <Button type="button" variant="outline" onClick={openNationalPensionEditor}>
            国民年金明細を確認
          </Button>
        </div>
      )}

      <details
        ref={editorRef}
        open={isEditorOpen}
        onToggle={(event) => setIsEditorOpen(event.currentTarget.open)}
        className="rounded-lg border bg-slate-50 px-4 py-3"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="font-medium">通知書明細を編集</span>
          <span className="text-sm text-muted-foreground">{schedule.length}件登録中</span>
        </summary>
        <div className="mt-4 space-y-5">
          <div className="rounded-md border bg-white px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h4 className="font-medium">テンプレートから追加</h4>
                <p className="text-sm text-muted-foreground">
                  通知書に書かれた納付月と金額を入れて追加します。固定資産税は将来継続見込みも同時に作れます。
                </p>
              </div>
              <Button type="button" onClick={addTemplateItems}>
                <Plus className="h-4 w-4" />
                テンプレートを追加
              </Button>
            </div>
            <div className="mt-3">
              <FormGrid>
                <Field label="テンプレート">
                  <Select
                    value={templateKind}
                    onChange={(event) => {
                      const nextKind = event.target.value as TemplateKind;
                      setTemplateKind(nextKind);
                      resetInstallments(nextKind, templateFiscalYear);
                    }}
                  >
                    {Object.entries(templateLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="年度">
                  <Input
                    type="number"
                    value={templateFiscalYear}
                    onChange={(event) => {
                      const fiscalYear = numberOrZero(event.target.value);
                      setTemplateFiscalYear(fiscalYear);
                      resetInstallments(templateKind, fiscalYear);
                    }}
                  />
                </Field>
                {templateKind === "residentTax" && (
                  <Field label="所得年">
                    <Input type="number" value={templateIncomeYear} onChange={(event) => setTemplateIncomeYear(numberOrZero(event.target.value))} />
                  </Field>
                )}
                {templateKind === "propertyTax" && (
                  <Field label="翌年度以降の継続">
                    <Select value={propertyRecurring ? "yes" : "no"} onChange={(event) => setPropertyRecurring(event.target.value === "yes")}>
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
                    <Select value={nationalPensionMemberId} onChange={(event) => setNationalPensionMemberId(event.target.value)}>
                      <option value="">世帯共通</option>
                      {memberOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="開始月">
                    <Input type="month" value={nationalPensionStart} onChange={(event) => setNationalPensionStart(event.target.value as YearMonth)} />
                  </Field>
                  <Field label="終了月">
                    <Input type="month" value={nationalPensionEnd} onChange={(event) => setNationalPensionEnd(event.target.value as YearMonth)} />
                  </Field>
                  <Field label="月額">
                    <Input type="number" value={nationalPensionAmount} onChange={(event) => setNationalPensionAmount(numberOrZero(event.target.value))} />
                  </Field>
                  <Field label="メモ">
                    <Input value={nationalPensionNote} onChange={(event) => setNationalPensionNote(event.target.value)} placeholder="要確認など" />
                  </Field>
                </FormGrid>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {installments.map((installment, index) => (
                  <div key={`${installment.label}-${index}`} className="grid gap-2 md:grid-cols-[1fr_10rem_10rem]">
                    <Input
                      value={installment.label ?? ""}
                      onChange={(event) => setInstallments((current) => updateInstallment(current, index, (item) => ({ ...item, label: event.target.value })))}
                      placeholder="期別"
                    />
                    <Input
                      type="month"
                      value={installment.dueYearMonth}
                      onChange={(event) =>
                        setInstallments((current) => updateInstallment(current, index, (item) => ({ ...item, dueYearMonth: event.target.value as YearMonth })))
                      }
                    />
                    <Input
                      type="number"
                      value={installment.amount}
                      onChange={(event) =>
                        setInstallments((current) => updateInstallment(current, index, (item) => ({ ...item, amount: numberOrZero(event.target.value) })))
                      }
                      placeholder="金額"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <Field label="表示カテゴリ">
              <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}>
                <option value="all">すべて</option>
                {taxSocialPaymentCategoryOrder.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="button" variant="outline" onClick={addBlankItem}>
              <Plus className="h-4 w-4" />
              明細を1件追加
            </Button>
          </div>

          <div className="space-y-3">
            {filteredSchedule.length === 0 ? (
              <p className="rounded-md border bg-white px-4 py-3 text-sm text-muted-foreground">表示対象の明細はありません。</p>
            ) : (
              filteredSchedule.map((item) => (
                <NoticePaymentScheduleItemEditor
                  key={item.id}
                  item={item}
                  memberOptions={memberOptions}
                  updateScenario={updateScenario}
                />
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            比較シナリオにも同じ通知書前提を使う場合は、このカード下の「他シナリオへ反映」からコピーしてください。
          </p>
        </div>
      </details>
    </div>
  );
}

function NoticePaymentScheduleItemEditor({
  item,
  memberOptions,
  updateScenario,
}: {
  item: TaxSocialPaymentScheduleItem;
  memberOptions: Array<{ id: string; name: string }>;
  updateScenario: (updater: (scenario: ScenarioData) => void) => void;
}) {
  const updateItem = (updater: (target: TaxSocialPaymentScheduleItem) => void) =>
    updateScenario((scenario) => {
      const target = (scenario.taxSocialPaymentSchedule ?? []).find((candidate) => candidate.id === item.id);
      if (!target) return;
      updater(target);
    });
  const setOptionalMemberId = (
    key: "memberId" | "coveredMemberId" | "deductionPayerMemberId",
    value: string,
  ) => updateItem((target) => {
    target[key] = value || undefined;
  });

  return (
    <div className="rounded-lg border bg-white px-4 py-3">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-medium">{item.name || "通知書実額支払"}</div>
          <div className="text-sm text-muted-foreground">
            {item.dueYearMonth} / {categoryLabels[item.category]} / {yen(item.amount)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => updateScenario((scenario) => duplicateTaxSocialPaymentScheduleItem(scenario, item.id))}>
            <Copy className="h-4 w-4" />
            複製
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => updateScenario((scenario) => deleteTaxSocialPaymentScheduleItem(scenario, item.id))}>
            <Trash2 className="h-4 w-4" />
            削除
          </Button>
        </div>
      </div>
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
        <Field label="年度">
          <Input type="number" value={item.fiscalYear ?? ""} onChange={(event) => updateItem((target) => { target.fiscalYear = optionalNumber(event.target.value); })} />
        </Field>
        <Field label="所得年">
          <Input type="number" value={item.incomeYear ?? ""} onChange={(event) => updateItem((target) => { target.incomeYear = optionalNumber(event.target.value); })} />
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
  );
}
