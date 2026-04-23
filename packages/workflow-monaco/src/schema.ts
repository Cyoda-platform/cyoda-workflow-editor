import { ImportPayloadSchema } from "@cyoda/workflow-core";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { JsonSchemaHandle, MonacoLike } from "./types.js";

export const WORKFLOW_SCHEMA_URI = "https://cyoda.dev/schemas/workflow-import.schema.json";

/**
 * JSON Schema generated from the Zod `ImportPayloadSchema` (spec §18.4).
 * [Inference] The spec says "derived from Zod"; this plan uses `zod-to-json-schema`
 * per the implementation plan — change the source here if the tool choice changes.
 */
export function workflowJsonSchema(): object {
  return zodToJsonSchema(ImportPayloadSchema, {
    name: "WorkflowImportPayload",
    $refStrategy: "root",
  });
}

/**
 * Register the workflow JSON schema with Monaco's JSON language service
 * so in-editor autocomplete + schema validation light up on any URI that
 * starts with `cyoda://workflow/`.
 *
 * Returns a handle for unregistering on unmount.
 */
export function registerWorkflowSchema(
  monaco: MonacoLike,
  opts: { fileMatchPrefix?: string; schemaUri?: string } = {},
): JsonSchemaHandle {
  const fileMatchPrefix = opts.fileMatchPrefix ?? "cyoda://workflow/";
  const schemaUri = opts.schemaUri ?? WORKFLOW_SCHEMA_URI;
  const schema = workflowJsonSchema();

  const existing = monaco.languages.json.jsonDefaults.diagnosticsOptions.schemas ?? [];
  const kept = existing.filter((s) => s.uri !== schemaUri);
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    ...monaco.languages.json.jsonDefaults.diagnosticsOptions,
    validate: true,
    allowComments: false,
    schemas: [
      ...kept,
      {
        uri: schemaUri,
        fileMatch: [`${fileMatchPrefix}*`],
        schema,
      },
    ],
  });

  return {
    schemaUri,
    fileMatchPrefix,
    dispose: () => {
      const current = monaco.languages.json.jsonDefaults.diagnosticsOptions.schemas ?? [];
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        ...monaco.languages.json.jsonDefaults.diagnosticsOptions,
        schemas: current.filter((s) => s.uri !== schemaUri),
      });
    },
  };
}
