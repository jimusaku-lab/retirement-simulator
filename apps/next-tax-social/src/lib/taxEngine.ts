import dayjs from "dayjs";
import { getIncomeEventAmountForMonth, isIdecoMonexPensionEvent } from "@/lib/incomeEvents";
import { getRetirementOverlapAdjustments, type RetirementOverlapAdjustment } from "@/lib/retirementIncome";
import type {
  HouseholdMember,
  IncomeEvent,
  ScenarioData,
  TaxCalculationMode,
  TaxInsuranceByFiscalYear,
  YearMonth,
} from "@/types";

const INCOME_TAX_BASIC_DEDUCTION = 580_000;
const RESIDENT_TAX_BASIC_DEDUCTION = 430_000;
const RESIDENT_TAX_FLAT = 5_000;
const RESIDENT_TAX_RATE = 0.1;
const RECOVERY_SPECIAL_TAX_RATE = 0.021;
const SPOUSE_DEDUCTION_INCOME_TAX = 380_000;
const SPOUSE_DEDUCTION_RESIDENT_TAX = 330_000;
const DEPENDENT_DEDUCTION_INCOME_TAX = 380_000;
const DEPENDENT_DEDUCTION_RESIDENT_TAX = 330_000;
const DEPENDENT_TOTAL_INCOME_LIMIT = 580_000;
const SPOUSE_DEDUCTION_TAXPAYER_INCOME_LIMIT = 10_000_000;

const SPOUSE_SPECIAL_DEDUCTION_INCOME_TAX_TABLE = [
  { maxSpouseIncome: 950_000, amounts: [380_000, 260_000, 130_000] },
  { maxSpouseIncome: 1_000_000, amounts: [360_000, 240_000, 120_000] },
  { maxSpouseIncome: 1_050_000, amounts: [310_000, 210_000, 110_000] },
  { maxSpouseIncome: 1_100_000, amounts: [260_000, 180_000, 90_000] },
  { maxSpouseIncome: 1_150_000, amounts: [210_000, 140_000, 70_000] },
  { maxSpouseIncome: 1_200_000, amounts: [160_000, 110_000, 60_000] },
  { maxSpouseIncome: 1_250_000, amounts: [110_000, 80_000, 40_000] },
  { maxSpouseIncome: 1_300_000, amounts: [60_000, 40_000, 20_000] },
  { maxSpouseIncome: 1_330_000, amounts: [30_000, 20_000, 10_000] },
];

const SPOUSE_SPECIAL_DEDUCTION_RESIDENT_TAX_TABLE = [
  { maxSpouseIncome: 1_000_000, amounts: [330_000, 220_000, 110_000] },
  { maxSpouseIncome: 1_050_000, amounts: [310_000, 210_000, 110_000] },
  { maxSpouseIncome: 1_100_000, amounts: [260_000, 180_000, 90_000] },
  { maxSpouseIncome: 1_150_000, amounts: [210_000, 140_000, 70_000] },
  { maxSpouseIncome: 1_200_000, amounts: [160_000, 110_000, 60_000] },
  { maxSpouseIncome: 1_250_000, amounts: [110_000, 80_000, 40_000] },
  { maxSpouseIncome: 1_300_000, amounts: [60_000, 40_000, 20_000] },
  { maxSpouseIncome: 1_330_000, amounts: [30_000, 20_000, 10_000] },
];

const NATIONAL_PENSION_MONTHLY_BY_FISCAL_YEAR: Record<number, number> = {
  2026: 17_920,
};

const OTA_NHI = {
  baseIncomeDeduction: 430_000,
  medicalIncomeRate: 0.0751,
  medicalPerCapita: 47_600,
  medicalCap: 670_000,
  supportIncomeRate: 0.028,
  supportPerCapita: 17_600,
  supportCap: 260_000,
  childSupportIncomeRate: 0.0027,
  childSupportPerCapita: 1_873,
  childSupportCap: 30_000,
  careIncomeRate: 0.0243,
  carePerCapita: 17_800,
  careCap: 170_000,
};

const TOKYO_LATE_ELDERLY_MEDICAL = {
  baseIncomeDeduction: 430_000,
  medicalIncomeRate: 0.0988,
  medicalPerCapita: 53_300,
  medicalCap: 850_000,
  childSupportIncomeRate: 0.0026,
  childSupportPerCapita: 1_300,
  childSupportCap: 21_000,
};

const TOKYO_LATE_ELDERLY_EQUAL_REDUCTION = [
  { label: "7割軽減", medicalRate: 0.7, childSupportRate: 0.7 },
  { label: "5割軽減", medicalRate: 0.5, childSupportRate: 0.5 },
  { label: "2割軽減", medicalRate: 0.2, childSupportRate: 0.2 },
] as const;

const TOKYO_LATE_ELDERLY_INCOME_REDUCTION = [
  { maxBaseIncome: 150_000, rate: 0.5, label: "所得割50%軽減" },
  { maxBaseIncome: 200_000, rate: 0.25, label: "所得割25%軽減" },
] as const;

export type AutoTaxMemberDetail = {
  memberId: string;
  memberName: string;
  relationship: HouseholdMember["relationship"];
  ageAtYearEnd: number;
  salaryGrossAnnual: number;
  salaryDeductionAnnual: number;
  pensionGrossAnnual: number;
  pensionDeductionAnnual: number;
  miscellaneousIncomeAnnual: number;
  retirementGrossAnnual: number;
  retirementIncomeDeductionAnnual: number;
  retirementIncomeAnnual: number;
  retirementIncomeTaxAnnual: number;
  retirementResidentTaxAnnual: number;
  manualSocialInsuranceDeductionAnnual: number;
  autoSocialInsuranceDeductionAnnual: number;
  socialInsuranceDeductionAnnual: number;
  medicalExpenseDeductionAnnual: number;
  taxableIncomeBeforeBasicDeductionAnnual: number;
  basicDeductionAnnual: number;
  dependentDeductionsIncomeTaxAnnual: number;
  dependentDeductionsResidentTaxAnnual: number;
  spouseSpecialDeductionIncomeTaxAnnual: number;
  spouseSpecialDeductionResidentTaxAnnual: number;
  incomeTaxBaseAnnual: number;
  residentTaxBaseAnnual: number;
  incomeTaxAnnual: number;
  residentTaxAnnual: number;
  nationalPensionMonthly: number;
  nationalPensionAnnual: number;
};

