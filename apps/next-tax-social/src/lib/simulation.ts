import dayjs from "dayjs";
import {
  IDECO_MONEX_MONTHLY_FEE,
  IDECO_MONEX_PAYMENT_FEE,
  getIdecoMonexEndYearMonth,
  getIdecoMonexFirstPayoutYearMonth,
  isIdecoMonexPayoutMonth,
  getIdecoMonexRemainingActiveMonthCount,
  getIdecoMonexRemainingPayoutCount,
  getIncomeEventAmountForMonth,
  isIdecoMonexPensionEvent,
} from "@/lib/incomeEvents";
import { getRetirementOverlapAdjustments, type RetirementOverlapAdjustment } from "@/lib/retirementIncome";
import { getEffectiveTaxRows, type DeclaredInvestmentIncomeByYear } from "@/lib/taxEngine";
import type {
  AnnualResult,
  AssetContributionEvent,
  GainTrackedAssetKey,
  GainTrackedAssetMap,
  HouseholdLivingArrangementEvent,
  IncomeEvent,
  GrowthAssetKey,
  WithdrawalAssetKey,
  ExpenseAdjustmentTarget,
  MonthlyExpenseProfile,
  MonthlyResult,
  NisaInvestmentRules,
  OptionSubAccount,
  ScenarioData,
  SimulationResult,
  SpecialExpenseEvent,
  TaxInsuranceByFiscalYear,
  YearMonth,
} from "@/types";

const ym = (value: YearMonth) => dayjs(`${value}-01`);
const formatYm = (date: dayjs.Dayjs) => date.format("YYYY-MM");
const LISTED_CAPITAL_GAINS_TAX_RATE = 0.20315;
const IDECO_PENSION_WITHHOLDING_TAX_RATE = 0.076575;
const IDECO_LUMP_SUM_NO_DECLARATION_WITHHOLDING_RATE = 0.2042;

const growthAssetOrder: GrowthAssetKey[] = [
  "timeDeposit",
  "specificAccount",
  "ordinaryAccountForOptions",
  "nisa",
  "ideco",
];

const defaultWithdrawOrder: WithdrawalAssetKey[] = [
  "bankDeposit",
  "timeDeposit",
  "specificAccount",
  "ordinaryAccountForOptions",
  "ideco",
  "nisa",
];

const assetDetailLabels: Record<GrowthAssetKey, string> = {
  cash: "現金",
  bankDeposit: "普通預金",
  timeDeposit: "定期預金",
  nisa: "NISA非課税口座",
  specificAccount: "特定口座",
  ordinaryAccountForOptions: "普通口座（オプション用）",
  ideco: "iDeCo",
};

type BalanceMap = {
  cash: number;
  bankDeposit: number;
  timeDeposit: number;
  nisa: number;
  specificAccount: number;
  ordinaryAccountForOptions: number;
  ideco: number;
  excludedAssets: number;
  debt: number;
};

type TaxableBasisMap = {
  nisa: number;
  specificAccount: number;
  ordinaryAccountForOptions: number;
  ideco: number;
};

type OptionSubAccountState = OptionSubAccount & {
  balance: number;
  costBasis: number;
  startFundingApplied: boolean;
};

const gainTrackedAssetKeys: GainTrackedAssetKey[] = [
  "nisa",
  "specificAccount",
  "ordinaryAccountForOptions",
  "ideco",
];

const monthlyExpenseKeys: (keyof MonthlyExpenseProfile)[] = [
  "food",
  "dailyGoods",
  "hobbyEntertainment",
  "social",
  "transportation",
  "clothingBeauty",
  "healthMedical",
  "car",
  "educationCulture",
  "specialExpense",
  "cashCard",
  "utilities",
  "communication",
  "housing",
  "taxSocialInsurance",
  "insurance",
  "other",
];

function getRetirementIncomeDeduction(years: number) {
  const roundedYears = Math.max(1, Math.ceil(years));
  if (roundedYears <= 20) return Math.max(800_000, roundedYears * 400_000);
  return 8_000_000 + (roundedYears - 20) * 700_000;
}

