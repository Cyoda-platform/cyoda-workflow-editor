import { assignSyntheticIds } from "../identity/assign.js";
import { normalizeWorkflowInput } from "../normalize/input.js";
import { ExportPayloadSchema } from "../schema/payload.js";
import type { EditorMetadata, WorkflowEditorDocument } from "../types/editor.js";
import type { ExportPayload, WorkflowSession } from "../types/session.js";
import { validateSemantics } from "../validate/semantic.js";
import { zodErrorToIssues } from "../validate/schema.js";
import { ParseJsonError } from "./errors.js";
import { normalizeOperatorAlias } from "./operator-alias.js";
import type { ParseResult } from "./parse-import.js";

export function parseExportPayload(
  json: string,
  prior?: EditorMetadata,
): ParseResult<ExportPayload> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new ParseJsonError(`Invalid JSON: ${(e as Error).message}`);
  }

  let aliased: unknown;
  try {
    aliased = normalizeOperatorAlias(parsed);
  } catch (e) {
    return {
      ok: false,
      issues: [
        {
          severity: "error",
          code: "operator-alias-conflict",
          message: (e as Error).message,
        },
      ],
    };
  }

  const schemaResult = ExportPayloadSchema.safeParse(aliased);
  if (!schemaResult.success) {
    return { ok: false, issues: zodErrorToIssues(schemaResult.error) };
  }

  const normalizedWorkflows = schemaResult.data.workflows.map(normalizeWorkflowInput);
  const session: WorkflowSession = {
    entity: {
      entityName: schemaResult.data.entityName,
      modelVersion: schemaResult.data.modelVersion,
    },
    importMode: "MERGE",
    workflows: normalizedWorkflows,
  };

  const meta = assignSyntheticIds(session, prior);
  const document: WorkflowEditorDocument = { session, meta };

  const issues = validateSemantics(session, document);
  const hasError = issues.some((i) => i.severity === "error");

  return {
    ok: !hasError,
    value: {
      entityName: schemaResult.data.entityName,
      modelVersion: schemaResult.data.modelVersion,
      workflows: session.workflows,
    },
    document,
    issues,
  };
}
