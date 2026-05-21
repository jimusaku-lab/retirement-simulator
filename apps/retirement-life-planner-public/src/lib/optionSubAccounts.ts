import type { OptionSubAccount } from "@/types";

type OptionAccountNameSource = Pick<OptionSubAccount, "id" | "name">;

function normalizeOptionAccountName(value: string) {
  return value
    .toLowerCase()
    .replace(/一般口座/g, "")
    .replace(/式/g, "")
    .replace(/[\s\u3000（）()・_-]/g, "");
}

function optionAccountNameMatches(accountName: string, name?: string) {
  if (!name) return false;
  const normalizedName = normalizeOptionAccountName(name);
  const normalizedAccountName = normalizeOptionAccountName(accountName);
  return Boolean(
    normalizedName &&
    normalizedAccountName &&
    (
      normalizedAccountName.includes(normalizedName) ||
      normalizedName.includes(normalizedAccountName)
    ),
  );
}

export function inferOptionSubAccountIdFromName(
  accounts: OptionAccountNameSource[],
  name?: string,
) {
  if (!name || accounts.length <= 1) return undefined;
  return accounts.find((account) => optionAccountNameMatches(account.name, name))?.id;
}

export function resolveOptionSubAccountId(
  accounts: OptionAccountNameSource[],
  accountId?: string,
  fallbackName?: string,
) {
  const nameMatchedId = inferOptionSubAccountIdFromName(accounts, fallbackName);
  if (!accountId) return nameMatchedId;

  const selectedAccount = accounts.find((account) => account.id === accountId);
  if (!selectedAccount) return nameMatchedId;
  if (
    nameMatchedId &&
    nameMatchedId !== accountId &&
    !optionAccountNameMatches(selectedAccount.name, fallbackName)
  ) {
    return nameMatchedId;
  }

  return accountId;
}