function calculateIdecoLumpSumEstimatedTax(gross: number, contributionYears: number, adjustedDeduction?: number) {
  if (gross <= 0) return 0;
  const deduction = adjustedDeduction ?? getRetirementIncomeDeduction(contributionYears);
  const retirementIncome = Math.max(0, Math.round((gross - deduction) / 2));
  if (retirementIncome <= 0) return 0;
  let incomeTax = 0;
  if (retirementIncome <= 1_949_000) incomeTax = retirementIncome * 0.05;
  else if (retirementIncome <= 3_299_000) incomeTax = retirementIncome * 0.1 - 97_500;
  else if (retirementIncome <= 6_949_000) incomeTax = retirementIncome * 0.2 - 427_500;
  else if (retirementIncome <= 8_999_000) incomeTax = retirementIncome * 0.23 - 636_000;
  else if (retirementIncome <= 17_999_000) incomeTax = retirementIncome * 0.33 - 1_536_000;
  else if (retirementIncome <= 39_999_000) incomeTax = retirementIncome * 0.4 - 2_796_000;
  else incomeTax = retirementIncome * 0.45 - 4_796_000;
  return Math.max(0, Math.round(incomeTax * 1.021 + retirementIncome * 0.1));
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

export function getSimulationTargetAssets(scenario: ScenarioData) {
  const assets = scenario.initialAssets;
  return (
    assets.cash +
    assets.bankDeposit +
    assets.timeDeposit +
    assets.nisa +
    assets.specificAccount +
    assets.ordinaryAccountForOptions +
    assets.ideco -
    assets.debt
  );
}

export function getLiquidAssets(scenario: ScenarioData) {
  const assets = scenario.initialAssets;
  return assets.cash + assets.bankDeposit + assets.timeDeposit;
}

export function getTotalAssets(scenario: ScenarioData) {
  return getSimulationTargetAssets(scenario) + scenario.initialAssets.excludedAssets;
}

export function getBaseMonthlyExpense(expenses: MonthlyExpenseProfile, excludeTaxExpense = false) {
  return (Object.entries(expenses) as [keyof MonthlyExpenseProfile, number][])
    .reduce((sum, [key, value]) => sum + (excludeTaxExpense && key === "taxSocialInsurance" ? 0 : value), 0);
}

function getAdjustedMonthlyExpense(
  scenario: ScenarioData,
  monthsFromStart: number,
  ageYears: number,
  excludeTaxExpense = false,
  previousYearExpenseProfile?: MonthlyExpenseProfile,
  expenseProfilesByYearMonth?: Map<YearMonth, MonthlyExpenseProfile>,
) {
  const inflationFactor = scenario.inflationSettings.enabled
    ? Math.pow(1 + scenario.inflationSettings.livingCostAnnualInflationRate, monthsFromStart / 12)
    : 1;
  const medicalInflationFactor = scenario.inflationSettings.enabled
    ? Math.pow(1 + scenario.inflationSettings.medicalAnnualInflationRate, monthsFromStart / 12)
    : 1;
  const livingCostInflationTargets =
    scenario.inflationSettings.livingCostInflationTargets ?? monthlyExpenseKeys.filter((key) => key !== "healthMedical");
  const medicalInflationTargets = scenario.inflationSettings.medicalInflationTargets ?? ["healthMedical"];
  const expenses = Object.fromEntries(
    (Object.entries(scenario.monthlyExpenses) as [keyof MonthlyExpenseProfile, number][]).map(([key, value]) => {
      const base = excludeTaxExpense && key === "taxSocialInsurance" ? 0 : value;
      const factor = medicalInflationTargets.includes(key)
        ? medicalInflationFactor
        : livingCostInflationTargets.includes(key)
          ? inflationFactor
          : 1;
      return [key, base * factor];
    }),
  ) as MonthlyExpenseProfile;

  for (const event of scenario.householdLivingArrangementEvents ?? []) {
    const active = yearMonthFromStart(scenario.userProfile.simulationStartYearMonth, monthsFromStart) >= event.changeYearMonth;
    if (!active) continue;
    applyHouseholdLivingArrangementEvent(expenses, event);
  }

  for (const adjustment of scenario.ageExpenseAdjustments ?? []) {
    const active = ageYears >= adjustment.startAge && (!adjustment.endAge || ageYears <= adjustment.endAge);
    if (!active) continue;
    const startPreviousYearExpenseProfile =
      adjustment.mode === "startPreviousYearMultiplier"
        ? expenseProfilesByYearMonth?.get(
            formatYm(
              ym(yearMonthFromStart(scenario.userProfile.simulationStartYearMonth, monthsFromStart)).subtract(
                Math.max(1, ageYears - adjustment.startAge + 1),
                "year",
              ),
            ),
          )
        : undefined;
    applyAgeExpenseAdjustment(
      expenses,
      getAgeExpenseAdjustmentTargets(adjustment),
      adjustment.mode,
      adjustment.value,
      previousYearExpenseProfile,
      startPreviousYearExpenseProfile,
    );
  }

  return expenses;
}

function sumMonthlyExpenseProfile(expenses: MonthlyExpenseProfile) {
  return Object.values(expenses).reduce((sum, value) => sum + value, 0);
}

function getAgeExpenseAdjustmentTargets(adjustment: { target?: ExpenseAdjustmentTarget; targets?: ExpenseAdjustmentTarget[] }) {
  const targets = adjustment.targets?.length ? adjustment.targets : [adjustment.target ?? "all"];
  const validTargets = targets.filter((target) => target === "all" || monthlyExpenseKeys.includes(target));
  if (validTargets.includes("all")) return ["all"] as ExpenseAdjustmentTarget[];
  return validTargets.length ? validTargets : (["all"] as ExpenseAdjustmentTarget[]);
}

function yearMonthFromStart(startYearMonth: YearMonth, monthsFromStart: number) {
  return formatYm(ym(startYearMonth).add(monthsFromStart, "month"));
}

function applyHouseholdLivingArrangementEvent(
  expenses: MonthlyExpenseProfile,
  event: HouseholdLivingArrangementEvent,
) {
  if (!event.appliesToLivingExpenses || event.changeType !== "moveOut" || event.expenseKeys.length === 0) return;
  const targetKeys = event.expenseKeys.filter((key) => expenses[key] > 0);
  if (targetKeys.length === 0) return;

  if (event.reductionMode === "percentage") {
    const rate = Math.min(Math.max(event.reductionRate, 0), 1);
    for (const key of targetKeys) {
      expenses[key] = Math.max(0, expenses[key] * (1 - rate));
    }
    return;
  }

  const total = targetKeys.reduce((sum, key) => sum + expenses[key], 0);
  if (total <= 0) return;
  const reduction = Math.min(Math.max(event.reductionAmount, 0), total);
  for (const key of targetKeys) {
    expenses[key] = Math.max(0, expenses[key] - reduction * (expenses[key] / total));
  }
}

function applyAgeExpenseAdjustment(
  expenses: MonthlyExpenseProfile,
  targets: ExpenseAdjustmentTarget[],
  mode: "setAmount" | "multiplier" | "yearOverYearMultiplier" | "startPreviousYearMultiplier",
  value: number,
  previousYearExpenseProfile?: MonthlyExpenseProfile,
  startPreviousYearExpenseProfile?: MonthlyExpenseProfile,
) {
  if (targets.includes("all")) {
    if (mode === "multiplier") {
      for (const key of Object.keys(expenses) as (keyof MonthlyExpenseProfile)[]) {
        expenses[key] *= value;
      }
      return;
    }
    if (mode === "yearOverYearMultiplier") {
      const basis = previousYearExpenseProfile ?? expenses;
      for (const key of Object.keys(expenses) as (keyof MonthlyExpenseProfile)[]) {
        expenses[key] = basis[key] * value;
      }
      return;
    }
    if (mode === "startPreviousYearMultiplier") {
      const basis = startPreviousYearExpenseProfile ?? previousYearExpenseProfile ?? expenses;
      for (const key of Object.keys(expenses) as (keyof MonthlyExpenseProfile)[]) {
        expenses[key] = basis[key] * value;
      }
      return;
    }

    const currentTotal = Object.values(expenses).reduce((sum, amount) => sum + amount, 0);
    if (currentTotal <= 0) return;
    const scale = value / currentTotal;
    for (const key of Object.keys(expenses) as (keyof MonthlyExpenseProfile)[]) {
      expenses[key] *= scale;
    }
    return;
  }

  for (const target of targets.filter((item): item is keyof MonthlyExpenseProfile => item !== "all")) {
    if (mode === "multiplier") {
      expenses[target] *= value;
    } else if (mode === "yearOverYearMultiplier") {
      expenses[target] = (previousYearExpenseProfile?.[target] ?? expenses[target]) * value;
    } else if (mode === "startPreviousYearMultiplier") {
      expenses[target] = (startPreviousYearExpenseProfile?.[target] ?? previousYearExpenseProfile?.[target] ?? expenses[target]) * value;
    } else {
      expenses[target] = value;
    }
  }
}

export function getEndYearMonth(scenario: ScenarioData) {
  const { userProfile } = scenario;
  if (userProfile.simulationEndMode === "yearMonth" && userProfile.simulationEndYearMonth) {
    return userProfile.simulationEndYearMonth;
  }
  const endAge = userProfile.simulationEndAge ?? 95;
  return formatYm(dayjs(userProfile.birthDate).add(endAge, "year").endOf("month"));
}

function getTargetBalanceYearMonth(scenario: ScenarioData) {
  return formatYm(dayjs(scenario.userProfile.birthDate).add(scenario.userProfile.targetBalanceAge, "year").endOf("month"));
}

export function getAgeAtYearMonth(birthDate: string, yearMonth: YearMonth) {
  const birth = dayjs(birthDate);
  const target = ym(yearMonth).endOf("month");
  let years = target.year() - birth.year();
  let months = target.month() - birth.month();
  if (target.date() < birth.date()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months };
}

export function isEventActive(event: Pick<IncomeEvent, "startYearMonth" | "endYearMonth">, yearMonth: YearMonth) {
  return yearMonth >= event.startYearMonth && (!event.endYearMonth || yearMonth <= event.endYearMonth);
}

export function isContributionActive(
  event: Pick<AssetContributionEvent, "startYearMonth" | "endYearMonth">,
  yearMonth: YearMonth,
) {
  return yearMonth >= event.startYearMonth && (!event.endYearMonth || yearMonth <= event.endYearMonth);
}

function isSpecialExpenseActive(
  event: Pick<SpecialExpenseEvent, "yearMonth" | "endYearMonth" | "schedule" | "repeatIntervalMonths">,
  yearMonth: YearMonth,
) {
  const schedule = event.schedule ?? "once";
  if (schedule === "once") {
    return yearMonth === event.yearMonth;
  }
  if (yearMonth < event.yearMonth) return false;
  if (event.endYearMonth && yearMonth > event.endYearMonth) return false;
  const diffMonths = ym(yearMonth).diff(ym(event.yearMonth), "month");
  if (diffMonths < 0) return false;
  if (schedule === "monthly") return diffMonths % 1 === 0;
  if (schedule === "quarterly") return diffMonths % 3 === 0;
  if (schedule === "semiannual") return diffMonths % 6 === 0;
  if (schedule === "yearly") return diffMonths % 12 === 0;
  const interval = Math.max(1, Math.round(event.repeatIntervalMonths ?? 1));
  return diffMonths % interval === 0;
}

export function getIncomeForMonth(events: IncomeEvent[], yearMonth: YearMonth, monthsFromStart: number, pensionAdjustmentRate = 0) {
  return events.reduce((sum, event) => {
    if (!isEventActive(event, yearMonth)) return sum;
    const base = event.amountInputMode === "annual" ? event.monthlyAmount / 12 : event.monthlyAmount;
    const adjusted =
      event.type === "pension" && pensionAdjustmentRate !== 0
        ? base * Math.pow(1 + pensionAdjustmentRate, monthsFromStart / 12)
        : base;
    return sum + adjusted;
  }, 0);
}

export function getTaxInsuranceForMonth(
  taxRows: TaxInsuranceByFiscalYear[],
  yearMonth: YearMonth,
  mode: "fiscal" | "calendar" = "fiscal",
) {
  const date = ym(yearMonth);
  const fiscalYear = mode === "calendar" ? date.year() : date.month() >= 3 ? date.year() : date.year() - 1;
  const sortedRows = [...taxRows].sort((a, b) => a.fiscalYear - b.fiscalYear);
  const row =
    sortedRows.find((item) => item.fiscalYear === fiscalYear) ??
    sortedRows.filter((item) => item.fiscalYear < fiscalYear).at(-1) ??
    sortedRows[0];
  if (!row) return 0;
  return (
    row.residentTaxAnnual / 12 +
    row.incomeTaxAnnual / 12 +
    row.nationalHealthInsuranceAnnual / 12 +
    (row.lateElderlyMedicalAnnual ?? 0) / 12 +
    getNationalPensionAnnual(row) / 12 +
    row.nursingCareAnnual / 12 +
    row.otherPublicCostAnnual / 12
  );
}

function getNationalPensionAnnual(row: TaxInsuranceByFiscalYear) {
  return row.nationalPensionAnnual ?? row.nationalPensionMonthly * 12;
}

function getTaxRowForYear(taxRows: TaxInsuranceByFiscalYear[], year: number) {
  const sortedRows = [...taxRows].sort((a, b) => a.fiscalYear - b.fiscalYear);
  return (
    sortedRows.find((item) => item.fiscalYear === year) ??
    sortedRows.filter((item) => item.fiscalYear < year).at(-1)
  );
}

function getAutoTaxCashPaymentForMonth(
  taxRows: TaxInsuranceByFiscalYear[],
  yearMonth: YearMonth,
  idecoWithholdingByIncomeYear: Map<number, number>,
) {
  const date = ym(yearMonth);
  const paymentYear = date.year();
  const incomeYear = paymentYear - 1;
  const priorYearRow = getTaxRowForYear(taxRows, incomeYear);
  const currentYearRow = getTaxRowForYear(taxRows, paymentYear);
  const priorYearIdecoWithholding = idecoWithholdingByIncomeYear.get(incomeYear) ?? 0;
  const incomeTaxSettlement = priorYearRow ? priorYearRow.incomeTaxAnnual - priorYearIdecoWithholding : 0;
  const delayedPriorYearCosts = priorYearRow
    ? (
        priorYearRow.residentTaxAnnual +
        incomeTaxSettlement +
        priorYearRow.nationalHealthInsuranceAnnual +
        (priorYearRow.lateElderlyMedicalAnnual ?? 0) +
        priorYearRow.nursingCareAnnual +
        priorYearRow.otherPublicCostAnnual
      ) / 12
    : 0;

  return delayedPriorYearCosts + (currentYearRow ? getNationalPensionAnnual(currentYearRow) / 12 : 0);
}

function getTaxInsuranceCashPaymentForMonth(
  scenario: ScenarioData,
  taxRows: TaxInsuranceByFiscalYear[],
  yearMonth: YearMonth,
  idecoWithholdingByIncomeYear: Map<number, number>,
  deferredCapitalGainsTaxByIncomeYear: Map<number, number>,
) {
  if (scenario.householdProfile.taxCalculationMode === "manual") {
    return getTaxInsuranceForMonth(taxRows, yearMonth, "fiscal");
  }
  return getAutoTaxCashPaymentForMonth(taxRows, yearMonth, idecoWithholdingByIncomeYear) +
    (deferredCapitalGainsTaxByIncomeYear.get(ym(yearMonth).year() - 1) ?? 0) / 12;
}

function getEffectiveOptionSubAccounts(scenario: ScenarioData): OptionSubAccount[] {
  if (scenario.optionSubAccounts?.length) return scenario.optionSubAccounts;
  return [
    {
      id: "option-default",
      name: "普通口座（オプション用）",
      initialValue: scenario.initialAssets.ordinaryAccountForOptions,
      initialCostBasis: Math.min(
        scenario.initialAssetCostBasis.ordinaryAccountForOptions,
        scenario.initialAssets.ordinaryAccountForOptions,
      ),
      startYearMonth: scenario.userProfile.simulationStartYearMonth,
      enabled: scenario.optionAccountRules.enabled,
      minimumBalance: scenario.optionAccountRules.minimumBalance,
      targetBalance: scenario.optionAccountRules.targetBalance,
      withdrawalPriority: 1,
      protectFromWithdrawal: scenario.optionAccountRules.protectFromWithdrawal,
      releaseProtectionAfterEnd: true,
      suspendIncomeWhenBelowMinimum: scenario.optionAccountRules.suspendIncomeWhenBelowMinimum,
      profitSweepEnabled: scenario.optionAccountRules.profitSweepEnabled,
      profitSweepDestination: scenario.optionAccountRules.profitSweepDestination,
      profitSweepTiming: scenario.optionAccountRules.profitSweepTiming,
      profitSweepMethod: scenario.optionAccountRules.profitSweepMethod,
      fixedSweepAmount: scenario.optionAccountRules.fixedSweepAmount,
    },
  ];
}

function createOptionSubAccountStates(scenario: ScenarioData): OptionSubAccountState[] {
  const simulationStart = ym(scenario.userProfile.simulationStartYearMonth);
  return getEffectiveOptionSubAccounts(scenario)
    .filter((account) => account.enabled)
    .map((account, index) => ({
      ...account,
      withdrawalPriority: Number.isFinite(account.withdrawalPriority) ? account.withdrawalPriority : index + 1,
      balance: account.startYearMonth && ym(account.startYearMonth).isAfter(simulationStart, "month")
        ? 0
        : Math.max(0, account.initialValue),
      costBasis: account.startYearMonth && ym(account.startYearMonth).isAfter(simulationStart, "month")
        ? 0
        : Math.min(Math.max(0, account.initialCostBasis), Math.max(0, account.initialValue)),
      startFundingApplied: !(account.startYearMonth && ym(account.startYearMonth).isAfter(simulationStart, "month")),
    }))
    .sort((a, b) => a.withdrawalPriority - b.withdrawalPriority);
}

function sumOptionSubAccountBalances(accounts: OptionSubAccountState[]) {
  return accounts.reduce((sum, account) => sum + account.balance, 0);
}

function sumOptionSubAccountCostBasis(accounts: OptionSubAccountState[]) {
  return accounts.reduce((sum, account) => sum + account.costBasis, 0);
}

function syncOptionAggregate(
  balances: BalanceMap,
  taxableBasis: TaxableBasisMap,
  optionSubAccounts: OptionSubAccountState[],
) {
  if (optionSubAccounts.length === 0) return;
  balances.ordinaryAccountForOptions = sumOptionSubAccountBalances(optionSubAccounts);
  taxableBasis.ordinaryAccountForOptions = Math.min(
    sumOptionSubAccountCostBasis(optionSubAccounts),
    balances.ordinaryAccountForOptions,
  );
}

function formatLiquidFundingSource(cashUsed: number, bankDepositUsed: number) {
  return [
    cashUsed > 0 ? `現金 ${formatCompactYenForDetail(cashUsed)}` : "",
    bankDepositUsed > 0 ? `普通預金 ${formatCompactYenForDetail(bankDepositUsed)}` : "",
  ].filter(Boolean).join(" / ");
}

function formatCompactYenForDetail(value: number) {
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 10_000) return `${Math.round(rounded / 10_000).toLocaleString("ja-JP")}万円`;
  return `￥${rounded.toLocaleString("ja-JP")}`;
}

