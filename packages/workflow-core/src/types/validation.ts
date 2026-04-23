export type Severity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
  targetId?: string;
  detail?: Record<string, unknown>;
}
