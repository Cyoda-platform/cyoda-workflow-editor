---
"@cyoda/workflow-core": minor
"@cyoda/workflow-viewer": minor
"@cyoda/workflow-react": minor
---

Support cyoda-go 0.8.2 processor & criterion annotations, and surface them in the transition tooltip.

- **`@cyoda/workflow-core`**: add `annotations` to processors and `criterionAnnotations`
  (sibling to `criterion`) on workflows and transitions; the 0.8 dialect emits them
  (`omitempty`, so workflows that don't use them serialise byte-identically), extended
  in place — `LATEST_CYODA_VERSION` stays `"0.8"`. `setAnnotations` gains
  `workflowCriterion`/`transitionCriterion` targets; `annotations-too-large` covers the
  new placements.
- **`@cyoda/workflow-viewer` / `@cyoda/workflow-react`**: the transition hover tooltip
  shows the well-known `displayName`/`description` annotation keys for the transition,
  its criterion, and each processor; the raw-JSON annotations editor is available for
  processor annotations (modal) and criterion annotations.
