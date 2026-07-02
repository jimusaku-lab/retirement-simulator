import { describe, expect, it } from "vitest";
import { sampleState } from "@/data/sampleData";
import {
  buildSpousePartIncomeEfficiencyRows,
  getDefaultSpousePartIncomeCompareYear,
  getSpouseSalaryIncomeForYear,
} from "@/lib/spousePartIncomeEfficiency";
import type { ScenarioData } from "@/types";

type WorkplaceApplicabilityForTest = "unknown" | "notApplicable" | "applicable";

function scenarioWithSpouseSalary(
  id: string,
  salaryAnnual: number,
  options?: {
    workplaceApplicability?: WorkplaceApplicabilityForTest;
    idecoLumpSumYearMonth?: ScenarioData["userProfile"]["simulationStartYearMonth"];
  },
): ScenarioData {
  const scenario = structuredClone(sampleState.scenarios[0]);
  const workplaceSocialInsurance =
    options?.workplaceApplicability === "applicable"
      ? {
          joinStartYearMonth: "2026-01",
          isApplicableWorkplace: true,
          weeklyScheduledHours: 20,
          monthlyScheduledDays: 16,
          regularWorkerWeeklyHours: 40,
          regularWorkerMonthlyDays: 20,
          monthlyStandardWage: 142_000,
          workplaceEmployeeCount: 51,
          isStudent: false,
          premiumMode: "estimate" as const,
        }
      : options?.workplaceApplicability === "notApplicable"
        ? {
            isApplicableWorkplace: false,
            premiumMode: "estimate" as const,
          }
        : undefined;
  scenario.id = id;
  scenario.name = `妻パート${Math.round(salaryAnnual / 10_000)}万円`;
  scenario.compare = true;
  scenario.userProfile.simulationStartYearMonth = "2026-01";
  scenario.userProfile.simulationEndMode = "yearMonth";
  scenario.userProfile.simulationEndYearMonth = "2027-12";
  scenario.userProfile.hasSpouse = true;
  scenario.householdProfile.taxCalculationMode = "auto";
  scenario.householdProfile.headMemberId = "member-self";
  scenario.householdMembers = [
    {
      id: "member-self",
      name: "本人",
      relationship: "self",
      birthDate: "1970-01-01",
      isResident: true,
      isNationalHealthInsuranceMember: true,
      isLateElderlyMedicalMember: false,
      isLongTermCareInsured: false,
      isDependent: false,
    },
    {
      id: "member-spouse",
      name: "妻",
      relationship: "spouse",
      birthDate: "1972-01-01",
      isResident: true,
      isNationalHealthInsuranceMember: false,
      isLateElderlyMedicalMember: false,
      isLongTermCareInsured: false,
      isDependent: true,
      workplaceSocialInsurance,
    },
  ];
  scenario.householdMemberStatusEvents = [];
  scenario.incomeEvents = [
    {
      id: "self-salary",
      memberId: "member-self",
      name: "本人給与",
      type: "salary",
      startYearMonth: "2026-01",
      endYearMonth: "2026-12",
      monthlyAmount: 4_000_000,
      amountInputMode: "annual",
      taxTreatment: "taxable",
    },
    {
      id: "spouse-salary",
      memberId: "member-spouse",
      name: "妻パート給与",
      type: "salary",
      startYearMonth: "2026-01",
      endYearMonth: "2026-12",
      monthlyAmount: salaryAnnual,
      amountInputMode: "annual",
      taxTreatment: "taxable",
    },
  ];
  if (options?.idecoLumpSumYearMonth) {
    scenario.incomeEvents.push({
      id: "ideco-lump-sum",
      memberId: "member-self",
      name: "iDeCo一時金",
      type: "oneTime",
      startYearMonth: options.idecoLumpSumYearMonth,
      endYearMonth: options.idecoLumpSumYearMonth,
      monthlyAmount: 12_000_000,
      amountInputMode: "monthly",
      taxTreatment: "taxable",
      sourceAssetKey: "ideco",
      idecoLumpSumContributionYears: 25,
      idecoLumpSumTaxMode: "retirementIncomeDeclaration",
    });
  }
  scenario.taxInsurance = [];
  scenario.taxDeductionEvents = [];
  scenario.taxSocialPaymentSchedule = [];
  scenario.recurringTaxSocialPaymentTemplates = [];
  return scenario;
}

