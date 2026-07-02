import { getIncomeEventAmountForMonth } from "@/lib/incomeEvents";
import { getEffectiveHouseholdMemberForMonth, calculateAutoTaxDetails, type AutoTaxYearDetail } from "@/lib/taxEngine";
import { getSalaryIncomeForYear, isWorkplaceSocialInsuranceCovered } from "@/lib/spouseWorkstyleTaxSocial";
import { isEventActive, simulateScenario } from "@/lib/simulation";
import type { AnnualResult, HouseholdMember, IncomeEvent, ScenarioData, YearMonth } from "@/types";

export type SpousePartIncomeAggregationMode = "incomeYear" | "cashPaymentYear";

export type SpousePartIncomeEfficiencyRow = {
  scenarioId: string;
  scenarioName: string;
  spouseSalaryIncome: number;
  incomeDelta: number;
  taxSocialDelta: number;
  incomeResidentTaxDelta: number;
  socialInsuranceDelta: number;
  deductionImpactLabel: string;
  netTakeHomeDelta: number;
  takeHomeRate: number | null;
  burdenRate: number | null;
  socialInsuranceJudgmentLabel: string;
  reading: string;
  hasOtherConditionDifferences: boolean;
  isBaseline: boolean;
};

type TaxSocialSummary = {
  total: number;
  incomeResidentTax: number;
  socialInsurance: number;
};

const spouseSalaryEventTypes = new Set<IncomeEvent["type"]>(["salary"]);
const ignoredScenarioKeysForOtherDiff = new Set<keyof ScenarioData>(["id", "name", "description", "compare", "reviewAcknowledgements"]);

function monthInYear(year: number, month: number): YearMonth {
  return `${year}-${String(month).padStart(2, "0")}` as YearMonth;
}

function getSpouse(scenario: ScenarioData): HouseholdMember | undefined {
  return scenario.householdMembers.find((member) => member.relationship === "spouse");
}

export function buildScenarioForSpouseIncomeOnlyComparison(
  baselineScenario: ScenarioData,
  targetScenario: ScenarioData,
): ScenarioData {
  const scenario = structuredClone(baselineScenario);
  scenario.id = `spouse-income-only-${baselineScenario.id}-${targetScenario.id}`;
  scenario.name = targetScenario.name;
  const baselineSpouse = getSpouse(baselineScenario);
  const targetSpouse = getSpouse(targetScenario);
  const scenarioSpouse = getSpouse(scenario);
  if (!baselineSpouse || !targetSpouse || !scenarioSpouse) return scenario;

  scenario.incomeEvents = scenario.incomeEvents.filter(
    (event) => !(event.memberId === baselineSpouse.id && spouseSalaryEventTypes.has(event.type)),
  );
  scenario.incomeEvents.push(
    ...targetScenario.incomeEvents
      .filter((event) => event.memberId === targetSpouse.id && spouseSalaryEventTypes.has(event.type))
      .map((event) => ({
        ...structuredClone(event),
        id: `spouse-income-only-${targetScenario.id}-${event.id}`,
        memberId: scenarioSpouse.id,
      })),
  );

  scenarioSpouse.workplaceSocialInsurance = targetSpouse.workplaceSocialInsurance
    ? structuredClone(targetSpouse.workplaceSocialInsurance)
    : undefined;
  scenarioSpouse.isNationalHealthInsuranceMember = targetSpouse.isNationalHealthInsuranceMember;
  scenarioSpouse.isDependent = targetSpouse.isDependent;
  scenarioSpouse.dependsOnMemberId =
    targetSpouse.dependsOnMemberId === targetSpouse.id || targetSpouse.dependsOnMemberId === undefined
      ? targetSpouse.dependsOnMemberId
      : targetSpouse.dependsOnMemberId;

  return scenario;
}

export function getSpouseSalaryIncomeForYear(scenario: ScenarioData, year: number): number {
  const spouse = getSpouse(scenario);
  if (!spouse) return 0;
  const events = scenario.incomeEvents.filter((event) => event.memberId === spouse.id && spouseSalaryEventTypes.has(event.type));
  return Math.round(
    Array.from({ length: 12 }, (_, index) => monthInYear(year, index + 1)).reduce((sum, yearMonth) => {
      return (
        sum +
        events.reduce((eventSum, event) => {
          if (!isEventActive(event, yearMonth)) return eventSum;
          return eventSum + getIncomeEventAmountForMonth(event, yearMonth, scenario);
        }, 0)
      );
    }, 0),
  );
}

