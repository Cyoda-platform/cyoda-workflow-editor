import type { JsonValue, OperatorType } from "./operator.js";

export type Criterion =
  | SimpleCriterion
  | GroupCriterion
  | FunctionCriterion
  | LifecycleCriterion
  | ArrayCriterion;

export interface SimpleCriterion {
  type: "simple";
  jsonPath: string;
  operation: OperatorType;
  value?: JsonValue;
}

export interface GroupCriterion {
  type: "group";
  operator: "AND" | "OR" | "NOT";
  conditions: Criterion[];
}

export interface FunctionCriterion {
  type: "function";
  function: {
    name: string;
    config?: FunctionConfig;
    criterion?: Criterion;
  };
}

export interface LifecycleCriterion {
  type: "lifecycle";
  field: "state" | "creationDate" | "previousTransition";
  operation: OperatorType;
  value?: JsonValue;
}

export interface ArrayCriterion {
  type: "array";
  jsonPath: string;
  operation: OperatorType;
  value: string[];
}

export interface FunctionConfig {
  attachEntity?: boolean;
  calculationNodesTags?: string;
  responseTimeoutMs?: number;
  retryPolicy?: string;
  context?: string;
}
