import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { StateNode } from "@cyoda/workflow-graph";
import {
  geometry,
  paletteFor,
  roleCategoryLabel,
  typography,
  workflowPalette,
} from "@cyoda/workflow-viewer/theme";

export interface RfStateNodeData {
  node: StateNode;
  hasError: boolean;
  hasWarning: boolean;
}

/**
 * React Flow custom node that visually matches the slim viewer's state
 * chrome. Only interaction affordances (handles, selection ring) differ.
 */
function RfStateNodeImpl({ data, selected }: NodeProps<RfStateNodeData>) {
  const { node, hasError, hasWarning } = data;
  const palette = paletteFor(node);
  const { width, height, radius, strokeWidth } = geometry.node;
  const category = roleCategoryLabel(node);
  const isTerminal = node.role === "terminal" || node.role === "initial-terminal";

  const borderColor = hasError
    ? "#DC2626"
    : hasWarning
      ? "#D97706"
      : selected
        ? workflowPalette.neutrals.slate900
        : palette.border;
  const borderWidth = selected ? strokeWidth + 1 : strokeWidth;

  return (
    <div
      style={{
        width,
        height,
        background: palette.fill,
        border: `${borderWidth}px solid ${borderColor}`,
        borderRadius: radius,
        boxShadow: selected
          ? "0 2px 4px rgba(15,23,42,0.14)"
          : "0 1px 2px rgba(15,23,42,0.08)",
        position: "relative",
        boxSizing: "border-box",
        fontFamily: typography.fontFamily,
        userSelect: "none",
      }}
      data-testid={`rf-state-${node.stateCode}`}
    >
      {ANCHOR_SIDES.map(({ side, position }) => (
        <AnchorHandles
          key={side}
          side={side}
          position={position}
          color={palette.border}
        />
      ))}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          gap: 2,
          padding: "0 8px",
        }}
      >
        <div
          style={{
            color: palette.meta,
            fontSize: typography.stateCategory.size,
            fontWeight: typography.stateCategory.weight,
            letterSpacing: typography.stateCategory.tracking,
          }}
        >
          {category}
        </div>
        <div
          style={{
            color: palette.title,
            fontFamily: typography.monoFamily,
            fontSize: typography.stateTitle.size,
            fontWeight: typography.stateTitle.weight,
            letterSpacing: typography.stateTitle.tracking,
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}
        >
          {node.stateCode}
        </div>
      </div>
      {isTerminal && (
        <div
          style={{
            position: "absolute",
            inset: 3,
            borderRadius: 8,
            border: `1px solid ${"innerRing" in palette ? palette.innerRing : workflowPalette.neutrals.white75}`,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

const ANCHOR_SIDES: ReadonlyArray<{
  side: "top" | "right" | "bottom" | "left";
  position: Position;
}> = [
  { side: "top", position: Position.Top },
  { side: "right", position: Position.Right },
  { side: "bottom", position: Position.Bottom },
  { side: "left", position: Position.Left },
];

function AnchorHandles({
  side,
  position,
  color,
}: {
  side: "top" | "right" | "bottom" | "left";
  position: Position;
  color: string;
}) {
  const common = {
    background: color,
    width: 8,
    height: 8,
  } as const;
  return (
    <>
      <Handle
        id={`${side}-source`}
        type="source"
        position={position}
        style={common}
      />
      <Handle
        id={`${side}-target`}
        type="target"
        position={position}
        style={common}
      />
    </>
  );
}

export const RfStateNode = memo(RfStateNodeImpl);
