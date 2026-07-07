import type { Workflow } from "@cyoda/workflow-core";
import type { StateRole } from "../types.js";

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
