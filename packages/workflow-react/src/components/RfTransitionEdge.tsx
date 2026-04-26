import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
} from "reactflow";
import type { TransitionEdge } from "@cyoda/workflow-graph";
import {
  badgesFor,
  geometry,
  laneColor,
  laneDashArray,
  typography,
  workflowPalette,
} from "@cyoda/workflow-viewer/theme";
import { orthogonalEdgePath, type Rect } from "../routing/orthogonal.js";
import { arrowMarkerId } from "./ArrowMarkers.js";

export interface RfEdgeData {
  edge: TransitionEdge;
  targetIsTerminal: boolean;
  /** ELK-computed polyline for this edge, if available. */
  routePoints?: { x: number; y: number }[];
  /** Layout-computed label centre and size. */
  labelX?: number;
  labelY?: number;
  labelWidth?: number;
  labelHeight?: number;
  /** Other nodes' bounding boxes, for obstacle-aware nudging. */
  obstacles?: Rect[];
}

function RfTransitionEdgeImpl(props: EdgeProps<RfEdgeData>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  } = props;
  if (!data) return null;
  const { edge, targetIsTerminal, routePoints, obstacles } = data;

  const { path, labelX: fallbackLabelX, labelY: fallbackLabelY } = orthogonalEdgePath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    routePoints,
    obstacles,
  });
  const labelX = data.labelX ?? fallbackLabelX;
  const labelY = data.labelY ?? fallbackLabelY;

  const color = laneColor(edge, { targetIsTerminal });
  const dash = laneDashArray(edge);
  const strokeWidth = selected
    ? geometry.edge.strokeWidth + 1
    : edge.isLoopback
      ? geometry.edge.loopStrokeWidth
      : geometry.edge.strokeWidth;
  const isManualSolid = edge.manual && !edge.disabled && !edge.isLoopback;

  const badges = badgesFor(edge.summary, {
    manual: edge.manual,
    disabled: edge.disabled,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: color,
          strokeWidth,
          strokeDasharray: dash,
        }}
        markerEnd={`url(#${arrowMarkerId(color)})`}
      />
      {isManualSolid && (
        <path
          d={path}
          fill="none"
          stroke={workflowPalette.neutrals.white}
          strokeWidth={0.6}
          pointerEvents="none"
        />
      )}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            fontFamily: typography.fontFamily,
            pointerEvents: "all",
            background: workflowPalette.edgeLabel.fill,
            border: `1px solid ${workflowPalette.edgeLabel.border}`,
            borderRadius: geometry.labelPill.radius,
            padding: `${geometry.labelPill.paddingY}px ${geometry.labelPill.paddingX}px`,
            boxShadow: "0 1px 2px rgba(15,23,42,0.08)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            minWidth: 40,
            width: data.labelWidth,
          }}
          className="nodrag nopan"
          data-testid={`rf-edge-label-${edge.id}`}
        >
          <div
            style={{
              color: workflowPalette.edgeLabel.text,
              fontSize: typography.edgeLabel.size,
              fontWeight: typography.edgeLabel.weight,
              letterSpacing: typography.edgeLabel.tracking,
              textTransform: "uppercase",
            }}
          >
            {edge.summary.display}
          </div>
          {badges.length > 0 && (
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
              {badges.map((b, i) => {
                const slot =
                  b.key === "manual"
                    ? workflowPalette.badge.manual
                    : b.key === "processor" || b.key === "execution"
                      ? workflowPalette.badge.processor
                      : b.key === "criterion"
                        ? workflowPalette.badge.criterion
                        : workflowPalette.badge.disabled;
                return (
                  <span
                    key={`${b.key}-${i}`}
                    style={{
                      background: slot.fill,
                      border: `1px solid ${slot.border}`,
                      color: workflowPalette.badge.text,
                      fontSize: typography.badge.size,
                      fontWeight: typography.badge.weight,
                      letterSpacing: typography.badge.tracking,
                      padding: "1px 4px",
                      borderRadius: 8,
                    }}
                  >
                    {b.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const RfTransitionEdge = memo(RfTransitionEdgeImpl);
