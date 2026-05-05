import dayjs from "dayjs";
import type { RetirementIncomeEvent, RetirementIncomeEventType, ScenarioData } from "@/types";

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

export function getRetirementIncomeDeduction(years: number) {
  const serviceYears = Math.max(0, Math.floor(years));
  if (serviceYears <= 0) return 0;
  if (serviceYears <= 20) return Math.max(800_000, serviceYears * 400_000);
  return 8_000_000 + (serviceYears - 20) * 700_000;
}

export function calculateRetirementIncome(grossAmount: number, serviceYears: number) {
  const deduction = getRetirementIncomeDeduction(serviceYears);
  const retirementIncome = Math.max(0, Math.round((grossAmount - deduction) / 2));
  return {
    deduction,
    income: retirementIncome,
  };
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
  return Math.max(0, Math.ceil(overlapMonths / 12));
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
      serviceYears: Math.max(0, Math.round(event.idecoLumpSumContributionYears ?? 20)),
      serviceStartDate: undefined,
      serviceEndDate: undefined,
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

      const dateBasedOverlapYears = getDateRangeOverlapYears(current, prior);
      const estimatedOverlapYears = dateBasedOverlapYears ?? Math.min(current.serviceYears, prior.serviceYears);
      const baseDeduction = getRetirementIncomeDeduction(current.serviceYears);
      const estimatedOverlapDeduction = Math.min(baseDeduction, getRetirementIncomeDeduction(estimatedOverlapYears));
      const adjustedDeduction = Math.max(0, baseDeduction - estimatedOverlapDeduction);
      const estimatedIncomeBeforeAdjustment = calculateRetirementIncome(current.grossAmount, current.serviceYears).income;
      const estimatedIncomeAfterAdjustment = Math.max(0, Math.round((current.grossAmount - adjustedDeduction) / 2));
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
            ? "勤続/加入期間の日付が未入力のため、双方の年数の小さい方を重複候補として使った概算です。"
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
