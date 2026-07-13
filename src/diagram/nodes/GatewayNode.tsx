/**
 * Gateway node: diamond shape for replaceable gateways (e.g. eth.limo).
 * Use for resolution/serving path diagrams.
 */

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import type { GatewayNodeData } from "../types";

export type GatewayNodeType = Node<GatewayNodeData, "gateway">;

function GatewayNode({ data, selected }: NodeProps<GatewayNodeType>) {
  return (
    <div
      className={`
        diagram-gateway relative w-28 h-28 flex items-center justify-center
        ${selected ? "ring-2 ring-[var(--diagram-ink)] ring-offset-2 ring-offset-[var(--diagram-paper)]" : ""}
      `}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !border-2 !bg-[var(--diagram-paper)] !border-[var(--diagram-stroke)]" />
      <div
        className="absolute w-24 h-24 border-[1.5px] border-[var(--diagram-stroke)] bg-[var(--diagram-paper)] rotate-45"
        style={{ top: "50%", left: "50%", marginTop: -48, marginLeft: -48 }}
      />
      {/* The diamond behind is a rotated sibling; the label itself must stay unrotated.
          Text must fit the inscribed square (~68px for a 96px diamond): keep it small. */}
      <div className="diagram-semimono relative z-10 max-w-[70px] text-center text-[11px] font-medium leading-tight text-[var(--diagram-ink)]">
        <div>{data.label}</div>
        {data.id != null && data.id !== "" && (
          <div className="mt-0.5 text-[10px] opacity-75">{data.id}</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !border-2 !bg-[var(--diagram-paper)] !border-[var(--diagram-stroke)]" />
    </div>
  );
}

export default memo(GatewayNode);
