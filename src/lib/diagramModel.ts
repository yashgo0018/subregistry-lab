/**
 * Maps a subregistry setup onto the diagram builder's node/edge model
 * (read-only visualization). Layout is deterministic: fixed columns,
 * rows derived from content, so snapshots are stable.
 */

import type { DiagramEdge, DiagramNode, DiagramState } from "../diagram/types";
import { decomposeBitmap } from "./roles";

export type SetupView = {
  parentName: string; // e.g. "nick.eth"
  parentOwner?: string;
  userRegistry?: string;
  registrar?: string;
  resolver?: string;
  /** Roles the registrar holds on the registry root. */
  registrarRoles?: bigint;
  /** True once dangerous root roles were revoked. */
  locked?: boolean;
  subnames?: { label: string; neverExpires?: boolean }[];
};

function shortAddr(addr?: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const COL = { left: 0, mid: 320, right: 640 };
const ROW = 130;

export function toDiagram(setup: SetupView): DiagramState {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  // .eth registry (top root)
  nodes.push({
    id: "eth-registry",
    type: "root",
    position: { x: COL.left, y: 0 },
    data: { label: ".eth registry", variant: "blue" },
  });

  // parent name
  nodes.push({
    id: "parent",
    type: "action",
    position: { x: COL.left, y: ROW },
    data: { label: setup.parentName, variant: "blue" },
  });
  edges.push({
    id: "e-eth-parent",
    source: "eth-registry",
    target: "parent",
  });

  if (setup.userRegistry) {
    nodes.push({
      id: "user-registry",
      type: "registry",
      position: { x: COL.mid, y: ROW },
      data: {
        label: setup.locked ? "SUBNAME REGISTRY (LOCKED)" : "SUBNAME REGISTRY",
        subtitle: shortAddr(setup.userRegistry),
      },
    });
    edges.push({
      id: "e-parent-registry",
      source: "parent",
      target: "user-registry",
      label: "subregistry",
    });
  }

  if (setup.registrar && setup.userRegistry) {
    const roleBadges = setup.registrarRoles
      ? decomposeBitmap(setup.registrarRoles)
          .filter((r) => !r.isAdmin)
          .map((r) => r.short)
          .join(" + ")
      : "";
    nodes.push({
      id: "registrar",
      type: "gateway",
      position: { x: COL.mid, y: 0 },
      data: { label: "REGISTRAR", id: shortAddr(setup.registrar) },
    });
    edges.push({
      id: "e-registrar-registry",
      source: "registrar",
      target: "user-registry",
      label: roleBadges || undefined,
    });
  }

  if (setup.resolver) {
    nodes.push({
      id: "resolver",
      type: "resolver",
      position: { x: COL.right, y: 0 },
      data: { label: "Resolver", owner: shortAddr(setup.parentOwner) },
    });
  }

  (setup.subnames ?? []).forEach((sub, i) => {
    const id = `sub-${sub.label}`;
    nodes.push({
      id,
      type: "action",
      position: { x: COL.mid + 160, y: ROW * (2 + i) },
      data: {
        label: `${sub.label}.${setup.parentName}${sub.neverExpires ? " ∞" : ""}`,
        variant: "blue",
      },
    });
    edges.push({
      id: `e-registry-${id}`,
      source: "user-registry",
      target: id,
    });
    if (setup.resolver) {
      edges.push({
        id: `e-${id}-resolver`,
        source: id,
        target: "resolver",
        label: "resolver",
      });
    }
  });

  return { nodes, edges };
}
