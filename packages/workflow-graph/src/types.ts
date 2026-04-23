import type { EdgeAnchor, ValidationIssue } from "@cyoda/workflow-core";

/**
 * Role of a state in a workflow (spec §10.2.5).
 * - `initial` — the workflow's initialState.
 * - `terminal` — no outgoing transitions.
 * - `initial-terminal` — both (single-state workflow).
 * - `normal` — anything else.
 */
export type StateRole = "initial" | "terminal" | "initial-terminal" | "normal";

export interface StateNode {
  kind: "state";
  /** Synthetic UUID of the state. */
  id: string;
  workflow: string;
  stateCode: string;
  role: StateRole;
  /** True if any outgoing transition is disabled. Purely informational. */
  hasDisabledOutgoing: boolean;
  /**
   * Derived visual category used by the viewer. Not part of the spec roles;
   * derived heuristically. Falls back to "STATE".
   */
  category: "STATE" | "MANUAL_REVIEW" | "PROCESSING_STATE";
}

export interface StartMarkerNode {
  kind: "startMarker";
  /** Deterministic synthetic id: `startmarker:${workflow}`. */
  id: string;
  workflow: string;
}

export type GraphNode = StateNode | StartMarkerNode;

export interface TransitionEdge {
  kind: "transition";
  /** Transition's synthetic UUID. */
  id: string;
  workflow: string;
  sourceId: string;
  targetId: string;
  label: string;
  manual: boolean;
  disabled: boolean;
  /** True when target === source (self-transition). */
  isSelf: boolean;
  /** True when this edge is a back-edge per BFS spanning tree from initial. */
  isLoopback: boolean;
  /** Stable 0-based index within a (source, target) parallel-edge group. */
  parallelIndex: number;
  /** Size of the parallel-edge group this edge belongs to. */
  parallelGroupSize: number;
  /**
   * Optional editor-view anchor overrides (from `WorkflowUiMeta.edgeAnchors`).
   * Projection-time read-only; undefined when no override is persisted.
   */
  sourceAnchor?: EdgeAnchor;
  targetAnchor?: EdgeAnchor;
  summary: TransitionSummary;
}

export interface StartMarkerEdge {
  kind: "startMarker";
  id: string;
  workflow: string;
  sourceId: string;
  targetId: string;
  /** Non-interactive; the viewer/editor must not offer edit affordances. */
  interactive: false;
}

export type GraphEdge = TransitionEdge | StartMarkerEdge;

export interface TransitionSummary {
  /** Truncated display label for the edge chip. */
  display: string;
  /** Full label, for tooltips. */
  full: string;
  criterion?: CriterionSummary;
  processor?: ProcessorSummary;
  execution?: ExecutionSummary;
}

export type CriterionSummary =
  | { kind: "simple"; op: string; path: string }
  | { kind: "function"; name: string }
  | { kind: "lifecycle"; field: string; op: string }
  | { kind: "array"; op: string; path: string }
  | { kind: "group"; operator: "AND" | "OR" | "NOT"; count: number };

export type ProcessorSummary =
  | { kind: "none" }
  | { kind: "single"; name: string }
  | { kind: "multiple"; count: number };

/** Execution-mode badge hint. Only non-default modes are surfaced. */
export type ExecutionSummary =
  | { kind: "sync" }
  | { kind: "asyncSameTx" }
  | { kind: "asyncNewTx" };

export interface GraphAnnotation {
  targetId: string;
  severity: ValidationIssue["severity"];
  code: string;
  message: string;
}

export interface GraphDocument {
  nodes: GraphNode[];
  edges: GraphEdge[];
  annotations: GraphAnnotation[];
}
