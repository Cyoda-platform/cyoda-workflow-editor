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

test("docked → floating → minimized → floating never remounts children (Monaco preserved)", () => {
  const onMount = vi.fn();
  const rect = { left: 40, top: 40, width: 400, height: 300 };
  const props = { rect, dockedWidth: 384, onRectChange: vi.fn(), onDockedWidthChange: vi.fn(), onRestore: vi.fn() };
  const { rerender } = render(<InspectorFrame mode="docked" {...props}><Child onMount={onMount} /></InspectorFrame>);
  for (const mode of ["floating", "minimized", "floating", "docked"] as const) {
    rerender(<InspectorFrame mode={mode} {...props}><Child onMount={onMount} /></InspectorFrame>);
  }
  expect(onMount).toHaveBeenCalledTimes(1);
});

test("minimized hides the panel (display:none) but keeps it mounted, and shows the bar", () => {
  const rect = { left: 40, top: 40, width: 420, height: 320 };
  render(
    <InspectorFrame mode="minimized" rect={rect} dockedWidth={384} onRectChange={vi.fn()} onDockedWidthChange={vi.fn()} onRestore={vi.fn()}>
      <div data-testid="child">c</div>
    </InspectorFrame>,
  );
  const panel = screen.getByTestId("inspector-frame");
  expect(panel.style.display).toBe("none");     // hidden…
  expect(screen.getByTestId("child")).toBeTruthy(); // …but still mounted
  expect(screen.getByTestId("inspector-min-bar")).toBeTruthy();
  expect(screen.queryByTestId("inspector-resize-handle")).toBeNull();
});

test("clicking the minimized bar restores; the bar's restore and close buttons fire their callbacks", () => {
  const onRestore = vi.fn();
  const onClose = vi.fn();
  const rect = { left: 40, top: 40, width: 420, height: 320 };
  render(
    <InspectorFrame mode="minimized" rect={rect} dockedWidth={384} onRectChange={vi.fn()} onDockedWidthChange={vi.fn()} onRestore={onRestore} onClose={onClose}>
      <div data-testid="child">c</div>
    </InspectorFrame>,
  );
  fireEvent.click(screen.getByTestId("inspector-min-bar"));
  expect(onRestore).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId("inspector-restore"));
  expect(onRestore).toHaveBeenCalledTimes(2);   // bar click + explicit restore button
  fireEvent.click(screen.getByTestId("inspector-min-close"));
  expect(onClose).toHaveBeenCalledTimes(1);
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

test("mousedown on the drag handle moves the floating frame", () => {
  const onRectChange = vi.fn();
  const rect = { left: 40, top: 40, width: 400, height: 300 };
  render(
    <InspectorFrame mode="floating" rect={rect} dockedWidth={384} onRectChange={onRectChange} onDockedWidthChange={vi.fn()}>
      <div data-inspector-drag-handle>
        <span data-testid="hdr">h</span>
      </div>
      <textarea data-testid="body" />
    </InspectorFrame>,
  );
  fireEvent.mouseDown(screen.getByTestId("hdr"), { clientX: 50, clientY: 50 });
  fireEvent.mouseMove(document, { clientX: 70, clientY: 90 });
  expect(onRectChange).toHaveBeenCalled();
  fireEvent.mouseUp(document);
});

test("mousedown in the panel body does NOT move the floating frame", () => {
  const onRectChange = vi.fn();
  const rect = { left: 40, top: 40, width: 400, height: 300 };
  render(
    <InspectorFrame mode="floating" rect={rect} dockedWidth={384} onRectChange={onRectChange} onDockedWidthChange={vi.fn()}>
      <div data-inspector-drag-handle>
        <span data-testid="hdr">h</span>
      </div>
      <textarea data-testid="body" />
    </InspectorFrame>,
  );
  fireEvent.mouseDown(screen.getByTestId("body"), { clientX: 50, clientY: 50 });
  fireEvent.mouseMove(document, { clientX: 70, clientY: 90 });
  expect(onRectChange).not.toHaveBeenCalled();
  fireEvent.mouseUp(document);
});

test("dragging the resize grip resizes without moving the frame", () => {
  const onRectChange = vi.fn();
  const rect = { left: 40, top: 40, width: 400, height: 300 };
  render(
    <InspectorFrame mode="floating" rect={rect} dockedWidth={384} onRectChange={onRectChange} onDockedWidthChange={vi.fn()}>
      <div data-inspector-drag-handle>h</div>
    </InspectorFrame>,
  );
  fireEvent.mouseDown(screen.getByTestId("inspector-resize-grip"), { clientX: 100, clientY: 100 });
  fireEvent.mouseMove(document, { clientX: 130, clientY: 140 });
  expect(onRectChange).toHaveBeenCalled();
  for (const call of onRectChange.mock.calls) {
    const r = call[0];
    expect(r.left).toBe(40);
    expect(r.top).toBe(40);
  }
  const last = onRectChange.mock.calls[onRectChange.mock.calls.length - 1][0];
  expect(last.width).toBe(430);
  expect(last.height).toBe(340);
  fireEvent.mouseUp(document);
});
