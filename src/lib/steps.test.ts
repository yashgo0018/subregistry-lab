import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { getPreset, DANGEROUS_ROOT_BITMAP, MAX_EXPIRY } from "./presets";
import {
  buildDirectRegisterStep,
  buildLockParentLinkStep,
  buildRegistrarRegisterSteps,
  buildRevokeRegistryRolesStep,
  buildSetupSteps,
  type StepCtx,
} from "./steps";
import { ROLE_SET_SUBREGISTRY, adminOf } from "./roles";
import { deployments } from "../config/deployments";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;
const REGISTRY = "0x2222222222222222222222222222222222222222" as Address;
const RESOLVER = "0x3333333333333333333333333333333333333333" as Address;
const REGISTRAR = "0x4444444444444444444444444444444444444444" as Address;

function baseCtx(overrides: Partial<StepCtx> = {}): StepCtx {
  return {
    account: ACCOUNT,
    parentLabel: "nick",
    ownerInitBitmap: getPreset("fully-controlled").ownerInitBitmap,
    deployResolver: true,
    ...overrides,
  };
}

describe("buildSetupSteps", () => {
  it("has the full ordered step list", () => {
    expect(buildSetupSteps("standard-rentable").map((s) => s.id)).toEqual([
      "deploy-registry",
      "deploy-resolver",
      "link",
      "set-parent",
      "deploy-registrar",
      "grant-registrar",
    ]);
  });

  it("set-parent records the ETHRegistry as parent and verifies via getParent", async () => {
    const step = buildSetupSteps("fully-controlled").find((s) => s.id === "set-parent")!;
    const ctx = baseCtx({ userRegistry: REGISTRY });
    const action = step.build(ctx);
    if (action.type !== "write") throw new Error("expected write");
    expect(action.address).toBe(REGISTRY);
    expect(action.functionName).toBe("setParent");
    expect(action.args).toEqual([deployments.ETHRegistry, "nick"]);

    const good = await step.verify!(async () => [deployments.ETHRegistry, "nick"], ctx);
    expect(good.ok).toBe(true);
    const bad = await step.verify!(async () => [deployments.ETHRegistry, "other"], ctx);
    expect(bad.ok).toBe(false);
  });

  it("registrar steps skip when no registrar params in ctx", () => {
    const steps = buildSetupSteps("fully-controlled");
    const ctx = baseCtx(); // no registrarParams
    expect(steps.find((s) => s.id === "deploy-registrar")!.skipIf!(ctx)).toBe(true);
    expect(steps.find((s) => s.id === "grant-registrar")!.skipIf!(ctx)).toBe(true);
    expect(steps.find((s) => s.id === "deploy-registry")!.skipIf).toBeUndefined();
  });

  it("resolver step skips when deployResolver=false", () => {
    const steps = buildSetupSteps("fully-controlled");
    expect(steps.find((s) => s.id === "deploy-resolver")!.skipIf!(baseCtx({ deployResolver: false }))).toBe(true);
  });

  it("deploy-registry targets the factory with fresh salts per build", () => {
    const step = buildSetupSteps("fully-controlled")[0];
    const a = step.build(baseCtx());
    const b = step.build(baseCtx());
    if (a.type !== "write" || b.type !== "write") throw new Error("expected writes");
    expect(a.address).toBe(deployments.VerifiableFactory);
    expect(a.functionName).toBe("deployProxy");
    // args: [impl, salt, initData] - salt differs between attempts
    expect(a.args[0]).toBe(deployments.UserRegistryImpl);
    expect(a.args[1]).not.toBe(b.args[1]);
  });

  it("link step threads the deployed registry through ctx", () => {
    const step = buildSetupSteps("fully-controlled").find((s) => s.id === "link")!;
    const action = step.build(baseCtx({ userRegistry: REGISTRY }));
    if (action.type !== "write") throw new Error("expected write");
    expect(action.address).toBe(deployments.ETHRegistry);
    expect(action.functionName).toBe("setSubregistry");
    expect(action.args[1]).toBe(REGISTRY);
  });

  it("link verify reads back the subregistry pointer", async () => {
    const step = buildSetupSteps("fully-controlled").find((s) => s.id === "link")!;
    const read = async () => REGISTRY;
    const res = await step.verify!(read, baseCtx({ userRegistry: REGISTRY }));
    expect(res.ok).toBe(true);
    const bad = await step.verify!(async () => RESOLVER, baseCtx({ userRegistry: REGISTRY }));
    expect(bad.ok).toBe(false);
  });

  it("grant step grants the preset bitmap to the deployed registrar", () => {
    const preset = getPreset("standard-rentable");
    const ctx = baseCtx({
      userRegistry: REGISTRY,
      registrar: REGISTRAR,
      registrarParams: {
        pricePerYear: preset.registrar!.pricePerYear,
        minDuration: preset.registrar!.minDuration,
        beneficiary: ACCOUNT,
        grantBitmap: preset.registrar!.grantBitmap,
      },
    });
    const step = buildSetupSteps(preset).find((s) => s.id === "grant-registrar")!;
    const action = step.build(ctx);
    if (action.type !== "write") throw new Error("expected write");
    expect(action.address).toBe(REGISTRY);
    expect(action.args).toEqual([preset.registrar!.grantBitmap, REGISTRAR]);
  });
});

