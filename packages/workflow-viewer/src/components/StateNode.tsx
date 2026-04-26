import type { StateNode as StateNodeData } from "@cyoda/workflow-graph";
import { paletteFor, roleCategoryLabel } from "../theme/index.js";
import { geometry, typography, workflowPalette } from "../theme/tokens.js";
import type { NodePosition } from "../layout.js";

interface Props {
  node: StateNodeData;
  position: NodePosition;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
  onHoverEnter: (id: string) => void;
  onHoverLeave: () => void;
}

export function StateNodeView({
  node,
  position,
  selected,
  highlighted,
  dimmed,
  onSelect,
  onHoverEnter,
  onHoverLeave,
}: Props) {
  const palette = paletteFor(node);
  const { radius, strokeWidth, terminalInset, terminalInnerRadius } = geometry.node;
  const { width, height } = position;
  const isTerminal = node.role === "terminal" || node.role === "initial-terminal";
  const isInitialTerminal = node.role === "initial-terminal";
  const category = roleCategoryLabel(node);

  const opacity = dimmed ? 0.35 : 1;
  const outerStroke = selected
    ? workflowPalette.neutrals.slate900
    : palette.border;
  const outerStrokeWidth = selected ? strokeWidth + 1 : strokeWidth;

  return (
    <g
      transform={`translate(${position.x}, ${position.y})`}
      opacity={opacity}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onMouseEnter={() => onHoverEnter(node.id)}
      onMouseLeave={onHoverLeave}
      style={{ cursor: "pointer" }}
      data-testid={`state-node-${node.stateCode}`}
      aria-label={`${category} ${node.stateCode}`}
      role="button"
      tabIndex={0}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={radius}
        ry={radius}
        fill={palette.fill}
        stroke={outerStroke}
        strokeWidth={outerStrokeWidth}
        filter={highlighted || selected ? "url(#wf-node-shadow-strong)" : "url(#wf-node-shadow)"}
      />
      {isTerminal && (
        <rect
          x={terminalInset}
          y={terminalInset}
          width={width - terminalInset * 2}
          height={height - terminalInset * 2}
          rx={terminalInnerRadius}
          ry={terminalInnerRadius}
          fill="none"
          stroke={
            "innerRing" in palette
              ? palette.innerRing
              : workflowPalette.neutrals.white75
          }
          strokeWidth={1}
        />
      )}
      {isInitialTerminal && (
        <rect
          x={terminalInset}
          y={terminalInset}
          width={width - terminalInset * 2}
          height={height - terminalInset * 2}
          rx={terminalInnerRadius}
          ry={terminalInnerRadius}
          fill="none"
          stroke={workflowPalette.node.initial.border}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
      <text
        x={width / 2}
        y={height / 2 - 8}
        textAnchor="middle"
        fill={palette.meta}
        fontFamily={typography.fontFamily}
        fontSize={typography.stateCategory.size}
        fontWeight={typography.stateCategory.weight}
        letterSpacing={typography.stateCategory.tracking}
      >
        {category}
      </text>
      <text
        x={width / 2}
        y={height / 2 + 12}
        textAnchor="middle"
        fill={palette.title}
        fontFamily={typography.monoFamily}
        fontSize={typography.stateTitle.size}
        fontWeight={typography.stateTitle.weight}
        letterSpacing={typography.stateTitle.tracking}
      >
        {truncate(node.stateCode, 18)}
      </text>
    </g>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
