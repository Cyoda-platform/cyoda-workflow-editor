import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Transition } from "@cyoda/workflow-core";
import { TransitionTooltip } from "../src/components/TransitionTooltip.js";

afterEach(cleanup);

const t: Transition = {
  name: "APPROVE", next: "approved", manual: false, disabled: false,
  annotations: { displayName: "Approve request", description: "Manager sign-off" },
  criterion: { type: "simple", jsonPath: "$.ok", operation: "EQUALS", value: true },
  criterionAnnotations: { displayName: "Is ready" },
  processors: [{ type: "externalized", name: "notify", executionMode: "SYNC",
    annotations: { displayName: "Notify approver" } }],
};

describe("transition tooltip annotations", () => {
  test("shows displayName/description for transition, criterion, and processor", () => {
    render(<TransitionTooltip transition={t} x={0} y={0} />);
    expect(screen.getByText("Approve request")).toBeTruthy();
    expect(screen.getByText("Manager sign-off")).toBeTruthy();
    expect(screen.getByText("Is ready")).toBeTruthy();
    expect(screen.getByText("Notify approver")).toBeTruthy();
  });

  test("omits empty/absent annotation keys", () => {
    render(<TransitionTooltip transition={{ ...t, annotations: { displayName: "  " }, criterionAnnotations: undefined }} x={0} y={0} />);
    expect(screen.queryByText("Is ready")).toBeNull();
  });
});
