// @flow

import invariant from "invariant";
import type { Transaction, AccountLike } from "../../types";

const options = [
  {
    name: "fee",
    type: String,
    desc: "how much fee"
  },
  {
    name: "memoType",
    type: String,
    desc: "stellar memo type"
  },
  {
    name: "memoValue",
    type: String,
    desc: "stellar memo value"
  }
];

function inferTransactions(
  transactions: Array<{ account: AccountLike, transaction: Transaction }>,
  opts: Object,
  { inferAmount }: *
): Transaction[] {
  return transactions.map(({ transaction }) => {
    invariant(transaction.family === "stellar", "stellar family");
    return {
      ...transaction,
      memoType: opts.memoType ? opts.memoType : null,
      memoValue: opts.memoValue ? opts.memoValue : null
    };
  });
}

export default {
  options,
  inferTransactions
};
