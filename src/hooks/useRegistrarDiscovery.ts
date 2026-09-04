/**
 * Discover the registrar of a UserRegistry from chain instead of relying on
 * session memory: scan EACRolesChanged for ROOT_RESOURCE (0) grants, then
 * keep the accounts that CURRENTLY hold ROLE_REGISTRAR and are contracts
 * (the owner wallet also holds registrar rights but isn't a registrar).
 */

import { useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import {
  createPublicClient,
  http,
  type Abi,
  type AbiEvent,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { registryAbi } from "../config/abis";
import { FACTORY_DEPLOY_BLOCK, LOG_SCAN_RPC } from "../config/deployments";
import { ROLE_REGISTRAR } from "../lib/roles";

const rolesChangedEvent = (registryAbi as Abi).find(
  (e) => e.type === "event" && e.name === "EACRolesChanged",
) as AbiEvent;

/** First contract account currently holding root ROLE_REGISTRAR (undefined = none). */
export function useRegistrarDiscovery(
  registry?: Address,
  fromBlock?: bigint,
  skip?: boolean,
) {
  const client = usePublicClient();
  const scanClient = useMemo(
    () => createPublicClient({ chain: sepolia, transport: http(LOG_SCAN_RPC) }),
    [],
  );
  const [registrar, setRegistrar] = useState<Address>();

  useEffect(() => {
    if (!registry || !client || skip) return;
    let cancelled = false;

    (async () => {
      try {
        const params = {
          address: registry,
          event: rolesChangedEvent,
          args: { resource: 0n }, // ROOT_RESOURCE grants only
          fromBlock: fromBlock ?? FACTORY_DEPLOY_BLOCK,
          toBlock: "latest",
        } as const;
        let logs;
        try {
          logs = await scanClient.getLogs(params);
        } catch {
          logs = await client.getLogs(params);
        }
        const accounts = [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...new Set(logs.map((l: any) => (l.args.account as string).toLowerCase())),
        ] as Address[];

        for (const account of accounts) {
          const holds = (await client.readContract({
            address: registry,
            abi: registryAbi as Abi,
            functionName: "hasRootRoles",
            args: [ROLE_REGISTRAR, account],
          })) as boolean;
          if (!holds) continue;
          // Registrars are contracts; the owner wallet is not.
          const code = await client.getCode({ address: account });
          if (code && code !== "0x") {
            if (!cancelled) setRegistrar(account);
            return;
          }
        }
        if (!cancelled) setRegistrar(undefined);
      } catch {
        // discovery is best-effort; the playground just won't offer paid mode
        if (!cancelled) setRegistrar(undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [registry, client, scanClient, fromBlock, skip]);

  return registrar;
}
