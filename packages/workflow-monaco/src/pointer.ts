import type {
  CriterionPointer,
  EditorMetadata,
  ProcessorPointer,
  StatePointer,
  TransitionPointer,
} from "@cyoda/workflow-core";

/**
 * JSON pointer segments for locating a synthetic-id target inside the raw
 * import-payload JSON (spec §18.4). Numbers are array indexes; strings are
 * object keys. The JSON we're pointing into is the *user-visible* import
 * payload, not the editor document — so the path begins with `workflows`,
 * never `session` or `meta`.
 */
export type JsonPathSegment = string | number;
export type JsonPath = JsonPathSegment[];

/**
 * Resolve a synthetic UUID against a document's editor metadata to a JSON
 * path inside the import payload. Returns null when the UUID is unknown
 * (e.g. stale marker after a session replace where IDs changed).
 *
 * Path walks:
 *   workflow          → ["workflows", wfIdx]
 *   state             → ["workflows", wfIdx, "states", stateCode]
 *   transition        → ["workflows", wfIdx, "states", stateCode, "transitions", tIdx]
 *   processor         → ...transition path + ["processors", pIdx]
 *   criterion         → host-specific prefix + ["criterion"] (+ group descent)
 */
export function pathForId(
  id: string,
  meta: EditorMetadata,
  ordering: SessionOrdering,
): JsonPath | null {
  if (id in meta.ids.workflows) {
    const wfName = Object.entries(meta.ids.workflows).find(([, v]) => v === id)?.[0];
    if (!wfName) return null;
    const wfIdx = ordering.workflowIndex(wfName);
    if (wfIdx < 0) return null;
    return ["workflows", wfIdx];
  }

  const statePtr: StatePointer | undefined = meta.ids.states[id];
  if (statePtr) {
    const wfIdx = ordering.workflowIndex(statePtr.workflow);
    if (wfIdx < 0) return null;
    return ["workflows", wfIdx, "states", statePtr.state];
  }

  const tPtr: TransitionPointer | undefined = meta.ids.transitions[id];
  if (tPtr) {
    const wfIdx = ordering.workflowIndex(tPtr.workflow);
    if (wfIdx < 0) return null;
    const tIdx = ordering.transitionIndex(tPtr.workflow, tPtr.state, tPtr.transitionUuid, meta);
    if (tIdx < 0) return null;
    return ["workflows", wfIdx, "states", tPtr.state, "transitions", tIdx];
  }

  const pPtr: ProcessorPointer | undefined = meta.ids.processors[id];
  if (pPtr) {
    const wfIdx = ordering.workflowIndex(pPtr.workflow);
    if (wfIdx < 0) return null;
    const tIdx = ordering.transitionIndex(pPtr.workflow, pPtr.state, pPtr.transitionUuid, meta);
    if (tIdx < 0) return null;
    const pIdx = ordering.processorIndex(
      pPtr.workflow,
      pPtr.state,
      pPtr.transitionUuid,
      pPtr.processorUuid,
      meta,
    );
    if (pIdx < 0) return null;
    return [
      "workflows",
      wfIdx,
      "states",
      pPtr.state,
      "transitions",
      tIdx,
      "processors",
      pIdx,
    ];
  }

  const cPtr: CriterionPointer | undefined = meta.ids.criteria[id];
  if (cPtr) return pathForCriterion(cPtr, meta, ordering);

  return null;
}

function pathForCriterion(
  cPtr: CriterionPointer,
  meta: EditorMetadata,
  ordering: SessionOrdering,
): JsonPath | null {
  const host = cPtr.host;
  let prefix: JsonPath;
  if (host.kind === "workflow") {
    const wfIdx = ordering.workflowIndex(host.workflow);
    if (wfIdx < 0) return null;
    prefix = ["workflows", wfIdx, "criterion"];
  } else if (host.kind === "transition") {
    const wfIdx = ordering.workflowIndex(host.workflow);
    if (wfIdx < 0) return null;
    const tIdx = ordering.transitionIndex(host.workflow, host.state, host.transitionUuid, meta);
    if (tIdx < 0) return null;
    prefix = ["workflows", wfIdx, "states", host.state, "transitions", tIdx, "criterion"];
  } else {
    const wfIdx = ordering.workflowIndex(host.workflow);
    if (wfIdx < 0) return null;
    const tIdx = ordering.transitionIndex(host.workflow, host.state, host.transitionUuid, meta);
    if (tIdx < 0) return null;
    const pIdx = ordering.processorIndex(
      host.workflow,
      host.state,
      host.transitionUuid,
      host.processorUuid,
      meta,
    );
    if (pIdx < 0) return null;
    prefix = [
      "workflows",
      wfIdx,
      "states",
      host.state,
      "transitions",
      tIdx,
      "processors",
      pIdx,
      "config",
      "criterion",
    ];
  }
  return [...prefix, ...cPtr.path];
}

/**
 * Index lookups over the session's insertion order — matches the order in
 * which `assignSyntheticIds` walks, so a UUID's ordinal maps stably to the
 * JSON array index.
 */
export interface SessionOrdering {
  workflowIndex(name: string): number;
  transitionIndex(
    workflow: string,
    stateCode: string,
    transitionUuid: string,
    meta: EditorMetadata,
  ): number;
  processorIndex(
    workflow: string,
    stateCode: string,
    transitionUuid: string,
    processorUuid: string,
    meta: EditorMetadata,
  ): number;
}

/**
 * Build an ordering from the editor document's current session. This is
 * authoritative when the open model's JSON matches the session byte-for-byte;
 * it gives correct ordinals for ID → JSON-path mapping.
 */
export function orderingFromSession(session: {
  workflows: Array<{ name: string; states: Record<string, { transitions: Array<unknown> }> }>;
}): SessionOrdering {
  const wfByName = new Map<string, number>();
  session.workflows.forEach((w, i) => wfByName.set(w.name, i));
  return {
    workflowIndex: (name) => wfByName.get(name) ?? -1,
    transitionIndex: (workflow, stateCode, transitionUuid, meta) => {
      const wf = session.workflows.find((w) => w.name === workflow);
      if (!wf) return -1;
      const state = wf.states[stateCode];
      if (!state) return -1;
      return ordinalOfTransition(workflow, stateCode, transitionUuid, meta);
    },
    processorIndex: (workflow, stateCode, transitionUuid, processorUuid, meta) =>
      ordinalOfProcessor(workflow, stateCode, transitionUuid, processorUuid, meta),
  };
}

function ordinalOfTransition(
  workflow: string,
  state: string,
  transitionUuid: string,
  meta: EditorMetadata,
): number {
  let i = 0;
  for (const [uuid, ptr] of Object.entries(meta.ids.transitions)) {
    if (ptr.workflow === workflow && ptr.state === state) {
      if (uuid === transitionUuid) return i;
      i++;
    }
  }
  return -1;
}

function ordinalOfProcessor(
  workflow: string,
  state: string,
  transitionUuid: string,
  processorUuid: string,
  meta: EditorMetadata,
): number {
  let i = 0;
  for (const [uuid, ptr] of Object.entries(meta.ids.processors)) {
    if (
      ptr.workflow === workflow &&
      ptr.state === state &&
      ptr.transitionUuid === transitionUuid
    ) {
      if (uuid === processorUuid) return i;
      i++;
    }
  }
  return -1;
}
