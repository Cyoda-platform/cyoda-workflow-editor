import { expect, test, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { InspectorFrame } from "../src/inspector/InspectorFrame.js";

afterEach(cleanup);

function Child({ onMount }: { onMount: () => void }) {
  const seen = useRef(false);
  useEffect(() => { if (!seen.current) { seen.current = true; onMount(); } }, [onMount]);
  return <div data-testid="child">content</div>;
}

test("toggling mode does NOT remount children (Monaco-state preservation)", () => {
  const onMount = vi.fn();
  const rect = { left: 40, top: 40, width: 400, height: 300 };
  const { rerender } = render(
    <InspectorFrame mode="docked" rect={rect} dockedWidth={384} onRectChange={vi.fn()} onDockedWidthChange={vi.fn()}>
      <Child onMount={onMount} />
    </InspectorFrame>,
  );
  expect(onMount).toHaveBeenCalledTimes(1);
  rerender(
    <InspectorFrame mode="floating" rect={rect} dockedWidth={384} onRectChange={vi.fn()} onDockedWidthChange={vi.fn()}>
      <Child onMount={onMount} />
    </InspectorFrame>,
  );
  expect(onMount).toHaveBeenCalledTimes(1);          // same element identity → no remount
});

test("floating mode positions the panel fixed at the rect", () => {
  const rect = { left: 40, top: 50, width: 420, height: 320 };
  render(
    <InspectorFrame mode="floating" rect={rect} dockedWidth={384} onRectChange={vi.fn()} onDockedWidthChange={vi.fn()}>
      <div data-testid="child">c</div>
    </InspectorFrame>,
  );
  const panel = screen.getByTestId("inspector-frame");
  expect(panel.style.position).toBe("fixed");
  expect(panel.style.left).toBe("40px");
  expect(panel.style.width).toBe("420px");
});

test("docked mode is relative and sized by dockedWidth; the col-resize handle is present", () => {
  render(
    <InspectorFrame mode="docked" rect={{ left: 0, top: 0, width: 400, height: 300 }} dockedWidth={384} onRectChange={vi.fn()} onDockedWidthChange={vi.fn()}>
      <div data-testid="child">c</div>
    </InspectorFrame>,
  );
  const panel = screen.getByTestId("inspector-frame");
  expect(panel.style.position).toBe("relative");
  expect(panel.style.width).toBe("384px");
  expect(screen.getByTestId("inspector-resize-handle")).toBeTruthy();
});
