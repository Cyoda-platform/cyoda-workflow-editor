import { parseTree, findNodeAtLocation, type Node } from "jsonc-parser";
import type { EditorMetadata, ValidationIssue } from "@cyoda/workflow-core";
import { orderingFromSession, pathForId, type JsonPath } from "./pointer.js";
import type { MarkerData, MonacoLike, TextModelLike } from "./types.js";

/**
 * Convert domain `ValidationIssue`s into Monaco `MarkerData`, using the
 * JSON AST of the current model text to resolve synthetic UUIDs into
 * character ranges (spec §18.4).
 *
 * Issues with no `targetId` are attached to the root (line 1, col 1).
 * Issues whose target cannot be resolved (stale UUID, missing node) are
 * likewise attached to the root so the user still sees the diagnostic.
 */
export function issuesToMarkers(
  monaco: MonacoLike,
  model: TextModelLike,
  issues: ValidationIssue[],
  meta: EditorMetadata,
  session: {
    workflows: Array<{
      name: string;
      states: Record<string, { transitions: Array<unknown> }>;
    }>;
  },
): MarkerData[] {
  const text = model.getValue();
  const tree: Node | undefined = parseTree(text);
  const ordering = orderingFromSession(session);

  return issues.map((issue) => toMarker(monaco, model, tree, issue, meta, ordering));
}

function toMarker(
  monaco: MonacoLike,
  model: TextModelLike,
  tree: Node | undefined,
  issue: ValidationIssue,
  meta: EditorMetadata,
  ordering: ReturnType<typeof orderingFromSession>,
): MarkerData {
  const severity = toSeverity(monaco, issue.severity);
  const base: MarkerData = {
    severity,
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: 1,
    endColumn: 2,
    message: issue.message,
    code: issue.code,
    source: "cyoda",
  };

  if (!issue.targetId || !tree) return base;
  const path = pathForId(issue.targetId, meta, ordering);
  if (!path) return base;
  const range = rangeForPath(model, tree, path);
  return range ? { ...base, ...range } : base;
}

function toSeverity(monaco: MonacoLike, s: ValidationIssue["severity"]): number {
  switch (s) {
    case "error":
      return monaco.MarkerSeverity.Error;
    case "warning":
      return monaco.MarkerSeverity.Warning;
    case "info":
      return monaco.MarkerSeverity.Info;
  }
}

/**
 * jsonc-parser's `findNodeAtLocation` expects a path of strings for object
 * keys and numbers for array indexes — exactly what our `JsonPath` carries.
 */
export function rangeForPath(
  model: TextModelLike,
  tree: Node,
  path: JsonPath,
): Pick<MarkerData, "startLineNumber" | "startColumn" | "endLineNumber" | "endColumn"> | null {
  const node = findNodeAtLocation(tree, path);
  if (!node) return null;
  const start = model.getPositionAt(node.offset);
  const end = model.getPositionAt(node.offset + node.length);
  return {
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  };
}

/** Write markers onto a Monaco model, overwriting any previous markers
 *  under the given owner. Default owner is `"cyoda-workflow"`. */
export function applyMarkers(
  monaco: MonacoLike,
  model: TextModelLike,
  markers: MarkerData[],
  owner = "cyoda-workflow",
): void {
  monaco.editor.setModelMarkers(model, owner, markers);
}