function fundFromLiquidBufferWithDetails(balances: BalanceMap, amount: number) {
  const beforeCash = balances.cash;
  const beforeBankDeposit = balances.bankDeposit;
  const fundedAmount = fundFromLiquidBuffer(balances, amount);
  return {
    fundedAmount,
    cashUsed: Math.max(0, beforeCash - balances.cash),
    bankDepositUsed: Math.max(0, beforeBankDeposit - balances.bankDeposit),
  };
}

function applyOptionSubAccountStartFunding(
  balances: BalanceMap,
  taxableBasis: TaxableBasisMap,
  optionSubAccounts: OptionSubAccountState[],
  yearMonth: YearMonth,
) {
  let fundedTotal = 0;
  const details: string[] = [];
  for (const account of optionSubAccounts) {
    if (account.startFundingApplied) continue;
    if (!account.startYearMonth || yearMonth < account.startYearMonth) continue;
    if (account.balance > 0 || account.costBasis > 0) {
      account.startFundingApplied = true;
      continue;
    }
    account.startFundingApplied = true;
    const requestedAmount = Math.max(0, account.initialValue || account.minimumBalance);
    if (requestedAmount <= 0) continue;
    const funding = fundFromLiquidBufferWithDetails(balances, requestedAmount);
    const fundedAmount = funding.fundedAmount;
    if (fundedAmount <= 0) continue;
    account.balance += fundedAmount;
    account.costBasis += fundedAmount;
    fundedTotal += fundedAmount;
    details.push(
      `${formatLiquidFundingSource(funding.cashUsed, funding.bankDepositUsed)} -> ${account.name} ${formatCompactYenForDetail(fundedAmount)}`,
    );
  }
  if (fundedTotal > 0) {
    syncOptionAggregate(balances, taxableBasis, optionSubAccounts);
  }
  return { amount: fundedTotal, details };
}

function getOptionAccount(accountId: string | undefined, optionSubAccounts: OptionSubAccountState[]) {
  return optionSubAccounts.find((account) => account.id === accountId) ?? optionSubAccounts[0];
}

function createBalanceMap(scenario: ScenarioData) {
  const optionSubAccounts = createOptionSubAccountStates(scenario);
  const ordinaryAccountForOptions = optionSubAccounts.length
    ? sumOptionSubAccountBalances(optionSubAccounts)
    : scenario.initialAssets.ordinaryAccountForOptions;
  return {
    cash: scenario.initialAssets.cash,
    bankDeposit: scenario.initialAssets.bankDeposit,
    timeDeposit: scenario.initialAssets.timeDeposit,
    nisa: scenario.initialAssets.nisa,
    specificAccount: scenario.initialAssets.specificAccount,
    ordinaryAccountForOptions,
    ideco: scenario.initialAssets.ideco,
    excludedAssets: scenario.initialAssets.excludedAssets,
    debt: scenario.initialAssets.debt,
  } satisfies BalanceMap;
}

function createTaxableBasisMap(scenario: ScenarioData) {
  const optionSubAccounts = createOptionSubAccountStates(scenario);
  const ordinaryAccountForOptions = optionSubAccounts.length
    ? Math.min(sumOptionSubAccountCostBasis(optionSubAccounts), sumOptionSubAccountBalances(optionSubAccounts))
    : Math.min(
        scenario.initialAssetCostBasis.ordinaryAccountForOptions,
        scenario.initialAssets.ordinaryAccountForOptions,
      );
  return {
    nisa: Math.min(scenario.initialAssetCostBasis.nisa, scenario.initialAssets.nisa),
    specificAccount: Math.min(scenario.initialAssetCostBasis.specificAccount, scenario.initialAssets.specificAccount),
    ordinaryAccountForOptions,
    ideco: Math.min(scenario.initialAssetCostBasis.ideco, scenario.initialAssets.ideco),
  } satisfies TaxableBasisMap;
}

function isGainTrackedAsset(key: GrowthAssetKey): key is GainTrackedAssetKey {
  return gainTrackedAssetKeys.includes(key as GainTrackedAssetKey);
}

function createTrackedAssetMap(value = 0): GainTrackedAssetMap {
  return {
    nisa: value,
    specificAccount: value,
    ordinaryAccountForOptions: value,
    ideco: value,
  };
}

function createWithdrawalBreakdown(value = 0) {
  return {
    cash: value,
    bankDeposit: value,
    timeDeposit: value,
    nisa: value,
    specificAccount: value,
    ordinaryAccountForOptions: value,
    ideco: value,
  };
}

function getLiquidBufferBalance(balances: BalanceMap) {
  return balances.cash + balances.bankDeposit;
}

function sweepBankDepositToCash(balances: BalanceMap) {
  if (balances.cash >= 0 || balances.bankDeposit <= 0) return 0;
  const transfer = Math.min(balances.bankDeposit, Math.abs(balances.cash));
  balances.bankDeposit -= transfer;
  balances.cash += transfer;
  return transfer;
}

function getTrackedAssetSnapshots(balances: BalanceMap, costBasis: TaxableBasisMap) {
  const endingTrackedAssetBalances = createTrackedAssetMap();
  const endingTrackedAssetCostBasis = createTrackedAssetMap();
  const endingTrackedAssetUnrealizedGains = createTrackedAssetMap();

  for (const key of gainTrackedAssetKeys) {
    endingTrackedAssetBalances[key] = Math.round(balances[key]);
    endingTrackedAssetCostBasis[key] = Math.round(costBasis[key]);
    endingTrackedAssetUnrealizedGains[key] = Math.round(balances[key] - costBasis[key]);
  }

  return {
    endingTrackedAssetBalances,
    endingTrackedAssetCostBasis,
    endingTrackedAssetUnrealizedGains,
  };
}

function sumBalances(balances: BalanceMap) {
  return (
    balances.cash +
    balances.bankDeposit +
    balances.timeDeposit +
    balances.nisa +
    balances.specificAccount +
    balances.ordinaryAccountForOptions +
    balances.ideco -
    balances.debt
  );
}

function getPlannedDrawdownAmount(scenario: ScenarioData, balances: BalanceMap, yearMonth: YearMonth) {
  if (!scenario.userProfile.plannedDrawdownEnabled) return 0;
  const targetAmount = Math.max(0, scenario.userProfile.targetBalanceAmount ?? 0);
  const targetMonth = ym(getTargetBalanceYearMonth(scenario));
  const currentMonth = ym(yearMonth);
  if (currentMonth.isAfter(targetMonth, "month")) return 0;
  const remainingMonths = Math.max(1, targetMonth.diff(currentMonth, "month") + 1);
  const excessAssets = Math.max(0, sumBalances(balances) - targetAmount);
  return excessAssets / remainingMonths;
}

function isTaxableWithdrawalAccount(key: GrowthAssetKey) {
  return key === "specificAccount" || key === "ordinaryAccountForOptions";
}

function supportsRetainedSourceAssetIncome(key: GrowthAssetKey | undefined): key is GainTrackedAssetKey {
  return key === "ordinaryAccountForOptions";
}

function shouldRetainedIncomeIncreaseBasis(key: GainTrackedAssetKey) {
  return key !== "ordinaryAccountForOptions";
}

function getUnrealizedGainRatio(balance: number, basis: number) {
  if (balance <= 0) return 0;
  return Math.max(0, Math.min(1, (balance - basis) / balance));
}

function withdrawFromAsset(
  balances: BalanceMap,
  taxableBasis: TaxableBasisMap,
  key: GrowthAssetKey,
  netCashNeeded: number,
  protectedMinimum = 0,
  specificAccountWithholding: ScenarioData["taxableAccountSettings"]["specificAccountWithholding"] = "withholding",
) {
  const withdrawableBalance = Math.max(0, balances[key] - protectedMinimum);
  if (netCashNeeded <= 0 || withdrawableBalance <= 0) {
    return { grossWithdrawal: 0, netCashAdded: 0, capitalGainsTax: 0, deferredCapitalGainsTax: 0, declaredCapitalGainsIncome: 0 };
  }

  if (!isGainTrackedAsset(key)) {
    const grossWithdrawal = Math.min(withdrawableBalance, netCashNeeded);
    balances[key] -= grossWithdrawal;
    return { grossWithdrawal, netCashAdded: grossWithdrawal, capitalGainsTax: 0, deferredCapitalGainsTax: 0, declaredCapitalGainsIncome: 0 };
  }

  const currentBalance = balances[key];
  const currentBasis = taxableBasis[key];
  const gainRatio = getUnrealizedGainRatio(currentBalance, currentBasis);
  const isSpecificNoWithholding = key === "specificAccount" && specificAccountWithholding === "noWithholding";
  const isDeclaredAccountGain = key === "ordinaryAccountForOptions" || isSpecificNoWithholding;
  const effectiveTaxRate = isTaxableWithdrawalAccount(key) && !isDeclaredAccountGain ? LISTED_CAPITAL_GAINS_TAX_RATE : 0;
  const netRatio = 1 - gainRatio * effectiveTaxRate;
  const requiredGross = netRatio > 0 ? netCashNeeded / netRatio : netCashNeeded;
  const grossWithdrawal = Math.min(withdrawableBalance, requiredGross);
  const realizedGain = grossWithdrawal * gainRatio;
  const capitalGainsTax = realizedGain * effectiveTaxRate;
  const deferredCapitalGainsTax = isSpecificNoWithholding ? realizedGain * LISTED_CAPITAL_GAINS_TAX_RATE : 0;
  const costPortion = grossWithdrawal - realizedGain;

  balances[key] -= grossWithdrawal;
  taxableBasis[key] = Math.max(0, currentBasis - costPortion);

  return {
    grossWithdrawal,
    netCashAdded: grossWithdrawal - capitalGainsTax,
    capitalGainsTax,
    deferredCapitalGainsTax,
    declaredCapitalGainsIncome: key === "ordinaryAccountForOptions" ? realizedGain : 0,
  };
}

