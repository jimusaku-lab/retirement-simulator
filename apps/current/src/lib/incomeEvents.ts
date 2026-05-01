import dayjs from "dayjs";
import type { IncomeEvent, ScenarioData, YearMonth } from "@/types";

const ym = (value: YearMonth) => dayjs(`${value}-01`);
export const IDECO_MONEX_PAYMENT_FEE = 440;
export const IDECO_MONEX_MONTHLY_FEE = 66;

function getBaseAmount(event: IncomeEvent) {
  return event.amountInputMode === "annual" ? event.monthlyAmount / 12 : event.monthlyAmount;
}

function getIdecoMonexPayoutIntervalMonths(paymentsPerYear: number) {
  return Math.max(1, Math.round(12 / paymentsPerYear));
}

function getNextEvenMonthYearMonth(value: YearMonth) {
  const date = ym(value);
  return date.month() % 2 === 1 ? value : date.add(1, "month").format("YYYY-MM");
}

export function isIdecoMonexPensionEvent(event: IncomeEvent) {
  return event.type === "pension" && event.sourceAssetKey === "ideco" && event.idecoPensionPayoutMode === "monexSchedule";
}

export function getIdecoMonexEstimatedPerPayment(scenario: ScenarioData, event: IncomeEvent) {
  if (!isIdecoMonexPensionEvent(event)) return getBaseAmount(event);
  const years = event.idecoPensionYears ?? 10;
  const paymentsPerYear = event.idecoPensionPaymentsPerYear ?? 6;
  const totalPayments = years * paymentsPerYear;
  if (totalPayments <= 0) return 0;
  return scenario.initialAssets.ideco / totalPayments;
}

export function getIdecoMonexFirstPayoutYearMonth(event: IncomeEvent) {
  if (!isIdecoMonexPensionEvent(event)) return event.startYearMonth;
  return getNextEvenMonthYearMonth(event.startYearMonth);
}

export function getIdecoMonexRemainingPayoutCount(event: IncomeEvent, yearMonth: YearMonth) {
  if (!isIdecoMonexPensionEvent(event)) return 0;
  const firstPayoutYearMonth = getIdecoMonexFirstPayoutYearMonth(event);
  const endYearMonth = getIdecoMonexEndYearMonth(event);
  if (!endYearMonth) return 0;
  if (yearMonth < firstPayoutYearMonth || yearMonth > endYearMonth) return 0;

  const paymentsPerYear = event.idecoPensionPaymentsPerYear ?? 6;
  const intervalMonths = getIdecoMonexPayoutIntervalMonths(paymentsPerYear);
  let count = 0;
  let cursor = ym(firstPayoutYearMonth);
  const end = ym(endYearMonth);

  while (cursor.isBefore(end) || cursor.isSame(end, "month")) {
    if (cursor.format("YYYY-MM") >= yearMonth) count += 1;
    cursor = cursor.add(intervalMonths, "month");
    if (count > 240) break;
  }

  return count;
}

export function getIdecoMonexRemainingActiveMonthCount(event: IncomeEvent, yearMonth: YearMonth) {
  if (!isIdecoMonexPensionEvent(event)) return 0;
  const firstPayoutYearMonth = getIdecoMonexFirstPayoutYearMonth(event);
  const endYearMonth = getIdecoMonexEndYearMonth(event);
  if (!endYearMonth) return 0;
  if (yearMonth < firstPayoutYearMonth || yearMonth > endYearMonth) return 0;
  return ym(endYearMonth).diff(ym(yearMonth), "month") + 1;
}

export function isIdecoMonexPayoutMonth(event: IncomeEvent, yearMonth: YearMonth) {
  if (!isIdecoMonexPensionEvent(event)) return false;
  const firstPayoutYearMonth = getIdecoMonexFirstPayoutYearMonth(event);
  const endYearMonth = getIdecoMonexEndYearMonth(event);
  if (!endYearMonth) return false;
  if (yearMonth < firstPayoutYearMonth || yearMonth > endYearMonth) return false;
  const paymentsPerYear = event.idecoPensionPaymentsPerYear ?? 6;
  const intervalMonths = getIdecoMonexPayoutIntervalMonths(paymentsPerYear);
  const diffMonths = ym(yearMonth).diff(ym(firstPayoutYearMonth), "month");
  return diffMonths >= 0 && diffMonths % intervalMonths === 0;
}

export function getIdecoMonexEndYearMonth(event: IncomeEvent) {
  if (!isIdecoMonexPensionEvent(event)) return event.endYearMonth;
  const years = event.idecoPensionYears ?? 10;
  const paymentsPerYear = event.idecoPensionPaymentsPerYear ?? 6;
  const totalPayments = years * paymentsPerYear;
  const intervalMonths = getIdecoMonexPayoutIntervalMonths(paymentsPerYear);
  return ym(getIdecoMonexFirstPayoutYearMonth(event)).add((totalPayments - 1) * intervalMonths, "month").format("YYYY-MM");
}

export function getIncomeEventAmountForMonth(
  event: IncomeEvent,
  yearMonth: YearMonth,
  scenario: ScenarioData,
  pensionAdjustmentRate = 0,
) {
  if (isIdecoMonexPensionEvent(event)) {
    const firstPayoutYearMonth = getIdecoMonexFirstPayoutYearMonth(event);
    const endYearMonth = getIdecoMonexEndYearMonth(event);
    if (yearMonth < firstPayoutYearMonth || (endYearMonth && yearMonth > endYearMonth)) return 0;
    if (!isIdecoMonexPayoutMonth(event, yearMonth)) return 0;
    return getIdecoMonexEstimatedPerPayment(scenario, event);
  }

  const base = getBaseAmount(event);
  if (event.type !== "pension" || pensionAdjustmentRate === 0) return base;
  const monthsFromStart = ym(yearMonth).diff(ym(scenario.userProfile.simulationStartYearMonth), "month");
  return base * Math.pow(1 + pensionAdjustmentRate, monthsFromStart / 12);
}
