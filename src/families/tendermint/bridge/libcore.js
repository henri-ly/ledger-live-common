// @flow
import { inferDeprecatedMethods } from "../../../bridge/deprecationUtils";
import { scanAccountsOnDevice } from "../../../libcore/scanAccountsOnDevice";
import { syncAccount } from "../../../libcore/syncAccount";
import type { AccountBridge, CurrencyBridge } from "../../../types/bridge";
import type { Transaction } from "../types";import { BigNumber } from "bignumber.js";
import libcoreSignAndBroadcast from "../../../libcore/signAndBroadcast";
import {
  FeeNotLoaded,
  FeeTooHigh,
  InvalidAddressBecauseDestinationIsAlsoSource,
  NotEnoughBalance
} from "@ledgerhq/errors";
import {validateRecipient} from "../../../bridge/shared";
import {getAccountNetworkInfo} from "../../../libcore/getAccountNetworkInfo";
import invariant from "invariant";
import {estimateGasLimitAndStorage} from "../../tezos/bridge/libcore";

const startSync = (initialAccount, _observation) => syncAccount(initialAccount);

const createTransaction = () => ({
  family: "tendermint",
  mode: "send",
  amount: BigNumber(0),
  fees: null,
  gasLimit: null,
  storageLimit: null,
  recipient: "",
  networkInfo: null,
  useAllAmount: false
});

const updateTransaction = (t, patch) => ({ ...t, ...patch });

const signAndBroadcast = (account, transaction, deviceId) =>
    libcoreSignAndBroadcast({
      account,
      transaction,
      deviceId
    });

const getTransactionStatus = async (a, t) => {
  const errors = {};
  const warnings = {};
  const subAcc = !t.subAccountId
      ? null
      : a.subAccounts && a.subAccounts.find(ta => ta.id === t.subAccountId);

  const account = subAcc || a;

  if (t.mode !== "undelegate") {
    if (account.freshAddress === t.recipient) {
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
  }

  let estimatedFees = BigNumber(0);
  if (!t.fees) {
    errors.fees = new FeeNotLoaded();
  } else if (!errors.recipient) {
    await calculateFees(a, t).then(
        f => {
          estimatedFees = f;
        },
        error => {
          if (error.name === "NotEnoughBalance") {
            errors.amount = error;
          } else {
            throw error;
          }
        }
    );
  }

  let totalSpent = !t.useAllAmount
      ? t.amount.plus(estimatedFees)
      : account.balance;

  let amount = t.useAllAmount ? account.balance.minus(estimatedFees) : t.amount;

  if (
      !errors.recipient &&
      !errors.amount &&
      (amount.lt(0) || totalSpent.gt(account.balance))
  ) {
    errors.amount = new NotEnoughBalance();
    totalSpent = BigNumber(0);
    amount = BigNumber(0);
  }

  if (t.mode === "send" && amount.gt(0) && estimatedFees.times(10).gt(amount)) {
    warnings.feeTooHigh = new FeeTooHigh();
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
    invariant(ni.family === "tendermint", "tendermint networkInfo expected");
    networkInfo = ni;
  }

  let gasLimit = t.gasLimit;
  let storageLimit = t.storageLimit;
  if (!gasLimit || !storageLimit) {
    const { recipientError } =
        t.mode === "undelegate"
            ? {}
            : await validateRecipient(a.currency, t.recipient);
    if (!recipientError) {
      const r = await estimateGasLimitAndStorage(a, t.recipient);
      gasLimit = r.gasLimit;
      storageLimit = r.storage;
    }
  }

  let fees = t.fees || networkInfo.fees;

  if (
      t.networkInfo !== networkInfo ||
      t.gasLimit !== gasLimit ||
      t.storageLimit !== storageLimit ||
      t.fees !== fees
  ) {
    return { ...t, networkInfo, storageLimit, gasLimit, fees };
  }

  return t;
};


const currencyBridge: CurrencyBridge = {
  scanAccountsOnDevice
};

const getCapabilities = () => ({
  canSync: true,
  canSend: true
});

const accountBridge: AccountBridge<Transaction> = {
  createTransaction,
  updateTransaction,
  prepareTransaction,
  getTransactionStatus,
  startSync,
  signAndBroadcast,
  getCapabilities,
  ...inferDeprecatedMethods({
    name: "LibcoreCosmosAccountBridge",
    createTransaction,
    getTransactionStatus,
    prepareTransaction
  })
};

export default { currencyBridge, accountBridge };
