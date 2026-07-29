import type { Workflow } from "../types/workflow.js";

/**
 * Most cycles reported for one workflow before the report is truncated.
 *
 * Reporting is capped because it is quadratic: each back-edge copies the whole
 * DFS path, and the caller renders every node of every cycle into a message
 * that lands in the issues drawer. A 3,000-state workflow with a few back-edges
 * per state produced 12,001 issues whose messages ran to tens of KB each.
 */
export const MAX_REPORTED_CYCLES = 20;

/** Most state codes listed in one reported cycle before its path is truncated. */
export const MAX_CYCLE_PATH_NODES = 20;

/** One detected cycle, with its path capped at {@link MAX_CYCLE_PATH_NODES}. */
export interface UnguardedCycle {
  /** The cycle path, starting and (when complete) ending at the same state. */
  path: string[];
  /** Full path length before capping; greater than `path.length` when cut. */
  length: number;
}

export interface UnguardedCycleReport {
  /** The first {@link MAX_REPORTED_CYCLES} cycles found. */
  cycles: UnguardedCycle[];
  /** Every cycle detected, including those omitted from `cycles`. */
  total: number;
}

/**
 * Find cycles reachable purely via unguarded automated transitions — the same
 * shape cyoda-go rejects at import with "infinite loop detected".
 *
 * An edge counts when it is not `manual: true`, not `disabled`, and carries no
 * criterion. Both predicates are deliberately tolerant of absent keys:
 * `criterion` absent OR explicitly `null` counts as unguarded, and `manual`
 * absent counts as automated (the server's default) — checked with `== null` /
 * `!== true` rather than `=== undefined` / `=== false` so this holds regardless
 * of whether the caller has run Task 7's null-stripping normalization first
 * (e.g. `validateAfterPatch` calls `validateSemantics` directly on a session
 * built from raw JSON, with no normalization pass). A `schedule` does NOT
 * exempt an edge: the server rejects an all-scheduled cycle with the same
 * message, and the scheduled-polling pattern 0.8.3 promotes is exactly this
 * shape.
 *
 * The traversal is an explicit-stack iterative DFS, never recursion — same
 * reason as `criterionMaxDepth` in `validate/semantic.ts` and
 * `exceedsObjectDepth` in `parse/parse-import.ts`. A chain of a few thousand
 * automated unguarded transitions fits well inside the 5 MB `MAX_JSON_BYTES`
 * parse guard but blew the call stack of the previous recursive version, and
 * the resulting `RangeError` escaped `parseImportPayload` untyped and tore down
 * the React editor from inside a `useMemo`.
 *
 * NB: this is necessary but NOT sufficient. cyoda-go runs detection against the
 * MERGED STORED result, so a MERGE can be rejected because of a cycle in a
 * workflow that is not in the payload at all. That is why the caller reports
 * this as a warning rather than an error.
 */
export function findUnguardedCycles(wf: Workflow): UnguardedCycleReport {
  const edges = new Map<string, string[]>();
  for (const [code, state] of Object.entries(wf.states)) {
    edges.set(
      code,
      state.transitions
        .filter((t) => t.manual !== true && !t.disabled && t.criterion == null)
        .map((t) => t.next),
    );
  }

  const cycles: UnguardedCycle[] = [];
  let total = 0;
  // 0 = unvisited, 1 = on the current path (grey), 2 = finished (black).
  const colour = new Map<string, 0 | 1 | 2>();
  const path: string[] = [];
  /** Index of each grey node in `path` — an O(1) stand-in for `indexOf`. */
  const pathIndex = new Map<string, number>();
  /** One frame per grey node: which of its outgoing edges to follow next. */
  const frames: { node: string; edge: number }[] = [];

  const enter = (node: string): void => {
    colour.set(node, 1);
    pathIndex.set(node, path.length);
    path.push(node);
    frames.push({ node, edge: 0 });
  };

  for (const root of edges.keys()) {
    if ((colour.get(root) ?? 0) !== 0) continue;
    enter(root);
    while (frames.length > 0) {
      const frame = frames[frames.length - 1]!;
      const outgoing = edges.get(frame.node) ?? [];
      if (frame.edge >= outgoing.length) {
        frames.pop();
        path.pop();
        pathIndex.delete(frame.node);
        colour.set(frame.node, 2);
        continue;
      }
      const next = outgoing[frame.edge++]!;
      const c = colour.get(next) ?? 0;
      if (c === 1) {
        // Back-edge to a node still on the path: a cycle. Keep counting past
        // the reporting cap — the traversal is linear, only the copying is not.
        total++;
        if (cycles.length < MAX_REPORTED_CYCLES) {
          const start = pathIndex.get(next)!;
          const full = path.length - start + 1;
          const capped = path.slice(start, start + MAX_CYCLE_PATH_NODES);
          // Close the loop only when the whole path fitted under the cap.
          if (capped.length < MAX_CYCLE_PATH_NODES) capped.push(next);
          cycles.push({ path: capped, length: full });
        }
      } else if (c === 0) {
        enter(next);
      }
    }
  }

  return { cycles, total };
}
