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
import {
  InvalidAddress,
  RecipientRequired,
  NotEnoughBalance,
  AmountRequired
} from "@ledgerhq/errors";
import { tokenList } from "../tokens-name-hex";
import {
  createTronTransaction,
  broadcastTron,
  fetchTronAccount,
  fetchTronAccountTxs,
  getTronAccountNetwork,
  validateAddress
} from "../../../api/Tron";

const ADDRESS_SIZE = 34;
const ADDRESS_PREFIX_BYTE = 0x41;

const b58 = hex => bs58check.encode(Buffer.from(hex, "hex"));

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
              tokenList.find(
                t => t.id.toString() === subAccount.token.id.split("/")[2]
              ).message
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

  const estimatedFees = BigNumber(0); //TBD

  if (!t.recipient) {
    errors.recipient = new RecipientRequired("");
  } else if (!(await validateAddress(t.recipient))) {
    errors.recipient = new InvalidAddress("", {
      currencyName: a.currency.name
    });
  }

  const amount = BigNumber(t.amount || 0);

  const totalSpent = amount;
  // TODO: Total spent with possible fee and bandwidth calc

  if (totalSpent.gt(BigNumber(account.balance))) {
    errors.amount = new NotEnoughBalance();
  }

  if (!errors.amount && amount.eq(0)) {
    errors.amount = new AmountRequired();
  }

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
