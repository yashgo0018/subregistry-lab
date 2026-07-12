import { describe, expect, it } from "vitest";
import { etherscanAddress, etherscanTx, explorerName, explorerRegistry } from "./links";

describe("links", () => {
  it("builds explorer and etherscan urls", () => {
    expect(explorerName("nick.eth")).toBe("https://explorer.ens.dev/nick.eth");
    expect(explorerRegistry("nick.eth")).toBe("https://explorer.ens.dev/nick.eth/registry");
    expect(etherscanAddress("0xabc")).toBe("https://sepolia.etherscan.io/address/0xabc");
    expect(etherscanTx("0xdef")).toBe("https://sepolia.etherscan.io/tx/0xdef");
  });
});
