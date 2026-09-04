/**
 * Minimal ABIs for the contracts the lab touches.
 * Adapted from ensv2-example-tests/src/abis.ts (tested against the deployed
 * Sepolia set) and extended with register/renew, root-role functions, and
 * events, verified against contracts-v2 @97a5729 (Sepolia 2026-07-30).
 */

/** PermissionedRegistry / UserRegistry: registry surface + EAC. */
export const registryAbi = [
  // --- views ---
  {
    name: "getSubregistry",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getResolver",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getState",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "anyId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "status", type: "uint8" },
          { name: "expiry", type: "uint64" },
          { name: "latestOwner", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "resource", type: "uint256" },
        ],
      },
    ],
  },
  // getState is the one-call snapshot (status/expiry/latestOwner/token/resource).
  // The July 2026 registries also expose getOwner(anyId); we still prefer getState.
  {
    name: "getExpiry",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "anyId", type: "uint256" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    name: "getResource",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "anyId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getTokenId",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "anyId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  // --- EAC ---
  {
    name: "roles",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "resource", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "hasRoles",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "resource", type: "uint256" },
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "hasRootRoles",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "grantRootRoles",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "revokeRootRoles",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "grantRoles",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "resource", type: "uint256" },
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "revokeRoles",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "resource", type: "uint256" },
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  // --- writes ---
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "subregistry", type: "address" },
      { name: "resolver", type: "address" },
      { name: "roleBitmap", type: "uint256" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    name: "renew",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "anyId", type: "uint256" },
      { name: "newExpiry", type: "uint64" },
    ],
    outputs: [],
  },
  {
    name: "setSubregistry",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "anyId", type: "uint256" },
      { name: "subregistry", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "setResolver",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "anyId", type: "uint256" },
      { name: "resolver", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "setParent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "parent", type: "address" },
      { name: "label", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "getParent",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "parent", type: "address" },
      { name: "label", type: "string" },
    ],
  },
  // --- events ---
  {
    name: "LabelRegistered",
    type: "event",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "labelHash", type: "bytes32", indexed: true },
      { name: "label", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: false },
      { name: "expiry", type: "uint64", indexed: false },
      { name: "sender", type: "address", indexed: true },
    ],
  },
  {
    name: "TransferSingle",
    type: "event",
    inputs: [
      { name: "operator", type: "address", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "id", type: "uint256", indexed: false },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    name: "SubregistryUpdated",
    type: "event",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "subregistry", type: "address", indexed: true },
      { name: "sender", type: "address", indexed: true },
    ],
  },
  {
    name: "ExpiryUpdated",
    type: "event",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "newExpiry", type: "uint64", indexed: true },
      { name: "sender", type: "address", indexed: true },
    ],
  },
  {
    name: "EACRolesChanged",
    type: "event",
    inputs: [
      { name: "resource", type: "uint256", indexed: true },
      { name: "account", type: "address", indexed: true },
      { name: "oldRoleBitmap", type: "uint256", indexed: false },
      { name: "newRoleBitmap", type: "uint256", indexed: false },
    ],
  },
] as const;

/** UserRegistry proxy initializer (encoded into VerifiableFactory.deployProxy data). */
export const userRegistryInitAbi = [
  {
    name: "initialize",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "rootAccount", type: "address" },
      { name: "roleBitmap", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/**
 * PermissionedResolver proxy initializer.
 * The July 2026 implementation takes (admin, roleBitmap, setters): pass an
 * empty `setters` array unless you want to multicall record writes at init.
 */
export const resolverInitAbi = [
  {
    name: "initialize",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "admin", type: "address" },
      { name: "roleBitmap", type: "uint256" },
      { name: "setters", type: "bytes[]" },
    ],
    outputs: [],
  },
] as const;

/** PermissionedResolver: the record surface the lab uses. */
export const resolverAbi = [
  {
    name: "addr",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
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
  {
    name: "setText",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "hasRootRoles",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/** VerifiableFactory: proxy deployment + discovery event. */
export const verifiableFactoryAbi = [
  {
    name: "deployProxy",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "implementation", type: "address" },
      { name: "salt", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "proxy", type: "address" }],
  },
  {
    name: "ProxyDeployed",
    type: "event",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "proxyAddress", type: "address", indexed: true },
      { name: "salt", type: "uint256", indexed: false },
      { name: "implementation", type: "address", indexed: false },
    ],
  },
] as const;

/** ERC20 with the Mock tokens' open mint. */
export const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/** SimpleSubnameRegistrar (constructor/bytecode live in config/artifacts). */
export const simpleRegistrarAbi = [
  {
    name: "isAvailable",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getPrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "duration", type: "uint64" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "resolver", type: "address" },
      { name: "duration", type: "uint64" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    name: "renew",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "duration", type: "uint64" },
    ],
    outputs: [],
  },
  {
    name: "NameRegistered",
    type: "event",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "label", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: false },
      { name: "duration", type: "uint64", indexed: false },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  {
    name: "NameRenewed",
    type: "event",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "label", type: "string", indexed: false },
      { name: "duration", type: "uint64", indexed: false },
      { name: "newExpiry", type: "uint64", indexed: false },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
] as const;

/** IPermissionedRegistry.Status enum values. */
export const Status = {
  AVAILABLE: 0,
  RESERVED: 1,
  REGISTERED: 2,
} as const;
