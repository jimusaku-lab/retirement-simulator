import dayjs from "dayjs";
import type { IncomeEvent, RetirementIncomeEvent, RetirementIncomeEventType, ScenarioData } from "@/types";

export type RetirementIncomeSource =
  | { kind: "incomeEvent"; eventId: string }
  | { kind: "retirementEvent"; eventId: string };

export type RetirementIncomeRecord = {
  id: string;
  memberId: string;
  memberName: string;
  name: string;
  type: RetirementIncomeEventType;
  paymentYearMonth: string;
  grossAmount: number;
  serviceYears: number;
  serviceStartDate?: string;
  serviceEndDate?: string;
  alreadyReceived: boolean;
  retirementIncomeDeductionUsed: boolean;
  withholdingTaxPaid: number;
  residentTaxMunicipalPaid: number;
  residentTaxPrefecturalPaid: number;
  note?: string;
  source: RetirementIncomeSource;
};

export type RetirementOverlapWarning = {
  id: string;
  memberId: string;
  memberName: string;
  currentEventName: string;
  currentEventType: RetirementIncomeEventType;
  currentPaymentYearMonth: string;
  priorEventName: string;
  priorEventType: RetirementIncomeEventType;
  priorPaymentYearMonth: string;
  gapMonths: number;
  requiredGapYears: number;
  ruleLabel: string;
  message: string;
  severity: "warning" | "info";
};

export type RetirementFilingAdvice = {
  id: string;
  memberId: string;
  memberName: string;
  eventName: string;
  paymentYearMonth: string;
  taxPaidTotal: number;
  status: "info" | "attention" | "review";
  message: string;
};

export type RetirementOverlapAdjustment = {
  id: string;
  memberId: string;
  memberName: string;
  currentSource: RetirementIncomeSource;
  priorSource: RetirementIncomeSource;
  currentEventName: string;
  priorEventName: string;
  currentPaymentYearMonth: string;
  priorPaymentYearMonth: string;
  baseDeduction: number;
  estimatedOverlapYears: number;
  estimatedOverlapDeduction: number;
  adjustedDeduction: number;
  estimatedIncomeBeforeAdjustment: number;
  estimatedIncomeAfterAdjustment: number;
  precision: "dateBased" | "serviceYearsOnly";
  note: string;
};

export type RetirementIncomeTaxBreakdown = {
  taxableRetirementIncome: number;
  nationalTax: number;
  municipalResidentTax: number;
  prefecturalResidentTax: number;
  residentTax: number;
  totalTax: number;
};

export function floorToThousand(value: number) {
  return Math.floor(Math.max(0, value) / 1_000) * 1_000;
}

export function floorToHundred(value: number) {
  return Math.floor(Math.max(0, value) / 100) * 100;
}

export function getRetirementIncomeDeduction(years: number) {
  const serviceYears = Math.max(0, Math.floor(years));
  if (serviceYears <= 0) return 0;
  if (serviceYears <= 20) return Math.max(800_000, serviceYears * 400_000);
  return 8_000_000 + (serviceYears - 20) * 700_000;
}

export function calculateRetirementIncomeWithDeduction(grossAmount: number, deduction: number) {
  const retirementIncome = floorToThousand((grossAmount - deduction) / 2);
  return {
    deduction,
    income: retirementIncome,
  };
}

export function calculateRetirementIncome(grossAmount: number, serviceYears: number) {
  return calculateRetirementIncomeWithDeduction(grossAmount, getRetirementIncomeDeduction(serviceYears));
}

