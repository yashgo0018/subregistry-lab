import { describe, expect, it } from "vitest";
import {
  buildLabelIndex,
  cacheCandidates,
  emptyCache,
  extractCandidateIds,
  joinOwnedNames,
  mergeCache,
  planRanges,
} from "./logs";
import { canonicalId, labelhashId } from "./names";

const WALLET = "0xAbC0000000000000000000000000000000000001";

describe("planRanges", () => {
  it("splits exactly divisible ranges", () => {
    expect(planRanges(0n, 99n, 50n)).toEqual([
      { fromBlock: 0n, toBlock: 49n },
      { fromBlock: 50n, toBlock: 99n },
    ]);
  });
  it("handles remainders and single blocks", () => {
    expect(planRanges(10n, 12n, 2n)).toEqual([
      { fromBlock: 10n, toBlock: 11n },
      { fromBlock: 12n, toBlock: 12n },
    ]);
    expect(planRanges(5n, 5n, 100n)).toEqual([{ fromBlock: 5n, toBlock: 5n }]);
  });
  it("returns empty for inverted ranges", () => {
    expect(planRanges(10n, 9n, 5n)).toEqual([]);
  });
});

describe("candidate extraction + join", () => {
  const aliceId = labelhashId("alice");
  const bobId = labelhashId("bob");
  // simulate a regenerated token id (version bits set)
  const aliceRegen = (aliceId & ~((1n << 32n) - 1n)) | 3n;

  it("filters by wallet case-insensitively and canonicalizes", () => {
    const ids = extractCandidateIds(
      [
        { to: WALLET.toLowerCase(), id: aliceRegen },
        { to: "0x0000000000000000000000000000000000000002", id: bobId },
      ],
      WALLET,
    );
    expect(ids).toEqual([canonicalId(aliceId)]);
  });

  it("joins across differing version bits, later label wins", () => {
    const index = buildLabelIndex([
      { tokenId: aliceId, label: "alice", expiry: 1n },
      { tokenId: aliceRegen, label: "alice", expiry: 2n },
      { tokenId: bobId, label: "bob", expiry: 1n },
    ]);
    const joined = joinOwnedNames([canonicalId(aliceId)], index);
    expect(joined).toEqual([{ label: "alice", canonicalId: canonicalId(aliceId) }]);
  });

  it("drops candidates with no label", () => {
    const joined = joinOwnedNames([123n << 32n], buildLabelIndex([]));
    expect(joined).toEqual([]);
  });
});

describe("cache", () => {
  const aliceId = labelhashId("alice");

  it("merge is idempotent for replayed logs and tracks high-water mark", () => {
    let cache = emptyCache(WALLET, 100n);
    expect(cache.lastScannedBlock).toBe("99");

    const transfers = [{ to: WALLET, id: aliceId }];
    const labels = [{ tokenId: aliceId, label: "alice", expiry: 5n }];

    cache = mergeCache(cache, transfers, labels, 200n);
    const once = JSON.stringify(cache);
    cache = mergeCache(cache, transfers, labels, 150n); // replay, lower block
    expect(cache.candidates).toHaveLength(1);
    expect(cache.lastScannedBlock).toBe("200"); // never goes backwards
    expect(JSON.stringify(cache)).toBe(once.replace('"200"', '"200"'));
  });

  it("cacheCandidates round-trips through string serialization", () => {
    let cache = emptyCache(WALLET, 100n);
    cache = mergeCache(
      cache,
      [{ to: WALLET, id: aliceId }],
      [{ tokenId: aliceId, label: "alice", expiry: 5n }],
      200n,
    );
    const revived = JSON.parse(JSON.stringify(cache));
    expect(cacheCandidates(revived)).toEqual([
      { label: "alice", canonicalId: canonicalId(aliceId) },
    ]);
  });
});
