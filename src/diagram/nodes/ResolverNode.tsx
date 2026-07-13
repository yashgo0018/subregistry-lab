/**
 * Resolver node: ENS Diagram System resolver stack — dashed lapis/500 frame,
 * dark lapis fill, light Semi-Mono text, filled corner sockets.
 */

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import type { ResolverNodeData } from "../types";
import CornerMarkers from "./CornerMarkers";

export type ResolverNodeType = Node<ResolverNodeData, "resolver">;

const handleClass =
  "!w-2 !h-2 !border-2 !bg-[var(--diagram-paper)] !border-[var(--diagram-stroke)]";

function ResolverNode({ data, selected }: NodeProps<ResolverNodeType>) {
  return (
    <div
      className={`
        diagram-resolver diagram-node-dotted relative min-w-[150px] border-[1.5px] px-4 py-3
        border-[var(--diagram-stroke)] bg-[var(--diagram-resolver-fill)]
        text-[var(--diagram-resolver-label)]
        ${selected ? "ring-2 ring-[var(--diagram-stroke)] ring-offset-2 ring-offset-[var(--diagram-paper)]" : ""}
      `}
      style={{ borderRadius: "var(--diagram-node-radius)" }}
    >
      <CornerMarkers />
      <Handle id="top" type="target" position={Position.Top} className={handleClass} />
      <Handle id="left" type="target" position={Position.Left} className={handleClass} />
      <div className="diagram-semimono font-medium text-[var(--diagram-font-main)] leading-tight">
        {data.label}
      </div>
      {data.owner != null && data.owner !== "" && (
        <div className="diagram-semimono mt-0.5 text-[var(--diagram-font-sub)] font-normal opacity-80">
          owner: {data.owner}
        </div>
      )}
      {data.addr != null && data.addr !== "" && (
        <div className="diagram-semimono mt-0.5 text-[var(--diagram-font-sub)] font-normal opacity-80">
          addr (60): {data.addr}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className={handleClass} />
    </div>
  );
}

export default memo(ResolverNode);
