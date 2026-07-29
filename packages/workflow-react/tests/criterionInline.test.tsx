import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  parseImportPayload,
  type DomainPatch,
  type WorkflowEditorDocument,
} from "@cyoda/workflow-core";
import { I18nContext } from "../src/i18n/context.js";
import { defaultMessages } from "../src/i18n/en.js";
import { TransitionForm } from "../src/inspector/TransitionForm.js";
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
        <button
          type="button"
          data-testid="select-guarded-transition"
          onClick={() =>
            latestCanvasProps?.onSelectionChange({
              kind: "transition",
              transitionUuid: transitionId("wf", "start", "guarded"),
            })
          }
        >
          select guarded
        </button>
        {props.onUndo && (
          <button
            type="button"
            data-testid="canvas-undo"
            disabled={!props.canUndo}
            onClick={() => props.onUndo?.()}
          >
            Undo
          </button>
        )}
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
          version: "1.3",
          name: "wf",
          initialState: "start",
          active: true,
          states: {
            start: {
              transitions: [
                { name: "auto", next: "done", manual: false, disabled: false },
                {
                  name: "guarded",
                  next: "done",
                  manual: false,
                  disabled: false,
                  criterion: {
                    type: "simple",
                    jsonPath: "$.status",
                    operation: "EQUALS",
                    value: "READY",
                  },
                },
              ],
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

function renderTransitionForm({
  manual,
  criterion,
}: {
  manual: boolean;
  criterion?: NonNullable<
    WorkflowEditorDocument["session"]["workflows"][number]["states"][string]["transitions"][number]["criterion"]
  >;
}) {
  const doc = fixtureDoc();
  const workflow = doc.session.workflows[0]!;
  const transitionUuid = Object.keys(doc.meta.ids.transitions)[0]!;
  const transition = {
    name: "auto",
    next: "done",
    manual,
    disabled: false,
    ...(criterion ? { criterion } : {}),
  };
  const onDispatch = vi.fn<(patch: DomainPatch) => void>();
  return {
    ...render(
      <I18nContext.Provider value={defaultMessages}>
        <TransitionForm
          workflow={workflow}
          stateCode="start"
          transition={transition}
          transitionUuid={transitionUuid}
          transitionIndex={0}
          processorUuids={[]}
          anchors={undefined}
          disabled={false}
          onDispatch={onDispatch}
        />
      </I18nContext.Provider>,
    ),
    onDispatch,
  };
}

afterEach(() => {
  latestCanvasProps = undefined;
  currentDoc = undefined;
  cleanup();
});

describe("criterion inline UX", () => {
  it("shows compact no-criterion copy and automated warning", () => {
    const view = renderTransitionForm({ manual: false });
    expect(view.getByText(defaultMessages.criterion.noneAutomated)).toBeTruthy();
    expect(view.getByTestId("criterion-automated-warning").textContent).toBe(
      defaultMessages.criterion.noneAutomatedWarning,
    );
    expect(view.getByTestId("inspector-criterion-add").textContent).toBe(
      defaultMessages.criterion.add,
    );
  });

  it("shows compact no-criterion copy for manual transitions", () => {
    const view = renderTransitionForm({ manual: true });
    expect(view.getByText(defaultMessages.criterion.noneManual)).toBeTruthy();
    expect(view.queryByTestId("criterion-automated-warning")).toBeNull();
  });

  it("shows existing criterion summary with compact JSON and clear edit/remove actions", () => {
    const view = renderTransitionForm({
      manual: false,
      criterion: {
        type: "simple",
        jsonPath: "$.status",
        operation: "EQUALS",
        value: "READY",
      },
    });
    // Type badge shown via the meta chip.
    expect(view.getByText("simple")).toBeTruthy();
    // Compact JSON display
    expect(view.getByTestId("criterion-compact-json")).toBeTruthy();
    expect(view.getByTestId("inspector-criterion-edit").textContent).toBe(
      defaultMessages.criterion.edit,
    );
    expect(view.getByTestId("inspector-criterion-remove").textContent).toBe(
      defaultMessages.criterion.remove,
    );
    // No modal; inline editor pane not mounted while collapsed.
    expect(view.queryByTestId("criterion-editor-modal")).toBeNull();
    expect(view.queryByTestId("criterion-json-editor")).toBeNull();
  });

  it("expands the inline editor on Edit and collapses without dispatching", () => {
    const view = renderTransitionForm({
      manual: false,
      criterion: {
        type: "simple",
        jsonPath: "$.status",
        operation: "EQUALS",
        value: "READY",
      },
    });

    expect(view.queryByTestId("criterion-editor-modal")).toBeNull();
    expect(view.queryByTestId("criterion-json-editor")).toBeNull();

    fireEvent.click(view.getByTestId("inspector-criterion-edit"));
    expect(view.queryByTestId("criterion-editor-modal")).toBeNull();
    expect(view.getByTestId("criterion-json-editor")).toBeTruthy();
    expect(view.getByTestId("inspector-criterion-apply")).toBeTruthy();

    fireEvent.click(view.getByTestId("inspector-criterion-collapse"));
    expect(view.queryByTestId("criterion-json-editor")).toBeNull();
    expect(view.getByTestId("criterion-summary-card")).toBeTruthy();
    expect(view.onDispatch).not.toHaveBeenCalled();
  });

  it("expands the inline editor and applies a valid edited criterion", () => {
    const view = renderTransitionForm({
      manual: false,
      criterion: {
        type: "simple",
        jsonPath: "$.status",
        operation: "EQUALS",
        value: "READY",
      },
    });

    fireEvent.click(view.getByTestId("inspector-criterion-edit"));
    expect(view.queryByTestId("criterion-editor-modal")).toBeNull();

    const editor = view.getByTestId("criterion-json-editor") as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: {
        value: JSON.stringify({
          type: "simple",
          jsonPath: "$.status",
          operation: "EQUALS",
          value: "OK",
        }),
      },
    });

    // Apply should be enabled for valid, changed JSON
    expect((view.getByTestId("inspector-criterion-apply") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(view.getByTestId("inspector-criterion-apply"));

    // Dispatch should have been called with the parsed criterion
    expect(view.onDispatch).toHaveBeenCalledTimes(1);
    expect(view.onDispatch.mock.calls[0]![0]).toMatchObject({
      op: "setCriterion",
      criterion: {
        type: "simple",
        jsonPath: "$.status",
        operation: "EQUALS",
        value: "OK",
      },
    });
    // Pane collapses after apply
    expect(view.queryByTestId("criterion-json-editor")).toBeNull();
  });

  it("blocks Apply on invalid JSON", () => {
    const view = renderTransitionForm({
      manual: false,
      criterion: {
        type: "simple",
        jsonPath: "$.status",
        operation: "EQUALS",
        value: "READY",
      },
    });

    fireEvent.click(view.getByTestId("inspector-criterion-edit"));

    const editor = view.getByTestId("criterion-json-editor") as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "{ broken" } });

    expect((view.getByTestId("inspector-criterion-apply") as HTMLButtonElement).disabled).toBe(true);
    expect(view.getByTestId("criterion-error")).toBeTruthy();
    expect(view.onDispatch).not.toHaveBeenCalled();
  });

  it("blocks Apply on valid JSON that is an incomplete criterion (empty jsonPath)", () => {
    const view = renderTransitionForm({
      manual: false,
      criterion: {
        type: "simple",
        jsonPath: "$.status",
        operation: "EQUALS",
        value: "READY",
      },
    });

    fireEvent.click(view.getByTestId("inspector-criterion-edit"));

    const editor = view.getByTestId("criterion-json-editor") as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: {
        value: JSON.stringify({ type: "simple", jsonPath: "", operation: "EQUALS" }),
      },
    });

    expect((view.getByTestId("inspector-criterion-apply") as HTMLButtonElement).disabled).toBe(true);
    expect(view.getByTestId("criterion-error")).toBeTruthy();
    expect(view.getByTestId("criterion-error").textContent).toBe("Choose a field for this condition.");
    expect(view.onDispatch).not.toHaveBeenCalled();
  });

  it("Add commits a default criterion through the full editor; undo removes it", () => {
    currentDoc = fixtureDoc();
    render(<WorkflowEditor document={currentDoc} mode="editor" />);

    fireEvent.click(screen.getByTestId("select-auto-transition"));
    expect((screen.getByTestId("inspector-transition-name") as HTMLInputElement).value).toBe("auto");

    fireEvent.click(screen.getByTestId("inspector-criterion-add"));
    expect((screen.getByTestId("inspector-transition-name") as HTMLInputElement).value).toBe("auto");
    const edge = latestCanvasProps?.graph.edges.find((candidate) => candidate.id === transitionId("wf", "start", "auto"));
    expect(edge && edge.kind === "transition" ? edge.summary.criterion?.kind : undefined).toBe("simple");

    fireEvent.click(screen.getByTestId("canvas-undo"));
    const reverted = latestCanvasProps?.graph.edges.find((candidate) => candidate.id === transitionId("wf", "start", "auto"));
    expect(reverted && reverted.kind === "transition" ? reverted.summary.criterion : undefined).toBeUndefined();
  });

  it("applies one criterion patch via the inline editor, updates the graph badge, preserves selection, and undo restores previous state", () => {
    currentDoc = fixtureDoc();
    render(<WorkflowEditor document={currentDoc} mode="editor" />);

    fireEvent.click(screen.getByTestId("select-guarded-transition"));
    expect((screen.getByTestId("inspector-transition-name") as HTMLInputElement).value).toBe("guarded");

    fireEvent.click(screen.getByTestId("inspector-criterion-edit"));
    expect(screen.queryByTestId("criterion-editor-modal")).toBeNull();
    const editor = screen.getByTestId("criterion-json-editor") as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: {
        value: JSON.stringify({
          type: "simple",
          jsonPath: "$.newStatus",
          operation: "EQUALS",
          value: "READY",
        }),
      },
    });
    fireEvent.click(screen.getByTestId("inspector-criterion-apply"));

    expect((screen.getByTestId("inspector-transition-name") as HTMLInputElement).value).toBe("guarded");
    const edge = latestCanvasProps?.graph.edges.find((candidate) => candidate.id === transitionId("wf", "start", "guarded"));
    expect(edge && edge.kind === "transition" ? edge.summary.criterion?.path : undefined).toBe("$.newStatus");

    fireEvent.click(screen.getByTestId("canvas-undo"));
    const reverted = latestCanvasProps?.graph.edges.find((candidate) => candidate.id === transitionId("wf", "start", "guarded"));
    expect(reverted && reverted.kind === "transition" ? reverted.summary.criterion?.path : undefined).toBe("$.status");
  });

  it("expanding without editing and collapsing leaves graph summary and selected transition unchanged", () => {
    currentDoc = fixtureDoc();
    render(<WorkflowEditor document={currentDoc} mode="editor" />);

    fireEvent.click(screen.getByTestId("select-guarded-transition"));
    fireEvent.click(screen.getByTestId("inspector-criterion-edit"));

    // Collapse without making changes
    fireEvent.click(screen.getByTestId("inspector-criterion-collapse"));

    expect((screen.getByTestId("inspector-transition-name") as HTMLInputElement).value).toBe("guarded");
    const edge = latestCanvasProps?.graph.edges.find((candidate) => candidate.id === transitionId("wf", "start", "guarded"));
    expect(edge && edge.kind === "transition" ? edge.summary.criterion?.path : undefined).toBe("$.status");
  });

  it("remove criterion dispatches one clear patch from the compact card", () => {
    const view = renderTransitionForm({
      manual: false,
      criterion: { type: "simple", jsonPath: "$.status", operation: "EQUALS", value: "READY" },
    });
    fireEvent.click(view.getByTestId("inspector-criterion-remove"));
    expect(view.onDispatch).toHaveBeenCalledTimes(1);
    expect(view.onDispatch.mock.calls[0]![0]).toMatchObject({
      op: "setCriterion",
      criterion: undefined,
    });
  });
});
