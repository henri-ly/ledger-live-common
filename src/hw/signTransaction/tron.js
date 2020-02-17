// @flow
import Trx from "hw-app-trx";
import type Transport from "@ledgerhq/hw-transport";
import type { CryptoCurrency } from "../../types";

export default async (
  currency: CryptoCurrency,
  transport: Transport<*>,
  path: string,
  txArg: Object
) => {
  const trx = new Trx(transport);
  console.log(txArg);

  const signature = txArg.assetName
    ? await trx.signTransaction(
        path,
        txArg.rawDataHex,
        [txArg.assetName]
      )
    : await trx.signTransaction(path, txArg.rawDataHex, []);
  return signature;
};
