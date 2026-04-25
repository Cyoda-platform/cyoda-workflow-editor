import type {
  GraphDocument,
  StateNode,
  TransitionEdge,
} from "@cyoda/workflow-graph";
import ElkConstructor from "elkjs/lib/elk.bundled.js";
import type {
  EdgeRoute,
  LayoutOptions,
  LayoutPreset,
  LayoutResult,
  NodePosition,
  PinnedNode,
} from "./types.js";
import { nodePriority, optionsFor } from "./presets/index.js";
import { estimateNodeSize } from "./nodeSize.js";

const DEFAULT_PRESET: LayoutPreset = "configuratorReadable";

// ─── ELK input/output shapes ────────────────────────────────────────────────

interface ElkLabelInput {
  id: string;
  width: number;
  height: number;
  layoutOptions?: Record<string, string>;
}

interface ElkLabelOutput extends ElkLabelInput {
  x: number;
  y: number;
}

interface ElkNodeInput {
  id: string;
  width: number;
  height: number;
  layoutOptions?: Record<string, string>;
  x?: number;
  y?: number;
}

interface ElkEdgeInput {
  id: string;
  sources: string[];
  targets: string[];
  labels?: ElkLabelInput[];
}

interface ElkRootInput {
  id: string;
  layoutOptions: Record<string, string>;
  children: ElkNodeInput[];
  edges: ElkEdgeInput[];
}

interface ElkPoint {
  x: number;
  y: number;
}

interface ElkSection {
  startPoint: ElkPoint;
  endPoint: ElkPoint;
  bendPoints?: ElkPoint[];
}

interface ElkNodeOutput extends ElkNodeInput {
  x: number;
  y: number;
}

interface ElkEdgeOutput {
  id: string;
  sections?: ElkSection[];
  labels?: ElkLabelOutput[];
}

interface ElkRootOutput {
  width?: number;
  height?: number;
  children: ElkNodeOutput[];
  edges: ElkEdgeOutput[];
}

interface ElkLike {
  layout(graph: ElkRootInput): Promise<ElkRootOutput>;
}

function buildElk(): ElkLike {
  const Ctor = ElkConstructor as unknown as new () => ElkLike;
  return new Ctor();
}

// ─── Label size estimation ───────────────────────────────────────────────────

/**
 * Estimate the rendered pixel dimensions of the edge label pill for a
 * transition edge.
 *
 * Calibrated to the token values in tokens.ts after Phase 1 shrinking:
 *   paddingX = 6, paddingY = 3
 *   edgeLabel.size = 9px  → line height ≈ 11px
 *   badge.size     = 8px  → line height ≈ 10px
 *   gap between name and badge rows = 3px
 *
 * ELK uses these dimensions to reserve space in the inter-layer channel so
 * label pills do not overlap node chrome.
 */
function estimateLabelSize(edge: TransitionEdge): { width: number; height: number } {
  const PADDING_X = 6;
  const PADDING_Y = 3;
  const NAME_LINE_H = 11;   // 9px font × 1.2 leading
  const BADGE_LINE_H = 10;  // 8px font × 1.2 leading
  const BADGE_PADDING_H = 2; // 1px top + 1px bottom border
  const BADGE_H = BADGE_LINE_H + BADGE_PADDING_H;
  const ROW_GAP = 3;
  const BADGE_SIDE_PAD = 8;  // 4px × 2 sides
  const CHAR_NAME = 6.5;     // 9px sans, average glyph width
  const CHAR_BADGE = 5.5;    // 8px sans, average glyph width

  const { summary, manual, disabled } = edge;

  // Name row width
  const nameW = summary.display.length * CHAR_NAME + 2 * PADDING_X;

  // Enumerate badge labels (mirrors badgesFor logic without importing it)
  const badgeLabels: string[] = [];
  if (manual) badgeLabels.push("Manual");
  if (summary.processor?.kind === "single") badgeLabels.push(summary.processor.name);
  else if (summary.processor?.kind === "multiple") badgeLabels.push(`${summary.processor.count} proc`);
  if (summary.criterion) badgeLabels.push("Criterion");
  if (summary.execution?.kind === "sync") badgeLabels.push("SYNC");
  else if (summary.execution?.kind === "asyncSameTx") badgeLabels.push("ASYNC_SAME");
  if (disabled) badgeLabels.push("Disabled");

  const hasBadges = badgeLabels.length > 0;

  // Badge row: badges flow horizontally with a 3px gap between them
  let badgeRowW = 0;
  if (hasBadges) {
    badgeRowW = badgeLabels.reduce(
      (sum, lbl) => sum + lbl.length * CHAR_BADGE + BADGE_SIDE_PAD,
      0,
    ) + (badgeLabels.length - 1) * 3;
  }

  const width = Math.max(40, Math.max(nameW, badgeRowW));
  const height =
    2 * PADDING_Y +
    NAME_LINE_H +
    (hasBadges ? ROW_GAP + BADGE_H : 0);

  return { width, height };
}

