import { describe, expect, test } from "vitest";
import { validateSemantics } from "../../src/validate/semantic.js";
import {
  findUnguardedCycles,
  MAX_CYCLE_PATH_NODES,
  MAX_REPORTED_CYCLES,
} from "../../src/validate/cycles.js";
import type { WorkflowSession } from "../../src/types/session.js";
import type { Workflow } from "../../src/types/workflow.js";

function session(
  states: Record<string, unknown>,
  opts: { active?: boolean; allowCycles?: boolean } = {},
): WorkflowSession {
  return {
    entity: null,
    importMode: "MERGE",
    ...(opts.allowCycles !== undefined ? { allowCycles: opts.allowCycles } : {}),
    workflows: [{
      version: "1.3", name: "w", initialState: "A",
      active: opts.active ?? true, states,
    }],
  } as unknown as WorkflowSession;
}

const T = (o: Record<string, unknown>) => ({ disabled: false, ...o });
const has = (s: WorkflowSession) =>
  validateSemantics(s).some((i) => i.code === "unguarded-automated-cycle");

describe("unguarded automated cycles (spec §4)", () => {
  test("detects a two-state cycle", () => {
    expect(has(session({
      A: { transitions: [T({ name: "g1", next: "B", manual: false })] },
      B: { transitions: [T({ name: "g2", next: "A", manual: false })] },
    }))).toBe(true);
  });

  test("detects a self-loop", () => {
    expect(has(session({
      A: { transitions: [T({ name: "s", next: "A", manual: false })] },
    }))).toBe(true);
  });

  test("explicit criterion: null counts as unguarded, even without normalization", () => {
    // validateSemantics is called directly here on a raw session — the same
    // way patch/apply.ts's validateAfterPatch drives live-edit validation,
    // with no null-stripping normalization pass in between. The detector
    // must treat a literal `criterion: null` as unguarded on its own terms,
    // not rely on an upstream pass having already stripped it to absent.
    expect(has(session({
      A: { transitions: [T({ name: "s", next: "A", manual: false, criterion: null })] },
    }))).toBe(true);
  });

  test("still detects a cycle in an INACTIVE workflow", () => {
    // The server does not skip inactive workflows during cycle detection,
    // even though workflow SELECTION skips them at runtime.
    expect(has(session({
      A: { transitions: [T({ name: "s", next: "A", manual: false })] },
    }, { active: false }))).toBe(true);
  });

  test("a criterion on one edge breaks the cycle", () => {
    expect(has(session({
      A: { transitions: [T({ name: "g1", next: "B", manual: false,
        criterion: { type: "simple", jsonPath: "$.x", operation: "EQUALS", value: "1" } })] },
      B: { transitions: [T({ name: "g2", next: "A", manual: false })] },
    }))).toBe(false);
  });

  test("manual: true on one edge breaks the cycle", () => {
    expect(has(session({
      A: { transitions: [T({ name: "g1", next: "B", manual: true })] },
      B: { transitions: [T({ name: "g2", next: "A", manual: false })] },
    }))).toBe(false);
  });

  test("disabled: true on one edge breaks the cycle", () => {
    expect(has(session({
      A: { transitions: [{ name: "s", next: "A", manual: false, disabled: true }] },
    }))).toBe(false);
  });

  test("a scheduled transition still counts as automated", () => {
    expect(has(session({
      A: { transitions: [T({ name: "g1", next: "B", manual: false, schedule: { delayMs: 1000 } })] },
      B: { transitions: [T({ name: "g2", next: "A", manual: false, schedule: { delayMs: 1000 } })] },
    }))).toBe(true);
  });

  test("allowCycles: true suppresses the warning", () => {
    expect(has(session({
      A: { transitions: [T({ name: "s", next: "A", manual: false })] },
    }, { allowCycles: true }))).toBe(false);
  });

  test("is a warning, never an error", () => {
    const issue = validateSemantics(session({
      A: { transitions: [T({ name: "s", next: "A", manual: false })] },
    })).find((i) => i.code === "unguarded-automated-cycle");
    expect(issue?.severity).toBe("warning");
  });

  test("an ABSENT `manual` counts as automated, same as `manual: false`", () => {
    // The server treats an absent `manual` as automated. Zod makes it required
    // so parse can't produce this, but `validateSemantics` is public API and
    // `validateAfterPatch` calls it on unnormalized sessions — the same
    // null-tolerance rationale that governs the `criterion` check on this line.
    expect(has(session({
      A: { transitions: [{ name: "s", next: "A", disabled: false }] },
    }))).toBe(true);
  });
});

