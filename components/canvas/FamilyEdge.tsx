"use client";

import { memo } from "react";
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from "reactflow";
import { cn } from "@/lib/utils";

interface FamilyEdgeData {
  type: "parent" | "child" | "sibling" | "spouse";
}

const edgeStyles: Record<string, { stroke: string; strokeDasharray?: string }> = {
  parent: { stroke: "hsl(28, 80%, 45%)" },
  child: { stroke: "hsl(28, 80%, 45%)" },
  sibling: { stroke: "hsl(210, 60%, 50%)", strokeDasharray: "5,3" },
  spouse: { stroke: "hsl(340, 60%, 50%)" },
};

const edgeLabels: Record<string, string> = {
  parent: "",
  child: "",
  sibling: "",
  spouse: "♥",
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
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.3,
  });

  const relType = data?.type || "parent";
  const style = edgeStyles[relType] || edgeStyles.parent;
  const label = edgeLabels[relType];

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: style.stroke,
          strokeWidth: relType === "spouse" ? 2 : 1.5,
          strokeDasharray: style.strokeDasharray,
          opacity: 0.7,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
            }}
            className={cn(
              "text-sm font-bold",
              relType === "spouse" ? "text-rose-500" : "text-primary"
            )}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const FamilyEdge = memo(FamilyEdgeComponent);
