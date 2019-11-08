// @flow

import type { CoreOperation } from "../../libcore/types";

async function cosmosBuildOperation({
  coreOperation
}: {
  coreOperation: CoreOperation
}) {
  console.log('startOp========\n');
  console.log(coreOperation);
  const cosmosLikeOperation = await coreOperation.asCosmosLikeOperation();
  console.log('getOp======\n');
  const cosmosLikeTransaction = await cosmosLikeOperation.getTransaction();
  console.log('gesTransaction======\n');
  const hash = await cosmosLikeTransaction.getHash();
  return { hash };
}

export default cosmosBuildOperation;
