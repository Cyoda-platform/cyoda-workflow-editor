---
"@cyoda/workflow-react": patch
---

Dockable/floating, translucent Inspector and roomy inline JSON editing. The
inspector can detach into a draggable, resizable panel that fades when
unfocused so the workflow canvas stays visible. Annotations and transition
criteria now edit inline via a shared word-wrapped, format-capable JSON pane
(`JsonMonacoField`); the canvas-hiding criterion modal is retired. Placement
persists via the existing `localStorageKey` (honoring its `null` opt-out).
No `@cyoda/workflow-core` change and the published `@cyoda/workflow-react` API
(exports and `WorkflowEditor` props) is unchanged — backward-compatible, so a
patch.
