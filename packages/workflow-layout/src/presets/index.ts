import type { LayoutPreset } from "../types.js";

/**
 * ELK option bundles per spec §13.2.
 *
 * - `websiteCompact` — dense top-to-bottom flow used by the read-only website
 *   viewer. Tight spacing, straight/orthogonal routing, priority weights
 *   nudge initial states to the top and terminals to the bottom.
 * - `configuratorReadable` — the editor's default. Larger spacing, more
 *   relaxed layering so the inspector + canvas interplay stays readable.
 * - `opsAudit` — forensic view: maximum spacing, aggressive priority weights
 *   pulling terminals down, orthogonal routing so back-edges are
 *   visually distinct.
 *
 * All three use ELK's `layered` algorithm with top-to-bottom direction.
 * Individual call-sites can override specific keys via `LayoutOptions.elk`.
 */
export function optionsFor(preset: LayoutPreset): Record<string, string> {
  switch (preset) {
    case "websiteCompact":
      return {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.spacing.nodeNode": "32",
        "elk.layered.spacing.nodeNodeBetweenLayers": "48",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
        "elk.layered.thoroughness": "7",
      };
    case "configuratorReadable":
      return {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.spacing.nodeNode": "56",
        "elk.layered.spacing.nodeNodeBetweenLayers": "80",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
        "elk.layered.thoroughness": "10",
      };
    case "opsAudit":
      return {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.spacing.nodeNode": "72",
        "elk.layered.spacing.nodeNodeBetweenLayers": "112",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
        "elk.layered.thoroughness": "14",
      };
  }
}

/**
 * Per-node priority hint: initial states pinned to layer 0, terminals
 * pushed down via a large layerConstraint-like weight. ELK Layered honours
 * `elk.layered.priority.*` keys per-node.
 */
export function nodePriority(role: string): number {
  if (role === "initial" || role === "initial-terminal") return 10;
  if (role === "terminal") return -10;
  return 0;
}
