import { produce } from "immer";
import { assignSyntheticIds } from "../identity/assign.js";
import type { WorkflowEditorDocument } from "../types/editor.js";
import type { DomainPatch } from "../types/patch.js";
import type { WorkflowSession } from "../types/session.js";
import type { Workflow } from "../types/workflow.js";
import { validateSemantics } from "../validate/semantic.js";
import type { ValidationIssue } from "../types/validation.js";

/**
 * Apply a patch to a document, returning a new document.
 * - Refreshes synthetic IDs for the new session.
 * - Bumps revision.
 * - Re-runs semantic validation (issues stored separately; doc itself is the
 *   canonical source, issues are computed via validateAll by callers).
 */
export function applyPatch(
  doc: WorkflowEditorDocument,
  patch: DomainPatch,
): WorkflowEditorDocument {
  // UI-only patches short-circuit the session pipeline.
  if (patch.op === "setEdgeAnchors") {
    return applySetEdgeAnchors(doc, patch);
  }

  const nextSession = produce(doc.session, (d) => {
    // Cast to break immer's WritableDraft recursion over the deeply-nested
    // Criterion union — we rely on structural mutation with no type gain.
    const draft = d as unknown as WorkflowSession;
    switch (patch.op) {
      case "addWorkflow":
        draft.workflows.push(patch.workflow);
        return;
      case "removeWorkflow":
        draft.workflows = draft.workflows.filter((w) => w.name !== patch.workflow);
        return;
      case "updateWorkflowMeta": {
        const wf = draft.workflows.find((w) => w.name === patch.workflow);
        if (!wf) return;
        Object.assign(wf, patch.updates);
        return;
      }
      case "renameWorkflow": {
        const wf = draft.workflows.find((w) => w.name === patch.from);
        if (!wf) return;
        wf.name = patch.to;
        return;
      }
      case "setInitialState": {
        const wf = draft.workflows.find((w) => w.name === patch.workflow);
        if (!wf) return;
        wf.initialState = patch.stateCode;
        return;
      }
      case "setWorkflowCriterion": {
        const wf = draft.workflows.find((w) => w.name === patch.workflow);
        if (!wf) return;
        if (patch.criterion === undefined) delete wf.criterion;
        else wf.criterion = patch.criterion;
        return;
      }
      case "addState": {
        const wf = draft.workflows.find((w) => w.name === patch.workflow);
        if (!wf) return;
        if (!(patch.stateCode in wf.states)) {
          wf.states[patch.stateCode] = { transitions: [] };
        }
        return;
      }
      case "renameState": {
        const wf = draft.workflows.find((w) => w.name === patch.workflow);
        if (!wf) return;
        renameStateCascading(wf, patch.from, patch.to);
        return;
      }
      case "removeState": {
        const wf = draft.workflows.find((w) => w.name === patch.workflow);
        if (!wf) return;
        removeStateCascading(wf, patch.stateCode);
        return;
      }
      case "addTransition": {
        const wf = draft.workflows.find((w) => w.name === patch.workflow);
        if (!wf) return;
        const state = wf.states[patch.fromState];
        if (!state) return;
        state.transitions.push(patch.transition);
        return;
      }
      case "updateTransition": {
        const loc = locateTransition(doc, patch.transitionUuid);
        if (!loc) return;
        const wf = draft.workflows.find((w) => w.name === loc.workflow);
        const state = wf?.states[loc.state];
        const transition = state?.transitions[loc.index];
        if (!transition) return;
        Object.assign(transition, patch.updates);
        return;
      }
      case "removeTransition": {
        const loc = locateTransition(doc, patch.transitionUuid);
        if (!loc) return;
        const wf = draft.workflows.find((w) => w.name === loc.workflow);
        const state = wf?.states[loc.state];
        if (!state) return;
        state.transitions.splice(loc.index, 1);
        return;
      }
      case "reorderTransition": {
        const wf = draft.workflows.find((w) => w.name === patch.workflow);
        const state = wf?.states[patch.fromState];
        if (!state) return;
        const loc = locateTransition(doc, patch.transitionUuid);
        if (!loc) return;
        const [item] = state.transitions.splice(loc.index, 1);
        if (!item) return;
        state.transitions.splice(patch.toIndex, 0, item);
        return;
      }
      case "addProcessor": {
        const loc = locateTransition(doc, patch.transitionUuid);
        if (!loc) return;
        const wf = draft.workflows.find((w) => w.name === loc.workflow);
        const state = wf?.states[loc.state];
        const transition = state?.transitions[loc.index];
        if (!transition) return;
        if (!transition.processors) transition.processors = [];
        const idx = patch.index ?? transition.processors.length;
        transition.processors.splice(idx, 0, patch.processor);
        return;
      }
      case "updateProcessor": {
        const procLoc = locateProcessor(doc, patch.processorUuid);
        if (!procLoc) return;
        const wf = draft.workflows.find((w) => w.name === procLoc.workflow);
        const state = wf?.states[procLoc.state];
        const transition = state?.transitions[procLoc.transitionIndex];
        const processor = transition?.processors?.[procLoc.processorIndex];
        if (!processor) return;
        Object.assign(processor, patch.updates);
        return;
      }
      case "removeProcessor": {
        const procLoc = locateProcessor(doc, patch.processorUuid);
        if (!procLoc) return;
        const wf = draft.workflows.find((w) => w.name === procLoc.workflow);
        const state = wf?.states[procLoc.state];
        const transition = state?.transitions[procLoc.transitionIndex];
        if (!transition?.processors) return;
        transition.processors.splice(procLoc.processorIndex, 1);
        if (transition.processors.length === 0) delete transition.processors;
        return;
      }
      case "reorderProcessor": {
        const procLoc = locateProcessor(doc, patch.processorUuid);
        if (!procLoc) return;
        const wf = draft.workflows.find((w) => w.name === procLoc.workflow);
        const state = wf?.states[procLoc.state];
        const transition = state?.transitions[procLoc.transitionIndex];
        if (!transition?.processors) return;
        const [item] = transition.processors.splice(procLoc.processorIndex, 1);
        if (!item) return;
        transition.processors.splice(patch.toIndex, 0, item);
        return;
      }
      case "setCriterion": {
        // Apply a criterion change at the given host + path.
        const host = patch.host;
        const wf = draft.workflows.find((w) => w.name === host.workflow);
        if (!wf) return;
        let container: unknown;
        if (host.kind === "workflow") container = wf;
        else if (host.kind === "transition") {
          const state = wf.states[host.state];
          if (!state) return;
          const loc = locateTransition(doc, host.transitionUuid);
          if (!loc) return;
          container = state.transitions[loc.index];
        } else {
          // processorConfig not supported in v1 patch apply.
          return;
        }
        applyCriterionAtPath(
          container as Record<string, unknown>,
          patch.path,
          patch.criterion,
        );
        return;
      }
      case "setImportMode":
        draft.importMode = patch.mode;
        return;
      case "setEntity":
        draft.entity = patch.entity;
        return;
      case "replaceSession":
        draft.workflows = patch.session.workflows;
        draft.importMode = patch.session.importMode;
        draft.entity = patch.session.entity;
        return;
    }
  });

  const nextMeta = assignSyntheticIds(nextSession, doc.meta);
  return {
    session: nextSession,
    meta: { ...nextMeta, revision: doc.meta.revision + 1 },
  };
}