export function calculateRetirementIncomeTax(taxableRetirementIncome: number): RetirementIncomeTaxBreakdown {
  if (taxableRetirementIncome <= 0) {
    return {
      taxableRetirementIncome: 0,
      nationalTax: 0,
      municipalResidentTax: 0,
      prefecturalResidentTax: 0,
      residentTax: 0,
      totalTax: 0,
    };
  }
  let baseIncomeTax = 0;
  if (taxableRetirementIncome <= 1_949_000) baseIncomeTax = taxableRetirementIncome * 0.05;
  else if (taxableRetirementIncome <= 3_299_000) baseIncomeTax = taxableRetirementIncome * 0.1 - 97_500;
  else if (taxableRetirementIncome <= 6_949_000) baseIncomeTax = taxableRetirementIncome * 0.2 - 427_500;
  else if (taxableRetirementIncome <= 8_999_000) baseIncomeTax = taxableRetirementIncome * 0.23 - 636_000;
  else if (taxableRetirementIncome <= 17_999_000) baseIncomeTax = taxableRetirementIncome * 0.33 - 1_536_000;
  else if (taxableRetirementIncome <= 39_999_000) baseIncomeTax = taxableRetirementIncome * 0.4 - 2_796_000;
  else baseIncomeTax = taxableRetirementIncome * 0.45 - 4_796_000;

  const nationalTax = Math.floor(Math.max(0, baseIncomeTax) * 1.021 + 0.000001);
  const municipalResidentTax = floorToHundred(taxableRetirementIncome * 0.06);
  const prefecturalResidentTax = floorToHundred(taxableRetirementIncome * 0.04);
  const residentTax = municipalResidentTax + prefecturalResidentTax;
  return {
    taxableRetirementIncome,
    nationalTax,
    municipalResidentTax,
    prefecturalResidentTax,
    residentTax,
    totalTax: nationalTax + residentTax,
  };
}

export function calculateRetirementIncomeTaxFromGross(grossAmount: number, deduction: number) {
  return calculateRetirementIncomeTax(calculateRetirementIncomeWithDeduction(grossAmount, deduction).income);
}

export function getInclusiveMonthCount(startDate: string | undefined, endDate: string | undefined) {
  if (!startDate || !endDate) return null;
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  if (!start.isValid() || !end.isValid() || end.isBefore(start, "day")) return null;
  return end.startOf("month").diff(start.startOf("month"), "month") + 1;
}

export function getIdecoLumpSumContributionYears(
  event: Pick<
    IncomeEvent,
    "idecoLumpSumContributionMonths" | "idecoLumpSumContributionYears" | "idecoLumpSumContributionStartDate" | "idecoLumpSumContributionEndDate"
  >,
  fallbackYears = 20,
) {
  const monthsFromDates = getInclusiveMonthCount(event.idecoLumpSumContributionStartDate, event.idecoLumpSumContributionEndDate);
  if (monthsFromDates !== null) return Math.max(0, Math.ceil(monthsFromDates / 12));
  if (Number.isFinite(event.idecoLumpSumContributionMonths) && (event.idecoLumpSumContributionMonths ?? 0) > 0) {
    return Math.ceil((event.idecoLumpSumContributionMonths ?? 0) / 12);
  }
  return Math.max(0, Math.ceil(event.idecoLumpSumContributionYears ?? fallbackYears));
}

function toDate(yearMonth: string) {
  return dayjs(`${yearMonth}-01`);
}

function monthDiff(currentYearMonth: string, priorYearMonth: string) {
  return toDate(currentYearMonth).diff(toDate(priorYearMonth), "month");
}

function getDateRangeOverlapYears(current: RetirementIncomeRecord, prior: RetirementIncomeRecord) {
  if (!current.serviceStartDate || !current.serviceEndDate || !prior.serviceStartDate || !prior.serviceEndDate) return null;
  const currentStart = dayjs(current.serviceStartDate);
  const currentEnd = dayjs(current.serviceEndDate);
  const priorStart = dayjs(prior.serviceStartDate);
  const priorEnd = dayjs(prior.serviceEndDate);
  if (!currentStart.isValid() || !currentEnd.isValid() || !priorStart.isValid() || !priorEnd.isValid()) return null;

  const overlapStart = currentStart.isAfter(priorStart) ? currentStart : priorStart;
  const overlapEnd = currentEnd.isBefore(priorEnd) ? currentEnd : priorEnd;
  if (overlapEnd.isBefore(overlapStart, "day")) return 0;

  const overlapMonths = overlapEnd.startOf("month").diff(overlapStart.startOf("month"), "month") + 1;
  return Math.max(0, Math.floor(overlapMonths / 12));
}