export function getSpousePartIncomeCompareYears(scenarios: ScenarioData[]): number[] {
  const years = new Set<number>();
  for (const scenario of scenarios) {
    const startYear = Number(scenario.userProfile.simulationStartYearMonth.slice(0, 4));
    const endYear =
      scenario.userProfile.simulationEndMode === "yearMonth" && scenario.userProfile.simulationEndYearMonth
        ? Number(scenario.userProfile.simulationEndYearMonth.slice(0, 4))
        : startYear + Math.max(0, (scenario.userProfile.simulationEndAge ?? 95) - 55);
    for (let year = startYear; year <= Math.min(endYear, startYear + 80); year += 1) {
      years.add(year);
    }
  }
  return [...years].sort((a, b) => a - b);
}

export function getDefaultSpousePartIncomeCompareYear(scenarios: ScenarioData[], fallbackYear: number): number {
  const years = getSpousePartIncomeCompareYears(scenarios);
  for (const year of years) {
    const salaryValues = new Set(scenarios.map((scenario) => getSpouseSalaryIncomeForYear(scenario, year)));
    if (salaryValues.size > 1) return year;
  }
  return fallbackYear;
}

function getIncomeYearTaxSocialSummary(detail?: AutoTaxYearDetail): TaxSocialSummary {
  if (!detail) {
    return { total: 0, incomeResidentTax: 0, socialInsurance: 0 };
  }
  const incomeResidentTax = detail.memberDetails.reduce(
    (sum, member) => sum + member.incomeTaxAnnual + member.residentTaxAnnual + member.retirementIncomeTaxAnnual + member.retirementResidentTaxAnnual,
    0,
  );
  const nationalPensionAnnual = detail.memberDetails.reduce((sum, member) => sum + member.nationalPensionAnnual, 0);
  const socialInsurance =
    nationalPensionAnnual +
    detail.nationalHealthInsuranceAnnual +
    detail.lateElderlyMedicalAnnual +
    detail.nursingCareAnnual +
    detail.otherPublicCostAnnual;
  return {
    total: Math.round(incomeResidentTax + socialInsurance),
    incomeResidentTax: Math.round(incomeResidentTax),
    socialInsurance: Math.round(socialInsurance),
  };
}

function getCashPaymentYearTaxSocialSummary(row?: AnnualResult): TaxSocialSummary {
  if (!row) {
    return { total: 0, incomeResidentTax: 0, socialInsurance: 0 };
  }
  const incomeResidentTax =
    row.taxCashBreakdown.incomeTaxSettlement +
    row.taxCashBreakdown.residentTax +
    row.taxCashBreakdown.deferredCapitalGainsTax +
    row.capitalGainsTaxTotal +
    row.idecoWithholdingTaxTotal;
  const socialInsurance =
    row.taxCashBreakdown.nationalPension +
    row.taxCashBreakdown.nationalHealthInsurance +
    row.taxCashBreakdown.lateElderlyMedical +
    row.taxCashBreakdown.nursingCare +
    row.taxCashBreakdown.propertyTax +
    row.taxCashBreakdown.otherPublicCost;
  return {
    total: Math.round(row.taxInsuranceTotal + row.capitalGainsTaxTotal + row.idecoWithholdingTaxTotal),
    incomeResidentTax: Math.round(incomeResidentTax),
    socialInsurance: Math.round(socialInsurance),
  };
}

function getAutoTaxDetailsForScenario(cache: WeakMap<ScenarioData, AutoTaxYearDetail[]>, scenario: ScenarioData) {
  const cached = cache.get(scenario);
  if (cached) return cached;
  const details = calculateAutoTaxDetails(scenario);
  cache.set(scenario, details);
  return details;
}

function getAnnualResultsForScenario(cache: WeakMap<ScenarioData, AnnualResult[]>, scenario: ScenarioData) {
  const cached = cache.get(scenario);
  if (cached) return cached;
  const annual = simulateScenario(scenario).annual;
  cache.set(scenario, annual);
  return annual;
}