/**
 * Convenience: apply multiple patches in sequence.
 */
export function applyPatches(
  doc: WorkflowEditorDocument,
  patches: DomainPatch[],
): WorkflowEditorDocument {
  return patches.reduce((d, p) => applyPatch(d, p), doc);
}

export function validateAfterPatch(
  doc: WorkflowEditorDocument,
): ValidationIssue[] {
  return validateSemantics(doc.session, doc);
}

// ----- helpers -----

function applySetEdgeAnchors(
  doc: WorkflowEditorDocument,
  patch: Extract<DomainPatch, { op: "setEdgeAnchors" }>,
): WorkflowEditorDocument {
  const ptr = doc.meta.ids.transitions[patch.transitionUuid];
  if (!ptr) return { ...doc, meta: { ...doc.meta, revision: doc.meta.revision + 1 } };

  const workflowUi = { ...doc.meta.workflowUi };
  const current = workflowUi[ptr.workflow] ?? {};
  const edgeAnchors = { ...(current.edgeAnchors ?? {}) };

  if (patch.anchors === null) {
    delete edgeAnchors[patch.transitionUuid];
  } else {
    edgeAnchors[patch.transitionUuid] = { ...patch.anchors };
  }

  workflowUi[ptr.workflow] = {
    ...current,
    edgeAnchors: Object.keys(edgeAnchors).length > 0 ? edgeAnchors : undefined,
  };

  return {
    session: doc.session,
    meta: {
      ...doc.meta,
      workflowUi,
      revision: doc.meta.revision + 1,
    },
  };
}