function isIdecoType(type: RetirementIncomeEventType) {
  return type === "idecoLumpSum";
}

function getRuleDetails(currentType: RetirementIncomeEventType, priorType: RetirementIncomeEventType) {
  if (currentType === priorType) {
    return { requiredGapYears: 4, ruleLabel: "同一年合算/通常4年ルール", severity: "warning" as const };
  }
  if (isIdecoType(priorType) && !isIdecoType(currentType)) {
    return { requiredGapYears: 10, ruleLabel: "iDeCo先取り後の退職金ルール", severity: "warning" as const };
  }
  if (!isIdecoType(priorType) && isIdecoType(currentType)) {
    return { requiredGapYears: 20, ruleLabel: "退職金先取り後のiDeCoルール", severity: "warning" as const };
  }
  return { requiredGapYears: 4, ruleLabel: "通常退職所得の重複ルール", severity: "warning" as const };
}

function sortRetirementEvents(events: RetirementIncomeRecord[]) {
  return [...events].sort((a, b) => {
    if (a.memberId !== b.memberId) return a.memberId.localeCompare(b.memberId);
    if (a.paymentYearMonth !== b.paymentYearMonth) return a.paymentYearMonth.localeCompare(b.paymentYearMonth);
    return a.name.localeCompare(b.name);
  });
}

export function buildRetirementIncomeRecords(scenario: ScenarioData): RetirementIncomeRecord[] {
  const memberMap = new Map(scenario.householdMembers.map((member) => [member.id, member.name]));
  const configuredEvents = (scenario.retirementIncomeEvents ?? []).map<RetirementIncomeRecord>((event) => ({
    id: event.id,
    memberId: event.memberId,
    memberName: memberMap.get(event.memberId) ?? event.memberId,
    name: event.name,
    type: event.type,
    paymentYearMonth: event.paymentYearMonth,
    grossAmount: Math.max(0, Math.round(event.grossAmount)),
    serviceYears: Math.max(0, Math.round(event.serviceYears)),
    serviceStartDate: event.serviceStartDate,
    serviceEndDate: event.serviceEndDate,
    alreadyReceived: event.alreadyReceived ?? false,
    retirementIncomeDeductionUsed: event.retirementIncomeDeductionUsed ?? !!event.alreadyReceived,
    withholdingTaxPaid: Math.max(0, Math.round(event.withholdingTaxPaid ?? 0)),
    residentTaxMunicipalPaid: Math.max(0, Math.round(event.residentTaxMunicipalPaid ?? 0)),
    residentTaxPrefecturalPaid: Math.max(0, Math.round(event.residentTaxPrefecturalPaid ?? 0)),
    note: event.note,
    source: { kind: "retirementEvent", eventId: event.id },
  }));

  const idecoLumpSumEvents = scenario.incomeEvents
    .filter((event) => event.type === "oneTime" && event.sourceAssetKey === "ideco")
    .map<RetirementIncomeRecord>((event) => ({
      id: `income-${event.id}`,
      memberId: event.memberId,
      memberName: memberMap.get(event.memberId) ?? event.memberId,
      name: event.name,
      type: "idecoLumpSum",
      paymentYearMonth: event.startYearMonth,
      grossAmount: Math.max(0, Math.round(event.monthlyAmount)),
      serviceYears: getIdecoLumpSumContributionYears(event),
      serviceStartDate: event.idecoLumpSumContributionStartDate,
      serviceEndDate: event.idecoLumpSumContributionEndDate,
      alreadyReceived: false,
      retirementIncomeDeductionUsed: true,
      withholdingTaxPaid: 0,
      residentTaxMunicipalPaid: 0,
      residentTaxPrefecturalPaid: 0,
      note: event.note,
      source: { kind: "incomeEvent", eventId: event.id },
    }));

  return sortRetirementEvents([...configuredEvents, ...idecoLumpSumEvents]);
}

