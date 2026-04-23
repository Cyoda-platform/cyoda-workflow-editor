import { getLocation, parseTree, findNodeAtLocation } from "jsonc-parser";
import type { EditorMetadata, WorkflowEditorDocument } from "@cyoda/workflow-core";
import { orderingFromSession, pathForId, type JsonPath } from "./pointer.js";
import type { EditorLike, TextModelLike } from "./types.js";

/**
 * Map a character offset inside the raw JSON text back to a synthetic UUID
 * (spec §15.5). Walks up the JSON path until it hits a segment that matches
 * a known entity: workflow, state, transition, processor, or criterion.
 *
 * Returns null when the cursor is over JSON that doesn't correspond to a
 * selectable entity (e.g. top-level `importMode`).
 */
export function idAtOffset(
  text: string,
  offset: number,
  doc: WorkflowEditorDocument,
): string | null {
  const loc = getLocation(text, offset);
  const path = loc.path;
  if (path.length === 0) return null;

  const meta = doc.meta;
  const wfs = doc.session.workflows;

  // Walk shortest-meaningful-prefix → longest so we end up with the most
  // specific entity (e.g. prefer processor over its parent transition).
  let best: string | null = null;
  for (let end = 1; end <= path.length; end++) {
    const prefix = path.slice(0, end);
    const id = idForJsonPath(prefix, wfs, meta);
    if (id) best = id;
  }
  return best;
}

function idForJsonPath(
  path: Array<string | number>,
  wfs: WorkflowEditorDocument["session"]["workflows"],
  meta: EditorMetadata,
): string | null {
  if (path[0] !== "workflows" || typeof path[1] !== "number") return null;
  const wf = wfs[path[1]];
  if (!wf) return null;

  if (path.length === 2) return meta.ids.workflows[wf.name] ?? null;

  if (path[2] !== "states" || typeof path[3] !== "string") return null;
  const stateCode = path[3];

  if (path.length === 4) {
    const entry = Object.entries(meta.ids.states).find(
      ([, ptr]) => ptr.workflow === wf.name && ptr.state === stateCode,
    );
    return entry ? entry[0] : null;
  }

  if (path[4] !== "transitions" || typeof path[5] !== "number") return null;
  const tIdx = path[5];

  const transitionUuid = findTransitionUuidByOrdinal(wf.name, stateCode, tIdx, meta);
  if (!transitionUuid) return null;
  if (path.length === 6) return transitionUuid;

  if (path[6] === "processors" && typeof path[7] === "number") {
    const pIdx = path[7];
    const processorUuid = findProcessorUuidByOrdinal(
      wf.name,
      stateCode,
      transitionUuid,
      pIdx,
      meta,
    );
    return processorUuid ?? transitionUuid;
  }

  return transitionUuid;
}

function findTransitionUuidByOrdinal(
  workflow: string,
  state: string,
  ordinal: number,
  meta: EditorMetadata,
): string | null {
  let i = 0;
  for (const [uuid, ptr] of Object.entries(meta.ids.transitions)) {
    if (ptr.workflow === workflow && ptr.state === state) {
      if (i === ordinal) return uuid;
      i++;
    }
  }
  return null;
}

function findProcessorUuidByOrdinal(
  workflow: string,
  state: string,
  transitionUuid: string,
  ordinal: number,
  meta: EditorMetadata,
): string | null {
  let i = 0;
  for (const [uuid, ptr] of Object.entries(meta.ids.processors)) {
    if (
      ptr.workflow === workflow &&
      ptr.state === state &&
      ptr.transitionUuid === transitionUuid
    ) {
      if (i === ordinal) return uuid;
      i++;
    }
  }
  return null;
}

/**
 * Reveal and select the range of the JSON node that corresponds to the given
 * synthetic UUID. No-op if the UUID is unknown or the model is empty.
 */
export function revealIdInEditor(
  editor: EditorLike,
  doc: WorkflowEditorDocument,
  id: string,
): boolean {
  const model = editor.getModel();
  if (!model) return false;
  const ordering = orderingFromSession({ workflows: doc.session.workflows });
  const path: JsonPath | null = pathForId(id, doc.meta, ordering);
  if (!path) return false;
  const text = model.getValue();
  const tree = parseTree(text);
  if (!tree) return false;
  const node = findNodeAtLocation(tree, path);
  if (!node) return false;
  const start = model.getPositionAt(node.offset);
  const end = model.getPositionAt(node.offset + node.length);
  const range = {
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  };
  editor.setSelection(range);
  editor.revealRangeInCenterIfOutsideViewport(range);
  return true;
}

/**
 * Attach a cursor listener that calls `onId` with the UUID under the cursor
 * on every cursor move (spec §15.5). Returns a disposer.
 */
export function attachCursorSelectionBridge(
  editor: EditorLike,
  getDoc: () => WorkflowEditorDocument | null,
  onId: (id: string | null) => void,
): { dispose(): void } {
  return editor.onDidChangeCursorPosition((e) => {
    const model = editor.getModel();
    const doc = getDoc();
    if (!model || !doc) {
      onId(null);
      return;
    }
    const offset = (model as TextModelLike).getOffsetAt(e.position);
    onId(idAtOffset(model.getValue(), offset, doc));
  });
}
