import type { OptionSubAccount } from "@/types";

type OptionAccountNameSource = Pick<OptionSubAccount, "id" | "name">;

function normalizeOptionAccountName(value: string) {
  return value
    .toLowerCase()
    .replace(/普通口座/g, "")
    .replace(/式/g, "")
    .replace(/[\s\u3000（）()・_-]/g, "");
}

export function inferOptionSubAccountIdFromName(
  accounts: OptionAccountNameSource[],
  name?: string,
) {
  if (!name || accounts.length <= 1) return undefined;
  const normalizedName = normalizeOptionAccountName(name);
  if (!normalizedName) return undefined;
  return accounts.find((account) => {
    const normalizedAccountName = normalizeOptionAccountName(account.name);
    return normalizedAccountName && (
      normalizedAccountName.includes(normalizedName) ||
      normalizedName.includes(normalizedAccountName)
    );
  })?.id;
}

export function resolveOptionSubAccountId(
  accounts: OptionAccountNameSource[],
  accountId?: string,
  fallbackName?: string,
) {
  if (accountId && accounts.some((account) => account.id === accountId)) return accountId;
  return inferOptionSubAccountIdFromName(accounts, fallbackName);
}
