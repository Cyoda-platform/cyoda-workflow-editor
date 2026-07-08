---
"@cyoda/workflow-core": minor
"@cyoda/workflow-react": minor
---

Add workflow-level criterion editing and remove the redundant `setWorkflowCriterion` patch op.

The workflow inspector (`WorkflowForm`) now lets you add, edit, and remove a
workflow's `criterion` using the same Monaco JSON editor, live validation, and
add/edit/remove affordances as transition criteria — dispatched through the
existing host-based `setCriterion` op with a `{ kind: "workflow" }` host. A
caption explains that the criterion decides whether the workflow applies to an
entity of its model (disambiguating when several workflows target the same
model), and the empty state shows workflow-appropriate copy instead of the
transition "automated" warning.

- **`@cyoda/workflow-core`**: **Breaking:** remove the unused
  `setWorkflowCriterion` member of `DomainPatch` (and its apply/invert cases).
  It had no producers; the general `setCriterion` op already supports a workflow
  host for both apply and undo/invert. Consumers constructing
  `setWorkflowCriterion` should switch to
  `{ op: "setCriterion", host: { kind: "workflow", workflow }, path: ["criterion"], criterion }`.
- **`@cyoda/workflow-react`**: add the workflow criterion section to
  `WorkflowForm`; add `criterion.workflowCaption` / `criterion.workflowNone`
  i18n keys; the `setCriterion` undo label is now host-aware
  ("Set workflow criterion").

**Downstream:** confirm `cyoda-dev-console` does not construct
`setWorkflowCriterion` (nothing in this repo did).