export type AutoTaxYearDetail = {
  fiscalYear: number;
  memberDetails: AutoTaxMemberDetail[];
  nationalHealthInsuranceAnnual: number;
  lateElderlyMedicalAnnual: number;
  nursingCareAnnual: number;
  otherPublicCostAnnual: number;
  nationalHealthInsuranceBreakdown: {
    insuredMemberCount: number;
    totalBaseIncome: number;
    medical: number;
    support: number;
    childSupport: number;
    care: number;
    insuredMemberDetails: Array<{
      memberId: string;
      memberName: string;
      ageAtYearEnd: number;
      baseIncome: number;
    }>;
  };
  lateElderlyMedicalBreakdown: {
    insuredMemberCount: number;
    totalBaseIncome: number;
    medical: number;
    childSupport: number;
    equalReductionLabel: string;
    equalReductionJudgmentIncome: number;
    equalReductionThreshold: number;
    medicalEqualReductionAmount: number;
    childSupportEqualReductionAmount: number;
    incomeReductionAmount: number;
    insuredMemberDetails: Array<{
      memberId: string;
      memberName: string;
      ageAtYearEnd: number;
      baseIncome: number;
      incomeReductionLabel: string;
      incomeReductionAmount: number;
    }>;
  };
  lateElderlyBurdenRatios: Array<{
    memberId: string;
    memberName: string;
    incomeYear: number;
    periodStartYearMonth: YearMonth;
    periodEndYearMonth: YearMonth;
    residentTaxBaseAnnual: number;
    pensionAndOtherIncomeAnnual: number;
    insuredMemberCount: number;
    householdPensionAndOtherIncomeAnnual: number;
    burdenRatio: 0.1 | 0.2 | 0.3;
    category: "一般所得者等" | "一定以上所得者" | "現役並み所得者";
    reason: string;
  }>;
};

export type DeclaredInvestmentIncomeByYear = Map<number, Map<string, number>>;

function ym(value: YearMonth) {
  return dayjs(`${value}-01`);
}

function formatYm(date: dayjs.Dayjs) {
  return date.format("YYYY-MM");
}

function getFiscalYear(yearMonth: YearMonth) {
  const date = ym(yearMonth);
  return date.month() >= 3 ? date.year() : date.year() - 1;
}

function getCalendarYearMonths(year: number) {
  const months: YearMonth[] = [];
  let cursor = dayjs(`${year}-01-01`);
  const end = dayjs(`${year}-12-01`);
  while (cursor.isBefore(end) || cursor.isSame(end, "month")) {
    months.push(formatYm(cursor));
    cursor = cursor.add(1, "month");
    if (months.length > 12) break;
  }
  return months;
}

function listFiscalYearsForScenario(scenario: ScenarioData) {
  const start = ym(scenario.userProfile.simulationStartYearMonth);
  const endYearMonth =
    scenario.userProfile.simulationEndMode === "yearMonth" && scenario.userProfile.simulationEndYearMonth
      ? scenario.userProfile.simulationEndYearMonth
      : dayjs(scenario.userProfile.birthDate).add(scenario.userProfile.simulationEndAge ?? 95, "year").format("YYYY-MM");
  const end = ym(endYearMonth);
  const years = new Set<number>();
  let cursor = start;
  while (cursor.isBefore(end) || cursor.isSame(end, "month")) {
    years.add(getFiscalYear(formatYm(cursor)));
    cursor = cursor.add(1, "month");
    if (years.size > 120) break;
  }
  return [...years].sort((a, b) => a - b);
}

function isEventActive(event: Pick<IncomeEvent, "startYearMonth" | "endYearMonth">, yearMonth: YearMonth) {
  return yearMonth >= event.startYearMonth && (!event.endYearMonth || yearMonth <= event.endYearMonth);
}

function getPensionAdjustedAmount(event: IncomeEvent, monthsFromStart: number, scenario: ScenarioData) {
  const base = event.amountInputMode === "annual" ? event.monthlyAmount / 12 : event.monthlyAmount;
  if (event.type !== "pension" || !scenario.inflationSettings.enabled) return base;
  return base * Math.pow(1 + scenario.inflationSettings.pensionAnnualAdjustmentRate, monthsFromStart / 12);
}

function getMonthlyIncomeAmount(event: IncomeEvent, yearMonth: YearMonth, scenario: ScenarioData) {
  if (!isIdecoMonexPensionEvent(event) && !isEventActive(event, yearMonth)) return 0;
  return getIncomeEventAmountForMonth(
    event,
    yearMonth,
    scenario,
    scenario.inflationSettings.enabled ? scenario.inflationSettings.pensionAnnualAdjustmentRate : 0,
  );
}

function getRetirementAdjustmentByIncomeEventId(scenario: ScenarioData) {
  const map = new Map<string, RetirementOverlapAdjustment>();
  for (const adjustment of getRetirementOverlapAdjustments(scenario)) {
    if (adjustment.currentSource.kind !== "incomeEvent") continue;
    const current = map.get(adjustment.currentSource.eventId);
    if (!current || adjustment.adjustedDeduction < current.adjustedDeduction) {
      map.set(adjustment.currentSource.eventId, adjustment);
    }
  }
  return map;
}

function getSalaryIncomeDeduction(amount: number) {
  if (amount <= 1_625_000) return 650_000;
  if (amount <= 1_800_000) return amount * 0.4 - 100_000;
  if (amount <= 1_900_000) return amount * 0.3 + 80_000;
  if (amount <= 3_600_000) return amount * 0.3 + 80_000;
  if (amount <= 6_600_000) return amount * 0.2 + 440_000;
  if (amount <= 8_500_000) return amount * 0.1 + 1_100_000;
  return 1_950_000;
}

function getPublicPensionOtherIncomeBand(otherIncome: number) {
  if (otherIncome <= 10_000_000) return 0;
  if (otherIncome <= 20_000_000) return 1;
  return 2;
}

function getPublicPensionIncome(amount: number, ageAtYearEnd: number, otherIncome: number) {
  if (amount <= 0) return 0;
  const band = getPublicPensionOtherIncomeBand(otherIncome);
  const isOver65 = ageAtYearEnd >= 65;

  // 令和2年分以後の国税庁「公的年金等に係る雑所得の速算表」。
  // band 0: 年金以外の所得 <= 1,000万円、band 1: <= 2,000万円、band 2: > 2,000万円。
  if (!isOver65) {
    if (amount <= 600_000) return 0;
    if (amount < 1_300_000) return amount - [600_000, 500_000, 400_000][band];
  } else {
    if (amount <= 1_100_000) return 0;
    if (amount < 3_300_000) return amount - [1_100_000, 1_000_000, 900_000][band];
  }

  if (amount < 4_100_000) return amount * 0.75 - [275_000, 175_000, 75_000][band];
  if (amount < 7_700_000) return amount * 0.85 - [685_000, 585_000, 485_000][band];
  if (amount < 10_000_000) return amount * 0.95 - [1_455_000, 1_355_000, 1_255_000][band];
  return amount - [1_955_000, 1_855_000, 1_755_000][band];
}

