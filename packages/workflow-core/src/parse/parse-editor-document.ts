import { z } from "zod";
import { ImportPayloadSchema } from "../schema/payload.js";
import type { WorkflowEditorDocument } from "../types/editor.js";
import { assignSyntheticIds } from "../identity/assign.js";
import { normalizeWorkflowInput } from "../normalize/input.js";
import { getDialect, LATEST_CYODA_VERSION } from "../dialect/index.js";
import { validateSemantics } from "../validate/semantic.js";
import { zodErrorToIssues } from "../validate/schema.js";
import { ParseJsonError } from "./errors.js";
import { dialectWarningToIssue, type ParseResult } from "./parse-import.js";

const EditorDocumentSchema = z.object({
  session: z.object({
    entity: z
      .object({
        entityName: z.string(),
        modelVersion: z.number().int().positive(),
      })
      .nullable(),
    importMode: z.enum(["MERGE", "REPLACE", "ACTIVATE"]),
    allowCycles: z.boolean().optional(),
    workflows: z.array(z.unknown()),
  }),
  meta: z
    .object({
      revision: z.number().int().nonnegative(),
      ids: z.unknown(),
      workflowUi: z.record(z.string(), z.unknown()),
      lastValidJsonHash: z.string().optional(),
    })
    .passthrough(),
});

export function parseEditorDocument(
  json: string,
): ParseResult<WorkflowEditorDocument> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new ParseJsonError(`Invalid JSON: ${(e as Error).message}`);
  }

  const outerResult = EditorDocumentSchema.safeParse(parsed);
  if (!outerResult.success) {
    return { ok: false, issues: zodErrorToIssues(outerResult.error) };
  }

  const version = (outerResult.data.meta as { cyodaVersion?: string }).cyodaVersion
    ?? LATEST_CYODA_VERSION;
  let canonical: unknown;
  let warnings: string[];
  try {
    const result = getDialect(version).toCanonical({
      workflows: outerResult.data.session.workflows,
    });
    canonical = result.value;
    warnings = result.warnings;
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

  // Mirror the dialect's dropped-key notes into `issues` — the surface every
  // consumer already renders. `warnings` stays as-is: public API.
  const warningIssues = warnings.map(dialectWarningToIssue);

  const inner = ImportPayloadSchema.omit({ importMode: true }).extend({
    importMode: z.enum(["MERGE", "REPLACE", "ACTIVATE"]),
  });
  const sessionResult = inner.safeParse({
    importMode: outerResult.data.session.importMode,
    allowCycles: outerResult.data.session.allowCycles,
    workflows: (canonical as { workflows: unknown }).workflows,
  });
  if (!sessionResult.success) {
    return {
      ok: false,
      issues: [...zodErrorToIssues(sessionResult.error), ...warningIssues],
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  const normalizedWorkflows = sessionResult.data.workflows.map(normalizeWorkflowInput);
  const session = {
    entity: outerResult.data.session.entity,
    importMode: sessionResult.data.importMode,
    ...(sessionResult.data.allowCycles !== undefined
      ? { allowCycles: sessionResult.data.allowCycles }
      : {}),
    workflows: normalizedWorkflows,
  };

  const meta = assignSyntheticIds(
    session,
    outerResult.data.meta as WorkflowEditorDocument["meta"],
  );
  const document: WorkflowEditorDocument = { session, meta };
  const issues = [...validateSemantics(session, document), ...warningIssues];
  const hasError = issues.some((i) => i.severity === "error");

  return {
    ok: !hasError,
    document,
    value: document,
    issues,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
