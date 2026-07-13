import { describe, expect, it } from "vitest";
import {
  MAX_FOREIGN_RESOLVER_NODES,
  classifyResolver,
  toDiagram,
} from "./diagramModel";
import { ROLE_REGISTRAR, ROLE_RENEW } from "./roles";

describe("toDiagram", () => {
  it("minimal setup: just the parent chain", () => {
    const d = toDiagram({ parentName: "nick.eth" });
    expect(d.nodes.map((n) => n.id)).toEqual(["eth-registry", "parent"]);
    expect(d.edges).toHaveLength(1);
  });

  it("full setup renders registry, registrar with role badges, resolver, subnames", () => {
    const d = toDiagram({
      parentName: "nick.eth",
      parentOwner: "0x1111111111111111111111111111111111111111",
      userRegistry: "0x2222222222222222222222222222222222222222",
      registrar: "0x4444444444444444444444444444444444444444",
      registrarRoles: ROLE_REGISTRAR | ROLE_RENEW,
      resolver: "0x3333333333333333333333333333333333333333",
      subnames: [{ label: "alice" }, { label: "perma", neverExpires: true }],
    });
    const ids = d.nodes.map((n) => n.id);
    expect(ids).toContain("user-registry");
    expect(ids).toContain("registrar");
    expect(ids).toContain("resolver");
    expect(ids).toContain("sub-alice");
    expect(ids).toContain("sub-perma");

    const registrarEdge = d.edges.find((e) => e.id === "e-registrar-registry");
    expect(registrarEdge?.label).toBe("REGISTRAR + RENEW");

    const perma = d.nodes.find((n) => n.id === "sub-perma");
    expect((perma?.data as { label: string }).label).toContain("∞");

    // records live on the resolver: one registry->resolver edge
    const recordsEdge = d.edges.find((e) => e.id === "e-registry-resolver");
    expect(recordsEdge?.label).toBe("records");
  });

  it("placeholders render as-is; real addresses are shortened", () => {
    const d = toDiagram({
      parentName: "nick.eth",
      userRegistry: "new",
      registrar: "new",
      registrarRoles: ROLE_REGISTRAR,
    });
    const reg = d.nodes.find((n) => n.id === "user-registry");
    expect((reg?.data as { subtitle: string }).subtitle).toBe("new");
    const registrar = d.nodes.find((n) => n.id === "registrar");
    expect((registrar?.data as { id: string }).id).toBe("new");

    const real = toDiagram({
      parentName: "nick.eth",
      userRegistry: "0x2222222222222222222222222222222222222222",
    });
    const regReal = real.nodes.find((n) => n.id === "user-registry");
    expect((regReal?.data as { subtitle: string }).subtitle).toBe("0x2222…2222");
  });

  it("no registrar node when absent, locked flag changes registry label", () => {
    const d = toDiagram({
      parentName: "nick.eth",
      userRegistry: "0x2222222222222222222222222222222222222222",
      locked: true,
    });
    expect(d.nodes.find((n) => n.id === "registrar")).toBeUndefined();
    const reg = d.nodes.find((n) => n.id === "user-registry");
    expect((reg?.data as { label: string }).label).toContain("LOCKED");
  });

  it("is deterministic", () => {
    const setup = {
      parentName: "nick.eth",
      userRegistry: "0x2222222222222222222222222222222222222222",
      subnames: [{ label: "a" }, { label: "b" }],
    };
    expect(JSON.stringify(toDiagram(setup))).toBe(JSON.stringify(toDiagram(setup)));
  });
});

