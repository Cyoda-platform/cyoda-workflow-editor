import { describe, expect, test } from "vitest";
import { validateSemantics } from "../../src/validate/semantic.js";
import type { Criterion } from "../../src/types/criterion.js";
import type { WorkflowSession } from "../../src/types/session.js";

const SIMPLE: Criterion = { type: "simple", jsonPath: "$.x", operation: "EQUALS", value: 1 };

function session(criterion: unknown): WorkflowSession {
  return {
    entity: null,
    importMode: "MERGE",
    workflows: [
      {
        version: "1.3",
        name: "w",
        initialState: "a",
        active: true,
        ...(criterion !== undefined ? { criterion } : {}),
        states: { a: { transitions: [] } },
      },
    ],
  } as unknown as WorkflowSession;
}

const has = (s: WorkflowSession) =>
  validateSemantics(s).some((i) => i.code === "unused-workflow-criterion");

describe("unused-workflow-criterion", () => {
  test("fires when a real criterion is set on the session's only workflow", () => {
    expect(has(session(SIMPLE))).toBe(true);
  });

  test("does not fire when the criterion is absent", () => {
    expect(has(session(undefined))).toBe(false);
  });

  test("does not fire for an explicit criterion: null (validateAfterPatch path)", () => {
    // `validateSemantics` is public API and `patch/apply.ts`'s
    // `validateAfterPatch` calls it with zero normalization, so a literal
    // `criterion: null` (what the server emits, and what a hand-edited
    // document carries) reaches this rule un-stripped. The old
    // `!== undefined` check treats null as "distinct from absent" and fires
    // spuriously, calling a cleared/absent-equivalent criterion "set" — the
    // same predicate mismatch already fixed in `validate/cycles.ts` and the
    // null-criterion-not-last rule in this same file.
    expect(has(session(null))).toBe(false);
  });
});
