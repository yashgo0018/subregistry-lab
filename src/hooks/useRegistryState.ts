/**
 * Subnames registered in a UserRegistry: LabelRegistered logs from the
 * registry's deploy block (tiny range), states confirmed via getState.
 */

import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import type { Abi, Address } from "viem";
import { registryAbi } from "../config/abis";
import { ETH_REGISTRY_DEPLOY_BLOCK } from "../config/deployments";
import { classifyError } from "../lib/errors";
import { labelhashId } from "../lib/names";
import { MAX_EXPIRY } from "../lib/presets";

export type Subname = {
  label: string;
  expiry: bigint;
  neverExpires: boolean;
  owner: Address;
  registered: boolean;
};

export function useRegistryState(registry?: Address, fromBlock?: bigint) {
  const client = usePublicClient();
  const [subnames, setSubnames] = useState<Subname[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!registry || !client) return;
    let cancelled = false;
    setLoading(true);
    setError(undefined);

    (async () => {
      try {
        const logs = await client.getLogs({
          address: registry,
          event: (registryAbi as Abi).find(
            (e) => e.type === "event" && e.name === "LabelRegistered",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ) as any,
          fromBlock: fromBlock ?? ETH_REGISTRY_DEPLOY_BLOCK,
          toBlock: "latest",
        });
        const labels = [
          ...new Set(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            logs.map((l: any) => l.args.label as string),
          ),
        ];
        const results: Subname[] = [];
        for (const label of labels) {
          const state = (await client.readContract({
            address: registry,
            abi: registryAbi as Abi,
            functionName: "getState",
            args: [labelhashId(label)],
          })) as {
            status: number;
            expiry: bigint;
            latestOwner: Address;
            tokenId: bigint;
            resource: bigint;
          };
          results.push({
            label,
            expiry: state.expiry,
            neverExpires: state.expiry === MAX_EXPIRY,
            owner: state.latestOwner,
            registered: state.status === 2,
          });
        }
        if (!cancelled) {
          setSubnames(results.sort((a, b) => a.label.localeCompare(b.label)));
        }
      } catch (err) {
        if (!cancelled) setError(classifyError(err).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [registry, client, fromBlock, nonce]);

  return { subnames, loading, error, refresh };
}
