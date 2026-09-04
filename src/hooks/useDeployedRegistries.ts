/**
 * Proxies the connected wallet deployed through the VerifiableFactory.
 * Provenance is on-chain: ProxyDeployed has the sender indexed, and the
 * implementation field separates registries from resolvers.
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
  FACTORY_DEPLOY_BLOCK,
  LOG_SCAN_RPC,
  deployments,
} from "../config/deployments";
import { classifyError } from "../lib/errors";

export type DeployedProxy = {
  address: Address;
  blockNumber: bigint;
};

/** @deprecated alias kept for existing imports */
export type DeployedRegistry = DeployedProxy;

const proxyDeployedEvent = (verifiableFactoryAbi as Abi).find(
  (e) => e.type === "event" && e.name === "ProxyDeployed",
) as AbiEvent;

/** All proxies of a given implementation the wallet deployed via the factory. */
export function useDeployedProxies(wallet?: Address, implementation?: Address) {
  const scanClient = useMemo(
    () => createPublicClient({ chain: sepolia, transport: http(LOG_SCAN_RPC) }),
    [],
  );
  const [proxies, setProxies] = useState<DeployedProxy[]>([]);
  const [error, setError] = useState<string>();
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!wallet || !implementation) return;
    let cancelled = false;

    (async () => {
      try {
        const logs = await scanClient.getLogs({
          address: deployments.VerifiableFactory,
          event: proxyDeployedEvent,
          args: { sender: wallet },
          fromBlock: FACTORY_DEPLOY_BLOCK,
          toBlock: "latest",
        });
        const found = logs
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((l: any) =>
            (l.args.implementation as string).toLowerCase() ===
            implementation.toLowerCase(),
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((l: any) => ({
            address: l.args.proxyAddress as Address,
            blockNumber: l.blockNumber as bigint,
          }));
        // newest first
        found.sort((a: DeployedProxy, b: DeployedProxy) =>
          a.blockNumber > b.blockNumber ? -1 : 1,
        );
        if (!cancelled) {
          setProxies(found);
          setError(undefined);
        }
      } catch (err) {
        if (!cancelled) setError(classifyError(err).message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wallet, implementation, scanClient, nonce]);

  return { proxies, error, refresh };
}

/** UserRegistry proxies deployed by the wallet. */
export function useDeployedRegistries(wallet?: Address) {
  const { proxies, error, refresh } = useDeployedProxies(
    wallet,
    deployments.UserRegistryImpl,
  );
  return { registries: proxies, error, refresh };
}

/** PermissionedResolver proxies deployed by the wallet. */
export function useDeployedResolvers(wallet?: Address) {
  const { proxies, error, refresh } = useDeployedProxies(
    wallet,
    deployments.PermissionedResolverImpl,
  );
  return { resolvers: proxies, error, refresh };
}