function getTaxSocialSummary(
  scenario: ScenarioData,
  year: number,
  mode: SpousePartIncomeAggregationMode,
  cache: {
    autoTaxDetails: WeakMap<ScenarioData, AutoTaxYearDetail[]>;
    annualResults: WeakMap<ScenarioData, AnnualResult[]>;
  },
): TaxSocialSummary {
  if (mode === "cashPaymentYear") {
    return getCashPaymentYearTaxSocialSummary(getAnnualResultsForScenario(cache.annualResults, scenario).find((row) => row.year === year));
  }
  return getIncomeYearTaxSocialSummary(getAutoTaxDetailsForScenario(cache.autoTaxDetails, scenario).find((detail) => detail.fiscalYear === year));
}

function getDeductionImpactLabel(scenario: ScenarioData, year: number, spouseSalaryIncome: number, detail?: AutoTaxYearDetail): string {
  const spouseTotalIncome = getSalaryIncomeForYear(spouseSalaryIncome, year);
  const self = scenario.householdMembers.find((member) => member.relationship === "self") ?? scenario.householdMembers[0];
  const selfDetail = detail?.memberDetails.find((member) => member.memberId === self?.id);
  const incomeTaxDeduction = selfDetail?.dependentDeductionsIncomeTaxAnnual ?? 0;
  const residentTaxDeduction = selfDetail?.dependentDeductionsResidentTaxAnnual ?? 0;
  const spouseSpecialDeduction = (selfDetail?.spouseSpecialDeductionIncomeTaxAnnual ?? 0) + (selfDetail?.spouseSpecialDeductionResidentTaxAnnual ?? 0);

  if (incomeTaxDeduction > 0 || residentTaxDeduction > 0) return "配偶者控除維持";
  if (spouseTotalIncome > 1_330_000) return "配偶者控除なし";
  if (spouseTotalIncome <= 950_000) return "配偶者特別控除へ移行";
  if (spouseSpecialDeduction <= 0 && spouseTotalIncome <= 1_330_000) return "配偶者特別控除縮小";
  return "配偶者特別控除縮小";
}

