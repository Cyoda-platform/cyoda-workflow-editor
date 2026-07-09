import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import type { Connection, Edge } from "reactflow";
import type { WorkflowEditorDocument } from "@cyoda/workflow-core";
import { parseImportPayload } from "@cyoda/workflow-core";
import { WorkflowEditor } from "../src/index.js";
import type { CanvasProps } from "../src/components/Canvas.js";
import type { Selection } from "../src/state/types.js";

let capturedOnReconnect: ((edge: Edge, c: Connection) => void) | undefined;
let capturedOnSelectionChange: ((s: Selection) => void) | undefined;

vi.mock("../src/components/Canvas.js", () => ({
  Canvas: ({ onReconnect, onSelectionChange }: CanvasProps) => {
    capturedOnReconnect = onReconnect as typeof capturedOnReconnect;
    capturedOnSelectionChange = onSelectionChange;
    return <div data-testid="mock-canvas" />;
  },
}));

function fixture(json: string): WorkflowEditorDocument {
  const result = parseImportPayload(json);
  if (!result.document) throw new Error("fixture parse failed");
  return result.document;
}
function stateId(doc: WorkflowEditorDocument, state: string): string {
  return Object.entries(doc.meta.ids.states).find(([, p]) => p.state === state)![0];
}
function transitionId(doc: WorkflowEditorDocument, state: string): string {
  return Object.entries(doc.meta.ids.transitions).find(([, p]) => p.state === state)![0];
}

const DOC = JSON.stringify({
  importMode: "MERGE",
  workflows: [
    {
      version: "1.0",
      name: "wf",
      initialState: "start",
      active: true,
      states: {
        start: { transitions: [{ name: "go", next: "mid", manual: true, disabled: false }] },
        mid: { transitions: [] },
        end: { transitions: [] },
      },
    },
  ],
});

beforeEach(() => {
  capturedOnReconnect = undefined;
  capturedOnSelectionChange = undefined;
});
afterEach(() => cleanup());

describe("re-anchoring a transition", () => {
  it("preserves the current selection when only the anchor changes", async () => {
    const doc = fixture(DOC);
    const startId = stateId(doc, "start");
    const midId = stateId(doc, "mid");
    const edgeId = transitionId(doc, "start");

    render(<WorkflowEditor document={doc} />);

    // The user is working on a state — its inspector is open.
    act(() => {
      capturedOnSelectionChange?.({ kind: "state", workflow: "wf", stateCode: "start", nodeId: startId });
    });
    await waitFor(() => {
      expect(screen.getByTestId("inspector-state-name")).toBeTruthy();
    });

    // Re-anchor the transition (same source, same target, only the handle changes).
    act(() => {
      capturedOnReconnect?.(
        { id: edgeId, source: startId, target: midId, sourceHandle: "bottom", targetHandle: "top" },
        { source: startId, target: midId, sourceHandle: "bottom", targetHandle: "left" },
      );
    });

    // The layout tweak must not steal selection into the transition inspector.
    await waitFor(() => {
      expect(screen.queryByTestId("inspector-transition-name")).toBeNull();
    });
    expect(screen.getByTestId("inspector-state-name")).toBeTruthy();
  });

  it("still selects the transition when the target endpoint moves to a new state", async () => {
    const doc = fixture(DOC);
    const startId = stateId(doc, "start");
    const midId = stateId(doc, "mid");
    const endId = stateId(doc, "end");
    const edgeId = transitionId(doc, "start");

    render(<WorkflowEditor document={doc} />);

    // Inspector open on a state.
    act(() => {
      capturedOnSelectionChange?.({ kind: "state", workflow: "wf", stateCode: "start", nodeId: startId });
    });
    await waitFor(() => {
      expect(screen.getByTestId("inspector-state-name")).toBeTruthy();
    });

    // Moving the target endpoint to a different state is a structural edit —
    // selecting the moved transition is expected.
    act(() => {
      capturedOnReconnect?.(
        { id: edgeId, source: startId, target: midId, sourceHandle: "bottom", targetHandle: "top" },
        { source: startId, target: endId, sourceHandle: "bottom", targetHandle: "top" },
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("inspector-transition-name")).toBeTruthy();
    });
  });
});
