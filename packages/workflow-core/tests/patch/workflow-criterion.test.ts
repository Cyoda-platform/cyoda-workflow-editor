import { describe, expect, test } from "vitest";
import {
  applyPatch,
  invertPatch,
  parseImportPayload,
  serializeImportPayload,
} from "../../src/index.js";
import type { Criterion, DomainPatch } from "../../src/index.js";
import { makeDoc } from "./helpers.js";

const CRIT: Criterion = {
  type: "simple",
  jsonPath: "$.kind",
  operation: "EQUALS",
  value: "order",
};

const setWorkflowCrit = (criterion?: Criterion): DomainPatch => ({
  op: "setCriterion",
  host: { kind: "workflow", workflow: "wf" },
  path: ["criterion"],
  criterion,
});

describe("setCriterion with a workflow host", () => {
  test("apply sets the workflow-level criterion", () => {
    const doc = makeDoc();
    const after = applyPatch(doc, setWorkflowCrit(CRIT));
    expect(after.session.workflows[0]!.criterion).toEqual(CRIT);
  });

  test("apply with undefined clears the workflow-level criterion", () => {
    const doc0 = makeDoc();
    const doc1 = applyPatch(doc0, setWorkflowCrit(CRIT));
    const doc2 = applyPatch(doc1, setWorkflowCrit(undefined));
    expect(doc2.session.workflows[0]!.criterion).toBeUndefined();
  });

  test("invert restores the prior workflow criterion (set then undo)", () => {
    const doc = makeDoc();
    const patch = setWorkflowCrit(CRIT);
    const afterApply = applyPatch(doc, patch);
    const inverse = invertPatch(doc, patch);
    const afterInvert = applyPatch(afterApply, inverse);
    expect(afterInvert.session).toEqual(doc.session);
  });

  test("workflow criterion survives a parse -> serialize round-trip", () => {
    const doc = applyPatch(makeDoc(), setWorkflowCrit(CRIT));
    const wire = serializeImportPayload(doc);
    const reparsed = parseImportPayload(wire);
    expect(reparsed.document?.session.workflows[0]!.criterion).toEqual(CRIT);
  });
});
