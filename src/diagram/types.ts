/**
 * Diagram builder: type definitions for flow nodes and edges.
 * Supports: root, action, gateway (diamond), registry (oval), group (dotted box).
 * Edges support optional `label` for step/action text (e.g. "2. UPLOAD", "resolve name").
 */

import type { Node, Edge } from "@xyflow/react";

/** Blue = domain/root nodes, brown = resolver nodes (Figma) */
export type DiagramVariant = "blue" | "brown";

export type RootNodeData = {
  label?: string;
  owner?: string; // e.g. "0x0123..."
  variant?: DiagramVariant;
};

export type ActionNodeData = {
  label: string; // e.g. "eth", "montoya.eth"
  variant?: DiagramVariant;
};

export type GatewayNodeData = {
  label: string;   // e.g. "REPLACEABLE GATEWAY"
  id?: string;    // e.g. "eth.limo"
};

export type RegistryNodeData = {
  label: string;    // e.g. "ONCHAIN NAME REGISTRY"
  subtitle?: string; // e.g. "ENS"
};

export type GroupNodeData = {
  label: string;
};

/** Resolver node: dark stack with sockets; foreign = light, socket-less ("not yours"). */
export type ResolverNodeData = {
  label: string;   // e.g. "Resolver 1"
  owner?: string; // e.g. "0x5678..."
  addr?: string;  // e.g. "0x5678..." for addr (60)
  foreign?: boolean;
};

export type DiagramNode =
  | Node<RootNodeData, "root">
  | Node<ActionNodeData, "action">
  | Node<GatewayNodeData, "gateway">
  | Node<RegistryNodeData, "registry">
  | Node<GroupNodeData, "group">
  | Node<ResolverNodeData, "resolver">;
export type DiagramEdge = Edge;

export type DiagramState = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /**
   * Semantic relations that aren't drawn as edges (node id -> related node
   * ids, symmetric). Hover highlighting unions these with edge adjacency,
   * e.g. a shared resolver serves subnames it has no direct edge to.
   */
  affinities?: Record<string, string[]>;
};
