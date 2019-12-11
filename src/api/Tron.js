// @flow
import type {
  Transaction,
  SendTransactionData,
  SendTransactionDataSuccess,
  FreezeTransactionData,
  UnfreezeTransactionData
} from "../families/tron/types";
import type { Account, SubAccount, Operation } from "../types";
import bs58check from "bs58check";
import { log } from "@ledgerhq/logs";
import network from "../network";
import get from "lodash/get";

const decode58Check = base58 =>
  Buffer.from(bs58check.decode(base58)).toString("hex");

async function post(url, body) {
  const { data } = await network({
    method: "POST",
    url,
    data: body
  });
  log("http", url);
  return data;
}

async function fetch(url) {
  const { data } = await network({
    method: "GET",
    url
  });
  log("http", url);
  return data;
}

export const freezeTronTransaction = async (a: Account, t: Transaction) => {
  const txData: FreezeTransactionData = {
    frozen_balance: t.amount.toNumber(),
    frozen_duration: t.duration || 3,
    resource: t.resource,
    owner_address: decode58Check(a.freshAddress),
    receiver_address: t.recipient && decode58Check(t.recipient),
  };

  const url = "https://api.trongrid.io/wallet/freezebalance";

  const result = await post(url, txData);

  return result;
};

export const unfreezeTronTransaction = async (a: Account, t: Transaction) => {
  const txData: UnfreezeTransactionData = {
    resource: t.resource,
    owner_address: decode58Check(a.freshAddress),
    receiver_address: decode58Check(t.recipient),
  };

  const url = "https://api.trongrid.io/wallet/unfreezebalance";
  const result = await post(url, txData);
  //TODO: Error on unfreeze if the day is not available

  return result;
};

export const createTronTransaction = async (
  a: Account,
  t: Transaction,
  subAccount: SubAccount | null
): Promise<SendTransactionDataSuccess> => {
  const tokenId = subAccount && subAccount.type === 'TokenAccount' 
    ? subAccount.token.id.split("/")[2] // Need to get this token id properly
    : null;

  const txData: SendTransactionData = {
    to_address: decode58Check(t.recipient),
    owner_address: decode58Check(a.freshAddress),
    amount: t.amount.toNumber(),
    asset_name: tokenId && Buffer.from(tokenId).toString("hex")
  };

  const url = subAccount
    ? "https://api.trongrid.io/wallet/transferasset"
    : "https://api.trongrid.io/wallet/createtransaction";

  const preparedTransaction = await post(url, txData);

  return preparedTransaction;
};

export const broadcastTron = async (
  trxTransaction: SendTransactionDataSuccess
) => {
  const result = await post(
    "https://api.trongrid.io/wallet/broadcasttransaction",
    trxTransaction
  );
  return result;
};

export async function fetchTronAccount(addr: string) {
  const data = await fetch(`https://api.trongrid.io/v1/accounts/${addr}`);
  return data.data;
}

export async function fetchTronAccountTxs(
  addr: string,
  shouldFetchMoreTxs: (Operation[]) => boolean
) {
  let payload = await fetch(
    `https://api.trongrid.io/v1/accounts/${addr}/transactions?limit=200`
  );
  let fetchedTxs = payload.data;
  let txs = [];
  while (fetchedTxs && Array.isArray(fetchedTxs) && shouldFetchMoreTxs(txs)) {
    txs = txs.concat(fetchedTxs);
    const next = get(payload, "meta.links.next");
    if (!next) return txs;
    payload = await fetch(next);
    fetchedTxs = payload.data;
  }
  return txs;
}

export const getTronAccountNetwork = async (address: string) => {
  try {
    const result = await post("https://api.trongrid.io/wallet/getaccountnet", {
      address: decode58Check(address)
    });
    return result;
  } catch (e) {
    //Don't throw error
  }
  return {};
};

// TODO: Find an another way to validate formula, I don't like to depend on api for this
export const validateAddress = async (address: string) => {
  try {
    const result = await post(
      "https://api.trongrid.io/wallet/validateaddress",
      { address: decode58Check(address) }
    );

    return result.result || false;
  } catch (e) {
    // dont throw anything
  }
  return false;
};
