import type { WorkflowEditorDocument, ValidationIssue } from "@cyoda/workflow-core";
import { idFor } from "@cyoda/workflow-core";
import type {
  GraphAnnotation,
  GraphDocument,
  GraphEdge,
  GraphNode,
  StartMarkerEdge,
  StartMarkerNode,
  StateNode,
  TransitionEdge,
} from "../types.js";
import { computeCategory, computeRole } from "./roles.js";
import { computeLoopbackSet } from "./loopback.js";
import { summarizeTransition } from "./summary.js";

export interface ProjectOptions {
  issues?: ValidationIssue[];
}

/**
 * Project a WorkflowEditorDocument to a GraphDocument (spec §10.2).
 * Pure function; does not mutate inputs.
 */
export function projectToGraph(
  doc: WorkflowEditorDocument,
  options: ProjectOptions = {},
): GraphDocument {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const wf of doc.session.workflows) {
    const loopbacks = computeLoopbackSet(wf);
    const stateIdByCode = new Map<string, string>();

    for (const stateCode of Object.keys(wf.states)) {
      const state = wf.states[stateCode]!;
      const hasOutgoing = state.transitions.length > 0;
      const id = idFor(doc.meta, { kind: "state", workflow: wf.name, state: stateCode });
      if (!id) continue;
      stateIdByCode.set(stateCode, id);
      nodes.push({
        kind: "state",
        id,
        workflow: wf.name,
        stateCode,
        role: computeRole(wf, stateCode, hasOutgoing),
        hasDisabledOutgoing: state.transitions.some((t) => t.disabled),
        category: computeCategory(wf, stateCode),
      } satisfies StateNode);
    }

    if (wf.initialState && stateIdByCode.has(wf.initialState)) {
      const markerId = `startmarker:${wf.name}`;
      const targetId = stateIdByCode.get(wf.initialState)!;
      nodes.push({
        kind: "startMarker",
        id: markerId,
        workflow: wf.name,
      } satisfies StartMarkerNode);
      edges.push({
        kind: "startMarker",
        id: `${markerId}->${targetId}`,
        workflow: wf.name,
        sourceId: markerId,
        targetId,
        interactive: false,
      } satisfies StartMarkerEdge);
    }

    // First pass: group transitions by (sourceId, targetId) to count parallels.
    const groupSizes = new Map<string, number>();
    const groupCounters = new Map<string, number>();
    for (const [stateCode, state] of Object.entries(wf.states)) {
      const sourceId = stateIdByCode.get(stateCode);
      if (!sourceId) continue;
      for (const t of state.transitions) {
        const targetId = stateIdByCode.get(t.next);
        if (!targetId) continue;
        const key = `${sourceId}->${targetId}`;
        groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
      }
    }

    const edgeAnchors = doc.meta.workflowUi[wf.name]?.edgeAnchors;

    // Second pass: build transition edges.
    for (const [stateCode, state] of Object.entries(wf.states)) {
      const sourceId = stateIdByCode.get(stateCode);
      if (!sourceId) continue;
      state.transitions.forEach((t, idx) => {
        const targetId = stateIdByCode.get(t.next);
        if (!targetId) return;
        const edgeId = idFor(doc.meta, {
          kind: "transition",
          workflow: wf.name,
          state: stateCode,
          transitionName: t.name,
          ordinal: idx,
        });
        if (!edgeId) return;
        const groupKey = `${sourceId}->${targetId}`;
        const parallelIndex = groupCounters.get(groupKey) ?? 0;
        groupCounters.set(groupKey, parallelIndex + 1);
        const anchors = edgeAnchors?.[edgeId];
        edges.push({
          kind: "transition",
          id: edgeId,
          workflow: wf.name,
          sourceId,
          targetId,
          label: t.name,
          manual: t.manual,
          disabled: t.disabled,
          isSelf: t.next === stateCode,
          isLoopback: loopbacks.has(`${stateCode}::${idx}`),
          parallelIndex,
          parallelGroupSize: groupSizes.get(groupKey) ?? 1,
          sourceAnchor: anchors?.source,
          targetAnchor: anchors?.target,
          summary: summarizeTransition(t),
        } satisfies TransitionEdge);
      });
    }
  }

  const annotations = buildAnnotations(doc, options.issues ?? []);
  return { nodes, edges, annotations };
}

function buildAnnotations(
  doc: WorkflowEditorDocument,
  issues: ValidationIssue[],
): GraphAnnotation[] {
  const out: GraphAnnotation[] = [];
  for (const issue of issues) {
    const targetId = resolveIssueTargetId(doc, issue);
    if (!targetId) continue;
    out.push({
      targetId,
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
    });
  }
  return out;
}

function resolveIssueTargetId(
  doc: WorkflowEditorDocument,
  issue: ValidationIssue,
): string | undefined {
  const direct = (issue as unknown as { targetId?: string }).targetId;
  if (typeof direct === "string") return direct;
  const detail = issue.detail;
  if (!detail || typeof detail !== "object") return undefined;
  const d = detail as Record<string, unknown>;
  if (typeof d["workflow"] === "string" && typeof d["state"] === "string") {
    return (
      idFor(doc.meta, {
        kind: "state",
        workflow: d["workflow"] as string,
        state: d["state"] as string,
      }) ?? undefined
    );
  }
  if (typeof d["workflow"] === "string") {
    return (
      idFor(doc.meta, { kind: "workflow", workflow: d["workflow"] as string }) ?? undefined
    );
  }
  return undefined;
}
