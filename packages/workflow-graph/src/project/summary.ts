import type { Criterion, Processor, Transition } from "@cyoda/workflow-core";
import type {
  CriterionSummary,
  ExecutionSummary,
  ProcessorSummary,
  TransitionSummary,
} from "../types.js";
import { opShort, truncate } from "./op-short.js";

export function summarizeTransition(t: Transition): TransitionSummary {
  const summary: TransitionSummary = {
    display: truncate(t.name),
    full: t.name,
  };
  if (t.criterion) summary.criterion = summarizeCriterion(t.criterion);
  const proc = summarizeProcessors(t.processors);
  if (proc) summary.processor = proc;
  const exec = summarizeExecution(t.processors);
  if (exec) summary.execution = exec;
  return summary;
}

export function summarizeCriterion(c: Criterion): CriterionSummary {
  switch (c.type) {
    case "simple":
      return { kind: "simple", op: opShort(c.operation), path: truncate(c.jsonPath) };
    case "function":
      return { kind: "function", name: truncate(c.function.name) };
    case "lifecycle":
      return { kind: "lifecycle", field: c.field, op: opShort(c.operation) };
    case "array":
      return { kind: "array", op: opShort(c.operation), path: truncate(c.jsonPath) };
    case "group":
      return { kind: "group", operator: c.operator, count: c.conditions.length };
  }
}

export function summarizeProcessors(
  processors: Processor[] | undefined,
): ProcessorSummary | undefined {
  if (!processors || processors.length === 0) return undefined;
  if (processors.length === 1) {
    const first = processors[0]!;
    return { kind: "single", name: truncate(first.name) };
  }
  return { kind: "multiple", count: processors.length };
}

/**
 * Execution-mode summary (spec §10.4). Only returned when the "dominant"
 * mode is non-default (ASYNC_NEW_TX is the default and omitted).
 * Dominant = mode of the first externalized processor; if none, returns
 * undefined.
 */
export function summarizeExecution(
  processors: Processor[] | undefined,
): ExecutionSummary | undefined {
  if (!processors) return undefined;
  for (const p of processors) {
    if (p.type !== "externalized") continue;
    const mode = p.executionMode ?? "ASYNC_NEW_TX";
    if (mode === "SYNC") return { kind: "sync" };
    if (mode === "ASYNC_SAME_TX") return { kind: "asyncSameTx" };
    return undefined; // ASYNC_NEW_TX — default, omitted.
  }
  return undefined;
}
