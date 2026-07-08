import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LayoutOptionsMenu } from "../src/components/LayoutOptionsMenu.js";

afterEach(() => cleanup());

describe("LayoutOptionsMenu", () => {
  it("marks the current orientation and density as pressed", () => {
    render(
      <LayoutOptionsMenu
        orientation="vertical"
        density="configuratorReadable"
        onSetOrientation={vi.fn()}
        onSetDensity={vi.fn()}
      />,
    );
    expect(screen.getByTestId("layout-orientation-vertical").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("layout-orientation-horizontal").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("layout-density-configuratorReadable").getAttribute("aria-pressed")).toBe("true");
  });

  it("dispatches orientation and density changes", () => {
    const onSetOrientation = vi.fn();
    const onSetDensity = vi.fn();
    render(
      <LayoutOptionsMenu
        orientation="vertical"
        density="configuratorReadable"
        onSetOrientation={onSetOrientation}
        onSetDensity={onSetDensity}
      />,
    );
    fireEvent.click(screen.getByTestId("layout-orientation-horizontal"));
    expect(onSetOrientation).toHaveBeenCalledWith("horizontal");
    fireEvent.click(screen.getByTestId("layout-density-websiteCompact"));
    expect(onSetDensity).toHaveBeenCalledWith("websiteCompact");
  });
});
