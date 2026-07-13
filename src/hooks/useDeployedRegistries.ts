/**
 * All UserRegistry proxies the connected wallet ever deployed through the
 * VerifiableFactory. Provenance is on-chain: ProxyDeployed has the sender
 * indexed, and the implementation field separates registries from resolvers.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  http,
  type Abi,
  type AbiEvent,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { verifiableFactoryAbi } from "../config/abis";
import {
  ETH_REGISTRY_DEPLOY_BLOCK,
  LOG_SCAN_RPC,
  deployments,
} from "../config/deployments";
import { classifyError } from "../lib/errors";

export type DeployedRegistry = {
  address: Address;
  blockNumber: bigint;
};

const proxyDeployedEvent = (verifiableFactoryAbi as Abi).find(
  (e) => e.type === "event" && e.name === "ProxyDeployed",
) as AbiEvent;

export function useDeployedRegistries(wallet?: Address) {
  const scanClient = useMemo(
    () => createPublicClient({ chain: sepolia, transport: http(LOG_SCAN_RPC) }),
    [],
  );
  const [registries, setRegistries] = useState<DeployedRegistry[]>([]);
  const [error, setError] = useState<string>();
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;

    (async () => {
      try {
        const logs = await scanClient.getLogs({
          address: deployments.VerifiableFactory,
          event: proxyDeployedEvent,
          args: { sender: wallet },
          fromBlock: ETH_REGISTRY_DEPLOY_BLOCK,
          toBlock: "latest",
        });
        const found = logs
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((l: any) =>
            (l.args.implementation as string).toLowerCase() ===
            deployments.UserRegistryImpl.toLowerCase(),
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((l: any) => ({
            address: l.args.proxyAddress as Address,
            blockNumber: l.blockNumber as bigint,
          }));
        // newest first
        found.sort((a: DeployedRegistry, b: DeployedRegistry) =>
          a.blockNumber > b.blockNumber ? -1 : 1,
        );
        if (!cancelled) {
          setRegistries(found);
          setError(undefined);
        }
      } catch (err) {
        if (!cancelled) setError(classifyError(err).message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wallet, scanClient, nonce]);

  return { registries, error, refresh };
}
