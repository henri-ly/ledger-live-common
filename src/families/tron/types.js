// @flow

import type {
  TransactionCommon,
  TransactionCommonRaw
} from "../../types/transaction";

export type CoreStatics = {};

export type CoreAccountSpecifics = {};

export type CoreOperationSpecifics = {};

export type CoreCurrencySpecifics = {};

export type NetworkInfo = {|
  family: "tron"
|};

export type NetworkInfoRaw = {|
  family: "tron"
|};

export type Transaction = {|
  ...TransactionCommon,
  family: "tron",
  networkInfo: ?NetworkInfo
|};

export type TransactionRaw = {|
  ...TransactionCommonRaw,
  family: "tron",
  networkInfo: ?NetworkInfoRaw
|};

export type SendTransactionData = {|
  to_address: string,
  owner_address: string,
  amount: number,
  asset_name: ?string
|};

export const reflect = (_declare: *) => {};
