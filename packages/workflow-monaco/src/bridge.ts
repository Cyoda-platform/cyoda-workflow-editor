import {
  parseImportPayload,
  serializeImportPayload,
  type DomainPatch,
  type EditorMetadata,
  type ValidationIssue,
  type WorkflowEditorDocument,
} from "@cyoda/workflow-core";

/**
 * Outcome of attempting to lift raw JSON text back into a domain patch.
 *
 *  - `status: "ok"`   — JSON parsed and schema validated; `patch` is a
 *                       `replaceSession` that the caller should dispatch.
 *  - `status: "invalid-json"` — JSON.parse failed; `message` has the reason.
 *                       Canonical model should be left untouched (§12.5).
 *  - `status: "invalid-schema"` — Zod rejected the payload; surface `issues`
 *                       as a banner/markers. Canonical model untouched.
 *  - `status: "semantic-errors"` — Parsed cleanly but semantic validation
 *                       produced errors. We still return a patch so the
 *                       user can see the errors on the canvas; the caller
 *                       decides whether to dispatch or hold.
 *  - `status: "unchanged"` — Text is byte-identical to the current serialised
 *                       form, no dispatch needed.
 */
export type LiftResult =
  | { status: "ok"; patch: DomainPatch; document: WorkflowEditorDocument; issues: ValidationIssue[] }
  | { status: "invalid-json"; message: string }
  | { status: "invalid-schema"; issues: ValidationIssue[] }
  | {
      status: "semantic-errors";
      patch: DomainPatch;
      document: WorkflowEditorDocument;
      issues: ValidationIssue[];
    }
  | { status: "unchanged" };

/**
 * Lift a JSON string into a `replaceSession` patch, passing the prior
 * `EditorMetadata` so `assignSyntheticIds` can reuse UUIDs for entities
 * whose `(workflow, state, transitionName, ordinal)` tuple is unchanged
 * (spec §6.2, §12.5). This keeps selection UUIDs stable across JSON edits
 * even when users reformat or reorder JSON.
 */
export function liftJsonToPatch(
  json: string,
  prior: EditorMetadata,
  currentSerialized?: string,
): LiftResult {
  if (currentSerialized !== undefined && json === currentSerialized) {
    return { status: "unchanged" };
  }

  let result;
  try {
    result = parseImportPayload(json, prior);
  } catch (e) {
    return { status: "invalid-json", message: (e as Error).message };
  }

  if (!result.document) {
    return { status: "invalid-schema", issues: result.issues ?? [] };
  }

  const hasSemanticError = (result.issues ?? []).some((i) => i.severity === "error");
  const patch: DomainPatch = {
    op: "replaceSession",
    session: result.document.session,
  };

  if (hasSemanticError) {
    return {
      status: "semantic-errors",
      patch,
      document: result.document,
      issues: result.issues ?? [],
    };
  }
  return {
    status: "ok",
    patch,
    document: result.document,
    issues: result.issues ?? [],
  };
}

/**
 * Serialize an editor document into the canonical import-payload JSON that
 * the Monaco model should mirror. Byte-stable per spec §12.4.
 */
export function serializeForModel(doc: WorkflowEditorDocument): string {
  return serializeImportPayload(doc);
}