function getReservedWithdrawalAssets(scenario: ScenarioData) {
  const reserved = new Set<GrowthAssetKey>();
  const hasIdecoPensionReceipt = scenario.incomeEvents.some(
    (event) => event.sourceAssetKey === "ideco" && event.type === "pension",
  );
  if (hasIdecoPensionReceipt) reserved.add("ideco");
  return reserved;
}

function getProtectedMinimumForAsset(scenario: ScenarioData, key: GrowthAssetKey) {
  if (
    key === "ordinaryAccountForOptions" &&
    scenario.optionAccountRules.enabled &&
    scenario.optionAccountRules.protectFromWithdrawal
  ) {
    return Math.max(0, scenario.optionAccountRules.minimumBalance);
  }
  return 0;
}

function isOptionAccountProtected(account: OptionSubAccountState, yearMonth: YearMonth) {
  if (!account.protectFromWithdrawal) return false;
  if (account.endYearMonth && yearMonth > account.endYearMonth && account.releaseProtectionAfterEnd) return false;
  return true;
}

function getOptionProtectedMinimum(account: OptionSubAccountState, yearMonth: YearMonth) {
  return isOptionAccountProtected(account, yearMonth) ? Math.max(0, account.minimumBalance) : 0;
}

function withdrawFromOptionSubAccounts(
  optionSubAccounts: OptionSubAccountState[],
  netCashNeeded: number,
  yearMonth: YearMonth,
  accountId?: string,
) {
  let remaining = netCashNeeded;
  let grossWithdrawal = 0;
  let netCashAdded = 0;
  let declaredCapitalGainsIncome = 0;
  const targets = accountId
    ? optionSubAccounts.filter((account) => account.id === accountId)
    : [...optionSubAccounts].sort((a, b) => a.withdrawalPriority - b.withdrawalPriority);

  for (const account of targets) {
    if (remaining <= 0) break;
    const protectedMinimum = getOptionProtectedMinimum(account, yearMonth);
    const withdrawable = Math.max(0, account.balance - protectedMinimum);
    if (withdrawable <= 0) continue;
    const amount = Math.min(withdrawable, remaining);
    const gainRatio = getUnrealizedGainRatio(account.balance, account.costBasis);
    const realizedGain = amount * gainRatio;
    const costPortion = amount - realizedGain;
    account.balance -= amount;
    account.costBasis = Math.max(0, account.costBasis - costPortion);
    grossWithdrawal += amount;
    netCashAdded += amount;
    declaredCapitalGainsIncome += realizedGain;
    remaining -= amount;
  }

  return {
    grossWithdrawal,
    netCashAdded,
    capitalGainsTax: 0,
    deferredCapitalGainsTax: 0,
    declaredCapitalGainsIncome,
  };
}

function applyWithdrawalDeficit(
  scenario: ScenarioData,
  balances: BalanceMap,
  taxableBasis: TaxableBasisMap,
  optionSubAccounts: OptionSubAccountState[],
  withdrawOrder: WithdrawalAssetKey[],
  deficit: number,
  yearMonth: YearMonth,
  reservedAssets = new Set<GrowthAssetKey>(),
) {
  let remaining = deficit;
  let grossWithdrawal = 0;
  let netCashAdded = 0;
  let capitalGainsTax = 0;
  let deferredCapitalGainsTax = 0;
  let declaredCapitalGainsIncome = 0;
  const breakdown = createWithdrawalBreakdown();
  for (const key of withdrawOrder) {
    if (remaining <= 0) break;
    if (reservedAssets.has(key)) continue;
    const result = key === "ordinaryAccountForOptions" && optionSubAccounts.length
      ? withdrawFromOptionSubAccounts(optionSubAccounts, remaining, yearMonth)
      : withdrawFromAsset(
          balances,
          taxableBasis,
          key,
          remaining,
          getProtectedMinimumForAsset(scenario, key),
          getSpecificAccountWithholdingMode(scenario),
        );
    if (key === "ordinaryAccountForOptions" && optionSubAccounts.length) {
      syncOptionAggregate(balances, taxableBasis, optionSubAccounts);
    }
    grossWithdrawal += result.grossWithdrawal;
    netCashAdded += result.netCashAdded;
    capitalGainsTax += result.capitalGainsTax;
    deferredCapitalGainsTax += result.deferredCapitalGainsTax;
    declaredCapitalGainsIncome += result.declaredCapitalGainsIncome;
    breakdown[key] += result.grossWithdrawal;
    remaining -= result.netCashAdded;
  }
  return {
    grossWithdrawal,
    netCashAdded,
    capitalGainsTax,
    deferredCapitalGainsTax,
    declaredCapitalGainsIncome,
    breakdown,
  };
}

function getDynamicIdecoMonexPayoutAmount(
  balances: BalanceMap,
  event: IncomeEvent,
  yearMonth: YearMonth,
) {
  const remainingPayouts = getIdecoMonexRemainingPayoutCount(event, yearMonth);
  if (remainingPayouts <= 0) return 0;

  const remainingActiveMonths = getIdecoMonexRemainingActiveMonthCount(event, yearMonth);
  const futureMonthlyFeesExcludingCurrent = Math.max(0, remainingActiveMonths - 1) * IDECO_MONEX_MONTHLY_FEE;
  const remainingPayoutFeesIncludingCurrent = remainingPayouts * IDECO_MONEX_PAYMENT_FEE;
  const distributablePool = Math.max(
    0,
    balances.ideco - futureMonthlyFeesExcludingCurrent - remainingPayoutFeesIncludingCurrent,
  );

  return distributablePool / remainingPayouts;
}

function getScenarioWithdrawOrder(scenario: ScenarioData) {
  if (scenario.withdrawalOrder?.length === defaultWithdrawOrder.length) return scenario.withdrawalOrder;
  return defaultWithdrawOrder;
}

function getSpecificAccountWithholdingMode(scenario: ScenarioData) {
  return scenario.taxableAccountSettings?.specificAccountWithholding ?? "withholding";
}

function getActiveNisaContribution(events: ScenarioData["assetContributionEvents"], yearMonth: YearMonth) {
  return events.some((event) => event.assetKey === "nisa" && isContributionActive(event, yearMonth));
}

function getNisaContributionPlannedYears(scenario: ScenarioData, start: dayjs.Dayjs, end: dayjs.Dayjs) {
  const years = new Set<number>();
  let cursor = start;
  while (cursor.isBefore(end) || cursor.isSame(end, "month")) {
    const yearMonth = formatYm(cursor);
    if (getActiveNisaContribution(scenario.assetContributionEvents, yearMonth)) {
      years.add(cursor.year());
    }
    cursor = cursor.add(1, "month");
  }
  return years;
}

function getNisaAnnualLimit(scenario: ScenarioData) {
  return Math.max(0, scenario.nisaInvestmentRules.annualLimit * Math.max(1, scenario.nisaInvestmentRules.investorCount));
}

function getNisaLifetimeLimit(scenario: ScenarioData) {
  const perInvestor = scenario.nisaInvestmentRules.lifetimeLimitPerInvestor ?? 18_000_000;
  return Math.max(0, perInvestor * Math.max(1, scenario.nisaInvestmentRules.investorCount));
}

function getContributionPriority(event: AssetContributionEvent) {
  if (Number.isFinite(event.contributionPriority)) return Math.max(1, Math.round(event.contributionPriority ?? 1));
  if (event.assetKey === "nisa" && event.nisaInvestmentSlot === "growth") return 2;
  return 1;
}

function shouldCarryOverContribution(event: AssetContributionEvent, carryoverMode: NisaInvestmentRules["carryOverSkippedMode"]) {
  if (event.carryOverSkipped !== undefined) return event.carryOverSkipped;
  if (event.assetKey !== "nisa") return false;
  if (event.nisaInvestmentSlot === "growth") return carryoverMode !== "none";
  if (event.nisaInvestmentSlot === "tsumitate") return false;
  return getContributionPriority(event) > 1 && carryoverMode !== "none";
}

function getRemainingHigherPriorityNisaReserve(
  events: AssetContributionEvent[],
  yearMonth: YearMonth,
  currentPriority: number,
) {
  const current = ym(yearMonth);
  const year = current.year();
  return events.reduce((sum, event) => {
    if (event.assetKey !== "nisa") return sum;
    if (getContributionPriority(event) >= currentPriority) return sum;
    let cursor = current.add(1, "month");
    let reserved = 0;
    while (cursor.year() === year) {
      if (isContributionActive(event, formatYm(cursor))) {
        reserved += Math.max(0, event.monthlyAmount);
      }
      cursor = cursor.add(1, "month");
    }
    return sum + reserved;
  }, 0);
}

function fundFromLiquidBuffer(balances: BalanceMap, amount: number) {
  const requested = Math.max(0, amount);
  const available = Math.max(0, getLiquidBufferBalance(balances));
  const funded = Math.min(requested, available);
  balances.cash -= funded;
  sweepBankDepositToCash(balances);
  return funded;
}

function moveOptionProfitToLiquid(
  balances: BalanceMap,
  taxableBasis: TaxableBasisMap,
  destination: "cash" | "bankDeposit",
  amount: number,
) {
  const transfer = Math.max(0, Math.min(amount, balances.ordinaryAccountForOptions));
  if (transfer <= 0) return 0;
  balances.ordinaryAccountForOptions -= transfer;
  taxableBasis.ordinaryAccountForOptions = Math.min(taxableBasis.ordinaryAccountForOptions, balances.ordinaryAccountForOptions);
  balances[destination] += transfer;
  return transfer;
}

function moveOptionSubAccountProfitToLiquid(
  balances: BalanceMap,
  taxableBasis: TaxableBasisMap,
  optionSubAccounts: OptionSubAccountState[],
  account: OptionSubAccountState,
  destination: "cash" | "bankDeposit",
  amount: number,
) {
  const transfer = Math.max(0, Math.min(amount, account.balance));
  if (transfer <= 0) return 0;
  const gainRatio = getUnrealizedGainRatio(account.balance, account.costBasis);
  const realizedGain = transfer * gainRatio;
  const costPortion = transfer - realizedGain;
  account.balance -= transfer;
  account.costBasis = Math.max(0, account.costBasis - costPortion);
  balances[destination] += transfer;
  syncOptionAggregate(balances, taxableBasis, optionSubAccounts);
  return transfer;
}

