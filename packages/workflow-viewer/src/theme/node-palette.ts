import type { StateNode } from "@cyoda/workflow-graph";
import { workflowPalette, type RolePaletteEntry, type TerminalPaletteEntry } from "./tokens.js";

/**
 * Select the palette entry for a state node.
 *
 * Only the spec role matters: initial (green), terminal (red), and every other
 * state (blue). initial-terminal prefers terminal styling (with initial accent
 * applied separately by the renderer — e.g. a secondary border ring).
 */
export function paletteFor(
  node: StateNode,
): RolePaletteEntry | TerminalPaletteEntry {
  const p = workflowPalette.node;
  if (node.role === "terminal" || node.role === "initial-terminal") return p.terminal;
  if (node.role === "initial") return p.initial;
  return p.default;
}
