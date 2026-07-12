/**
 * Label / name hashing helpers.
 * ENSv2 registries key names by labelhash-derived ids; the lower 32 bits of a
 * token/resource id are a version counter (LibLabel.withVersion), so ids must
 * be canonicalized (version bits zeroed) before comparing across events.
 */

import { keccak256, namehash, toHex } from "viem";

const VERSION_MASK = (1n << 32n) - 1n;

/** uint256 labelhash id for a label, as the registry functions expect. */
export function labelhashId(label: string): bigint {
  return BigInt(keccak256(toHex(label)));
}

/** Zero the 32 version bits so token ids from different incarnations compare equal. */
export function canonicalId(anyId: bigint): bigint {
  return anyId & ~VERSION_MASK;
}

/** Full name for a label under a parent (e.g. fqdn('alice', 'nick.eth') = 'alice.nick.eth'). */
export function fqdn(label: string, parentName: string): string {
  return `${label}.${parentName}`;
}

/** Resolver node (namehash) for a subname. */
export function subnameNode(label: string, parentName: string): `0x${string}` {
  return namehash(fqdn(label, parentName));
}

/**
 * Light label validation for UI input. Not full ENSIP-15; catches the
 * mistakes a person actually makes in a text field.
 */
export function normalizeLabel(input: string): { label?: string; error?: string } {
  const label = input.trim().toLowerCase();
  if (label.length === 0) return { error: "Enter a label." };
  if (label.includes(".")) return { error: "Just the label, without dots (e.g. 'alice', not 'alice.eth')." };
  if (/\s/.test(label)) return { error: "Labels cannot contain spaces." };
  if (!/^[a-z0-9-_]+$/.test(label)) {
    return { error: "Use lowercase letters, digits, hyphens, or underscores." };
  }
  return { label };
}

/** Strip a trailing .eth if present; returns the 2LD label. */
export function parentLabelFromName(name: string): string {
  return name.toLowerCase().replace(/\.eth$/, "");
}