describe("action builders", () => {
  it("direct register passes max expiry through", () => {
    const [step] = buildDirectRegisterStep({
      userRegistry: REGISTRY,
      label: "perma",
      owner: ACCOUNT,
      resolver: RESOLVER,
      roleBitmap: 1n,
      expiry: MAX_EXPIRY,
    });
    const action = step.build({} as StepCtx);
    if (action.type !== "write") throw new Error("expected write");
    expect(action.functionName).toBe("register");
    expect(action.args[5]).toBe(MAX_EXPIRY);
  });

  it("registrar register inserts approve only when allowance is short", () => {
    const params = {
      registrar: REGISTRAR,
      userRegistry: REGISTRY,
      label: "alice",
      owner: ACCOUNT,
      resolver: RESOLVER,
      duration: 365n * 86400n,
      price: 5_000_000n,
      currentAllowance: 0n,
    };
    const short = buildRegistrarRegisterSteps(params);
    expect(short[0].skipIf!({} as StepCtx)).toBe(false);
    const covered = buildRegistrarRegisterSteps({ ...params, currentAllowance: 5_000_000n });
    expect(covered[0].skipIf!({} as StepCtx)).toBe(true);
  });

  it("revoke-registry-roles revokes the dangerous bitmap from the account", () => {
    const [step] = buildRevokeRegistryRolesStep({ userRegistry: REGISTRY, account: ACCOUNT });
    const action = step.build({} as StepCtx);
    if (action.type !== "write") throw new Error("expected write");
    expect(action.functionName).toBe("revokeRootRoles");
    expect(action.args).toEqual([DANGEROUS_ROOT_BITMAP, ACCOUNT]);
  });

  it("lock-parent-link uses the pre-read resource, not the canonical id", () => {
    const resource = 777n;
    const [step] = buildLockParentLinkStep({
      parentLabel: "nick",
      parentResource: resource,
      account: ACCOUNT,
    });
    const action = step.build({} as StepCtx);
    if (action.type !== "write") throw new Error("expected write");
    expect(action.functionName).toBe("revokeRoles");
    expect(action.args[0]).toBe(resource);
    expect(action.args[1]).toBe(ROLE_SET_SUBREGISTRY | adminOf(ROLE_SET_SUBREGISTRY));
  });

  it("lock verify reports ok only when roles are gone", async () => {
    const [step] = buildRevokeRegistryRolesStep({ userRegistry: REGISTRY, account: ACCOUNT });
    expect((await step.verify!(async () => false, {} as StepCtx)).ok).toBe(true);
    expect((await step.verify!(async () => true, {} as StepCtx)).ok).toBe(false);
  });
});
