---
"@cyoda/workflow-react": patch
---

Dockable/floating Inspector and roomy inline JSON editing. The inspector can
detach into a draggable, resizable window with classical controls — minimize
(collapses to a bar in the bottom-right corner), dock/undock, and close — so
the workflow canvas can stay fully visible. Annotations and transition criteria
now edit inline via a shared word-wrapped, format-capable JSON pane
(`JsonMonacoField`); the canvas-hiding criterion modal is retired. Placement
(including the minimized state) persists via the existing `localStorageKey`
(honoring its `null` opt-out). No `@cyoda/workflow-core` change and the
published `@cyoda/workflow-react` API (exports and `WorkflowEditor` props) is
unchanged — backward-compatible, so a patch.
