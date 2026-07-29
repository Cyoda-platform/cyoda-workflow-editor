import type { WorkflowEditorDocument } from "./editor.js";

export type Severity = "error" | "warning" | "info";

/**
 * An optional remediation a host can offer for an issue. Deliberately generic —
 * `name-too-long`, `annotations-too-large` and `null-criterion-not-last` are all
 * candidates to carry one later.
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
