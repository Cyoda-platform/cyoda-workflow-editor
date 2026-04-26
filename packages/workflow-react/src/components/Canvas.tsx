import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Viewport,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import type { ValidationIssue } from "@cyoda/workflow-core";
import type {
  GraphDocument,
  StateNode as GraphStateNode,
  TransitionEdge,
} from "@cyoda/workflow-graph";
import { layoutGraph, estimateNodeSize, type LayoutOptions, type LayoutResult } from "@cyoda/workflow-layout";
import { ArrowMarkers } from "./ArrowMarkers.js";
import { RfStateNode, type RfStateNodeData } from "./RfStateNode.js";
import { RfTransitionEdge, type RfEdgeData } from "./RfTransitionEdge.js";
import type { Selection } from "../state/types.js";

const nodeTypes = { stateNode: RfStateNode };
const edgeTypes = { transition: RfTransitionEdge };

export interface CanvasProps {
  graph: GraphDocument;
  issues: ValidationIssue[];
  activeWorkflow: string | null;
  selection: Selection;
  layoutOptions?: LayoutOptions;
  savedViewport?: Viewport;
  onSelectionChange: (sel: Selection) => void;
  onViewportChange?: (viewport: Viewport) => void;
  onConnect?: (connection: Connection) => void;
  readOnly?: boolean;
}

function toRfNodes(
  graph: GraphDocument,
  layout: LayoutResult,
  activeWorkflow: string | null,
  issuesByNode: Map<string, ValidationIssue[]>,
  selection: Selection,
): Node<RfStateNodeData>[] {
  return graph.nodes
    .filter((n): n is GraphStateNode => n.kind === "state")
    .filter((n) => !activeWorkflow || n.workflow === activeWorkflow)
    .map((n) => {
      const pos = layout.positions.get(n.id);
      const nodeIssues = issuesByNode.get(n.id) ?? [];
      const hasError = nodeIssues.some((i) => i.severity === "error");
      const hasWarning = nodeIssues.some((i) => i.severity === "warning");
      const selected =
        selection?.kind === "state" && selection.nodeId === n.id;
      const size = pos
        ? { width: pos.width, height: pos.height }
        : estimateNodeSize(n.stateCode);
      return {
        id: n.id,
        type: "stateNode",
        data: { node: n, hasError, hasWarning, size },
        position: pos ? { x: pos.x, y: pos.y } : { x: 0, y: 0 },
        selected,
        // width/height on the node object tells ReactFlow the dimensions
        // before ResizeObserver fires. fitView's nodesInitialized guard
        // (nodes.every(n => n.width && n.height)) requires these to be set
        // or it returns false and leaves the viewport at {x:0, y:0, zoom:1}.
        width: size.width,
        height: size.height,
        style: { width: size.width, height: size.height },
      };
    });
}

function toRfEdges(
  graph: GraphDocument,
  layout: LayoutResult,
  activeWorkflow: string | null,
  selection: Selection,
  orientation: "vertical" | "horizontal",
): Edge<RfEdgeData>[] {
  const stateById = new Map(
    graph.nodes
      .filter((n): n is GraphStateNode => n.kind === "state")
      .map((n) => [n.id, n]),
  );
  // Precompute obstacle bounding boxes once per render.
  const allObstacles = Array.from(layout.positions.values()).map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
  }));
  return graph.edges
    .filter((e): e is TransitionEdge => e.kind === "transition")
    .filter((e) => !activeWorkflow || e.workflow === activeWorkflow)
    .map((e) => {
      const target = stateById.get(e.targetId);
      const targetIsTerminal =
        target?.role === "terminal" || target?.role === "initial-terminal";
      const selected =
        selection?.kind === "transition" && selection.transitionUuid === e.id;
      const route = layout.edges.get(e.id);
      const routePoints = route?.points;
      const obstacles = allObstacles.filter(
        (o) => o.id !== e.sourceId && o.id !== e.targetId,
      );

      // Detect horizontal back-edges (source is to the right of target).
      // The layout synthesises these as U-arcs exiting/entering from the
      // bottom of each node, so the handle must match.
      const isHorizontalBackEdge =
        !e.isSelf &&
        orientation === "horizontal" &&
        (layout.positions.get(e.sourceId)?.x ?? 0) >
          (layout.positions.get(e.targetId)?.x ?? 0);

      return {
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        sourceHandle: anchorHandleId(e.sourceAnchor, "source", orientation, isHorizontalBackEdge),
        targetHandle: anchorHandleId(e.targetAnchor, "target", orientation, isHorizontalBackEdge),
        type: "transition",
        data: {
          edge: e,
          targetIsTerminal: !!targetIsTerminal,
          routePoints,
          labelX: route?.labelX,
          labelY: route?.labelY,
          labelWidth: route?.labelWidth,
          labelHeight: route?.labelHeight,
          obstacles,
        },
        selected,
      };
    });
}

