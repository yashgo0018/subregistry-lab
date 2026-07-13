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
  /** Real address, or a short placeholder like "new" for planned contracts. */
  userRegistry?: string;
  registrar?: string;
  resolver?: string;
  /** Roles the registrar holds on the registry root. */
  registrarRoles?: bigint;
  /** True once dangerous root roles were revoked. */
  locked?: boolean;
  subnames?: { label: string; neverExpires?: boolean }[];
};

/** Real addresses render shortened; anything else (e.g. "new") renders as-is. */
function displayAddr(value?: string): string {
  if (!value) return "";
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) {
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
  }
  return value;
}

// Deterministic grid: enough spacing that frames and edge labels never
// collide, but compact enough that fitView can hold multi-subname setups.
const COL = { left: 0, mid: 400, right: 780 };
const ROW = { top: 0, main: 175, subStart: 300 };
const SUB_STEP = 60;

export function toDiagram(setup: SetupView): DiagramState {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  // .eth registry (top root)
  nodes.push({
    id: "eth-registry",
    type: "root",
    position: { x: COL.left, y: ROW.top },
    data: { label: ".eth registry", variant: "blue" },
  });

  // parent name: indented right of the root so the elbow edge's left swing
  // (~20px before the left handle) stays inside the canvas
  nodes.push({
    id: "parent",
    type: "action",
    position: { x: COL.left + 48, y: ROW.main },
    data: { label: setup.parentName, variant: "blue" },
  });
  edges.push({
    id: "e-eth-parent",
    source: "eth-registry",
    target: "parent",
    targetHandle: "left",
  });

  if (setup.userRegistry) {
    nodes.push({
      id: "user-registry",
      type: "registry",
      position: { x: COL.mid, y: ROW.main },
      data: {
        label: setup.locked ? "SUBNAME REGISTRY (LOCKED)" : "SUBNAME REGISTRY",
        subtitle: displayAddr(setup.userRegistry),
      },
    });
    edges.push({
      id: "e-parent-registry",
      source: "parent",
      target: "user-registry",
      targetHandle: "left",
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
      position: { x: COL.mid + 60, y: ROW.top },
      data: { label: "REGISTRAR", id: displayAddr(setup.registrar) },
    });
    edges.push({
      id: "e-registrar-registry",
      source: "registrar",
      target: "user-registry",
      targetHandle: "top",
      label: roleBadges || undefined,
    });
  }

  if (setup.resolver) {
    nodes.push({
      id: "resolver",
      type: "resolver",
      position: { x: COL.right, y: ROW.main },
      data: {
        label: "Resolver",
        owner: displayAddr(setup.parentOwner),
        addr: displayAddr(setup.resolver),
      },
    });
    if (setup.userRegistry) {
      // Subnames in the registry keep their records here.
      edges.push({
        id: "e-registry-resolver",
        source: "user-registry",
        sourceHandle: "right",
        target: "resolver",
        targetHandle: "left",
        label: "records",
      });
    }
  }

  (setup.subnames ?? []).forEach((sub, i) => {
    const id = `sub-${sub.label}`;
    nodes.push({
      id,
      type: "action",
      // Right of the registry's bottom handle: edges route down-then-right
      // into the left handle without S-bends.
      position: { x: COL.mid + 180, y: ROW.subStart + SUB_STEP * i },
      data: {
        label: `${sub.label}.${setup.parentName}${sub.neverExpires ? " ∞" : ""}`,
        variant: "blue",
      },
    });
    edges.push({
      id: `e-registry-${id}`,
      source: "user-registry",
      sourceHandle: "bottom",
      target: id,
      targetHandle: "left",
    });
  });

  return { nodes, edges };
}
