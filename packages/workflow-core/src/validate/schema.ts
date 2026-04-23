import type { ZodError } from "zod";
import type { ValidationIssue } from "../types/validation.js";

/**
 * Convert a ZodError into ValidationIssue[] with `severity: "error"`.
 * The `code` is "schema-" + Zod's own error code; path is embedded in detail.
 */
export function zodErrorToIssues(err: ZodError): ValidationIssue[] {
  return err.issues.map((issue) => ({
    severity: "error",
    code: `schema-${issue.code}`,
    message: issue.message,
    detail: {
      path: issue.path,
    },
  }));
}
