import type { WorkflowSession } from "./session.js";
import type { StateCode } from "./workflow.js";

export interface WorkflowEditorDocument {
  session: WorkflowSession;
  meta: EditorMetadata;
}

export interface EditorMetadata {
  revision: number;
  ids: SyntheticIdMap;
  workflowUi: Record<string, WorkflowUiMeta>;
  lastValidJsonHash?: string;
}

export interface SyntheticIdMap {
  workflows: Record<string, string>;
  states: Record<string, StatePointer>;
  transitions: Record<string, TransitionPointer>;
  processors: Record<string, ProcessorPointer>;
  criteria: Record<string, CriterionPointer>;
}

export interface StatePointer {
  workflow: string;
  state: string;
}

export interface TransitionPointer {
  workflow: string;
  state: string;
  transitionUuid: string;
}

export interface ProcessorPointer {
  workflow: string;
  state: string;
  transitionUuid: string;
  processorUuid: string;
}

export interface CriterionPointer {
  host: HostRef;
  path: string[];
}

export type HostRef =
  | { kind: "workflow"; workflow: string }
  | { kind: "transition"; workflow: string; state: string; transitionUuid: string }
  | {
      kind: "processorConfig";
      workflow: string;
      state: string;
      transitionUuid: string;
      processorUuid: string;
    };

/**
 * Editor-only anchor side for an edge endpoint. Lives in WorkflowUiMeta and
 * is never serialised into exported Cyoda JSON.
 */
export type EdgeAnchor = "top" | "right" | "bottom" | "left";

export interface EdgeAnchorPair {
  source?: EdgeAnchor;
  target?: EdgeAnchor;
}

export interface WorkflowUiMeta {
  layout?: {
    nodes: Record<StateCode, { x: number; y: number; pinned?: boolean }>;
  };
  collapsedStates?: string[];
  viewPreset?: "compact" | "ops" | "website";
  selectedId?: string;
  /**
   * Per-transition anchor overrides keyed by synthetic transition UUID.
   * Missing entries (or entries with missing `source`/`target`) fall back
   * to heuristic defaults computed at projection time.
   */
  edgeAnchors?: Record<string, EdgeAnchorPair>;
}
