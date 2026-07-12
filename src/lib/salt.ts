/**
 * CREATE2 salt derivation for VerifiableFactory.deployProxy.
 * The factory mixes msg.sender into the salt, but the SAME sender reusing the
 * SAME salt reverts (address collision) - so every deploy attempt derives a
 * fresh salt from a random nonce.
 */

import { keccak256, stringToBytes } from "viem";

export function deriveSalt(
  parentLabel: string,
  nonce: string = crypto.randomUUID(),
): bigint {
  return BigInt(keccak256(stringToBytes(`subregistry-lab:${parentLabel}:${nonce}`)));
}
