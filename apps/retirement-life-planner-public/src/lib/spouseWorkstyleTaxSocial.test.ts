import { describe, expect, it } from "vitest";
import {
  getIncomeTaxBasicDeduction,
  getNationalHealthInsuranceBaseIncome,
  getOtaNhiEqualReduction,
  getSalaryIncomeForYear,
  getSpouseDeductionForIncomeTax,
  getSpouseDeductionForResidentTax,
  isOtaResidentTaxFullyNonTaxable,
  judgeWorkplaceSocialInsurance,
} from "@/lib/spouseWorkstyleTaxSocial";

describe("spouseWorkstyleTaxSocial", () => {
  it("uses the 2026 salary deduction and Ota NHI base boundary", () => {
    expect(getSalaryIncomeForYear(1_170_000, 2026)).toBe(430_000);
    expect(getNationalHealthInsuranceBaseIncome(getSalaryIncomeForYear(1_170_000, 2026))).toBe(0);
    expect(getNationalHealthInsuranceBaseIncome(getSalaryIncomeForYear(1_170_001, 2026))).toBe(1);
  });

  it("applies Ota/Tokyo 23 wards resident tax non-taxable limits", () => {
    expect(isOtaResidentTaxFullyNonTaxable(getSalaryIncomeForYear(1_190_000, 2026), 0)).toBe(true);
    expect(isOtaResidentTaxFullyNonTaxable(getSalaryIncomeForYear(1_190_001, 2026), 0)).toBe(false);
    expect(isOtaResidentTaxFullyNonTaxable(getSalaryIncomeForYear(1_750_000, 2026), 1)).toBe(true);
    expect(isOtaResidentTaxFullyNonTaxable(getSalaryIncomeForYear(1_750_001, 2026), 1)).toBe(false);
  });

  it("separates income tax and resident tax spouse deduction boundaries", () => {
    expect(getSpouseDeductionForIncomeTax(getSalaryIncomeForYear(1_360_000, 2026), 0, 2026)).toEqual({
      kind: "spouse",
      amount: 380_000,
    });
    expect(getSpouseDeductionForIncomeTax(getSalaryIncomeForYear(1_360_001, 2026), 0, 2026)).toEqual({
      kind: "special",
      amount: 380_000,
    });
    expect(getSpouseDeductionForIncomeTax(getSalaryIncomeForYear(1_690_000, 2026), 0, 2026).amount).toBe(380_000);
    expect(getSpouseDeductionForIncomeTax(getSalaryIncomeForYear(1_690_001, 2026), 0, 2026).amount).toBe(360_000);
    expect(getSpouseDeductionForResidentTax(getSalaryIncomeForYear(1_740_000, 2027), 0, 2027).amount).toBe(330_000);
    expect(getSpouseDeductionForResidentTax(getSalaryIncomeForYear(1_740_001, 2027), 0, 2027).amount).toBe(310_000);
    expect(getSpouseDeductionForIncomeTax(getSalaryIncomeForYear(2_070_001, 2026), 0, 2026).amount).toBe(0);
  });

  it("keeps 1.78m salary at zero income tax base before other deductions", () => {
    const incomeAtBoundary = getSalaryIncomeForYear(1_780_000, 2026);
    expect(incomeAtBoundary - getIncomeTaxBasicDeduction(incomeAtBoundary, 2026)).toBe(0);
    const incomeOverBoundary = getSalaryIncomeForYear(1_780_001, 2026);
    expect(incomeOverBoundary - getIncomeTaxBasicDeduction(incomeOverBoundary, 2026)).toBe(1);
  });

  it("judges workplace social insurance using 3/4 and short-time worker rules", () => {
    expect(
      judgeWorkplaceSocialInsurance(
        {
          isApplicableWorkplace: true,
          weeklyScheduledHours: 30,
          monthlyScheduledDays: 15,
          regularWorkerWeeklyHours: 40,
          regularWorkerMonthlyDays: 20,
          workplaceEmployeeCount: 1,
          isStudent: false,
          monthlyStandardWage: 50_000,
        },
        "2026-06",
      ).reason,
    ).toBe("threeQuarter");
    expect(
      judgeWorkplaceSocialInsurance(
        {
          isApplicableWorkplace: true,
          weeklyScheduledHours: 20,
          monthlyScheduledDays: 10,
          regularWorkerWeeklyHours: 40,
          regularWorkerMonthlyDays: 20,
          workplaceEmployeeCount: 50,
          isStudent: false,
          monthlyStandardWage: 88_000,
        },
        "2026-06",
      ).covered,
    ).toBe(false);
    expect(
      judgeWorkplaceSocialInsurance(
        {
          isApplicableWorkplace: true,
          weeklyScheduledHours: 20,
          monthlyScheduledDays: 10,
          regularWorkerWeeklyHours: 40,
          regularWorkerMonthlyDays: 20,
          workplaceEmployeeCount: 51,
          isStudent: false,
          monthlyStandardWage: 88_000,
        },
        "2026-06",
      ).reason,
    ).toBe("shortTimeWorker");
  });

  it("applies Ota NHI equal levy reductions by insured member count", () => {
    expect(getOtaNhiEqualReduction(430_000, 1, 1).rate).toBe(0.7);
    expect(getOtaNhiEqualReduction(735_000, 1, 1).rate).toBe(0.5);
    expect(getOtaNhiEqualReduction(990_000, 1, 1).rate).toBe(0.2);
    expect(getOtaNhiEqualReduction(990_001, 1, 1).rate).toBe(0);
    expect(getOtaNhiEqualReduction(1_295_000, 2, 1).rate).toBe(0.2);
  });
});
