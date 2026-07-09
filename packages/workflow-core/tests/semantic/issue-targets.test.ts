import { describe, expect, test } from "vitest";
import { parseImportPayload, validateAll } from "../../src/index.js";

function docOf(json: unknown) {
  const result = parseImportPayload(JSON.stringify(json));
  if (!result.document) throw new Error("fixture parse failed");
  return result.document;
}

describe("issue jump targets (clickable rules)", () => {
  test("unreachable-state carries a state targetId that resolves to the state", () => {
    const doc = docOf({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "a",
          active: true,
          states: { a: { transitions: [] }, orphan: { transitions: [] } },
        },
      ],
    });
    const issue = validateAll(doc).find((i) => i.code === "unreachable-state");
    expect(issue?.targetId).toBeTruthy();
    expect(doc.meta.ids.states[issue!.targetId!]).toMatchObject({ workflow: "wf", state: "orphan" });
  });

  test("disabled-transition-on-active-workflow is info and carries a transition targetId", () => {
    const doc = docOf({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "a",
          active: true,
          states: {
            a: { transitions: [{ name: "t", next: "b", manual: false, disabled: true }] },
            b: { transitions: [] },
          },
        },
      ],
    });
    const issue = validateAll(doc).find(
      (i) => i.code === "disabled-transition-on-active-workflow",
    );
    expect(issue?.severity).toBe("info");
    expect(issue?.targetId).toBeTruthy();
    expect(doc.meta.ids.transitions[issue!.targetId!]).toMatchObject({ workflow: "wf", state: "a" });
  });

  test("unknown-transition-target carries the transition targetId", () => {
    const doc = docOf({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "a",
          active: true,
          states: { a: { transitions: [{ name: "t", next: "ghost", manual: false, disabled: false }] } },
        },
      ],
    });
    const issue = validateAll(doc).find((i) => i.code === "unknown-transition-target");
    expect(issue?.severity).toBe("error");
    expect(issue?.targetId).toBeTruthy();
    expect(doc.meta.ids.transitions[issue!.targetId!]).toMatchObject({ workflow: "wf", state: "a" });
  });
});
