/**
 * Root node: single-stroke frame (ENS Diagram System protocol mode) —
 * lapis/500 stroke, Marist label, Semi-Mono owner line.
 */

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import type { RootNodeData } from "../types";

export type RootNodeType = Node<RootNodeData, "root">;

const handleClass =
  "!w-2 !h-2 !border-2 !bg-[var(--diagram-paper)] !border-[var(--diagram-stroke)]";

function RootNode({ data, selected }: NodeProps<RootNodeType>) {
  const label = data.label ?? "<root>";
  const owner = data.owner;

  return (
    <div
      className={`
        diagram-root relative min-w-[140px] border-[1.5px] px-4 py-2.5
        border-[var(--diagram-stroke)] bg-[var(--diagram-paper)] text-[var(--diagram-ink)]
        ${selected ? "ring-2 ring-[var(--diagram-stroke)] ring-offset-2 ring-offset-[var(--diagram-paper)]" : ""}
      `}
      style={{ borderRadius: "var(--diagram-node-radius)" }}
    >
      <Handle type="target" position={Position.Top} className={handleClass} />
      <div className="diagram-marist text-[var(--diagram-font-main)] leading-tight">{label}</div>
      {owner != null && owner !== "" && (
        <div className="diagram-semimono mt-0.5 text-[var(--diagram-font-sub)] font-normal opacity-75">
          owner: {owner}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className={handleClass} />
    </div>
  );
}

export default memo(RootNode);