// ─── Graph → ELK conversion ──────────────────────────────────────────────────

/**
 * Translate a `GraphDocument` into an ELK input graph.
 *
 * Self-edges are excluded — ELK handles them awkwardly. They are synthesised
 * as orientation-aware arcs in `toLayoutResult`.
 *
 * Each non-self transition edge carries an ELK `labels` entry with estimated
 * pixel dimensions so ELK can reserve inter-layer space for the pill.
 *
 * Node sizes are computed per-node via `estimateNodeSize` so that long state
 * codes get a wider bounding box in both layout and render.
 */
function toElkGraph(
  graph: GraphDocument,
  preset: LayoutPreset,
  pinned: Map<string, PinnedNode>,
  options: LayoutOptions = {},
): ElkRootInput {
  const children: ElkNodeInput[] = [];

  for (const node of graph.nodes) {
    if (node.kind !== "state") continue;
    const stateNode = node as StateNode;
    const pin = pinned.get(stateNode.id);
    const size = options.nodeSize ?? estimateNodeSize(stateNode.stateCode);
    const child: ElkNodeInput = {
      id: stateNode.id,
      width: size.width,
      height: size.height,
      layoutOptions: {
        "elk.priority": String(nodePriority(stateNode.role)),
      },
    };
    if (pin) {
      child.x = pin.x;
      child.y = pin.y;
      child.layoutOptions = {
        ...child.layoutOptions,
        "elk.position": `(${pin.x},${pin.y})`,
      };
    }
    children.push(child);
  }

  const edges: ElkEdgeInput[] = [];
  for (const edge of graph.edges) {
    if (edge.kind !== "transition") continue;
    const t = edge as TransitionEdge;
    if (t.isSelf) continue;
    const labelSize = estimateLabelSize(t);
    edges.push({
      id: t.id,
      sources: [t.sourceId],
      targets: [t.targetId],
      labels: [
        {
          id: `${t.id}_lbl`,
          width: labelSize.width,
          height: labelSize.height,
          layoutOptions: { "elk.edgeLabelPlacement": "CENTER" },
        },
      ],
    });
  }

  const orientation = options.orientation ?? "vertical";
  const baseOptions = optionsFor(preset, orientation);
  const layoutOptions = options.elk
    ? { ...baseOptions, ...options.elk }
    : baseOptions;

  return {
    id: "root",
    layoutOptions,
    children,
    edges,
  };
}

// ─── ELK output → LayoutResult ───────────────────────────────────────────────

