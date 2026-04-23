import { v4 as uuidv4 } from "uuid";
import type {
  CriterionPointer,
  EditorMetadata,
  HostRef,
  ProcessorPointer,
  StatePointer,
  SyntheticIdMap,
  TransitionPointer,
  WorkflowUiMeta,
} from "../types/editor.js";
import type { Criterion } from "../types/criterion.js";
import type { WorkflowSession } from "../types/session.js";
import type { Workflow } from "../types/workflow.js";

function emptyIds(): SyntheticIdMap {
  return {
    workflows: {},
    states: {},
    transitions: {},
    processors: {},
    criteria: {},
  };
}

function indexPriorStates(prior?: EditorMetadata): Record<string, string> {
  if (!prior) return {};
  const out: Record<string, string> = {};
  for (const [uuid, ptr] of Object.entries(prior.ids.states)) {
    out[`${ptr.workflow}:${ptr.state}`] = uuid;
  }
  return out;
}

/**
 * Build lookup `(workflow, state) → transitionUuid[]` in insertion order from
 * the prior metadata. Used to reuse transition UUIDs by ordinal position so
 * that patches produced against one revision remain applicable against the
 * next (spec §6.2: tuple-based reuse).
 */
function indexPriorTransitions(prior?: EditorMetadata): Record<string, string[]> {
  if (!prior) return {};
  const out: Record<string, string[]> = {};
  for (const [uuid, ptr] of Object.entries(prior.ids.transitions)) {
    const key = `${ptr.workflow}:${ptr.state}`;
    (out[key] ??= []).push(uuid);
  }
  return out;
}

function indexPriorProcessors(prior?: EditorMetadata): Record<string, string[]> {
  if (!prior) return {};
  const out: Record<string, string[]> = {};
  for (const [uuid, ptr] of Object.entries(prior.ids.processors)) {
    const key = ptr.transitionUuid;
    (out[key] ??= []).push(uuid);
  }
  return out;
}

/**
 * Assign synthetic UUIDs to every addressable element. When `prior` is
 * provided, reuse IDs per spec §6.2:
 *   - workflows reused by name;
 *   - states reused by (workflow, stateCode);
 *   - transitions reused by (workflow, state, ordinal-at-parse-time);
 *   - processors reused by (transitionUuid, ordinal-at-parse-time).
 * Anything without a match is minted fresh.
 */
export function assignSyntheticIds(
  session: WorkflowSession,
  prior?: EditorMetadata,
): EditorMetadata {
  const ids = emptyIds();
  const priorWorkflowIds = prior?.ids.workflows ?? {};
  const priorStatesByKey = indexPriorStates(prior);
  const priorTransitionsByKey = indexPriorTransitions(prior);
  const priorProcessorsByTransition = indexPriorProcessors(prior);
  const workflowUi: Record<string, WorkflowUiMeta> = prior?.workflowUi ?? {};

  for (const wf of session.workflows) {
    const wfUuid = priorWorkflowIds[wf.name] ?? uuidv4();
    ids.workflows[wf.name] = wfUuid;
    assignForWorkflow(
      wf,
      ids,
      priorStatesByKey,
      priorTransitionsByKey,
      priorProcessorsByTransition,
    );
  }

  return {
    revision: prior?.revision ?? 0,
    ids,
    workflowUi,
    ...(prior?.lastValidJsonHash !== undefined
      ? { lastValidJsonHash: prior.lastValidJsonHash }
      : {}),
  };
}

function assignForWorkflow(
  wf: Workflow,
  ids: SyntheticIdMap,
  priorStatesByKey: Record<string, string>,
  priorTransitionsByKey: Record<string, string[]>,
  priorProcessorsByTransition: Record<string, string[]>,
): void {
  for (const stateCode of Object.keys(wf.states)) {
    const key = `${wf.name}:${stateCode}`;
    const uuid = priorStatesByKey[key] ?? uuidv4();
    const ptr: StatePointer = { workflow: wf.name, state: stateCode };
    ids.states[uuid] = ptr;
  }

  for (const [stateCode, state] of Object.entries(wf.states)) {
    const priorTs = priorTransitionsByKey[`${wf.name}:${stateCode}`] ?? [];
    state.transitions.forEach((t, idx) => {
      const tUuid = priorTs[idx] ?? uuidv4();
      const tPtr: TransitionPointer = {
        workflow: wf.name,
        state: stateCode,
        transitionUuid: tUuid,
      };
      ids.transitions[tUuid] = tPtr;

      if (t.processors) {
        const priorPs = priorProcessorsByTransition[tUuid] ?? [];
        t.processors.forEach((_p, pIdx) => {
          const pUuid = priorPs[pIdx] ?? uuidv4();
          const pPtr: ProcessorPointer = {
            workflow: wf.name,
            state: stateCode,
            transitionUuid: tUuid,
            processorUuid: pUuid,
          };
          ids.processors[pUuid] = pPtr;
        });
      }

      if (t.criterion) {
        mintCriterionIds(
          t.criterion,
          {
            kind: "transition",
            workflow: wf.name,
            state: stateCode,
            transitionUuid: tUuid,
          },
          ["criterion"],
          ids,
        );
      }
    });
  }

  if (wf.criterion) {
    mintCriterionIds(
      wf.criterion,
      { kind: "workflow", workflow: wf.name },
      ["criterion"],
      ids,
    );
  }
}

export function mintCriterionIds(
  c: Criterion,
  host: HostRef,
  path: string[],
  ids: SyntheticIdMap,
): void {
  const uuid = uuidv4();
  const ptr: CriterionPointer = { host, path: [...path] };
  ids.criteria[uuid] = ptr;

  switch (c.type) {
    case "group":
      c.conditions.forEach((child, idx) => {
        mintCriterionIds(child, host, [...path, "conditions", String(idx)], ids);
      });
      return;
    case "function":
      if (c.function.criterion) {
        mintCriterionIds(
          c.function.criterion,
          host,
          [...path, "function", "criterion"],
          ids,
        );
      }
      return;
    default:
      return;
  }
}
