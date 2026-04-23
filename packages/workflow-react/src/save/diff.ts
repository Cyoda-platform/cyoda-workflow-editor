import type { WorkflowEditorDocument } from "@cyoda/workflow-core";

/**
 * Produce a short human-readable diff summary between the last-known server
 * document and the current editor document (spec §17.3). Counts workflows /
 * states / transitions added, removed, or changed; returns null when no
 * server document is available (first-save scenario).
 *
 * The summary is intentionally coarse — detailed diffs belong in a dedicated
 * compare view, not a modal.
 */
export function diffSummary(
  server: WorkflowEditorDocument | null,
  local: WorkflowEditorDocument,
): string | null {
  if (!server) return null;
  const sw = new Map(server.session.workflows.map((w) => [w.name, w]));
  const lw = new Map(local.session.workflows.map((w) => [w.name, w]));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const [name, localWf] of lw) {
    const serverWf = sw.get(name);
    if (!serverWf) {
      added.push(name);
      continue;
    }
    if (JSON.stringify(serverWf) !== JSON.stringify(localWf)) {
      changed.push(name);
    }
  }
  for (const [name] of sw) {
    if (!lw.has(name)) removed.push(name);
  }

  const lines: string[] = [];
  if (added.length) lines.push(`+ added: ${added.join(", ")}`);
  if (removed.length) lines.push(`- removed: ${removed.join(", ")}`);
  if (changed.length) lines.push(`~ changed: ${changed.join(", ")}`);
  if (lines.length === 0) lines.push("(no workflow-level differences)");
  return lines.join("\n");
}
