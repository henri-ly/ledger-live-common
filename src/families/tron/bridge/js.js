// @flow
import { BigNumber } from "bignumber.js";
import { Observable } from "rxjs";
import flatMap from "lodash/flatMap";
import get from "lodash/get";
import bs58check from "bs58check";
import SHA256 from "crypto-js/sha256";
import type {
  Operation,
  TokenCurrency,
  TokenAccount,
  SubAccount,
  ChildAccount
} from "../../../types";
import type {
  Transaction,
  SendTransactionData,
  SendTransactionDataSuccess
} from "../types";
import type { CurrencyBridge, AccountBridge } from "../../../types/bridge";
import { findTokenById } from "../../../data/tokens";
import { open } from "../../../hw";
import signTransaction from "../../../hw/signTransaction";
import {
  makeStartSync,
  makeScanAccountsOnDevice
} from "../../../bridge/jsHelpers";
import { validateRecipient } from "../../../bridge/shared";
import { InvalidAddress, RecipientRequired } from "@ledgerhq/errors";
import { tokenLists } from "../tokens-name-hex";
import {
  createTronTransaction,
  broadcastTron,
  fetchTronAccount,
  fetchTronAccountTxs,
  getTronAccountNetwork
} from "../../../api/Tron";

const ADDRESS_SIZE = 34;
const ADDRESS_PREFIX_BYTE = 0x41;

const b58 = hex => bs58check.encode(Buffer.from(hex, "hex"));

function isAddressValid(base58Str) {
  try {
    if (typeof base58Str !== "string") {
      return false;
    }
    if (base58Str.length !== ADDRESS_SIZE) {
      return false;
    }
    var address = bs58check.decode(base58Str);
    if (address.length !== 25) {
      return false;
    }
    if (address[0] !== ADDRESS_PREFIX_BYTE) {
      return false;
    }
    var checkSum = address.slice(21);
    address = address.slice(0, 21);
    var hash0 = SHA256(address);
    var hash1 = SHA256(hash0);
    var checkSum1 = hash1.slice(0, 4);
    if (
      checkSum[0] == checkSum1[0] &&
      checkSum[1] == checkSum1[1] &&
      checkSum[2] == checkSum1[2] &&
      checkSum[3] == checkSum1[3]
    ) {
      return true;
    }
  } catch (e) {
    // ignore
  }

  return false;
}

async function doSignAndBroadcast({
  a,
  t,
  deviceId,
  isCancelled,
  onSigned,
  onOperationBroadcasted
}) {
  const subAccount =
    t.subAccountId && a.subAccounts
      ? a.subAccounts.find(sa => sa.id === t.subAccountId)
      : null;

  const preparedTransaction: SendTransactionDataSuccess = await createTronTransaction(
    a,
    t,
    subAccount || null
  );

  const transport = await open(deviceId);
  let transaction;
  try {
    // Sign by device
    const signature = await signTransaction(
      a.currency,
      transport,
      a.freshAddressPath,
      {
        rawDataHex: preparedTransaction.raw_data_hex,
        assetName: subAccount
          ? [
              tokenLists.find(
                t => t.id.toString() === subAccount.token.id.split("/")[2]
              )
            ] // TODO: Find a better way to store this data ? where ?
          : undefined
      }
    );
    transaction = {
      ...preparedTransaction,
      signature: [signature]
    };
  } finally {
    transport.close();
  }

  if (!isCancelled()) {
    onSigned();

    // Broadcast
    const submittedPayment = await broadcastTron(transaction);
    if (submittedPayment.result !== true) {
      throw new Error(submittedPayment.resultMessage);
    }

    const hash = transaction.txID;
    const operation = {
      id: `${a.id}-${hash}-OUT`,
      hash,
      accountId: a.id,
      type: "OUT",
      value: t.amount,
      fee: BigNumber(0), // TBD
      blockHash: null,
      blockHeight: null,
      senders: [a.freshAddress],
      recipients: [t.recipient],
      date: new Date(),
      extra: {}
    };
    onOperationBroadcasted(operation);
  }
}

const txToOps = ({ id, address }, token: ?TokenCurrency) => (
  tx: Object
): Operation[] => {
  const ops = [];
  const hash = tx.txID;
  const date = new Date(tx.block_timestamp);
  get(tx, "raw_data.contract", []).forEach(contract => {
    if (
      token
        ? contract.type === "TransferAssetContract" &&
          "tron/trc10/" + get(contract, "parameter.value.asset_name") ===
            token.id
        : contract.type === "TransferContract"
    ) {
      const { amount, owner_address, to_address } = get(
        contract,
        "parameter.value",
        {}
      );
      if (amount && owner_address && to_address) {
        const value = BigNumber(amount);
        const from = b58(owner_address);
        const to = b58(to_address);
        const sending = address === from;
        const receiving = address === to;
        const fee = BigNumber(0);
        if (sending) {
          ops.push({
            id: `${id}-${hash}-OUT`,
            hash,
            type: "OUT",
            value: value.plus(fee),
            fee,
            blockHeight: 0,
            blockHash: null,
            accountId: id,
            senders: [from],
            recipients: [to],
            date,
            extra: {}
          });
        }
        if (receiving) {
          ops.push({
            id: `${id}-${hash}-IN`,
            hash,
            type: "IN",
            value,
            fee,
            blockHeight: 0,
            blockHash: null,
            accountId: id,
            senders: [from],
            recipients: [to],
            date,
            extra: {}
          });
        }
      }
    }
  });
  return ops;
};

