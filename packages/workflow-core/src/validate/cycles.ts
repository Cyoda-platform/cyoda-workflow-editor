import type { Workflow } from "../types/workflow.js";

/**
 * Find cycles reachable purely via unguarded automated transitions — the same
 * shape cyoda-go rejects at import with "infinite loop detected".
 *
 * An edge counts when it is `manual: false`, not `disabled`, and carries no
 * criterion. A `schedule` does NOT exempt an edge: the server rejects an
 * all-scheduled cycle with the same message, and the scheduled-polling pattern
 * 0.8.3 promotes is exactly this shape.
 *
 * NB: this is necessary but NOT sufficient. cyoda-go runs detection against the
 * MERGED STORED result, so a MERGE can be rejected because of a cycle in a
 * workflow that is not in the payload at all. That is why the caller reports
 * this as a warning rather than an error.
 */
export function findUnguardedCycles(wf: Workflow): string[][] {
  const edges = new Map<string, string[]>();
  for (const [code, state] of Object.entries(wf.states)) {
    edges.set(
      code,
      state.transitions
        .filter((t) => t.manual === false && !t.disabled && t.criterion === undefined)
        .map((t) => t.next),
    );
  }

  const cycles: string[][] = [];
  const colour = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];

  const visit = (node: string): void => {
    colour.set(node, 1);
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      const c = colour.get(next) ?? 0;
      if (c === 1) {
        cycles.push([...stack.slice(stack.indexOf(next)), next]);
      } else if (c === 0) {
        visit(next);
      }
    }
    stack.pop();
    colour.set(node, 2);
  };

  for (const code of edges.keys()) if ((colour.get(code) ?? 0) === 0) visit(code);
  return cycles;
}
