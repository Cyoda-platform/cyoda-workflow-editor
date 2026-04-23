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

const DEFAULT_NODE = { width: 144, height: 72 };
const DEFAULT_PRESET: LayoutPreset = "configuratorReadable";

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

/**
 * Translate a `GraphDocument` into an ELK input graph. Self-edges are
 * excluded — ELK handles them awkwardly; the viewer already renders them as
 * a right-side arc which is correct for every preset.
 */
function toElkGraph(
  graph: GraphDocument,
  preset: LayoutPreset,
  nodeSize: { width: number; height: number },
  pinned: Map<string, PinnedNode>,
): ElkRootInput {
  const children: ElkNodeInput[] = [];

  for (const node of graph.nodes) {
    if (node.kind !== "state") continue;
    const stateNode = node as StateNode;
    const pin = pinned.get(stateNode.id);
    const child: ElkNodeInput = {
      id: stateNode.id,
      width: nodeSize.width,
      height: nodeSize.height,
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
    edges.push({ id: t.id, sources: [t.sourceId], targets: [t.targetId] });
  }

  return {
    id: "root",
    layoutOptions: optionsFor(preset),
    children,
    edges,
  };
}

function toLayoutResult(
  out: ElkRootOutput,
  graph: GraphDocument,
  preset: LayoutPreset,
  nodeSize: { width: number; height: number },
  pinned: Map<string, PinnedNode>,
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
  // the user's pin exactly (spec §13.4). ELK may not honour `elk.position`
  // across every preset; the post-override is authoritative.
  for (const pin of pinned.values()) {
    const prev = positions.get(pin.id);
    if (!prev) continue;
    positions.set(pin.id, { ...prev, x: pin.x, y: pin.y });
  }

  // Position startMarker nodes just above their workflow's initial state.
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
    positions.set(node.id, {
      id: node.id,
      x: pos.x + pos.width / 2 - 8,
      y: Math.max(0, pos.y - 32),
      width: 16,
      height: 16,
    });
  }

  const routes = new Map<string, EdgeRoute>();
  for (const e of out.edges) {
    const section = e.sections?.[0];
    if (!section) continue;
    const points = [
      section.startPoint,
      ...(section.bendPoints ?? []),
      section.endPoint,
    ];
    const mid = midpointOf(points);
    routes.set(e.id, {
      id: e.id,
      points,
      labelX: mid.x,
      labelY: mid.y,
    });
  }

  // Self-edges: synthesise a small right-side arc route so the viewer has
  // a label anchor.
  for (const edge of graph.edges) {
    if (edge.kind !== "transition") continue;
    if (!edge.isSelf) continue;
    const pos = positions.get(edge.sourceId);
    if (!pos) continue;
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

  const width = out.width ?? computeBound(positions, "x", nodeSize.width);
  const height = out.height ?? computeBound(positions, "y", nodeSize.height);

  return { positions, edges: routes, width, height, preset };
}

function midpointOf(points: ElkPoint[]): ElkPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0]!;
  // Walk the polyline and pick the point at total/2 arc length.
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

/**
 * Run ELK on a graph. Async by necessity (ELK's `.layout()` is Promise-based
 * even when bundled). For small graphs the promise resolves synchronously in
 * microtask time — see `layoutGraphSync` wrapper below.
 */
export async function layoutGraph(
  graph: GraphDocument,
  options: LayoutOptions = {},
): Promise<LayoutResult> {
  const preset = options.preset ?? DEFAULT_PRESET;
  const nodeSize = options.nodeSize ?? DEFAULT_NODE;
  const pinnedMap = new Map<string, PinnedNode>(
    (options.pinned ?? []).map((p) => [p.id, p]),
  );

  const stateCount = graph.nodes.reduce(
    (n, node) => (node.kind === "state" ? n + 1 : n),
    0,
  );
  if (stateCount === 0) {
    return {
      positions: new Map(),
      edges: new Map(),
      width: 0,
      height: 0,
      preset,
    };
  }

  const elk = buildElk();
  const input = toElkGraph(graph, preset, nodeSize, pinnedMap);
  const output = await elk.layout(input);
  return toLayoutResult(output, graph, preset, nodeSize, pinnedMap);
}

/**
 * Small-graph helper: callers who know their graph is ≤30 nodes (spec
 * §13.5) can `await layoutGraph(...)` — the promise is cheap. This alias
 * exists so Phase 5 editor code reads naturally.
 */
export const layoutGraphAsync = layoutGraph;