const getAccountShape = async info => {
  const tronAcc = await fetchTronAccount(info.address);
  if (tronAcc.length === 0) {
    return { balance: BigNumber(0) };
  }
  const acc = tronAcc[0];
  const spendableBalance = acc.balance ? BigNumber(acc.balance) : BigNumber(0);
  const balance = spendableBalance.plus(
    get(acc, "frozen", []).reduce(
      (sum, o) => sum.plus(o.frozen_balance),
      BigNumber(0)
    )
  );

  const txs = await fetchTronAccountTxs(info.address, txs => txs.length < 1000);

  const operations = flatMap(txs, txToOps(info));

  const subAccounts: SubAccount[] = [];

  get(acc, "assetV2", []).forEach(({ key, value }) => {
    const token = findTokenById(`tron/trc10/${key}`);
    if (!token) return;
    const id = info.id + "+" + key;
    const sub: TokenAccount = {
      type: "TokenAccount",
      id,
      parentId: info.id,
      token,
      balance: BigNumber(value),
      operations: flatMap(txs, txToOps({ ...info, id }, token)),
      pendingOperations: []
    };
    subAccounts.push(sub);
  });

  return {
    balance,
    spendableBalance,
    operations,
    subAccounts
  };
};

const scanAccountsOnDevice = makeScanAccountsOnDevice(getAccountShape);

const startSync = makeStartSync(getAccountShape);

const currencyBridge: CurrencyBridge = {
  preload: () => Promise.resolve(),
  hydrate: () => {},
  scanAccountsOnDevice
};

const createTransaction = () => ({
  family: "tron",
  amount: BigNumber(0),
  recipient: "",
  networkInfo: null
});

const updateTransaction = (t, patch) => ({ ...t, ...patch });

const getTransactionStatus = async (a, t) => {
  const errors = {};
  const warnings = {};
  const tokenAccount = !t.subAccountId
    ? null
    : a.subAccounts && a.subAccounts.find(ta => ta.id === t.subAccountId);
  const account = tokenAccount || a;

  const useAllAmount = !!t.useAllAmount;

  const estimatedFees = BigNumber(0); //TBD

  if (!t.recipient) {
    errors.recipient = new RecipientRequired("");
  } else if (!isAddressValid(t.recipient)) {
    errors.recipient = new InvalidAddress("", {
      currencyName: a.currency.name
    });
  }

  const totalSpent = useAllAmount ? account.balance : BigNumber(t.amount || 0); // To Review

  const amount = useAllAmount
    ? tokenAccount
      ? BigNumber(t.amount)
      : account.balance
    : BigNumber(t.amount);

  return Promise.resolve({
    errors,
    warnings,
    amount,
    estimatedFees,
    totalSpent
  });
};

const signAndBroadcast = (a, t, deviceId) =>
  Observable.create(o => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    const onSigned = () => {
      o.next({ type: "signed" });
    };
    const onOperationBroadcasted = operation => {
      o.next({ type: "broadcasted", operation });
    };
    doSignAndBroadcast({
      a,
      t,
      deviceId,
      isCancelled,
      onSigned,
      onOperationBroadcasted
    }).then(
      () => {
        o.complete();
      },
      e => {
        o.error(String(e));
      }
    );
    return () => {
      cancelled = true;
    };
  });

const prepareTransaction = async (a, t: Transaction): Promise<Transaction> => {
  //TODO: See how Transaction fees work, doesn't seems to cost any TRX but bandwich.
  // see : https://developers.tron.network/docs/bandwith#section-bandwidth-points-consumption
  // 1. cost around 200 Bandwidth, if not enough check Free Bandwidth
  // 2. If not enough, will cost some TRX
  // 3. normal transfert cost around 0.002 TRX
  // Special case: If activated an account, cost around 0.1 TRX
  const networkInfo =
    t.networkInfo || (await getTronAccountNetwork(a.freshAddress));

  if (t.networkInfo === networkInfo) {
    return t;
  }

  return { ...t, networkInfo };
};

const accountBridge: AccountBridge<Transaction> = {
  createTransaction,
  updateTransaction,
  prepareTransaction,
  getTransactionStatus,
  startSync,
  signAndBroadcast
};

export default { currencyBridge, accountBridge };
