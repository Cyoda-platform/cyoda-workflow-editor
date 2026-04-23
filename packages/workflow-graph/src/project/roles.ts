import type { Workflow } from "@cyoda/workflow-core";
import type { StateNode, StateRole } from "../types.js";

export function computeRole(
  wf: Workflow,
  stateCode: string,
  hasOutgoing: boolean,
): StateRole {
  const isInitial = wf.initialState === stateCode;
  const isTerminal = !hasOutgoing;
  if (isInitial && isTerminal) return "initial-terminal";
  if (isInitial) return "initial";
  if (isTerminal) return "terminal";
  return "normal";
}

/**
 * Derive a visual category used by the viewer (not part of spec roles).
 * - MANUAL_REVIEW: reachable only via manual transitions.
 * - PROCESSING_STATE: has any outgoing transition with ≥1 processor.
 * - STATE: default.
 */
export function computeCategory(
  wf: Workflow,
  stateCode: string,
): StateNode["category"] {
  const state = wf.states[stateCode];
  if (!state) return "STATE";

  // Processing: any outgoing transition carries processors.
  const outgoingWithProcessors = state.transitions.some(
    (t) => !!t.processors && t.processors.length > 0,
  );
  if (outgoingWithProcessors) return "PROCESSING_STATE";

  // Manual review: every inbound transition is manual (and there is at least one).
  let inbound = 0;
  let manualInbound = 0;
  for (const other of Object.values(wf.states)) {
    for (const t of other.transitions) {
      if (t.next === stateCode) {
        inbound++;
        if (t.manual) manualInbound++;
      }
    }
  }
  if (inbound > 0 && manualInbound === inbound) return "MANUAL_REVIEW";
  return "STATE";
}
