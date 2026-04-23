import type {
  Processor,
  State,
  Transition,
  Workflow,
  WorkflowEditorDocument,
} from "@cyoda/workflow-core";
import type { Selection } from "../state/types.js";

export interface ResolvedWorkflow {
  kind: "workflow";
  workflow: Workflow;
}
export interface ResolvedState {
  kind: "state";
  workflow: Workflow;
  stateCode: string;
  state: State;
}
export interface ResolvedTransition {
  kind: "transition";
  workflow: Workflow;
  stateCode: string;
  transition: Transition;
  transitionUuid: string;
  transitionIndex: number;
}
export interface ResolvedProcessor {
  kind: "processor";
  workflow: Workflow;
  stateCode: string;
  transition: Transition;
  transitionUuid: string;
  processor: Processor;
  processorUuid: string;
  processorIndex: number;
}

export type Resolved =
  | ResolvedWorkflow
  | ResolvedState
  | ResolvedTransition
  | ResolvedProcessor
  | null;

function transitionUuidsInOrder(
  doc: WorkflowEditorDocument,
  workflow: string,
  state: string,
): string[] {
  const uuids: string[] = [];
  for (const [uuid, ptr] of Object.entries(doc.meta.ids.transitions)) {
    if (ptr.workflow === workflow && ptr.state === state) uuids.push(uuid);
  }
  return uuids;
}

function processorUuidsInOrder(
  doc: WorkflowEditorDocument,
  transitionUuid: string,
): string[] {
  const uuids: string[] = [];
  for (const [uuid, ptr] of Object.entries(doc.meta.ids.processors)) {
    if (ptr.transitionUuid === transitionUuid) uuids.push(uuid);
  }
  return uuids;
}

export function resolveSelection(
  doc: WorkflowEditorDocument,
  selection: Selection,
): Resolved {
  if (!selection) return null;

  switch (selection.kind) {
    case "workflow": {
      const workflow = doc.session.workflows.find((w) => w.name === selection.workflow);
      return workflow ? { kind: "workflow", workflow } : null;
    }
    case "state": {
      const workflow = doc.session.workflows.find((w) => w.name === selection.workflow);
      if (!workflow) return null;
      const state = workflow.states[selection.stateCode];
      if (!state) return null;
      return { kind: "state", workflow, stateCode: selection.stateCode, state };
    }
    case "transition": {
      const ptr = doc.meta.ids.transitions[selection.transitionUuid];
      if (!ptr) return null;
      const workflow = doc.session.workflows.find((w) => w.name === ptr.workflow);
      if (!workflow) return null;
      const state = workflow.states[ptr.state];
      if (!state) return null;
      const orderedUuids = transitionUuidsInOrder(doc, ptr.workflow, ptr.state);
      const index = orderedUuids.indexOf(selection.transitionUuid);
      if (index < 0) return null;
      const transition = state.transitions[index];
      if (!transition) return null;
      return {
        kind: "transition",
        workflow,
        stateCode: ptr.state,
        transition,
        transitionUuid: selection.transitionUuid,
        transitionIndex: index,
      };
    }
    case "processor": {
      const ptr = doc.meta.ids.processors[selection.processorUuid];
      if (!ptr) return null;
      const workflow = doc.session.workflows.find((w) => w.name === ptr.workflow);
      if (!workflow) return null;
      const state = workflow.states[ptr.state];
      if (!state) return null;
      const txUuids = transitionUuidsInOrder(doc, ptr.workflow, ptr.state);
      const txIndex = txUuids.indexOf(ptr.transitionUuid);
      if (txIndex < 0) return null;
      const transition = state.transitions[txIndex];
      if (!transition) return null;
      const procUuids = processorUuidsInOrder(doc, ptr.transitionUuid);
      const procIndex = procUuids.indexOf(selection.processorUuid);
      if (procIndex < 0) return null;
      const processor = transition.processors?.[procIndex];
      if (!processor) return null;
      return {
        kind: "processor",
        workflow,
        stateCode: ptr.state,
        transition,
        transitionUuid: ptr.transitionUuid,
        processor,
        processorUuid: selection.processorUuid,
        processorIndex: procIndex,
      };
    }
    case "criterion":
      return null;
  }
}

/** Public helper — exported for toolbar/validation code that needs to walk IDs. */
export { transitionUuidsInOrder, processorUuidsInOrder };
