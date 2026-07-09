import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { parseImportPayload, type DomainPatch, type WorkflowEditorDocument } from "@cyoda/workflow-core";
import { vi } from "vitest";
import { I18nContext } from "../src/i18n/context.js";
import { defaultMessages } from "../src/i18n/en.js";
import { CriterionField } from "../src/inspector/CriterionField.js";
import { WorkflowForm } from "../src/inspector/WorkflowForm.js";
import { useEditorStore } from "../src/state/store.js";

afterEach(() => cleanup());

function renderField(emptyText?: string) {
  return render(
    <I18nContext.Provider value={defaultMessages}>
      <CriterionField
        value={undefined}
        disabled={false}
        modelKey="host-wf"
        emptyText={emptyText}
        onCommit={() => {}}
        onRemove={() => {}}
      />
    </I18nContext.Provider>,
  );
}

describe("CriterionField empty-state copy", () => {
  it("shows injected empty text and suppresses the automated warning", () => {
    renderField(defaultMessages.criterion.workflowNone);
    expect(screen.getByText(defaultMessages.criterion.workflowNone)).toBeTruthy();
    expect(screen.queryByTestId("criterion-automated-warning")).toBeNull();
  });

  it("falls back to the automated transition copy when no emptyText is given", () => {
    renderField(undefined);
    expect(screen.getByText(defaultMessages.criterion.noneAutomated)).toBeTruthy();
    expect(screen.getByTestId("criterion-automated-warning")).toBeTruthy();
  });
});

function workflowDoc(): WorkflowEditorDocument {
  const result = parseImportPayload(
    JSON.stringify({
      importMode: "MERGE",
      workflows: [
        { version: "1.0", name: "wf", initialState: "start", active: true, states: { start: { transitions: [] } } },
      ],
    }),
  );
  if (!result.document) throw new Error("fixture parse failed");
  return result.document;
}

function renderWorkflowForm() {
  const workflow = workflowDoc().session.workflows[0]!;
  const onDispatch = vi.fn<(patch: DomainPatch) => void>();
  return {
    ...render(
      <I18nContext.Provider value={defaultMessages}>
        <WorkflowForm workflow={workflow} disabled={false} onDispatch={onDispatch} />
      </I18nContext.Provider>,
    ),
    onDispatch,
  };
}

function workflowDocWithCriterion(): WorkflowEditorDocument {
  const result = parseImportPayload(
    JSON.stringify({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "start",
          active: true,
          criterion: { type: "simple", jsonPath: "$.kind", operation: "EQUALS", value: "order" },
          states: { start: { transitions: [] } },
        },
      ],
    }),
  );
  if (!result.document) throw new Error("fixture parse failed");
  return result.document;
}

function renderWorkflowFormWithCriterion() {
  const workflow = workflowDocWithCriterion().session.workflows[0]!;
  const onDispatch = vi.fn<(patch: DomainPatch) => void>();
  return {
    ...render(
      <I18nContext.Provider value={defaultMessages}>
        <WorkflowForm workflow={workflow} disabled={false} onDispatch={onDispatch} />
      </I18nContext.Provider>,
    ),
    onDispatch,
  };
}

describe("workflow criterion editing", () => {
  it("shows the workflow caption and empty copy, not the transition warning", () => {
    renderWorkflowForm();
    expect(screen.getByText(defaultMessages.criterion.workflowCaption)).toBeTruthy();
    expect(screen.getByText(defaultMessages.criterion.workflowNone)).toBeTruthy();
    expect(screen.queryByTestId("criterion-automated-warning")).toBeNull();
  });

  it("Add dispatches setCriterion with a workflow host", () => {
    const view = renderWorkflowForm();
    fireEvent.click(view.getByTestId("inspector-criterion-add"));
    expect(view.onDispatch).toHaveBeenCalledTimes(1);
    expect(view.onDispatch.mock.calls[0]![0]).toMatchObject({
      op: "setCriterion",
      host: { kind: "workflow", workflow: "wf" },
      path: ["criterion"],
      criterion: { type: "simple" },
    });
  });

  it("Remove dispatches setCriterion with a workflow host and criterion undefined", () => {
    const view = renderWorkflowFormWithCriterion();
    fireEvent.click(view.getByTestId("inspector-criterion-remove"));
    expect(view.onDispatch).toHaveBeenCalledWith({
      op: "setCriterion",
      host: { kind: "workflow", workflow: "wf" },
      path: ["criterion"],
      criterion: undefined,
    });
  });

  it("labels a workflow-host setCriterion undo entry", () => {
    const doc = workflowDoc();
    const { result } = renderHook(() => useEditorStore(doc));
    act(() => {
      result.current[1].dispatch({
        op: "setCriterion",
        host: { kind: "workflow", workflow: "wf" },
        path: ["criterion"],
        criterion: { type: "simple", jsonPath: "$.kind", operation: "EQUALS", value: "order" },
      });
    });
    expect(result.current[0].undoStack[0]!.summary).toBe("Set workflow criterion");
  });
});