export function getRetirementOverlapWarnings(scenario: ScenarioData): RetirementOverlapWarning[] {
  const records = buildRetirementIncomeRecords(scenario);
  const warnings: RetirementOverlapWarning[] = [];

  for (let i = 0; i < records.length; i += 1) {
    const current = records[i];
    for (let j = 0; j < i; j += 1) {
      const prior = records[j];
      if (current.memberId !== prior.memberId) continue;

      const gapMonths = monthDiff(current.paymentYearMonth, prior.paymentYearMonth);
      if (gapMonths < 0) continue;

      const sameYear = toDate(current.paymentYearMonth).year() === toDate(prior.paymentYearMonth).year();
      const { requiredGapYears, ruleLabel, severity } = getRuleDetails(current.type, prior.type);
      const requiredGapMonths = requiredGapYears * 12;
      const needsWarning = sameYear || gapMonths < requiredGapMonths;
      if (!needsWarning) continue;

      const message =
        sameYear
          ? `${current.memberName} の ${current.name} と ${prior.name} が同一年に並んでいます。退職所得は同一年合算の対象です。`
          : `${current.memberName} の ${current.name} は ${prior.name} から ${Math.floor(gapMonths / 12)}年${gapMonths % 12}か月で、${ruleLabel} の注意対象です。`;

      warnings.push({
        id: `${current.id}-${prior.id}`,
        memberId: current.memberId,
        memberName: current.memberName,
        currentEventName: current.name,
        currentEventType: current.type,
        currentPaymentYearMonth: current.paymentYearMonth,
        priorEventName: prior.name,
        priorEventType: prior.type,
        priorPaymentYearMonth: prior.paymentYearMonth,
        gapMonths,
        requiredGapYears,
        ruleLabel,
        message,
        severity,
      });
    }
  }

  return warnings;
}

export function summarizeRetirementIncomeWarnings(warnings: RetirementOverlapWarning[]) {
  const severe = warnings.filter((warning) => warning.severity === "warning");
  return {
    count: warnings.length,
    severeCount: severe.length,
    messages: warnings.map((warning) => warning.message),
  };
}

