import { describe, expect, it } from "vitest";
import {
  ALL_ROLES,
  ROLE_CATALOG,
  ROLE_CAN_TRANSFER_ADMIN,
  ROLE_REGISTRAR,
  ROLE_RENEW,
  ROLE_SET_RESOLVER,
  ROLE_SET_SUBREGISTRY,
  adminOf,
  bitmapHex,
  composeBitmap,
  decomposeBitmap,
  hasAll,
} from "./roles";

describe("role constants", () => {
  // Golden values from RegistryRolesLib.sol (contracts-v2 main @48b3e2d)
  it("matches the contract constants", () => {
    expect(ROLE_REGISTRAR).toBe(1n);
    expect(ROLE_RENEW).toBe(1n << 16n);
    expect(ROLE_SET_SUBREGISTRY).toBe(1n << 20n);
    expect(ROLE_SET_RESOLVER).toBe(1n << 24n);
    expect(ROLE_CAN_TRANSFER_ADMIN).toBe((1n << 28n) << 128n);
  });

  it("adminOf shifts 128 bits", () => {
    expect(adminOf(ROLE_REGISTRAR)).toBe(1n << 128n);
    expect(adminOf(ROLE_RENEW)).toBe(1n << 144n);
  });

  it("ALL_ROLES contains every catalog role and its admin", () => {
    for (const entry of ROLE_CATALOG) {
      expect(ALL_ROLES & entry.bit).toBe(entry.bit);
      if (!entry.adminOnly) {
        expect(ALL_ROLES & adminOf(entry.bit)).toBe(adminOf(entry.bit));
      }
    }
  });

  it("every catalog entry has labels", () => {
    for (const entry of ROLE_CATALOG) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.short.length).toBeGreaterThan(0);
      if (!entry.adminOnly) expect(entry.adminLabel.length).toBeGreaterThan(0);
    }
  });

  it("subname-editor roles carry per-name labels and tooltip details", () => {
    const editorRoles = ["unregister", "renew", "setSubregistry", "setResolver", "canTransferAdmin"];
    for (const id of editorRoles) {
      const entry = ROLE_CATALOG.find((c) => c.id === id)!;
      expect(entry.subnameLabel?.length).toBeGreaterThan(0);
      expect(entry.subnameDetail?.length).toBeGreaterThan(20);
    }
  });
});

describe("compose/decompose", () => {
  it("round-trips", () => {
    const bitmap = composeBitmap([
      { id: "registrar" },
      { id: "renew", admin: true },
      { id: "canTransferAdmin" },
    ]);
    expect(bitmap).toBe(ROLE_REGISTRAR | adminOf(ROLE_RENEW) | ROLE_CAN_TRANSFER_ADMIN);

    const parts = decomposeBitmap(bitmap);
    expect(parts).toHaveLength(3);
    expect(parts.find((p) => p.id === "registrar")?.isAdmin).toBe(false);
    expect(parts.find((p) => p.id === "renew")?.isAdmin).toBe(true);
    expect(parts.find((p) => p.id === "canTransferAdmin")?.isAdmin).toBe(true);
  });

  it("ignores unknown bits (e.g. WAS_RESERVED)", () => {
    const parts = decomposeBitmap(1n << 32n);
    expect(parts).toHaveLength(0);
  });

  it("hasAll", () => {
    const bitmap = ROLE_REGISTRAR | ROLE_RENEW;
    expect(hasAll(bitmap, ROLE_REGISTRAR)).toBe(true);
    expect(hasAll(bitmap, ROLE_REGISTRAR | ROLE_RENEW)).toBe(true);
    expect(hasAll(bitmap, ROLE_SET_RESOLVER)).toBe(false);
  });

  it("bitmapHex pads to 64 nybbles", () => {
    expect(bitmapHex(1n)).toBe(`0x${"0".repeat(63)}1`);
    expect(bitmapHex(ALL_ROLES)).toBe(`0x${"1".repeat(64)}`);
  });
});
