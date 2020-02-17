// @flow

import Trx from "hw-app-trx";
import type { Resolver } from "../../hw/getAddress/types";

const resolver: Resolver = async (
  transport,
  { path, verify }
) => {
  const trx = new Trx(transport);
  const r = await trx.getAddress(path, undefined);
  return { ...r, path };
};

export default resolver;
