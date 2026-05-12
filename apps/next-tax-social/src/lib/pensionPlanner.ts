import dayjs from "dayjs";
import type { HouseholdMember, IncomeEvent, PensionPlannerSettings, ScenarioData, YearMonth } from "@/types";

export const PENSION_STANDARD_CLAIM_AGE = 65;
export const PENSION_EARLY_REDUCTION_PER_MONTH = 0.004;
export const PENSION_DELAYED_INCREASE_PER_MONTH = 0.007;
export const KAKYU_PENSION_STANDARD_AMOUNT = 423_700;
const PENSION_PLANNER_SETTINGS_VERSION = 3;

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

function getPublicPensionEvents(scenario: ScenarioData, memberId: string | undefined) {
  if (!memberId) return [];
  return scenario.incomeEvents.filter((event) => event.memberId === memberId && event.type === "pension" && !event.sourceAssetKey);
}

export function findPublicPensionAnnual(scenario: ScenarioData, memberId: string | undefined) {
  const events = getPublicPensionEvents(scenario, memberId);
  if (!events) return 0;
  return events.reduce((sum, event) => sum + incomeEventAnnualAmount(event), 0);
}

function inferPublicPensionClaimAge(scenario: ScenarioData, member: HouseholdMember | undefined) {
  const event = getPublicPensionEvents(scenario, member?.id).sort((a, b) => a.startYearMonth.localeCompare(b.startYearMonth))[0];
  if (!event || !member) return PENSION_STANDARD_CLAIM_AGE;
  return Math.min(75, Math.max(60, memberAgeAtEndOfMonth(member, event.startYearMonth)));
}

function inferPublicPensionStandardAnnual(scenario: ScenarioData, member: HouseholdMember | undefined) {
  const annual = findPublicPensionAnnual(scenario, member?.id);
  if (!member || annual <= 0) return 0;
  const claimAge = inferPublicPensionClaimAge(scenario, member);
  return Math.round(annual / pensionClaimRate(claimAge));
}

export function getPensionPlannerDefaults(
  scenario: ScenarioData,
  selfMember: HouseholdMember | undefined,
  spouseMember: HouseholdMember | undefined,
): PensionPlannerSettings {
  const inferredSelfClaimAge = inferPublicPensionClaimAge(scenario, selfMember);
  const inferredSpouseClaimAge = inferPublicPensionClaimAge(scenario, spouseMember);
  return {
    applyToSimulation: false,
    settingsVersion: PENSION_PLANNER_SETTINGS_VERSION,
    selfBasicAnnual: 0,
    selfEmployeesAnnual: inferPublicPensionStandardAnnual(scenario, selfMember),
    spouseBasicAnnual: 0,
    spouseEmployeesAnnual: inferPublicPensionStandardAnnual(scenario, spouseMember),
    selfClaimAge: inferredSelfClaimAge,
    spouseClaimAge: inferredSpouseClaimAge,
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
  const defaults = getPensionPlannerDefaults(scenario, selfMember, spouseMember);
  const stored = scenario.pensionPlannerSettings;
  if (!stored) return defaults;
  const rawSelfAnnual = Math.round(findPublicPensionAnnual(scenario, selfMember?.id));
  const rawSpouseAnnual = Math.round(findPublicPensionAnnual(scenario, spouseMember?.id));
  const isLegacyStoredSettings = (stored.settingsVersion ?? 1) < PENSION_PLANNER_SETTINGS_VERSION;
  const shouldRecoverSelfAnnual =
    rawSelfAnnual > 0 &&
    ((isLegacyStoredSettings && Math.round(stored.selfEmployeesAnnual) === rawSelfAnnual) ||
      stored.selfBasicAnnual + stored.selfEmployeesAnnual < rawSelfAnnual * 0.5);
  const shouldRecoverSpouseAnnual =
    rawSpouseAnnual > 0 &&
    ((isLegacyStoredSettings && Math.round(stored.spouseEmployeesAnnual) === rawSpouseAnnual) ||
      stored.spouseBasicAnnual + stored.spouseEmployeesAnnual < rawSpouseAnnual * 0.5);
  return {
    ...defaults,
    ...stored,
    settingsVersion: PENSION_PLANNER_SETTINGS_VERSION,
    selfEmployeesAnnual: shouldRecoverSelfAnnual ? Math.max(0, defaults.selfEmployeesAnnual - stored.selfBasicAnnual) : stored.selfEmployeesAnnual,
    spouseEmployeesAnnual: shouldRecoverSpouseAnnual ? Math.max(0, defaults.spouseEmployeesAnnual - stored.spouseBasicAnnual) : stored.spouseEmployeesAnnual,
  };
}

export function isPensionPlannerReplacingEvent(scenario: ScenarioData, event: IncomeEvent) {
  if (!shouldApplyPensionPlannerToSimulation(scenario)) return false;
  if (event.type !== "pension" || event.sourceAssetKey) return false;
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
