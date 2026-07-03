import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { parseImportPayload, type WorkflowEditorDocument } from "@cyoda/workflow-core";
import { WorkflowEditor } from "../src/index.js";
import type { CanvasProps } from "../src/components/Canvas.js";
import { savePlacement } from "../src/inspector/inspectorPlacement.js";

let latestCanvasProps: CanvasProps | undefined;
let currentDoc: WorkflowEditorDocument | undefined;

vi.mock("../src/components/Canvas.js", () => ({
  Canvas: (props: CanvasProps) => {
    latestCanvasProps = props;
    return (
      <div data-testid="mock-canvas">
        <button
          type="button"
          data-testid="select-auto-transition"
          onClick={() =>
            latestCanvasProps?.onSelectionChange({
              kind: "transition",
              transitionUuid: transitionId("wf", "start", "auto"),
            })
          }
        >
          select auto
        </button>
      </div>
    );
  },
}));

function fixtureDoc(): WorkflowEditorDocument {
  const result = parseImportPayload(
    JSON.stringify({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "start",
          active: true,
          states: {
            start: {
              transitions: [{ name: "auto", next: "done", manual: false, disabled: false }],
            },
            done: { transitions: [] },
          },
        },
      ],
    }),
  );
  if (!result.document) throw new Error("fixture failed");
  return result.document;
}

function transitionId(workflow: string, state: string, transitionName: string): string {
  if (!currentDoc) throw new Error("No current document");
  const wf = currentDoc.session.workflows.find((candidate) => candidate.name === workflow);
  const index = wf?.states[state]?.transitions.findIndex((t) => t.name === transitionName) ?? -1;
  if (index < 0) throw new Error(`Missing transition ${transitionName}`);
  const ids = Object.entries(currentDoc.meta.ids.transitions).filter(
    ([, ptr]) => ptr.workflow === workflow && ptr.state === state,
  );
  return ids[index]![0];
}

function renderEditorWithSelectedTransition(localStorageKey: string | null = null): void {
  currentDoc = fixtureDoc();
  render(<WorkflowEditor document={currentDoc} mode="editor" localStorageKey={localStorageKey} />);
  fireEvent.click(screen.getByTestId("select-auto-transition"));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  latestCanvasProps = undefined;
  currentDoc = undefined;
  cleanup();
  localStorage.clear();
});

describe("inspector docking", () => {
  it("detach toggles the inspector between docked and floating", () => {
    renderEditorWithSelectedTransition();
    const frame = () => screen.getByTestId("inspector-frame");
    expect(frame().style.position).toBe("relative");
    fireEvent.click(screen.getByTestId("inspector-dock-toggle"));
    expect(frame().style.position).toBe("fixed");
    fireEvent.click(screen.getByTestId("inspector-dock-toggle"));
    expect(frame().style.position).toBe("relative");
  });

  it("clamps a placement restored from localStorage into the current viewport", () => {
    // A rect saved on a much larger viewport (e.g. an external monitor) must
    // not be restored off-screen — there is no in-UI way to recover it.
    savePlacement("cyoda-editor-layout", {
      mode: "floating",
      rect: { left: 99999, top: 99999, width: 460, height: 560 },
    });
    renderEditorWithSelectedTransition("cyoda-editor-layout");
    const frame = screen.getByTestId("inspector-frame");
    const left = parseInt(frame.style.left, 10);
    const top = parseInt(frame.style.top, 10);
    const width = parseInt(frame.style.width, 10);
    const height = parseInt(frame.style.height, 10);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(left + width).toBeLessThanOrEqual(window.innerWidth);
    expect(top + height).toBeLessThanOrEqual(window.innerHeight);
  });

  it("re-detaching restores the last floating position instead of reseeding", () => {
    renderEditorWithSelectedTransition();
    const frame = () => screen.getByTestId("inspector-frame");
    fireEvent.click(screen.getByTestId("inspector-dock-toggle")); // detach
    const firstDetachedLeft = frame().style.left;
    fireEvent.click(screen.getByTestId("inspector-dock-toggle")); // dock
    fireEvent.click(screen.getByTestId("inspector-dock-toggle")); // detach again
    expect(frame().style.left).toBe(firstDetachedLeft);
  });
});
