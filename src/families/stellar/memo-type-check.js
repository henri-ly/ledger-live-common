import network from "../../network";
import { makeLRUCache } from "../../cache";
import axios from "axios";

async function fetch(url) {
  const { data } = await axios.get(url).catch(e => {
    if (e.status === 404) {
      return null;
    }
    throw e;
  });
  return data;
}

const baseUrl = "https://api.stellar.expert/";

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
const getMemoTypeSuggested = async addr => {
  const accountDirectory = await fetch(
    `${baseUrl}/api/explorer/public/directory/${addr}`
  );

  const memoType =
    accountDirectory && accountDirectory.accepts
      ? accountDirectory.accepts.memo
      : null;

  memoTypeCheckCache.hydrate(addr, memoType);

  return memoType;
};

export default memoTypeCheckCache;
