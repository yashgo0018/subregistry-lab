import { describe, expect, it } from "vitest";
import { deriveSalt } from "./salt";

describe("deriveSalt", () => {
  it("deterministic for a fixed nonce", () => {
    expect(deriveSalt("nick", "n1")).toBe(deriveSalt("nick", "n1"));
  });
  it("distinct for distinct nonces and labels", () => {
    expect(deriveSalt("nick", "n1")).not.toBe(deriveSalt("nick", "n2"));
    expect(deriveSalt("nick", "n1")).not.toBe(deriveSalt("bob", "n1"));
  });
  it("random nonce by default", () => {
    expect(deriveSalt("nick")).not.toBe(deriveSalt("nick"));
  });
  it("fits uint256", () => {
    const salt = deriveSalt("nick", "n1");
    expect(salt).toBeGreaterThanOrEqual(0n);
    expect(salt).toBeLessThan(2n ** 256n);
  });
});
