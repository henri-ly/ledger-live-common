// @flow
import invariant from "invariant";
import { BigNumber } from "bignumber.js";
import {
  AmountRequired,
  NotEnoughBalance,
  NotEnoughBalanceToDelegate,
  NotEnoughBalanceInParentAccount,
  FeeNotLoaded,
  FeeTooHigh,
  NotSupportedLegacyAddress,
  InvalidAddressBecauseDestinationIsAlsoSource
} from "@ledgerhq/errors";
import {
  WrongMemoFormat,
  MinimumBalanceWarning,
  NewAccountMinimumTransaction
} from "../../../errors";
import { validateRecipient } from "../../../bridge/shared";
import type { Account, AccountBridge, CurrencyBridge } from "../../../types";
import type { Transaction } from "../types";
import { scanAccounts } from "../../../libcore/scanAccounts";
import { getAccountNetworkInfo } from "../../../libcore/getAccountNetworkInfo";
import { sync } from "../../../libcore/syncAccount";
import { getFeesForTransaction } from "../../../libcore/getFeesForTransaction";
import broadcast from "../libcore-broadcast";
import signOperation from "../libcore-signOperation";
import { makeLRUCache } from "../../../cache";
import { isAccountBalanceSignificant } from "../../../account";
import { withLibcore } from "../../../libcore/access";
import { libcoreBigIntToBigNumber } from "../../../libcore/buildBigNumber";
import { getEnv } from "../../../env";
import memoTypeCheck from "../memo-type-check";

import { getWalletName } from "../../../account";
import { getOrCreateWallet } from "../../../libcore/getOrCreateWallet";

const checkRecipientExist = (account, recipient) =>
  withLibcore(async core => {
    const { derivationMode, currency } = account;

    const walletName = getWalletName(account);

    const coreWallet = await getOrCreateWallet({
      core,
      walletName,
      currency,
      derivationMode
    });

    const stellarLikeWallet = await coreWallet.asStellarLikeWallet();
    const recipientExist = await stellarLikeWallet.exists(recipient);

    return recipientExist;
  });

const createTransaction = () => ({
  family: "stellar",
  amount: BigNumber(0),
  baseReserve: null,
  networkInfo: null,
  fees: null,
  recipient: "",
  memoValue: null,
  memoType: null,
  useAllAmount: false
});

const updateTransaction = (t, patch) => {
  if ("recipient" in patch && patch.recipient !== t.recipient) {
    return { ...t, ...patch, memoType: null };
  }
  return { ...t, ...patch };
};

const getMemoValidation = (memoType: string, memoValue: string) => {
  switch (memoType) {
    case "MEMO_TEXT":
      if (memoValue.length > 28) {
        throw new WrongMemoFormat();
      }
      break;

    case "MEMO_ID":
      try {
        const number = new BigNumber(memoValue.toString());

        if (number.isNaN()) {
          throw new WrongMemoFormat();
        }
      } catch (e) {
        throw e;
      }
      break;

    case "MEMO_HASH":
    case "MEMO_RETURN":
      if (!memoValue.length || memoValue.length !== 32) {
        throw new WrongMemoFormat();
      }
      break;

    default:
  }
};

const getTransactionStatus = async (a, t) => {
  const errors = {};
  const warnings = {};
  const useAllAmount = !!t.useAllAmount;

  if (a.freshAddress === t.recipient) {
    errors.recipient = new InvalidAddressBecauseDestinationIsAlsoSource();
  } else {
    const { recipientError, recipientWarning } = await validateRecipient(
      a.currency,
      t.recipient
    );

    if (recipientError) {
      errors.recipient = recipientError;
    }

    if (recipientWarning) {
      warnings.recipient = recipientWarning;
    }
  }

  if (!t.fees || !t.baseReserve) {
    errors.fees = new FeeNotLoaded();
  }

  let estimatedFees = !t.fees ? BigNumber(0) : t.fees;
  let baseReserve = !t.baseReserve ? BigNumber(0) : t.baseReserve;

  let amount = !useAllAmount
    ? t.amount
    : a.balance.minus(baseReserve).minus(estimatedFees);
  let totalSpent = !useAllAmount
    ? amount.plus(estimatedFees)
    : a.balance.minus(baseReserve);

  if (useAllAmount) {
    warnings.amount = new MinimumBalanceWarning();
  }

  if (
    !errors.amount &&
    amount
      .plus(estimatedFees)
      .plus(baseReserve)
      .gt(a.balance)
  ) {
    errors.amount = new NotEnoughBalance();
  }

  if (
    !errors.recipient &&
    !errors.amount &&
    (amount.lt(0) || totalSpent.gt(a.balance))
  ) {
    errors.amount = new NotEnoughBalance();
    totalSpent = BigNumber(0);
    amount = BigNumber(0);
  }

  if (!errors.amount && amount.eq(0)) {
    errors.amount = new AmountRequired();
  }

  // if amount < 1.0 you can't
  if (
    !errors.amount &&
    !(await checkRecipientExist(a, t.recipient)) &&
    amount.lt(10000000)
  ) {
    errors.amount = new NewAccountMinimumTransaction();
  }

  if (t.memoType && t.memoValue) {
    try {
      getMemoValidation(t.memoType, t.memoValue);
    } catch (e) {
      //We use transaction here to block screen on ledger-live-mobile
      errors.transaction = e;
    }
  }

  return Promise.resolve({
    errors,
    warnings,
    estimatedFees,
    amount,
    totalSpent
  });
};

const prepareTransaction = async (a, t) => {
  let networkInfo = t.networkInfo;
  if (!networkInfo) {
    const ni = await getAccountNetworkInfo(a);
    invariant(ni.family === "stellar", "stellar networkInfo expected");
    networkInfo = ni;
  }

  const fees = t.fees || networkInfo.fees;
  const baseReserve = t.baseReserve || networkInfo.baseReserve;
  let memoType = t.memoType;

  if (memoType === null) {
    const { recipientError } = await validateRecipient(a.currency, t.recipient);
    if (!recipientError) {
      memoType = await memoTypeCheck(t.recipient);
    }
  }

  if (
    t.networkInfo !== networkInfo ||
    t.fees !== fees ||
    t.baseReserve !== baseReserve ||
    t.memoType !== memoType
  ) {
    return { ...t, networkInfo, fees, baseReserve, memoType };
  }

  return t;
};

const preload = async () => {};

const hydrate = (data: mixed) => {};

const currencyBridge: CurrencyBridge = {
  preload,
  hydrate,
  scanAccounts
};

const accountBridge: AccountBridge<Transaction> = {
  createTransaction,
  updateTransaction,
  prepareTransaction,
  getTransactionStatus,
  sync,
  signOperation,
  broadcast
};

export default { currencyBridge, accountBridge };
