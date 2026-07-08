import { describe, expect, test } from "vitest";
import { applyPatch, invertPatch } from "../../src/index.js";
import { firstTransitionUuid, makeDoc } from "./helpers.js";

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

  test("transitionCriterion sets and clears transition.criterionAnnotations", () => {
    const doc0 = makeDoc();
    const doc = applyPatch(doc0, {
      op: "addTransition",
      workflow: "wf",
      fromState: "start",
      transition: { name: "go", next: "end", manual: false, disabled: false },
    });
    const transitionUuid = firstTransitionUuid(doc, "wf", "start");
    const set = applyPatch(doc, { op: "setAnnotations",
      target: { kind: "transitionCriterion", transitionUuid }, annotations: { displayName: "g" } });
    expect(set.session.workflows[0]!.states["start"]!.transitions[0]!.criterionAnnotations).toEqual({ displayName: "g" });
    const inv = invertPatch(doc, { op: "setAnnotations",
      target: { kind: "transitionCriterion", transitionUuid }, annotations: { displayName: "g" } });
    const back = applyPatch(set, inv);
    expect(back.session).toEqual(doc.session);
  });
});