/**
 * Resolve the React Flow handle ID for an edge endpoint.
 *
 * Explicit per-edge anchor overrides always win. When no override is stored,
 * defaults depend on orientation and whether the edge is a back-edge:
 *
 * | orientation | edge type | source  | target |
 * |-------------|-----------|---------|--------|
 * | vertical    | any       | bottom  | top    |
 * | horizontal  | forward   | right   | left   |
 * | horizontal  | back      | bottom  | bottom |
 *
 * Back-edges in horizontal mode use bottom/bottom because the layout engine
 * synthesises their routes as U-arcs that exit and enter from the node bottom.
 */
function anchorHandleId(
  anchor: TransitionEdge["sourceAnchor"],
  role: "source" | "target",
  orientation: "vertical" | "horizontal",
  isBackEdge = false,
): string | undefined {
  if (anchor) return anchor;
  if (orientation === "horizontal") {
    if (isBackEdge) return "bottom";
    return role === "source" ? "right" : "left";
  }
  return role === "source" ? "bottom" : "top";
}

function groupIssuesByNode(
  graph: GraphDocument,
  issues: ValidationIssue[],
): Map<string, ValidationIssue[]> {
  const byNode = new Map<string, ValidationIssue[]>();
  for (const ann of graph.annotations) {
    const list = byNode.get(ann.targetId) ?? [];
    const issue = issues.find((i) => i.code === ann.code);
    if (issue) list.push(issue);
    byNode.set(ann.targetId, list);
  }
  return byNode;
}

