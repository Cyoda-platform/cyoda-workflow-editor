import { describe, expect, test } from "vitest";
import { parseImportPayload } from "../../src/index.js";

const PAYLOAD = {
  importMode: "REPLACE",
  workflows: [{
    version: "1.2", name: "wf", initialState: "S", active: true,
    criterionAnnotations: { displayName: "WF guard" },
    states: { S: { transitions: [{
      name: "t", next: "S", manual: true,
      criterionAnnotations: { displayName: "T guard", description: "d" },
      criterion: { type: "simple", jsonPath: "$.x", operation: "EQUALS", value: 1 },
      processors: [{ type: "externalized", name: "p1", executionMode: "SYNC",
        annotations: { displayName: "Proc One" } }],
    }] } },
  }],
};

describe("processor & criterion annotations parse", () => {
  test("parses the three new fields into the canonical model", () => {
    const { document, issues } = parseImportPayload(JSON.stringify(PAYLOAD));
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    const wf = document!.session.workflows[0]!;
    expect(wf.criterionAnnotations).toEqual({ displayName: "WF guard" });
    const t = wf.states.S!.transitions[0]!;
    expect(t.criterionAnnotations).toEqual({ displayName: "T guard", description: "d" });
    expect(t.processors![0]!.annotations).toEqual({ displayName: "Proc One" });
    // The criterion blob is untouched.
    expect(t.criterion).toMatchObject({ type: "simple", jsonPath: "$.x" });
  });

  test("does not alias operatorType inside criterionAnnotations", () => {
    const payload = { ...PAYLOAD, workflows: [{ ...PAYLOAD.workflows[0]!,
      criterionAnnotations: { operatorType: "keep-me" } }] };
    const { document } = parseImportPayload(JSON.stringify(payload));
    expect(document!.session.workflows[0]!.criterionAnnotations).toEqual({ operatorType: "keep-me" });
  });
});
