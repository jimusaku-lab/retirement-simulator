import { describe, expect, it } from "vitest";
import { applyIncomeEventAmountInput, describeIncomeEventAmountConversion } from "@/lib/incomeEventAmountInput";
import { getIncomeForMonth } from "@/lib/simulation";
import type { IncomeEvent } from "@/types";

function incomeEvent(overrides: Partial<IncomeEvent> = {}): IncomeEvent {
  return {
    id: "income",
    memberId: "member-spouse",
    name: "配偶者給与",
    type: "salary",
    startYearMonth: "2026-01",
    endYearMonth: "2026-06",
    monthlyAmount: 100_000,
    taxTreatment: "taxable",
    ...overrides,
  };
}

describe("incomeEventAmountInput", () => {
  it("keeps existing monthly events as monthly input", () => {
    const event = incomeEvent({ amountInputMode: undefined, monthlyAmount: 100_000 });
    const conversion = describeIncomeEventAmountConversion(event);
    expect(conversion.monthlyEquivalent).toBe(100_000);
    expect(conversion.annualEquivalent).toBe(1_200_000);
    expect(getIncomeForMonth([event], "2026-01", 0)).toBe(100_000);
  });

  it("uses annual input as one twelfth in monthly cash flow", () => {
    const event = incomeEvent({ amountInputMode: "annual", monthlyAmount: 1_200_000, inputAmount: 1_200_000 });
    const conversion = describeIncomeEventAmountConversion(event);
    expect(conversion.monthlyEquivalent).toBe(100_000);
    expect(getIncomeForMonth([event], "2026-01", 0)).toBe(100_000);
  });

  it("converts a period total into an even monthly amount", () => {
    const event = incomeEvent();
    applyIncomeEventAmountInput(event, "periodTotal", 700_000);
    expect(event.inputAmount).toBe(700_000);
    expect(event.monthlyAmount).toBe(116_667);
    expect(describeIncomeEventAmountConversion(event).periodMonths).toBe(6);
    const total = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].reduce(
      (sum, month) => sum + getIncomeForMonth([event], month, 0),
      0,
    );
    expect(total).toBeCloseTo(700_000, -1);
  });

  it("combines first-half period total and second-half monthly events", () => {
    const actual = incomeEvent({ id: "actual", startYearMonth: "2026-01", endYearMonth: "2026-06" });
    applyIncomeEventAmountInput(actual, "periodTotal", 700_000);
    const forecast = incomeEvent({
      id: "forecast",
      startYearMonth: "2026-07",
      endYearMonth: "2026-12",
      monthlyAmount: 100_000,
      amountInputMode: "monthly",
    });
    const total = Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, "0")}`).reduce(
      (sum, month) => sum + getIncomeForMonth([actual, forecast], month, 0),
      0,
    );
    expect(total).toBeCloseTo(1_300_000, -1);
  });

  it("warns when period total has no end month", () => {
    const event = incomeEvent({ endYearMonth: undefined, amountInputMode: "periodTotal", inputAmount: 700_000, monthlyAmount: 0 });
    expect(describeIncomeEventAmountConversion(event).warning).toBe("期間合計で入力する場合は、終了年月を入れてください。");
  });
});
