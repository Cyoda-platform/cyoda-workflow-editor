import { afterEach, expect, test, vi } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import type { State, Transition, Workflow } from "@cyoda/workflow-core";
import { WorkflowForm } from "../src/inspector/WorkflowForm.js";
import { StateForm } from "../src/inspector/StateForm.js";
import { TransitionForm } from "../src/inspector/TransitionForm.js";
import { I18nContext } from "../src/i18n/context.js";
import { defaultMessages } from "../src/i18n/en.js";

afterEach(cleanup);

const wf: Workflow = { version: "1.3", name: "wf", initialState: "NEW", active: true, states: { NEW: { transitions: [] } } };
const wrap = (ui: React.ReactNode) => render(<I18nContext.Provider value={defaultMessages}>{ui}</I18nContext.Provider>);

// WorkflowForm and TransitionForm both now render a *second* "Add annotations"
// button for the host's criterion (via CriterionSection), scoped inside a
// `inspector-criterion-annotations` wrapper. Tests targeting the host's own
// (non-criterion) annotations field must exclude that wrapper.
function hostAnnotationsAddButton(): HTMLElement {
  const button = screen
    .getAllByTestId("inspector-annotations-add")
    .find((el) => !el.closest('[data-testid="inspector-criterion-annotations"]'));
  if (!button) throw new Error("host annotations add button not found");
  return button;
}

test("WorkflowForm: Add annotations dispatches setAnnotations for the workflow", () => {
  const onDispatch = vi.fn();
  wrap(<WorkflowForm workflow={wf} disabled={false} onDispatch={onDispatch} />);
  fireEvent.click(hostAnnotationsAddButton());
  expect(onDispatch).toHaveBeenCalledWith({
    op: "setAnnotations",
    target: { kind: "workflow", workflow: "wf" },
    annotations: {},
  });
});

test("StateForm: annotations field renders above the Delete button", () => {
  const state: State = { transitions: [] };
  const onDispatch = vi.fn();
  wrap(
    <StateForm workflow={wf} stateCode="NEW" state={state} disabled={false} onDispatch={onDispatch} onRequestDelete={vi.fn()} />,
  );
  const add = screen.getByTestId("inspector-annotations-add");
  const del = screen.getByTestId("inspector-state-delete");
  // Add appears before Delete in document order.
  expect(add.compareDocumentPosition(del) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(add);
  expect(onDispatch).toHaveBeenCalledWith({
    op: "setAnnotations",
    target: { kind: "state", workflow: "wf", stateCode: "NEW" },
    annotations: {},
  });
});

test("TransitionForm: Add annotations dispatches setAnnotations for the transition", () => {
  const transition: Transition = { name: "go", next: "DONE", manual: false, disabled: false };
  const onDispatch = vi.fn();
  wrap(
    <TransitionForm
      workflow={{ ...wf, states: { NEW: { transitions: [transition] }, DONE: { transitions: [] } } }}
      stateCode="NEW"
      transition={transition}
      transitionUuid="tx-uuid-1"
      transitionIndex={0}
      processorUuids={[]}
      anchors={undefined}
      disabled={false}
      onDispatch={onDispatch}
    />,
  );
  // Regression: the "Annotations" heading appears exactly once — the section
  // title provides it, so the field must not also render its own SectionLabel.
  expect(screen.getAllByText("Annotations")).toHaveLength(1);
  fireEvent.click(hostAnnotationsAddButton());
  expect(onDispatch).toHaveBeenCalledWith({
    op: "setAnnotations",
    target: { kind: "transition", transitionUuid: "tx-uuid-1" },
    annotations: {},
  });
});

test("WorkflowForm: CriterionSection's criterion-annotations Add dispatches setAnnotations with a workflowCriterion target", () => {
  const onDispatch = vi.fn();
  wrap(<WorkflowForm workflow={wf} disabled={false} onDispatch={onDispatch} />);
  const criterionAnnotations = screen.getByTestId("inspector-criterion-annotations");
  fireEvent.click(within(criterionAnnotations).getByTestId("inspector-annotations-add"));
  expect(onDispatch).toHaveBeenCalledWith({
    op: "setAnnotations",
    target: { kind: "workflowCriterion", workflow: "wf" },
    annotations: {},
  });
});

test("TransitionForm: CriterionSection's criterion-annotations Add dispatches setAnnotations with a transitionCriterion target", () => {
  const transition: Transition = { name: "go", next: "DONE", manual: false, disabled: false };
  const onDispatch = vi.fn();
  wrap(
    <TransitionForm
      workflow={{ ...wf, states: { NEW: { transitions: [transition] }, DONE: { transitions: [] } } }}
      stateCode="NEW"
      transition={transition}
      transitionUuid="tx-uuid-1"
      transitionIndex={0}
      processorUuids={[]}
      anchors={undefined}
      disabled={false}
      onDispatch={onDispatch}
    />,
  );
  const criterionAnnotations = screen.getByTestId("inspector-criterion-annotations");
  fireEvent.click(within(criterionAnnotations).getByTestId("inspector-annotations-add"));
  expect(onDispatch).toHaveBeenCalledWith({
    op: "setAnnotations",
    target: { kind: "transitionCriterion", transitionUuid: "tx-uuid-1" },
    annotations: {},
  });
});
