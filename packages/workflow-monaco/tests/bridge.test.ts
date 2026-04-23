import { describe, it, expect } from "vitest";
import { parseImportPayload } from "@cyoda/workflow-core";
import { liftJsonToPatch, serializeForModel } from "../src/index.js";

const BASE = JSON.stringify({
  importMode: "MERGE",
  workflows: [
    {
      version: "1.0",
      name: "minimal",
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
  const r = parseImportPayload(BASE);
  if (!r.document) throw new Error("parse failed");
  return r.document;
}

describe("liftJsonToPatch", () => {
  it("returns unchanged when text matches current serialization", () => {
    const doc = parsed();
    const serialized = serializeForModel(doc);
    const r = liftJsonToPatch(serialized, doc.meta, serialized);
    expect(r.status).toBe("unchanged");
  });

  it("reports invalid-json for unparseable text", () => {
    const doc = parsed();
    const r = liftJsonToPatch("{ not: json", doc.meta);
    expect(r.status).toBe("invalid-json");
  });

  it("produces a replaceSession patch for well-formed edits", () => {
    const doc = parsed();
    const edited = serializeForModel(doc).replace("minimal", "renamed");
    const r = liftJsonToPatch(edited, doc.meta);
    if (r.status !== "ok" && r.status !== "semantic-errors") {
      throw new Error(`unexpected status ${r.status}`);
    }
    expect(r.patch.op).toBe("replaceSession");
  });

  it("reports invalid-schema for payloads that violate Zod", () => {
    const doc = parsed();
    const bad = JSON.stringify({ importMode: "BOGUS", workflows: [] });
    const r = liftJsonToPatch(bad, doc.meta);
    expect(r.status).toBe("invalid-schema");
  });
});
