import { describe, expect, it } from "vitest";
import { toDiagram } from "./diagramModel";
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

    // each subname resolves through the resolver
    expect(d.edges.filter((e) => e.id.endsWith("-resolver"))).toHaveLength(2);
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
