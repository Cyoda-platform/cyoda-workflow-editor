import type {
  DomainPatch,
  EditorMetadata,
  ValidationIssue,
  WorkflowEditorDocument,
} from "@cyoda/workflow-core";
import { liftJsonToPatch, serializeForModel, type LiftResult } from "./bridge.js";
import { issuesToMarkers, applyMarkers } from "./markers.js";
import type { EditorLike, MonacoLike, TextModelLike } from "./types.js";

export interface ControllerOptions {
  monaco: MonacoLike;
  editor: EditorLike;
  /** Debounce delay in ms for auto-apply (spec §18.4). Default 300. */
  debounceMs?: number;
  /** If false, edits only apply when the caller calls `apply()` explicitly. */
  autoApply?: boolean;
  /** Called when a lifted patch is ready to dispatch upstream. */
  onPatch: (patch: DomainPatch) => void;
  /** Called with every lift result — lets the UI surface banners / errors. */
  onStatus?: (result: LiftResult) => void;
  /** Called with domain issues so markers can be overlaid. */
  onIssues?: (issues: ValidationIssue[]) => void;
}

export interface WorkflowJsonController {
  /** Re-seed the model from a canonical document. Called whenever the domain
   *  dispatches a patch from *outside* the JSON editor. */
  syncFromDocument(doc: WorkflowEditorDocument): void;
  /** Immediately lift the current model text and dispatch if valid. */
  apply(): LiftResult;
  /** Drop pending debounce and detach listeners. */
  dispose(): void;
  /** Render the supplied validation issues as Monaco model markers. */
  renderIssues(issues: ValidationIssue[], doc: WorkflowEditorDocument): void;
}

/**
 * Wire a Monaco editor instance to the domain layer. Owns the debounce
 * and the `replaceSession` dispatch flow (spec §12.5, §18.4).
 */
export function attachWorkflowJsonController(
  opts: ControllerOptions,
): WorkflowJsonController {
  const { monaco, editor } = opts;
  const debounceMs = opts.debounceMs ?? 300;
  const autoApply = opts.autoApply ?? true;

  let currentDoc: WorkflowEditorDocument | null = null;
  let suppressChange = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let listenerDisposer: { dispose(): void } | null = null;

  function currentMeta(): EditorMetadata | null {
    return currentDoc ? currentDoc.meta : null;
  }

  function currentSerialized(): string | undefined {
    return currentDoc ? serializeForModel(currentDoc) : undefined;
  }

  function liftNow(): LiftResult {
    const model = editor.getModel();
    const meta = currentMeta();
    if (!model || !meta) return { status: "invalid-json", message: "no model" };
    const text = model.getValue();
    const result = liftJsonToPatch(text, meta, currentSerialized());
    opts.onStatus?.(result);
    if (result.status === "ok" || result.status === "semantic-errors") {
      opts.onPatch(result.patch);
      opts.onIssues?.(result.issues);
    }
    return result;
  }

  function scheduleLift() {
    if (!autoApply) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      liftNow();
    }, debounceMs);
  }

  function attachListener() {
    const model = editor.getModel();
    listenerDisposer?.dispose();
    listenerDisposer = null;
    if (!model) return;
    listenerDisposer = model.onDidChangeContent(() => {
      if (suppressChange) return;
      scheduleLift();
    });
  }

  attachListener();

  return {
    syncFromDocument(doc) {
      currentDoc = doc;
      const text = serializeForModel(doc);
      const model = editor.getModel();
      if (!model) return;
      if (model.getValue() === text) return;
      suppressChange = true;
      try {
        model.setValue(text);
      } finally {
        suppressChange = false;
      }
      attachListener();
    },
    apply() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      return liftNow();
    },
    dispose() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = null;
      listenerDisposer?.dispose();
      listenerDisposer = null;
    },
    renderIssues(issues, doc) {
      const model = editor.getModel();
      if (!model) return;
      const markers = issuesToMarkers(monaco, model as TextModelLike, issues, doc.meta, {
        workflows: doc.session.workflows,
      });
      applyMarkers(monaco, model as TextModelLike, markers);
    },
  };
}
