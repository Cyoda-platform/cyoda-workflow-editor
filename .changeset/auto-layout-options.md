---
"@cyoda/workflow-react": minor
"@cyoda/workflow-layout": patch
---

Add a layout-options menu to the canvas: pick auto-layout orientation and density.

The Auto-arrange control now has a companion "Layout options" button that opens a
small menu with **Orientation** (Vertical / Horizontal) and **Density**
(Compact / Comfortable / Roomy). Changing either re-arranges the active workflow
immediately, and the choice is persisted to `localStorage` per editor
(`<localStorageKey>:pref`). Orientation was fully implemented in the layout
engine but previously unreachable from the UI, which hardcoded vertical /
readable. The host `layoutOptions` prop still drives orientation/density when it
changes; the user's menu choice wins until then.

- **`@cyoda/workflow-react`**: new `LayoutOptionsMenu` + persisted layout
  preference wired into the canvas.
- **`@cyoda/workflow-layout`**: remove the unused ELK preset bundles
  (`presets/index.ts`) — dead code the tree-layout engine never consumed (it
  derives spacing directly), so the package no longer advertises layout modes it
  doesn't run.
