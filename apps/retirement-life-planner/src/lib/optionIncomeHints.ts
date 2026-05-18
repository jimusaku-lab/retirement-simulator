import type { IncomeEvent, OptionSubAccount } from "@/types";

type OptionIncomeHintName = string | undefined;

const optionIncomeTypes: IncomeEvent["type"][] = ["investmentIncome", "dividend", "other"];

function normalizeDigits(value: string) {
  return value.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

function normalizeText(value: string) {
  return normalizeDigits(value)
    .toLowerCase()
    .replace(/[ \t\u3000（）()・_-]/g, "");
}

function hasUsStockOptionLabel(value?: string) {
  if (!value) return false;
  const normalized = normalizeText(value);
  return normalized.includes("米国株") && normalized.includes("オプション");
}

export function inferMonthlyOptionIncomeFromScenarioName(
  scenarioName: string,
  eventName?: OptionIncomeHintName,
  accountName?: OptionIncomeHintName,
  options?: { allowGenericEvent?: boolean },
) {
  if (!hasUsStockOptionLabel(scenarioName)) return undefined;
  if (!options?.allowGenericEvent && !hasUsStockOptionLabel(eventName) && !hasUsStockOptionLabel(accountName)) return undefined;

  const normalized = normalizeDigits(scenarioName);
  const match = normalized.match(/米国株(?:式)?オプション(?:利益|入金力|月額)?\s*([0-9]+)\s*万?/);
  if (!match) return undefined;

  const amountInTenThousands = Number(match[1]);
  if (!Number.isFinite(amountInTenThousands) || amountInTenThousands <= 0) return undefined;
  return amountInTenThousands * 10_000;
}

export function isOrdinaryOptionIncomeEvent(event: Pick<IncomeEvent, "sourceAssetKey" | "type">) {
  return event.sourceAssetKey === "ordinaryAccountForOptions" && optionIncomeTypes.includes(event.type);
}

export function applyScenarioNameOptionIncomeHint(
  scenarioName: string,
  event: IncomeEvent,
  account?: Pick<OptionSubAccount, "name">,
  options?: { allowGenericEvent?: boolean },
) {
  if (!isOrdinaryOptionIncomeEvent(event)) return event;
  const hintedMonthlyAmount = inferMonthlyOptionIncomeFromScenarioName(scenarioName, event.name, account?.name, options);
  if (hintedMonthlyAmount === undefined || hintedMonthlyAmount === event.monthlyAmount) return event;
  return {
    ...event,
    monthlyAmount: hintedMonthlyAmount,
    amountInputMode: "monthly" as const,
  };
}
