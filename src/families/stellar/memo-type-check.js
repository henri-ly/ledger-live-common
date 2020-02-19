// @flow

import { makeLRUCache } from "../../cache";
import axios from "axios";

const baseUrl: string = "https://api.stellar.expert/";

//$FlowFixMe <--- Don't know how to resolve this properly
const memoTypeCheckCache = makeLRUCache(
  async (addr: string): Promise<?string> => getMemoTypeSuggested(addr),
  (addr: string) => addr,
  {
    max: 300,
    maxAge: 180 * 60 * 1000 // 3hours
  }
);

// It's check if the explorer get any info about the memo to recommand one,
// doesn't matter if it's don't have any
const getMemoTypeSuggested = async (addr: string): Promise<?string> => {
  let accountDirectory;

  try {
    const { data } = await axios.get(
      `${baseUrl}/api/explorer/public/directory/${addr}`
    );
    accountDirectory = data;
  } catch (e) {
    if (e.response.status === 404) {
      accountDirectory = null;
    } else {
      throw e;
    }
  }

  const memoType =
    accountDirectory && accountDirectory.accepts
      ? accountDirectory.accepts.memo
      : null;

  memoTypeCheckCache.hydrate(addr, memoType);

  return memoType;
};

export default memoTypeCheckCache;
