import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { parseImportPayload, type WorkflowEditorDocument } from "@cyoda/workflow-core";
import { WorkflowEditor } from "../src/index.js";
import type { CanvasProps } from "../src/components/Canvas.js";

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

function renderEditorWithSelectedTransition(): void {
  currentDoc = fixtureDoc();
  render(<WorkflowEditor document={currentDoc} mode="editor" localStorageKey={null} />);
  fireEvent.click(screen.getByTestId("select-auto-transition"));
}

afterEach(() => {
  latestCanvasProps = undefined;
  currentDoc = undefined;
  cleanup();
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
});
