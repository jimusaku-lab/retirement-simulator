import dayjs from "dayjs";
import type { HouseholdMember, IncomeEvent, PensionPlannerSettings, ScenarioData, YearMonth } from "@/types";

export const PENSION_STANDARD_CLAIM_AGE = 65;
export const PENSION_EARLY_REDUCTION_PER_MONTH = 0.004;
export const PENSION_DELAYED_INCREASE_PER_MONTH = 0.007;
export const KAKYU_PENSION_STANDARD_AMOUNT = 423_700;

export function pensionClaimRate(claimAge: number) {
  const monthsFrom65 = Math.round((claimAge - PENSION_STANDARD_CLAIM_AGE) * 12);
  if (monthsFrom65 < 0) {
    return Math.max(0, 1 + monthsFrom65 * PENSION_EARLY_REDUCTION_PER_MONTH);
  }
  return 1 + monthsFrom65 * PENSION_DELAYED_INCREASE_PER_MONTH;
}

export function memberAgeAtEndOfMonth(member: HouseholdMember, yearMonth: YearMonth) {
  return dayjs(`${yearMonth}-01`).endOf("month").diff(dayjs(member.birthDate), "year");
}

export function memberAgeAtEndOfYear(member: HouseholdMember, year: number) {
  return dayjs(`${year}-12-31`).diff(dayjs(member.birthDate), "year");
}

export function yearMemberTurnsAge(member: HouseholdMember, age: number) {
  return dayjs(member.birthDate).add(age, "year").year();
}

export function yearMonthRangeForYear(year: number) {
  return Array.from({ length: 12 }, (_, month) => `${year}-${String(month + 1).padStart(2, "0")}`);
}

export function incomeEventAnnualAmount(event: IncomeEvent) {
  return event.amountInputMode === "annual" ? event.monthlyAmount : event.monthlyAmount * 12;
}

export function findPublicPensionAnnual(scenario: ScenarioData, memberId: string | undefined) {
  if (!memberId) return 0;
  return scenario.incomeEvents
    .filter((event) => event.memberId === memberId && event.type === "pension" && event.sourceAssetKey !== "ideco")
    .reduce((sum, event) => sum + incomeEventAnnualAmount(event), 0);
}

export function getPensionPlannerDefaults(
  scenario: ScenarioData,
  selfMember: HouseholdMember | undefined,
  spouseMember: HouseholdMember | undefined,
): PensionPlannerSettings {
  return {
    applyToSimulation: false,
    selfBasicAnnual: 0,
    selfEmployeesAnnual: Math.round(findPublicPensionAnnual(scenario, selfMember?.id)),
    spouseBasicAnnual: 0,
    spouseEmployeesAnnual: Math.round(findPublicPensionAnnual(scenario, spouseMember?.id)),
    selfClaimAge: PENSION_STANDARD_CLAIM_AGE,
    spouseClaimAge: PENSION_STANDARD_CLAIM_AGE,
    projectionEndAge: 90,
    kakyuEligible: Boolean(spouseMember),
    kakyuAmount: KAKYU_PENSION_STANDARD_AMOUNT,
    hasOldAgeEmployeesPension: true,
    employeesPensionMonths: 240,
    spouseDependentForKakyu: Boolean(spouseMember),
  };
}

export function shouldApplyPensionPlannerToSimulation(scenario: ScenarioData) {
  return scenario.pensionPlannerSettings?.applyToSimulation === true;
}

export function getPensionPlannerMembers(scenario: ScenarioData) {
  const selfMember =
    scenario.householdMembers.find((member) => member.relationship === "self") ??
    scenario.householdMembers.find((member) => member.id === scenario.householdProfile.headMemberId) ??
    scenario.householdMembers[0];
  const spouseMember = scenario.householdMembers.find((member) => member.relationship === "spouse");
  return { selfMember, spouseMember };
}

export function mergePensionPlannerSettings(
  scenario: ScenarioData,
  selfMember: HouseholdMember | undefined,
  spouseMember: HouseholdMember | undefined,
): PensionPlannerSettings {
  return {
    ...getPensionPlannerDefaults(scenario, selfMember, spouseMember),
    ...(scenario.pensionPlannerSettings ?? {}),
  };
}

export function isPensionPlannerReplacingEvent(scenario: ScenarioData, event: IncomeEvent) {
  if (!shouldApplyPensionPlannerToSimulation(scenario)) return false;
  if (event.type !== "pension" || event.sourceAssetKey === "ideco") return false;
  const { selfMember, spouseMember } = getPensionPlannerMembers(scenario);
  return event.memberId === selfMember?.id || event.memberId === spouseMember?.id;
}

function getScenarioPlannerEndYearMonth(scenario: ScenarioData) {
  if (scenario.userProfile.simulationEndMode === "yearMonth" && scenario.userProfile.simulationEndYearMonth) {
    return scenario.userProfile.simulationEndYearMonth;
  }
  return dayjs(scenario.userProfile.birthDate).add(scenario.userProfile.simulationEndAge ?? 95, "year").format("YYYY-MM");
}

export function getPensionPlannerIncomeForMonth(
  scenario: ScenarioData,
  memberId: string,
  yearMonth: YearMonth,
  monthsFromStart: number,
) {
  if (!shouldApplyPensionPlannerToSimulation(scenario)) return 0;
  if (yearMonth < scenario.userProfile.simulationStartYearMonth || yearMonth > getScenarioPlannerEndYearMonth(scenario)) return 0;
  const { selfMember, spouseMember } = getPensionPlannerMembers(scenario);
  const settings = mergePensionPlannerSettings(scenario, selfMember, spouseMember);
  const pensionAdjustmentRate = scenario.inflationSettings.enabled ? scenario.inflationSettings.pensionAnnualAdjustmentRate : 0;
  const adjustmentFactor = pensionAdjustmentRate === 0 ? 1 : Math.pow(1 + pensionAdjustmentRate, monthsFromStart / 12);

  if (memberId === selfMember?.id) {
    const selfAge = memberAgeAtEndOfMonth(selfMember, yearMonth);
    const basePension =
      selfAge >= settings.selfClaimAge
        ? ((settings.selfBasicAnnual + settings.selfEmployeesAnnual) * pensionClaimRate(settings.selfClaimAge) * adjustmentFactor) / 12
        : 0;
    const kakyuPension =
      settings.kakyuEligible &&
      spouseMember &&
      settings.hasOldAgeEmployeesPension &&
      settings.employeesPensionMonths >= 240 &&
      settings.spouseDependentForKakyu &&
      selfAge >= PENSION_STANDARD_CLAIM_AGE &&
      memberAgeAtEndOfMonth(spouseMember, yearMonth) < PENSION_STANDARD_CLAIM_AGE
        ? settings.kakyuAmount / 12
        : 0;
    return basePension + kakyuPension;
  }

  if (memberId === spouseMember?.id) {
    const spouseAge = memberAgeAtEndOfMonth(spouseMember, yearMonth);
    return spouseAge >= settings.spouseClaimAge
      ? ((settings.spouseBasicAnnual + settings.spouseEmployeesAnnual) * pensionClaimRate(settings.spouseClaimAge) * adjustmentFactor) / 12
      : 0;
  }

  return 0;
}
