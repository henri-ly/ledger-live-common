// @flow

import type { Resolver } from "../../hw/getAddress/types";
import CosmosApp from "ledger-cosmos-js";
import BIPPath from "bip32-path";

const resolver: Resolver = async (transport, opt) => {
  console.log('opt ----[', opt)
  const { path } = opt;
  const cosmos = new CosmosApp(transport);
  const bipPath = BIPPath.fromString(path).toPathArray();

  let buf = Buffer.alloc(4 * bipPath.length);
  bipPath.forEach((segment, index) => {
    buf.writeUInt32BE(segment, 4 * index);
  });

  console.log(buf);
  // Need to understand why it give at first
  // `44'/118'/0'/0/'0`
  console.log('path ====>', path);

  if (bipPath.length === 2) {
    return { path };
  }

  const r = await cosmos.getAddressAndPubKey(bipPath, `cosmos`);
  return { address: r.bech32_address, publicKey: r.compressed_pk.toString('hex'), path };
};

export default resolver;
