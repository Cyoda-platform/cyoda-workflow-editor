import { geometry, workflowPalette } from "../theme/tokens.js";
import { colorKey, laneColorSet } from "./EdgePath.js";

/**
 * Shared SVG `<defs>` — arrowhead markers (one per lane colour) and the two
 * drop-shadow filters used by nodes and label chips.
 */
export function Defs() {
  const size = geometry.edge.arrowheadSize;
  // Sharper 2:1 triangle: width (tip-to-base) = 2*size, base thickness = size,
  // so the base runs vertically from (0, size/2) to (0, 3*size/2) and the tip
  // sits at (2*size, size). refX is pushed close to the tip so the arrow kisses
  // the node edge, not floats away from it.
  const unique = Array.from(new Set(laneColorSet));
  return (
    <defs>
      {unique.map((color) => (
        <marker
          key={color}
          id={`wf-arrow-${colorKey(color)}`}
          viewBox={`0 0 ${size * 2} ${size * 2}`}
          refX={size * 1.85}
          refY={size}
          markerWidth={size}
          markerHeight={size}
          orient="auto-start-reverse"
        >
          <path
            d={`M 0 ${size / 2} L ${size * 2} ${size} L 0 ${size * 1.5} z`}
            fill={color}
          />
        </marker>
      ))}
      <filter id="wf-node-shadow" x="-10%" y="-10%" width="120%" height="140%">
        <feDropShadow
          dx={0}
          dy={2}
          stdDeviation={2}
          floodColor={workflowPalette.neutrals.slate900}
          floodOpacity={0.08}
        />
      </filter>
      <filter
        id="wf-node-shadow-strong"
        x="-10%"
        y="-10%"
        width="120%"
        height="140%"
      >
        <feDropShadow
          dx={0}
          dy={3}
          stdDeviation={3}
          floodColor={workflowPalette.neutrals.slate900}
          floodOpacity={0.18}
        />
      </filter>
      <filter id="wf-label-shadow" x="-10%" y="-10%" width="120%" height="140%">
        <feDropShadow
          dx={0}
          dy={1}
          stdDeviation={1.2}
          floodColor={workflowPalette.neutrals.slate900}
          floodOpacity={geometry.labelPill.shadowOpacity}
        />
      </filter>
    </defs>
  );
}
