"use client";

import { memo } from "react";
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from "reactflow";

interface FamilyEdgeData {
  type: "parent" | "child" | "sibling" | "spouse";
}

const edgeStyles: Record<
  string,
  { stroke: string; dash?: string; width: number; opacity: number }
> = {
  parent: { stroke: "var(--color-rel-parent)", width: 1.5, opacity: 0.5 },
  child: { stroke: "var(--color-rel-parent)", width: 1.5, opacity: 0.5 },
  sibling: { stroke: "var(--color-rel-sibling)", dash: "1,6", width: 2, opacity: 0.55 },
  spouse: { stroke: "var(--color-rel-spouse)", width: 1.5, opacity: 0.6 },
};

function FamilyEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<FamilyEdgeData>) {
  const relType = data?.type || "parent";
  const style = edgeStyles[relType] || edgeStyles.parent;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: relType === "spouse" ? 0.15 : 0.4,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: style.stroke,
          strokeWidth: style.width,
          strokeDasharray: style.dash,
          strokeLinecap: "round",
          opacity: style.opacity,
        }}
      />
      {relType === "spouse" && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] shadow-sm ring-1 ring-rose-200"
          >
            <span className="text-rose-500">♥</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const FamilyEdge = memo(FamilyEdgeComponent);
