/**
 * Live reads for the selected parent name: expiry, current subregistry and
 * resolver, and whether the connected account holds the roles needed to
 * (re)configure it. On-chain truth for the inspect step.
 */

import { useReadContracts } from "wagmi";
import { zeroAddress, type Abi, type Address } from "viem";
import { registryAbi } from "../config/abis";
import { deployments } from "../config/deployments";
import { labelhashId } from "../lib/names";
import { ROLE_SET_SUBREGISTRY } from "../lib/roles";

export type NameStatus = {
  loading: boolean;
  expiry?: bigint;
  owner?: Address;
  /** address(0) when none is set. */
  subregistry?: Address;
  hasSubregistry: boolean;
  resolver?: Address;
  /** Connected account may call setSubregistry on this name. */
  canConfigure: boolean;
  isOwner: boolean;
  refetch: () => void;
};

export function useNameStatus(parentLabel?: string, account?: Address): NameStatus {
  const anyId = parentLabel ? labelhashId(parentLabel) : undefined;
  const enabled = Boolean(parentLabel && account);

  const { data, isLoading, refetch } = useReadContracts({
    contracts: enabled
      ? [
          {
            address: deployments.ETHRegistry,
            abi: registryAbi as Abi,
            functionName: "getExpiry",
            args: [anyId!],
          },
          {
            address: deployments.ETHRegistry,
            abi: registryAbi as Abi,
            functionName: "getOwner",
            args: [anyId!],
          },
          {
            address: deployments.ETHRegistry,
            abi: registryAbi as Abi,
            functionName: "getSubregistry",
            args: [parentLabel!],
          },
          {
            address: deployments.ETHRegistry,
            abi: registryAbi as Abi,
            functionName: "getResolver",
            args: [parentLabel!],
          },
          {
            address: deployments.ETHRegistry,
            abi: registryAbi as Abi,
            functionName: "getResource",
            args: [anyId!],
          },
        ]
      : [],
    query: { enabled },
  });

  const expiry = data?.[0]?.result as bigint | undefined;
  const owner = data?.[1]?.result as Address | undefined;
  const subregistry = data?.[2]?.result as Address | undefined;
  const resolver = data?.[3]?.result as Address | undefined;
  const resource = data?.[4]?.result as bigint | undefined;

  const isOwner = Boolean(
    owner && account && owner.toLowerCase() === account.toLowerCase(),
  );

  // Roles are per-account (they do not automatically follow token transfers),
  // so canConfigure comes from an explicit hasRoles read, never from ownership.
  const { data: roleData } = useReadContracts({
    contracts:
      enabled && resource !== undefined
        ? [
            {
              address: deployments.ETHRegistry,
              abi: registryAbi as Abi,
              functionName: "hasRoles",
              args: [resource, ROLE_SET_SUBREGISTRY, account!],
            },
          ]
        : [],
    query: { enabled: enabled && resource !== undefined },
  });
  const hasRoleDirectly = Boolean(roleData?.[0]?.result);

  return {
    loading: isLoading,
    expiry,
    owner,
    subregistry,
    hasSubregistry: Boolean(subregistry && subregistry !== zeroAddress),
    resolver,
    canConfigure: hasRoleDirectly,
    isOwner,
    refetch: () => void refetch(),
  };
}
