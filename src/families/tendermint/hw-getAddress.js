// @flow

import type { Resolver } from "../../hw/getAddress/types";
import CosmosApp from "ledger-cosmos-js";
import BIPPath from "bip32-path";

const resolver: Resolver = async (transport, opt) => {
  const { path } = opt;
  const cosmos = new CosmosApp(transport);
  const bipPath = BIPPath.fromString(path).toPathArray();

  if (bipPath.length === 2) {
    return { path };
  }

  const r = await cosmos.getAddressAndPubKey(bipPath, `cosmos`);
  return {
    address: r.bech32_address,
    publicKey: r.compressed_pk.toString("hex"),
    path
  };
};

export default resolver;
