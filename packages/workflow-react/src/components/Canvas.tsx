import { useEffect, useMemo, useState } from "react";
import {
  Background,
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
import { layoutGraph, type LayoutResult } from "@cyoda/workflow-layout";
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
      return {
        id: n.id,
        type: "stateNode",
        data: { node: n, hasError, hasWarning },
        position: pos ? { x: pos.x, y: pos.y } : { x: 0, y: 0 },
        selected,
      };
    });
}

function toRfEdges(
  graph: GraphDocument,
  layout: LayoutResult | null,
  activeWorkflow: string | null,
  selection: Selection,
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
      return {
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        sourceHandle: anchorHandleId(e.sourceAnchor, "source"),
        targetHandle: anchorHandleId(e.targetAnchor, "target"),
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

function anchorHandleId(
  anchor: TransitionEdge["sourceAnchor"],
  role: "source" | "target",
): string | undefined {
  if (anchor) return `${anchor}-${role}`;
  // Default handles (no explicit anchor set): bottom for source, top for target.
  return role === "source" ? "bottom-source" : "top-target";
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
  onSelectionChange,
  onConnect,
  readOnly,
}: CanvasProps) {
  const [layout, setLayout] = useState<LayoutResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    layoutGraph(graph, { preset: "configuratorReadable" }).then((result) => {
      if (!cancelled) setLayout(result);
    });
    return () => {
      cancelled = true;
    };
  }, [graph]);

  const issuesByNode = useMemo(() => groupIssuesByNode(graph, issues), [graph, issues]);
  const nodes = useMemo(
    () => toRfNodes(graph, layout, activeWorkflow, issuesByNode, selection),
    [graph, layout, activeWorkflow, issuesByNode, selection],
  );
  const edges = useMemo(
    () => toRfEdges(graph, layout, activeWorkflow, selection),
    [graph, layout, activeWorkflow, selection],
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
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        fitView
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
