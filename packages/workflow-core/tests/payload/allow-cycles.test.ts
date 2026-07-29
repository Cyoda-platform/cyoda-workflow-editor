import { describe, expect, test } from "vitest";
import {
  parseEditorDocument,
  parseImportPayload,
  serializeEditorDocument,
  serializeImportPayload,
} from "../../src/index.js";

const WF = {
  version: "1.3", name: "w", initialState: "A", active: true,
  states: { A: { transitions: [] } },
};

describe("allowCycles (spec §1, §3)", () => {
  test("parses off the import payload", () => {
    const parsed = parseImportPayload(
      JSON.stringify({ importMode: "REPLACE", allowCycles: true, workflows: [WF] }),
    );
    expect(parsed.document!.session.allowCycles).toBe(true);
  });

  test("stays unset (not defaulted to false) when absent from input", () => {
    const parsed = parseImportPayload(
      JSON.stringify({ importMode: "REPLACE", workflows: [WF] }),
    );
    expect(parsed.document!.session.allowCycles).toBeUndefined();
  });

  test("emits only when true, in importMode/allowCycles/workflows order", () => {
    const parsed = parseImportPayload(
      JSON.stringify({ importMode: "REPLACE", allowCycles: true, workflows: [WF] }),
    );
    const out = serializeImportPayload(parsed.document!);
    expect(Object.keys(JSON.parse(out))).toEqual(["importMode", "allowCycles", "workflows"]);
  });

  test("is omitted entirely when absent from input, keeping output byte-identical", () => {
    const parsed = parseImportPayload(
      JSON.stringify({ importMode: "REPLACE", workflows: [WF] }),
    );
    expect(JSON.parse(serializeImportPayload(parsed.document!))).not.toHaveProperty("allowCycles");
  });

  test("is omitted entirely when explicitly false, not just when absent", () => {
    const parsed = parseImportPayload(
      JSON.stringify({ importMode: "REPLACE", allowCycles: false, workflows: [WF] }),
    );
    expect(JSON.parse(serializeImportPayload(parsed.document!))).not.toHaveProperty("allowCycles");
  });

  test("survives an editor-document save and reload", () => {
    const parsed = parseImportPayload(
      JSON.stringify({ importMode: "REPLACE", allowCycles: true, workflows: [WF] }),
    );
    const saved = serializeEditorDocument(parsed.document!);
    const reloaded = parseEditorDocument(saved);
    expect(reloaded.document!.session.allowCycles).toBe(true);
  });
});
