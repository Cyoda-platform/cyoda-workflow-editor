import type { WorkflowEditorDocument } from "./editor.js";

export type Severity = "error" | "warning" | "info";

/**
 * An optional remediation a host can offer for an issue. Deliberately generic —
 * `name-too-long`, `annotations-too-large` and `null-criterion-not-last` are all
 * candidates to carry one later.
 *
 * `apply` must bump `meta.revision` (`{ ...doc.meta, revision: doc.meta.revision + 1 }`),
 * matching the convention every branch of `patch/apply.ts` follows. A host
 * typically memoises on `document.meta.revision` (see
 * `workflow-react/src/state/derive.ts`); an `apply` that leaves `revision`
 * unchanged makes the fix look like it silently did nothing even though the
 * session content changed underneath.
 */
export interface ValidationFix {
  label: string;
  apply: (doc: WorkflowEditorDocument) => WorkflowEditorDocument;
}

export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
  targetId?: string;
  detail?: Record<string, unknown>;
  fix?: ValidationFix;
}
