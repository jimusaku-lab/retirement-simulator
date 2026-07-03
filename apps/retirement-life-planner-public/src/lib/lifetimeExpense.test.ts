import { describe, expect, it } from "vitest";
import { calculateLifetimeTotalExpenseSummary, formatLifetimeExpenseYen } from "@/lib/lifetimeExpense";

function row(ageYears: number, overrides: Partial<Parameters<typeof calculateLifetimeTotalExpenseSummary>[0]["monthly"][number]> = {}) {
  return {
    yearMonth: `2026-${String(ageYears).padStart(2, "0")}`,
    ageYears,
    livingExpenseTotal: 100,
    specialExpenseTotal: 10,
    taxInsuranceTotal: 20,
    capitalGainsTaxTotal: 3,
    idecoWithholdingTaxTotal: 4,
    idecoFeeTotal: 5,
    ...overrides,
  };
}

describe("calculateLifetimeTotalExpenseSummary", () => {
  it("指定年齢到達月までの生活費・税社保・特別支出だけを合計する", () => {
    const result = {
      monthly: [
        row(59, { livingExpenseTotal: 1000 }),
        row(60, { specialExpenseTotal: 500 }),
        row(61, { livingExpenseTotal: 9_999 }),
      ],
    };

    const summary = calculateLifetimeTotalExpenseSummary(result, 60);

    expect(summary.living).toBe(1_100);
    expect(summary.special).toBe(510);
    expect(summary.taxAndSocial).toBe(64);
    expect(summary.total).toBe(1_674);
    expect(summary.targetYearMonth).toBe("2026-60");
  });

  it("生涯総支出の1億円以上は億円単位で小数第2位まで表示する", () => {
    expect(formatLifetimeExpenseYen(202_853_960)).toBe("2.03億円");
    expect(formatLifetimeExpenseYen(100_000_000)).toBe("1.00億円");
    expect(formatLifetimeExpenseYen(99_990_000)).toBe("9,999万円");
  });
});