describe("spouse part income efficiency comparison", () => {
  it("compares spouse salary income and take-home efficiency against the baseline", () => {
    const scenarios = [1_170_000, 1_200_000, 1_300_000, 1_500_000, 1_700_000].map((salary) =>
      scenarioWithSpouseSalary(`salary-${salary}`, salary, salary === 1_700_000 ? { workplaceApplicability: "applicable" } : undefined),
    );

    expect(getDefaultSpousePartIncomeCompareYear(scenarios, 2026)).toBe(2026);
    expect(getSpouseSalaryIncomeForYear(scenarios[0], 2026)).toBe(1_170_000);

    const rows = buildSpousePartIncomeEfficiencyRows(scenarios, "salary-1170000", 2026, "incomeYear");
    const baseline = rows.find((row) => row.scenarioId === "salary-1170000");
    const salary120 = rows.find((row) => row.scenarioId === "salary-1200000");
    const salary130 = rows.find((row) => row.scenarioId === "salary-1300000");
    const salary150 = rows.find((row) => row.scenarioId === "salary-1500000");
    const salary170 = rows.find((row) => row.scenarioId === "salary-1700000");

    expect(baseline?.incomeDelta).toBe(0);
    expect(baseline?.takeHomeRate).toBeNull();
    expect(baseline?.burdenRate).toBeNull();

    expect(salary120?.incomeDelta).toBe(30_000);
    expect(salary120?.taxSocialDelta).toEqual(expect.any(Number));
    expect(salary120?.takeHomeRate).not.toBeNull();
    expect(salary120?.burdenRate).not.toBeNull();

    expect(salary130?.socialInsuranceJudgmentLabel).toBe("要確認: 適用事業所未設定");
    expect(salary150?.deductionImpactLabel).toBe("配偶者特別控除へ移行");
    expect(salary170?.socialInsuranceJudgmentLabel).toBe("勤務先社保加入");
  });

  it("distinguishes unknown and explicit non-applicable workplace settings", () => {
    const scenarios = [
      scenarioWithSpouseSalary("salary-1170000", 1_170_000),
      scenarioWithSpouseSalary("salary-1300000-unknown", 1_300_000, { workplaceApplicability: "unknown" }),
      scenarioWithSpouseSalary("salary-1300000-not-applicable", 1_300_000, { workplaceApplicability: "notApplicable" }),
      scenarioWithSpouseSalary("salary-1700000-applicable", 1_700_000, { workplaceApplicability: "applicable" }),
    ];

    const rows = buildSpousePartIncomeEfficiencyRows(scenarios, "salary-1170000", 2026, "incomeYear");
    expect(rows.find((row) => row.scenarioId === "salary-1300000-unknown")?.socialInsuranceJudgmentLabel).toBe("要確認: 適用事業所未設定");
    expect(rows.find((row) => row.scenarioId === "salary-1300000-not-applicable")?.socialInsuranceJudgmentLabel).toBe("勤務先社保なし・国保判定");
    expect(rows.find((row) => row.scenarioId === "salary-1700000-applicable")?.socialInsuranceJudgmentLabel).toBe("勤務先社保加入");
  });

  it("excludes iDeCo lump-sum year differences when spouse salary is unchanged", () => {
    const scenarios = [
      scenarioWithSpouseSalary("salary-1170000-ideco-2026", 1_170_000, { idecoLumpSumYearMonth: "2026-11" }),
      scenarioWithSpouseSalary("salary-1170000-ideco-2027", 1_170_000, { idecoLumpSumYearMonth: "2027-01" }),
    ];

    const rows = buildSpousePartIncomeEfficiencyRows(scenarios, "salary-1170000-ideco-2026", 2026, "incomeYear");
    const target = rows.find((row) => row.scenarioId === "salary-1170000-ideco-2027");

    expect(target?.incomeDelta).toBe(0);
    expect(target?.taxSocialDelta).toBe(0);
    expect(target?.incomeResidentTaxDelta).toBe(0);
    expect(target?.socialInsuranceDelta).toBe(0);
    expect(target?.netTakeHomeDelta).toBe(0);
    expect(target?.hasOtherConditionDifferences).toBe(true);
  });

  it("compares only spouse salary when no other conditions differ", () => {
    const scenarios = [
      scenarioWithSpouseSalary("salary-1170000", 1_170_000),
      scenarioWithSpouseSalary("salary-1200000", 1_200_000),
    ];

    const rows = buildSpousePartIncomeEfficiencyRows(scenarios, "salary-1170000", 2026, "incomeYear");
    const target = rows.find((row) => row.scenarioId === "salary-1200000");

    expect(target?.incomeDelta).toBe(30_000);
    expect(target?.netTakeHomeDelta).toBe((target?.incomeDelta ?? 0) - (target?.taxSocialDelta ?? 0));
    expect(target?.hasOtherConditionDifferences).toBe(false);
  });

  it("keeps iDeCo lump-sum year differences out when spouse salary also changes", () => {
    const baseline = scenarioWithSpouseSalary("salary-1170000-ideco-2026", 1_170_000, { idecoLumpSumYearMonth: "2026-11" });
    const salaryOnly = scenarioWithSpouseSalary("salary-1200000-ideco-2026", 1_200_000, { idecoLumpSumYearMonth: "2026-11" });
    const salaryAndIdeco = scenarioWithSpouseSalary("salary-1200000-ideco-2027", 1_200_000, { idecoLumpSumYearMonth: "2027-01" });

    const rows = buildSpousePartIncomeEfficiencyRows([baseline, salaryOnly, salaryAndIdeco], baseline.id, 2026, "incomeYear");
    const salaryOnlyRow = rows.find((row) => row.scenarioId === salaryOnly.id);
    const salaryAndIdecoRow = rows.find((row) => row.scenarioId === salaryAndIdeco.id);

    expect(salaryAndIdecoRow?.incomeDelta).toBe(30_000);
    expect(salaryAndIdecoRow?.taxSocialDelta).toBe(salaryOnlyRow?.taxSocialDelta);
    expect(salaryAndIdecoRow?.incomeResidentTaxDelta).toBe(salaryOnlyRow?.incomeResidentTaxDelta);
    expect(salaryAndIdecoRow?.socialInsuranceDelta).toBe(salaryOnlyRow?.socialInsuranceDelta);
    expect(salaryAndIdecoRow?.hasOtherConditionDifferences).toBe(true);
  });
});
