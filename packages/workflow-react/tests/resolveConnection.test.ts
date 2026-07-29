import { describe, it, expect } from "vitest";
import { parseImportPayload } from "@cyoda/workflow-core";
import { resolveConnection } from "../src/components/resolveConnection.js";

function makeDoc(json: string) {
  const result = parseImportPayload(json);
  if (!result.document) throw new Error("fixture parse failed");
  return result.document;
}

const TWO_STATE = JSON.stringify({
  importMode: "MERGE",
  workflows: [
    {
      version: "1.3",
      name: "wf",
      initialState: "A",
      active: true,
      states: {
        A: { transitions: [] },
        B: { transitions: [] },
      },
    },
  ],
});

const TWO_WF = JSON.stringify({
  importMode: "MERGE",
  workflows: [
    {
      version: "1.3",
      name: "wf1",
      initialState: "A",
      active: true,
      states: { A: { transitions: [] } },
    },
    {
      version: "1.3",
      name: "wf2",
      initialState: "B",
      active: true,
      states: { B: { transitions: [] } },
    },
  ],
});

function stateId(doc: ReturnType<typeof makeDoc>, workflow: string, state: string): string {
  const entry = Object.entries(doc.meta.ids.states).find(
    ([, ptr]) => ptr.workflow === workflow && ptr.state === state,
  );
  if (!entry) throw new Error(`No state id for ${workflow}:${state}`);
  return entry[0];
}

describe("resolveConnection", () => {
  it("resolves valid same-workflow source/target to pending connect data", () => {
    const doc = makeDoc(TWO_STATE);
    const idA = stateId(doc, "wf", "A");
    const idB = stateId(doc, "wf", "B");

    const result = resolveConnection(doc, {
      source: idA,
      target: idB,
      sourceHandle: null,
      targetHandle: null,
    });

    expect(result).toEqual({ workflow: "wf", fromState: "A", toState: "B" });
  });

  it("resolves even when handle ids are provided (simplified side-only ids)", () => {
    const doc = makeDoc(TWO_STATE);
    const idA = stateId(doc, "wf", "A");
    const idB = stateId(doc, "wf", "B");

    const result = resolveConnection(doc, {
      source: idA,
      target: idB,
      sourceHandle: "bottom",
      targetHandle: "top",
    });

    expect(result).toEqual({ workflow: "wf", fromState: "A", toState: "B" });
  });

  it("returns null for cross-workflow source/target", () => {
    const doc = makeDoc(TWO_WF);
    const idA = stateId(doc, "wf1", "A");
    const idB = stateId(doc, "wf2", "B");

    const result = resolveConnection(doc, {
      source: idA,
      target: idB,
      sourceHandle: null,
      targetHandle: null,
    });

    expect(result).toBeNull();
  });

  it("returns null when source is null", () => {
    const doc = makeDoc(TWO_STATE);
    const idB = stateId(doc, "wf", "B");

    const result = resolveConnection(doc, {
      source: null,
      target: idB,
      sourceHandle: null,
      targetHandle: null,
    });

    expect(result).toBeNull();
  });

  it("returns null when target is null", () => {
    const doc = makeDoc(TWO_STATE);
    const idA = stateId(doc, "wf", "A");

    const result = resolveConnection(doc, {
      source: idA,
      target: null,
      sourceHandle: null,
      targetHandle: null,
    });

    expect(result).toBeNull();
  });

  it("returns null when source id is unknown", () => {
    const doc = makeDoc(TWO_STATE);
    const idB = stateId(doc, "wf", "B");

    const result = resolveConnection(doc, {
      source: "unknown-uuid",
      target: idB,
      sourceHandle: null,
      targetHandle: null,
    });

    expect(result).toBeNull();
  });

  it("returns null when both ids are unknown", () => {
    const doc = makeDoc(TWO_STATE);

    const result = resolveConnection(doc, {
      source: "unknown-a",
      target: "unknown-b",
      sourceHandle: null,
      targetHandle: null,
    });

    expect(result).toBeNull();
  });
});
