---
"@cyoda/workflow-react": patch
---

Don't steal inspector selection when re-anchoring a transition.

Dragging a transition's endpoint to a different anchor on the same connection
(a layout tweak) previously forced the selection onto that transition, so the
inspector would snap away from whatever you were working on. A pure re-anchor
now preserves the current selection; only moving the endpoint to a different
target state (a structural edit) selects the transition, as before.
