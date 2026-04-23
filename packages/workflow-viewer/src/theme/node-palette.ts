import type { StateNode } from "@cyoda/workflow-graph";
import { workflowPalette, type RolePaletteEntry, type TerminalPaletteEntry } from "./tokens.js";

/**
 * Select the palette entry for a state node.
 * initial-terminal prefers terminal styling (with initial accent applied
 * separately by the renderer — e.g. a secondary border ring).
 */
export function paletteFor(
  node: StateNode,
): RolePaletteEntry | TerminalPaletteEntry {
  const p = workflowPalette.node;
  if (node.role === "terminal" || node.role === "initial-terminal") return p.terminal;
  if (node.role === "initial") return p.initial;
  if (node.category === "MANUAL_REVIEW") return p.manualReview;
  if (node.category === "PROCESSING_STATE") return p.processing;
  return p.default;
}
