import type { ValidationIssue, WorkflowEditorDocument } from "@cyoda/workflow-core";
import { ParseJsonError, parseImportPayload, prettyStringify, serializeImportPayload } from "@cyoda/workflow-core";
import type { DemoFixture } from "../examples/fixtureCatalog.js";

export interface ParsedWorkflowState {
  document: WorkflowEditorDocument | null;
  issues: ValidationIssue[];
  /** See `extractLoadNotices` — the subset of `issues` worth showing in
   * `WorkflowEditor`'s `loadNotices` load banner. */
  notices: string[];
}

export interface LoadedFixture extends ParsedWorkflowState {
  fixture: DemoFixture;
  text: string;
}

// Codes `dialectWarningToIssue` (in @cyoda/workflow-core) assigns when it
// mirrors a dialect `toCanonical` warning (e.g. an unrecognised processor
// config key dropped on import) into `ParseResult.issues`. These are the
// only issues that describe something that happened *while loading* rather
// than something currently wrong with the document, so they are the only
// ones worth resurfacing in the load banner — everything else already has a
// home in the issues drawer, recomputed live from the document on every
// edit.
const LOAD_NOTICE_CODES = new Set([
  "processor-config-keys-dropped",
  "processor-keys-dropped",
  "dialect-warning",
]);

/**
 * Picks the load-time notices out of a parse's `issues` and returns their
 * already-formatted `.message` strings, ready for `WorkflowEditor`'s
 * `loadNotices` prop. Deliberately reuses `@cyoda/workflow-core`'s own
 * formatting (via the mirrored issues) instead of re-parsing the raw
 * `ParseResult.warnings` strings here, so the wording stays in one place.
 */
export function extractLoadNotices(issues: ValidationIssue[]): string[] {
  return issues.filter((issue) => LOAD_NOTICE_CODES.has(issue.code)).map((issue) => issue.message);
}

export function buildWorkflowPayload(rawJson: string): string {
  try {
    const parsed = JSON.parse(rawJson);
    if (parsed && typeof parsed === "object" && "workflows" in parsed) {
      return prettyStringify(parsed);
    }
    return prettyStringify({
      importMode: "MERGE",
      workflows: [parsed],
    });
  } catch {
    return rawJson;
  }
}

export function parseWorkflowText(text: string, prior?: WorkflowEditorDocument["meta"]): ParsedWorkflowState {
  try {
    const parsed = parseImportPayload(text, prior);
    const issues = parsed.issues ?? [];
    return {
      document: parsed.document ?? null,
      issues,
      notices: extractLoadNotices(issues),
    };
  } catch (error) {
    if (error instanceof ParseJsonError) {
      return {
        document: null,
        issues: [
          {
            severity: "error",
            code: "invalid-json",
            message: error.message,
          },
        ],
        notices: [],
      };
    }
    throw error;
  }
}

export function loadFixture(fixture: DemoFixture, prior?: WorkflowEditorDocument["meta"]): LoadedFixture {
  const text = buildWorkflowPayload(fixture.rawJson);
  return {
    fixture,
    text,
    ...parseWorkflowText(text, prior),
  };
}

export function requireDocument(load: LoadedFixture): WorkflowEditorDocument {
  if (!load.document) {
    throw new Error(`Fixture "${load.fixture.slug}" does not parse into a document.`);
  }
  return load.document;
}

export function documentSummary(document: WorkflowEditorDocument) {
  return {
    workflows: document.session.workflows.length,
    states: document.session.workflows.reduce(
      (total, workflow) => total + Object.keys(workflow.states).length,
      0,
    ),
    transitions: document.session.workflows.reduce(
      (total, workflow) =>
        total +
        Object.values(workflow.states).reduce(
          (stateTotal, state) => stateTotal + state.transitions.length,
          0,
        ),
      0,
    ),
  };
}

export function serializeDocument(document: WorkflowEditorDocument): string {
  return serializeImportPayload(document);
}