describe("classifyResolver", () => {
  const DEFAULT = "0x3333333333333333333333333333333333333333";

  it("none: undefined, empty, or the zero address", () => {
    expect(classifyResolver(undefined, DEFAULT)).toBe("none");
    expect(classifyResolver("", DEFAULT)).toBe("none");
    expect(
      classifyResolver("0x0000000000000000000000000000000000000000", DEFAULT),
    ).toBe("none");
  });

  it("default: matches the shared resolver case-insensitively", () => {
    expect(classifyResolver(DEFAULT, DEFAULT)).toBe("default");
    expect(classifyResolver(DEFAULT.toUpperCase().replace("0X", "0x"), DEFAULT)).toBe(
      "default",
    );
  });

  it("foreign: any other non-zero address, or anything when no default exists", () => {
    expect(
      classifyResolver("0x9999999999999999999999999999999999999999", DEFAULT),
    ).toBe("foreign");
    expect(classifyResolver(DEFAULT, undefined)).toBe("foreign");
  });

  it("a zero-address default never matches", () => {
    expect(
      classifyResolver(DEFAULT, "0x0000000000000000000000000000000000000000"),
    ).toBe("foreign");
  });
});

describe("toDiagram shared resolver from the parent pointer", () => {
  it("a zero-address shared resolver draws no resolver node", () => {
    const d = toDiagram({
      parentName: "nick.eth",
      userRegistry: "0x2222222222222222222222222222222222222222",
      resolver: "0x0000000000000000000000000000000000000000",
      subnames: [{ label: "alice" }],
    });
    expect(d.nodes.find((n) => n.id === "resolver")).toBeUndefined();
    expect(d.edges.find((e) => e.id === "e-registry-resolver")).toBeUndefined();
  });
});

