import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sampleState } from "@/data/sampleData";
import { cloneScenario } from "@/lib/simulation";
import type {
  AgeExpenseAdjustment,
  HouseholdMember,
  HouseholdProfile,
  PlanBackup,
  RetirementPlanSnapshot,
  RetirementPlanState,
  ScenarioData,
  OptionSubAccount,
  AssetContributionEvent,
  RetirementIncomeEvent,
  TaxDeductionByFiscalYear,
} from "@/types";

type PlanStore = RetirementPlanState & {
  setActiveScenario: (id: string) => void;
  updateActiveScenario: (updater: (scenario: ScenarioData) => ScenarioData) => void;
  duplicateScenario: (id: string) => void;
  deleteScenario: (id: string) => void;
  toggleScenarioCompare: (id: string) => void;
  replaceState: (state: RetirementPlanState) => void;
  resetToSample: () => void;
  createBackup: (label?: string) => void;
  restoreBackup: (id: string) => void;
  deleteBackup: (id: string) => void;
};

type LegacyInitialAssets = Partial<ScenarioData["initialAssets"]> & { securities?: number };
type LegacyMonthlyExpenses = Partial<ScenarioData["monthlyExpenses"]> & {
  subscriptions?: number;
  medical?: number;
  leisure?: number;
  miscellaneous?: number;
  otherFixed?: number;
  otherVariable?: number;
};
type LegacyIncomeEvent = Partial<ScenarioData["incomeEvents"][number]> & { taxable?: boolean };
type LegacyRetirementIncomeEvent = Partial<RetirementIncomeEvent> & { alreadyReceived?: boolean };
type LegacyTaxDeductionEvent = Partial<TaxDeductionByFiscalYear>;
type LegacyScenario = Omit<Partial<ScenarioData>, "initialAssets" | "monthlyExpenses" | "incomeEvents" | "retirementIncomeEvents" | "growthSettings"> & {
  initialAssets?: LegacyInitialAssets;
  monthlyExpenses?: LegacyMonthlyExpenses;
  incomeEvents?: LegacyIncomeEvent[];
  retirementIncomeEvents?: LegacyRetirementIncomeEvent[];
  taxDeductionEvents?: LegacyTaxDeductionEvent[];
  growthSettings?: {
    enabled?: boolean;
    annualGrowthRate?: number;
  };
};

const baseScenario = sampleState.scenarios[0];
const maxBackups = 5;

function nowIso() {
  return new Date().toISOString();
}

function createSnapshot(state: Pick<RetirementPlanState, "version" | "activeScenarioId" | "scenarios" | "lastSavedAt">): RetirementPlanSnapshot {
  return {
    version: 1,
    activeScenarioId: state.activeScenarioId,
    scenarios: structuredClone(state.scenarios),
    lastSavedAt: state.lastSavedAt,
  };
}

function createBackupEntry(state: RetirementPlanState, label = "手動バックアップ"): PlanBackup {
  const savedAt = nowIso();
  return {
    id: crypto.randomUUID(),
    savedAt,
    label,
    state: {
      ...createSnapshot(state),
      lastSavedAt: savedAt,
    },
  };
}

function rotateBackups(backups: PlanBackup[], backup: PlanBackup) {
  return [backup, ...backups].slice(0, maxBackups);
}

function touch<T extends Partial<RetirementPlanState>>(partial: T): T & { lastSavedAt: string } {
  return {
    ...partial,
    lastSavedAt: nowIso(),
  };
}

function seniorAgeOrDefault(value: unknown, fallback = 60) {
  const age = typeof value === "number" ? Math.round(value) : Number(value);
  if (!Number.isFinite(age) || age < 60 || age > 130) return fallback;
  return age;
}

function inferSeniorAgeFromName(name: unknown) {
  if (typeof name !== "string") return undefined;
  const match = name.match(/(\d{2,3})/);
  if (!match) return undefined;
  const age = Number(match[1]);
  return age >= 60 && age <= 130 ? age : undefined;
}

