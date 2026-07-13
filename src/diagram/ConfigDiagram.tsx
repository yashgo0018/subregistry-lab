/**
 * Read-only diagram: renders a DiagramState (from lib/diagramModel) without
 * editing affordances. Pan/zoom only. Styled after the ENS Diagram System
 * "protocol" mode (lapis graph paper, 8px minor / 80px major grid).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  getNodesBounds,
  useNodesInitialized,
  useReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes";
import type { DiagramEdge, DiagramNode } from "./types";

/** Margin between the pane edge and the content, in screen pixels. */
const FIT_MARGIN = 24;

type FitApi = Pick<
  ReactFlowInstance<DiagramNode, DiagramEdge>,
  "fitView" | "getNodes" | "getViewport" | "setViewport"
>;

/**
 * Fit the whole configuration into view, anchored TOP-LEFT (document-style).
 * fitView does the robust zoom computation (pane measurement included); we
 * then re-anchor its result so the content's top-left corner sits at the
 * margin instead of being centered.
 */
async function fitTopLeft(api: FitApi): Promise<void> {
  await api.fitView({ padding: 0.05, maxZoom: 1.1 });
  const bounds = getNodesBounds(api.getNodes());
  if (bounds.width === 0 || bounds.height === 0) return;
  const { zoom } = api.getViewport();
  await api.setViewport({
    x: FIT_MARGIN - bounds.x * zoom,
    y: FIT_MARGIN - bounds.y * zoom,
    zoom,
  });
}

/** Refit when the node set changes after init (e.g. subnames loading in). */
function RefitOnChange({ nodeCount }: { nodeCount: number }) {
  const initialized = useNodesInitialized();
  const api = useReactFlow<DiagramNode, DiagramEdge>();
  const lastFitted = useRef(0);

  useEffect(() => {
    if (!initialized || nodeCount === lastFitted.current) return;
    lastFitted.current = nodeCount;
    // next frame: node dimensions are committed by then
    const raf = requestAnimationFrame(() => void fitTopLeft(api));
    return () => cancelAnimationFrame(raf);
  }, [initialized, nodeCount, api]);
  return null;
}

// lapis/500 at 14% / 32% (SVG attrs can't use CSS vars reliably)
const GRID_MINOR = "rgba(0, 130, 187, 0.14)";
const GRID_MAJOR = "rgba(0, 130, 187, 0.32)";

export function ConfigDiagram({
  nodes,
  edges,
  affinities,
  onNodeClick,
}: {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /** Semantic relations without drawn edges; unioned into hover highlighting. */
  affinities?: Record<string, string[]>;
  /** Optional: clicking a node (e.g. a resolver) opens a detail panel upstream. */
  onNodeClick?: (node: DiagramNode) => void;
}) {
  // onInit is React Flow's documented "instance ready" hook: pane measured,
  // initial nodes rendered. The primary, reliable fit happens here.
  const onInit = useCallback((instance: ReactFlowInstance<DiagramNode, DiagramEdge>) => {
    void fitTopLeft(instance);
  }, []);

  // Hovering a node highlights its incident edges and dims the rest.
  const [hovered, setHovered] = useState<string | null>(null);
  const { displayNodes, displayEdges } = useMemo(() => {
    if (!hovered) return { displayNodes: nodes, displayEdges: edges };
    const neighbors = new Set([hovered]);
    for (const e of edges) {
      if (e.source === hovered) neighbors.add(e.target);
      if (e.target === hovered) neighbors.add(e.source);
    }
    for (const id of affinities?.[hovered] ?? []) neighbors.add(id);
    return {
      displayNodes: nodes.map((n) =>
        neighbors.has(n.id) ? n : { ...n, style: { ...n.style, opacity: 0.35 } },
      ) as DiagramNode[],
      displayEdges: edges.map((e) =>
        e.source === hovered || e.target === hovered
          ? { ...e, style: { ...e.style, strokeWidth: 2.5 } }
          : { ...e, style: { ...e.style, opacity: 0.25 } },
      ),
    };
  }, [nodes, edges, affinities, hovered]);

  return (
    <div className="diagram-canvas relative h-full w-full bg-[var(--diagram-paper)]">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onNodeMouseEnter={(_, node) => setHovered(node.id)}
        onNodeMouseLeave={() => setHovered(null)}
        onNodeClick={onNodeClick ? (_, node) => onNodeClick(node as DiagramNode) : undefined}
        onInit={onInit}
        fitView
        fitViewOptions={{ padding: 0.05, maxZoom: 1.1 }}
        minZoom={0.15}
        className="diagram-flow"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          style: { stroke: "var(--diagram-stroke)", strokeWidth: 1.5 },
          type: "smoothstep",
          labelShowBg: true,
          labelBgStyle: { fill: "var(--diagram-paper)" },
          labelBgPadding: [6, 8] as [number, number],
          labelBgBorderRadius: 6,
          labelStyle: {
            fontFamily: '"ABC Monument Grotesk Semi-Mono", ui-monospace, monospace',
            fontWeight: 500,
            fontSize: "var(--diagram-font-sub)",
            fill: "var(--diagram-ink)",
          },
        }}
      >
        <Background
          id="grid-minor"
          variant={BackgroundVariant.Lines}
          gap={8}
          color={GRID_MINOR}
          style={{ backgroundColor: "var(--diagram-paper)" }}
        />
        <Background
          id="grid-major"
          variant={BackgroundVariant.Lines}
          gap={80}
          color={GRID_MAJOR}
        />
        <Controls
          position="bottom-right"
          className="!border-[var(--diagram-stroke)] !bg-[var(--diagram-paper)] !fill-[var(--diagram-ink)]"
          showInteractive={false}
        />
        <RefitOnChange nodeCount={nodes.length} />
      </ReactFlow>
    </div>
  );
}
