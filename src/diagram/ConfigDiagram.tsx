/**
 * Read-only diagram: renders a DiagramState (from lib/diagramModel) without
 * editing affordances. Pan/zoom only. Styled after the ENS Diagram System
 * "protocol" mode (lapis graph paper, 8px minor / 80px major grid).
 */

import { useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  getNodesBounds,
  useNodesInitialized,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes";
import type { DiagramEdge, DiagramNode } from "./types";

/** Margin between the pane edge and the content, in screen pixels. */
const FIT_MARGIN = 24;

/** Back off from the exact fit (~two clicks of the minus control). */
const ZOOM_FACTOR = 0.7;

/**
 * Anchor the diagram to the TOP-LEFT corner (document-style) instead of
 * fitView's centering, which parks small content mid-pane with a large gap
 * above. Runs once nodes report measured dimensions and again whenever the
 * node set changes (e.g. subnames load in).
 */
function FitOnReady({ nodeCount }: { nodeCount: number }) {
  const initialized = useNodesInitialized();
  const { getNodes, setViewport } = useReactFlow();
  const paneWidth = useStore((s) => s.width);
  const paneHeight = useStore((s) => s.height);

  useEffect(() => {
    if (!initialized || paneWidth === 0 || paneHeight === 0) return;
    // next frame: dimensions are committed by then
    requestAnimationFrame(() => {
      const bounds = getNodesBounds(getNodes());
      if (bounds.width === 0 || bounds.height === 0) return;
      const zoom = Math.max(
        Math.min(
          (paneWidth - 2 * FIT_MARGIN) / bounds.width,
          (paneHeight - 2 * FIT_MARGIN) / bounds.height,
          1.5,
        ) * ZOOM_FACTOR,
        0.15,
      );
      void setViewport({
        x: FIT_MARGIN - bounds.x * zoom,
        y: FIT_MARGIN - bounds.y * zoom,
        zoom,
      });
    });
  }, [initialized, nodeCount, paneWidth, paneHeight, getNodes, setViewport]);
  return null;
}

// lapis/500 at 14% / 32% (SVG attrs can't use CSS vars reliably)
const GRID_MINOR = "rgba(0, 130, 187, 0.14)";
const GRID_MAJOR = "rgba(0, 130, 187, 0.32)";

export function ConfigDiagram({
  nodes,
  edges,
}: {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}) {
  return (
    <div className="diagram-canvas relative h-full w-full bg-[var(--diagram-paper)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: FIT_MARGIN, y: FIT_MARGIN, zoom: 1 }}
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
        <FitOnReady nodeCount={nodes.length} />
      </ReactFlow>
    </div>
  );
}