describe("toDiagram foreign resolvers", () => {
  const BASE = {
    parentName: "nick.eth",
    userRegistry: "0x2222222222222222222222222222222222222222",
    resolver: "0x3333333333333333333333333333333333333333",
  };
  const FOREIGN = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  it("a deviating subname gets its own resolver node plus a records edge", () => {
    const d = toDiagram({
      ...BASE,
      subnames: [
        { label: "alice", resolver: BASE.resolver },
        { label: "bob", resolver: FOREIGN },
      ],
    });
    const node = d.nodes.find((n) => n.id === `resolver-${FOREIGN.toLowerCase()}`);
    expect(node).toBeDefined();
    expect((node?.data as { foreign?: boolean }).foreign).toBe(true);
    const edge = d.edges.find((e) => e.id === "e-sub-bob-resolver");
    expect(edge?.source).toBe("sub-bob");
    expect(edge?.target).toBe(node?.id);
    expect(edge?.label).toBe("records");
    // alice stays on the shared resolver: no per-sub edge for her
    expect(d.edges.find((e) => e.id === "e-sub-alice-resolver")).toBeUndefined();
  });

  it("aggregate registry->resolver edge relabels once any subname deviates", () => {
    const all = toDiagram({
      ...BASE,
      subnames: [{ label: "alice", resolver: BASE.resolver }],
    });
    expect(all.edges.find((e) => e.id === "e-registry-resolver")?.label).toBe("records");

    const mixed = toDiagram({
      ...BASE,
      subnames: [
        { label: "alice", resolver: BASE.resolver },
        { label: "bob", resolver: FOREIGN },
      ],
    });
    expect(mixed.edges.find((e) => e.id === "e-registry-resolver")?.label).toBe(
      "default records",
    );
  });

  it("subnames without a resolver get the ∅ marker", () => {
    const d = toDiagram({
      ...BASE,
      subnames: [
        { label: "bare" },
        { label: "zero", resolver: "0x0000000000000000000000000000000000000000" },
        { label: "alice", resolver: BASE.resolver },
      ],
    });
    const label = (id: string) =>
      (d.nodes.find((n) => n.id === id)?.data as { label: string }).label;
    expect(label("sub-bare")).toContain("∅");
    expect(label("sub-zero")).toContain("∅");
    expect(label("sub-alice")).not.toContain("∅");
  });

  it("two subnames sharing a foreign resolver share one node with two edges", () => {
    const d = toDiagram({
      ...BASE,
      subnames: [
        { label: "bob", resolver: FOREIGN },
        // same address, different casing: must dedupe
        { label: "carol", resolver: FOREIGN.toLowerCase() },
      ],
    });
    const foreignNodes = d.nodes.filter((n) => n.id.startsWith("resolver-0x"));
    expect(foreignNodes).toHaveLength(1);
    const incoming = d.edges.filter((e) => e.target === foreignNodes[0].id);
    expect(incoming.map((e) => e.source).sort()).toEqual(["sub-bob", "sub-carol"]);
    // converging edges carry the "records" label only once
    expect(incoming.filter((e) => e.label === "records")).toHaveLength(1);
  });

  it("caps dedicated nodes and aggregates the distinct overflow", () => {
    const subs = Array.from({ length: MAX_FOREIGN_RESOLVER_NODES + 2 }, (_, i) => ({
      label: `s${i}`,
      resolver: `0x${String(i + 1).padStart(40, "0")}`,
    }));
    // duplicate of an overflow address must not inflate the "+N more" count
    subs.push({ label: "dupe", resolver: subs[subs.length - 1].resolver });
    const d = toDiagram({ ...BASE, subnames: subs });

    const dedicated = d.nodes.filter((n) => n.id.startsWith("resolver-0x"));
    expect(dedicated).toHaveLength(MAX_FOREIGN_RESOLVER_NODES);

    const more = d.nodes.find((n) => n.id === "resolver-more");
    expect((more?.data as { label: string }).label).toBe("+2 more");
    // all three overflow subnames (2 distinct + 1 dupe) route to the shared node
    expect(d.edges.filter((e) => e.target === "resolver-more")).toHaveLength(3);
  });

  it("foreign resolver nodes sit right of the subnames and never stack", () => {
    const d = toDiagram({
      ...BASE,
      subnames: [
        // three adjacent rows, each with a distinct foreign resolver: boxes
        // are taller than a subname row, so naive row alignment would overlap
        { label: "a", resolver: "0x1111111111111111111111111111111111111111" },
        { label: "b", resolver: "0x2222222222222222222222222222222222222223" },
        { label: "c", resolver: "0x4444444444444444444444444444444444444444" },
      ],
    });
    const subXs = d.nodes.filter((n) => n.id.startsWith("sub-")).map((n) => n.position.x);
    const foreign = d.nodes.filter((n) => n.id.startsWith("resolver-0x"));
    for (const f of foreign) {
      expect(f.position.x).toBeGreaterThan(Math.max(...subXs) + 200);
    }
    const ys = foreign.map((f) => f.position.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(100);
    }
  });

  it("shared resolver affinities cover the parent and non-foreign subnames", () => {
    const d = toDiagram({
      ...BASE,
      subnames: [
        { label: "alice", resolver: BASE.resolver }, // default: explicit pointer
        { label: "bare" }, // none: falls back to the shared resolver
        { label: "bob", resolver: FOREIGN }, // foreign: its own resolver wins
      ],
    });
    const related = d.affinities?.["resolver"] ?? [];
    expect(related).toContain("parent");
    expect(related).toContain("sub-alice");
    expect(related).toContain("sub-bare");
    expect(related).not.toContain("sub-bob");
    // symmetric: hovering a served subname relates back to the resolver
    expect(d.affinities?.["sub-bare"]).toContain("resolver");
    expect(d.affinities?.["sub-bob"]).toBeUndefined();
  });

  it("no affinities without a shared resolver", () => {
    const d = toDiagram({
      parentName: "nick.eth",
      userRegistry: "0x2222222222222222222222222222222222222222",
      subnames: [{ label: "bare" }],
    });
    expect(d.affinities).toEqual({});
  });

  it("no foreign machinery when everyone uses the shared resolver", () => {
    const d = toDiagram({
      ...BASE,
      subnames: [
        { label: "alice", resolver: BASE.resolver },
        { label: "bob", resolver: BASE.resolver.toUpperCase().replace("0X", "0x") },
      ],
    });
    expect(d.nodes.some((n) => n.id.startsWith("resolver-0x"))).toBe(false);
    expect(d.nodes.some((n) => n.id === "resolver-more")).toBe(false);
    expect(d.edges.find((e) => e.id === "e-registry-resolver")?.label).toBe("records");
  });
});
