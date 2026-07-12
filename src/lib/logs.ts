/**
 * Pure helpers for the owned-name log scan (ETHRegistry).
 * The hooks do the RPC calls; everything here is deterministic and testable.
 *
 * Strategy: TransferSingle has `to` indexed (cheap wallet filter);
 * LabelRegistered carries the label string but `owner` is NOT indexed.
 * So: collect candidate tokenIds from transfers TO the wallet, build a
 * canonicalId -> label index from LabelRegistered, join, then let the hook
 * confirm current ownership on-chain via getOwner.
 */

import { canonicalId } from "./names";

export type BlockRange = { fromBlock: bigint; toBlock: bigint };

/** Split [from, to] into inclusive chunks of at most `chunkSize` blocks. */
export function planRanges(from: bigint, to: bigint, chunkSize: bigint): BlockRange[] {
  if (chunkSize <= 0n) throw new Error("chunkSize must be positive");
  if (to < from) return [];
  const ranges: BlockRange[] = [];
  let start = from;
  while (start <= to) {
    const end = start + chunkSize - 1n < to ? start + chunkSize - 1n : to;
    ranges.push({ fromBlock: start, toBlock: end });
    start = end + 1n;
  }
  return ranges;
}

export type TransferSingleLike = { to: string; id: bigint };
export type LabelRegisteredLike = { tokenId: bigint; label: string; expiry: bigint };

/** Canonical token ids ever transferred TO the wallet (mints included). */
export function extractCandidateIds(
  logs: TransferSingleLike[],
  wallet: string,
): bigint[] {
  const target = wallet.toLowerCase();
  const seen = new Set<bigint>();
  for (const log of logs) {
    if (log.to.toLowerCase() === target) {
      seen.add(canonicalId(log.id));
    }
  }
  return [...seen];
}

/** canonicalId -> latest {label, expiry} from LabelRegistered logs (later wins). */
export function buildLabelIndex(
  logs: LabelRegisteredLike[],
): Map<bigint, { label: string; expiry: bigint }> {
  const index = new Map<bigint, { label: string; expiry: bigint }>();
  for (const log of logs) {
    index.set(canonicalId(log.tokenId), { label: log.label, expiry: log.expiry });
  }
  return index;
}

export type OwnedNameCandidate = { label: string; canonicalId: bigint };

/** Join candidates against the label index; unknown ids are dropped. */
export function joinOwnedNames(
  candidateIds: bigint[],
  labelIndex: Map<bigint, { label: string; expiry: bigint }>,
): OwnedNameCandidate[] {
  const out: OwnedNameCandidate[] = [];
  for (const id of candidateIds) {
    const entry = labelIndex.get(id);
    if (entry) out.push({ label: entry.label, canonicalId: id });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/** localStorage cache shape for incremental scans (bigints as strings). */
export type ScanCache = {
  version: 1;
  wallet: string;
  lastScannedBlock: string;
  /** canonicalId (string) -> label */
  labels: Record<string, string>;
  /** canonical candidate ids (strings) transferred to the wallet */
  candidates: string[];
};

export function emptyCache(wallet: string, deployBlock: bigint): ScanCache {
  return {
    version: 1,
    wallet: wallet.toLowerCase(),
    lastScannedBlock: (deployBlock - 1n).toString(),
    labels: {},
    candidates: [],
  };
}

/** Merge freshly scanned logs into the cache; idempotent for replayed logs. */
export function mergeCache(
  cache: ScanCache,
  transferLogs: TransferSingleLike[],
  labelLogs: LabelRegisteredLike[],
  scannedThrough: bigint,
): ScanCache {
  const labels = { ...cache.labels };
  for (const log of labelLogs) {
    labels[canonicalId(log.tokenId).toString()] = log.label;
  }
  const candidates = new Set(cache.candidates);
  for (const id of extractCandidateIds(transferLogs, cache.wallet)) {
    candidates.add(id.toString());
  }
  const prev = BigInt(cache.lastScannedBlock);
  return {
    ...cache,
    labels,
    candidates: [...candidates],
    lastScannedBlock: (scannedThrough > prev ? scannedThrough : prev).toString(),
  };
}

/** Names derivable from a cache (ownership still needs on-chain confirmation). */
export function cacheCandidates(cache: ScanCache): OwnedNameCandidate[] {
  const index = new Map<bigint, { label: string; expiry: bigint }>();
  for (const [id, label] of Object.entries(cache.labels)) {
    index.set(BigInt(id), { label, expiry: 0n });
  }
  return joinOwnedNames(cache.candidates.map(BigInt), index);
}
