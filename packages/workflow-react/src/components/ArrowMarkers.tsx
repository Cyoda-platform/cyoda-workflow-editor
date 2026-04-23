import { geometry, workflowPalette } from "@cyoda/workflow-viewer/theme";

/**
 * React-Flow renders edges inside its own root SVG, so we can't reuse the
 * viewer's `<Defs />` directly. This component injects an out-of-flow `<svg>`
 * sitting on top of the canvas that only declares arrow markers — same IDs
 * and geometry as the viewer so RfTransitionEdge can `url(#wf-arrow-XXX)`.
 */
export function ArrowMarkers() {
  const size = geometry.edge.arrowheadSize;
  const colors = Array.from(new Set(Object.values(workflowPalette.edge)));
  return (
    <svg
      width={0}
      height={0}
      style={{ position: "absolute", pointerEvents: "none" }}
      aria-hidden
    >
      <defs>
        {colors.map((color) => (
          <marker
            key={color}
            id={arrowMarkerId(color)}
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
      </defs>
    </svg>
  );
}

export function arrowMarkerId(color: string): string {
  return `wf-arrow-${color.replace("#", "").toLowerCase()}`;
}
