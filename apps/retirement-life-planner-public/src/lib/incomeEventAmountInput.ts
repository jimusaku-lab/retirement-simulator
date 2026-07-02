import dayjs from "dayjs";
import type { IncomeEvent, YearMonth } from "@/types";

export type IncomeEventAmountInputMode = NonNullable<IncomeEvent["amountInputMode"]>;

export function countInclusiveMonths(startYearMonth: YearMonth | undefined, endYearMonth: YearMonth | undefined) {
  if (!startYearMonth || !endYearMonth) return 0;
  const start = dayjs(`${startYearMonth}-01`);
  const end = dayjs(`${endYearMonth}-01`);
  if (!start.isValid() || !end.isValid() || end.isBefore(start, "month")) return 0;
  return end.diff(start, "month") + 1;
}

export function getIncomeEventInputAmount(event: IncomeEvent) {
  if (event.amountInputMode === "periodTotal") return event.inputAmount ?? Math.round(event.monthlyAmount * countInclusiveMonths(event.startYearMonth, event.endYearMonth));
  return event.inputAmount ?? event.monthlyAmount;
}

export function convertIncomeEventInputToStoredMonthlyAmount(
  mode: IncomeEventAmountInputMode,
  inputAmount: number,
  startYearMonth: YearMonth,
  endYearMonth?: YearMonth,
) {
  const amount = Math.max(0, Math.round(inputAmount));
  if (mode === "annual") return amount;
  if (mode === "periodTotal") {
    const months = countInclusiveMonths(startYearMonth, endYearMonth);
    return months > 0 ? Math.round(amount / months) : 0;
  }
  return amount;
}

export function getIncomeEventMonthlyEquivalent(event: IncomeEvent) {
  if (event.amountInputMode === "annual") return Math.round((event.inputAmount ?? event.monthlyAmount) / 12);
  if (event.amountInputMode === "periodTotal") return event.monthlyAmount;
  return event.monthlyAmount;
}

export function describeIncomeEventAmountConversion(event: IncomeEvent) {
  const mode = event.amountInputMode ?? "monthly";
  const inputAmount = getIncomeEventInputAmount(event);
  if (mode === "annual") {
    return {
      mode,
      inputAmount,
      monthlyEquivalent: getIncomeEventMonthlyEquivalent(event),
      annualEquivalent: inputAmount,
      periodMonths: 12,
      warning: undefined as string | undefined,
    };
  }
  if (mode === "periodTotal") {
    const periodMonths = countInclusiveMonths(event.startYearMonth, event.endYearMonth);
    return {
      mode,
      inputAmount,
      monthlyEquivalent: getIncomeEventMonthlyEquivalent(event),
      annualEquivalent: event.monthlyAmount * periodMonths,
      periodMonths,
      warning: periodMonths <= 0 ? "期間合計で入力する場合は、終了年月を入れてください。" : undefined,
    };
  }
  return {
    mode,
    inputAmount,
    monthlyEquivalent: event.monthlyAmount,
    annualEquivalent: event.monthlyAmount * 12,
    periodMonths: 1,
    warning: undefined as string | undefined,
  };
}

export function applyIncomeEventAmountInput(event: IncomeEvent, mode: IncomeEventAmountInputMode, inputAmount: number) {
  event.amountInputMode = mode;
  event.inputAmount = Math.max(0, Math.round(inputAmount));
  event.monthlyAmount = convertIncomeEventInputToStoredMonthlyAmount(mode, event.inputAmount, event.startYearMonth, event.endYearMonth);
}
