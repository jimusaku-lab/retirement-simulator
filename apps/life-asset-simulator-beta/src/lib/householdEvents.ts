import dayjs from "dayjs";
import type { ScenarioData, YearMonth } from "@/types";

export function previousYearMonth(yearMonth: YearMonth): YearMonth {
  return dayjs(`${yearMonth}-01`).subtract(1, "month").format("YYYY-MM");
}

export function getLinkedIncomeEndYearMonth(scenario: ScenarioData, linkedEventId: string | undefined) {
  if (!linkedEventId) return undefined;
  const linkedEvent = scenario.householdLivingArrangementEvents.find((event) => event.id === linkedEventId);
  return linkedEvent ? previousYearMonth(linkedEvent.changeYearMonth) : undefined;
}

export function syncLinkedIncomeEndYearMonths(scenario: ScenarioData) {
  const linkedEventIds = new Set(scenario.householdLivingArrangementEvents.map((event) => event.id));
  for (const incomeEvent of scenario.incomeEvents) {
    const linkedId = incomeEvent.linkedHouseholdLivingArrangementEventId;
    if (!linkedId) continue;
    if (!linkedEventIds.has(linkedId) || incomeEvent.type === "oneTime") {
      incomeEvent.linkedHouseholdLivingArrangementEventId = undefined;
      continue;
    }
    incomeEvent.endYearMonth = getLinkedIncomeEndYearMonth(scenario, linkedId);
  }
}
