import { useCallback, useEffect, useMemo, useState } from "react";
import type { Connection } from "reactflow";
import type {
  DomainPatch,
  Workflow,
  WorkflowEditorDocument,
} from "@cyoda/workflow-core";
import { I18nContext, mergeMessages, type PartialMessages } from "../i18n/context.js";
import { useEditorStore } from "../state/store.js";
import { deriveFromDocument } from "../state/derive.js";
import type { EditorMode, Selection } from "../state/types.js";
import { Canvas } from "./Canvas.js";
import { Inspector } from "../inspector/Inspector.js";
import { Toolbar } from "../toolbar/Toolbar.js";
import { WorkflowTabs } from "../toolbar/WorkflowTabs.js";
import { DeleteStateModal } from "../modals/DeleteStateModal.js";
import { DragConnectModal } from "../modals/DragConnectModal.js";

export interface WorkflowEditorProps {
  document: WorkflowEditorDocument;
  mode?: EditorMode;
  messages?: PartialMessages;
  onChange?: (doc: WorkflowEditorDocument) => void;
  onSave?: (doc: WorkflowEditorDocument) => void;
}

interface PendingDelete {
  workflow: string;
  stateCode: string;
}

interface PendingConnect {
  workflow: string;
  fromState: string;
  toState: string;
}

function defaultNewWorkflow(existing: string[]): Workflow {
  let n = existing.length + 1;
  while (existing.includes(`workflow${n}`)) n++;
  return {
    version: "1.0",
    name: `workflow${n}`,
    initialState: "start",
    active: true,
    states: { start: { transitions: [] } },
  };
}

