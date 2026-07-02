import { createId } from "@/lib/id";
import type {
  RecurringTaxSocialPaymentTemplate,
  ScenarioData,
  TaxSocialPaymentCategory,
  TaxSocialPaymentScheduleItem,
  YearMonth,
} from "@/types";

export type TaxSocialPaymentInstallmentInput = {
  label?: string;
  dueYearMonth: YearMonth | "";
  amount: number;
};

export type TaxSocialPaymentSource = NonNullable<TaxSocialPaymentScheduleItem["source"]>;

export const noticePaymentSourceOptions: TaxSocialPaymentSource[] = ["notice", "manual", "autoAdjustment"];

export const taxSocialPaymentCategoryOrder: TaxSocialPaymentCategory[] = [
  "residentTax",
  "nationalHealthInsurance",
  "nationalPension",
  "lateElderlyMedical",
  "nursingCare",
  "propertyTax",
  "otherPublicCost",
];

function sortSchedule(schedule: TaxSocialPaymentScheduleItem[]) {
  schedule.sort(
    (a, b) =>
      a.dueYearMonth.localeCompare(b.dueYearMonth) ||
      a.category.localeCompare(b.category) ||
      a.name.localeCompare(b.name),
  );
}

export function createTaxSocialPaymentScheduleItem(
  input: Partial<TaxSocialPaymentScheduleItem> & Pick<TaxSocialPaymentScheduleItem, "category" | "dueYearMonth" | "amount">,
): TaxSocialPaymentScheduleItem {
  return {
    id: input.id ?? createId(),
    name: input.name?.trim() || "通知書実額支払",
    category: input.category,
    dueYearMonth: input.dueYearMonth,
    amount: Math.max(0, Math.round(input.amount)),
    fiscalYear: input.fiscalYear,
    incomeYear: input.incomeYear,
    memberId: input.memberId,
    coveredMemberId: input.coveredMemberId,
    deductionPayerMemberId: input.deductionPayerMemberId,
    source: input.source ?? "notice",
    note: input.note,
  };
}

export function addTaxSocialPaymentScheduleItem(scenario: ScenarioData, item: TaxSocialPaymentScheduleItem) {
  scenario.taxSocialPaymentSchedule = [...(scenario.taxSocialPaymentSchedule ?? []), item];
  sortSchedule(scenario.taxSocialPaymentSchedule);
}

export function updateTaxSocialPaymentScheduleItem(
  scenario: ScenarioData,
  id: string,
  updater: (item: TaxSocialPaymentScheduleItem) => void,
) {
  const schedule = [...(scenario.taxSocialPaymentSchedule ?? [])];
  const item = schedule.find((candidate) => candidate.id === id);
  if (!item) return;
  updater(item);
  item.amount = Math.max(0, Math.round(item.amount));
  item.name = item.name.trim() || "通知書実額支払";
  sortSchedule(schedule);
  scenario.taxSocialPaymentSchedule = schedule;
}

export function deleteTaxSocialPaymentScheduleItem(scenario: ScenarioData, id: string) {
  scenario.taxSocialPaymentSchedule = (scenario.taxSocialPaymentSchedule ?? []).filter((item) => item.id !== id);
}

export function duplicateTaxSocialPaymentScheduleItem(scenario: ScenarioData, id: string) {
  const source = (scenario.taxSocialPaymentSchedule ?? []).find((item) => item.id === id);
  if (!source) return;
  addTaxSocialPaymentScheduleItem(scenario, {
    ...structuredClone(source),
    id: createId(),
    name: `${source.name} コピー`,
  });
}

export function buildInstallmentTaxSocialPaymentScheduleItems({
  category,
  fiscalYear,
  incomeYear,
  namePrefix,
  installments,
  source = "notice",
  note,
}: {
  category: TaxSocialPaymentCategory;
  fiscalYear?: number;
  incomeYear?: number;
  namePrefix: string;
  installments: TaxSocialPaymentInstallmentInput[];
  source?: TaxSocialPaymentSource;
  note?: string;
}) {
  return installments
    .filter((installment) => installment.dueYearMonth && installment.amount > 0)
    .map((installment, index) =>
      createTaxSocialPaymentScheduleItem({
        name: `${namePrefix} ${installment.label || `第${index + 1}期`}`,
        category,
        dueYearMonth: installment.dueYearMonth as YearMonth,
        amount: installment.amount,
        fiscalYear,
        incomeYear,
        source,
        note,
      }),
    );
}

function addMonths(yearMonth: YearMonth, months: number): YearMonth {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  const date = new Date(year, month - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` as YearMonth;
}

export function buildNationalPensionMonthlyScheduleItems({
  coveredMemberId,
  coveredMemberName,
  startYearMonth,
  endYearMonth,
  amount,
  fiscalYear,
  note,
}: {
  coveredMemberId?: string;
  coveredMemberName?: string;
  startYearMonth: YearMonth;
  endYearMonth: YearMonth;
  amount: number;
  fiscalYear?: number;
  note?: string;
}) {
  if (endYearMonth < startYearMonth || amount <= 0) return [];
  const items: TaxSocialPaymentScheduleItem[] = [];
  for (let cursor = startYearMonth, index = 0; cursor <= endYearMonth; cursor = addMonths(cursor, 1), index += 1) {
    items.push(
      createTaxSocialPaymentScheduleItem({
        name: `国民年金 ${coveredMemberName ? `${coveredMemberName} ` : ""}${cursor}`,
        category: "nationalPension",
        dueYearMonth: cursor,
        amount,
        fiscalYear,
        coveredMemberId,
        source: "notice",
        note,
      }),
    );
    if (index > 240) break;
  }
  return items;
}

export function buildPropertyTaxRecurringTemplate({
  fiscalYear,
  startYearMonth,
  installments,
  annualIncreaseRate = 0,
  note,
}: {
  fiscalYear: number;
  startYearMonth: YearMonth;
  installments: TaxSocialPaymentInstallmentInput[];
  annualIncreaseRate?: number;
  note?: string;
}): RecurringTaxSocialPaymentTemplate {
  return {
    id: createId(),
    name: "固定資産税・都市計画税（通知書ベースで毎年継続）",
    category: "propertyTax",
    startFiscalYear: fiscalYear + 1,
    startYearMonth,
    annualIncreaseRate,
    source: "noticeBasedEstimate",
    note,
    items: installments
      .filter((installment) => installment.dueYearMonth && installment.amount > 0)
      .map((installment, index) => {
        const dueYear = Number(installment.dueYearMonth.slice(0, 4));
        return {
          dueMonth: Number(installment.dueYearMonth.slice(5, 7)),
          amount: Math.max(0, Math.round(installment.amount)),
          fiscalYearOffset: dueYear > fiscalYear ? 1 : 0,
          label: installment.label || `第${index + 1}期`,
        };
      }),
  };
}
