import { useCallback, useMemo, useRef, useState } from "react";
import {
  applyPatch,
  invertPatch,
  type DomainPatch,
  type WorkflowEditorDocument,
} from "@cyoda/workflow-core";
import type {
  EditorActions,
  EditorMode,
  EditorState,
  Selection,
  UndoEntry,
} from "./types.js";

const MAX_UNDO = 100;

function summarize(patch: DomainPatch): string {
  switch (patch.op) {
    case "addWorkflow":
      return `Add workflow "${patch.workflow.name}"`;
    case "removeWorkflow":
      return `Remove workflow "${patch.workflow}"`;
    case "updateWorkflowMeta":
      return `Update workflow "${patch.workflow}"`;
    case "renameWorkflow":
      return `Rename workflow "${patch.from}" → "${patch.to}"`;
    case "setInitialState":
      return `Set initial state to "${patch.stateCode}"`;
    case "setWorkflowCriterion":
      return patch.criterion
        ? `Set workflow criterion`
        : `Clear workflow criterion`;
    case "addState":
      return `Add state "${patch.stateCode}"`;
    case "renameState":
      return `Rename state "${patch.from}" → "${patch.to}"`;
    case "removeState":
      return `Remove state "${patch.stateCode}"`;
    case "addTransition":
      return `Add transition "${patch.transition.name}"`;
    case "updateTransition":
      return `Update transition`;
    case "removeTransition":
      return `Remove transition`;
    case "reorderTransition":
      return `Reorder transition`;
    case "addProcessor":
      return `Add processor "${patch.processor.name}"`;
    case "updateProcessor":
      return `Update processor`;
    case "removeProcessor":
      return `Remove processor`;
    case "reorderProcessor":
      return `Reorder processor`;
    case "setCriterion":
      return patch.criterion ? `Set criterion` : `Clear criterion`;
    case "setImportMode":
      return `Set import mode to "${patch.mode}"`;
    case "setEntity":
      return patch.entity ? `Set entity` : `Clear entity`;
    case "replaceSession":
      return `Replace session`;
    case "setEdgeAnchors":
      return patch.anchors ? `Update edge anchors` : `Clear edge anchors`;
  }
}

function pickDefaultActiveWorkflow(doc: WorkflowEditorDocument): string | null {
  return doc.session.workflows[0]?.name ?? null;
}

export function useEditorStore(
  initialDocument: WorkflowEditorDocument,
  initialMode: EditorMode = "editor",
): [EditorState, EditorActions] {
  const [state, setState] = useState<EditorState>(() => ({
    document: initialDocument,
    selection: null,
    activeWorkflow: pickDefaultActiveWorkflow(initialDocument),
    mode: initialMode,
    undoStack: [],
    redoStack: [],
  }));

  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((patch: DomainPatch, summary?: string) => {
    const current = stateRef.current;
    if (current.mode === "viewer") return;
    const nextDoc = applyPatch(current.document, patch);
    const inverse = invertPatch(current.document, patch);
    const entry: UndoEntry = {
      forward: patch,
      inverse,
      summary: summary ?? summarize(patch),
    };
    const undoStack = [...current.undoStack, entry].slice(-MAX_UNDO);
    setState({
      ...current,
      document: nextDoc,
      undoStack,
      redoStack: [],
      activeWorkflow: reconcileActiveWorkflow(current.activeWorkflow, nextDoc),
      selection: reconcileSelection(current.selection, nextDoc),
    });
  }, []);

  const silentReplace = useCallback((
    document: WorkflowEditorDocument,
    options?: { preserveEditorState?: boolean },
  ) => {
    const current = stateRef.current;
    if (options?.preserveEditorState) {
      setState({
        ...current,
        document,
        activeWorkflow: reconcileActiveWorkflow(current.activeWorkflow, document),
        selection: reconcileSelection(current.selection, document),
      });
      return;
    }
    setState({
      ...current,
      document,
      undoStack: [],
      redoStack: [],
      activeWorkflow: pickDefaultActiveWorkflow(document),
      selection: null,
    });
  }, []);

  const undo = useCallback(() => {
    const current = stateRef.current;
    const top = current.undoStack[current.undoStack.length - 1];
    if (!top) return;
    const reverted = applyPatch(current.document, top.inverse);
    setState({
      ...current,
      document: reverted,
      undoStack: current.undoStack.slice(0, -1),
      redoStack: [...current.redoStack, top],
      activeWorkflow: reconcileActiveWorkflow(current.activeWorkflow, reverted),
      selection: reconcileSelection(current.selection, reverted),
    });
  }, []);

  const redo = useCallback(() => {
    const current = stateRef.current;
    const top = current.redoStack[current.redoStack.length - 1];
    if (!top) return;
    const next = applyPatch(current.document, top.forward);
    setState({
      ...current,
      document: next,
      undoStack: [...current.undoStack, top],
      redoStack: current.redoStack.slice(0, -1),
      activeWorkflow: reconcileActiveWorkflow(current.activeWorkflow, next),
      selection: reconcileSelection(current.selection, next),
    });
  }, []);

  const setSelection = useCallback((sel: Selection) => {
    setState((s) => ({ ...s, selection: sel }));
  }, []);

  const setActiveWorkflow = useCallback((name: string | null) => {
    setState((s) => ({ ...s, activeWorkflow: name, selection: null }));
  }, []);

  const setMode = useCallback((mode: EditorMode) => {
    setState((s) => ({ ...s, mode }));
  }, []);

  const actions = useMemo<EditorActions>(
    () => ({ dispatch, silentReplace, undo, redo, setSelection, setActiveWorkflow, setMode }),
    [dispatch, silentReplace, undo, redo, setSelection, setActiveWorkflow, setMode],
  );

  return [state, actions];
}

/**
 * After a patch the active workflow may have been renamed or removed; pick a
 * sensible fallback rather than leaving a dangling reference.
 */
function reconcileActiveWorkflow(
  current: string | null,
  doc: WorkflowEditorDocument,
): string | null {
  if (!current) return doc.session.workflows[0]?.name ?? null;
  const hit = doc.session.workflows.find((w) => w.name === current);
  if (hit) return current;
  return doc.session.workflows[0]?.name ?? null;
}

/**
 * After a patch the selected node/edge may no longer exist. Clear selections
 * that became dangling.
 */
function reconcileSelection(
  selection: Selection,
  doc: WorkflowEditorDocument,
): Selection {
  if (!selection) return null;
  const { ids } = doc.meta;
  switch (selection.kind) {
    case "workflow": {
      const hit = doc.session.workflows.find((w) => w.name === selection.workflow);
      return hit ? selection : null;
    }
    case "state": {
      const wf = doc.session.workflows.find((w) => w.name === selection.workflow);
      if (!wf || !wf.states[selection.stateCode]) return null;
      return selection;
    }
    case "transition":
      return ids.transitions[selection.transitionUuid] ? selection : null;
    case "processor":
      return ids.processors[selection.processorUuid] ? selection : null;
    case "criterion":
      return ids.criteria[selection.hostId] ||
        ids.workflows[selection.hostId] ||
        ids.transitions[selection.hostId]
        ? selection
        : null;
  }
}