/** Chain S0 -> S1 -> ... -> S(n), all unguarded automated, plus `extra` edges. */
function chainWorkflow(
  n: number,
  extra: (i: number) => string[] = () => [],
): Workflow {
  const states: Record<string, unknown> = {};
  for (let i = 0; i <= n; i++) {
    const targets = [...(i < n ? [`S${i + 1}`] : []), ...extra(i)];
    states[`S${i}`] = {
      transitions: targets.map((next, k) => ({
        name: `t${i}_${k}`, next, manual: false, disabled: false,
      })),
    };
  }
  return {
    version: "1.3", name: "w", initialState: "S0", active: true, states,
  } as unknown as Workflow;
}

describe("cycle detection scales (post-review items 2)", () => {
  test("a 20k-state chain does not overflow the stack", () => {
    // The detector used to recurse once per state; ~7k states was enough to
    // throw RangeError on Node, and browser stacks are smaller. 20k states is
    // ~1.4 MB of JSON — well inside the 5 MB MAX_JSON_BYTES parse guard.
    expect(() => findUnguardedCycles(chainWorkflow(20_000))).not.toThrow();
  });

  test("the number of reported cycles is capped, and the cap is announced", () => {
    // A 3k chain closed by 60 back-edges to S0: 60 cycles, each thousands of
    // nodes long. Reporting all of them was O(N^2) in both time and message
    // bytes, and every byte was rendered in the issues drawer.
    const wf = chainWorkflow(3_000, (i) => (i > 0 && i % 50 === 0 ? ["S0"] : []));
    const report = findUnguardedCycles(wf);
    expect(report.total).toBeGreaterThan(MAX_REPORTED_CYCLES);
    expect(report.cycles.length).toBe(MAX_REPORTED_CYCLES);

    const issues = validateSemantics({
      entity: null, importMode: "MERGE", workflows: [wf],
    } as unknown as WorkflowSession).filter((i) => i.code === "unguarded-automated-cycle");
    // Every reported cycle, plus exactly one "and N more" truncation note.
    expect(issues.length).toBe(MAX_REPORTED_CYCLES + 1);
    expect(issues[issues.length - 1]!.message).toContain(`${report.total}`);
    expect(issues[issues.length - 1]!.message).toMatch(/only the first/i);
  });

  test("each reported cycle's path is capped, and the cut is announced", () => {
    const wf = chainWorkflow(500, (i) => (i === 500 ? ["S0"] : []));
    const report = findUnguardedCycles(wf);
    expect(report.cycles).toHaveLength(1);
    expect(report.cycles[0]!.path.length).toBe(MAX_CYCLE_PATH_NODES);
    expect(report.cycles[0]!.length).toBe(502);

    const issues = validateSemantics({
      entity: null, importMode: "MERGE", workflows: [wf],
    } as unknown as WorkflowSession).filter((i) => i.code === "unguarded-automated-cycle");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toMatch(/more states omitted/i);
    // The whole point of the cap: a bounded message, not tens of KB.
    expect(issues[0]!.message.length).toBeLessThan(1_000);
  });

  test("short cycles are reported in full, unchanged", () => {
    const report = findUnguardedCycles(chainWorkflow(2, (i) => (i === 2 ? ["S0"] : [])));
    expect(report.total).toBe(1);
    expect(report.cycles[0]!.path).toEqual(["S0", "S1", "S2", "S0"]);
    expect(report.cycles[0]!.length).toBe(4);
  });
});
