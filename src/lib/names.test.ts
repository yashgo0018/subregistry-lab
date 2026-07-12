import { describe, expect, it } from "vitest";
import { keccak256, namehash, toHex } from "viem";
import {
  canonicalId,
  fqdn,
  labelhashId,
  normalizeLabel,
  parentLabelFromName,
  subnameNode,
} from "./names";

describe("names", () => {
  it("labelhashId matches keccak256 of the label bytes", () => {
    expect(labelhashId("mycoolnewname")).toBe(BigInt(keccak256(toHex("mycoolnewname"))));
  });

  it("canonicalId masks exactly the lower 32 bits", () => {
    const id = labelhashId("alice");
    const versioned = (id & ~((1n << 32n) - 1n)) | 0x12345678n;
    expect(canonicalId(versioned)).toBe(canonicalId(id));
    expect(canonicalId(id) & ((1n << 32n) - 1n)).toBe(0n);
    // bit 32 must survive
    expect(canonicalId(1n << 32n)).toBe(1n << 32n);
  });

  it("fqdn + subnameNode agree with viem namehash", () => {
    expect(fqdn("alice", "nick.eth")).toBe("alice.nick.eth");
    expect(subnameNode("alice", "nick.eth")).toBe(namehash("alice.nick.eth"));
  });

  it("normalizeLabel accepts good labels and trims/lowers", () => {
    expect(normalizeLabel("  Alice ")).toEqual({ label: "alice" });
    expect(normalizeLabel("a-b_c123")).toEqual({ label: "a-b_c123" });
  });

  it("normalizeLabel rejects dots, spaces, and weird chars", () => {
    expect(normalizeLabel("alice.eth").error).toBeTruthy();
    expect(normalizeLabel("al ice").error).toBeTruthy();
    expect(normalizeLabel("").error).toBeTruthy();
    expect(normalizeLabel("Ali!ce").error).toBeTruthy();
  });

  it("parentLabelFromName strips .eth", () => {
    expect(parentLabelFromName("Nick.eth")).toBe("nick");
    expect(parentLabelFromName("nick")).toBe("nick");
  });
});
