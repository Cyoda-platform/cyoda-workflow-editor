import { describe, expect, test } from "vitest";
import { validateSemantics } from "../../src/validate/semantic.js";
import type { WorkflowSession } from "../../src/types/session.js";

function session(transition: Record<string, unknown>): WorkflowSession {
  return {
    entity: null,
    importMode: "MERGE",
    workflows: [{
      version: "1.3", name: "w", initialState: "A", active: true,
      states: { A: { transitions: [{ disabled: false, ...transition }] } },
    }],
  } as unknown as WorkflowSession;
}

const codes = (t: Record<string, unknown>) => validateSemantics(session(t)).map((i) => i.code);
const FN = { name: "c", resultKind: "Schedule", calculationNodesTags: "s" };

describe("schedule semantic rules (spec §4)", () => {
  test("flags a schedule with neither mode", () => {
    expect(codes({ name: "t", next: "A", manual: false, schedule: { timeoutMs: 5 } }))
      .toContain("schedule-mode-required");
  });

  test("flags a schedule with both modes", () => {
    expect(codes({ name: "t", next: "A", manual: false, schedule: { delayMs: 5, function: FN } }))
      .toContain("schedule-mode-required");
  });

  test("flags schedule together with manual: true", () => {
    expect(codes({ name: "t", next: "A", manual: true, schedule: { delayMs: 5 } }))
      .toContain("schedule-manual-conflict");
  });

  test("flags an incomplete schedule function", () => {
    expect(codes({
      name: "t", next: "A", manual: false,
      schedule: { function: { ...FN, calculationNodesTags: "" } },
    })).toContain("schedule-function-incomplete");
  });

  test("warns on a negative timeoutMs without blocking", () => {
    const issues = validateSemantics(session({
      name: "t", next: "A", manual: false, schedule: { delayMs: 5, timeoutMs: -1 },
    }));
    const issue = issues.find((i) => i.code === "schedule-timeout-negative");
    expect(issue?.severity).toBe("warning");
  });

  test("accepts a valid static schedule", () => {
    expect(codes({ name: "t", next: "A", manual: false, schedule: { delayMs: 5, timeoutMs: 0 } }))
      .not.toContain("schedule-mode-required");
  });

  test("does not fire on a transition with no schedule", () => {
    const c = codes({ name: "t", next: "A", manual: true });
    expect(c).not.toContain("schedule-mode-required");
    expect(c).not.toContain("schedule-manual-conflict");
  });
});
