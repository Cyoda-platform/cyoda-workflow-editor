import type { DomainPatch, Transition, WorkflowEditorDocument } from "@cyoda/workflow-core";

/**
 * Canvas edit events emitted by the renderer (React Flow, SVG viewer, etc.)
 * and translated into domain patches by `applyGraphEdit`.
 *
 * Drag-connect yields `transitionDraft` → the UI opens a modal and, only
 * after confirmation, dispatches an `addTransition` event. See spec §11.5.
 */
export type GraphEditEvent =
  | {
      kind: "moveState";
      workflow: string;
      stateCode: string;
      x: number;
      y: number;
    }
  | {
      kind: "renameState";
      workflow: string;
      from: string;
      to: string;
    }
  | {
      kind: "deleteState";
      workflow: string;
      stateCode: string;
    }
  | {
      kind: "addTransition";
      workflow: string;
      fromState: string;
      transition: Transition;
    }
  | {
      kind: "deleteTransition";
      transitionUuid: string;
    }
  | {
      kind: "reorderTransition";
      workflow: string;
      fromState: string;
      transitionUuid: string;
      toIndex: number;
    }
  | {
      kind: "toggleDisabled";
      transitionUuid: string;
      disabled: boolean;
    }
  | {
      kind: "toggleManual";
      transitionUuid: string;
      manual: boolean;
    };

/**
 * Translate a canvas edit event into a sequence of domain patches.
 * This layer is purely mechanical; it never opens modals or validates —
 * callers are responsible for confirming destructive ops.
 *
 * `moveState` does not emit a patch (layout state lives in
 * `EditorMetadata.workflowUi`, which is outside the domain-patch space).
 */
export function applyGraphEdit(
  _doc: WorkflowEditorDocument,
  event: GraphEditEvent,
): DomainPatch[] {
  switch (event.kind) {
    case "moveState":
      return [];
    case "renameState":
      return [
        { op: "renameState", workflow: event.workflow, from: event.from, to: event.to },
      ];
    case "deleteState":
      return [
        { op: "removeState", workflow: event.workflow, stateCode: event.stateCode },
      ];
    case "addTransition":
      return [
        {
          op: "addTransition",
          workflow: event.workflow,
          fromState: event.fromState,
          transition: event.transition,
        },
      ];
    case "deleteTransition":
      return [{ op: "removeTransition", transitionUuid: event.transitionUuid }];
    case "reorderTransition":
      return [
        {
          op: "reorderTransition",
          workflow: event.workflow,
          fromState: event.fromState,
          transitionUuid: event.transitionUuid,
          toIndex: event.toIndex,
        },
      ];
    case "toggleDisabled":
      return [
        {
          op: "updateTransition",
          transitionUuid: event.transitionUuid,
          updates: { disabled: event.disabled },
        },
      ];
    case "toggleManual":
      return [
        {
          op: "updateTransition",
          transitionUuid: event.transitionUuid,
          updates: { manual: event.manual },
        },
      ];
  }
}