function getAgeAtDate(birthDate: string, date: dayjs.Dayjs) {
  const birth = dayjs(birthDate);
  let age = date.year() - birth.year();
  if (date.month() < birth.month() || (date.month() === birth.month() && date.date() < birth.date())) {
    age -= 1;
  }
  return age;
}

function getMemberIncomeBreakdown(
  scenario: ScenarioData,
  member: HouseholdMember,
  fiscalYear: number,
  retirementAdjustmentByIncomeEventId = getRetirementAdjustmentByIncomeEventId(scenario),
  declaredInvestmentIncomeByYear: DeclaredInvestmentIncomeByYear = new Map(),
) {
  const months = getCalendarYearMonths(fiscalYear);
  const events = scenario.incomeEvents.filter((event) => event.memberId === member.id);
  let salary = 0;
  let pension = 0;
  let miscellaneous = 0;
  let retirementGross = 0;
  let retirementIncome = 0;
  let retirementDeduction = 0;

  for (const month of months) {
    for (const event of events) {
      if (event.taxTreatment === "nonTaxable") continue;
      const amount = getMonthlyIncomeAmount(event, month, scenario);
      if (amount <= 0) continue;
      if (event.type === "salary") {
        salary += amount;
      } else if (event.type === "pension") {
        pension += amount;
      } else if (event.type === "oneTime" && event.sourceAssetKey === "ideco") {
        const overlapAdjustment = retirementAdjustmentByIncomeEventId.get(event.id);
        const retirement = overlapAdjustment
          ? calculateRetirementIncomeWithDeduction(amount, overlapAdjustment.adjustedDeduction)
          : calculateRetirementIncome(amount, event.idecoLumpSumContributionYears ?? 20);
        retirementGross += amount;
        retirementIncome += retirement.income;
        retirementDeduction += retirement.deduction;
      } else {
        miscellaneous += amount;
      }
    }
  }

  miscellaneous += declaredInvestmentIncomeByYear.get(fiscalYear)?.get(member.id) ?? 0;

  const ageAtYearEnd = getAgeAtDate(member.birthDate, dayjs(`${fiscalYear}-12-31`));
  const salaryIncome = Math.max(0, salary - getSalaryIncomeDeduction(salary));
  const pensionIncome = Math.max(0, getPublicPensionIncome(pension, ageAtYearEnd, salaryIncome + miscellaneous));
  const pensionDeduction = Math.max(0, pension - pensionIncome);
  const totalIncome = Math.round(salaryIncome + pensionIncome + miscellaneous);

  return {
    salaryGrossAnnual: Math.round(salary),
    salaryDeductionAnnual: Math.round(getSalaryIncomeDeduction(salary)),
    salaryIncome: Math.round(salaryIncome),
    pensionGrossAnnual: Math.round(pension),
    pensionDeductionAnnual: Math.round(pensionDeduction),
    pensionIncome: Math.round(pensionIncome),
    miscellaneousIncome: Math.round(miscellaneous),
    retirementGrossAnnual: Math.round(retirementGross),
    retirementIncomeDeductionAnnual: Math.round(retirementDeduction),
    retirementIncomeAnnual: Math.round(retirementIncome),
    retirementIncomeTaxAnnual: calculateIncomeTax(retirementIncome),
    retirementResidentTaxAnnual: calculateResidentTax(retirementIncome, false),
    totalIncome,
    ageAtYearEnd,
  };
}

function isDeductionEligibleDependent(
  scenario: ScenarioData,
  member: HouseholdMember,
  fiscalYear: number,
  retirementAdjustmentByIncomeEventId: Map<string, RetirementOverlapAdjustment>,
  declaredInvestmentIncomeByYear: DeclaredInvestmentIncomeByYear,
) {
  const income = getMemberIncomeBreakdown(scenario, member, fiscalYear, retirementAdjustmentByIncomeEventId, declaredInvestmentIncomeByYear);
  return income.totalIncome <= DEPENDENT_TOTAL_INCOME_LIMIT;
}

function getTaxpayerIncomeBand(taxpayerTotalIncome: number) {
  if (taxpayerTotalIncome <= 9_000_000) return 0;
  if (taxpayerTotalIncome <= 9_500_000) return 1;
  if (taxpayerTotalIncome <= SPOUSE_DEDUCTION_TAXPAYER_INCOME_LIMIT) return 2;
  return -1;
}

function getSpouseSpecialDeductionFromTable(
  spouseTotalIncome: number,
  taxpayerTotalIncome: number,
  table: Array<{ maxSpouseIncome: number; amounts: number[] }>,
) {
  if (spouseTotalIncome <= DEPENDENT_TOTAL_INCOME_LIMIT) return 0;
  const taxpayerBand = getTaxpayerIncomeBand(taxpayerTotalIncome);
  if (taxpayerBand < 0) return 0;
  const row = table.find((item) => spouseTotalIncome <= item.maxSpouseIncome);
  return row ? row.amounts[taxpayerBand] : 0;
}

function getDependentDeductions(
  scenario: ScenarioData,
  memberId: string,
  fiscalYear: number,
  taxpayerTotalIncome: number,
  retirementAdjustmentByIncomeEventId: Map<string, RetirementOverlapAdjustment>,
  declaredInvestmentIncomeByYear: DeclaredInvestmentIncomeByYear,
) {
  const spouseIncomeTax = scenario.householdMembers.reduce((sum, member) => {
    if (member.relationship !== "spouse" || !member.isDependent || member.dependsOnMemberId !== memberId) return sum;
    if (taxpayerTotalIncome > SPOUSE_DEDUCTION_TAXPAYER_INCOME_LIMIT) return sum;
    if (!isDeductionEligibleDependent(scenario, member, fiscalYear, retirementAdjustmentByIncomeEventId, declaredInvestmentIncomeByYear)) return sum;
    return sum + SPOUSE_DEDUCTION_INCOME_TAX;
  }, 0);
  const spouseResidentTax = scenario.householdMembers.reduce((sum, member) => {
    if (member.relationship !== "spouse" || !member.isDependent || member.dependsOnMemberId !== memberId) return sum;
    if (taxpayerTotalIncome > SPOUSE_DEDUCTION_TAXPAYER_INCOME_LIMIT) return sum;
    if (!isDeductionEligibleDependent(scenario, member, fiscalYear, retirementAdjustmentByIncomeEventId, declaredInvestmentIncomeByYear)) return sum;
    return sum + SPOUSE_DEDUCTION_RESIDENT_TAX;
  }, 0);
  const dependentIncomeTax = scenario.householdMembers.reduce((sum, member) => {
    if (member.relationship === "spouse" || !member.isDependent || member.dependsOnMemberId !== memberId) return sum;
    if (!isDeductionEligibleDependent(scenario, member, fiscalYear, retirementAdjustmentByIncomeEventId, declaredInvestmentIncomeByYear)) return sum;
    return sum + DEPENDENT_DEDUCTION_INCOME_TAX;
  }, 0);
  const dependentResidentTax = scenario.householdMembers.reduce((sum, member) => {
    if (member.relationship === "spouse" || !member.isDependent || member.dependsOnMemberId !== memberId) return sum;
    if (!isDeductionEligibleDependent(scenario, member, fiscalYear, retirementAdjustmentByIncomeEventId, declaredInvestmentIncomeByYear)) return sum;
    return sum + DEPENDENT_DEDUCTION_RESIDENT_TAX;
  }, 0);
  const spouseSpecial = scenario.householdMembers.reduce(
    (sum, member) => {
      if (member.relationship !== "spouse" || !member.isDependent || member.dependsOnMemberId !== memberId) return sum;
      const income = getMemberIncomeBreakdown(
        scenario,
        member,
        fiscalYear,
        retirementAdjustmentByIncomeEventId,
        declaredInvestmentIncomeByYear,
      );
      return {
        incomeTax:
          sum.incomeTax +
          getSpouseSpecialDeductionFromTable(
            income.totalIncome,
            taxpayerTotalIncome,
            SPOUSE_SPECIAL_DEDUCTION_INCOME_TAX_TABLE,
          ),
        residentTax:
          sum.residentTax +
          getSpouseSpecialDeductionFromTable(
            income.totalIncome,
            taxpayerTotalIncome,
            SPOUSE_SPECIAL_DEDUCTION_RESIDENT_TAX_TABLE,
          ),
      };
    },
    { incomeTax: 0, residentTax: 0 },
  );

  return {
    incomeTax: spouseIncomeTax + dependentIncomeTax + spouseSpecial.incomeTax,
    residentTax: spouseResidentTax + dependentResidentTax + spouseSpecial.residentTax,
    spouseSpecialIncomeTax: spouseSpecial.incomeTax,
    spouseSpecialResidentTax: spouseSpecial.residentTax,
  };
}