function moveOptionSubAccountProfitToLiquidWithDetails(
  balances: BalanceMap,
  taxableBasis: TaxableBasisMap,
  optionSubAccounts: OptionSubAccountState[],
  account: OptionSubAccountState,
  destination: "cash" | "bankDeposit",
  amount: number,
) {
  const transferredAmount = moveOptionSubAccountProfitToLiquid(
    balances,
    taxableBasis,
    optionSubAccounts,
    account,
    destination,
    amount,
  );
  return {
    transferredAmount,
    detail: transferredAmount > 0
      ? `${account.name} -> ${destination === "cash" ? "現金" : "普通預金"} ${formatCompactYenForDetail(transferredAmount)}`
      : "",
  };
}

function getOptionProfitSweepAmount(scenario: ScenarioData, balances: BalanceMap, yearMonth: YearMonth) {
  const rules = scenario.optionAccountRules;
  if (!rules.enabled || !rules.profitSweepEnabled) return 0;
  if (rules.profitSweepTiming === "yearEnd" && !yearMonth.endsWith("-12")) return 0;
  const availableAboveMinimum = Math.max(0, balances.ordinaryAccountForOptions - Math.max(0, rules.minimumBalance));
  if (rules.profitSweepMethod === "fixedAmount") {
    return Math.min(availableAboveMinimum, Math.max(0, rules.fixedSweepAmount));
  }
  const target = Math.max(rules.minimumBalance, rules.targetBalance);
  return Math.min(availableAboveMinimum, Math.max(0, balances.ordinaryAccountForOptions - target));
}

function getOptionSubAccountProfitSweepAmount(account: OptionSubAccountState, yearMonth: YearMonth) {
  if (!account.enabled || !account.profitSweepEnabled) return 0;
  if (account.profitSweepTiming === "yearEnd" && !yearMonth.endsWith("-12")) return 0;
  const minimum = getOptionProtectedMinimum(account, yearMonth);
  const availableAboveMinimum = Math.max(0, account.balance - minimum);
  if (account.profitSweepMethod === "fixedAmount") {
    return Math.min(availableAboveMinimum, Math.max(0, account.fixedSweepAmount));
  }
  const target = Math.max(minimum, account.targetBalance);
  return Math.min(availableAboveMinimum, Math.max(0, account.balance - target));
}

function isAssetTransferActive(event: Pick<ScenarioData["assetTransferEvents"][number], "yearMonth">, yearMonth: YearMonth) {
  return event.yearMonth === yearMonth;
}

