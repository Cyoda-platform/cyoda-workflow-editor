import { outputWorkflow } from "../normalize/output.js";
import type { WorkflowEditorDocument } from "../types/editor.js";
import type { EntityIdentity } from "../types/session.js";
import { prettyStringify } from "./stringify.js";

/**
 * Serialize an editor document as an ImportPayload JSON string.
 * Import payloads have keys ordered: importMode, workflows.
 */
export function serializeImportPayload(doc: WorkflowEditorDocument): string {
  const payload = {
    importMode: doc.session.importMode,
    workflows: doc.session.workflows.map(outputWorkflow),
  };
  return prettyStringify(payload);
}

/**
 * Serialize an editor document as an ExportPayload JSON string.
 * Export payloads have keys ordered: entityName, modelVersion, workflows.
 *
 * If the caller provides an `entity` override, it is used; otherwise the
 * session's entity is required (else throws).
 */
export function serializeExportPayload(
  doc: WorkflowEditorDocument,
  entity?: EntityIdentity,
): string {
  const e = entity ?? doc.session.entity;
  if (e == null) {
    throw new Error("serializeExportPayload requires an entity identity");
  }
  const payload = {
    entityName: e.entityName,
    modelVersion: e.modelVersion,
    workflows: doc.session.workflows.map(outputWorkflow),
  };
  return prettyStringify(payload);
}

/**
 * Serialize the full editor document (session + metadata) for in-app persistence.
 * Not for export to Cyoda.
 */
export function serializeEditorDocument(doc: WorkflowEditorDocument): string {
  return prettyStringify({
    session: {
      entity: doc.session.entity,
      importMode: doc.session.importMode,
      workflows: doc.session.workflows.map(outputWorkflow),
    },
    meta: doc.meta,
  });
}