function getItemizedDeductions(scenario: ScenarioData, memberId: string, fiscalYear: number) {
  return (scenario.taxDeductionEvents ?? []).reduce(
    (acc, row) => {
      if (row.memberId !== memberId || row.fiscalYear !== fiscalYear) return acc;
      acc.socialInsurance += Math.max(0, Math.round(row.socialInsuranceDeductionAnnual));
      acc.medical += Math.max(0, Math.round(row.medicalExpenseDeductionAnnual));
      return acc;
    },
    { socialInsurance: 0, medical: 0 },
  );
}

function calculateIncomeTax(taxableIncome: number) {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  if (taxableIncome <= 1_949_000) tax = taxableIncome * 0.05;
  else if (taxableIncome <= 3_299_000) tax = taxableIncome * 0.1 - 97_500;
  else if (taxableIncome <= 6_949_000) tax = taxableIncome * 0.2 - 427_500;
  else if (taxableIncome <= 8_999_000) tax = taxableIncome * 0.23 - 636_000;
  else if (taxableIncome <= 17_999_000) tax = taxableIncome * 0.33 - 1_536_000;
  else if (taxableIncome <= 39_999_000) tax = taxableIncome * 0.4 - 2_796_000;
  else tax = taxableIncome * 0.45 - 4_796_000;
  return Math.max(0, Math.round(tax * (1 + RECOVERY_SPECIAL_TAX_RATE)));
}

function calculateResidentTax(taxableIncome: number, includeFlat = true) {
  if (taxableIncome <= 0) return 0;
  return Math.max(0, Math.round(taxableIncome * RESIDENT_TAX_RATE + (includeFlat ? RESIDENT_TAX_FLAT : 0)));
}

function getRetirementIncomeDeduction(years: number) {
  const roundedYears = Math.max(1, Math.ceil(years));
  if (years <= 0) return 0;
  if (roundedYears <= 20) return Math.max(800_000, roundedYears * 400_000);
  return 8_000_000 + (roundedYears - 20) * 700_000;
}

function calculateRetirementIncome(gross: number, contributionYears: number) {
  if (gross <= 0) return { deduction: 0, income: 0 };
  const deduction = getRetirementIncomeDeduction(contributionYears);
  return calculateRetirementIncomeWithDeduction(gross, deduction);
}

function calculateRetirementIncomeWithDeduction(gross: number, deduction: number) {
  if (gross <= 0) return { deduction: 0, income: 0 };
  return {
    deduction,
    income: Math.max(0, Math.round((gross - deduction) / 2)),
  };
}

function calculateNationalPensionMonthly(fiscalYear: number) {
  const latestYear = Object.keys(NATIONAL_PENSION_MONTHLY_BY_FISCAL_YEAR)
    .map(Number)
    .sort((a, b) => a - b)
    .at(-1);
  if (!latestYear) return 0;
  return NATIONAL_PENSION_MONTHLY_BY_FISCAL_YEAR[fiscalYear] ?? NATIONAL_PENSION_MONTHLY_BY_FISCAL_YEAR[latestYear];
}

function countEligibleNationalPensionMonths(member: HouseholdMember, fiscalYear: number) {
  let count = 0;
  for (const month of getCalendarYearMonths(fiscalYear)) {
    const age = getAgeAtDate(member.birthDate, ym(month).endOf("month"));
    if (age >= 20 && age < 60 && member.isResident && !isLateElderlyMedicalMemberForMonth(member, month)) {
      count += 1;
    }
  }
  return count;
}

function isLateElderlyMedicalMemberForMonth(member: HouseholdMember, yearMonth: YearMonth) {
  if (!member.isResident) return false;
  if (member.isLateElderlyMedicalMember) return true;
  return getAgeAtDate(member.birthDate, ym(yearMonth).endOf("month")) >= 75;
}

function countLateElderlyMedicalMonths(member: HouseholdMember, fiscalYear: number) {
  return getCalendarYearMonths(fiscalYear).filter((month) => isLateElderlyMedicalMemberForMonth(member, month)).length;
}

function countNationalHealthInsuranceMonths(member: HouseholdMember, fiscalYear: number) {
  if (!member.isResident || !member.isNationalHealthInsuranceMember) return 0;
  return getCalendarYearMonths(fiscalYear).filter((month) => !isLateElderlyMedicalMemberForMonth(member, month)).length;
}

function countNursingCareInsuranceMonths(member: HouseholdMember, fiscalYear: number) {
  if (!member.isResident || !member.isNationalHealthInsuranceMember) return 0;
  return getCalendarYearMonths(fiscalYear).filter((month) => {
    const age = getAgeAtDate(member.birthDate, ym(month).endOf("month"));
    return age >= 40 && age <= 64 && !isLateElderlyMedicalMemberForMonth(member, month);
  }).length;
}