function simulateScenarioCore(
  scenario: ScenarioData,
  effectiveTaxRows: TaxInsuranceByFiscalYear[],
): SimulationResult {
  const start = ym(scenario.userProfile.simulationStartYearMonth);
  const end = ym(getEndYearMonth(scenario));
  const monthly: MonthlyResult[] = [];
  const balances = createBalanceMap(scenario);
  const taxableBasis = createTaxableBasisMap(scenario);
  const optionSubAccounts = createOptionSubAccountStates(scenario);
  syncOptionAggregate(balances, taxableBasis, optionSubAccounts);
  const cashReserve = Math.max(0, scenario.userProfile.cashReserve ?? 0);
  const excludeTaxExpense = effectiveTaxRows.length > 0;
  const reservedWithdrawalAssets = getReservedWithdrawalAssets(scenario);
  const reserveReplenishmentExcludedAssets = new Set<GrowthAssetKey>([...reservedWithdrawalAssets, "bankDeposit"]);
  const withdrawOrder = getScenarioWithdrawOrder(scenario);
  const idecoWithholdingByIncomeYear = new Map<number, number>();
  const deferredCapitalGainsTaxByIncomeYear = new Map<number, number>();
  const retirementAdjustmentByIncomeEventId = getRetirementAdjustmentByIncomeEventId(scenario);
  const nisaContributionUsedByYear = new Map<number, number>();
  const nisaProtectedYears = getNisaContributionPlannedYears(scenario, start, end);
  const nisaWithdrawalYears = new Set<number>();
  const nisaContributionCarryoverByEvent = new Map<string, number>();
  const monthlyExpenseProfiles = new Map<YearMonth, MonthlyExpenseProfile>();
  let nisaContributionUsedLifetime = Math.max(0, scenario.nisaInvestmentRules.usedLifetimeLimitAtStart ?? 0);
  let cursor = start;
  let index = 0;

  while (cursor.isBefore(end) || cursor.isSame(end, "month")) {
    const yearMonth = formatYm(cursor);
    const monthsFromStart = cursor.diff(start, "month");
    const startingLiquidBuffer = getLiquidBufferBalance(balances);
    const age = getAgeAtYearMonth(scenario.userProfile.birthDate, yearMonth);
    const previousYearMonth = formatYm(cursor.subtract(12, "month"));
    const livingExpenseProfile = getAdjustedMonthlyExpense(
      scenario,
      monthsFromStart,
      age.years,
      excludeTaxExpense,
      monthlyExpenseProfiles.get(previousYearMonth),
      monthlyExpenseProfiles,
    );
    monthlyExpenseProfiles.set(yearMonth, structuredClone(livingExpenseProfile));
    const livingExpenseTotal = sumMonthlyExpenseProfile(livingExpenseProfile);
    const pensionAdjustmentRate = scenario.inflationSettings.enabled ? scenario.inflationSettings.pensionAnnualAdjustmentRate : 0;
    let externalIncomeTotal = 0;
    let transferredIncomeTotal = 0;
    let retainedSourceAssetIncomeTotal = 0;
    let optionIncomeSuspendedTotal = 0;
    let capitalGainsTaxTotal = 0;
    let deferredCapitalGainsTaxTotal = 0;
    let declaredCapitalGainsIncomeTotal = 0;
    let idecoFeeTotal = 0;
    let idecoWithholdingTaxTotal = 0;
    const totalWithdrawalBreakdown = createWithdrawalBreakdown();
    const sourceAssetIncomeBreakdown = createWithdrawalBreakdown();
    const deficitWithdrawalBreakdown = createWithdrawalBreakdown();
    let totalGrossAssetWithdrawalAmount = 0;
    let sourceAssetIncomeWithdrawalAmount = 0;
    let deficitAssetWithdrawalAmount = 0;
    for (const event of scenario.incomeEvents) {
      if (isIdecoMonexPensionEvent(event)) {
        const firstPayoutYearMonth = getIdecoMonexFirstPayoutYearMonth(event);
        const endYearMonth = getIdecoMonexEndYearMonth(event);
        if (yearMonth < firstPayoutYearMonth || (endYearMonth && yearMonth > endYearMonth)) continue;
        if (yearMonth >= firstPayoutYearMonth) {
          const monthlyFee = withdrawFromAsset(balances, taxableBasis, "ideco", IDECO_MONEX_MONTHLY_FEE);
          idecoFeeTotal += monthlyFee.netCashAdded;
          totalGrossAssetWithdrawalAmount += monthlyFee.grossWithdrawal;
          totalWithdrawalBreakdown.ideco += monthlyFee.grossWithdrawal;
        }
      } else if (!isEventActive(event, yearMonth)) {
        continue;
      }
      const desiredAmount = isIdecoMonexPensionEvent(event)
        ? (isIdecoMonexPayoutMonth(event, yearMonth) ? getDynamicIdecoMonexPayoutAmount(balances, event, yearMonth) : 0)
        : getIncomeEventAmountForMonth(event, yearMonth, scenario, pensionAdjustmentRate);
      const isOptionIncome =
        event.sourceAssetKey === "ordinaryAccountForOptions" &&
        (event.type === "investmentIncome" || event.type === "dividend" || event.type === "other");
      const optionSourceAccount = event.sourceAssetKey === "ordinaryAccountForOptions"
        ? getOptionAccount(event.sourceOptionSubAccountId, optionSubAccounts)
        : undefined;
      if (
        isOptionIncome &&
        optionSourceAccount &&
        optionSourceAccount.suspendIncomeWhenBelowMinimum &&
        optionSourceAccount.balance < optionSourceAccount.minimumBalance
      ) {
        optionIncomeSuspendedTotal += desiredAmount;
        continue;
      }
      if (event.sourceAssetKey) {
        if (
          event.sourceAssetPayoutMode === "retainInSourceAsset" &&
          supportsRetainedSourceAssetIncome(event.sourceAssetKey)
        ) {
          if (event.sourceAssetKey === "ordinaryAccountForOptions" && optionSourceAccount) {
            optionSourceAccount.balance += desiredAmount;
            syncOptionAggregate(balances, taxableBasis, optionSubAccounts);
          } else {
            balances[event.sourceAssetKey] += desiredAmount;
          }
          if (event.sourceAssetKey !== "ordinaryAccountForOptions" && shouldRetainedIncomeIncreaseBasis(event.sourceAssetKey)) {
            taxableBasis[event.sourceAssetKey] += desiredAmount;
          }
          retainedSourceAssetIncomeTotal += desiredAmount;
          continue;
        }
        if (event.sourceAssetPayoutMode === "retainInSourceAsset") {
          // 旧設定でNISAや特定口座に「口座内積上」が残っている場合、
          // 現金化にも残高加算にもせず無効扱いにする。現金化したい場合は明示的に現金受取へ変更する。
          continue;
        }
        const withdrawal = event.sourceAssetKey === "ordinaryAccountForOptions" && optionSourceAccount
          ? withdrawFromOptionSubAccounts(optionSubAccounts, desiredAmount, yearMonth, optionSourceAccount.id)
          : withdrawFromAsset(
              balances,
              taxableBasis,
              event.sourceAssetKey,
              desiredAmount,
              0,
              getSpecificAccountWithholdingMode(scenario),
            );
        if (event.sourceAssetKey === "ordinaryAccountForOptions") {
          syncOptionAggregate(balances, taxableBasis, optionSubAccounts);
        }
        totalGrossAssetWithdrawalAmount += withdrawal.grossWithdrawal;
        sourceAssetIncomeWithdrawalAmount += withdrawal.grossWithdrawal;
        totalWithdrawalBreakdown[event.sourceAssetKey] += withdrawal.grossWithdrawal;
        sourceAssetIncomeBreakdown[event.sourceAssetKey] += withdrawal.grossWithdrawal;
        let netCashAdded = withdrawal.netCashAdded;
        if (isIdecoMonexPensionEvent(event)) {
          const withholdingTax = event.taxTreatment === "nonTaxable" ? 0 : withdrawal.grossWithdrawal * IDECO_PENSION_WITHHOLDING_TAX_RATE;
          const payoutFee = withdrawFromAsset(balances, taxableBasis, "ideco", IDECO_MONEX_PAYMENT_FEE);
          idecoFeeTotal += payoutFee.netCashAdded;
          totalGrossAssetWithdrawalAmount += payoutFee.grossWithdrawal;
          totalWithdrawalBreakdown.ideco += payoutFee.grossWithdrawal;
          idecoWithholdingTaxTotal += withholdingTax;
          idecoWithholdingByIncomeYear.set(
            cursor.year(),
            (idecoWithholdingByIncomeYear.get(cursor.year()) ?? 0) + withholdingTax,
          );
          netCashAdded = Math.max(0, netCashAdded - IDECO_MONEX_PAYMENT_FEE - withholdingTax);
        } else if (event.sourceAssetKey === "ideco" && event.type === "pension") {
          const withholdingTax = event.taxTreatment === "nonTaxable" ? 0 : withdrawal.grossWithdrawal * IDECO_PENSION_WITHHOLDING_TAX_RATE;
          idecoWithholdingTaxTotal += withholdingTax;
          idecoWithholdingByIncomeYear.set(
            cursor.year(),
            (idecoWithholdingByIncomeYear.get(cursor.year()) ?? 0) + withholdingTax,
          );
          netCashAdded = Math.max(0, netCashAdded - withholdingTax);
        } else if (event.sourceAssetKey === "ideco" && event.type === "oneTime") {
          const retirementAdjustment = retirementAdjustmentByIncomeEventId.get(event.id);
          const withholdingTax = event.taxTreatment === "nonTaxable"
            ? 0
            : event.idecoLumpSumTaxMode === "noDeclaration"
              ? withdrawal.grossWithdrawal * IDECO_LUMP_SUM_NO_DECLARATION_WITHHOLDING_RATE
              : calculateIdecoLumpSumEstimatedTax(
                  withdrawal.grossWithdrawal,
                  event.idecoLumpSumContributionYears ?? 20,
                  retirementAdjustment?.adjustedDeduction,
                );
          idecoWithholdingTaxTotal += withholdingTax;
          idecoWithholdingByIncomeYear.set(
            cursor.year(),
            (idecoWithholdingByIncomeYear.get(cursor.year()) ?? 0) + withholdingTax,
          );
          netCashAdded = Math.max(0, netCashAdded - withholdingTax);
        }
        transferredIncomeTotal += netCashAdded;
        capitalGainsTaxTotal += withdrawal.capitalGainsTax;
        deferredCapitalGainsTaxTotal += withdrawal.deferredCapitalGainsTax;
        declaredCapitalGainsIncomeTotal += withdrawal.declaredCapitalGainsIncome;
        if (withdrawal.deferredCapitalGainsTax > 0) {
          deferredCapitalGainsTaxByIncomeYear.set(
            cursor.year(),
            (deferredCapitalGainsTaxByIncomeYear.get(cursor.year()) ?? 0) + withdrawal.deferredCapitalGainsTax,
          );
        }
      } else {
        externalIncomeTotal += desiredAmount;
      }
    }
    const incomeTotal = externalIncomeTotal + transferredIncomeTotal;
    balances.cash += incomeTotal;
    let assetTransferTotal = 0;
    const assetTransferDetails: string[] = [];
    const optionStartFundingTotal = optionSubAccounts.length
      ? applyOptionSubAccountStartFunding(balances, taxableBasis, optionSubAccounts, yearMonth)
      : { amount: 0, details: [] };
    assetTransferTotal += optionStartFundingTotal.amount;
    assetTransferDetails.push(...optionStartFundingTotal.details);
    for (const event of scenario.assetTransferEvents ?? []) {
      if (!isAssetTransferActive(event, yearMonth)) continue;
      const beforeSource = balances[event.fromAssetKey];
      const transferAmount = Math.min(Math.max(0, event.amount), Math.max(0, beforeSource));
      if (transferAmount <= 0) continue;
      balances[event.fromAssetKey] -= transferAmount;
      if (event.toAssetKey === "ordinaryAccountForOptions" && optionSubAccounts.length) {
        const targetAccount = getOptionAccount(event.toOptionSubAccountId, optionSubAccounts);
        if (targetAccount) {
          targetAccount.balance += transferAmount;
          targetAccount.costBasis += transferAmount;
          syncOptionAggregate(balances, taxableBasis, optionSubAccounts);
        }
      } else {
        balances[event.toAssetKey] += transferAmount;
      }
      if (isGainTrackedAsset(event.toAssetKey) && event.toAssetKey !== "ordinaryAccountForOptions") {
        taxableBasis[event.toAssetKey] += transferAmount;
      }
      assetTransferTotal += transferAmount;
      const targetLabel = event.toAssetKey === "ordinaryAccountForOptions" && event.toOptionSubAccountId
        ? optionSubAccounts.find((account) => account.id === event.toOptionSubAccountId)?.name ?? "普通口座（オプション用）"
        : assetDetailLabels[event.toAssetKey];
      assetTransferDetails.push(
        `${assetDetailLabels[event.fromAssetKey]} -> ${targetLabel} ${formatCompactYenForDetail(transferAmount)}`,
      );
    }
    const specialExpenseTotal = scenario.specialExpenses
      .filter((expense) => isSpecialExpenseActive(expense, yearMonth))
      .reduce((sum, expense) => sum + expense.amount, 0);
    const taxInsuranceTotal = getTaxInsuranceCashPaymentForMonth(
      scenario,
      effectiveTaxRows,
      yearMonth,
      idecoWithholdingByIncomeYear,
      deferredCapitalGainsTaxByIncomeYear,
    );
    const outflow = livingExpenseTotal + specialExpenseTotal + taxInsuranceTotal;
    let assetContributionTotal = 0;
    let nisaContributionTotal = 0;
    let nisaContributionSkippedTotal = 0;
    let nisaAnnualLimitExceededTotal = 0;
    let handledNisaContributionThisMonth = false;
    let nisaContributionPlannedThisMonth = false;
    const carryoverMode = scenario.nisaInvestmentRules.carryOverSkippedMode ??
      (scenario.nisaInvestmentRules.carryOverSkippedWithinYear ? "withinYear" : "none");
    const carryoverEvents = scenario.assetContributionEvents.filter(
      (event) => event.assetKey === "nisa" && (nisaContributionCarryoverByEvent.get(event.id) ?? 0) > 0,
    );
    const addNisaCarryover = (event: AssetContributionEvent, amount: number) => {
      const carryable = shouldCarryOverContribution(event, carryoverMode);
      if (!carryable || amount <= 0) return;
      nisaContributionCarryoverByEvent.set(event.id, (nisaContributionCarryoverByEvent.get(event.id) ?? 0) + amount);
    };
    const executeNisaContribution = (event: AssetContributionEvent, requestedAmount: number) => {
      handledNisaContributionThisMonth = true;
      const year = cursor.year();
      const priority = getContributionPriority(event);
      const canUseCarryover =
        carryoverMode === "acrossYears" ||
        (carryoverMode === "withinYear" && ym(event.startYearMonth).year() === year);
      const carryoverAmount = canUseCarryover ? nisaContributionCarryoverByEvent.get(event.id) ?? 0 : 0;
      if (carryoverAmount > 0) {
        nisaContributionCarryoverByEvent.set(event.id, 0);
      }

      const currentRequestAmount = Math.max(0, requestedAmount);
      const desiredContributionAmount = currentRequestAmount + carryoverAmount;
      if (desiredContributionAmount > 0 && nisaWithdrawalYears.has(year)) {
        addNisaCarryover(event, desiredContributionAmount);
        nisaContributionSkippedTotal += currentRequestAmount;
        nisaContributionPlannedThisMonth = true;
        return 0;
      }
      let contributionAmount = desiredContributionAmount;
      if (desiredContributionAmount > 0) {
        nisaContributionPlannedThisMonth = true;
      }
      const annualLimit = getNisaAnnualLimit(scenario);
      const lifetimeLimit = getNisaLifetimeLimit(scenario);
      const used = nisaContributionUsedByYear.get(year) ?? 0;
      const remainingLifetimeLimit = scenario.nisaInvestmentRules.enforceAnnualLimit
        ? Math.max(0, lifetimeLimit - nisaContributionUsedLifetime)
        : contributionAmount;
      const lifetimeBlockedAmount = Math.max(0, contributionAmount - remainingLifetimeLimit);
      if (lifetimeBlockedAmount > 0) {
        nisaAnnualLimitExceededTotal += lifetimeBlockedAmount;
      }
      contributionAmount = Math.min(contributionAmount, remainingLifetimeLimit);
      const remainingAnnualLimit = scenario.nisaInvestmentRules.enforceAnnualLimit
        ? Math.max(0, annualLimit - used)
        : contributionAmount;
      const annualLimitBlockedAmount = Math.max(0, contributionAmount - remainingAnnualLimit);
      if (annualLimitBlockedAmount > 0) {
        nisaAnnualLimitExceededTotal += annualLimitBlockedAmount;
      }
      contributionAmount = Math.min(contributionAmount, remainingAnnualLimit);
      if (scenario.nisaInvestmentRules.insufficientFundingMode === "skip") {
        const higherPriorityReserve = getRemainingHigherPriorityNisaReserve(
          scenario.assetContributionEvents,
          yearMonth,
          priority,
        );
        const availableForNisa = Math.max(0, getLiquidBufferBalance(balances) - outflow - cashReserve - higherPriorityReserve);
        const executable = Math.min(contributionAmount, availableForNisa);
        const remainingAfterExecution = contributionAmount - executable;
        const carryoverPortionInPlan = Math.min(carryoverAmount, contributionAmount);
        const currentPortionInPlan = Math.max(0, contributionAmount - carryoverPortionInPlan);
        const currentExecutable = Math.max(0, executable - carryoverPortionInPlan);
        const newlySkippedAmount = Math.max(0, currentPortionInPlan - currentExecutable);
        nisaContributionSkippedTotal += newlySkippedAmount;
        if (remainingAfterExecution > 0) {
          addNisaCarryover(event, remainingAfterExecution);
        }
        contributionAmount = executable;
      }
      nisaContributionUsedByYear.set(year, used + contributionAmount);
      nisaContributionUsedLifetime += contributionAmount;
      if (contributionAmount > 0) {
        nisaProtectedYears.add(year);
      }
      const remainingLifetimeLimitAfterExecution = scenario.nisaInvestmentRules.enforceAnnualLimit
        ? Math.max(0, lifetimeLimit - nisaContributionUsedLifetime)
        : Number.POSITIVE_INFINITY;
      const existingCarryover = nisaContributionCarryoverByEvent.get(event.id) ?? 0;
      if (existingCarryover > remainingLifetimeLimitAfterExecution) {
        nisaContributionCarryoverByEvent.set(event.id, remainingLifetimeLimitAfterExecution);
      }
      return contributionAmount;
    };

    const activeContributionEvents = scenario.assetContributionEvents
      .filter((event) => isContributionActive(event, yearMonth))
      .sort((a, b) => getContributionPriority(a) - getContributionPriority(b));
    for (const event of activeContributionEvents) {
      if (!isContributionActive(event, yearMonth)) continue;
      let contributionAmount = Math.max(0, event.monthlyAmount);
      if (event.assetKey === "nisa") {
        contributionAmount = executeNisaContribution(event, contributionAmount);
      }
      if (contributionAmount <= 0) continue;
      if (event.assetKey === "nisa" && scenario.nisaInvestmentRules.insufficientFundingMode === "skip") {
        fundFromLiquidBuffer(balances, contributionAmount);
      } else {
        balances.cash -= contributionAmount;
      }
      assetContributionTotal += contributionAmount;
      if (event.assetKey === "nisa") {
        nisaContributionTotal += contributionAmount;
      }
      balances[event.assetKey] += contributionAmount;
      if (isGainTrackedAsset(event.assetKey)) {
        taxableBasis[event.assetKey] += contributionAmount;
      }
    }
    const deferredNisaEvents = carryoverEvents
      .filter((event) => !activeContributionEvents.some((active) => active.id === event.id))
      .sort((a, b) => getContributionPriority(a) - getContributionPriority(b));
    for (const event of deferredNisaEvents) {
      const availableForDeferredNisa = Math.max(
        0,
        getLiquidBufferBalance(balances) -
          outflow -
          cashReserve -
          getRemainingHigherPriorityNisaReserve(scenario.assetContributionEvents, yearMonth, getContributionPriority(event)),
      );
      if (availableForDeferredNisa <= 0) continue;
      const contributionAmount = executeNisaContribution(event, 0);
      if (contributionAmount > 0) {
        fundFromLiquidBuffer(balances, contributionAmount);
        assetContributionTotal += contributionAmount;
        nisaContributionTotal += contributionAmount;
        balances.nisa += contributionAmount;
        taxableBasis.nisa += contributionAmount;
      }
    }

    const growthAmount = scenario.assetGrowthSettings.enabled
      ? growthAssetOrder.reduce((sum, key) => {
          const monthlyGrowthRate = Math.pow(1 + scenario.assetGrowthSettings.rates[key], 1 / 12) - 1;
          const amount = Math.max(balances[key], 0) * monthlyGrowthRate;
          if (key === "ordinaryAccountForOptions" && optionSubAccounts.length) {
            let optionGrowthTotal = 0;
            for (const account of optionSubAccounts) {
              if (account.suspendIncomeWhenBelowMinimum && account.balance < account.minimumBalance) continue;
              const accountAmount = Math.max(account.balance, 0) * monthlyGrowthRate;
              account.balance += accountAmount;
              optionGrowthTotal += accountAmount;
            }
            syncOptionAggregate(balances, taxableBasis, optionSubAccounts);
            return sum + optionGrowthTotal;
          }
          balances[key] += amount;
          return sum + amount;
        }, 0)
      : 0;
    const liquidFundingCapacityForContribution = Math.max(0, startingLiquidBuffer + incomeTotal - outflow - cashReserve);
    const assetContributionFundingGap = Math.max(0, assetContributionTotal - liquidFundingCapacityForContribution);
    const baseWithdrawalAmount = Math.max(0, outflow + assetContributionTotal - incomeTotal);
    balances.cash -= outflow;
    sweepBankDepositToCash(balances);
    const liquidBufferBalance = getLiquidBufferBalance(balances);
    const deficit = liquidBufferBalance < cashReserve ? cashReserve - liquidBufferBalance : 0;
    const monthlyReservedAssets = new Set<GrowthAssetKey>(reserveReplenishmentExcludedAssets);
    const hasNisaContributionPlan =
      nisaProtectedYears.has(cursor.year()) ||
      getActiveNisaContribution(scenario.assetContributionEvents, yearMonth) ||
      nisaContributionPlannedThisMonth;
    if (scenario.nisaInvestmentRules.protectDuringContribution && hasNisaContributionPlan) {
      monthlyReservedAssets.add("nisa");
    }
    const withdrawal = deficit
      ? applyWithdrawalDeficit(scenario, balances, taxableBasis, optionSubAccounts, withdrawOrder, deficit, yearMonth, monthlyReservedAssets)
      : {
          grossWithdrawal: 0,
          netCashAdded: 0,
          capitalGainsTax: 0,
          deferredCapitalGainsTax: 0,
          declaredCapitalGainsIncome: 0,
          breakdown: createWithdrawalBreakdown(),
        };
    balances.cash += withdrawal.netCashAdded;
    capitalGainsTaxTotal += withdrawal.capitalGainsTax;
    deferredCapitalGainsTaxTotal += withdrawal.deferredCapitalGainsTax;
    declaredCapitalGainsIncomeTotal += withdrawal.declaredCapitalGainsIncome;
    if (withdrawal.deferredCapitalGainsTax > 0) {
      deferredCapitalGainsTaxByIncomeYear.set(
        cursor.year(),
        (deferredCapitalGainsTaxByIncomeYear.get(cursor.year()) ?? 0) + withdrawal.deferredCapitalGainsTax,
      );
    }
    totalGrossAssetWithdrawalAmount += withdrawal.grossWithdrawal;
    deficitAssetWithdrawalAmount += withdrawal.grossWithdrawal;
    if (withdrawal.breakdown.nisa > 0 || sourceAssetIncomeBreakdown.nisa > 0) {
      nisaWithdrawalYears.add(cursor.year());
    }
    for (const key of growthAssetOrder) {
      totalWithdrawalBreakdown[key] += withdrawal.breakdown[key];
      deficitWithdrawalBreakdown[key] += withdrawal.breakdown[key];
    }
    const cashReserveTopUpAmount = Math.max(0, deficit - baseWithdrawalAmount);
    let optionProfitSweepTotal = 0;
    const optionProfitSweepDetails: string[] = [];
    if (optionSubAccounts.length) {
      for (const account of optionSubAccounts) {
        const sweep = moveOptionSubAccountProfitToLiquidWithDetails(
          balances,
          taxableBasis,
          optionSubAccounts,
          account,
          account.profitSweepDestination,
          getOptionSubAccountProfitSweepAmount(account, yearMonth),
        );
        optionProfitSweepTotal += sweep.transferredAmount;
        if (sweep.detail) optionProfitSweepDetails.push(sweep.detail);
      }
    } else {
      const transferredAmount = moveOptionProfitToLiquid(
        balances,
        taxableBasis,
        scenario.optionAccountRules.profitSweepDestination,
        getOptionProfitSweepAmount(scenario, balances, yearMonth),
      );
      optionProfitSweepTotal += transferredAmount;
      if (transferredAmount > 0) {
        optionProfitSweepDetails.push(
          `普通口座（オプション用） -> ${scenario.optionAccountRules.profitSweepDestination === "cash" ? "現金" : "普通預金"} ${formatCompactYenForDetail(transferredAmount)}`,
        );
      }
    }
    let plannedDrawdownTotal = getPlannedDrawdownAmount(scenario, balances, yearMonth);
    if (plannedDrawdownTotal > 0) {
      balances.cash -= plannedDrawdownTotal;
      sweepBankDepositToCash(balances);
      const plannedDrawdownDeficit = Math.max(0, -getLiquidBufferBalance(balances));
      if (plannedDrawdownDeficit > 0) {
        const plannedWithdrawal = applyWithdrawalDeficit(
          scenario,
          balances,
          taxableBasis,
          optionSubAccounts,
          withdrawOrder,
          plannedDrawdownDeficit,
          yearMonth,
          monthlyReservedAssets,
        );
        balances.cash += plannedWithdrawal.netCashAdded;
        capitalGainsTaxTotal += plannedWithdrawal.capitalGainsTax;
        deferredCapitalGainsTaxTotal += plannedWithdrawal.deferredCapitalGainsTax;
        declaredCapitalGainsIncomeTotal += plannedWithdrawal.declaredCapitalGainsIncome;
        if (plannedWithdrawal.deferredCapitalGainsTax > 0) {
          deferredCapitalGainsTaxByIncomeYear.set(
            cursor.year(),
            (deferredCapitalGainsTaxByIncomeYear.get(cursor.year()) ?? 0) + plannedWithdrawal.deferredCapitalGainsTax,
          );
        }
        totalGrossAssetWithdrawalAmount += plannedWithdrawal.grossWithdrawal;
        deficitAssetWithdrawalAmount += plannedWithdrawal.grossWithdrawal;
        for (const key of growthAssetOrder) {
          totalWithdrawalBreakdown[key] += plannedWithdrawal.breakdown[key];
          deficitWithdrawalBreakdown[key] += plannedWithdrawal.breakdown[key];
        }
        plannedDrawdownTotal = Math.min(plannedDrawdownTotal, plannedDrawdownTotal - Math.max(0, -getLiquidBufferBalance(balances)));
      }
    }
    const endingAssets = sumBalances(balances);
    const netCashFlow = incomeTotal - outflow - assetContributionTotal - capitalGainsTaxTotal - plannedDrawdownTotal;
    const snapshots = getTrackedAssetSnapshots(balances, taxableBasis);
    const nisaLifetimeLimit = getNisaLifetimeLimit(scenario);
    const nisaRemainingLifetimeLimit = scenario.nisaInvestmentRules.enforceAnnualLimit
      ? Math.max(0, nisaLifetimeLimit - nisaContributionUsedLifetime)
      : Number.POSITIVE_INFINITY;
    monthly.push({
      yearMonth,
      ageYears: age.years,
      ageMonths: age.months,
      incomeTotal: Math.round(incomeTotal),
      retainedSourceAssetIncomeTotal: Math.round(retainedSourceAssetIncomeTotal),
      assetTransferTotal: Math.round(assetTransferTotal),
      assetTransferDetails,
      optionProfitSweepTotal: Math.round(optionProfitSweepTotal),
      optionProfitSweepDetails,
      optionIncomeSuspendedTotal: Math.round(optionIncomeSuspendedTotal),
      nisaContributionSkippedTotal: Math.round(nisaContributionSkippedTotal),
      nisaAnnualLimitExceededTotal: Math.round(nisaAnnualLimitExceededTotal),
      nisaContributionTotal: Math.round(nisaContributionTotal),
      nisaCumulativeInvestment: Math.round(nisaContributionUsedLifetime),
      nisaRemainingLifetimeLimit: Number.isFinite(nisaRemainingLifetimeLimit) ? Math.round(nisaRemainingLifetimeLimit) : nisaRemainingLifetimeLimit,
      assetContributionTotal: Math.round(assetContributionTotal),
      assetContributionFundingGap: Math.round(assetContributionFundingGap),
      livingExpenseTotal: Math.round(livingExpenseTotal),
      specialExpenseTotal: Math.round(specialExpenseTotal),
      taxInsuranceTotal: Math.round(taxInsuranceTotal),
      capitalGainsTaxTotal: Math.round(capitalGainsTaxTotal),
      deferredCapitalGainsTaxTotal: Math.round(deferredCapitalGainsTaxTotal),
      declaredCapitalGainsIncomeTotal: Math.round(declaredCapitalGainsIncomeTotal),
      idecoWithholdingTaxTotal: Math.round(idecoWithholdingTaxTotal),
      growthAmount: Math.round(growthAmount),
      withdrawalAmount: Math.round(baseWithdrawalAmount),
      plannedDrawdownTotal: Math.round(plannedDrawdownTotal),
      cashReserveTopUpAmount: Math.round(cashReserveTopUpAmount),
      grossAssetWithdrawalAmount: Math.round(totalGrossAssetWithdrawalAmount),
      sourceAssetIncomeWithdrawalAmount: Math.round(sourceAssetIncomeWithdrawalAmount),
      deficitAssetWithdrawalAmount: Math.round(deficitAssetWithdrawalAmount),
      withdrawalSourceBreakdown: Object.fromEntries(
        Object.entries(totalWithdrawalBreakdown).map(([key, value]) => [key, Math.round(value)]),
      ) as ReturnType<typeof createWithdrawalBreakdown>,
      sourceAssetIncomeBreakdown: Object.fromEntries(
        Object.entries(sourceAssetIncomeBreakdown).map(([key, value]) => [key, Math.round(value)]),
      ) as ReturnType<typeof createWithdrawalBreakdown>,
      deficitWithdrawalBreakdown: Object.fromEntries(
        Object.entries(deficitWithdrawalBreakdown).map(([key, value]) => [key, Math.round(value)]),
      ) as ReturnType<typeof createWithdrawalBreakdown>,
      netCashFlow: Math.round(netCashFlow),
      idecoFeeTotal: Math.round(idecoFeeTotal),
      endingAssets: Math.round(endingAssets),
      endingTrackedAssetBalances: snapshots.endingTrackedAssetBalances,
      endingTrackedAssetCostBasis: snapshots.endingTrackedAssetCostBasis,
      endingTrackedAssetUnrealizedGains: snapshots.endingTrackedAssetUnrealizedGains,
    });

    cursor = cursor.add(1, "month");
    index += 1;
    if (index > 1200) break;
  }

  const annual = aggregateAnnualResults(monthly);
  const depletion = monthly.find((result) => result.endingAssets < 0);
  const targetAgeBalance = getBalanceAtAge(monthly, scenario.userProfile.targetBalanceAge);
  const totalWithdrawal = monthly.reduce((sum, row) => sum + row.withdrawalAmount, 0);
  const deficitYears = annual.filter((row) => row.netCashFlow < 0);
  const averageAnnualDeficit = deficitYears.length
    ? deficitYears.reduce((sum, row) => sum + Math.abs(row.netCashFlow), 0) / deficitYears.length
    : 0;

  return {
    scenarioId: scenario.id,
    monthly,
    annual,
    depletionYearMonth: depletion?.yearMonth,
    depletionAgeYears: depletion?.ageYears,
    depletionAgeMonths: depletion?.ageMonths,
    targetAgeBalance,
    totalWithdrawal,
    averageMonthlyWithdrawal: monthly.length ? totalWithdrawal / monthly.length : 0,
    averageAnnualDeficit,
    maxDeficitMonth: monthly.reduce<MonthlyResult | undefined>((current, row) => {
      if (!current || row.netCashFlow < current.netCashFlow) return row;
      return current;
    }, undefined),
  };
}

