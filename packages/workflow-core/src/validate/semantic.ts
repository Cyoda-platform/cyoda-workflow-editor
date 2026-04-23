import type { WorkflowEditorDocument } from "../types/editor.js";
import type { WorkflowSession } from "../types/session.js";
import type { ValidationIssue } from "../types/validation.js";
import type { Workflow } from "../types/workflow.js";
import { isValidName, walkCriteria } from "./helpers.js";

const LIFECYCLE_FIELDS = new Set(["state", "creationDate", "previousTransition"]);

/**
 * Full semantic validation over a workflow session.
 * Returns all issues found; never throws.
 */
export function validateSemantics(
  session: WorkflowSession,
  doc?: WorkflowEditorDocument,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  issues.push(...duplicateWorkflowNames(session));

  for (const wf of session.workflows) {
    issues.push(...validateWorkflow(wf, doc));
  }

  issues.push(...criterionRules(session));

  if (session.workflows.length === 1) {
    const only = session.workflows[0];
    if (only && only.criterion !== undefined) {
      issues.push({
        severity: "info",
        code: "unused-workflow-criterion",
        message:
          "Workflow-level criterion is set but the session has only one workflow.",
      });
    }
  }

  return issues;
}

function duplicateWorkflowNames(session: WorkflowSession): ValidationIssue[] {
  const seen = new Map<string, number>();
  for (const wf of session.workflows) {
    seen.set(wf.name, (seen.get(wf.name) ?? 0) + 1);
  }
  const out: ValidationIssue[] = [];
  for (const [name, count] of seen) {
    if (count > 1) {
      out.push({
        severity: "error",
        code: "duplicate-workflow-name",
        message: `Duplicate workflow name: "${name}" (appears ${count}×)`,
        detail: { name, count },
      });
    }
  }
  return out;
}

