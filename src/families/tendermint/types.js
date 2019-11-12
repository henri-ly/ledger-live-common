// @flow

import type {
  TransactionCommon,
  TransactionCommonRaw
} from "../../types/transaction";
import type { CoreAmount, CoreBigInt, Spec } from "../../libcore/types";

declare class CoreCosmosLikeAddress {
  toBase58(): Promise<string>;
}

declare class CoreCosmosLikeTransaction {
  getHash(): Promise<string>;
  getFees(): Promise<CoreAmount>;
  getReceiver(): Promise<CoreCosmosLikeAddress>;
  getSender(): Promise<CoreCosmosLikeAddress>;
  getValue(): Promise<CoreAmount>;
  serialize(): Promise<string>;
  setSignature(string, string): Promise<void>;
  setDERSignature(string): Promise<void>;
  getDestinationTag(): Promise<?number>;
  getSequence(): Promise<CoreBigInt>;
}

declare class CoreCosmosLikeOperation {
  getTransaction(): Promise<CoreCosmosLikeTransaction>;
  getMessage(): Promise<CoreCosmoslikeMessage>;
}

declare class CoreCosmosLikeMessage {}

declare class CoreCosmosLikeTransactionBuilder {
  sendToAddress(amount: CoreAmount, recipient: string): Promise<void>;
  wipeToAddress(address: string): Promise<void>;
  setDestinationTag(tag: number): Promise<void>;
  setGasLimit(gasLimit: CoreAmount): Promise<CoreCosmosLikeTransactionBuilder>;
  setGasPrice(gasPrice: CoreAmount): Promise<CoreCosmosLikeTransactionBuilder>;
  setGasAdjustment(
    gasAdjustment: number
  ): Promise<CoreCosmosLikeTransactionBuilder>;
  build(): Promise<CoreCosmosLikeTransaction>;
}

declare class CoreCosmosLikeAccount {
  buildTransaction(): Promise<CoreCosmosLikeTransactionBuilder>;

  broadcastRawTransaction(signed: string): Promise<string>;
  broadcastTransaction(signed: string): Promise<string>;
}

export type CoreStatics = {
  CosmosLikeOperation: Class<CoreCosmosLikeOperation>,
  CosmosLikeAddress: Class<CoreCosmosLikeAddress>,
  CosmosLikeTransaction: Class<CoreCosmosLikeTransaction>,
  CosmosLikeAccount: Class<CoreCosmosLikeAccount>,
  CosmosLikeTransactionBuilder: Class<CoreCosmosLikeTransactionBuilder>,
  CosmosLikeTransaction: Class<CoreCosmosLikeTransaction>
};

export type {
  CoreCosmosLikeAccount,
  CoreCosmosLikeAddress,
  CoreCosmosLikeOperation,
  CoreCosmosLikeTransaction,
  CoreCosmosLikeTransactionBuilder
};

export type CoreAccountSpecifics = {
  asCosmosLikeAccount(): Promise<CoreCosmosLikeAccount>
};

export type CoreOperationSpecifics = {
  asCosmosLikeOperation(): Promise<CoreCosmosLikeOperation>
};

export type CoreCurrencySpecifics = {};

export type NetworkInfo = {|
  family: "tendermint"
|};

export type NetworkInfoRaw = {|
  family: "tendermint"
|};

export type Transaction = {|
  ...TransactionCommon,
  family: "tendermint"
|};

export type TransactionRaw = {|
  ...TransactionCommonRaw,
  family: "tendermint"
|};

export const reflect = (_declare: *) => {};
