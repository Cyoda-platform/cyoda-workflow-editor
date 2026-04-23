import type { Criterion } from "../types/criterion.js";
import type { HostRef, WorkflowEditorDocument } from "../types/editor.js";
import type { Processor } from "../types/processor.js";
import type { State, Transition, Workflow } from "../types/workflow.js";

export type LookupResult =
  | { kind: "workflow"; workflow: Workflow }
  | { kind: "state"; workflow: Workflow; state: State; stateCode: string }
  | { kind: "transition"; workflow: Workflow; state: State; transition: Transition }
  | { kind: "processor"; transition: Transition; processor: Processor }
  | {
      kind: "criterion";
      criterion: Criterion;
      parent: { host: HostRef; path: string[] };
    }
  | null;

export function lookupById(doc: WorkflowEditorDocument, uuid: string): LookupResult {
  const { ids } = doc.meta;
  const session = doc.session;

  // Workflow?
  for (const [name, wfUuid] of Object.entries(ids.workflows)) {
    if (wfUuid === uuid) {
      const workflow = session.workflows.find((w) => w.name === name);
      if (workflow) return { kind: "workflow", workflow };
    }
  }

  // State?
  const statePtr = ids.states[uuid];
  if (statePtr) {
    const workflow = session.workflows.find((w) => w.name === statePtr.workflow);
    if (!workflow) return null;
    const state = workflow.states[statePtr.state];
    if (!state) return null;
    return { kind: "state", workflow, state, stateCode: statePtr.state };
  }

  // Transition?
  const tPtr = ids.transitions[uuid];
  if (tPtr) {
    const workflow = session.workflows.find((w) => w.name === tPtr.workflow);
    if (!workflow) return null;
    const state = workflow.states[tPtr.state];
    if (!state) return null;
    const transition = findTransitionByUuid(doc, tPtr.workflow, tPtr.state, uuid);
    if (!transition) return null;
    return { kind: "transition", workflow, state, transition };
  }

  // Processor?
  const pPtr = ids.processors[uuid];
  if (pPtr) {
    const transition = findTransitionByUuid(
      doc,
      pPtr.workflow,
      pPtr.state,
      pPtr.transitionUuid,
    );
    if (!transition) return null;
    const processor = findProcessorByUuid(doc, uuid);
    if (!processor) return null;
    return { kind: "processor", transition, processor };
  }

  // Criterion?
  const cPtr = ids.criteria[uuid];
  if (cPtr) {
    const host = resolveHost(doc, cPtr.host);
    if (host === null) return null;
    const criterion = walkPath(host, cPtr.path);
    if (!criterion) return null;
    return {
      kind: "criterion",
      criterion,
      parent: { host: cPtr.host, path: cPtr.path },
    };
  }

  return null;
}

function findTransitionByUuid(
  doc: WorkflowEditorDocument,
  workflowName: string,
  stateCode: string,
  transitionUuid: string,
): Transition | null {
  const workflow = doc.session.workflows.find((w) => w.name === workflowName);
  if (!workflow) return null;
  const state = workflow.states[stateCode];
  if (!state) return null;
  // Transitions are identified by UUID in ids map; we need to find by index.
  // Since assignment walks state.transitions in order, we reconstruct by
  // iterating the same order to find the index matching the uuid.
  const orderedUuids = listTransitionUuidsForState(doc, workflowName, stateCode);
  const idx = orderedUuids.indexOf(transitionUuid);
  if (idx < 0) return null;
  return state.transitions[idx] ?? null;
}

function listTransitionUuidsForState(
  doc: WorkflowEditorDocument,
  workflowName: string,
  stateCode: string,
): string[] {
  const out: string[] = [];
  for (const [uuid, ptr] of Object.entries(doc.meta.ids.transitions)) {
    if (ptr.workflow === workflowName && ptr.state === stateCode) {
      out.push(uuid);
    }
  }
  // Sort by the order they appear in state.transitions — we cannot recover
  // from the map alone, so we keep insertion order by relying on Object.entries.
  return out;
}

function findProcessorByUuid(
  doc: WorkflowEditorDocument,
  processorUuid: string,
): Processor | null {
  const ptr = doc.meta.ids.processors[processorUuid];
  if (!ptr) return null;
  const transition = findTransitionByUuid(
    doc,
    ptr.workflow,
    ptr.state,
    ptr.transitionUuid,
  );
  if (!transition || !transition.processors) return null;
  // Determine index by counting ProcessorPointers with same transitionUuid
  // appearing before this one in insertion order.
  const orderedUuids: string[] = [];
  for (const [uuid, pPtr] of Object.entries(doc.meta.ids.processors)) {
    if (pPtr.transitionUuid === ptr.transitionUuid) orderedUuids.push(uuid);
  }
  const idx = orderedUuids.indexOf(processorUuid);
  if (idx < 0) return null;
  return transition.processors[idx] ?? null;
}

function resolveHost(
  doc: WorkflowEditorDocument,
  host: HostRef,
): Criterion | Workflow | Transition | null {
  const workflow = doc.session.workflows.find((w) => w.name === host.workflow);
  if (!workflow) return null;
  if (host.kind === "workflow") return workflow;
  if (host.kind === "transition") {
    const state = workflow.states[host.state];
    if (!state) return null;
    return findTransitionByUuid(doc, host.workflow, host.state, host.transitionUuid);
  }
  // processorConfig: not used in v1; return null.
  return null;
}

function walkPath(
  root: Workflow | Transition | Criterion,
  path: string[],
): Criterion | null {
  let node: unknown = root;
  for (const segment of path) {
    if (node == null || typeof node !== "object") return null;
    node = (node as Record<string, unknown>)[segment];
    if (node == null) return null;
    if (Array.isArray(node)) continue; // we only index arrays with numeric segments
  }
  if (!node || typeof node !== "object") return null;
  const maybe = node as { type?: string };
  if (
    maybe.type === "simple" ||
    maybe.type === "group" ||
    maybe.type === "function" ||
    maybe.type === "lifecycle" ||
    maybe.type === "array"
  ) {
    return node as Criterion;
  }
  return null;
}
