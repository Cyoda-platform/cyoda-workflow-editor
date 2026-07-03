import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Functional (no-screenshot) e2e coverage for the Inspector's dock/float
// placement, driven against the real editor on /editor — mirrors the
// navigation/selection patterns of annotations-lifecycle.spec.ts. Closes the
// gap left by the jsdom component tests (inspectorFrame.test.tsx,
// inspectorDocking.test.tsx), which prove the CSS/state transitions but
// cannot exercise a real Monaco instance surviving the dock <-> float
// round-trip the way a real browser can.

async function gotoEditor(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("editor-page")).toBeVisible();
  await expect(page.getByTestId("workflow-editor-shell")).toBeVisible();
  // Let ELK layout + the one-shot fitView settle before interacting with the graph.
  await expect(page.locator('[data-testid^="rf-state-"]').first()).toBeVisible();
  await expect(page.locator('[data-testid^="rf-edge-label-"]').first()).toBeVisible();
}

/**
 * Selects the `approved -> archived` ("to_archived") transition of the
 * default /editor fixture (document-lifecycle). It is the only transition in
 * that workflow that already carries a criterion (a `lifecycle` criterion),
 * so the inspector renders `inspector-criterion-edit` (expand-in-place)
 * rather than `inspector-criterion-add` — matching the pattern
 * criteria-editor.spec.ts / criterion-delete-key.spec.ts use on /criteria
 * with the "MATCH_MISMATCH" transition.
 */
async function selectArchiveTransition(page: Page) {
  await page
    .locator('[data-testid^="rf-edge-label-"]')
    .filter({ hasText: "to_archived" })
    .first()
    .dispatchEvent("click");
  await expect(page.getByTestId("inspector-transition-delete")).toBeVisible();
}

test("inspector detaches, floats, and preserves Monaco state across dock/float", async ({ page }) => {
  await gotoEditor(page);
  await selectArchiveTransition(page);

  const dockToggle = page.getByTestId("inspector-dock-toggle");
  const frame = page.getByTestId("inspector-frame");

  // Default placement is docked (position: relative, in-flow next to the canvas).
  await expect(frame).toHaveCSS("position", "relative");

  await dockToggle.click(); // detach
  await expect(frame).toHaveCSS("position", "fixed");

  // Expand the criterion inline and type into its real Monaco pane.
  await expect(page.getByTestId("criterion-summary-card")).toBeVisible();
  await page.getByTestId("inspector-criterion-edit").click();
  await expect(page.getByTestId("criterion-editor-modal")).toHaveCount(0);

  const editor = frame.locator(".monaco-editor").first();
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" ");

  await dockToggle.click(); // dock
  await expect(frame).toHaveCSS("position", "relative");

  await dockToggle.click(); // detach again
  await expect(frame).toHaveCSS("position", "fixed");

  // The Monaco pane is still present inside the frame — not remounted away —
  // and still shows the criterion editor still expanded from before.
  await expect(frame.locator(".monaco-editor")).toBeVisible();
  await expect(page.getByTestId("criterion-json-editor")).toBeVisible();
});
