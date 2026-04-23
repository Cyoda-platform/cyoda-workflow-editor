import { describe, expect, test } from "vitest";
import { parseImportPayload } from "@cyoda/workflow-core";
import { projectToGraph } from "../src/index.js";

function project(json: unknown) {
  const parsed = parseImportPayload(JSON.stringify(json));
  if (!parsed.document) throw new Error("parse failed: " + JSON.stringify(parsed.issues));
  return projectToGraph(parsed.document, { issues: parsed.issues });
}

describe("projectToGraph", () => {
  test("minimal workflow yields 2 states + 1 transition + start marker", () => {
    const graph = project({
      importMode: "MERGE",
      workflows: [
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
      ],
    });
    const stateNodes = graph.nodes.filter((n) => n.kind === "state");
    const markers = graph.nodes.filter((n) => n.kind === "startMarker");
    expect(stateNodes).toHaveLength(2);
    expect(markers).toHaveLength(1);
    const transitionEdges = graph.edges.filter((e) => e.kind === "transition");
    const markerEdges = graph.edges.filter((e) => e.kind === "startMarker");
    expect(transitionEdges).toHaveLength(1);
    expect(markerEdges).toHaveLength(1);
  });

  test("role is initial-terminal for single-state workflow", () => {
    const graph = project({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "only",
          active: true,
          states: { only: { transitions: [] } },
        },
      ],
    });
    const only = graph.nodes.find((n) => n.kind === "state" && n.stateCode === "only");
    expect(only && only.kind === "state" && only.role).toBe("initial-terminal");
  });

  test("self-transition is loopback", () => {
    const graph = project({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "s",
          active: true,
          states: {
            s: {
              transitions: [{ name: "self", next: "s", manual: false, disabled: false }],
            },
          },
        },
      ],
    });
    const edge = graph.edges.find((e) => e.kind === "transition");
    expect(edge && edge.kind === "transition" && edge.isLoopback).toBe(true);
    expect(edge && edge.kind === "transition" && edge.isSelf).toBe(true);
  });

  test("back-edge is loopback", () => {
    // a → b → a: the second transition is a back-edge.
    const graph = project({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "a",
          active: true,
          states: {
            a: { transitions: [{ name: "ab", next: "b", manual: false, disabled: false }] },
            b: { transitions: [{ name: "ba", next: "a", manual: false, disabled: false }] },
          },
        },
      ],
    });
    const edges = graph.edges.filter((e) => e.kind === "transition");
    const ab = edges.find((e) => e.kind === "transition" && e.label === "ab");
    const ba = edges.find((e) => e.kind === "transition" && e.label === "ba");
    expect(ab && ab.kind === "transition" && ab.isLoopback).toBe(false);
    expect(ba && ba.kind === "transition" && ba.isLoopback).toBe(true);
  });

  test("parallel edges share a group with correct size and index", () => {
    const graph = project({
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
                { name: "p1", next: "b", manual: false, disabled: false },
                { name: "p2", next: "b", manual: false, disabled: false },
                { name: "p3", next: "b", manual: false, disabled: false },
              ],
            },
            b: { transitions: [] },
          },
        },
      ],
    });
    const edges = graph.edges
      .filter((e) => e.kind === "transition")
      .sort((a, b) => (a.kind === "transition" && b.kind === "transition" ? a.parallelIndex - b.parallelIndex : 0));
    expect(edges).toHaveLength(3);
    for (const e of edges) {
      expect(e.kind === "transition" && e.parallelGroupSize).toBe(3);
    }
    const indices = edges.flatMap((e) => (e.kind === "transition" ? [e.parallelIndex] : []));
    expect(indices).toEqual([0, 1, 2]);
  });

  test("start marker edge is non-interactive and targets initialState", () => {
    const graph = project({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "a",
          active: true,
          states: {
            a: { transitions: [{ name: "go", next: "b", manual: false, disabled: false }] },
            b: { transitions: [] },
          },
        },
      ],
    });
    const marker = graph.edges.find((e) => e.kind === "startMarker");
    expect(marker).toBeDefined();
    if (marker && marker.kind === "startMarker") {
      expect(marker.interactive).toBe(false);
      const stateA = graph.nodes.find((n) => n.kind === "state" && n.stateCode === "a");
      expect(stateA).toBeDefined();
      expect(marker.targetId).toBe(stateA && stateA.kind === "state" ? stateA.id : undefined);
    }
  });

  test("summary carries criterion/processor/execution badges", () => {
    const graph = project({
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
                {
                  name: "process",
                  next: "b",
                  manual: false,
                  disabled: false,
                  criterion: {
                    type: "simple",
                    jsonPath: "$.status",
                    operation: "EQUALS",
                    value: "ready",
                  },
                  processors: [
                    {
                      type: "externalized",
                      name: "enrich",
                      executionMode: "SYNC",
                    },
                  ],
                },
              ],
            },
            b: { transitions: [] },
          },
        },
      ],
    });
    const edge = graph.edges.find((e) => e.kind === "transition");
    expect(edge && edge.kind === "transition" && edge.summary.criterion?.kind).toBe("simple");
    expect(edge && edge.kind === "transition" && edge.summary.processor?.kind).toBe("single");
    expect(edge && edge.kind === "transition" && edge.summary.execution?.kind).toBe("sync");
  });

  test("processing-state category for states with processor-bearing outgoing transitions", () => {
    const graph = project({
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
                {
                  name: "t",
                  next: "b",
                  manual: false,
                  disabled: false,
                  processors: [{ type: "externalized", name: "p" }],
                },
              ],
            },
            b: { transitions: [] },
          },
        },
      ],
    });
    const a = graph.nodes.find((n) => n.kind === "state" && n.stateCode === "a");
    expect(a && a.kind === "state" && a.category).toBe("PROCESSING_STATE");
  });
});
