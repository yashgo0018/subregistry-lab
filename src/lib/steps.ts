/**
 * Pure transaction-plan builders. A StepDef describes one transaction:
 * how to build it, how to extract results from its receipt, and how to
 * verify the on-chain outcome afterwards. The runner (useTxSequence) walks
 * the list; everything here is deterministic and unit-testable.
 */

import {
  encodeFunctionData,
  parseEventLogs,
  zeroAddress,
  type Abi,
  type Address,
  type TransactionReceipt,
} from "viem";
import registrarArtifact from "../config/artifacts/SimpleSubnameRegistrar.json";
import {
  erc20Abi,
  registryAbi,
  resolverInitAbi,
  simpleRegistrarAbi,
  userRegistryInitAbi,
  verifiableFactoryAbi,
} from "../config/abis";
import { deployments } from "../config/deployments";
import { labelhashId } from "./names";
import { deriveSalt } from "./salt";
import { ALL_ROLES } from "./roles";
import {
  DANGEROUS_ROOT_BITMAP,
  MAX_EXPIRY,
  getPreset,
  type Preset,
  type PresetId,
} from "./presets";
import { ROLE_SET_SUBREGISTRY, adminOf } from "./roles";

export type WriteAction = {
  type: "write";
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
};

export type DeployAction = {
  type: "deploy";
  abi: Abi;
  bytecode: `0x${string}`;
  args: readonly unknown[];
};

export type StepAction = WriteAction | DeployAction;

/** Minimal read interface so verify() is stubbable in tests. */
export type ReadFn = (params: {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
}) => Promise<unknown>;

export type StepCtx = {
  account: Address;
  parentLabel: string;
  ownerInitBitmap: bigint;
  deployResolver: boolean;
  existingResolver?: Address;
  registrarParams?: {
    pricePerYear: bigint;
    minDuration: bigint;
    beneficiary: Address;
    grantBitmap: bigint;
  };
  // Filled in by onReceipt patches while the sequence runs:
  userRegistry?: Address;
  resolver?: Address;
  registrar?: Address;
};

export type StepDef = {
  id: string;
  title: string;
  /** One-liner for non-coders, shown under the title. */
  explain: string;
  skipIf?: (ctx: StepCtx) => boolean;
  build: (ctx: StepCtx) => StepAction;
  onReceipt?: (receipt: TransactionReceipt, ctx: StepCtx) => Partial<StepCtx>;
  verify?: (read: ReadFn, ctx: StepCtx) => Promise<{ ok: boolean; detail: string }>;
};

const registrarAbi = registrarArtifact.abi as Abi;
const registrarBytecode = registrarArtifact.bytecode as `0x${string}`;

function parseProxyAddress(receipt: TransactionReceipt): Address {
  const [log] = parseEventLogs({
    abi: verifiableFactoryAbi,
    eventName: "ProxyDeployed",
    logs: receipt.logs,
  });
  if (!log) throw new Error("ProxyDeployed event not found in receipt");
  return log.args.proxyAddress;
}