function getSocialInsuranceJudgmentLabel(scenario: ScenarioData, year: number, spouseSalaryIncome: number): string {
  const spouse = getSpouse(scenario);
  if (!spouse) return "配偶者なし";
  const effectiveSpouse = getEffectiveHouseholdMemberForMonth(scenario, spouse, monthInYear(year, 12));
  const settings = effectiveSpouse.workplaceSocialInsurance ?? {};
  if (isWorkplaceSocialInsuranceCovered(settings, settings.joinStartYearMonth ?? monthInYear(year, 12))) {
    return "勤務先社保加入";
  }
  if (settings.isApplicableWorkplace === undefined && spouseSalaryIncome >= 1_200_000) {
    return "要確認: 適用事業所未設定";
  }
  if (effectiveSpouse.isNationalHealthInsuranceMember || spouseSalaryIncome >= 1_300_000) {
    return "勤務先社保なし・国保判定";
  }
  return "扶養/国保なし";
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function normalizeHouseholdMembersForOtherDiff(scenario: ScenarioData): unknown {
  const spouse = getSpouse(scenario);
  return scenario.householdMembers
    .map((member) => {
      if (spouse && member.id === spouse.id) {
        const { workplaceSocialInsurance, isNationalHealthInsuranceMember, isDependent, dependsOnMemberId, ...rest } = member;
        return { ...rest, id: "spouse" };
      }
      return { ...member, id: member.relationship };
    })
    .sort((a, b) => `${a.relationship}-${a.name}`.localeCompare(`${b.relationship}-${b.name}`));
}

function normalizeScenarioForOtherDiff(scenario: ScenarioData): unknown {
  const spouse = getSpouse(scenario);
  const normalized: Partial<Record<keyof ScenarioData, unknown>> = {};
  for (const [key, value] of Object.entries(scenario) as [keyof ScenarioData, unknown][]) {
    if (ignoredScenarioKeysForOtherDiff.has(key)) continue;
    if (key === "householdMembers") {
      normalized.householdMembers = normalizeHouseholdMembersForOtherDiff(scenario);
      continue;
    }
    if (key === "incomeEvents") {
      normalized.incomeEvents = scenario.incomeEvents
        .filter((event) => !(spouse && event.memberId === spouse.id && spouseSalaryEventTypes.has(event.type)))
        .map((event) => ({ ...event, id: "", memberId: event.memberId === spouse?.id ? "spouse" : event.memberId }))
        .sort((a, b) => `${a.memberId}-${a.type}-${a.name}-${a.startYearMonth}`.localeCompare(`${b.memberId}-${b.type}-${b.name}-${b.startYearMonth}`));
      continue;
    }
    normalized[key] = value;
  }
  return {
    ...normalized,
  };
}

function hasOtherConditionDifferences(baseline: ScenarioData, scenario: ScenarioData): boolean {
  return stableStringify(normalizeScenarioForOtherDiff(baseline)) !== stableStringify(normalizeScenarioForOtherDiff(scenario));
}

function getReading(row: Omit<SpousePartIncomeEfficiencyRow, "reading">): string {
  if (row.hasOtherConditionDifferences && !row.isBaseline) {
    return "妻の給与以外にも条件差がありますが、主計算では妻の給与・働き方設定だけを基準シナリオへ差し替えて比較しています。";
  }
  if (row.incomeDelta <= 0) return row.isBaseline ? "比較基準です。" : "収入増がないため率は表示しません。";
  if (row.socialInsuranceJudgmentLabel.includes("要確認") || (row.spouseSalaryIncome >= 1_250_000 && row.spouseSalaryIncome <= 1_350_000)) {
    return "130万円付近で社会保険の確認が必要です。勤務先社保または国保の扱いを確認してください。";
  }
  if (row.takeHomeRate !== null && row.takeHomeRate < 0.6) {
    return "手残り率が下がっています。控除縮小または社保加入が主因です。";
  }
  if (row.takeHomeRate !== null) {
    return `追加収入の約${Math.round(row.takeHomeRate * 100)}%が世帯に残ります。`;
  }
  return "税・社会保険タブで内訳を確認してください。";
}

export function buildSpousePartIncomeEfficiencyRows(
  scenarios: ScenarioData[],
  baselineScenarioId: string,
  year: number,
  mode: SpousePartIncomeAggregationMode,
): SpousePartIncomeEfficiencyRow[] {
  const baselineScenario = scenarios.find((scenario) => scenario.id === baselineScenarioId) ?? scenarios[0];
  const baselineSalary = baselineScenario ? getSpouseSalaryIncomeForYear(baselineScenario, year) : 0;
  const cache = {
    autoTaxDetails: new WeakMap<ScenarioData, AutoTaxYearDetail[]>(),
    annualResults: new WeakMap<ScenarioData, AnnualResult[]>(),
  };
  const baselineTaxSocial = baselineScenario
    ? getTaxSocialSummary(baselineScenario, year, mode, cache)
    : { total: 0, incomeResidentTax: 0, socialInsurance: 0 };

  return scenarios.map((scenario) => {
    const spouseSalaryIncome = getSpouseSalaryIncomeForYear(scenario, year);
    const scenarioForSpouseCompare = baselineScenario ? buildScenarioForSpouseIncomeOnlyComparison(baselineScenario, scenario) : scenario;
    const taxSocial = getTaxSocialSummary(scenarioForSpouseCompare, year, mode, cache);
    const autoTaxDetail =
      mode === "incomeYear" ? getAutoTaxDetailsForScenario(cache.autoTaxDetails, scenarioForSpouseCompare).find((detail) => detail.fiscalYear === year) : undefined;
    const incomeDelta = spouseSalaryIncome - baselineSalary;
    const taxSocialDelta = taxSocial.total - baselineTaxSocial.total;
    const netTakeHomeDelta = incomeDelta - taxSocialDelta;
    const baseRow: Omit<SpousePartIncomeEfficiencyRow, "reading"> = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      spouseSalaryIncome,
      incomeDelta,
      taxSocialDelta,
      incomeResidentTaxDelta: taxSocial.incomeResidentTax - baselineTaxSocial.incomeResidentTax,
      socialInsuranceDelta: taxSocial.socialInsurance - baselineTaxSocial.socialInsurance,
      deductionImpactLabel: getDeductionImpactLabel(scenarioForSpouseCompare, year, spouseSalaryIncome, autoTaxDetail),
      netTakeHomeDelta,
      takeHomeRate: incomeDelta > 0 ? netTakeHomeDelta / incomeDelta : null,
      burdenRate: incomeDelta > 0 ? taxSocialDelta / incomeDelta : null,
      socialInsuranceJudgmentLabel: getSocialInsuranceJudgmentLabel(scenarioForSpouseCompare, year, spouseSalaryIncome),
      hasOtherConditionDifferences: baselineScenario ? hasOtherConditionDifferences(baselineScenario, scenario) : false,
      isBaseline: scenario.id === baselineScenario?.id,
    };
    return {
      ...baseRow,
      reading: getReading(baseRow),
    };
  });
}
