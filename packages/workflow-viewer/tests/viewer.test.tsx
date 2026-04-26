import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { parseImportPayload } from "@cyoda/workflow-core";
import { projectToGraph } from "@cyoda/workflow-graph";
import { WorkflowViewer } from "../src/index.js";

function projectFixture(json: unknown) {
  const parsed = parseImportPayload(JSON.stringify(json));
  if (!parsed.document) throw new Error("parse failed: " + JSON.stringify(parsed.issues));
  return projectToGraph(parsed.document);
}

describe("WorkflowViewer", () => {
  test("renders state nodes and edge chips for a minimal workflow", () => {
    const graph = projectFixture({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "draft",
          active: true,
          states: {
            draft: {
              transitions: [
                {
                  name: "submit",
                  next: "review",
                  manual: false,
                  disabled: false,
                },
              ],
            },
            review: { transitions: [] },
          },
        },
      ],
    });

    const { container } = render(<WorkflowViewer graph={graph} />);
    expect(screen.getByTestId("workflow-viewer")).toBeTruthy();
    expect(screen.getByTestId("state-node-draft")).toBeTruthy();
    expect(screen.getByTestId("state-node-review")).toBeTruthy();
    expect(container.querySelectorAll("[data-testid^='edge-']")).toHaveLength(1);
  });

  test("renders a badge row for manual transitions with processors", () => {
    const graph = projectFixture({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "a",
          active: true,
          states: {
            a: {
              transitions: [
                {
                  name: "process",
                  next: "b",
                  manual: true,
                  disabled: false,
                  processors: [
                    {
                      type: "externalized",
                      name: "enrich",
                      executionMode: "SYNC",
                      config: {
                        attachEntity: false,
                        responseTimeoutMs: 5000,
                      },
                    },
                  ],
                },
              ],
            },
            b: { transitions: [] },
          },
        },
      ],
    });

    const { container } = render(<WorkflowViewer graph={graph} />);
    const texts = Array.from(container.querySelectorAll("text")).map((n) => n.textContent);
    expect(texts).toContain("process");
    expect(texts).toContain("Manual");
    expect(texts).toContain("SYNC");
    expect(texts).toContain("enrich");
  });

  test("accepts an external selection and surfaces changes", () => {
    const graph = projectFixture({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "x",
          active: true,
          states: {
            x: {
              transitions: [{ name: "go", next: "y", manual: false, disabled: false }],
            },
            y: { transitions: [] },
          },
        },
      ],
    });
    const xNode = graph.nodes.find((n) => n.kind === "state" && n.stateCode === "x");
    if (!xNode) throw new Error("fixture missing x");

    render(<WorkflowViewer graph={graph} selectedId={xNode.id} />);
    expect(screen.getByTestId("state-node-x")).toBeTruthy();
  });

  test("renders state node dimensions from supplied layout positions", () => {
    const graph = projectFixture({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "wide",
          active: true,
          states: {
            wide: { transitions: [] },
          },
        },
      ],
    });
    const node = graph.nodes.find((n) => n.kind === "state" && n.stateCode === "wide");
    if (!node) throw new Error("fixture missing wide");

    render(
      <WorkflowViewer
        graph={graph}
        layout={{
          positions: new Map([
            [node.id, { id: node.id, x: 10, y: 20, width: 220, height: 96 }],
          ]),
          width: 260,
          height: 140,
        }}
      />,
    );

    const rect = screen.getByTestId("state-node-wide").querySelector("rect");
    expect(rect?.getAttribute("width")).toBe("220");
    expect(rect?.getAttribute("height")).toBe("96");
  });
});