function validateWorkflow(
  wf: Workflow,
  doc?: WorkflowEditorDocument,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // missing-initial-state
  if (!wf.initialState || wf.initialState.length === 0) {
    issues.push({
      severity: "error",
      code: "missing-initial-state",
      message: `Workflow "${wf.name}" has no initialState.`,
      ...idFor(doc, wf.name, "workflow"),
    });
  } else if (!(wf.initialState in wf.states)) {
    issues.push({
      severity: "error",
      code: "unknown-initial-state",
      message: `Workflow "${wf.name}" initialState "${wf.initialState}" is not a state.`,
      ...idFor(doc, wf.name, "workflow"),
    });
  }

  // name regex
  if (!isValidName(wf.name)) {
    issues.push({
      severity: "error",
      code: "name-regex-violation",
      message: `Workflow name "${wf.name}" is invalid.`,
    });
  }

  for (const [stateCode, state] of Object.entries(wf.states)) {
    if (!isValidName(stateCode)) {
      issues.push({
        severity: "error",
        code: "name-regex-violation",
        message: `State code "${stateCode}" is invalid.`,
      });
    }

    // duplicate transition names within a state
    const transitionSeen = new Map<string, number>();
    for (const t of state.transitions) {
      transitionSeen.set(t.name, (transitionSeen.get(t.name) ?? 0) + 1);
      if (!isValidName(t.name)) {
        issues.push({
          severity: "error",
          code: "name-regex-violation",
          message: `Transition name "${t.name}" is invalid.`,
        });
      }
      if (!(t.next in wf.states)) {
        issues.push({
          severity: "error",
          code: "unknown-transition-target",
          message: `Transition "${t.name}" on "${stateCode}" targets unknown state "${t.next}".`,
        });
      }

      // duplicate processor names within a transition
      if (t.processors) {
        const pSeen = new Map<string, number>();
        for (const p of t.processors) {
          pSeen.set(p.name, (pSeen.get(p.name) ?? 0) + 1);
          if (!isValidName(p.name)) {
            issues.push({
              severity: "error",
              code: "name-regex-violation",
              message: `Processor name "${p.name}" is invalid.`,
            });
          }
          if (p.type === "scheduled" && p.config.transition.length === 0) {
            issues.push({
              severity: "error",
              code: "scheduled-missing-target",
              message: `Scheduled processor "${p.name}" has empty target transition.`,
            });
          }
          if (p.type === "externalized" && p.config) {
            if (
              p.config.crossoverToAsyncMs !== undefined &&
              p.config.asyncResult !== true
            ) {
              issues.push({
                severity: "warning",
                code: "crossover-without-async-result",
                message: `Processor "${p.name}" sets crossoverToAsyncMs but asyncResult is not true.`,
              });
            }
          }
        }
        for (const [name, count] of pSeen) {
          if (count > 1) {
            issues.push({
              severity: "error",
              code: "duplicate-processor-name",
              message: `Duplicate processor name "${name}" on transition "${t.name}".`,
            });
          }
        }
        if (t.processors.length > 5) {
          issues.push({
            severity: "warning",
            code: "processor-overload",
            message: `Transition "${t.name}" has ${t.processors.length} processors (>5).`,
          });
        }
      }

      // disabled-transition-on-active-workflow
      if (t.disabled && wf.active) {
        issues.push({
          severity: "warning",
          code: "disabled-transition-on-active-workflow",
          message: `Transition "${t.name}" is disabled in active workflow "${wf.name}".`,
        });
      }

      // scheduled-target-unresolved
      if (t.processors) {
        for (const p of t.processors) {
          if (p.type === "scheduled") {
            const names = collectTransitionNames(wf);
            if (!names.has(p.config.transition)) {
              issues.push({
                severity: "warning",
                code: "scheduled-target-unresolved",
                message: `Scheduled processor "${p.name}" targets unknown transition "${p.config.transition}" in workflow.`,
              });
            }
          }
        }
      }
    }
    for (const [name, count] of transitionSeen) {
      if (count > 1) {
        issues.push({
          severity: "error",
          code: "duplicate-transition-name",
          message: `Duplicate transition name "${name}" on state "${stateCode}".`,
        });
      }
    }

    // excessive-fan-out
    if (state.transitions.length > 8) {
      issues.push({
        severity: "warning",
        code: "excessive-fan-out",
        message: `State "${stateCode}" has ${state.transitions.length} outgoing transitions (>8).`,
      });
    }

    // all-transitions-manual
    if (
      state.transitions.length > 0 &&
      state.transitions.every((t) => t.manual === true)
    ) {
      issues.push({
        severity: "warning",
        code: "all-transitions-manual",
        message: `State "${stateCode}" has only manual transitions.`,
      });
    }

    // terminal-state-derived
    if (state.transitions.length === 0 && stateCode !== wf.initialState) {
      issues.push({
        severity: "info",
        code: "terminal-state-derived",
        message: `State "${stateCode}" is terminal.`,
      });
    }
  }

  // unreachable-state
  const reachable = reachableStates(wf);
  for (const stateCode of Object.keys(wf.states)) {
    if (!reachable.has(stateCode) && stateCode !== wf.initialState) {
      issues.push({
        severity: "warning",
        code: "unreachable-state",
        message: `State "${stateCode}" is unreachable from the initial state.`,
      });
    }
  }

  // workflow-inactive
  if (!wf.active) {
    issues.push({
      severity: "info",
      code: "workflow-inactive",
      message: `Workflow "${wf.name}" is inactive.`,
    });
  }

  // sync-on-likely-bottleneck-transition
  const reachableAuto = reachableAutoStates(wf);
  for (const [stateCode, state] of Object.entries(wf.states)) {
    if (!reachableAuto.has(stateCode)) continue;
    for (const t of state.transitions) {
      if (t.manual) continue;
      if (!t.processors) continue;
      for (const p of t.processors) {
        if (p.type === "externalized" && p.executionMode === "SYNC") {
          issues.push({
            severity: "warning",
            code: "sync-on-likely-bottleneck-transition",
            message: `SYNC processor "${p.name}" on auto-reachable transition "${t.name}" may block the main path.`,
          });
        }
      }
    }
  }

  return issues;
}

