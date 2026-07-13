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
  /** The shared/default resolver: what the parent name points at (zero/undefined = none). */
  resolver?: string;
  /** Roles the registrar holds on the registry root. */
  registrarRoles?: bigint;
  /** True once dangerous root roles were revoked. */
  locked?: boolean;
  subnames?: {
    label: string;
    neverExpires?: boolean;
    /** The subname's own resolver pointer (undefined/zero = none). */
    resolver?: string;
  }[];
};

const ZERO = "0x0000000000000000000000000000000000000000";

export type ResolverKind = "default" | "foreign" | "none";

/** Classify a subname's resolver relative to the setup's shared resolver. */
export function classifyResolver(
  subResolver?: string,
  defaultResolver?: string,
): ResolverKind {
  const res = subResolver?.toLowerCase();
  if (!res || res === ZERO) return "none";
  if (defaultResolver && res === defaultResolver.toLowerCase()) return "default";
  return "foreign";
}

/** Distinct foreign resolvers get their own node, capped to keep layouts sane. */
export const MAX_FOREIGN_RESOLVER_NODES = 4;

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
// farRight clears even long subname labels (sub nodes start at mid+180 and
// grow with the name), so foreign resolver boxes never sit on top of them.
const COL = { left: 0, mid: 400, right: 780, farRight: 1060 };
const ROW = { top: 0, main: 175, subStart: 300 };
const SUB_STEP = 60;
// Resolver boxes are taller than a subname row: stack them at least this far
// apart so adjacent foreign resolvers can't overlap each other.
const FOREIGN_STEP = 120;

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

  // Zero address means "no shared resolver": don't draw a node for it.
  const sharedRes =
    setup.resolver && setup.resolver.toLowerCase() !== ZERO ? setup.resolver : undefined;

  // Classify subnames first: deviations relabel the aggregate records edge.
  const subs = setup.subnames ?? [];
  const kinds = subs.map((sub) => classifyResolver(sub.resolver, sharedRes));
  const hasForeign = kinds.includes("foreign");

  if (sharedRes) {
    nodes.push({
      id: "resolver",
      type: "resolver",
      position: { x: COL.right, y: ROW.main },
      data: {
        label: "Resolver",
        owner: displayAddr(setup.parentOwner),
        addr: displayAddr(sharedRes),
      },
    });
    if (setup.userRegistry) {
      // Subnames on the shared resolver keep their records here; once any
      // subname deviates, the aggregate edge only covers the default group.
      edges.push({
        id: "e-registry-resolver",
        source: "user-registry",
        sourceHandle: "right",
        target: "resolver",
        targetHandle: "left",
        label: hasForeign ? "default records" : "records",
      });
    }
  }

  // Foreign resolvers: one node per distinct address (capped), in their own
  // column right of the subnames. Each aligns with the row of the first
  // subname that uses it where possible, but never closer than FOREIGN_STEP
  // to the previous one. Overflow shares a node.
  const foreignNodes = new Map<string, string>(); // lowercased addr -> node id
  const overflowAddrs = new Set<string>();
  let nextForeignY = ROW.subStart;
  const placeForeignY = (i: number): number => {
    const y = Math.max(ROW.subStart + SUB_STEP * i, nextForeignY);
    nextForeignY = y + FOREIGN_STEP;
    return y;
  };

  subs.forEach((sub, i) => {
    const id = `sub-${sub.label}`;
    const kind = kinds[i];
    const marker = sub.neverExpires ? " ∞" : kind === "none" ? " ∅" : "";
    nodes.push({
      id,
      type: "action",
      // Right of the registry's bottom handle: edges route down-then-right
      // into the left handle without S-bends.
      position: { x: COL.mid + 180, y: ROW.subStart + SUB_STEP * i },
      data: {
        label: `${sub.label}.${setup.parentName}${marker}`,
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

    if (kind === "foreign") {
      const addr = sub.resolver!.toLowerCase();
      let nodeId = foreignNodes.get(addr);
      if (!nodeId) {
        if (foreignNodes.size < MAX_FOREIGN_RESOLVER_NODES) {
          nodeId = `resolver-${addr}`;
          foreignNodes.set(addr, nodeId);
          nodes.push({
            id: nodeId,
            type: "resolver",
            position: { x: COL.farRight, y: placeForeignY(i) },
            data: { label: "Resolver", addr: displayAddr(sub.resolver), foreign: true },
          });
        } else {
          // beyond the cap: distinct addresses share one aggregate node
          nodeId = "resolver-more";
          overflowAddrs.add(addr);
          if (!nodes.some((n) => n.id === nodeId)) {
            nodes.push({
              id: nodeId,
              type: "resolver",
              position: { x: COL.farRight, y: placeForeignY(i) },
              data: { label: "More resolvers", addr: "", foreign: true },
            });
          }
        }
      }
      edges.push({
        id: `e-${id}-resolver`,
        source: id,
        target: nodeId,
        targetHandle: "left",
        label: "records",
      });
    }
  });

  if (overflowAddrs.size > 0) {
    const moreNode = nodes.find((n) => n.id === "resolver-more");
    if (moreNode) {
      (moreNode.data as { label: string }).label = `+${overflowAddrs.size} more`;
    }
  }

  return { nodes, edges };
}
