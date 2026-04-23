import { assignSyntheticIds } from "../identity/assign.js";
import { normalizeWorkflowInput } from "../normalize/input.js";
import { ImportPayloadSchema } from "../schema/payload.js";
import type { EditorMetadata, WorkflowEditorDocument } from "../types/editor.js";
import type { ImportPayload, WorkflowSession } from "../types/session.js";
import type { ValidationIssue } from "../types/validation.js";
import { validateSemantics } from "../validate/semantic.js";
import { zodErrorToIssues } from "../validate/schema.js";
import { ParseJsonError } from "./errors.js";
import { normalizeOperatorAlias } from "./operator-alias.js";

export interface ParseResult<T> {
  ok: boolean;
  value?: T;
  document?: WorkflowEditorDocument;
  issues: ValidationIssue[];
}

function parseJsonSafe(json: string): { ok: true; value: unknown } | { ok: false; err: string } {
  try {
    return { ok: true, value: JSON.parse(json) };
  } catch (e) {
    return { ok: false, err: (e as Error).message };
  }
}

/**
 * Parse a Cyoda import-payload JSON string into a WorkflowEditorDocument.
 * Pipeline: JSON.parse → operator-alias normalisation → Zod → input normalisation
 * → assignSyntheticIds → semantic validation.
 */
export function parseImportPayload(
  json: string,
  prior?: EditorMetadata,
): ParseResult<ImportPayload> {
  const parsed = parseJsonSafe(json);
  if (!parsed.ok) {
    throw new ParseJsonError(`Invalid JSON: ${parsed.err}`);
  }

  let aliased: unknown;
  try {
    aliased = normalizeOperatorAlias(parsed.value);
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

  const schemaResult = ImportPayloadSchema.safeParse(aliased);
  if (!schemaResult.success) {
    return { ok: false, issues: zodErrorToIssues(schemaResult.error) };
  }

  const normalizedWorkflows = schemaResult.data.workflows.map(normalizeWorkflowInput);
  const session: WorkflowSession = {
    entity: null,
    importMode: schemaResult.data.importMode,
    workflows: normalizedWorkflows,
  };

  const meta = assignSyntheticIds(session, prior);
  const document: WorkflowEditorDocument = { session, meta };

  const issues = validateSemantics(session, document);
  const hasError = issues.some((i) => i.severity === "error");

  return {
    ok: !hasError,
    value: { importMode: session.importMode, workflows: session.workflows },
    document,
    issues,
  };
}