export function getRetirementOverlapAdjustments(scenario: ScenarioData): RetirementOverlapAdjustment[] {
  const records = buildRetirementIncomeRecords(scenario);
  const adjustments: RetirementOverlapAdjustment[] = [];

  for (let i = 0; i < records.length; i += 1) {
    const current = records[i];
    for (let j = 0; j < i; j += 1) {
      const prior = records[j];
      if (current.memberId !== prior.memberId) continue;

      const gapMonths = monthDiff(current.paymentYearMonth, prior.paymentYearMonth);
      if (gapMonths < 0) continue;

      const sameYear = toDate(current.paymentYearMonth).year() === toDate(prior.paymentYearMonth).year();
      const { requiredGapYears } = getRuleDetails(current.type, prior.type);
      const needsAdjustment = sameYear || gapMonths < requiredGapYears * 12;
      if (!needsAdjustment) continue;
      if (!current.retirementIncomeDeductionUsed || !prior.retirementIncomeDeductionUsed) continue;

      const dateBasedOverlapYears = getDateRangeOverlapYears(current, prior);
      const estimatedOverlapYears = dateBasedOverlapYears ?? Math.min(current.serviceYears, prior.serviceYears);
      const baseDeduction = getRetirementIncomeDeduction(current.serviceYears);
      const estimatedOverlapDeduction = Math.min(baseDeduction, getRetirementIncomeDeduction(estimatedOverlapYears));
      const adjustedDeduction = Math.max(0, baseDeduction - estimatedOverlapDeduction);
      const estimatedIncomeBeforeAdjustment = calculateRetirementIncome(current.grossAmount, current.serviceYears).income;
        const estimatedIncomeAfterAdjustment = calculateRetirementIncomeWithDeduction(current.grossAmount, adjustedDeduction).income;
      const priorBaseDeduction = getRetirementIncomeDeduction(prior.serviceYears);
      const priorUnderUsed = prior.grossAmount > 0 && prior.grossAmount < priorBaseDeduction;

      adjustments.push({
        id: `${current.id}-${prior.id}`,
        memberId: current.memberId,
        memberName: current.memberName,
        currentSource: current.source,
        priorSource: prior.source,
        currentEventName: current.name,
        priorEventName: prior.name,
        currentPaymentYearMonth: current.paymentYearMonth,
        priorPaymentYearMonth: prior.paymentYearMonth,
        baseDeduction,
        estimatedOverlapYears,
        estimatedOverlapDeduction,
        adjustedDeduction,
        estimatedIncomeBeforeAdjustment,
        estimatedIncomeAfterAdjustment,
        precision: dateBasedOverlapYears === null ? "serviceYearsOnly" : "dateBased",
        note: priorUnderUsed
          ? "前回の退職手当等が前回控除額未満のため、実際の調整額はこの概算より小さくなる可能性があります。"
          : dateBasedOverlapYears === null
            ? "勤続/加入年数は使っていますが、開始日・終了日が片方でも未入力のため、双方の年数の小さい方を重複年数として使った概算です。iDeCo一時金の加入開始日/終了日と、退職所得履歴の勤続開始日/終了日を入れると期間入力ベースになります。"
            : "勤続/加入期間の日付から重複期間を概算しています。",
      });
    }
  }

  return adjustments;
}

export function getRetirementFilingAdvice(scenario: ScenarioData): RetirementFilingAdvice[] {
  const records = buildRetirementIncomeRecords(scenario);
  const warnings = getRetirementOverlapWarnings(scenario);
  const warningEventIds = new Set(
    warnings.flatMap((warning) => {
      const currentRecord = records.find(
        (record) =>
          record.memberId === warning.memberId &&
          record.name === warning.currentEventName &&
          record.paymentYearMonth === warning.currentPaymentYearMonth,
      );
      const priorRecord = records.find(
        (record) =>
          record.memberId === warning.memberId &&
          record.name === warning.priorEventName &&
          record.paymentYearMonth === warning.priorPaymentYearMonth,
      );
      return [currentRecord?.id, priorRecord?.id].filter(Boolean) as string[];
    }),
  );

  return records.map((record) => {
    const taxPaidTotal = record.withholdingTaxPaid + record.residentTaxMunicipalPaid + record.residentTaxPrefecturalPaid;
    const hasOverlapWarning = warningEventIds.has(record.id);
    const hasTaxPayment = taxPaidTotal > 0;

    if (hasTaxPayment) {
      return {
        id: record.id,
        memberId: record.memberId,
        memberName: record.memberName,
        eventName: record.name,
        paymentYearMonth: record.paymentYearMonth,
        taxPaidTotal,
        status: "attention" as const,
        message: `${record.memberName} の ${record.name} は源泉徴収税額と住民税内訳を記録済みです。実績照合用のメモとして保持してください。`,
      };
    }

    if (hasOverlapWarning) {
      return {
        id: record.id,
        memberId: record.memberId,
        memberName: record.memberName,
        eventName: record.name,
        paymentYearMonth: record.paymentYearMonth,
        taxPaidTotal,
        status: "review" as const,
        message: `${record.memberName} の ${record.name} は退職所得の重複ルール警告に該当します。申告や控除の確認対象です。`,
      };
    }

    return {
      id: record.id,
      memberId: record.memberId,
      memberName: record.memberName,
      eventName: record.name,
      paymentYearMonth: record.paymentYearMonth,
      taxPaidTotal,
      status: "info" as const,
      message: `${record.memberName} の ${record.name} は確認用の退職所得記録です。`,
    };
  });
}
