/**
 * Read-only diagram: renders a DiagramState (from lib/diagramModel) without
 * editing affordances. Pan/zoom only.
 */

import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes";
import type { DiagramEdge, DiagramNode } from "./types";
import DiagramNoiseOverlay from "./DiagramNoiseOverlay";

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
        fitView
        fitViewOptions={{ padding: 0.15 }}
        className="diagram-flow"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          style: { stroke: "var(--diagram-ink)", strokeWidth: 2 },
          type: "smoothstep",
          labelShowBg: true,
          labelBgStyle: {
            fill: "var(--diagram-node-bg)",
            stroke: "var(--diagram-ink)",
            strokeWidth: 1.5,
          },
          labelBgPadding: [8, 12] as [number, number],
          labelBgBorderRadius: 10,
          labelStyle: {
            fontFamily: "ui-monospace, monospace",
            fontWeight: 600,
            fontSize: "var(--diagram-font-sub)",
            fill: "var(--diagram-ink)",
          },
        }}
      >
        <Background
          color="var(--diagram-grid)"
          gap={16}
          size={1}
          style={{ backgroundColor: "var(--diagram-paper)" }}
        />
        <Controls
          position="bottom-right"
          className="!border-[var(--diagram-ink)] !bg-[var(--diagram-node-bg)] !fill-[var(--diagram-ink)]"
          showInteractive={false}
        />
      </ReactFlow>
      <DiagramNoiseOverlay />
    </div>
  );
}