/** Top-level editor shell — spec §14. Provides viewer/playground/editor modes. */
export function WorkflowEditor({
  document: initialDocument,
  mode = "editor",
  messages,
  onChange,
  onSave,
}: WorkflowEditorProps) {
  const mergedMessages = useMemo(() => mergeMessages(messages), [messages]);
  const [state, actions] = useEditorStore(initialDocument, mode);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [pendingConnect, setPendingConnect] = useState<PendingConnect | null>(null);

  useEffect(() => {
    onChange?.(state.document);
  }, [state.document, onChange]);

  const readOnly = state.mode === "viewer";
  const derived = useMemo(
    () => deriveFromDocument(state.document),
    [state.document.meta.revision, state.document],
  );

  const dispatch = (patch: DomainPatch) => actions.dispatch(patch);

  const requestDeleteState = (workflow: string, stateCode: string) => {
    setPendingDelete({ workflow, stateCode });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    dispatch({
      op: "removeState",
      workflow: pendingDelete.workflow,
      stateCode: pendingDelete.stateCode,
    });
    setPendingDelete(null);
  };

  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const resolvedSource = state.document.session.workflows
      .flatMap((w) => Object.entries(w.states).map(([code, s]) => ({ wf: w, code, s })))
      .find((e) => {
        const srcStateId = state.document.meta.ids.workflows[e.wf.name];
        // Canvas nodes carry the synthetic state id via toRfNodes, so we match by id lookup.
        const stateUuid = Object.entries(state.document.meta.ids.states).find(
          ([, ptr]) => ptr.workflow === e.wf.name && ptr.state === e.code,
        )?.[0];
        return stateUuid === connection.source || srcStateId === connection.source;
      });
    const resolvedTarget = state.document.session.workflows
      .flatMap((w) => Object.entries(w.states).map(([code, s]) => ({ wf: w, code, s })))
      .find((e) => {
        const stateUuid = Object.entries(state.document.meta.ids.states).find(
          ([, ptr]) => ptr.workflow === e.wf.name && ptr.state === e.code,
        )?.[0];
        return stateUuid === connection.target;
      });
    if (!resolvedSource || !resolvedTarget) return;
    if (resolvedSource.wf.name !== resolvedTarget.wf.name) return;
    setPendingConnect({
      workflow: resolvedSource.wf.name,
      fromState: resolvedSource.code,
      toState: resolvedTarget.code,
    });
  };

  const confirmConnect = (name: string) => {
    if (!pendingConnect) return;
    dispatch({
      op: "addTransition",
      workflow: pendingConnect.workflow,
      fromState: pendingConnect.fromState,
      transition: {
        name,
        next: pendingConnect.toState,
        manual: false,
        disabled: false,
      },
    });
    setPendingConnect(null);
  };

  const workflows = state.document.session.workflows;
  const showTabs = workflows.length > 1 || state.mode !== "viewer";

  const anyModalOpen = pendingDelete !== null || pendingConnect !== null;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (anyModalOpen) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        if (!readOnly && state.undoStack.length > 0) {
          e.preventDefault();
          actions.undo();
        }
        return;
      }
      if (mod && ((e.key === "z" && e.shiftKey) || e.key === "y" || e.key === "Y")) {
        if (!readOnly && state.redoStack.length > 0) {
          e.preventDefault();
          actions.redo();
        }
        return;
      }
      if (mod && (e.key === "s" || e.key === "S")) {
        if (onSave && !readOnly && derived.errorCount === 0) {
          e.preventDefault();
          onSave(state.document);
        }
        return;
      }
    },
    [
      anyModalOpen,
      readOnly,
      state.undoStack.length,
      state.redoStack.length,
      state.document,
      actions,
      onSave,
      derived.errorCount,
    ],
  );

  const pendingConnectState = useMemo(() => {
    if (!pendingConnect) return null;
    const wf = state.document.session.workflows.find(
      (w) => w.name === pendingConnect.workflow,
    );
    if (!wf) return null;
    return wf.states[pendingConnect.fromState] ?? null;
  }, [pendingConnect, state.document]);

  return (
    <I18nContext.Provider value={mergedMessages}>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", system-ui, sans-serif',
          outline: "none",
        }}
        data-testid="workflow-editor"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <Toolbar
          derived={derived}
          canUndo={state.undoStack.length > 0}
          canRedo={state.redoStack.length > 0}
          readOnly={readOnly}
          onUndo={actions.undo}
          onRedo={actions.redo}
          onSave={onSave ? () => onSave(state.document) : undefined}
        />
        {showTabs && (
          <WorkflowTabs
            workflows={workflows}
            activeWorkflow={state.activeWorkflow}
            readOnly={readOnly}
            onSelect={actions.setActiveWorkflow}
            onAdd={() =>
              dispatch({
                op: "addWorkflow",
                workflow: defaultNewWorkflow(workflows.map((w) => w.name)),
              })
            }
            onClose={(name) => dispatch({ op: "removeWorkflow", workflow: name })}
          />
        )}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Canvas
              graph={derived.graph}
              issues={derived.issues}
              activeWorkflow={state.activeWorkflow}
              selection={state.selection}
              onSelectionChange={(sel: Selection) => actions.setSelection(sel)}
              onConnect={handleConnect}
              readOnly={readOnly}
            />
          </div>
          <Inspector
            document={state.document}
            selection={state.selection}
            issues={derived.issues}
            readOnly={readOnly}
            onDispatch={dispatch}
            onSelectionChange={actions.setSelection}
            onRequestDeleteState={requestDeleteState}
          />
        </div>
        {pendingDelete && (
          <DeleteStateModal
            document={state.document}
            workflow={pendingDelete.workflow}
            stateCode={pendingDelete.stateCode}
            onConfirm={confirmDelete}
            onCancel={() => setPendingDelete(null)}
          />
        )}
        {pendingConnect && pendingConnectState && (
          <DragConnectModal
            source={pendingConnectState}
            fromState={pendingConnect.fromState}
            toState={pendingConnect.toState}
            onCreate={confirmConnect}
            onCancel={() => setPendingConnect(null)}
          />
        )}
      </div>
    </I18nContext.Provider>
  );
}