function calculateOtaNationalHealthInsurance(
  scenario: ScenarioData,
  fiscalYear: number,
  declaredInvestmentIncomeByYear: DeclaredInvestmentIncomeByYear = new Map(),
) {
  if (!scenario.householdProfile.municipality.includes("大田区")) {
    return {
      nationalHealthInsuranceAnnual: 0,
      nursingCareAnnual: 0,
      nationalHealthInsuranceBreakdown: {
        insuredMemberCount: 0,
        totalBaseIncome: 0,
        medical: 0,
        support: 0,
        childSupport: 0,
        care: 0,
        insuredMemberDetails: [],
      },
    };
  }

  const insuredMembers = scenario.householdMembers
    .map((member) => ({
      member,
      eligibleMonths: countNationalHealthInsuranceMonths(member, fiscalYear),
      careEligibleMonths: countNursingCareInsuranceMonths(member, fiscalYear),
    }))
    .filter((item) => item.eligibleMonths > 0);
  if (insuredMembers.length === 0) {
    return {
      nationalHealthInsuranceAnnual: 0,
      nursingCareAnnual: 0,
      nationalHealthInsuranceBreakdown: {
        insuredMemberCount: 0,
        totalBaseIncome: 0,
        medical: 0,
        support: 0,
        childSupport: 0,
        care: 0,
        insuredMemberDetails: [],
      },
    };
  }

  const memberIncomes = insuredMembers.map((item) => {
    const breakdown = getMemberIncomeBreakdown(
      scenario,
      item.member,
      fiscalYear,
      getRetirementAdjustmentByIncomeEventId(scenario),
      declaredInvestmentIncomeByYear,
    );
    const baseIncome = Math.max(0, breakdown.totalIncome - OTA_NHI.baseIncomeDeduction);
    const age = breakdown.ageAtYearEnd;
    const eligibleRatio = item.eligibleMonths / 12;
    const careEligibleRatio = item.careEligibleMonths / 12;
    return {
      member: item.member,
      age,
      baseIncome: Math.round(baseIncome * eligibleRatio),
      careBaseIncome: Math.round(baseIncome * careEligibleRatio),
      eligibleRatio,
      careEligibleRatio,
    };
  });

  const totalBaseIncome = memberIncomes.reduce((sum, item) => sum + item.baseIncome, 0);
  const insuredMemberCount = memberIncomes.reduce((sum, item) => sum + item.eligibleRatio, 0);
  const childCount = memberIncomes.reduce((sum, item) => sum + (item.age <= 18 ? item.eligibleRatio : 0), 0);
  const careMemberCount = memberIncomes.reduce((sum, item) => sum + item.careEligibleRatio, 0);
  const careBaseIncome = memberIncomes.reduce((sum, item) => sum + item.careBaseIncome, 0);

  const medical = Math.min(
    Math.round(totalBaseIncome * OTA_NHI.medicalIncomeRate) + Math.round(insuredMemberCount * OTA_NHI.medicalPerCapita),
    OTA_NHI.medicalCap,
  );
  const support = Math.min(
    Math.round(totalBaseIncome * OTA_NHI.supportIncomeRate) + Math.round(insuredMemberCount * OTA_NHI.supportPerCapita),
    OTA_NHI.supportCap,
  );
  const childSupport = Math.min(
    Math.round(totalBaseIncome * OTA_NHI.childSupportIncomeRate) + Math.round(childCount * OTA_NHI.childSupportPerCapita),
    OTA_NHI.childSupportCap,
  );
  const care = Math.min(
    Math.round(careBaseIncome * OTA_NHI.careIncomeRate) + Math.round(careMemberCount * OTA_NHI.carePerCapita),
    OTA_NHI.careCap,
  );

  return {
    nationalHealthInsuranceAnnual: medical + support + childSupport,
    nursingCareAnnual: care,
    nationalHealthInsuranceBreakdown: {
      insuredMemberCount,
      totalBaseIncome,
      medical,
      support,
      childSupport,
      care,
      insuredMemberDetails: memberIncomes.map((item) => ({
        memberId: item.member.id,
        memberName: item.member.name,
        ageAtYearEnd: item.age,
        baseIncome: item.baseIncome,
      })),
    },
  };
}

function emptyLateElderlyMedicalBreakdown() {
  return {
    insuredMemberCount: 0,
    totalBaseIncome: 0,
    medical: 0,
    childSupport: 0,
    equalReductionLabel: "該当なし",
    equalReductionJudgmentIncome: 0,
    equalReductionThreshold: 0,
    medicalEqualReductionAmount: 0,
    childSupportEqualReductionAmount: 0,
    incomeReductionAmount: 0,
    insuredMemberDetails: [],
  };
}

function roundDownToHundred(amount: number) {
  return Math.floor(Math.max(0, amount) / 100) * 100;
}

function getLateElderlyEqualReduction(
  scenario: ScenarioData,
  fiscalYear: number,
  insuredMemberCount: number,
  declaredInvestmentIncomeByYear: DeclaredInvestmentIncomeByYear,
) {
  const headMemberId = scenario.householdProfile.headMemberId;
  const insuredIds = new Set(
    scenario.householdMembers
      .filter((member) => countLateElderlyMedicalMonths(member, fiscalYear) > 0)
      .map((member) => member.id),
  );
  if (headMemberId) insuredIds.add(headMemberId);

  let judgmentIncome = 0;
  let salaryOrPensionEarnerCount = 0;
  for (const member of scenario.householdMembers) {
    if (!insuredIds.has(member.id)) continue;
    const income = getMemberIncomeBreakdown(
      scenario,
      member,
      fiscalYear,
      getRetirementAdjustmentByIncomeEventId(scenario),
      declaredInvestmentIncomeByYear,
    );
    judgmentIncome += income.totalIncome;
    if (income.salaryGrossAnnual > 0 || income.pensionGrossAnnual > 0) {
      salaryOrPensionEarnerCount += 1;
    }
  }

  const earnerAdjustment = Math.max(0, salaryOrPensionEarnerCount - 1) * 100_000;
  const thresholds = [
    { ...TOKYO_LATE_ELDERLY_EQUAL_REDUCTION[0], threshold: 430_000 + earnerAdjustment },
    { ...TOKYO_LATE_ELDERLY_EQUAL_REDUCTION[1], threshold: 430_000 + 305_000 * insuredMemberCount + earnerAdjustment },
    { ...TOKYO_LATE_ELDERLY_EQUAL_REDUCTION[2], threshold: 430_000 + 560_000 * insuredMemberCount + earnerAdjustment },
  ];
  const reduction =
    thresholds.find((item) => judgmentIncome <= item.threshold) ?? {
      label: "該当なし",
      medicalRate: 0,
      childSupportRate: 0,
      threshold: thresholds.at(-1)?.threshold ?? 0,
    };
  return { ...reduction, judgmentIncome };
}

