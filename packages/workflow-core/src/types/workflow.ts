import type { Criterion } from "./criterion.js";
import type { Processor } from "./processor.js";

export type StateCode = string;
export type TransitionName = string;

export interface Workflow {
  version: string;
  name: string;
  desc?: string;
  initialState: StateCode;
  active: boolean;
  criterion?: Criterion;
  states: Record<StateCode, State>;
}

export interface State {
  transitions: Transition[];
}

export interface Transition {
  name: TransitionName;
  next: StateCode;
  manual: boolean;
  disabled: boolean;
  criterion?: Criterion;
  processors?: Processor[];
}
