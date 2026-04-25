import { useEffect, useMemo, useState } from "react";
import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
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
  onSelectionChange: (sel: Selection) => void;
  onConnect?: (connection: Connection) => void;
  readOnly?: boolean;
}

function toRfNodes(
  graph: GraphDocument,
  layout: LayoutResult | null,
  activeWorkflow: string | null,
  issuesByNode: Map<string, ValidationIssue[]>,
  selection: Selection,
): Node<RfStateNodeData>[] {
  return graph.nodes
    .filter((n): n is GraphStateNode => n.kind === "state")
    .filter((n) => !activeWorkflow || n.workflow === activeWorkflow)
    .map((n) => {
      const pos = layout?.positions.get(n.id);
      const nodeIssues = issuesByNode.get(n.id) ?? [];
      const hasError = nodeIssues.some((i) => i.severity === "error");
      const hasWarning = nodeIssues.some((i) => i.severity === "warning");
      const selected =
        selection?.kind === "state" && selection.nodeId === n.id;
      // Use the same size estimator as the layout engine so the node's
      // rendered footprint matches its ELK bounding box.
      const size = estimateNodeSize(n.stateCode);
      return {
        id: n.id,
        type: "stateNode",
        data: { node: n, hasError, hasWarning, size },
        position: pos ? { x: pos.x, y: pos.y } : { x: 0, y: 0 },
        selected,
        // Tell React Flow the exact pixel size so its internal hit-testing
        // and handle placement match the rendered node.
        style: { width: size.width, height: size.height },
      };
    });
}

function toRfEdges(
  graph: GraphDocument,
  layout: LayoutResult | null,
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
  const allObstacles = layout
    ? Array.from(layout.positions.values()).map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
      }))
    : [];
  return graph.edges
    .filter((e): e is TransitionEdge => e.kind === "transition")
    .filter((e) => !activeWorkflow || e.workflow === activeWorkflow)
    .map((e) => {
      const target = stateById.get(e.targetId);
      const targetIsTerminal =
        target?.role === "terminal" || target?.role === "initial-terminal";
      const selected =
        selection?.kind === "transition" && selection.transitionUuid === e.id;
      const routePoints = layout?.edges?.get(e.id)?.points;
      const obstacles = allObstacles.filter(
        (o) => o.id !== e.sourceId && o.id !== e.targetId,
      );

      // Detect horizontal back-edges (source is to the right of target).
      // The layout synthesises these as U-arcs exiting/entering from the
      // bottom of each node, so the handle must match.
      const isHorizontalBackEdge =
        !e.isSelf &&
        orientation === "horizontal" &&
        layout !== null &&
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
  onSelectionChange,
  onConnect,
  readOnly,
}: CanvasProps) {
  const [layout, setLayout] = useState<LayoutResult | null>(null);

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
    [preset, orientation, elkOverrides, nodeSize, pinned],
  );

  useEffect(() => {
    let cancelled = false;
    layoutGraph(graph, effectiveOpts).then((result) => {
      if (!cancelled) setLayout(result);
    });
    return () => {
      cancelled = true;
    };
  }, [graph, effectiveOpts]);

  const issuesByNode = useMemo(() => groupIssuesByNode(graph, issues), [graph, issues]);
  const nodes = useMemo(
    () => toRfNodes(graph, layout, activeWorkflow, issuesByNode, selection),
    [graph, layout, activeWorkflow, issuesByNode, selection],
  );
  const edges = useMemo(
    () => toRfEdges(graph, layout, activeWorkflow, selection, orientation),
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
        fitView
        fitViewOptions={{ padding: 0.12 }}
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.25}
        maxZoom={4}
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
