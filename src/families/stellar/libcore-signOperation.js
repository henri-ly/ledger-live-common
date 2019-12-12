// @flow

import Stellar from "@ledgerhq/hw-app-str";
import invariant from "invariant";
import type { CoreStellarLikeTransaction, Transaction } from "./types";
import { makeSignOperation } from "../../libcore/signOperation";
import {
  libcoreAmountToBigNumber,
  libcoreBigIntToBigNumber
} from "../../libcore/buildBigNumber";
import buildTransaction from "./libcore-buildTransaction";

async function signTransaction({
  account: { freshAddress, freshAddressPath, balance, id },
  transport,
  transaction,
  coreTransaction,
  coreAccount,
  isCancelled,
  onDeviceSignatureGranted,
  onDeviceSignatureRequested
}) {
  // Sign with the device
  const hwApp = new Stellar(transport);
  const serialized = await coreTransaction.toSignatureBase();
  onDeviceSignatureRequested();
  const { signature } = await hwApp.signTransaction(
    freshAddressPath,
    Buffer.from(serialized, "hex")
  );
  onDeviceSignatureGranted();

  if (isCancelled()) return;

  await coreTransaction.putSignature(
    signature.toString("hex"),
    await coreTransaction.getSourceAccount()
  );
  if (isCancelled()) return;

  const hex = await coreTransaction.toRawTransaction();
  if (isCancelled()) return;

  const recipients = [transaction.recipient];
  const senders = [freshAddress];

  const feesRaw = await coreTransaction.getFee();
  if (isCancelled()) return;

  const fee = await libcoreAmountToBigNumber(feesRaw);
  if (isCancelled()) return;

  const transactionSequenceNumberRaw = await coreTransaction.getSourceAccountSequence();
  const transactionSequenceNumber = (
    await libcoreBigIntToBigNumber(transactionSequenceNumberRaw)
  ).toNumber();

  // Make an optimistic response

  let op;

  const txHash = ""; // resolved in broadcast()

  op = {
    id: `${id}-${txHash}-OUT`,
    hash: txHash,
    type: "OUT",
    value:
      transaction.useAllAmount && transaction.networkInfo
        ? balance.minus(transaction.networkInfo.baseReserve).minus(fee)
        : transaction.amount.plus(fee),
    fee,
    blockHash: null,
    blockHeight: null,
    senders,
    recipients,
    accountId: id,
    date: new Date(),
    transactionSequenceNumber,
    extra: {}
  };

  return {
    operation: op,
    expirationDate: null,
    signature: hex
  };
}

export default makeSignOperation<Transaction, CoreStellarLikeTransaction>({
  buildTransaction,
  signTransaction
});
