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
  alreadyReceived: boolean;
  retirementIncomeDeductionUsed: boolean;
  withholdingTaxPaid: number;
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

export function getRetirementIncomeDeduction(years: number) {
  const serviceYears = Math.max(0, Math.floor(years));
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
    alreadyReceived: event.alreadyReceived ?? false,
    retirementIncomeDeductionUsed: event.retirementIncomeDeductionUsed ?? !!event.alreadyReceived,
    withholdingTaxPaid: Math.max(0, Math.round(event.withholdingTaxPaid ?? 0)),
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
      alreadyReceived: false,
      retirementIncomeDeductionUsed: true,
      withholdingTaxPaid: 0,
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
