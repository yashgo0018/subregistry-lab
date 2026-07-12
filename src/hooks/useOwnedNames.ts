/**
 * Scans the ETHRegistry for .eth names owned by the connected wallet.
 * Chunked getLogs from the registry deploy block, incremental via a
 * per-wallet localStorage cache, ownership confirmed on-chain afterwards
 * (transfers away / expiry make log-derived candidacy stale).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import type { Abi, Address } from "viem";
import { registryAbi } from "../config/abis";
import {
  ETH_REGISTRY_DEPLOY_BLOCK,
  LOG_CHUNK_SIZE,
  deployments,
} from "../config/deployments";
import { classifyError } from "../lib/errors";
import {
  cacheCandidates,
  emptyCache,
  mergeCache,
  planRanges,
  type ScanCache,
} from "../lib/logs";
import { labelhashId } from "../lib/names";

export type OwnedName = {
  label: string;
  name: string; // label.eth
  expiry: bigint;
  status: "active" | "grace" | "expired";
};

export type OwnedNamesResult = {
  names: OwnedName[];
  loading: boolean;
  /** 0..1 scan progress while loading. */
  progress: number;
  error?: string;
  refresh: () => void;
};

const CACHE_PREFIX = "subregistry-lab:scan:v1:";

function loadCache(wallet: string): ScanCache {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + wallet.toLowerCase());
    if (raw) {
      const parsed = JSON.parse(raw) as ScanCache;
      if (parsed.version === 1) return parsed;
    }
  } catch {
    // fall through to fresh cache
  }
  return emptyCache(wallet, ETH_REGISTRY_DEPLOY_BLOCK);
}

function saveCache(cache: ScanCache): void {
  try {
    localStorage.setItem(CACHE_PREFIX + cache.wallet, JSON.stringify(cache));
  } catch {
    // non-fatal
  }
}

/** Grace period is a registrar-level concept; used only for a UI hint. */
const GRACE_SECONDS = 28n * 24n * 60n * 60n;

export function useOwnedNames(wallet?: Address): OwnedNamesResult {
  const client = usePublicClient();
  const [names, setNames] = useState<OwnedName[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();
  const [nonce, setNonce] = useState(0);
  const scanning = useRef(false);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!wallet || !client || scanning.current) return;
    scanning.current = true;
    setLoading(true);
    setError(undefined);

    let cancelled = false;

    (async () => {
      try {
        let cache = loadCache(wallet);
        const head = await client.getBlockNumber();
        const from = BigInt(cache.lastScannedBlock) + 1n;

        if (from <= head) {
          let chunk = LOG_CHUNK_SIZE;
          let ranges = planRanges(from, head, chunk);
          const total = ranges.length;
          let index = 0;
          while (index < ranges.length) {
            const range = ranges[index];
            try {
              const [transferLogs, labelLogs] = await Promise.all([
                client.getLogs({
                  address: deployments.ETHRegistry,
                  event: (registryAbi as Abi).find(
                    (e) => e.type === "event" && e.name === "TransferSingle",
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ) as any,
                  args: { to: wallet },
                  fromBlock: range.fromBlock,
                  toBlock: range.toBlock,
                }),
                client.getLogs({
                  address: deployments.ETHRegistry,
                  event: (registryAbi as Abi).find(
                    (e) => e.type === "event" && e.name === "LabelRegistered",
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ) as any,
                  fromBlock: range.fromBlock,
                  toBlock: range.toBlock,
                }),
              ]);
              cache = mergeCache(
                cache,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                transferLogs.map((l: any) => ({ to: l.args.to as string, id: l.args.id as bigint })),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelLogs.map((l: any) => ({
                  tokenId: l.args.tokenId as bigint,
                  label: l.args.label as string,
                  expiry: l.args.expiry as bigint,
                })),
                range.toBlock,
              );
              saveCache(cache);
              index += 1;
              if (!cancelled) setProgress(Math.min(0.9, (index / total) * 0.9));
            } catch (err) {
              const classified = classifyError(err);
              if (classified.kind === "rpc-range" && chunk > 1000n) {
                // halve the chunk size and re-plan the remaining span
                chunk = chunk / 2n;
                ranges = planRanges(range.fromBlock, head, chunk);
                index = 0;
              } else {
                throw err;
              }
            }
          }
        }

        // Confirm current ownership + expiry on-chain for each candidate.
        const candidates = cacheCandidates(cache);
        const now = BigInt(Math.floor(Date.now() / 1000));
        const confirmed: OwnedName[] = [];
        for (const candidate of candidates) {
          const [owner, expiry] = await Promise.all([
            client.readContract({
              address: deployments.ETHRegistry,
              abi: registryAbi as Abi,
              functionName: "getOwner",
              args: [labelhashId(candidate.label)],
            }) as Promise<Address>,
            client.readContract({
              address: deployments.ETHRegistry,
              abi: registryAbi as Abi,
              functionName: "getExpiry",
              args: [labelhashId(candidate.label)],
            }) as Promise<bigint>,
          ]);
          const owned = owner.toLowerCase() === wallet.toLowerCase();
          const expired = expiry <= now;
          if (owned) {
            confirmed.push({
              label: candidate.label,
              name: `${candidate.label}.eth`,
              expiry,
              status: "active",
            });
          } else if (expired && expiry > 0n && expiry + GRACE_SECONDS > now) {
            // getOwner masks expired names; still show grace-period names as theirs-ish
            confirmed.push({
              label: candidate.label,
              name: `${candidate.label}.eth`,
              expiry,
              status: "grace",
            });
          }
        }
        if (!cancelled) {
          setNames(confirmed.sort((a, b) => a.label.localeCompare(b.label)));
          setProgress(1);
        }
      } catch (err) {
        if (!cancelled) setError(classifyError(err).message);
      } finally {
        scanning.current = false;
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      scanning.current = false;
    };
  }, [wallet, client, nonce]);

  return { names, loading, progress, error, refresh };
}
