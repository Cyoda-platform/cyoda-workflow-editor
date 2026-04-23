import { NAME_REGEX } from "../schema/name.js";
import type { Criterion } from "../types/criterion.js";
import type { WorkflowSession } from "../types/session.js";
import type { Transition, Workflow } from "../types/workflow.js";

export function isValidName(name: string): boolean {
  return NAME_REGEX.test(name);
}

/**
 * Walk every criterion node (pre-order) across a workflow session.
 * Yields the criterion and a breadcrumb describing where it was found.
 */
export function* walkCriteria(
  session: WorkflowSession,
): Generator<{ criterion: Criterion; where: CriterionLocation }> {
  for (const wf of session.workflows) {
    if (wf.criterion) {
      yield* walkInner(wf.criterion, { kind: "workflow", workflow: wf.name });
    }
    for (const [stateCode, state] of Object.entries(wf.states)) {
      for (let i = 0; i < state.transitions.length; i++) {
        const t = state.transitions[i]!;
        if (t.criterion) {
          yield* walkInner(t.criterion, {
            kind: "transition",
            workflow: wf.name,
            state: stateCode,
            transitionIndex: i,
            transitionName: t.name,
          });
        }
      }
    }
  }
}

export type CriterionLocation =
  | { kind: "workflow"; workflow: string }
  | {
      kind: "transition";
      workflow: string;
      state: string;
      transitionIndex: number;
      transitionName: string;
    };

function* walkInner(
  c: Criterion,
  where: CriterionLocation,
): Generator<{ criterion: Criterion; where: CriterionLocation }> {
  yield { criterion: c, where };
  if (c.type === "group") {
    for (const child of c.conditions) yield* walkInner(child, where);
  } else if (c.type === "function" && c.function.criterion) {
    yield* walkInner(c.function.criterion, where);
  }
}

export function* walkTransitions(
  wf: Workflow,
): Generator<{ state: string; transition: Transition; index: number }> {
  for (const [stateCode, state] of Object.entries(wf.states)) {
    for (let i = 0; i < state.transitions.length; i++) {
      yield { state: stateCode, transition: state.transitions[i]!, index: i };
    }
  }
}

export function transitionNames(wf: Workflow): string[] {
  const out: string[] = [];
  for (const state of Object.values(wf.states)) {
    for (const t of state.transitions) out.push(t.name);
  }
  return out;
}