function CanvasInner({
  graph,
  issues,
  activeWorkflow,
  selection,
  layoutOptions,
  savedViewport,
  onSelectionChange,
  onViewportChange,
  onConnect,
  readOnly,
}: CanvasProps) {
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const rf = useReactFlow();

  // Extract primitive fields so the effect dep array is stable even when the
  // consumer passes a new object literal on every parent render.
  const preset = layoutOptions?.preset ?? "configuratorReadable";
  const orientation = layoutOptions?.orientation ?? "vertical";
  const elkOverrides = layoutOptions?.elk;
  const nodeSize = layoutOptions?.nodeSize;
  const pinned = layoutOptions?.pinned;

  const effectiveOpts = useMemo<LayoutOptions>(
    () => ({ preset, orientation, elk: elkOverrides, nodeSize, pinned }),
    // elkOverrides / nodeSize / pinned are objects; they are rarely supplied
    // in practice, so a reference change there is an intentional re-layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, orientation, elkOverrides, nodeSize, pinned],
  );

  // Track which orientation was in effect when each layout was triggered, so
  // that the fitView guard can tell whether layout changed due to an
  // orientation switch (which requires a refit) vs. a graph edit (no refit).
  const orientationAtLayoutRef = useRef(orientation);

  useEffect(() => {
    let cancelled = false;
    orientationAtLayoutRef.current = orientation;
    layoutGraph(graph, effectiveOpts).then((result) => {
      if (!cancelled) setLayout(result);
    });
    return () => {
      cancelled = true;
    };
  }, [graph, effectiveOpts, orientation]);

  // ── Viewport fit ────────────────────────────────────────────────────────────
  //
  // Rules:
  //  1. Never fit while layout is still pending — nodes would be at (0,0).
  //  2. Fit once on the first completed layout (initial load / reload).
  //  3. Refit when the graph orientation changes (new layout = different bounds).
  //  4. Do NOT refit on subsequent graph edits — preserve the user's zoom/pan.
  //  5. Cap maxZoom at 1.2 so small graphs do not blow up absurdly.
  //
  // A requestAnimationFrame defers the call until React Flow has committed the
  // new node positions to the DOM, which is required for correct bounds.

  const lastHandledViewportKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!layout) return;
    const viewportKey = `${activeWorkflow ?? "__all__"}:${orientationAtLayoutRef.current}`;
    if (lastHandledViewportKeyRef.current === viewportKey) return;

    const rafId = requestAnimationFrame(() => {
      if (savedViewport) {
        void rf.setViewport(savedViewport, { duration: 0 });
        lastHandledViewportKeyRef.current = viewportKey;
      } else {
        const stateCount = graph.nodes.filter(
          (node): node is GraphStateNode =>
            node.kind === "state" &&
            (!activeWorkflow || node.workflow === activeWorkflow),
        ).length;
        const fitOptions =
          stateCount <= 6
            ? { padding: 0.12, maxZoom: 1 }
            : { padding: 0.12 };
        // fitView returns false if nodes are not yet initialized in the
        // ReactFlow store (nodesInitialized guard). Only mark the key as
        // handled when the fit actually ran, so a retry happens if needed.
        const fitted = rf.fitView(fitOptions);
        if (fitted) lastHandledViewportKeyRef.current = viewportKey;
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [activeWorkflow, graph.nodes, layout, rf, savedViewport]);

  // ── Derived RF data ─────────────────────────────────────────────────────────
  //
  // Critically: nodes and edges are EMPTY until the layout result is available.
  //
  // Before layout resolves, every node position is (0,0). React Flow would
  // then compute edge handles at the origin, causing all edge-label overlays to
  // pile up in the top-left corner — and fitView would zoom into empty space.
  // Deferring until layout is ready avoids both problems with no user-visible
  // cost (ELK typically resolves in < 150 ms for typical workflow sizes).

  const issuesByNode = useMemo(() => groupIssuesByNode(graph, issues), [graph, issues]);

  const nodes = useMemo(
    () =>
      layout
        ? toRfNodes(graph, layout, activeWorkflow, issuesByNode, selection)
        : [],
    [graph, layout, activeWorkflow, issuesByNode, selection],
  );

  const edges = useMemo(
    () =>
      layout
        ? toRfEdges(graph, layout, activeWorkflow, selection, orientation)
        : [],
    [graph, layout, activeWorkflow, selection, orientation],
  );

  const onNodeClick: NodeMouseHandler = (_, node) => {
    const data = node.data as RfStateNodeData;
    onSelectionChange({
      kind: "state",
      workflow: data.node.workflow,
      stateCode: data.node.stateCode,
      nodeId: data.node.id,
    });
  };

  const onEdgeClick: EdgeMouseHandler = (_, edge) => {
    onSelectionChange({ kind: "transition", transitionUuid: edge.id });
  };

  return (
    <div style={{ width: "100%", height: "100%" }} data-testid="workflow-canvas">
      <ArrowMarkers />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={() => onSelectionChange(null)}
        onConnect={readOnly ? undefined : onConnect}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        // fitView is intentionally absent — handled imperatively after layout.
        // See the fitView useEffect above for the reasoning.
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.1}
        maxZoom={4}
        onMoveEnd={(_, viewport) => {
          if (layout) onViewportChange?.(viewport);
        }}
      >
        <Background />
        <Controls showInteractive={false} />
        <MiniMap zoomable pannable />
      </ReactFlow>
    </div>
  );
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
