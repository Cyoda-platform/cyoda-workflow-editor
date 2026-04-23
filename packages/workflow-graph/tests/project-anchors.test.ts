import { describe, expect, test } from "vitest";
import { applyPatch, parseImportPayload } from "@cyoda/workflow-core";
import { projectToGraph } from "../src/index.js";

function parseDoc() {
  const parsed = parseImportPayload(
    JSON.stringify({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "a",
          active: true,
          states: {
            a: {
              transitions: [
                { name: "go", next: "b", manual: false, disabled: false },
              ],
            },
            b: { transitions: [] },
          },
        },
      ],
    }),
  );
  if (!parsed.document) throw new Error("fixture parse failed");
  return parsed.document;
}

describe("projectToGraph — edge anchors read-through", () => {
  test("omits anchors when none are persisted", () => {
    const doc = parseDoc();
    const graph = projectToGraph(doc);
    const edge = graph.edges.find((e) => e.kind === "transition");
    if (!edge || edge.kind !== "transition") throw new Error("no transition edge");
    expect(edge.sourceAnchor).toBeUndefined();
    expect(edge.targetAnchor).toBeUndefined();
  });

  test("surfaces anchors from meta.workflowUi.edgeAnchors", () => {
    const doc = parseDoc();
    const uuid = Object.keys(doc.meta.ids.transitions)[0]!;
    const withAnchors = applyPatch(doc, {
      op: "setEdgeAnchors",
      transitionUuid: uuid,
      anchors: { source: "right", target: "left" },
    });
    const graph = projectToGraph(withAnchors);
    const edge = graph.edges.find((e) => e.kind === "transition" && e.id === uuid);
    if (!edge || edge.kind !== "transition") throw new Error("transition not projected");
    expect(edge.sourceAnchor).toBe("right");
    expect(edge.targetAnchor).toBe("left");
  });
});
