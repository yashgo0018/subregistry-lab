/**
 * ENSv2 Sepolia deployment addresses.
 *
 * Source of truth: the Sepolia (ENSv2 Beta) set on docs.ens.domains, which
 * tracks contracts-v2 `contracts/deployments/sepolia` (2026-07-30, commit
 * 97a57293f3b4279d94b571e678edb53ce62638f4). Edit here when deployments move.
 * ABI artifacts: https://github.com/ensdomains/contracts-v2/tree/97a57293f3b4279d94b571e678edb53ce62638f4/contracts/deployments/sepolia
 */

export const deployments = {
  ETHRegistry: "0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2",
  ETHRegistrar: "0xa88553F454b77203B0D036A05c894d555EAAa2Cc",
  StandardRentPriceOracle: "0x8914b66260EB8C4fff795650c3AE8Cd335958987",
  VerifiableFactory: "0x10dC6333CDFe1FCEf624c6e0a8221b91804Cd7ef",
  UserRegistryImpl: "0x624a25d67B59D587752EbEc8DdeD8827dAe52050",
  PermissionedResolverImpl: "0x9EAe5C2730a7dD16BDD1DeE6421a1B91e3B0365e",
  MockUSDC: "0x768F42455A2D082E23ceeF7d51e5787C82d67a39",
  MockDAI: "0x5472C5725A00B7bA11F0794A79D08ade6F4683bD",
  /** UniversalResolverV2 implementation (docs name). */
  UniversalResolverV2: "0x4A1817d13E9cF196f471725176355C1234b63C70",
  /**
   * Public resolve entrypoint used by the ENS App and viem: the
   * UpgradableUniversalResolverProxy, which delegates to UniversalResolverV2.
   */
  UniversalResolver: "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe",
} as const;

/** Block in which VerifiableFactory was deployed; factory log scans start here. */
export const FACTORY_DEPLOY_BLOCK = 11383823n;

/** Block in which ETHRegistry was deployed; owned-name log scans start here. */
export const ETH_REGISTRY_DEPLOY_BLOCK = 11383897n;

/**
 * RPC used for log scans: Tenderly's public gateway accepts full-range
 * eth_getLogs (verified), so a whole scan is one request per event type.
 * The wagmi transports (drpc/publicnode) cap or reject historical getLogs.
 */
export const LOG_SCAN_RPC = "https://sepolia.gateway.tenderly.co";

/**
 * Chunk size for the fallback scan via the wagmi transport if the scan RPC
 * is down. drpc's free tier rejects ranges over 10000 blocks.
 */
export const LOG_CHUNK_SIZE = 9_999n;
