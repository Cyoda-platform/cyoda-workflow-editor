import { describe, expect, test } from "vitest";
import { validateSemantics } from "../../src/validate/semantic.js";
import type { WorkflowSession } from "../../src/types/session.js";

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
});