function normalizeAgeExpenseAdjustments(source: LegacyScenario): AgeExpenseAdjustment[] {
  return (source.ageExpenseAdjustments ?? []).map((adjustment, index) => {
    const fallbackStartAge = inferSeniorAgeFromName(adjustment.name) ?? 60;
    const startAge = seniorAgeOrDefault(adjustment.startAge, fallbackStartAge);
    const endAge = adjustment.endAge === undefined ? undefined : seniorAgeOrDefault(adjustment.endAge, startAge);

    return {
      id: adjustment.id ?? `age-expense-${index}`,
      name: adjustment.name ?? `${startAge}歳から`,
      startAge,
      endAge: endAge !== undefined && endAge >= startAge ? endAge : undefined,
      target: adjustment.target ?? "all",
      mode: adjustment.mode ?? "multiplier",
      value: Number.isFinite(adjustment.value) ? adjustment.value : 1,
      note: adjustment.note,
    };
  });
}

function normalizeRetirementIncomeEvents(events: LegacyRetirementIncomeEvent[] | undefined): RetirementIncomeEvent[] {
  return (events ?? []).map((event, index) => ({
    id: event.id ?? `retirement-${index}`,
    memberId: event.memberId ?? "member-self",
    name: event.name ?? "退職所得",
    type: event.type ?? "companyRetirementAllowance",
    paymentYearMonth: event.paymentYearMonth ?? "2026-04",
    grossAmount: Number.isFinite(event.grossAmount) ? Number(event.grossAmount) : 0,
    serviceYears: Number.isFinite(event.serviceYears) ? Number(event.serviceYears) : 20,
    alreadyReceived: event.alreadyReceived ?? false,
    retirementIncomeDeductionUsed: event.retirementIncomeDeductionUsed ?? event.alreadyReceived ?? false,
    withholdingTaxPaid: Number.isFinite(event.withholdingTaxPaid) ? Number(event.withholdingTaxPaid) : 0,
    residentTaxMunicipalPaid: Number.isFinite((event as RetirementIncomeEvent).residentTaxMunicipalPaid)
      ? Number((event as RetirementIncomeEvent).residentTaxMunicipalPaid)
      : 0,
    residentTaxPrefecturalPaid: Number.isFinite((event as RetirementIncomeEvent).residentTaxPrefecturalPaid)
      ? Number((event as RetirementIncomeEvent).residentTaxPrefecturalPaid)
      : 0,
    note: event.note,
  }));
}

function normalizeTaxDeductionEvents(source: LegacyScenario): TaxDeductionByFiscalYear[] {
  return (source.taxDeductionEvents ?? []).map((event, index) => ({
    id: event.id ?? `tax-deduction-${index}`,
    fiscalYear: Number.isFinite(event.fiscalYear) ? Number(event.fiscalYear) : new Date().getFullYear(),
    memberId: event.memberId ?? source.householdProfile?.headMemberId ?? "member-self",
    socialInsuranceDeductionAnnual: Number.isFinite(event.socialInsuranceDeductionAnnual)
      ? Number(event.socialInsuranceDeductionAnnual)
      : 0,
    medicalExpenseDeductionAnnual: Number.isFinite(event.medicalExpenseDeductionAnnual)
      ? Number(event.medicalExpenseDeductionAnnual)
      : 0,
    note: event.note,
  }));
}

function normalizeAssetContributionEvents(events: AssetContributionEvent[]): AssetContributionEvent[] {
  return events.map((event) => {
    if (event.assetKey !== "nisa") return event;
    const isSingleMonth = !event.endYearMonth || event.endYearMonth === event.startYearMonth;
    const looksLikeGrowthInvestment = event.nisaInvestmentSlot === "growth" || (isSingleMonth && event.monthlyAmount > 1_000_000);
    const nisaInvestmentSlot = event.nisaInvestmentSlot ?? (looksLikeGrowthInvestment ? "growth" : "tsumitate");
    return {
      ...event,
      nisaInvestmentSlot,
      contributionPriority: event.contributionPriority ?? (nisaInvestmentSlot === "growth" ? 2 : 1),
      carryOverSkipped: event.carryOverSkipped ?? nisaInvestmentSlot === "growth",
    };
  });
}

