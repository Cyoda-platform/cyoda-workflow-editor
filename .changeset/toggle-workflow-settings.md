---
"@cyoda/workflow-react": patch
---

The canvas "Workflow settings" button now toggles the workflow inspector.

Clicking the settings button (bottom of the canvas control stack) while the
workflow inspector is already open now closes it, instead of only ever opening
it. When something else is selected — or nothing — it opens the workflow
inspector as before.
