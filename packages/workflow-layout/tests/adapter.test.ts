import { describe, expect, test } from "vitest";
import { parseImportPayload } from "@cyoda/workflow-core";
import { projectToGraph } from "@cyoda/workflow-graph";
import { layoutGraph } from "../src/index.js";

function project(json: unknown) {
  const parsed = parseImportPayload(JSON.stringify(json));
  if (!parsed.document) {
    throw new Error("parse failed: " + JSON.stringify(parsed.issues));
  }
  return projectToGraph(parsed.document);
}

const minimal = {
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
        b: {
          transitions: [{ name: "back", next: "a", manual: false, disabled: false }],
        },
      },
    },
  ],
};

const linear = {
  importMode: "MERGE",
  workflows: [
    {
      version: "1.0",
      name: "wf",
      initialState: "draft",
      active: true,
      states: {
        draft: {
          transitions: [
            { name: "submit", next: "review", manual: false, disabled: false },
          ],
        },
        review: {
          transitions: [
            { name: "approve", next: "done", manual: true, disabled: false },
          ],
        },
        done: { transitions: [] },
      },
    },
  ],
};

describe("layoutGraph", () => {
  test("returns positions for every state node", async () => {
    const graph = project(linear);
    const result = await layoutGraph(graph);
    const stateIds = graph.nodes
      .filter((n) => n.kind === "state")
      .map((n) => n.id);
    for (const id of stateIds) {
      const pos = result.positions.get(id);
      expect(pos, `missing position for ${id}`).toBeTruthy();
      expect(pos!.width).toBeGreaterThan(0);
      expect(pos!.height).toBeGreaterThan(0);
    }
  });

  test("places initial above terminal in top-to-bottom flow", async () => {
    const graph = project(linear);
    const result = await layoutGraph(graph, { preset: "websiteCompact" });
    const draft = graph.nodes.find(
      (n) => n.kind === "state" && n.stateCode === "draft",
    )!;
    const done = graph.nodes.find(
      (n) => n.kind === "state" && n.stateCode === "done",
    )!;
    const draftPos = result.positions.get(draft.id)!;
    const donePos = result.positions.get(done.id)!;
    expect(draftPos.y).toBeLessThan(donePos.y);
  });

  test("produces edge routes with a midpoint for chip placement", async () => {
    const graph = project(linear);
    const result = await layoutGraph(graph);
    const transitionIds = graph.edges
      .filter((e) => e.kind === "transition")
      .map((e) => e.id);
    for (const id of transitionIds) {
      const route = result.edges.get(id);
      expect(route, `missing route for ${id}`).toBeTruthy();
      expect(route!.points.length).toBeGreaterThanOrEqual(2);
      expect(Number.isFinite(route!.labelX)).toBe(true);
      expect(Number.isFinite(route!.labelY)).toBe(true);
    }
  });

  test("honours pinned positions", async () => {
    const graph = project(linear);
    const draft = graph.nodes.find(
      (n) => n.kind === "state" && n.stateCode === "draft",
    )!;
    const result = await layoutGraph(graph, {
      pinned: [{ id: draft.id, x: 500, y: 500 }],
    });
    const pos = result.positions.get(draft.id)!;
    expect(pos.x).toBe(500);
    expect(pos.y).toBe(500);
  });

  test("routes loopback edges (back-edge) and self-edges", async () => {
    const mutualJson = structuredClone(minimal);
    const graph = project(mutualJson);
    const result = await layoutGraph(graph);
    const transitionEdges = graph.edges.filter((e) => e.kind === "transition");
    for (const e of transitionEdges) {
      expect(result.edges.has(e.id)).toBe(true);
    }
  });

  test("handles graphs with no state nodes", async () => {
    const empty = {
      nodes: [],
      edges: [],
      annotations: [],
    } as const;
    const result = await layoutGraph(empty);
    expect(result.positions.size).toBe(0);
    expect(result.edges.size).toBe(0);
  });

  test("respects all three presets without crashing", async () => {
    const graph = project(linear);
    const presets = ["websiteCompact", "configuratorReadable", "opsAudit"] as const;
    for (const preset of presets) {
      const result = await layoutGraph(graph, { preset });
      expect(result.preset).toBe(preset);
      expect(result.positions.size).toBeGreaterThan(0);
    }
  });
});
