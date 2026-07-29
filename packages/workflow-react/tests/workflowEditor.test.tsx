import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { parseImportPayload, type WorkflowEditorDocument } from "@cyoda/workflow-core";
import { WorkflowEditor } from "../src/index.js";

afterEach(cleanup);

const doc = parseImportPayload(
  JSON.stringify({
    importMode: "MERGE",
    workflows: [
      {
        version: "1.0",
        name: "wf",
        initialState: "NEW",
        active: true,
        states: { NEW: { transitions: [] } },
      },
    ],
  }),
).document!;

test("a new workflow carries the dialect's schema tag, not a hardcoded 1.0", () => {
  let lastDoc: WorkflowEditorDocument | undefined;
  render(
    <WorkflowEditor
      document={doc}
      mode="editor"
      onChange={(next) => {
        lastDoc = next;
      }}
    />,
  );

  fireEvent.click(screen.getByTestId("tab-add"));

  const newWorkflow = lastDoc?.session.workflows.find((w) => w.name !== "wf");
  expect(newWorkflow).toBeTruthy();
  expect(newWorkflow!.version).toBe("1.3");
});
