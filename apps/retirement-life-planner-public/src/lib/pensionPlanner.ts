import dayjs from "dayjs";
import type { HouseholdMember, IncomeEvent, PensionPlannerSettings, ScenarioData, YearMonth } from "@/types";

export const PENSION_STANDARD_CLAIM_AGE = 65;
export const PENSION_EARLY_REDUCTION_PER_MONTH = 0.004;
export const PENSION_DELAYED_INCREASE_PER_MONTH = 0.007;
export const KAKYU_PENSION_STANDARD_AMOUNT = 423_700;
const PENSION_PLANNER_SETTINGS_VERSION = 4;

function yearMonthDate(yearMonth: YearMonth) {
  return dayjs(`${yearMonth}-01`);
}

export function pensionClaimRate(claimAge: number) {
  const monthsFrom65 = Math.round((claimAge - PENSION_STANDARD_CLAIM_AGE) * 12);
  if (monthsFrom65 < 0) {
    return Math.max(0, 1 + monthsFrom65 * PENSION_EARLY_REDUCTION_PER_MONTH);
  }
  return 1 + monthsFrom65 * PENSION_DELAYED_INCREASE_PER_MONTH;
}

export function memberAgeAtEndOfMonth(member: HouseholdMember, yearMonth: YearMonth) {
  return yearMonthDate(yearMonth).endOf("month").diff(dayjs(member.birthDate), "year");
}

export function memberAgeAtEndOfYear(member: HouseholdMember, year: number) {
  return dayjs(`${year}-12-31`).diff(dayjs(member.birthDate), "year");
}

export function yearMemberTurnsAge(member: HouseholdMember, age: number) {
  return dayjs(member.birthDate).add(age, "year").year();
}

export function memberReachesAgeYearMonth(member: HouseholdMember, age: number): YearMonth {
  return dayjs(member.birthDate).add(age, "year").subtract(1, "day").format("YYYY-MM");
}

export function defaultPensionClaimStartYearMonth(member: HouseholdMember, claimAge: number): YearMonth {
  return dayjs(memberReachesAgeYearMonth(member, claimAge)).add(1, "month").format("YYYY-MM");
}

export function pensionStandardStartYearMonth(member: HouseholdMember): YearMonth {
  return defaultPensionClaimStartYearMonth(member, PENSION_STANDARD_CLAIM_AGE);
}

export function pensionClaimMonthsFromStandardStart(member: HouseholdMember, claimStartYearMonth: YearMonth) {
  return yearMonthDate(claimStartYearMonth).diff(yearMonthDate(pensionStandardStartYearMonth(member)), "month");
}

export function pensionClaimRateForStartYearMonth(member: HouseholdMember, claimStartYearMonth: YearMonth) {
  const monthsFromStandardStart = pensionClaimMonthsFromStandardStart(member, claimStartYearMonth);
  if (monthsFromStandardStart < 0) {
    return Math.max(0, 1 + monthsFromStandardStart * PENSION_EARLY_REDUCTION_PER_MONTH);
  }
  return 1 + monthsFromStandardStart * PENSION_DELAYED_INCREASE_PER_MONTH;
}

export function pensionClaimAgeFromStartYearMonth(member: HouseholdMember, claimStartYearMonth: YearMonth) {
  return Math.min(75, Math.max(60, memberAgeAtEndOfMonth(member, claimStartYearMonth)));
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
  const claimStartYearMonth = inferPublicPensionClaimStartYearMonth(scenario, member);
  if (!claimStartYearMonth || !member) return PENSION_STANDARD_CLAIM_AGE;
  return pensionClaimAgeFromStartYearMonth(member, claimStartYearMonth);
}

function inferPublicPensionClaimStartYearMonth(scenario: ScenarioData, member: HouseholdMember | undefined) {
  const event = getPublicPensionEvents(scenario, member?.id).sort((a, b) => a.startYearMonth.localeCompare(b.startYearMonth))[0];
  if (!event || !member) return undefined;
  return event.startYearMonth;
}

function inferPublicPensionStandardAnnual(scenario: ScenarioData, member: HouseholdMember | undefined) {
  const annual = findPublicPensionAnnual(scenario, member?.id);
  if (!member || annual <= 0) return 0;
  const claimStartYearMonth = inferPublicPensionClaimStartYearMonth(scenario, member) ?? defaultPensionClaimStartYearMonth(member, PENSION_STANDARD_CLAIM_AGE);
  return Math.round(annual / pensionClaimRateForStartYearMonth(member, claimStartYearMonth));
}