function createDefaultHouseholdMembers(source: LegacyScenario): HouseholdMember[] {
  const birthDate = source.userProfile?.birthDate ?? baseScenario.userProfile.birthDate;
  return [
    {
      id: "member-self",
      name: "本人",
      relationship: "self",
      birthDate,
      isResident: true,
      isNationalHealthInsuranceMember: true,
      isLateElderlyMedicalMember: false,
      isLongTermCareInsured: false,
      isDependent: false,
    },
  ];
}

function normalizeHouseholdProfile(source: LegacyScenario, members: HouseholdMember[]): HouseholdProfile {
  const existing = source.householdProfile ?? baseScenario.householdProfile;
  return {
    municipality: existing.municipality ?? source.userProfile?.municipality ?? baseScenario.householdProfile.municipality,
    headMemberId: existing.headMemberId ?? members[0]?.id ?? "member-self",
    taxCalculationMode: existing.taxCalculationMode ?? baseScenario.householdProfile.taxCalculationMode,
    notes: existing.notes,
  };
}

function normalizeHouseholdMembers(source: LegacyScenario): HouseholdMember[] {
  const members = source.householdMembers?.length ? source.householdMembers : createDefaultHouseholdMembers(source);
  const normalized = members.map((member, index) => ({
    id: member.id ?? `member-${index + 1}`,
    name: member.name ?? (index === 0 ? "本人" : `メンバー${index + 1}`),
    relationship: member.relationship ?? (index === 0 ? "self" : "other"),
    birthDate: member.birthDate ?? source.userProfile?.birthDate ?? baseScenario.userProfile.birthDate,
    isResident: member.isResident ?? true,
    isNationalHealthInsuranceMember: member.isNationalHealthInsuranceMember ?? index === 0,
    isLateElderlyMedicalMember: member.isLateElderlyMedicalMember ?? false,
    isLongTermCareInsured: member.isLongTermCareInsured ?? false,
    isDependent: (member.relationship ?? (index === 0 ? "self" : "other")) === "self" ? false : (member.isDependent ?? false),
    dependsOnMemberId: (member.relationship ?? (index === 0 ? "self" : "other")) === "self" ? undefined : member.dependsOnMemberId,
    notes: member.notes,
  }));

  if (source.userProfile?.hasSpouse && !normalized.some((member) => member.relationship === "spouse")) {
    normalized.push({
      id: crypto.randomUUID(),
      name: "配偶者",
      relationship: "spouse",
      birthDate: source.userProfile?.birthDate ?? baseScenario.userProfile.birthDate,
      isResident: true,
      isNationalHealthInsuranceMember: false,
      isLateElderlyMedicalMember: false,
      isLongTermCareInsured: false,
      isDependent: false,
      dependsOnMemberId: undefined,
      notes: undefined,
    });
  }

  return normalized;
}

function normalizeOptionSubAccounts(source: LegacyScenario, legacyAssets: LegacyInitialAssets): OptionSubAccount[] {
  const existing = source.optionSubAccounts;
  if (Array.isArray(existing) && existing.length > 0) {
    return existing.map((account, index) => ({
      ...baseScenario.optionSubAccounts[0],
      ...account,
      id: account.id ?? `option-${index + 1}`,
      name: account.name ?? `普通口座${index + 1}`,
      enabled: account.enabled ?? true,
      initialValue: Number.isFinite(account.initialValue) ? Number(account.initialValue) : 0,
      initialCostBasis: Math.min(
        Number.isFinite(account.initialCostBasis) ? Number(account.initialCostBasis) : 0,
        Number.isFinite(account.initialValue) ? Number(account.initialValue) : 0,
      ),
      withdrawalPriority: Number.isFinite(account.withdrawalPriority) ? Number(account.withdrawalPriority) : index + 1,
      releaseProtectionAfterEnd: account.releaseProtectionAfterEnd ?? true,
    }));
  }

  const value = legacyAssets.ordinaryAccountForOptions ?? source.initialAssets?.ordinaryAccountForOptions ?? baseScenario.initialAssets.ordinaryAccountForOptions;
  const basis =
    source.initialAssetCostBasis?.ordinaryAccountForOptions ??
    legacyAssets.ordinaryAccountForOptions ??
    baseScenario.initialAssetCostBasis.ordinaryAccountForOptions;
  const rules = {
    ...baseScenario.optionAccountRules,
    ...(source.optionAccountRules ?? {}),
  };
  return [
    {
      id: "option-default",
      name: "普通口座（オプション用）",
      initialValue: Number(value) || 0,
      initialCostBasis: Math.min(Number(basis) || 0, Number(value) || 0),
      startYearMonth: source.userProfile?.simulationStartYearMonth ?? baseScenario.userProfile.simulationStartYearMonth,
      enabled: rules.enabled,
      minimumBalance: rules.minimumBalance,
      targetBalance: rules.targetBalance,
      withdrawalPriority: 1,
      protectFromWithdrawal: rules.protectFromWithdrawal,
      releaseProtectionAfterEnd: true,
      suspendIncomeWhenBelowMinimum: rules.suspendIncomeWhenBelowMinimum,
      profitSweepEnabled: rules.profitSweepEnabled,
      profitSweepDestination: rules.profitSweepDestination,
      profitSweepTiming: rules.profitSweepTiming,
      profitSweepMethod: rules.profitSweepMethod,
      fixedSweepAmount: rules.fixedSweepAmount,
    },
  ];
}

