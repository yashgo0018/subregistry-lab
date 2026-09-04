import { describe, expect, it } from "vitest";
import {
  ETH_REGISTRY_DEPLOY_BLOCK,
  FACTORY_DEPLOY_BLOCK,
  deployments,
} from "./deployments";

/** Golden addresses from docs.ens.domains Sepolia (ENSv2 Beta), 2026-07-30. */
describe("Sepolia ENSv2 Beta deployments", () => {
  it("matches the official July 2026 contract set", () => {
    expect(deployments.ETHRegistry).toBe("0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2");
    expect(deployments.ETHRegistrar).toBe("0xa88553F454b77203B0D036A05c894d555EAAa2Cc");
    expect(deployments.VerifiableFactory).toBe(
      "0x10dC6333CDFe1FCEf624c6e0a8221b91804Cd7ef",
    );
    expect(deployments.UserRegistryImpl).toBe(
      "0x624a25d67B59D587752EbEc8DdeD8827dAe52050",
    );
    expect(deployments.PermissionedResolverImpl).toBe(
      "0x9EAe5C2730a7dD16BDD1DeE6421a1B91e3B0365e",
    );
    expect(deployments.MockUSDC).toBe("0x768F42455A2D082E23ceeF7d51e5787C82d67a39");
    expect(deployments.UniversalResolverV2).toBe(
      "0x4A1817d13E9cF196f471725176355C1234b63C70",
    );
    expect(deployments.UniversalResolver).toBe(
      "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe",
    );
  });

  it("scan start blocks are the factory then ETHRegistry creation blocks", () => {
    expect(FACTORY_DEPLOY_BLOCK).toBe(11383823n);
    expect(ETH_REGISTRY_DEPLOY_BLOCK).toBe(11383897n);
    expect(FACTORY_DEPLOY_BLOCK).toBeLessThan(ETH_REGISTRY_DEPLOY_BLOCK);
  });
});
