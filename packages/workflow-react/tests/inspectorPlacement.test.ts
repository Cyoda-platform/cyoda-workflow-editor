import { expect, test, beforeEach } from "vitest";
import { clampRect, loadPlacement, savePlacement, placementStorageKey, MIN_FLOAT_W, MIN_FLOAT_H } from "../src/inspector/inspectorPlacement.js";

beforeEach(() => localStorage.clear());

test("clampRect enforces min size and keeps the panel within the viewport", () => {
  const r = clampRect({ left: -50, top: -20, width: 100, height: 100 }, { w: 1000, h: 800 });
  expect(r.width).toBe(MIN_FLOAT_W);
  expect(r.height).toBe(MIN_FLOAT_H);
  expect(r.left).toBe(0);
  expect(r.top).toBe(0);
});

test("clampRect pulls an off-right/bottom panel back inside", () => {
  const r = clampRect({ left: 5000, top: 5000, width: 400, height: 300 }, { w: 1000, h: 800 });
  expect(r.left).toBe(1000 - 400);
  expect(r.top).toBe(800 - 300);
});

test("save/load round-trips under the derived key; null base disables persistence", () => {
  const p = { mode: "floating" as const, rect: { left: 10, top: 20, width: 400, height: 300 } };
  savePlacement("cyoda-editor-layout", p);
  expect(localStorage.getItem(placementStorageKey("cyoda-editor-layout"))).toBeTruthy();
  expect(loadPlacement("cyoda-editor-layout")).toEqual(p);

  savePlacement(null, p);                 // opt-out: no write
  expect(loadPlacement(null)).toBeNull();
});

test("loadPlacement tolerates corrupt storage", () => {
  localStorage.setItem(placementStorageKey("k"), "{not json");
  expect(loadPlacement("k")).toBeNull();
});

test("loadPlacement rejects a shape with a missing/non-numeric rect", () => {
  localStorage.setItem(placementStorageKey("k2"), JSON.stringify({ mode: "floating", rect: {} }));
  expect(loadPlacement("k2")).toBeNull();

  localStorage.setItem(
    placementStorageKey("k3"),
    JSON.stringify({ mode: "floating", rect: { left: "10", top: 20, width: 400, height: 300 } }),
  );
  expect(loadPlacement("k3")).toBeNull();
});

test("round-trips a minimized placement including restoreMode", () => {
  const p = {
    mode: "minimized" as const,
    rect: { left: 10, top: 20, width: 400, height: 300 },
    restoreMode: "floating" as const,
  };
  savePlacement("mkey", p);
  expect(loadPlacement("mkey")).toEqual(p);
});
