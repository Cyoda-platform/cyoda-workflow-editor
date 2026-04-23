import { describe, it, expect } from "vitest";
import { workflowJsonSchema, registerWorkflowSchema, WORKFLOW_SCHEMA_URI } from "../src/index.js";
import type { MonacoLike, JsonDiagnosticsOptions } from "../src/types.js";

function fakeMonaco(): MonacoLike {
  const state: { opts: JsonDiagnosticsOptions } = { opts: { schemas: [] } };
  return {
    editor: { setModelMarkers: () => {} },
    languages: {
      json: {
        jsonDefaults: {
          get diagnosticsOptions() {
            return state.opts;
          },
          setDiagnosticsOptions(next) {
            state.opts = next;
          },
        },
      },
    },
    MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
  };
}

describe("workflowJsonSchema", () => {
  it("emits a JSON schema derived from ImportPayloadSchema", () => {
    const schema = workflowJsonSchema() as Record<string, unknown>;
    expect(schema).toBeTypeOf("object");
    expect(typeof schema.$schema === "string" || schema.type === "object").toBe(true);
  });
});

describe("registerWorkflowSchema", () => {
  it("installs the schema under the default fileMatch prefix", () => {
    const monaco = fakeMonaco();
    const handle = registerWorkflowSchema(monaco);
    expect(handle.schemaUri).toBe(WORKFLOW_SCHEMA_URI);
    const schemas = monaco.languages.json.jsonDefaults.diagnosticsOptions.schemas!;
    expect(schemas.length).toBe(1);
    expect(schemas[0]!.fileMatch).toEqual(["cyoda://workflow/*"]);
    handle.dispose();
    expect(monaco.languages.json.jsonDefaults.diagnosticsOptions.schemas!.length).toBe(0);
  });

  it("is idempotent across repeated register calls", () => {
    const monaco = fakeMonaco();
    registerWorkflowSchema(monaco);
    registerWorkflowSchema(monaco);
    const schemas = monaco.languages.json.jsonDefaults.diagnosticsOptions.schemas!;
    expect(schemas.length).toBe(1);
  });
});
