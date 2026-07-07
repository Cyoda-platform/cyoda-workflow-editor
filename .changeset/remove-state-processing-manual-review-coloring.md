---
"@cyoda/workflow-graph": minor
"@cyoda/workflow-viewer": minor
"@cyoda/workflow-react": minor
---

Collapse state coloring to three roles: INITIAL, TERMINAL, and STATE.

The viewer previously derived two extra heuristic categories — `PROCESSING_STATE`
(any outgoing transition carries a processor) and `MANUAL_REVIEW` (every inbound
transition is manual) — and rendered them as distinct blue and purple nodes with
"PROCESSING"/"MANUAL REVIEW" header labels. Those heuristics were semantically
misleading in many workflow shapes, so they are removed. Every non-initial,
non-terminal state now renders in a single blue, and ordinary intermediate states
no longer show a category header row at all (the "STATE" label added nothing the
node shape didn't already convey). INITIAL (green) and TERMINAL (red) are
unchanged. Transition/edge coloring is untouched.

- **`@cyoda/workflow-graph`**: **Breaking:** remove the `category` field from
  `StateNode` and the `computeCategory` export. Consumers that read
  `node.category` should drop it; the visual distinction it fed no longer exists.
- **`@cyoda/workflow-viewer`**: **Breaking:** remove `manualReview` and
  `processing` from the `NodePalette` theme tokens; the `node.default` palette is
  now blue (was teal). `roleCategoryLabel` returns `""` for ordinary states, and
  the renderers omit the header row when the label is empty.
- **`@cyoda/workflow-react`**: **Breaking:** remove the `help.stateProcessing`
  and `help.stateManualReview` i18n message keys; the Help legend no longer lists
  those two swatches.

**Downstream:** audit `cyoda-dev-console` for any use of `StateNode.category`,
the `manualReview`/`processing` `NodePalette` tokens, or the `stateProcessing`/
`stateManualReview` i18n keys before adopting these versions — all now fail to
typecheck. The Cyoda Launchpad `CyodaWorkflowDiagram` renderer needs a matching
palette update (intermediate states changed from teal to blue) to stay visually
identical.