function addDeclaredIncome(
  map: DeclaredInvestmentIncomeByYear,
  fiscalYear: number,
  memberId: string,
  amount: number,
) {
  if (amount <= 0) return;
  const yearMap = map.get(fiscalYear) ?? new Map<string, number>();
  yearMap.set(memberId, (yearMap.get(memberId) ?? 0) + amount);
  map.set(fiscalYear, yearMap);
}

function getDeclaredInvestmentIncomeFromResult(
  scenario: ScenarioData,
  result: SimulationResult,
): DeclaredInvestmentIncomeByYear {
  const map: DeclaredInvestmentIncomeByYear = new Map();
  const headMemberId = scenario.householdProfile.headMemberId || scenario.householdMembers[0]?.id;
  if (!headMemberId) return map;
  for (const row of result.annual) {
    addDeclaredIncome(map, row.year, headMemberId, row.declaredCapitalGainsIncomeTotal);
  }
  return map;
}

function areDeclaredInvestmentIncomeMapsEqual(
  a: DeclaredInvestmentIncomeByYear,
  b: DeclaredInvestmentIncomeByYear,
) {
  if (a.size !== b.size) return false;
  for (const [year, memberMap] of a) {
    const otherMemberMap = b.get(year);
    if (!otherMemberMap || otherMemberMap.size !== memberMap.size) return false;
    for (const [memberId, amount] of memberMap) {
      if (otherMemberMap.get(memberId) !== amount) return false;
    }
  }
  return true;
}

