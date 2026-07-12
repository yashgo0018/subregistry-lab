/**
 * ENSv2 Sepolia deployment addresses.
 *
 * Source of truth: the `sepolia-official-v1-20260525-r2` deployment set in
 * ensdomains/contracts-v2 (the same set shown on docs.ens.domains and tracked
 * by ensjs v2). Edit here when deployments move.
 * ABI artifacts: https://github.com/ensdomains/contracts-v2/tree/main/contracts/deployments/sepolia-official-v1-20260525-r2
 */

export const deployments = {
  ETHRegistry: "0xDEDB92913A25abE1f7BCDD85D8A344a43B398B67",
  ETHRegistrar: "0x8c2E866B439358c41AE05De9cbE8A00BFEFafFcA",
  StandardRentPriceOracle: "0xe19D37839F42F7d2694D8C5712f412C66A218161",
  VerifiableFactory: "0xD2a632D8a8b67c2c4398c255CbD7aF8dd7236198",
  UserRegistryImpl: "0x0F99e7Ea74903AfCB7224d0354fD7428A6f92917",
  PermissionedResolverImpl: "0xdcE5205A553573FFd47629327DDdf36186022FfA",
  MockUSDC: "0xBA11ebdB3f9a2c5946D8629517f06364E53A2E10",
  MockDAI: "0x2922bCD677Af690fCD1eCC699519e4bfabc73ff8",
  /** Universal Resolver for resolve checks (from the same deployment era). */
  UniversalResolverV2: "0x2f8a180604c42457cb56c7c4f708748ff1f91df1",
} as const;

/** Block in which ETHRegistry was deployed; owned-name log scans start here. */
export const ETH_REGISTRY_DEPLOY_BLOCK = 10921984n;

/** Initial getLogs chunk size; halved automatically on RPC range errors. */
export const LOG_CHUNK_SIZE = 50_000n;
