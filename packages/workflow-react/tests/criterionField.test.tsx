import { expect, test, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CriterionField } from "../src/inspector/CriterionField.js";
import type { Criterion } from "@cyoda/workflow-core";

afterEach(cleanup);

// No provider needed (useMessages() defaults); no CriterionMonacoProvider → textarea path.
const wrap = (ui: React.ReactNode) => ui;
const simple: Criterion = { type: "simple", jsonPath: "$.x", operation: "EQUALS", value: 1 };

test("absent + automated: shows the automated warning and an Add button that commits a default", () => {
  const onCommit = vi.fn();
  render(wrap(<CriterionField value={undefined} manual={false} disabled={false} modelKey="t1" onCommit={onCommit} onRemove={vi.fn()} />));
  expect(screen.getByTestId("criterion-automated-warning")).toBeTruthy();
  fireEvent.click(screen.getByTestId("inspector-criterion-add"));
  expect(onCommit).toHaveBeenCalledWith({ type: "simple", jsonPath: "", operation: "EQUALS" });
});

test("present: collapsed preview expands to the editor on Edit; lazy pane only mounts when expanded", () => {
  render(wrap(<CriterionField value={simple} disabled={false} modelKey="t1" onCommit={vi.fn()} onRemove={vi.fn()} />));
  expect(screen.getByTestId("criterion-compact-json")).toBeTruthy();
  expect(screen.queryByTestId("criterion-json-editor")).toBeNull();          // not mounted while collapsed
  fireEvent.click(screen.getByTestId("inspector-criterion-edit"));
  expect(screen.getByTestId("criterion-json-editor")).toBeTruthy();          // mounts on expand
});

test("expanded: Apply enabled only when valid + changed; commits parsed criterion", () => {
  const onCommit = vi.fn();
  render(wrap(<CriterionField value={simple} disabled={false} modelKey="t1" onCommit={onCommit} onRemove={vi.fn()} />));
  fireEvent.click(screen.getByTestId("inspector-criterion-edit"));
  const ta = screen.getByTestId("criterion-json-editor") as HTMLTextAreaElement;
  const apply = () => screen.getByTestId("inspector-criterion-apply") as HTMLButtonElement;
  expect(apply().disabled).toBe(true); // unchanged
  fireEvent.change(ta, { target: { value: JSON.stringify({ ...simple, value: 2 }) } });
  expect(apply().disabled).toBe(false);
  fireEvent.click(apply());
  expect(onCommit).toHaveBeenCalledWith({ ...simple, value: 2 });
});

test("expanded: invalid JSON disables Apply and shows an error", () => {
  render(wrap(<CriterionField value={simple} disabled={false} modelKey="t1" onCommit={vi.fn()} onRemove={vi.fn()} />));
  fireEvent.click(screen.getByTestId("inspector-criterion-edit"));
  fireEvent.change(screen.getByTestId("criterion-json-editor"), { target: { value: "{ not json" } });
  expect((screen.getByTestId("inspector-criterion-apply") as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByTestId("criterion-error")).toBeTruthy();
});

test("Revert is enabled while the buffer is invalid JSON and restores the value", () => {
  render(wrap(<CriterionField value={simple} disabled={false} modelKey="t1" onCommit={vi.fn()} onRemove={vi.fn()} />));
  fireEvent.click(screen.getByTestId("inspector-criterion-edit"));
  const ta = screen.getByTestId("criterion-json-editor") as HTMLTextAreaElement;
  fireEvent.change(ta, { target: { value: "{ not json" } });
  const revert = () => screen.getByTestId("inspector-criterion-revert") as HTMLButtonElement;
  expect(revert().disabled).toBe(false); // invalid JSON must not block Revert
  fireEvent.click(revert());
  expect(ta.value).toBe(JSON.stringify(simple, null, 2));
  expect(revert().disabled).toBe(true);
});

test("Remove dispatches onRemove", () => {
  const onRemove = vi.fn();
  render(wrap(<CriterionField value={simple} disabled={false} modelKey="t1" onCommit={vi.fn()} onRemove={onRemove} />));
  fireEvent.click(screen.getByTestId("inspector-criterion-remove"));
  expect(onRemove).toHaveBeenCalledTimes(1);
});

test("three-way sync: clean buffer re-seeds on external change; dirty buffer is kept", () => {
  const { rerender } = render(wrap(<CriterionField value={simple} disabled={false} modelKey="t1" onCommit={vi.fn()} onRemove={vi.fn()} />));
  fireEvent.click(screen.getByTestId("inspector-criterion-edit"));
  const ta = () => screen.getByTestId("criterion-json-editor") as HTMLTextAreaElement;
  const next: Criterion = { ...simple, value: 9 };
  rerender(wrap(<CriterionField value={next} disabled={false} modelKey="t1" onCommit={vi.fn()} onRemove={vi.fn()} />));
  expect(JSON.parse(ta().value)).toEqual(next);          // clean → re-seed
  fireEvent.change(ta(), { target: { value: JSON.stringify({ ...simple, value: 100 }) } });
  rerender(wrap(<CriterionField value={{ ...simple, value: 55 }} disabled={false} modelKey="t1" onCommit={vi.fn()} onRemove={vi.fn()} />));
  expect(JSON.parse(ta().value)).toEqual({ ...simple, value: 100 });  // dirty → kept
  expect(screen.getByTestId("criterion-doc-changed")).toBeTruthy();
});

test("read-only shows no Add/Edit/Apply/Remove", () => {
  render(wrap(<CriterionField value={simple} disabled onCommit={vi.fn()} onRemove={vi.fn()} modelKey="t1" />));
  expect(screen.queryByTestId("inspector-criterion-edit")).toBeNull();
  expect(screen.queryByTestId("inspector-criterion-remove")).toBeNull();
});