export function simulateScenario(scenario: ScenarioData): SimulationResult {
  let declaredInvestmentIncomeByYear: DeclaredInvestmentIncomeByYear = new Map();
  let result = simulateScenarioCore(scenario, getEffectiveTaxRows(scenario, declaredInvestmentIncomeByYear));

  for (let index = 0; index < 3; index += 1) {
    const nextDeclaredIncome = getDeclaredInvestmentIncomeFromResult(scenario, result);
    if (areDeclaredInvestmentIncomeMapsEqual(declaredInvestmentIncomeByYear, nextDeclaredIncome)) {
      return result;
    }
    declaredInvestmentIncomeByYear = nextDeclaredIncome;
    result = simulateScenarioCore(scenario, getEffectiveTaxRows(scenario, declaredInvestmentIncomeByYear));
  }

  return result;
}

export function aggregateAnnualResults(monthly: MonthlyResult[]): AnnualResult[] {
  const map = new Map<number, AnnualResult>();
  for (const row of monthly) {
    const year = Number(row.yearMonth.slice(0, 4));
    const current =
      map.get(year) ??
      ({
        year,
        ageYears: row.ageYears,
        ageMonths: row.ageMonths,
        incomeTotal: 0,
        retainedSourceAssetIncomeTotal: 0,
        assetTransferTotal: 0,
        assetTransferDetails: [],
        optionProfitSweepTotal: 0,
        optionProfitSweepDetails: [],
        optionIncomeSuspendedTotal: 0,
        nisaContributionSkippedTotal: 0,
        nisaAnnualLimitExceededTotal: 0,
        nisaContributionTotal: 0,
        nisaCumulativeInvestment: row.nisaCumulativeInvestment,
        nisaRemainingLifetimeLimit: row.nisaRemainingLifetimeLimit,
        assetContributionTotal: 0,
        assetContributionFundingGap: 0,
        livingExpenseTotal: 0,
        specialExpenseTotal: 0,
        taxInsuranceTotal: 0,
        capitalGainsTaxTotal: 0,
        deferredCapitalGainsTaxTotal: 0,
        declaredCapitalGainsIncomeTotal: 0,
        idecoWithholdingTaxTotal: 0,
        growthAmount: 0,
        withdrawalAmount: 0,
        plannedDrawdownTotal: 0,
        cashReserveTopUpAmount: 0,
        grossAssetWithdrawalAmount: 0,
        sourceAssetIncomeWithdrawalAmount: 0,
        deficitAssetWithdrawalAmount: 0,
        withdrawalSourceBreakdown: createWithdrawalBreakdown(),
        sourceAssetIncomeBreakdown: createWithdrawalBreakdown(),
        deficitWithdrawalBreakdown: createWithdrawalBreakdown(),
        netCashFlow: 0,
        idecoFeeTotal: 0,
        endingAssets: row.endingAssets,
        endingTrackedAssetBalances: structuredClone(row.endingTrackedAssetBalances),
        endingTrackedAssetCostBasis: structuredClone(row.endingTrackedAssetCostBasis),
        endingTrackedAssetUnrealizedGains: structuredClone(row.endingTrackedAssetUnrealizedGains),
      } satisfies AnnualResult);
    current.incomeTotal += row.incomeTotal;
    current.retainedSourceAssetIncomeTotal += row.retainedSourceAssetIncomeTotal;
    current.assetTransferTotal += row.assetTransferTotal;
    current.assetTransferDetails.push(...row.assetTransferDetails);
    current.optionProfitSweepTotal += row.optionProfitSweepTotal;
    current.optionProfitSweepDetails.push(...row.optionProfitSweepDetails);
    current.optionIncomeSuspendedTotal += row.optionIncomeSuspendedTotal;
    current.nisaContributionSkippedTotal += row.nisaContributionSkippedTotal;
    current.nisaAnnualLimitExceededTotal += row.nisaAnnualLimitExceededTotal;
    current.nisaContributionTotal += row.nisaContributionTotal;
    current.nisaCumulativeInvestment = row.nisaCumulativeInvestment;
    current.nisaRemainingLifetimeLimit = row.nisaRemainingLifetimeLimit;
    current.assetContributionTotal += row.assetContributionTotal;
    current.assetContributionFundingGap += row.assetContributionFundingGap;
    current.livingExpenseTotal += row.livingExpenseTotal;
    current.specialExpenseTotal += row.specialExpenseTotal;
    current.taxInsuranceTotal += row.taxInsuranceTotal;
    current.capitalGainsTaxTotal += row.capitalGainsTaxTotal;
    current.deferredCapitalGainsTaxTotal += row.deferredCapitalGainsTaxTotal;
    current.declaredCapitalGainsIncomeTotal += row.declaredCapitalGainsIncomeTotal;
    current.idecoWithholdingTaxTotal += row.idecoWithholdingTaxTotal;
    current.growthAmount += row.growthAmount;
    current.withdrawalAmount += row.withdrawalAmount;
    current.plannedDrawdownTotal += row.plannedDrawdownTotal;
    current.cashReserveTopUpAmount += row.cashReserveTopUpAmount;
    current.grossAssetWithdrawalAmount += row.grossAssetWithdrawalAmount;
    current.sourceAssetIncomeWithdrawalAmount += row.sourceAssetIncomeWithdrawalAmount;
    current.deficitAssetWithdrawalAmount += row.deficitAssetWithdrawalAmount;
    for (const key of growthAssetOrder) {
      current.withdrawalSourceBreakdown[key] += row.withdrawalSourceBreakdown[key];
      current.sourceAssetIncomeBreakdown[key] += row.sourceAssetIncomeBreakdown[key];
      current.deficitWithdrawalBreakdown[key] += row.deficitWithdrawalBreakdown[key];
    }
    current.netCashFlow += row.netCashFlow;
    current.idecoFeeTotal += row.idecoFeeTotal;
    current.endingAssets = row.endingAssets;
    current.endingTrackedAssetBalances = structuredClone(row.endingTrackedAssetBalances);
    current.endingTrackedAssetCostBasis = structuredClone(row.endingTrackedAssetCostBasis);
    current.endingTrackedAssetUnrealizedGains = structuredClone(row.endingTrackedAssetUnrealizedGains);
    current.ageYears = row.ageYears;
    current.ageMonths = row.ageMonths;
    map.set(year, current);
  }
  return [...map.values()];
}

export function getBalanceAtAge(monthly: MonthlyResult[], targetAge: number) {
  const row = monthly.find((item) => item.ageYears >= targetAge);
  return row?.endingAssets;
}

export function cloneScenario(scenario: ScenarioData, name: string): ScenarioData {
  return {
    ...structuredClone(scenario),
    id: crypto.randomUUID(),
    name,
    compare: true,
  };
}
