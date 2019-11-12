// @flow
import { inferDeprecatedMethods } from "../../../bridge/deprecationUtils";
import { scanAccountsOnDevice } from "../../../libcore/scanAccountsOnDevice";
import { syncAccount } from "../../../libcore/syncAccount";
import type { AccountBridge, CurrencyBridge } from "../../../types/bridge";
import type { Transaction } from "../types";
import { BigNumber } from "bignumber.js";
import libcoreSignAndBroadcast from "../../../libcore/signAndBroadcast";

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
  // TODO : need to know what it does
  console.log("getTransactionStatus", a, t);
};

const prepareTransaction = async (a, t) => {
  // TODO : need to know what it does
  console.log("prepareTransaction", a, t);
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
