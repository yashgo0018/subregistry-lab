import { describe, expect, it } from "vitest";
import {
  DANGEROUS_ROOT_BITMAP,
  MAX_EXPIRY,
  PRESETS,
  SUBNAME_MINIMAL_BITMAP,
  SUBNAME_OWNER_BITMAP,
  getPreset,
} from "./presets";
import {
  ALL_ROLES,
  ROLE_REGISTRAR,
  ROLE_RENEW,
  ROLE_SET_RESOLVER,
  ROLE_SET_SUBREGISTRY,
  ROLE_UNREGISTER,
  ROLE_UPGRADE,
  ROLE_CAN_TRANSFER_ADMIN,
  adminOf,
} from "./roles";

describe("presets", () => {
  it("golden bitmap: subname owner mirrors ETHRegistrar's REGISTRATION_ROLE_BITMAP", () => {
    const expected =
      ROLE_SET_SUBREGISTRY |
      adminOf(ROLE_SET_SUBREGISTRY) |
      ROLE_SET_RESOLVER |
      adminOf(ROLE_SET_RESOLVER) |
      ROLE_CAN_TRANSFER_ADMIN;
    expect(SUBNAME_OWNER_BITMAP).toBe(expected);
    // Exact hex golden value (bits 148,152,156 admin-half; bits 20,24 user-half):
    expect(`0x${SUBNAME_OWNER_BITMAP.toString(16)}`).toBe(
      "0x1110000000000000000000000000000001100000",
    );
  });

  it("minimal subname bitmap is records-only", () => {
    expect(SUBNAME_MINIMAL_BITMAP).toBe(ROLE_SET_RESOLVER | adminOf(ROLE_SET_RESOLVER));
  });

  it("dangerous bitmap includes deletion/restructuring but never REGISTRAR", () => {
    expect(DANGEROUS_ROOT_BITMAP & ROLE_UNREGISTER).toBe(ROLE_UNREGISTER);
    expect(DANGEROUS_ROOT_BITMAP & ROLE_SET_SUBREGISTRY).toBe(ROLE_SET_SUBREGISTRY);
    expect(DANGEROUS_ROOT_BITMAP & ROLE_RENEW).toBe(ROLE_RENEW);
    expect(DANGEROUS_ROOT_BITMAP & ROLE_UPGRADE).toBe(ROLE_UPGRADE);
    expect(DANGEROUS_ROOT_BITMAP & adminOf(ROLE_UNREGISTER)).toBe(adminOf(ROLE_UNREGISTER));
    expect(DANGEROUS_ROOT_BITMAP & ROLE_REGISTRAR).toBe(0n);
    expect(DANGEROUS_ROOT_BITMAP & adminOf(ROLE_REGISTRAR)).toBe(0n);
  });

  it("all three presets exist with sane fields", () => {
    expect(PRESETS.map((p) => p.id).sort()).toEqual([
      "fully-controlled",
      "standard-rentable",
      "unruggable",
    ]);
    for (const p of PRESETS) {
      expect(p.ownerInitBitmap).toBe(ALL_ROLES);
      expect(p.subnameDefaults.roleBitmap).toBeGreaterThan(0n);
    }
  });

  it("standard-rentable grants exactly REGISTRAR|RENEW to the registrar", () => {
    const p = getPreset("standard-rentable");
    expect(p.registrar?.grantBitmap).toBe(ROLE_REGISTRAR | ROLE_RENEW);
    expect(p.registrar?.pricePerYear).toBe(5_000_000n);
  });

  it("unruggable uses max expiry, minimal subname roles, and a lock plan", () => {
    const p = getPreset("unruggable");
    expect(p.subnameDefaults.expiry).toBe("max");
    expect(p.subnameDefaults.roleBitmap).toBe(SUBNAME_MINIMAL_BITMAP);
    expect(p.lockPlan?.map((s) => s.id)).toEqual([
      "revoke-registry-roles",
      "lock-parent-link",
    ]);
    expect(MAX_EXPIRY).toBe(18446744073709551615n); // type(uint64).max
  });
});
