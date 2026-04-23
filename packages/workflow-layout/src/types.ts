import type { GraphDocument } from "@cyoda/workflow-graph";

export type LayoutPreset = "websiteCompact" | "configuratorReadable" | "opsAudit";

export interface NodePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgeWaypoint {
  x: number;
  y: number;
}

export interface EdgeRoute {
  id: string;
  /** Full polyline, starting at the source edge, ending at the target edge. */
  points: EdgeWaypoint[];
  /** Centroid hint for chip placement. */
  labelX: number;
  labelY: number;
}

export interface LayoutResult {
  positions: Map<string, NodePosition>;
  edges: Map<string, EdgeRoute>;
  width: number;
  height: number;
  preset: LayoutPreset;
}

export interface PinnedNode {
  id: string;
  x: number;
  y: number;
}

export interface LayoutOptions {
  preset?: LayoutPreset;
  /** Default node size (layout will treat every state as this size). */
  nodeSize?: { width: number; height: number };
  /** Nodes whose positions are fixed and must be respected. */
  pinned?: PinnedNode[];
}

export interface ElkLayoutAdapter {
  layoutGraph(
    graph: GraphDocument,
    options?: LayoutOptions,
  ): Promise<LayoutResult>;
}