function renameStateCascading(wf: Workflow, from: string, to: string): void {
  if (!(from in wf.states) || from === to) return;
  wf.states[to] = wf.states[from]!;
  delete wf.states[from];
  for (const state of Object.values(wf.states)) {
    for (const t of state.transitions) {
      if (t.next === from) t.next = to;
    }
  }
  if (wf.initialState === from) wf.initialState = to;
}

function removeStateCascading(wf: Workflow, stateCode: string): void {
  if (!(stateCode in wf.states)) return;
  delete wf.states[stateCode];
  for (const state of Object.values(wf.states)) {
    state.transitions = state.transitions.filter((t) => t.next !== stateCode);
  }
  if (wf.initialState === stateCode) wf.initialState = "";
}

function locateTransition(
  doc: WorkflowEditorDocument,
  transitionUuid: string,
): { workflow: string; state: string; index: number } | null {
  const ptr = doc.meta.ids.transitions[transitionUuid];
  if (!ptr) return null;
  // We need the ordinal index of this transition within the state.
  // Build the list of transition UUIDs for the same (workflow, state) and find ours.
  const ordered: string[] = [];
  for (const [uuid, p] of Object.entries(doc.meta.ids.transitions)) {
    if (p.workflow === ptr.workflow && p.state === ptr.state) ordered.push(uuid);
  }
  const idx = ordered.indexOf(transitionUuid);
  if (idx < 0) return null;
  return { workflow: ptr.workflow, state: ptr.state, index: idx };
}

function locateProcessor(
  doc: WorkflowEditorDocument,
  processorUuid: string,
): {
  workflow: string;
  state: string;
  transitionIndex: number;
  processorIndex: number;
} | null {
  const ptr = doc.meta.ids.processors[processorUuid];
  if (!ptr) return null;
  const tLoc = locateTransition(doc, ptr.transitionUuid);
  if (!tLoc) return null;
  const ordered: string[] = [];
  for (const [uuid, p] of Object.entries(doc.meta.ids.processors)) {
    if (p.transitionUuid === ptr.transitionUuid) ordered.push(uuid);
  }
  const pIdx = ordered.indexOf(processorUuid);
  if (pIdx < 0) return null;
  return {
    workflow: tLoc.workflow,
    state: tLoc.state,
    transitionIndex: tLoc.index,
    processorIndex: pIdx,
  };
}

function applyCriterionAtPath(
  container: Record<string, unknown>,
  path: string[],
  criterion: unknown,
): void {
  if (path.length === 0) return;
  let node = container;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i]!;
    const next = node[seg];
    if (next === undefined || next === null) return;
    if (Array.isArray(next)) {
      const idx = Number(path[i + 1]);
      const arr = next as unknown[];
      const target = arr[idx];
      if (target === undefined || typeof target !== "object") return;
      node = target as Record<string, unknown>;
      i++; // consumed both the array key and the index
    } else if (typeof next === "object") {
      node = next as Record<string, unknown>;
    } else {
      return;
    }
  }
  const lastSeg = path[path.length - 1]!;
  if (criterion === undefined) {
    delete node[lastSeg];
  } else {
    node[lastSeg] = criterion;
  }
}
