import { describe, expect, test } from "vitest";
import type { TransitionSummary } from "@cyoda/workflow-graph";
import { badgesFor } from "../src/theme/badges.js";

function summary(commitBeforeDispatch: boolean | undefined): TransitionSummary {
  return { display: "go", full: "go", commitBeforeDispatch };
}

describe("badgesFor — COMMIT BEFORE DISPATCH badge", () => {
  test("appears when commitBeforeDispatch is true", () => {
    const badges = badgesFor(summary(true), { manual: false, disabled: false });
    expect(badges).toContainEqual({ key: "execution", label: "COMMIT BEFORE DISPATCH" });
  });

  test("does not appear when commitBeforeDispatch is false", () => {
    const badges = badgesFor(summary(false), { manual: false, disabled: false });
    expect(badges.find((b) => b.key === "execution")).toBeUndefined();
  });

  test("does not appear when commitBeforeDispatch is undefined (no mode set)", () => {
    const badges = badgesFor(summary(undefined), { manual: false, disabled: false });
    expect(badges.find((b) => b.key === "execution")).toBeUndefined();
  });
});
