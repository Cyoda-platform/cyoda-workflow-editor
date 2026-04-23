import type { WorkflowEditorDocument } from "../types/editor.js";
import type { DomainPatch } from "../types/patch.js";
import type { Criterion } from "../types/criterion.js";
import type { Processor } from "../types/processor.js";
import type { Transition, Workflow } from "../types/workflow.js";

/**
 * Produce the inverse of `patch` relative to the pre-apply document `doc`.
 * Applying `patch` to `doc`, then applying `invertPatch(doc, patch)` to the
 * result, returns a document equal to `doc` modulo `meta.revision`.
 *
 * Complex cascading operations (removeState, removeWorkflow, renameWorkflow,
 * replaceSession) invert via a captured-slice `replaceSession` — this is the
 * simplest provably correct inverse, at the cost of coarser undo grain.
 */
export function invertPatch(
  doc: WorkflowEditorDocument,
  patch: DomainPatch,
): DomainPatch {
  switch (patch.op) {
    case "addWorkflow":
      return { op: "removeWorkflow", workflow: patch.workflow.name };

    case "removeWorkflow":
    case "renameWorkflow":
    case "removeState":
    case "renameState":
    case "replaceSession":
      return { op: "replaceSession", session: cloneSession(doc) };

    case "updateWorkflowMeta": {
      const wf = findWorkflow(doc, patch.workflow);
      if (!wf) return noop();
      const prior: Partial<Pick<Workflow, "version" | "desc" | "active">> = {};
      for (const key of Object.keys(patch.updates) as Array<keyof typeof patch.updates>) {
        (prior as Record<string, unknown>)[key] = wf[key];
      }
      return { op: "updateWorkflowMeta", workflow: patch.workflow, updates: prior };
    }

    case "setInitialState": {
      const wf = findWorkflow(doc, patch.workflow);
      if (!wf) return noop();
      return {
        op: "setInitialState",
        workflow: patch.workflow,
        stateCode: wf.initialState,
      };
    }

    case "setWorkflowCriterion": {
      const wf = findWorkflow(doc, patch.workflow);
      if (!wf) return noop();
      return wf.criterion
        ? {
            op: "setWorkflowCriterion",
            workflow: patch.workflow,
            criterion: cloneCriterion(wf.criterion),
          }
        : { op: "setWorkflowCriterion", workflow: patch.workflow };
    }

    case "addState":
      return {
        op: "removeState",
        workflow: patch.workflow,
        stateCode: patch.stateCode,
      };

    case "addTransition": {
      // Inverse needs the minted UUID of the newly added transition,
      // which only exists post-apply. We emit a replaceSession fallback.
      return { op: "replaceSession", session: cloneSession(doc) };
    }

    case "updateTransition": {
      const t = findTransition(doc, patch.transitionUuid);
      if (!t) return noop();
      const prior: Partial<Transition> = {};
      for (const key of Object.keys(patch.updates) as Array<keyof Transition>) {
        (prior as Record<string, unknown>)[key] = t[key];
      }
      return {
        op: "updateTransition",
        transitionUuid: patch.transitionUuid,
        updates: prior,
      };
    }

    case "removeTransition":
    case "reorderTransition":
      return { op: "replaceSession", session: cloneSession(doc) };

    case "addProcessor":
      return { op: "replaceSession", session: cloneSession(doc) };

    case "updateProcessor": {
      const p = findProcessor(doc, patch.processorUuid);
      if (!p) return noop();
      const prior: Partial<Processor> = {};
      for (const key of Object.keys(patch.updates) as Array<keyof Processor>) {
        (prior as Record<string, unknown>)[key] = (p as unknown as Record<string, unknown>)[key];
      }
      return {
        op: "updateProcessor",
        processorUuid: patch.processorUuid,
        updates: prior,
      };
    }

    case "removeProcessor":
    case "reorderProcessor":
      return { op: "replaceSession", session: cloneSession(doc) };

    case "setCriterion": {
      const prior = readCriterionAt(doc, patch.host, patch.path);
      return prior === undefined
        ? { op: "setCriterion", host: patch.host, path: patch.path }
        : {
            op: "setCriterion",
            host: patch.host,
            path: patch.path,
            criterion: cloneCriterion(prior),
          };
    }

    case "setImportMode":
      return { op: "setImportMode", mode: doc.session.importMode };

    case "setEntity":
      return { op: "setEntity", entity: doc.session.entity };

    case "setEdgeAnchors": {
      const ptr = doc.meta.ids.transitions[patch.transitionUuid];
      if (!ptr) return noop();
      const prior =
        doc.meta.workflowUi[ptr.workflow]?.edgeAnchors?.[patch.transitionUuid];
      return {
        op: "setEdgeAnchors",
        transitionUuid: patch.transitionUuid,
        anchors: prior ? { ...prior } : null,
      };
    }
  }
}

function noop(): DomainPatch {
  return { op: "setImportMode", mode: "MERGE" };
}

function findWorkflow(doc: WorkflowEditorDocument, name: string): Workflow | undefined {
  return doc.session.workflows.find((w) => w.name === name);
}

function findTransition(
  doc: WorkflowEditorDocument,
  transitionUuid: string,
): Transition | undefined {
  const ptr = doc.meta.ids.transitions[transitionUuid];
  if (!ptr) return undefined;
  const wf = findWorkflow(doc, ptr.workflow);
  const state = wf?.states[ptr.state];
  if (!state) return undefined;
  const ordered: string[] = [];
  for (const [uuid, p] of Object.entries(doc.meta.ids.transitions)) {
    if (p.workflow === ptr.workflow && p.state === ptr.state) ordered.push(uuid);
  }
  const idx = ordered.indexOf(transitionUuid);
  return state.transitions[idx];
}

function findProcessor(
  doc: WorkflowEditorDocument,
  processorUuid: string,
): Processor | undefined {
  const ptr = doc.meta.ids.processors[processorUuid];
  if (!ptr) return undefined;
  const t = findTransition(doc, ptr.transitionUuid);
  if (!t?.processors) return undefined;
  const ordered: string[] = [];
  for (const [uuid, p] of Object.entries(doc.meta.ids.processors)) {
    if (p.transitionUuid === ptr.transitionUuid) ordered.push(uuid);
  }
  const idx = ordered.indexOf(processorUuid);
  return t.processors[idx];
}

function readCriterionAt(
  doc: WorkflowEditorDocument,
  host: { kind: string; workflow: string; state?: string; transitionUuid?: string },
  path: string[],
): Criterion | undefined {
  const wf = findWorkflow(doc, host.workflow);
  if (!wf) return undefined;
  let container: Record<string, unknown> | undefined;
  if (host.kind === "workflow") {
    container = wf as unknown as Record<string, unknown>;
  } else if (host.kind === "transition" && host.transitionUuid) {
    const t = findTransition(doc, host.transitionUuid);
    if (!t) return undefined;
    container = t as unknown as Record<string, unknown>;
  } else {
    return undefined;
  }
  let node: unknown = container;
  for (const seg of path) {
    if (node === null || node === undefined) return undefined;
    if (Array.isArray(node)) {
      node = node[Number(seg)];
    } else if (typeof node === "object") {
      node = (node as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return node as Criterion | undefined;
}

function cloneSession(doc: WorkflowEditorDocument) {
  return structuredClone(doc.session);
}

function cloneCriterion(c: Criterion): Criterion {
  return structuredClone(c);
}