function getLateElderlyIncomeReduction(baseIncome: number) {
  return (
    TOKYO_LATE_ELDERLY_INCOME_REDUCTION.find((item) => baseIncome <= item.maxBaseIncome) ?? {
      rate: 0,
      label: "該当なし",
    }
  );
}

function getPensionAndOtherIncomeForBurden(member: AutoTaxMemberDetail) {
  const pensionIncome = Math.max(0, member.pensionGrossAnnual - member.pensionDeductionAnnual);
  const otherIncome = Math.max(
    0,
    member.taxableIncomeBeforeBasicDeductionAnnual - pensionIncome - member.retirementIncomeAnnual,
  );
  return member.pensionGrossAnnual + otherIncome;
}

function calculateLateElderlyBurdenRatios(
  scenario: ScenarioData,
  incomeYearDetail: AutoTaxYearDetail,
): AutoTaxYearDetail["lateElderlyBurdenRatios"] {
  const incomeYear = incomeYearDetail.fiscalYear;
  const periodStartYearMonth = `${incomeYear + 1}-08` as YearMonth;
  const periodEndYearMonth = `${incomeYear + 2}-07` as YearMonth;
  const insuredMembers = scenario.householdMembers.filter((member) => countLateElderlyMedicalMonths(member, incomeYear + 1) > 0);
  if (insuredMembers.length === 0) return [];

  const detailByMemberId = new Map(incomeYearDetail.memberDetails.map((detail) => [detail.memberId, detail]));
  const insuredDetails = insuredMembers
    .map((member) => detailByMemberId.get(member.id))
    .filter((detail): detail is AutoTaxMemberDetail => Boolean(detail));
  const householdPensionAndOtherIncomeAnnual = insuredDetails.reduce((sum, detail) => sum + getPensionAndOtherIncomeForBurden(detail), 0);
  const hasActiveIncomeMember = insuredDetails.some((detail) => detail.residentTaxBaseAnnual >= 1_450_000);
  const hasTwoPercentIncomeMember = insuredDetails.some(
    (detail) => detail.residentTaxBaseAnnual >= 280_000 && detail.residentTaxBaseAnnual < 1_450_000,
  );
  const isNonTaxableHousehold = insuredDetails.every((detail) => detail.residentTaxBaseAnnual <= 0);
  const twoPercentIncomeThreshold = insuredDetails.length >= 2 ? 3_200_000 : 2_000_000;

  return insuredDetails.map((detail) => {
    const pensionAndOtherIncomeAnnual = getPensionAndOtherIncomeForBurden(detail);
    if (hasActiveIncomeMember) {
      return {
        memberId: detail.memberId,
        memberName: detail.memberName,
        incomeYear,
        periodStartYearMonth,
        periodEndYearMonth,
        residentTaxBaseAnnual: detail.residentTaxBaseAnnual,
        pensionAndOtherIncomeAnnual,
        insuredMemberCount: insuredDetails.length,
        householdPensionAndOtherIncomeAnnual,
        burdenRatio: 0.3,
        category: "現役並み所得者",
        reason: "世帯内の後期高齢者に住民税課税所得145万円以上の人がいるため",
      };
    }
    if (!isNonTaxableHousehold && hasTwoPercentIncomeMember && householdPensionAndOtherIncomeAnnual >= twoPercentIncomeThreshold) {
      return {
        memberId: detail.memberId,
        memberName: detail.memberName,
        incomeYear,
        periodStartYearMonth,
        periodEndYearMonth,
        residentTaxBaseAnnual: detail.residentTaxBaseAnnual,
        pensionAndOtherIncomeAnnual,
        insuredMemberCount: insuredDetails.length,
        householdPensionAndOtherIncomeAnnual,
        burdenRatio: 0.2,
        category: "一定以上所得者",
        reason: `課税所得28万円以上145万円未満の人がいて、年金収入+その他所得が基準額${twoPercentIncomeThreshold.toLocaleString()}円以上のため`,
      };
    }
    return {
      memberId: detail.memberId,
      memberName: detail.memberName,
      incomeYear,
      periodStartYearMonth,
      periodEndYearMonth,
      residentTaxBaseAnnual: detail.residentTaxBaseAnnual,
      pensionAndOtherIncomeAnnual,
      insuredMemberCount: insuredDetails.length,
      householdPensionAndOtherIncomeAnnual,
      burdenRatio: 0.1,
      category: "一般所得者等",
      reason: isNonTaxableHousehold ? "住民税非課税世帯として1割判定" : "2割・3割判定に該当しないため",
    };
  });
}

