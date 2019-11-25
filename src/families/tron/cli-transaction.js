// @flow

import invariant from "invariant";
import { getAccountCurrency } from "../../account";
import type {
  Transaction,
  Account,
  AccountLike,
  AccountLikeArray
} from "../../types";

const options = [
  {
    name: "token",
    alias: "t",
    type: String,
    desc: "use an token account children of the account"
  }
];

function inferAccounts(account: Account, opts: Object): AccountLikeArray {
  invariant(account.currency.family === "tron", "tron family");
  if (!opts.token) return [account];
  return opts.token.map(token => {
    const subAccounts = account.subAccounts || [];
    if (token) {
      const subAccount = subAccounts.find(t => {
        const currency = getAccountCurrency(t);
        return (
          token.toLowerCase() === currency.ticker.toLowerCase() ||
          token.toLowerCase() === currency.id
        );
      });
      if (!subAccount) {
        throw new Error(
          "token account '" +
            token +
            "' not found. Available: " +
            subAccounts.map(t => getAccountCurrency(t).ticker).join(", ")
        );
      }
      return subAccount;
    }
  });
}

function inferTransactions(
  transactions: Array<{ account: AccountLike, transaction: Transaction }>,
  opts: Object,
  { inferAmount }: *
): Transaction[] {
  return transactions.flatMap(({ transaction, account }) => {
    invariant(transaction.family === "tron", "tron family");
    let subAccountId;
    if (account.type === "TokenAccount") {
      subAccountId = account.id;
    }
    return {
      ...transaction,
      family: "tron",
      subAccountId
    };
  });
}

export default {
  options,
  inferAccounts,
  inferTransactions
};