/** The main setup sequence for a preset. */
export function buildSetupSteps(preset: Preset | PresetId): StepDef[] {
  const p = typeof preset === "string" ? getPreset(preset) : preset;

  const steps: StepDef[] = [
    {
      id: "deploy-registry",
      title: "Deploy your subname registry",
      explain: "Creates a fresh UserRegistry contract that will hold your subnames.",
      build: (ctx) => ({
        type: "write",
        address: deployments.VerifiableFactory,
        abi: verifiableFactoryAbi as unknown as Abi,
        functionName: "deployProxy",
        args: [
          deployments.UserRegistryImpl,
          deriveSalt(ctx.parentLabel),
          encodeFunctionData({
            abi: userRegistryInitAbi,
            functionName: "initialize",
            args: [ctx.account, ctx.ownerInitBitmap],
          }),
        ],
      }),
      onReceipt: (receipt) => ({ userRegistry: parseProxyAddress(receipt) }),
      verify: async (read, ctx) => {
        if (!ctx.userRegistry) return { ok: false, detail: "No registry address captured" };
        const ok = (await read({
          address: ctx.userRegistry,
          abi: registryAbi as unknown as Abi,
          functionName: "hasRootRoles",
          args: [ctx.ownerInitBitmap, ctx.account],
        })) as boolean;
        return {
          ok,
          detail: ok
            ? `Registry live at ${ctx.userRegistry}; you hold the configured roles`
            : "Registry deployed but your roles are missing",
        };
      },
    },
    {
      id: "deploy-resolver",
      title: "Deploy a resolver",
      explain: "Creates a resolver contract so your subnames can hold address records.",
      skipIf: (ctx) => !ctx.deployResolver,
      build: (ctx) => ({
        type: "write",
        address: deployments.VerifiableFactory,
        abi: verifiableFactoryAbi as unknown as Abi,
        functionName: "deployProxy",
        args: [
          deployments.PermissionedResolverImpl,
          deriveSalt(`${ctx.parentLabel}-resolver`),
          encodeFunctionData({
            abi: resolverInitAbi,
            functionName: "initialize",
            args: [ctx.account, ALL_ROLES],
          }),
        ],
      }),
      onReceipt: (receipt) => ({ resolver: parseProxyAddress(receipt) }),
    },
    {
      id: "link",
      title: "Point your name at the new registry",
      explain: "Tells the .eth registry that subnames of your name live in your new registry.",
      build: (ctx) => ({
        type: "write",
        address: deployments.ETHRegistry,
        abi: registryAbi as unknown as Abi,
        functionName: "setSubregistry",
        args: [labelhashId(ctx.parentLabel), ctx.userRegistry],
      }),
      verify: async (read, ctx) => {
        const linked = (await read({
          address: deployments.ETHRegistry,
          abi: registryAbi as unknown as Abi,
          functionName: "getSubregistry",
          args: [ctx.parentLabel],
        })) as Address;
        const ok = linked.toLowerCase() === (ctx.userRegistry ?? "").toLowerCase();
        return {
          ok,
          detail: ok
            ? `${ctx.parentLabel}.eth now points at ${linked}`
            : `Link mismatch: registry reports ${linked}`,
        };
      },
    },
    {
      id: "deploy-registrar",
      title: "Deploy the subname registrar",
      explain: "Creates the contract that sells subnames for test USDC.",
      skipIf: (ctx) => !ctx.registrarParams,
      build: (ctx) => ({
        type: "deploy",
        abi: registrarAbi,
        bytecode: registrarBytecode,
        args: [
          ctx.userRegistry,
          deployments.MockUSDC,
          ctx.registrarParams!.beneficiary,
          ctx.registrarParams!.pricePerYear,
          ctx.registrarParams!.minDuration,
        ],
      }),
      onReceipt: (receipt) => {
        if (!receipt.contractAddress) throw new Error("No contract address in deploy receipt");
        return { registrar: receipt.contractAddress };
      },
    },
    {
      id: "grant-registrar",
      title: "Authorize the registrar",
      explain: "Allows the registrar contract to register and renew subnames in your registry.",
      skipIf: (ctx) => !ctx.registrarParams,
      build: (ctx) => ({
        type: "write",
        address: ctx.userRegistry!,
        abi: registryAbi as unknown as Abi,
        functionName: "grantRootRoles",
        args: [ctx.registrarParams!.grantBitmap, ctx.registrar],
      }),
      verify: async (read, ctx) => {
        const ok = (await read({
          address: ctx.userRegistry!,
          abi: registryAbi as unknown as Abi,
          functionName: "hasRootRoles",
          args: [ctx.registrarParams!.grantBitmap, ctx.registrar],
        })) as boolean;
        return {
          ok,
          detail: ok
            ? "Registrar can now register and renew subnames"
            : "Registrar roles missing after grant",
        };
      },
    },
  ];

  // Presets without a registrar simply skip those steps via skipIf.
  void p;
  return steps;
}

/** Direct owner registration of a subname (no registrar, no payment). */
export function buildDirectRegisterStep(params: {
  userRegistry: Address;
  label: string;
  owner: Address;
  resolver: Address;
  roleBitmap: bigint;
  expiry: bigint; // absolute unix timestamp, or MAX_EXPIRY for "never"
}): StepDef[] {
  return [
    {
      id: "direct-register",
      title: `Register ${params.label}`,
      explain:
        params.expiry === MAX_EXPIRY
          ? "Registers the subname with a never-expiring lifetime."
          : "Registers the subname until the chosen expiry date.",
      build: () => ({
        type: "write",
        address: params.userRegistry,
        abi: registryAbi as unknown as Abi,
        functionName: "register",
        args: [
          params.label,
          params.owner,
          zeroAddress,
          params.resolver,
          params.roleBitmap,
          params.expiry,
        ],
      }),
      verify: async (read) => {
        const owner = (await read({
          address: params.userRegistry,
          abi: registryAbi as unknown as Abi,
          functionName: "getOwner",
          args: [labelhashId(params.label)],
        })) as Address;
        const ok = owner.toLowerCase() === params.owner.toLowerCase();
        return {
          ok,
          detail: ok ? `${params.label} registered to ${owner}` : `Owner is ${owner}`,
        };
      },
    },
  ];
}

