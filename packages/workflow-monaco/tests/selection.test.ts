import { describe, it, expect } from "vitest";
import { parseImportPayload } from "@cyoda/workflow-core";
import { idAtOffset, serializeForModel } from "../src/index.js";

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

function parsed() {
  const r = parseImportPayload(PAYLOAD);
  if (!r.document) throw new Error("parse failed");
  return r.document;
}

describe("idAtOffset", () => {
  it("returns the workflow UUID when the cursor is over a workflow name", () => {
    const doc = parsed();
    const text = serializeForModel(doc);
    const offset = text.indexOf('"name": "wf"');
    const id = idAtOffset(text, offset + 5, doc);
    expect(id).toBe(doc.meta.ids.workflows["wf"]);
  });

  it("returns the transition UUID when cursor is inside a transition object", () => {
    const doc = parsed();
    const text = serializeForModel(doc);
    const offset = text.indexOf('"go"');
    const id = idAtOffset(text, offset, doc);
    const tEntry = Object.entries(doc.meta.ids.transitions).find(
      ([, p]) => p.state === "start",
    );
    expect(id).toBe(tEntry?.[0]);
  });

  it("returns null for cursor positions outside any selectable entity", () => {
    const doc = parsed();
    const text = serializeForModel(doc);
    const offset = text.indexOf('"MERGE"');
    const id = idAtOffset(text, offset, doc);
    expect(id).toBeNull();
  });
});