function normalizeScenario(input: LegacyScenario | undefined, index: number): ScenarioData {
  const source = input ?? {};
  const legacyAssets: LegacyInitialAssets = source.initialAssets ?? {};
  const legacyExpenses: LegacyMonthlyExpenses = source.monthlyExpenses ?? {};
  const legacyGrowthRate = source.growthSettings?.annualGrowthRate ?? baseScenario.assetGrowthSettings.rates.specificAccount;
  const incomeEvents = (source.incomeEvents ?? baseScenario.incomeEvents) as LegacyIncomeEvent[];
  const householdMembers = normalizeHouseholdMembers(source);
  const householdProfile = normalizeHouseholdProfile(source, householdMembers);
  const memberIds = new Set(householdMembers.map((member) => member.id));
  const defaultMemberId = householdProfile.headMemberId && memberIds.has(householdProfile.headMemberId)
    ? householdProfile.headMemberId
    : householdMembers[0]?.id ?? "member-self";

  const scenario: ScenarioData = {
    ...structuredClone(baseScenario),
    ...source,
    id: source.id ?? `scenario-${index + 1}`,
    name: source.name ?? `シナリオ${index + 1}`,
    compare: source.compare ?? true,
    userProfile: {
      ...baseScenario.userProfile,
      ...source.userProfile,
      cashReserve: Number.isFinite(source.userProfile?.cashReserve)
        ? Number(source.userProfile?.cashReserve)
        : baseScenario.userProfile.cashReserve,
      simulationEndAge:
        source.userProfile?.simulationEndAge === undefined
          ? baseScenario.userProfile.simulationEndAge
          : seniorAgeOrDefault(source.userProfile.simulationEndAge, baseScenario.userProfile.simulationEndAge ?? 95),
      targetBalanceAge: seniorAgeOrDefault(
        source.userProfile?.targetBalanceAge,
        baseScenario.userProfile.targetBalanceAge,
      ),
      targetBalanceAmount: Number.isFinite(source.userProfile?.targetBalanceAmount)
        ? Number(source.userProfile?.targetBalanceAmount)
        : baseScenario.userProfile.targetBalanceAmount,
      plannedDrawdownEnabled:
        source.userProfile?.plannedDrawdownEnabled ?? baseScenario.userProfile.plannedDrawdownEnabled,
    },
    householdProfile,
    householdMembers,
    initialAssets: {
      ...baseScenario.initialAssets,
      ...legacyAssets,
      nisa: legacyAssets.nisa ?? 0,
      specificAccount: legacyAssets.specificAccount ?? legacyAssets.securities ?? baseScenario.initialAssets.specificAccount,
      ordinaryAccountForOptions:
        legacyAssets.ordinaryAccountForOptions ?? baseScenario.initialAssets.ordinaryAccountForOptions,
      ideco: legacyAssets.ideco ?? baseScenario.initialAssets.ideco,
    },
    initialAssetCostBasis: {
      ...baseScenario.initialAssetCostBasis,
      ...(source.initialAssetCostBasis ?? {}),
      nisa: source.initialAssetCostBasis?.nisa ?? legacyAssets.nisa ?? baseScenario.initialAssetCostBasis.nisa,
      specificAccount:
        source.initialAssetCostBasis?.specificAccount ??
        legacyAssets.specificAccount ??
        legacyAssets.securities ??
        baseScenario.initialAssetCostBasis.specificAccount,
      ordinaryAccountForOptions:
        source.initialAssetCostBasis?.ordinaryAccountForOptions ??
        legacyAssets.ordinaryAccountForOptions ??
        baseScenario.initialAssetCostBasis.ordinaryAccountForOptions,
      ideco: source.initialAssetCostBasis?.ideco ?? legacyAssets.ideco ?? baseScenario.initialAssetCostBasis.ideco,
    },
    monthlyExpenses: {
      ...baseScenario.monthlyExpenses,
      ...legacyExpenses,
      hobbyEntertainment:
        legacyExpenses.hobbyEntertainment ?? legacyExpenses.leisure ?? baseScenario.monthlyExpenses.hobbyEntertainment,
      healthMedical: legacyExpenses.healthMedical ?? legacyExpenses.medical ?? baseScenario.monthlyExpenses.healthMedical,
      other:
        legacyExpenses.other ??
        legacyExpenses.miscellaneous ??
        legacyExpenses.otherVariable ??
        baseScenario.monthlyExpenses.other,
    },
    ageExpenseAdjustments: normalizeAgeExpenseAdjustments(source),
    incomeEvents: incomeEvents.map((event, eventIndex) => ({
      ...baseScenario.incomeEvents[0],
      ...event,
      id: event.id ?? `income-${index}-${eventIndex}`,
      memberId: memberIds.has(event.memberId ?? "") ? event.memberId! : defaultMemberId,
      sourceAssetPayoutMode: event.sourceAssetPayoutMode ?? "cash",
      idecoPensionPayoutMode:
        event.type === "pension" && event.sourceAssetKey === "ideco"
          ? event.idecoPensionPayoutMode ?? "monexSchedule"
          : event.idecoPensionPayoutMode,
      taxTreatment:
        event.taxTreatment ?? (event.taxable === false ? "nonTaxable" : event.taxable === true ? "taxable" : "taxable"),
    })),
    assetContributionEvents: normalizeAssetContributionEvents(source.assetContributionEvents ?? []),
    retirementIncomeEvents: normalizeRetirementIncomeEvents(source.retirementIncomeEvents),
    assetTransferEvents: source.assetTransferEvents ?? [],
    withdrawalOrder:
      source.withdrawalOrder?.length === 6
        ? source.withdrawalOrder
        : structuredClone(baseScenario.withdrawalOrder),
    specialExpenses: source.specialExpenses ?? [],
    taxInsurance: source.taxInsurance ?? [],
    taxDeductionEvents: normalizeTaxDeductionEvents(source),
    assetGrowthSettings: {
      enabled: source.assetGrowthSettings?.enabled ?? source.growthSettings?.enabled ?? true,
      rates: {
        ...baseScenario.assetGrowthSettings.rates,
        ...(source.assetGrowthSettings?.rates ?? {}),
        nisa: source.assetGrowthSettings?.rates?.nisa ?? legacyGrowthRate,
        specificAccount: source.assetGrowthSettings?.rates?.specificAccount ?? legacyGrowthRate,
        ordinaryAccountForOptions: source.assetGrowthSettings?.rates?.ordinaryAccountForOptions ?? legacyGrowthRate,
      },
    },
    inflationSettings: {
      ...baseScenario.inflationSettings,
      ...source.inflationSettings,
    },
    optionAccountRules: {
      ...baseScenario.optionAccountRules,
      ...(source.optionAccountRules ?? {}),
    },
    optionSubAccounts: normalizeOptionSubAccounts(source, legacyAssets),
    nisaInvestmentRules: {
      ...baseScenario.nisaInvestmentRules,
      ...(source.nisaInvestmentRules ?? {}),
      carryOverSkippedMode:
        source.nisaInvestmentRules?.carryOverSkippedMode ??
        (source.nisaInvestmentRules?.carryOverSkippedWithinYear ? "withinYear" : baseScenario.nisaInvestmentRules.carryOverSkippedMode),
    },
    taxableAccountSettings: {
      ...baseScenario.taxableAccountSettings,
      ...(source.taxableAccountSettings ?? {}),
    },
  };

  delete (scenario.initialAssets as ScenarioData["initialAssets"] & { securities?: number }).securities;
  return scenario;
}