/** Paid registration through the SimpleSubnameRegistrar: approve (if needed) + register. */
export function buildRegistrarRegisterSteps(params: {
  registrar: Address;
  userRegistry: Address;
  label: string;
  owner: Address;
  resolver: Address;
  duration: bigint; // seconds
  price: bigint; // MockUSDC 6-decimals, pre-read via getPrice
  currentAllowance: bigint;
}): StepDef[] {
  return [
    {
      id: "approve-usdc",
      title: "Approve test USDC",
      explain: "Allows the registrar to take the registration fee from your wallet.",
      skipIf: () => params.currentAllowance >= params.price,
      build: () => ({
        type: "write",
        address: deployments.MockUSDC,
        abi: erc20Abi as unknown as Abi,
        functionName: "approve",
        args: [params.registrar, params.price],
      }),
    },
    {
      id: "registrar-register",
      title: `Register ${params.label} (paid)`,
      explain: "Registers the subname through the registrar, paying the fee.",
      build: () => ({
        type: "write",
        address: params.registrar,
        abi: simpleRegistrarAbi as unknown as Abi,
        functionName: "register",
        args: [params.label, params.owner, params.resolver, params.duration],
      }),
      verify: async (read) => {
        const owner = (await read({
          address: params.userRegistry,
          abi: registryAbi as unknown as Abi,
          functionName: "getOwner",
          args: [labelhashId(params.label)],
        })) as Address;
        const ok = owner.toLowerCase() === params.owner.toLowerCase();
        return {
          ok,
          detail: ok ? `${params.label} registered to ${owner}` : `Owner is ${owner}`,
        };
      },
    },
  ];
}

/** Lock step 1: give up dangerous root roles on the UserRegistry. */
export function buildRevokeRegistryRolesStep(params: {
  userRegistry: Address;
  account: Address;
}): StepDef[] {
  return [
    {
      id: "revoke-registry-roles",
      title: "Give up dangerous registry roles",
      explain:
        "Revokes your own delete/renew/re-point/upgrade permissions on the registry. Irreversible.",
      build: () => ({
        type: "write",
        address: params.userRegistry,
        abi: registryAbi as unknown as Abi,
        functionName: "revokeRootRoles",
        args: [DANGEROUS_ROOT_BITMAP, params.account],
      }),
      verify: async (read) => {
        const still = (await read({
          address: params.userRegistry,
          abi: registryAbi as unknown as Abi,
          functionName: "hasRootRoles",
          args: [DANGEROUS_ROOT_BITMAP, params.account],
        })) as boolean;
        return {
          ok: !still,
          detail: still
            ? "Roles are still present"
            : "Dangerous roles are gone: nobody can delete or re-point subnames now",
        };
      },
    },
  ];
}

/**
 * Lock step 2: give up the permission to re-point the parent name's
 * subregistry link. The EAC resource for the name must be read first
 * (it embeds a version counter; the canonical id is NOT the resource).
 */
export function buildLockParentLinkStep(params: {
  parentLabel: string;
  parentResource: bigint; // pre-read via ETHRegistry.getResource(labelhashId(label))
  account: Address;
}): StepDef[] {
  const bitmap = ROLE_SET_SUBREGISTRY | adminOf(ROLE_SET_SUBREGISTRY);
  return [
    {
      id: "lock-parent-link",
      title: "Lock the parent link",
      explain:
        "Revokes your permission to change which registry your name points at. Irreversible.",
      build: () => ({
        type: "write",
        address: deployments.ETHRegistry,
        abi: registryAbi as unknown as Abi,
        functionName: "revokeRoles",
        args: [params.parentResource, bitmap, params.account],
      }),
      verify: async (read) => {
        // Re-read the resource: role changes regenerate ids but the resource is stable
        // across role updates (it only changes on re-registration).
        const still = (await read({
          address: deployments.ETHRegistry,
          abi: registryAbi as unknown as Abi,
          functionName: "hasRoles",
          args: [params.parentResource, bitmap, params.account],
        })) as boolean;
        return {
          ok: !still,
          detail: still
            ? "Link permission still present"
            : "Parent link is locked: this registry can never be swapped out",
        };
      },
    },
  ];
}

/** Faucet: mint test USDC to the connected wallet. */
export function buildFaucetStep(params: { account: Address; amount: bigint }): StepDef[] {
  return [
    {
      id: "faucet",
      title: "Mint test USDC",
      explain: "MockUSDC on Sepolia has an open mint for testing.",
      build: () => ({
        type: "write",
        address: deployments.MockUSDC,
        abi: erc20Abi as unknown as Abi,
        functionName: "mint",
        args: [params.account, params.amount],
      }),
    },
  ];
}

/** setAddr on the setup's resolver for a subname. */
export function buildSetAddrStep(params: {
  resolver: Address;
  node: `0x${string}`;
  fqdn: string;
  addr: Address;
}): StepDef[] {
  return [
    {
      id: "set-addr",
      title: `Set address record for ${params.fqdn}`,
      explain: "Stores the ETH address this subname should resolve to.",
      build: () => ({
        type: "write",
        address: params.resolver,
        abi: [
          {
            name: "setAddr",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "node", type: "bytes32" },
              { name: "addr_", type: "address" },
            ],
            outputs: [],
          },
        ] as const as unknown as Abi,
        functionName: "setAddr",
        args: [params.node, params.addr],
      }),
    },
  ];
}
