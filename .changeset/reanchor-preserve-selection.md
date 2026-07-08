---
"@cyoda/workflow-react": patch
---

Don't pop the inspector open when re-anchoring a transition.

Dragging a transition's endpoint (arrowhead) to a different anchor is a layout
tweak, but it was selecting the transition and opening the inspector. Two
causes, both fixed:

- **Trailing click after reconnect (primary):** the guard that suppresses
  edge/node clicks during a reconnect was cleared in `onReconnectEnd`, which
  fires *before* the browser's trailing `click` — so `onEdgeClick` ran with the
  guard already down and selected the transition. The guard is now cleared on
  the next macrotask (after the trailing click), and `onNodeClick` honours it
  too (a drop onto a node no longer selects the state).
- **Selection stealing on a completed re-anchor:** a pure re-anchor transaction
  set `selectionAfter` to the transition, snapping the inspector off whatever
  you had selected. It now preserves the current selection; only moving the
  endpoint to a different target state selects the transition.

Genuine clicks on a transition still select it.
