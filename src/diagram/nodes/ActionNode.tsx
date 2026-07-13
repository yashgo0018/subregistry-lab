/**
 * Action node: plain name label without pill chrome (ENS Diagram System
 * protocol mode) — Marist serif, lapis/900 ink, sits directly on the field.
 */

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import type { ActionNodeData } from "../types";

export type ActionNodeType = Node<ActionNodeData, "action">;

const handleClass =
  "!w-2 !h-2 !border-2 !bg-[var(--diagram-paper)] !border-[var(--diagram-stroke)]";

function ActionNode({ data, selected }: NodeProps<ActionNodeType>) {
  return (
    <div
      className={`
        diagram-action relative whitespace-nowrap rounded-md px-3 py-1.5
        bg-[var(--diagram-paper)] text-[var(--diagram-ink)]
        ${selected ? "ring-2 ring-[var(--diagram-stroke)] ring-offset-2 ring-offset-[var(--diagram-paper)]" : ""}
      `}
    >
      <Handle type="target" position={Position.Left} className={handleClass} />
      <span className="diagram-marist text-[var(--diagram-font-main)]">{data.label}</span>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  );
}

export default memo(ActionNode);