export function getPensionPlannerDefaults(
  scenario: ScenarioData,
  selfMember: HouseholdMember | undefined,
  spouseMember: HouseholdMember | undefined,
): PensionPlannerSettings {
  const inferredSelfClaimAge = inferPublicPensionClaimAge(scenario, selfMember);
  const inferredSpouseClaimAge = inferPublicPensionClaimAge(scenario, spouseMember);
  const inferredSelfClaimStartYearMonth = selfMember
    ? inferPublicPensionClaimStartYearMonth(scenario, selfMember) ?? defaultPensionClaimStartYearMonth(selfMember, inferredSelfClaimAge)
    : undefined;
  const inferredSpouseClaimStartYearMonth = spouseMember
    ? inferPublicPensionClaimStartYearMonth(scenario, spouseMember) ?? defaultPensionClaimStartYearMonth(spouseMember, inferredSpouseClaimAge)
    : undefined;
  return {
    applyToSimulation: false,
    settingsVersion: PENSION_PLANNER_SETTINGS_VERSION,
    selfBasicAnnual: 0,
    selfEmployeesAnnual: inferPublicPensionStandardAnnual(scenario, selfMember),
    spouseBasicAnnual: 0,
    spouseEmployeesAnnual: inferPublicPensionStandardAnnual(scenario, spouseMember),
    selfClaimAge: inferredSelfClaimAge,
    spouseClaimAge: inferredSpouseClaimAge,
    selfClaimStartYearMonth: inferredSelfClaimStartYearMonth,
    spouseClaimStartYearMonth: inferredSpouseClaimStartYearMonth,
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
  const isLegacyAnnualSettings = (stored.settingsVersion ?? 1) < 3;
  const shouldRecoverSelfAnnual =
    rawSelfAnnual > 0 &&
    ((isLegacyAnnualSettings && Math.round(stored.selfEmployeesAnnual) === rawSelfAnnual) ||
      stored.selfBasicAnnual + stored.selfEmployeesAnnual < rawSelfAnnual * 0.5);
  const shouldRecoverSpouseAnnual =
    rawSpouseAnnual > 0 &&
    ((isLegacyAnnualSettings && Math.round(stored.spouseEmployeesAnnual) === rawSpouseAnnual) ||
      stored.spouseBasicAnnual + stored.spouseEmployeesAnnual < rawSpouseAnnual * 0.5);
  const selfClaimAge = stored.selfClaimAge ?? defaults.selfClaimAge;
  const spouseClaimAge = stored.spouseClaimAge ?? defaults.spouseClaimAge;
  const selfClaimStartYearMonth =
    stored.selfClaimStartYearMonth ?? (selfMember ? defaultPensionClaimStartYearMonth(selfMember, selfClaimAge) : defaults.selfClaimStartYearMonth);
  const spouseClaimStartYearMonth =
    stored.spouseClaimStartYearMonth ?? (spouseMember ? defaultPensionClaimStartYearMonth(spouseMember, spouseClaimAge) : defaults.spouseClaimStartYearMonth);

  return {
    ...defaults,
    ...stored,
    settingsVersion: PENSION_PLANNER_SETTINGS_VERSION,
    selfEmployeesAnnual: shouldRecoverSelfAnnual ? Math.max(0, defaults.selfEmployeesAnnual - stored.selfBasicAnnual) : stored.selfEmployeesAnnual,
    spouseEmployeesAnnual: shouldRecoverSpouseAnnual ? Math.max(0, defaults.spouseEmployeesAnnual - stored.spouseBasicAnnual) : stored.spouseEmployeesAnnual,
    selfClaimAge,
    spouseClaimAge,
    selfClaimStartYearMonth,
    spouseClaimStartYearMonth,
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
    const selfClaimStartYearMonth = settings.selfClaimStartYearMonth ?? defaultPensionClaimStartYearMonth(selfMember, settings.selfClaimAge);
    const basePension =
      yearMonth >= selfClaimStartYearMonth
        ? ((settings.selfBasicAnnual + settings.selfEmployeesAnnual) * pensionClaimRateForStartYearMonth(selfMember, selfClaimStartYearMonth) * adjustmentFactor) / 12
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
    const spouseClaimStartYearMonth = settings.spouseClaimStartYearMonth ?? defaultPensionClaimStartYearMonth(spouseMember, settings.spouseClaimAge);
    return yearMonth >= spouseClaimStartYearMonth
      ? ((settings.spouseBasicAnnual + settings.spouseEmployeesAnnual) * pensionClaimRateForStartYearMonth(spouseMember, spouseClaimStartYearMonth) * adjustmentFactor) / 12
      : 0;
  }

  return 0;
}
