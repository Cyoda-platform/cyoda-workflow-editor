import { useMemo, useState } from "react";
import type {
  GraphDocument,
  GraphEdge,
  GraphNode,
  StateNode,
  TransitionEdge,
} from "@cyoda/workflow-graph";
import { simpleLayout, type LayoutResult, type NodePosition } from "../layout.js";
import { usePanZoom } from "../hooks/usePanZoom.js";
import { Defs } from "./Defs.js";
import { StartMarker } from "./StartMarker.js";
import { StateNodeView } from "./StateNode.js";
import { EdgePath, computeEdgeGeometry } from "./EdgePath.js";
import { EdgeLabel } from "./EdgeLabel.js";
import { workflowPalette } from "../theme/tokens.js";

export interface WorkflowViewerProps {
  graph: GraphDocument;
  /** Optional pre-computed layout (e.g. from @cyoda/workflow-layout). */
  layout?: LayoutResult;
  width?: number | string;
  height?: number | string;
  selectedId?: string;
  onSelectionChange?: (id: string | null) => void;
  className?: string;
}

/**
 * Slim read-only SVG renderer. Renders workflow state nodes, transitions,
 * and edge-label chips using the theme tokens. No editing affordances.
 */
export function WorkflowViewer({
  graph,
  layout,
  width = "100%",
  height = "100%",
  selectedId,
  onSelectionChange,
  className,
}: WorkflowViewerProps) {
  const effectiveLayout = useMemo(
    () => layout ?? simpleLayout(graph),
    [graph, layout],
  );
  const pan = usePanZoom();
  const [internalSelection, setInternalSelection] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const selection = selectedId ?? internalSelection;

  const stateNodes = useMemo(
    () => graph.nodes.filter((n): n is StateNode => n.kind === "state"),
    [graph.nodes],
  );
  const stateById = useMemo(() => {
    const m = new Map<string, StateNode>();
    for (const n of stateNodes) m.set(n.id, n);
    return m;
  }, [stateNodes]);

  const transitionEdges = useMemo(
    () => graph.edges.filter((e): e is TransitionEdge => e.kind === "transition"),
    [graph.edges],
  );

  const highlightSet = useMemo(
    () => computeHighlightSet(hovered ?? selection, graph.nodes, graph.edges),
    [hovered, selection, graph.nodes, graph.edges],
  );

  const anythingFocused = highlightSet !== null;

  const handleSelect = (id: string) => {
    setInternalSelection(id);
    onSelectionChange?.(id);
  };

  const handleBackgroundClick = () => {
    setInternalSelection(null);
    onSelectionChange?.(null);
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${effectiveLayout.width} ${effectiveLayout.height}`}
      preserveAspectRatio="xMidYMid meet"
      onClick={handleBackgroundClick}
      onWheel={pan.onWheel}
      onMouseDown={pan.onMouseDown}
      onMouseMove={pan.onMouseMove}
      onMouseUp={pan.onMouseUp}
      onMouseLeave={pan.onMouseUp}
      className={className}
      style={{
        background: workflowPalette.neutrals.white,
        fontFamily: "inherit",
        userSelect: "none",
      }}
      data-testid="workflow-viewer"
    >
      <Defs />
      <g
        transform={`translate(${pan.transform.x}, ${pan.transform.y}) scale(${pan.transform.scale})`}
      >
        {/* Edges first so they render behind nodes. */}
        {transitionEdges.map((edge) => {
          const source = effectiveLayout.positions.get(edge.sourceId);
          const target = effectiveLayout.positions.get(edge.targetId);
          if (!source || !target) return null;
          const targetNode = stateById.get(edge.targetId);
          const route = effectiveLayout.edges?.get(edge.id);
          const isEdgeSelected = selection === edge.id;
          const isHighlighted = highlightSet?.has(edge.id) ?? false;
          const isDimmed = anythingFocused && !isHighlighted;
          return (
            <EdgePath
              key={edge.id}
              edge={edge}
              source={source}
              target={target}
              route={route}
              targetIsTerminal={
                targetNode?.role === "terminal" ||
                targetNode?.role === "initial-terminal"
              }
              highlighted={isHighlighted}
              dimmed={isDimmed}
              selected={isEdgeSelected}
              onSelect={handleSelect}
              onHoverEnter={setHovered}
              onHoverLeave={() => setHovered(null)}
            />
          );
        })}

        {/* Edge labels on top of edges. */}
        {transitionEdges.map((edge) => {
          const source = effectiveLayout.positions.get(edge.sourceId);
          const target = effectiveLayout.positions.get(edge.targetId);
          if (!source || !target) return null;
          const route = effectiveLayout.edges?.get(edge.id);
          const labelPos = route
            ? { midX: route.labelX, midY: route.labelY }
            : computeEdgeGeometry(edge, source, target);
          const isHighlighted = highlightSet?.has(edge.id) ?? false;
          const isDimmed = anythingFocused && !isHighlighted;
          return (
            <EdgeLabel
              key={`label-${edge.id}`}
              edge={edge}
              x={labelPos.midX}
              y={labelPos.midY}
              dimmed={isDimmed}
            />
          );
        })}

        {/* Nodes on top. */}
        {graph.nodes.map((node) => renderNode(node, effectiveLayout, {
          selection,
          highlightSet,
          anythingFocused,
          onSelect: handleSelect,
          onHoverEnter: setHovered,
          onHoverLeave: () => setHovered(null),
        }))}
      </g>
    </svg>
  );
}

interface RenderCtx {
  selection: string | null;
  highlightSet: Set<string> | null;
  anythingFocused: boolean;
  onSelect: (id: string) => void;
  onHoverEnter: (id: string) => void;
  onHoverLeave: () => void;
}

function renderNode(
  node: GraphNode,
  layout: LayoutResult,
  ctx: RenderCtx,
) {
  const pos = layout.positions.get(node.id);
  if (!pos) return null;
  if (node.kind === "startMarker") {
    return <StartMarker key={node.id} position={smallPositionForMarker(pos)} />;
  }
  const isHighlighted = ctx.highlightSet?.has(node.id) ?? false;
  const isDimmed = ctx.anythingFocused && !isHighlighted;
  return (
    <StateNodeView
      key={node.id}
      node={node}
      position={pos}
      selected={ctx.selection === node.id}
      highlighted={isHighlighted}
      dimmed={isDimmed}
      onSelect={ctx.onSelect}
      onHoverEnter={ctx.onHoverEnter}
      onHoverLeave={ctx.onHoverLeave}
    />
  );
}

function smallPositionForMarker(pos: NodePosition): NodePosition {
  // Shrink the marker to a small badge centred at the node slot.
  const size = 16;
  return {
    id: pos.id,
    x: pos.x + pos.width / 2 - size / 2,
    y: pos.y + pos.height / 2 - size / 2,
    width: size,
    height: size,
  };
}

/**
 * Compute the set of node/edge IDs to highlight when `focusedId` is hovered
 * or selected. Returns `null` when nothing is focused (all nodes+edges shown
 * at full opacity).
 */
function computeHighlightSet(
  focusedId: string | null,
  nodes: GraphNode[],
  edges: GraphEdge[],
): Set<string> | null {
  if (!focusedId) return null;

  const set = new Set<string>();
  set.add(focusedId);

  const node = nodes.find((n) => n.id === focusedId);
  if (node) {
    for (const e of edges) {
      if (e.kind !== "transition") continue;
      if (e.sourceId === focusedId || e.targetId === focusedId) {
        set.add(e.id);
        set.add(e.sourceId);
        set.add(e.targetId);
      }
    }
    return set;
  }

  const edge = edges.find((e) => e.id === focusedId);
  if (edge && edge.kind === "transition") {
    set.add(edge.sourceId);
    set.add(edge.targetId);
  }
  return set;
}
