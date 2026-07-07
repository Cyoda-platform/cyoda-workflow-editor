import type { StateNode } from "@cyoda/workflow-graph";

/**
 * Uppercase header line shown above the state title. Only the boundary roles
 * are labelled — INITIAL and TERMINAL. Ordinary intermediate states carry no
 * label (an empty string), since "STATE" adds nothing the shape doesn't already
 * convey; the renderer omits the header row entirely in that case.
 *
 * Reused by the editor shell so the website viewer and editor canvas display
 * identical headers.
 */
export function roleCategoryLabel(node: StateNode): string {
  if (node.role === "initial" || node.role === "initial-terminal") return "INITIAL";
  if (node.role === "terminal") return "TERMINAL";
  return "";
}
