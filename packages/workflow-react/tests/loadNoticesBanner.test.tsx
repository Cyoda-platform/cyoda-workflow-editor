import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { parseImportPayload, type WorkflowEditorDocument } from "@cyoda/workflow-core";
import { WorkflowEditor } from "../src/index.js";

function fixture(name: string): WorkflowEditorDocument {
  const result = parseImportPayload(
    JSON.stringify({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.3",
          name,
          initialState: "start",
          active: true,
          states: { start: { transitions: [] } },
        },
      ],
    }),
  );
  if (!result.document) throw new Error("fixture parse failed");
  return result.document;
}

const docA = fixture("wfA");
const docB = fixture("wfB");

afterEach(() => cleanup());

describe("load notices banner", () => {
  it("renders the banner when loadNotices are supplied", () => {
    render(
      <WorkflowEditor
        document={docA}
        loadNotices={["Processor \"RetryLater\": config keys not part of the cyoda-go wire format were dropped: delaySeconds, transition."]}
      />,
    );
    expect(screen.getByTestId("load-notices-banner")).toBeTruthy();
    expect(screen.getByTestId("load-notices-banner-item-0").textContent).toContain("RetryLater");
  });

  it("does not render the banner when no notices are supplied", () => {
    render(<WorkflowEditor document={docA} />);
    expect(screen.queryByTestId("load-notices-banner")).toBeNull();
  });

  it("dismissing hides the banner", () => {
    render(<WorkflowEditor document={docA} loadNotices={["Something was dropped."]} />);
    expect(screen.getByTestId("load-notices-banner")).toBeTruthy();
    fireEvent.click(screen.getByTestId("load-notices-banner-dismiss"));
    expect(screen.queryByTestId("load-notices-banner")).toBeNull();
  });

  it("loading a different document with its own notices shows the banner again after a prior dismissal", () => {
    const { rerender } = render(
      <WorkflowEditor document={docA} loadNotices={["Notice from document A."]} />,
    );
    fireEvent.click(screen.getByTestId("load-notices-banner-dismiss"));
    expect(screen.queryByTestId("load-notices-banner")).toBeNull();

    // Simulate the host loading a different document into the same
    // long-lived WorkflowEditor instance (no remount) — a fresh notices
    // array for the new document must un-dismiss the banner.
    rerender(<WorkflowEditor document={docB} loadNotices={["Notice from document B."]} />);

    expect(screen.getByTestId("load-notices-banner")).toBeTruthy();
    expect(screen.getByTestId("load-notices-banner-item-0").textContent).toContain(
      "Notice from document B.",
    );
  });
});