function toLayoutResult(
  out: ElkRootOutput,
  graph: GraphDocument,
  preset: LayoutPreset,
  pinned: Map<string, PinnedNode>,
  orientation: "vertical" | "horizontal",
): LayoutResult {
  const positions = new Map<string, NodePosition>();
  for (const child of out.children) {
    positions.set(child.id, {
      id: child.id,
      x: child.x,
      y: child.y,
      width: child.width,
      height: child.height,
    });
  }

  // Pinned nodes: overwrite ELK's placement so the final coordinates match
  // the user's pin exactly. ELK may not honour `elk.position` across every
  // preset; the post-override is authoritative.
  for (const pin of pinned.values()) {
    const prev = positions.get(pin.id);
    if (!prev) continue;
    positions.set(pin.id, { ...prev, x: pin.x, y: pin.y });
  }

  // Position startMarker nodes relative to their workflow's initial state.
  for (const node of graph.nodes) {
    if (node.kind !== "startMarker") continue;
    const initial = graph.nodes.find(
      (n): n is StateNode =>
        n.kind === "state" &&
        n.workflow === node.workflow &&
        (n.role === "initial" || n.role === "initial-terminal"),
    );
    if (!initial) continue;
    const pos = positions.get(initial.id);
    if (!pos) continue;
    if (orientation === "horizontal") {
      positions.set(node.id, {
        id: node.id,
        x: Math.max(0, pos.x - 32),
        y: pos.y + pos.height / 2 - 8,
        width: 16,
        height: 16,
      });
    } else {
      positions.set(node.id, {
        id: node.id,
        x: pos.x + pos.width / 2 - 8,
        y: Math.max(0, pos.y - 32),
        width: 16,
        height: 16,
      });
    }
  }

  // Shared clearance rail: every below-row arc (back-edges and self-edges
  // in horizontal mode, self-edges in vertical mode) lands on this Y value.
  let maxNodeBottom = 0;
  for (const pos of positions.values()) {
    const bottom = pos.y + pos.height;
    if (bottom > maxNodeBottom) maxNodeBottom = bottom;
  }
  const belowRow = maxNodeBottom + 48;

  // ── Forward edges: use ELK routes + ELK label positions ──────────────────
  const routes = new Map<string, EdgeRoute>();
  for (const e of out.edges) {
    const section = e.sections?.[0];
    if (!section) continue;
    const points = [
      section.startPoint,
      ...(section.bendPoints ?? []),
      section.endPoint,
    ];

    // Prefer ELK's computed label centre; fall back to polyline midpoint.
    let labelX: number;
    let labelY: number;
    const elkLabel = e.labels?.[0];
    if (
      elkLabel &&
      typeof elkLabel.x === "number" &&
      typeof elkLabel.y === "number"
    ) {
      labelX = elkLabel.x + elkLabel.width / 2;
      labelY = elkLabel.y + elkLabel.height / 2;
    } else {
      const mid = midpointOf(points);
      labelX = mid.x;
      labelY = mid.y;
    }

    routes.set(e.id, { id: e.id, points, labelX, labelY });
  }

  // ── Horizontal back-edges: replace ELK staircase with clean U-arc ────────
  if (orientation === "horizontal") {
    for (const edge of graph.edges) {
      if (edge.kind !== "transition") continue;
      if (edge.isSelf) continue;
      const srcPos = positions.get(edge.sourceId);
      const tgtPos = positions.get(edge.targetId);
      if (!srcPos || !tgtPos) continue;
      if (srcPos.x <= tgtPos.x) continue; // forward edge — ELK route is fine

      const srcCX = srcPos.x + srcPos.width / 2;
      const tgtCX = tgtPos.x + tgtPos.width / 2;
      const srcBottom = srcPos.y + srcPos.height;
      const tgtBottom = tgtPos.y + tgtPos.height;
      routes.set(edge.id, {
        id: edge.id,
        points: [
          { x: srcCX, y: srcBottom },
          { x: srcCX, y: belowRow },
          { x: tgtCX, y: belowRow },
          { x: tgtCX, y: tgtBottom },
        ],
        labelX: (srcCX + tgtCX) / 2,
        labelY: belowRow,
      });
    }
  }

  // ── Self-edges: synthesise arcs that don't interfere with the main flow ───
  for (const edge of graph.edges) {
    if (edge.kind !== "transition") continue;
    if (!edge.isSelf) continue;
    const pos = positions.get(edge.sourceId);
    if (!pos) continue;

    if (orientation === "horizontal") {
      // Below the node, on the same rail as back-edges.
      const leftX = pos.x + pos.width / 3;
      const rightX = pos.x + (pos.width * 2) / 3;
      const bottomY = pos.y + pos.height;
      routes.set(edge.id, {
        id: edge.id,
        points: [
          { x: leftX, y: bottomY },
          { x: leftX, y: belowRow },
          { x: rightX, y: belowRow },
          { x: rightX, y: bottomY },
        ],
        labelX: (leftX + rightX) / 2,
        labelY: belowRow,
      });
    } else {
      // Right-side arc — doesn't interfere with DOWN flow.
      const topY = pos.y + pos.height / 3;
      const bottomY = pos.y + (pos.height * 2) / 3;
      const rightX = pos.x + pos.width;
      const loopX = rightX + 28;
      routes.set(edge.id, {
        id: edge.id,
        points: [
          { x: rightX, y: topY },
          { x: loopX, y: topY },
          { x: loopX, y: bottomY },
          { x: rightX, y: bottomY },
        ],
        labelX: loopX,
        labelY: (topY + bottomY) / 2,
      });
    }
  }

  const nodeSize = { width: 144, height: 72 }; // fallback for bounds only
  const width = out.width ?? computeBound(positions, "x", nodeSize.width);
  const height = out.height ?? computeBound(positions, "y", nodeSize.height);

  return { positions, edges: routes, width, height, preset };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function midpointOf(points: ElkPoint[]): ElkPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0]!;
  const segments: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push(d);
    total += d;
  }
  const half = total / 2;
  let acc = 0;
  for (let i = 0; i < segments.length; i++) {
    const d = segments[i]!;
    if (acc + d >= half) {
      const t = (half - acc) / d;
      const a = points[i]!;
      const b = points[i + 1]!;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    acc += d;
  }
  return points[points.length - 1]!;
}

function computeBound(
  positions: Map<string, NodePosition>,
  axis: "x" | "y",
  sizeFallback: number,
): number {
  let max = 0;
  for (const p of positions.values()) {
    const side = axis === "x" ? p.x + p.width : p.y + p.height;
    if (side > max) max = side;
  }
  return max + sizeFallback;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function layoutGraph(
  graph: GraphDocument,
  options: LayoutOptions = {},
): Promise<LayoutResult> {
  const preset = options.preset ?? DEFAULT_PRESET;
  const orientation = options.orientation ?? "vertical";
  const pinnedMap = new Map<string, PinnedNode>(
    (options.pinned ?? []).map((p) => [p.id, p]),
  );

  const stateCount = graph.nodes.reduce(
    (n, node) => (node.kind === "state" ? n + 1 : n),
    0,
  );
  if (stateCount === 0) {
    return { positions: new Map(), edges: new Map(), width: 0, height: 0, preset };
  }

  const elk = buildElk();
  const input = toElkGraph(graph, preset, pinnedMap, options);
  const output = await elk.layout(input);
  return toLayoutResult(output, graph, preset, pinnedMap, orientation);
}

export const layoutGraphAsync = layoutGraph;
