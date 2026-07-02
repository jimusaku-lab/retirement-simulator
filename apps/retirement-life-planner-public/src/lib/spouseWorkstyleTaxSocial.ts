import type { YearMonth } from "@/types";

export type WorkplaceSocialInsuranceSettings = {
  joinStartYearMonth?: YearMonth;
  weeklyScheduledHours?: number;
  monthlyScheduledDays?: number;
  regularWorkerWeeklyHours?: number;
  regularWorkerMonthlyDays?: number;
  monthlyStandardWage?: number;
  isStudent?: boolean;
  workplaceEmployeeCount?: number;
  isVoluntarySpecifiedWorkplace?: boolean;
  isApplicableWorkplace?: boolean;
  premiumMode?: "estimate" | "manual" | "detail";
  manualPremiumMonthly?: number;
};

export type WorkplaceSocialInsuranceJudgment = {
  covered: boolean;
  reason: "notApplicableWorkplace" | "threeQuarter" | "shortTimeWorker" | "underThreshold";
  shortTimeEmployeeThreshold: number;
  wageRequirementApplies: boolean;
};

export type SpouseDeductionKind = "spouse" | "special" | "none";

export type SpouseDeductionResult = {
  kind: SpouseDeductionKind;
  amount: number;
};

const INCOME_TAX_SPOUSE_SPECIAL_TABLE = [
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

const RESIDENT_TAX_SPOUSE_SPECIAL_TABLE = [
  { maxSpouseIncome: 1_000_000, amounts: [330_000, 220_000, 110_000] },
  { maxSpouseIncome: 1_050_000, amounts: [310_000, 210_000, 110_000] },
  { maxSpouseIncome: 1_100_000, amounts: [260_000, 180_000, 90_000] },
  { maxSpouseIncome: 1_150_000, amounts: [210_000, 140_000, 70_000] },
  { maxSpouseIncome: 1_200_000, amounts: [160_000, 110_000, 60_000] },
  { maxSpouseIncome: 1_250_000, amounts: [110_000, 80_000, 40_000] },
  { maxSpouseIncome: 1_300_000, amounts: [60_000, 40_000, 20_000] },
  { maxSpouseIncome: 1_330_000, amounts: [30_000, 20_000, 10_000] },
];

export const OtaNationalHealthInsuranceRates = {
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

export function getSalaryIncomeDeductionForYear(grossAnnual: number, incomeYear: number) {
  const amount = Math.max(0, grossAnnual);
  if (amount <= 0) return 0;

  if (incomeYear === 2026 || incomeYear === 2027) {
    if (amount <= 1_900_000) return 740_000;
    if (amount <= 3_600_000) return amount * 0.3 + 80_000;
    if (amount <= 6_600_000) return amount * 0.2 + 440_000;
    if (amount <= 8_500_000) return amount * 0.1 + 1_100_000;
    return 1_950_000;
  }

  if (amount <= 1_625_000) return 550_000;
  if (amount <= 1_800_000) return amount * 0.4 - 100_000;
  if (amount <= 3_600_000) return amount * 0.3 + 80_000;
  if (amount <= 6_600_000) return amount * 0.2 + 440_000;
  if (amount <= 8_500_000) return amount * 0.1 + 1_100_000;
  return 1_950_000;
}

export function getSalaryIncomeForYear(grossAnnual: number, incomeYear: number) {
  return Math.max(0, Math.round(grossAnnual - getSalaryIncomeDeductionForYear(grossAnnual, incomeYear)));
}

export function getNationalHealthInsuranceBaseIncome(totalIncome: number) {
  return Math.max(0, Math.round(totalIncome - OtaNationalHealthInsuranceRates.baseIncomeDeduction));
}

export function getIncomeTaxBasicDeduction(totalIncome: number, incomeYear: number) {
  if (incomeYear === 2026 || incomeYear === 2027) {
    if (totalIncome <= 1_320_000) return 1_040_000;
    if (totalIncome <= 3_360_000) return 880_000;
    if (totalIncome <= 4_890_000) return 680_000;
    if (totalIncome <= 6_550_000) return 630_000;
    if (totalIncome <= 23_500_000) return 580_000;
  }
  if (totalIncome <= 23_500_000) return 480_000;
  if (totalIncome <= 24_000_000) return 320_000;
  if (totalIncome <= 24_500_000) return 160_000;
  return 0;
}

export function getDependentTotalIncomeLimitForIncomeTaxYear(incomeYear: number) {
  return incomeYear >= 2026 ? 620_000 : 580_000;
}

export function getDependentTotalIncomeLimitForResidentTaxFiscalYear(fiscalYear: number) {
  return fiscalYear >= 2027 ? 620_000 : 580_000;
}

function getTaxpayerIncomeBand(taxpayerTotalIncome: number) {
  if (taxpayerTotalIncome <= 9_000_000) return 0;
  if (taxpayerTotalIncome <= 9_500_000) return 1;
  if (taxpayerTotalIncome <= 10_000_000) return 2;
  return -1;
}

function getSpecialDeduction(
  spouseTotalIncome: number,
  taxpayerTotalIncome: number,
  dependentLimit: number,
  spouseAmounts: number[],
  table: Array<{ maxSpouseIncome: number; amounts: number[] }>,
): SpouseDeductionResult {
  const band = getTaxpayerIncomeBand(taxpayerTotalIncome);
  if (band < 0) return { kind: "none", amount: 0 };
  if (spouseTotalIncome <= dependentLimit) return { kind: "spouse", amount: spouseAmounts[band] };
  const row = table.find((item) => spouseTotalIncome <= item.maxSpouseIncome);
  return row ? { kind: "special", amount: row.amounts[band] } : { kind: "none", amount: 0 };
}

export function getSpouseDeductionForIncomeTax(spouseTotalIncome: number, taxpayerTotalIncome: number, incomeYear: number) {
  return getSpecialDeduction(
    spouseTotalIncome,
    taxpayerTotalIncome,
    getDependentTotalIncomeLimitForIncomeTaxYear(incomeYear),
    [380_000, 260_000, 130_000],
    INCOME_TAX_SPOUSE_SPECIAL_TABLE,
  );
}

export function getSpouseDeductionForResidentTax(spouseTotalIncome: number, taxpayerTotalIncome: number, residentTaxFiscalYear: number) {
  return getSpecialDeduction(
    spouseTotalIncome,
    taxpayerTotalIncome,
    getDependentTotalIncomeLimitForResidentTaxFiscalYear(residentTaxFiscalYear),
    [330_000, 220_000, 110_000],
    RESIDENT_TAX_SPOUSE_SPECIAL_TABLE,
  );
}

export function getOtaResidentTaxFullyNonTaxableLimit(dependentCount: number) {
  return dependentCount <= 0 ? 450_000 : 350_000 * (dependentCount + 1) + 310_000;
}

export function getOtaResidentTaxIncomeRateOnlyNonTaxableLimit(dependentCount: number) {
  return dependentCount <= 0 ? 450_000 : 350_000 * (dependentCount + 1) + 420_000;
}

export function isOtaResidentTaxFullyNonTaxable(totalIncome: number, dependentCount: number) {
  return totalIncome <= getOtaResidentTaxFullyNonTaxableLimit(dependentCount);
}

export function isOtaResidentTaxIncomeRateOnlyNonTaxable(totalIncome: number, dependentCount: number) {
  return totalIncome <= getOtaResidentTaxIncomeRateOnlyNonTaxableLimit(dependentCount);
}

function getShortTimeEmployeeThreshold(yearMonth: YearMonth) {
  return yearMonth >= "2027-10" ? 36 : 51;
}

export function judgeWorkplaceSocialInsurance(
  settings: WorkplaceSocialInsuranceSettings | undefined,
  yearMonth: YearMonth,
): WorkplaceSocialInsuranceJudgment {
  const threshold = getShortTimeEmployeeThreshold(yearMonth);
  const wageRequirementApplies = yearMonth < "2026-10";
  if (!settings?.isApplicableWorkplace) {
    return { covered: false, reason: "notApplicableWorkplace", shortTimeEmployeeThreshold: threshold, wageRequirementApplies };
  }

  const weekly = settings.weeklyScheduledHours ?? 0;
  const monthlyDays = settings.monthlyScheduledDays ?? 0;
  const regularWeekly = settings.regularWorkerWeeklyHours ?? 40;
  const regularMonthlyDays = settings.regularWorkerMonthlyDays ?? 20;
  if (regularWeekly > 0 && regularMonthlyDays > 0 && weekly >= regularWeekly * 0.75 && monthlyDays >= regularMonthlyDays * 0.75) {
    return { covered: true, reason: "threeQuarter", shortTimeEmployeeThreshold: threshold, wageRequirementApplies };
  }

  const workplaceSizeOk =
    (settings.workplaceEmployeeCount ?? 0) >= threshold || settings.isVoluntarySpecifiedWorkplace === true;
  const wageOk = !wageRequirementApplies || (settings.monthlyStandardWage ?? 0) >= 88_000;
  if (workplaceSizeOk && weekly >= 20 && wageOk && settings.isStudent !== true) {
    return { covered: true, reason: "shortTimeWorker", shortTimeEmployeeThreshold: threshold, wageRequirementApplies };
  }

  return { covered: false, reason: "underThreshold", shortTimeEmployeeThreshold: threshold, wageRequirementApplies };
}

export function isWorkplaceSocialInsuranceCovered(settings: WorkplaceSocialInsuranceSettings | undefined, yearMonth: YearMonth) {
  if (!settings) return false;
  if (settings.joinStartYearMonth && yearMonth < settings.joinStartYearMonth) return false;
  return judgeWorkplaceSocialInsurance(settings, yearMonth).covered;
}

export function getOtaNhiEqualReduction(
  householdIncome: number,
  insuredMemberCount: number,
  salaryOrPensionEarnerCount: number,
) {
  const members = Math.max(0, insuredMemberCount);
  const earners = Math.max(0, salaryOrPensionEarnerCount);
  const reductions = [
    { label: "7割軽減", rate: 0.7, threshold: 430_000 + 100_000 * Math.max(0, earners - 1) },
    { label: "5割軽減", rate: 0.5, threshold: 430_000 + 305_000 * members + 100_000 * Math.max(0, earners - 1) },
    { label: "2割軽減", rate: 0.2, threshold: 430_000 + 560_000 * members + 100_000 * Math.max(0, earners - 1) },
  ];
  return reductions.find((item) => householdIncome <= item.threshold) ?? { label: "軽減なし", rate: 0, threshold: 0 };
}