function calculateTokyoLateElderlyMedical(
  scenario: ScenarioData,
  fiscalYear: number,
  declaredInvestmentIncomeByYear: DeclaredInvestmentIncomeByYear = new Map(),
) {
  const insuredMembers = scenario.householdMembers
    .map((member) => ({
      member,
      eligibleMonths: countLateElderlyMedicalMonths(member, fiscalYear),
    }))
    .filter((item) => item.eligibleMonths > 0);
  if (insuredMembers.length === 0) {
    return {
      lateElderlyMedicalAnnual: 0,
      lateElderlyMedicalBreakdown: emptyLateElderlyMedicalBreakdown(),
    };
  }

  const memberIncomes = insuredMembers.map((item) => {
    const breakdown = getMemberIncomeBreakdown(
      scenario,
      item.member,
      fiscalYear,
      getRetirementAdjustmentByIncomeEventId(scenario),
      declaredInvestmentIncomeByYear,
    );
    const baseIncome = Math.max(0, breakdown.totalIncome - TOKYO_LATE_ELDERLY_MEDICAL.baseIncomeDeduction);
    const eligibleRatio = item.eligibleMonths / 12;
    const incomeReduction = getLateElderlyIncomeReduction(baseIncome);
    const medicalIncomeCharge = Math.round(baseIncome * TOKYO_LATE_ELDERLY_MEDICAL.medicalIncomeRate * eligibleRatio);
    const childSupportIncomeCharge = Math.round(baseIncome * TOKYO_LATE_ELDERLY_MEDICAL.childSupportIncomeRate * eligibleRatio);
    const medicalIncomeReductionAmount = roundDownToHundred(medicalIncomeCharge * incomeReduction.rate);
    const childSupportIncomeReductionAmount = roundDownToHundred(childSupportIncomeCharge * incomeReduction.rate);
    return {
      member: item.member,
      age: breakdown.ageAtYearEnd,
      baseIncome: Math.round(baseIncome * eligibleRatio),
      medicalIncomeCharge,
      childSupportIncomeCharge,
      incomeReductionLabel: incomeReduction.label,
      medicalIncomeReductionAmount,
      childSupportIncomeReductionAmount,
      incomeReductionAmount: medicalIncomeReductionAmount + childSupportIncomeReductionAmount,
      eligibleRatio,
    };
  });

  const totalBaseIncome = memberIncomes.reduce((sum, item) => sum + item.baseIncome, 0);
  const insuredMemberCount = memberIncomes.reduce((sum, item) => sum + item.eligibleRatio, 0);
  const equalReduction = getLateElderlyEqualReduction(scenario, fiscalYear, insuredMemberCount, declaredInvestmentIncomeByYear);
  const medicalPerCapitaCharge = Math.round(insuredMemberCount * TOKYO_LATE_ELDERLY_MEDICAL.medicalPerCapita);
  const childSupportPerCapitaCharge = Math.round(insuredMemberCount * TOKYO_LATE_ELDERLY_MEDICAL.childSupportPerCapita);
  const medicalEqualReductionAmount = roundDownToHundred(medicalPerCapitaCharge * equalReduction.medicalRate);
  const childSupportEqualReductionAmount = roundDownToHundred(childSupportPerCapitaCharge * equalReduction.childSupportRate);
  const incomeReductionAmount = memberIncomes.reduce((sum, item) => sum + item.incomeReductionAmount, 0);
  const medicalIncomeCharge = memberIncomes.reduce((sum, item) => sum + item.medicalIncomeCharge, 0);
  const childSupportIncomeCharge = memberIncomes.reduce((sum, item) => sum + item.childSupportIncomeCharge, 0);
  const medical = Math.min(
    roundDownToHundred(
      medicalIncomeCharge +
        medicalPerCapitaCharge -
        medicalEqualReductionAmount -
        memberIncomes.reduce((sum, item) => sum + item.medicalIncomeReductionAmount, 0),
    ),
    TOKYO_LATE_ELDERLY_MEDICAL.medicalCap,
  );
  const childSupport = Math.min(
    roundDownToHundred(
      childSupportIncomeCharge +
        childSupportPerCapitaCharge -
        childSupportEqualReductionAmount -
        memberIncomes.reduce((sum, item) => sum + item.childSupportIncomeReductionAmount, 0),
    ),
    TOKYO_LATE_ELDERLY_MEDICAL.childSupportCap,
  );

  return {
    lateElderlyMedicalAnnual: medical + childSupport,
    lateElderlyMedicalBreakdown: {
      insuredMemberCount,
      totalBaseIncome,
      medical,
      childSupport,
      equalReductionLabel: equalReduction.label,
      equalReductionJudgmentIncome: equalReduction.judgmentIncome,
      equalReductionThreshold: equalReduction.threshold,
      medicalEqualReductionAmount,
      childSupportEqualReductionAmount,
      incomeReductionAmount,
      insuredMemberDetails: memberIncomes.map((item) => ({
        memberId: item.member.id,
        memberName: item.member.name,
        ageAtYearEnd: item.age,
        baseIncome: item.baseIncome,
        incomeReductionLabel: item.incomeReductionLabel,
        incomeReductionAmount: item.incomeReductionAmount,
      })),
    },
  };
}

function getAutoSocialInsuranceDeductionAnnual(
  scenario: ScenarioData,
  member: HouseholdMember,
  fiscalYear: number,
  insuranceByIncomeYear: Map<
    number,
    Pick<AutoTaxYearDetail, "nationalHealthInsuranceAnnual" | "lateElderlyMedicalAnnual" | "nursingCareAnnual">
  >,
) {
  const nationalPensionAnnual = countEligibleNationalPensionMonths(member, fiscalYear) * calculateNationalPensionMonthly(fiscalYear);
  const priorYearInsurance = insuranceByIncomeYear.get(fiscalYear - 1);
  const householdPublicInsurancePaidThisYear =
    member.id === scenario.householdProfile.headMemberId && priorYearInsurance
      ? priorYearInsurance.nationalHealthInsuranceAnnual +
        priorYearInsurance.lateElderlyMedicalAnnual +
        priorYearInsurance.nursingCareAnnual
      : 0;

  return Math.max(0, Math.round(nationalPensionAnnual + householdPublicInsurancePaidThisYear));
}