export function normalizePlanState(input: Partial<RetirementPlanState> | undefined): RetirementPlanState {
  const scenarios = Array.isArray(input?.scenarios) && input.scenarios.length > 0
    ? input.scenarios.map((scenario, index) => normalizeScenario(scenario as LegacyScenario, index))
    : structuredClone(sampleState.scenarios);
  const activeScenarioId = scenarios.some((scenario) => scenario.id === input?.activeScenarioId)
    ? input!.activeScenarioId!
    : scenarios[0].id;

  return {
    version: 1,
    activeScenarioId,
    scenarios,
    lastSavedAt: input?.lastSavedAt,
    backups: Array.isArray(input?.backups) ? input.backups.slice(0, maxBackups) : [],
  };
}

export const usePlanStore = create<PlanStore>()(
  persist(
    (set) => ({
      ...sampleState,
      setActiveScenario: (id) => set(touch({ activeScenarioId: id })),
      updateActiveScenario: (updater) =>
        set((state) => ({
          scenarios: state.scenarios.map((scenario) =>
            scenario.id === state.activeScenarioId ? updater(structuredClone(scenario)) : scenario,
          ),
          lastSavedAt: nowIso(),
        })),
      duplicateScenario: (id) =>
        set((state) => {
          const source = state.scenarios.find((scenario) => scenario.id === id);
          if (!source) return state;
          const copy = cloneScenario(source, `${source.name} コピー`);
          return {
            scenarios: [...state.scenarios, copy],
            activeScenarioId: copy.id,
            lastSavedAt: nowIso(),
            backups: rotateBackups(state.backups, createBackupEntry(state, "シナリオ複製前")),
          };
        }),
      deleteScenario: (id) =>
        set((state) => {
          if (state.scenarios.length <= 1) return state;
          const scenarios = state.scenarios.filter((scenario) => scenario.id !== id);
          return {
            scenarios,
            activeScenarioId: state.activeScenarioId === id ? scenarios[0].id : state.activeScenarioId,
            lastSavedAt: nowIso(),
            backups: rotateBackups(state.backups, createBackupEntry(state, "シナリオ削除前")),
          };
        }),
      toggleScenarioCompare: (id) =>
        set((state) => ({
          scenarios: state.scenarios.map((scenario) =>
            scenario.id === id ? { ...scenario, compare: !scenario.compare } : scenario,
          ),
          lastSavedAt: nowIso(),
        })),
      replaceState: (state) =>
        set((current) => {
          const normalized = normalizePlanState(state);
          return {
            ...normalized,
            lastSavedAt: nowIso(),
            backups: rotateBackups(current.backups, createBackupEntry(current, "JSON読込前")),
          };
        }),
      resetToSample: () =>
        set((state) => ({
          ...structuredClone(sampleState),
          lastSavedAt: nowIso(),
          backups: rotateBackups(state.backups, createBackupEntry(state, "サンプル復元前")),
        })),
      createBackup: (label) =>
        set((state) => ({
          backups: rotateBackups(state.backups, createBackupEntry(state, label)),
          lastSavedAt: nowIso(),
        })),
      restoreBackup: (id) =>
        set((state) => {
          const backup = state.backups.find((item) => item.id === id);
          if (!backup) return state;
          const normalized = normalizePlanState(backup.state);
          return {
            ...normalized,
            lastSavedAt: nowIso(),
            backups: rotateBackups(state.backups, createBackupEntry(state, "履歴復元前")),
          };
        }),
      deleteBackup: (id) =>
        set((state) => ({
          backups: state.backups.filter((backup) => backup.id !== id),
          lastSavedAt: nowIso(),
        })),
    }),
    {
      name: "retirement-life-simulator-v2",
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizePlanState(persistedState as Partial<RetirementPlanState> | undefined),
      }),
      partialize: (state) => ({
        version: state.version,
        activeScenarioId: state.activeScenarioId,
        scenarios: state.scenarios,
        lastSavedAt: state.lastSavedAt,
        backups: state.backups,
      }),
    },
  ),
);
