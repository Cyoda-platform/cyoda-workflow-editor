import { describe, expect, test } from "vitest";
import { parseImportPayload } from "@cyoda/workflow-core";
import { applyGraphEdit } from "../src/index.js";

function docOf(workflows: unknown[]) {
  const parsed = parseImportPayload(
    JSON.stringify({ importMode: "MERGE", workflows }),
  );
  if (!parsed.document) throw new Error("parse failed");
  return parsed.document;
}

describe("applyGraphEdit", () => {
  test("moveState produces no domain patches", () => {
    const doc = docOf([
      {
        version: "1.0",
        name: "wf",
        initialState: "a",
        active: true,
        states: { a: { transitions: [] } },
      },
    ]);
    const patches = applyGraphEdit(doc, {
      kind: "moveState",
      workflow: "wf",
      stateCode: "a",
      x: 100,
      y: 50,
    });
    expect(patches).toEqual([]);
  });

  test("toggleDisabled emits updateTransition patch", () => {
    const doc = docOf([
      {
        version: "1.0",
        name: "wf",
        initialState: "a",
        active: true,
        states: {
          a: {
            transitions: [{ name: "go", next: "b", manual: false, disabled: false }],
          },
          b: { transitions: [] },
        },
      },
    ]);
    const transitionUuid = Object.keys(doc.meta.ids.transitions)[0]!;
    const patches = applyGraphEdit(doc, {
      kind: "toggleDisabled",
      transitionUuid,
      disabled: true,
    });
    expect(patches).toEqual([
      {
        op: "updateTransition",
        transitionUuid,
        updates: { disabled: true },
      },
    ]);
  });

  test("deleteState emits removeState patch", () => {
    const doc = docOf([
      {
        version: "1.0",
        name: "wf",
        initialState: "a",
        active: true,
        states: { a: { transitions: [] }, b: { transitions: [] } },
      },
    ]);
    const patches = applyGraphEdit(doc, {
      kind: "deleteState",
      workflow: "wf",
      stateCode: "b",
    });
    expect(patches).toEqual([
      { op: "removeState", workflow: "wf", stateCode: "b" },
    ]);
  });
});
