import { describe, it, expect } from "vitest";
import { parseImportPayload } from "@cyoda/workflow-core";
import { issuesToMarkers, serializeForModel } from "../src/index.js";
import type { MonacoLike, TextModelLike } from "../src/types.js";

function fakeMonaco(): MonacoLike {
  return {
    editor: { setModelMarkers: () => {} },
    languages: {
      json: {
        jsonDefaults: {
          diagnosticsOptions: { schemas: [] },
          setDiagnosticsOptions() {},
        },
      },
    },
    MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
  };
}

function fakeModel(text: string): TextModelLike {
  return {
    uri: { toString: () => "inmemory://test" },
    getValue: () => text,
    setValue: () => {},
    getPositionAt: (offset: number) => {
      const before = text.slice(0, offset);
      const lines = before.split("\n");
      return { lineNumber: lines.length, column: lines[lines.length - 1]!.length + 1 };
    },
    getOffsetAt: () => 0,
    onDidChangeContent: () => ({ dispose: () => {} }),
  };
}

const PAYLOAD = JSON.stringify({
  importMode: "MERGE",
  workflows: [
    {
      version: "1.0",
      name: "wf",
      initialState: "start",
      active: true,
      states: {
        start: {
          transitions: [{ name: "go", next: "end", manual: false, disabled: false }],
        },
        end: { transitions: [] },
      },
    },
  ],
});

describe("issuesToMarkers", () => {
  it("points a state-scoped issue at the state node in the JSON", () => {
    const res = parseImportPayload(PAYLOAD);
    if (!res.document) throw new Error("parse failed");
    const text = serializeForModel(res.document);
    const model = fakeModel(text);

    const stateEntry = Object.entries(res.document.meta.ids.states).find(
      ([, p]) => p.state === "start",
    );
    if (!stateEntry) throw new Error("no state id");
    const [stateId] = stateEntry;

    const markers = issuesToMarkers(
      fakeMonaco(),
      model,
      [
        {
          severity: "error",
          code: "test-rule",
          message: "stub",
          targetId: stateId,
        },
      ],
      res.document.meta,
      { workflows: res.document.session.workflows },
    );
    expect(markers).toHaveLength(1);
    expect(markers[0]!.startLineNumber).toBeGreaterThan(1);
    expect(markers[0]!.code).toBe("test-rule");
  });

  it("falls back to line 1 for issues without a targetId", () => {
    const res = parseImportPayload(PAYLOAD);
    if (!res.document) throw new Error("parse failed");
    const text = serializeForModel(res.document);
    const model = fakeModel(text);

    const markers = issuesToMarkers(
      fakeMonaco(),
      model,
      [{ severity: "warning", code: "global", message: "x" }],
      res.document.meta,
      { workflows: res.document.session.workflows },
    );
    expect(markers[0]!.startLineNumber).toBe(1);
    expect(markers[0]!.startColumn).toBe(1);
  });
});