function criterionRules(session: WorkflowSession): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const { criterion, where } of walkCriteria(session)) {
    switch (criterion.type) {
      case "function":
        if (!criterion.function.name || criterion.function.name.length === 0) {
          issues.push({
            severity: "error",
            code: "function-missing-name",
            message: `Function criterion has empty name (at ${describe(where)}).`,
          });
        } else if (!isValidName(criterion.function.name)) {
          issues.push({
            severity: "error",
            code: "name-regex-violation",
            message: `Function criterion name "${criterion.function.name}" is invalid.`,
          });
        }
        if (!criterion.function.criterion) {
          issues.push({
            severity: "warning",
            code: "function-without-quick-exit",
            message: `Function criterion "${criterion.function.name}" has no local quick-exit criterion.`,
          });
        }
        break;
      case "array":
        for (const v of criterion.value) {
          if (typeof v !== "string") {
            issues.push({
              severity: "error",
              code: "array-non-string-value",
              message: `Array criterion value contains a non-string element.`,
            });
            break;
          }
        }
        break;
      case "lifecycle":
        if (!LIFECYCLE_FIELDS.has(criterion.field)) {
          issues.push({
            severity: "error",
            code: "lifecycle-invalid-field",
            message: `Lifecycle criterion field "${criterion.field}" is invalid.`,
          });
        }
        break;
      case "group":
        if (criterion.operator === "NOT" && criterion.conditions.length > 1) {
          issues.push({
            severity: "warning",
            code: "not-with-multiple-conditions",
            message: `NOT group has ${criterion.conditions.length} conditions; should have exactly one.`,
          });
        }
        break;
      case "simple":
        break;
    }
  }
  return issues;
}

function reachableStates(wf: Workflow): Set<string> {
  const visited = new Set<string>();
  if (!(wf.initialState in wf.states)) return visited;
  const queue: string[] = [wf.initialState];
  visited.add(wf.initialState);
  while (queue.length) {
    const cur = queue.shift()!;
    const state = wf.states[cur];
    if (!state) continue;
    for (const t of state.transitions) {
      if (!visited.has(t.next) && t.next in wf.states) {
        visited.add(t.next);
        queue.push(t.next);
      }
    }
  }
  return visited;
}

function reachableAutoStates(wf: Workflow): Set<string> {
  // States reachable from initial without traversing a manual gate.
  const visited = new Set<string>();
  if (!(wf.initialState in wf.states)) return visited;
  const queue: string[] = [wf.initialState];
  visited.add(wf.initialState);
  while (queue.length) {
    const cur = queue.shift()!;
    const state = wf.states[cur];
    if (!state) continue;
    for (const t of state.transitions) {
      if (t.manual) continue;
      if (!visited.has(t.next) && t.next in wf.states) {
        visited.add(t.next);
        queue.push(t.next);
      }
    }
  }
  return visited;
}

function collectTransitionNames(wf: Workflow): Set<string> {
  const out = new Set<string>();
  for (const state of Object.values(wf.states)) {
    for (const t of state.transitions) out.add(t.name);
  }
  return out;
}

type CriterionLoc =
  | { kind: "workflow"; workflow: string }
  | {
      kind: "transition";
      workflow: string;
      state: string;
      transitionIndex: number;
      transitionName: string;
    };

function describe(w: CriterionLoc): string {
  if (w.kind === "workflow") return `workflow "${w.workflow}"`;
  return `transition "${w.transitionName}" on "${w.workflow}:${w.state}"`;
}

function idFor(
  doc: WorkflowEditorDocument | undefined,
  workflowName: string,
  _kind: "workflow",
): { targetId?: string } {
  if (!doc) return {};
  const id = doc.meta.ids.workflows[workflowName];
  return id ? { targetId: id } : {};
}