export function calculateAutoTaxDetails(
  scenario: ScenarioData,
  declaredInvestmentIncomeByYear: DeclaredInvestmentIncomeByYear = new Map(),
): AutoTaxYearDetail[] {
  const fiscalYears = listFiscalYearsForScenario(scenario);
  const retirementAdjustmentByIncomeEventId = getRetirementAdjustmentByIncomeEventId(scenario);
  const insuranceByIncomeYear = new Map<
    number,
    Pick<AutoTaxYearDetail, "nationalHealthInsuranceAnnual" | "lateElderlyMedicalAnnual" | "nursingCareAnnual">
  >();

  for (const fiscalYear of fiscalYears) {
    const otaNhi = calculateOtaNationalHealthInsurance(scenario, fiscalYear, declaredInvestmentIncomeByYear);
    const lateElderlyMedical = calculateTokyoLateElderlyMedical(scenario, fiscalYear, declaredInvestmentIncomeByYear);
    insuranceByIncomeYear.set(fiscalYear, {
      nationalHealthInsuranceAnnual: otaNhi.nationalHealthInsuranceAnnual,
      lateElderlyMedicalAnnual: lateElderlyMedical.lateElderlyMedicalAnnual,
      nursingCareAnnual: otaNhi.nursingCareAnnual,
    });
  }

  return fiscalYears.map((fiscalYear) => {
    const perMember = scenario.householdMembers.map((member) => {
      const income = getMemberIncomeBreakdown(
        scenario,
        member,
        fiscalYear,
        retirementAdjustmentByIncomeEventId,
        declaredInvestmentIncomeByYear,
      );
      const deductions = getDependentDeductions(
        scenario,
        member.id,
        fiscalYear,
        income.totalIncome,
        retirementAdjustmentByIncomeEventId,
        declaredInvestmentIncomeByYear,
      );
      const itemizedDeductions = getItemizedDeductions(scenario, member.id, fiscalYear);
      const manualSocialInsuranceDeductionAnnual = itemizedDeductions.socialInsurance;
      const autoSocialInsuranceDeductionAnnual = getAutoSocialInsuranceDeductionAnnual(
        scenario,
        member,
        fiscalYear,
        insuranceByIncomeYear,
      );
      const socialInsuranceDeductionAnnual = manualSocialInsuranceDeductionAnnual + autoSocialInsuranceDeductionAnnual;
      const medicalExpenseDeductionAnnual = itemizedDeductions.medical;
      const nationalPensionEligibleMonths = countEligibleNationalPensionMonths(member, fiscalYear);
      const incomeTaxBase = Math.max(
        0,
        income.totalIncome - INCOME_TAX_BASIC_DEDUCTION - deductions.incomeTax - socialInsuranceDeductionAnnual - medicalExpenseDeductionAnnual,
      );
      const residentTaxBase = Math.max(
        0,
        income.totalIncome - RESIDENT_TAX_BASIC_DEDUCTION - deductions.residentTax - socialInsuranceDeductionAnnual - medicalExpenseDeductionAnnual,
      );
      const nationalPensionMonthly = nationalPensionEligibleMonths > 0 ? calculateNationalPensionMonthly(fiscalYear) : 0;
      const incomeTaxAnnual = calculateIncomeTax(incomeTaxBase);
      const residentTaxAnnual = calculateResidentTax(residentTaxBase);

      return {
        memberId: member.id,
        memberName: member.name,
        relationship: member.relationship,
        ageAtYearEnd: income.ageAtYearEnd,
        salaryGrossAnnual: income.salaryGrossAnnual,
        salaryDeductionAnnual: income.salaryDeductionAnnual,
        pensionGrossAnnual: income.pensionGrossAnnual,
        pensionDeductionAnnual: income.pensionDeductionAnnual,
        miscellaneousIncomeAnnual: income.miscellaneousIncome,
        retirementGrossAnnual: income.retirementGrossAnnual,
        retirementIncomeDeductionAnnual: income.retirementIncomeDeductionAnnual,
        retirementIncomeAnnual: income.retirementIncomeAnnual,
        retirementIncomeTaxAnnual: income.retirementIncomeTaxAnnual,
        retirementResidentTaxAnnual: income.retirementResidentTaxAnnual,
        manualSocialInsuranceDeductionAnnual,
        autoSocialInsuranceDeductionAnnual,
        socialInsuranceDeductionAnnual,
        medicalExpenseDeductionAnnual,
        taxableIncomeBeforeBasicDeductionAnnual: income.totalIncome,
        basicDeductionAnnual: INCOME_TAX_BASIC_DEDUCTION,
        dependentDeductionsIncomeTaxAnnual: deductions.incomeTax,
        dependentDeductionsResidentTaxAnnual: deductions.residentTax,
        spouseSpecialDeductionIncomeTaxAnnual: deductions.spouseSpecialIncomeTax,
        spouseSpecialDeductionResidentTaxAnnual: deductions.spouseSpecialResidentTax,
        incomeTaxBaseAnnual: incomeTaxBase,
        residentTaxBaseAnnual: residentTaxBase,
        incomeTaxAnnual,
        residentTaxAnnual,
        nationalPensionMonthly,
        nationalPensionAnnual: nationalPensionMonthly * nationalPensionEligibleMonths,
      };
    });

    const otaNhi = calculateOtaNationalHealthInsurance(scenario, fiscalYear, declaredInvestmentIncomeByYear);
    const lateElderlyMedical = calculateTokyoLateElderlyMedical(scenario, fiscalYear, declaredInvestmentIncomeByYear);
    const detailForBurdenRatio: AutoTaxYearDetail = {
      fiscalYear,
      memberDetails: perMember,
      nationalHealthInsuranceAnnual: otaNhi.nationalHealthInsuranceAnnual,
      lateElderlyMedicalAnnual: lateElderlyMedical.lateElderlyMedicalAnnual,
      nursingCareAnnual: otaNhi.nursingCareAnnual,
      otherPublicCostAnnual: 0,
      nationalHealthInsuranceBreakdown: otaNhi.nationalHealthInsuranceBreakdown,
      lateElderlyMedicalBreakdown: lateElderlyMedical.lateElderlyMedicalBreakdown,
      lateElderlyBurdenRatios: [],
    };

    return {
      ...detailForBurdenRatio,
      lateElderlyBurdenRatios: calculateLateElderlyBurdenRatios(scenario, detailForBurdenRatio),
    };
  });
}

export function calculateAutoTaxRows(
  scenario: ScenarioData,
  declaredInvestmentIncomeByYear: DeclaredInvestmentIncomeByYear = new Map(),
): TaxInsuranceByFiscalYear[] {
  return calculateAutoTaxDetails(scenario, declaredInvestmentIncomeByYear).map((detail) => ({
    id: `auto-tax-${detail.fiscalYear}`,
    fiscalYear: detail.fiscalYear,
    residentTaxAnnual: detail.memberDetails.reduce((sum, member) => sum + member.residentTaxAnnual + member.retirementResidentTaxAnnual, 0),
    incomeTaxAnnual: detail.memberDetails.reduce((sum, member) => sum + member.incomeTaxAnnual + member.retirementIncomeTaxAnnual, 0),
    nationalHealthInsuranceAnnual: detail.nationalHealthInsuranceAnnual,
    lateElderlyMedicalAnnual: detail.lateElderlyMedicalAnnual,
    nationalPensionMonthly: detail.memberDetails.reduce((sum, member) => sum + member.nationalPensionMonthly, 0),
    nationalPensionAnnual: detail.memberDetails.reduce((sum, member) => sum + member.nationalPensionAnnual, 0),
    nursingCareAnnual: detail.nursingCareAnnual,
    otherPublicCostAnnual: detail.otherPublicCostAnnual,
  }));
}

function mergeTaxRows(autoRows: TaxInsuranceByFiscalYear[], manualRows: TaxInsuranceByFiscalYear[]) {
  const adjustments = new Map(manualRows.map((row) => [row.fiscalYear, row]));
  return autoRows.map((row) => {
    const adjustment = adjustments.get(row.fiscalYear);
    if (!adjustment) return row;
    return {
      ...row,
      residentTaxAnnual: row.residentTaxAnnual + adjustment.residentTaxAnnual,
      incomeTaxAnnual: row.incomeTaxAnnual + adjustment.incomeTaxAnnual,
      nationalHealthInsuranceAnnual: row.nationalHealthInsuranceAnnual + adjustment.nationalHealthInsuranceAnnual,
      lateElderlyMedicalAnnual: (row.lateElderlyMedicalAnnual ?? 0) + (adjustment.lateElderlyMedicalAnnual ?? 0),
      nationalPensionMonthly: row.nationalPensionMonthly + adjustment.nationalPensionMonthly,
      nationalPensionAnnual: (row.nationalPensionAnnual ?? row.nationalPensionMonthly * 12) + (adjustment.nationalPensionAnnual ?? adjustment.nationalPensionMonthly * 12),
      nursingCareAnnual: row.nursingCareAnnual + adjustment.nursingCareAnnual,
      otherPublicCostAnnual: row.otherPublicCostAnnual + adjustment.otherPublicCostAnnual,
    };
  });
}

export function getEffectiveTaxRows(
  scenario: ScenarioData,
  declaredInvestmentIncomeByYear: DeclaredInvestmentIncomeByYear = new Map(),
) {
  const mode: TaxCalculationMode = scenario.householdProfile.taxCalculationMode;
  if (mode === "manual") return scenario.taxInsurance;
  const autoRows = calculateAutoTaxRows(scenario, declaredInvestmentIncomeByYear);
  if (mode === "auto") return autoRows;
  return mergeTaxRows(autoRows, scenario.taxInsurance);
}
