import { describe, expect, test } from "vitest";
import { validateSemantics } from "../../src/validate/semantic.js";
import type { Criterion } from "../../src/types/criterion.js";
import type { WorkflowSession } from "../../src/types/session.js";
import type { Transition } from "../../src/types/workflow.js";

function tr(
  name: string,
  opts: {
    manual?: boolean;
    disabled?: boolean;
    criterion?: Criterion;
    next?: string;
  } = {},
): Transition {
  return {
    name,
    next: opts.next ?? "end",
    manual: opts.manual ?? false,
    disabled: opts.disabled ?? false,
    ...(opts.criterion ? { criterion: opts.criterion } : {}),
  };
}

function sessionWith(transitions: Transition[]): WorkflowSession {
  return {
    entity: null,
    importMode: "MERGE",
    workflows: [
      {
        version: "1.3",
        name: "wf",
        initialState: "start",
        active: true,
        states: {
          start: { transitions },
          end: { transitions: [] },
        },
      },
    ],
  };
}

const SIMPLE: Criterion = {
  type: "simple",
  jsonPath: "$.x",
  operation: "EQUALS",
  value: 1,
};

describe("automated transition ordering rules", () => {
  test("single null-criterion automated transition → no warning", () => {
    const issues = validateSemantics(sessionWith([tr("go")]));
    const codes = issues.map((i) => i.code);
    expect(codes).not.toContain("null-criterion-not-last");
    expect(codes).not.toContain("unreachable-automated-transition");
  });

  test("null-criterion followed by another automated → single offender warning lists the dead transitions", () => {
    const issues = validateSemantics(
      sessionWith([tr("go"), tr("fallback", { criterion: SIMPLE })]),
    );
    const offenders = issues.filter((i) => i.code === "null-criterion-not-last");
    expect(offenders).toHaveLength(1);
    expect(offenders[0]?.severity).toBe("warning");
    expect(offenders[0]?.detail?.["transitionName"]).toBe("go");
    expect(offenders[0]?.detail?.["unreachable"]).toEqual(["fallback"]);
    // The per-victim code is collapsed into the offender warning.
    expect(issues.map((i) => i.code)).not.toContain("unreachable-automated-transition");
  });

  test("null-criterion followed only by manual transitions → no warning", () => {
    const codes = validateSemantics(
      sessionWith([tr("go"), tr("approve", { manual: true })]),
    ).map((i) => i.code);
    expect(codes).not.toContain("null-criterion-not-last");
    expect(codes).not.toContain("unreachable-automated-transition");
  });

  test("null-criterion followed only by disabled automated → no warning", () => {
    const codes = validateSemantics(
      sessionWith([tr("go"), tr("legacy", { disabled: true })]),
    ).map((i) => i.code);
    expect(codes).not.toContain("null-criterion-not-last");
    expect(codes).not.toContain("unreachable-automated-transition");
  });

  test("null-criterion in middle → offender warning names the later dead transition", () => {
    const issues = validateSemantics(
      sessionWith([
        tr("first", { criterion: SIMPLE }),
        tr("middle"),
        tr("last", { criterion: SIMPLE }),
      ]),
    );
    const offenders = issues.filter((i) => i.code === "null-criterion-not-last");
    expect(offenders).toHaveLength(1);
    expect(offenders[0]?.detail?.["transitionName"]).toBe("middle");
    expect(offenders[0]?.detail?.["unreachable"]).toEqual(["last"]);
    expect(issues.map((i) => i.code)).not.toContain("unreachable-automated-transition");
  });

  test("two null-criterion automateds in a row → one offender warning listing the rest", () => {
    const issues = validateSemantics(
      sessionWith([tr("alpha"), tr("beta")]),
    );
    const offenders = issues.filter((i) => i.code === "null-criterion-not-last");
    expect(offenders).toHaveLength(1);
    expect(offenders[0]?.detail?.["transitionName"]).toBe("alpha");
    expect(offenders[0]?.detail?.["unreachable"]).toEqual(["beta"]);
    expect(issues.map((i) => i.code)).not.toContain("unreachable-automated-transition");
  });

  test("an explicit criterion: null counts as unguarded, same as an absent one", () => {
    // `validateSemantics` is public API and `validateAfterPatch` calls it with
    // zero normalization, so an explicit `null` (what the server emits and what
    // a hand-edited document carries) must not silently stop the rule firing —
    // the same argument `findUnguardedCycles` already applies with `== null`.
    const unguarded = { ...tr("go"), criterion: null } as unknown as Transition;
    const offenders = validateSemantics(
      sessionWith([unguarded, tr("fallback", { criterion: SIMPLE })]),
    ).filter((i) => i.code === "null-criterion-not-last");
    expect(offenders).toHaveLength(1);
    expect(offenders[0]?.detail?.["unreachable"]).toEqual(["fallback"]);
  });

  test("all guarded automated transitions → no warnings emitted", () => {
    const codes = validateSemantics(
      sessionWith([
        tr("a", { criterion: SIMPLE }),
        tr("b", { criterion: SIMPLE }),
        tr("c", { criterion: SIMPLE }),
      ]),
    ).map((i) => i.code);
    expect(codes).not.toContain("null-criterion-not-last");
    expect(codes).not.toContain("unreachable-automated-transition");
  });
});
