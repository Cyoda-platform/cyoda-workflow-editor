import { describe, expect, test } from "vitest";
import { applyPatch, invertPatch } from "../../src/index.js";
import { makeDoc } from "./helpers.js";

describe("setAnnotations criterion targets", () => {
  test("workflowCriterion sets and clears workflow.criterionAnnotations", () => {
    const doc = makeDoc();
    const set = applyPatch(doc, { op: "setAnnotations",
      target: { kind: "workflowCriterion", workflow: "wf" }, annotations: { displayName: "g" } });
    expect(set.session.workflows[0]!.criterionAnnotations).toEqual({ displayName: "g" });
    const inv = invertPatch(doc, { op: "setAnnotations",
      target: { kind: "workflowCriterion", workflow: "wf" }, annotations: { displayName: "g" } });
    const back = applyPatch(set, inv);
    expect(back.session).toEqual(doc.session);
  });
});
