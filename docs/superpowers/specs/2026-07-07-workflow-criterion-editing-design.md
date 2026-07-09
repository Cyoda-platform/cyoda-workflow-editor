# Design: edit a workflow-level criterion

**Date:** 2026-07-07
**Status:** Approved (design), pending implementation plan
**Packages:** `@cyoda/workflow-core`, `@cyoda/workflow-react`

## Problem

A workflow can carry a top-level `criterion` (`Workflow.criterion?: Criterion`),
which the platform uses to decide whether a given workflow applies to an entity.
When multiple workflows target the same entity model, the criterion is what
disambiguates which one is selected — without it the system has no basis to
choose. The criterion already exists in the canonical model and round-trips
through parse/serialize, but **there is no way to add, edit, or remove it in the
editor UI.** The inspector's `WorkflowForm` exposes name / version / description
/ active / initial-state / annotations, but no criterion.

## Goal & scope

Let a user **add / edit / remove the criterion on a workflow** from the
inspector, reusing the existing criterion-editing machinery (Monaco JSON editor,
live schema validation, three-way sync, add/edit/remove affordances).

**In scope:** the editing UI, plus removal of a redundant dead patch op exposed
by this work.

**Out of scope:** any new validation rule (e.g. warning when multiple
same-entity workflows lack disambiguating criteria). That is a separate,
deferred concern.

## Background: two ops, one of them dead

Two core patch ops can set a workflow's criterion:

1. `setCriterion { host: HostRef; path; criterion? }` — the **general, living**
   op. Its `HostRef` union explicitly models `{ kind: "workflow"; workflow }`
   (`types/editor.ts:60`) as a first-class host, alongside `transition` and
   `processorConfig`. It is the only criterion op with producers: dispatched by
   the shared `CriterionSection` (`inspector/CriterionForm.tsx:31-32`), covered
   by `tests/criterionInline.test.tsx`, and special-cased in
   `components/WorkflowEditor.tsx:346`. `apply` (`patch/apply.ts:207`), `invert`
   (`patch/invert.ts:175`, via `readCriterionAt`), and the reducer already
   handle the workflow host end to end.

2. `setWorkflowCriterion { workflow; criterion? }` — an **orphaned** flat op.
   Grep across all packages finds it only in its type definition
   (`types/patch.ts:22`), its `apply` case (`patch/apply.ts:62-71`), its
   `invert` case (`patch/invert.ts:49-55`), and one undo-label string
   (`workflow-react/src/state/store.ts:32-33`). **Nothing dispatches it** — no
   component, no test, no helper. The polymorphic `setCriterion` fully subsumes
   it.

This duplication is the code smell. The resolution is to standardise on the
living, tested `setCriterion` path and **delete the dead `setWorkflowCriterion`
op**.

## Core changes — `@cyoda/workflow-core`

Deletion plus one polish; no new apply/invert logic is required (the workflow
host is already supported).

- Remove the `setWorkflowCriterion` union member from `DomainPatch`
  (`types/patch.ts:22`).
- Remove its `apply` case (`patch/apply.ts:62-71`).
- Remove its `invert` case (`patch/invert.ts:49-55`).
- Confirm no remaining references (types, tests, helpers). It has zero
  producers, so removal is safe.

Removing a member of the exported `DomainPatch` union is a public-API change →
breaking-class, shipped as a 0.x `minor` per the repo versioning policy.

## React changes — `@cyoda/workflow-react`

### a. Mount the editor in `WorkflowForm`

`inspector/WorkflowForm.tsx` already receives `workflow`, `disabled`, and
`onDispatch`. Add a criterion section immediately after the annotations block
(`WorkflowForm.tsx:83-93`):

```tsx
<CriterionSection
  host={{ kind: "workflow", workflow: workflow.name }}
  criterion={workflow.criterion}
  disabled={disabled}
  onDispatch={onDispatch}
/>
```

`CriterionSection` (`inspector/CriterionForm.tsx`) already computes a workflow
model key (`host-${workflow}`) and dispatches `setCriterion` with the given
host and `path: ["criterion"]`. No change to its dispatch logic is needed.

### b. Host-appropriate empty-state copy

`CriterionField`'s "no criterion" state currently renders **transition**
semantics: `props.manual ? m.noneManual : m.noneAutomated`, plus a
`noneAutomatedWarning` ("this automated transition will always fire…") when not
manual (`inspector/CriterionField.tsx:27-40`). That copy is wrong and
misleading for a workflow.

Make the empty-state text **injectable** rather than hard-coded, and show an
always-visible caption above the field for the workflow host. To avoid
duplicated copy, the purpose explanation lives in **one** place — the caption —
and the empty state carries only a short "none set" line:

- Add an optional prop `emptyText?: string` to `CriterionField`. When supplied,
  it replaces the transition-flavoured empty text *and* suppresses the
  transition-specific automated warning. Existing transition callers omit it and
  keep today's behaviour.
- `CriterionSection` branches on `host.kind`: for a workflow host it renders the
  caption above the field and passes `emptyText`; otherwise it renders neither
  and the transition defaults apply.
- New i18n keys under `criterion` in `i18n/en.ts`, wording approved:
  - `workflowCaption` (always shown above the field): "Determines whether this
    workflow applies to an entity of its model — set one to disambiguate when
    several workflows target the same model."
  - `workflowNone` (empty-state line): "No workflow criterion set."

This addresses the disambiguation purpose in the UI copy without introducing a
validation rule.

Rationale for injectable props over a `variant: "workflow" | "transition"`
flag: it keeps `CriterionField` a dumb presentational component with no
knowledge of host kinds; the host→copy mapping lives once, in `CriterionSection`.

### c. Host-aware undo label

Update the `setCriterion` summary in `state/store.ts:58` so a workflow host reads
"Set workflow criterion" / "Clear workflow criterion", and other hosts keep the
generic "Set criterion" / "Clear criterion". Then remove the now-dead
`setWorkflowCriterion` summary case (`store.ts:32-33`). This preserves the one
nicety the deleted op had.

### d. No reselect change

`components/WorkflowEditor.tsx:346` special-cases post-dispatch reselect only for
`host.kind === "transition"`. A workflow-host `setCriterion` falls through and
the workflow remains selected — the correct behaviour. No change needed.

## Data flow

- **Add** → `CriterionField` seeds `defaultSimpleCriterion()` → `onCommit` →
  `setCriterion { host: { kind: "workflow", workflow }, path: ["criterion"],
  criterion }` → `apply` sets `wf.criterion`.
- **Edit** → Monaco buffer → validated by `parseCriterionJson` (`CriterionSchema`
  + `criterionBlockingError`, unchanged) → `onCommit` as above.
- **Remove** → `onRemove` → `setCriterion { …, criterion: undefined }` → `apply`
  deletes `wf.criterion`.
- **Undo/redo** → existing `invert` for `setCriterion` (workflow host supported).
- **Serialize** → `outputWorkflow` already emits `workflow.criterion`
  (`normalize/output.ts:39`); round-trips today.

## Components & boundaries

- `CriterionField` — presentational: renders empty/edit states, Monaco field,
  validation gating, apply/revert/remove. Gains injectable empty-state copy.
  Depends on nothing host-specific.
- `CriterionSection` — host adapter: maps a `HostRef` to a model key, dispatch,
  and (new) host-appropriate copy. Single place that knows "workflow vs
  transition".
- `WorkflowForm` — composition: mounts `CriterionSection` with a workflow host.

## Testing

**Core (`@cyoda/workflow-core`):**
- `setCriterion` with a workflow host: `apply` sets `wf.criterion`; `invert`
  restores the prior value / clears when there was none; parse→edit→serialize
  round-trips.
- Guard that `setWorkflowCriterion` is gone: no runtime references; the
  `DomainPatch` union no longer includes it (type-level).

**React (`@cyoda/workflow-react`):** mirror `tests/criterionInline.test.tsx`
for `WorkflowForm`:
- Selecting a workflow shows the criterion section.
- The empty state shows the workflow copy (caption `workflowCaption` +
  `workflowNone`), not the automated-transition warning.
- "Add" dispatches `setCriterion` with `host.kind === "workflow"`.
- Invalid JSON disables Apply; valid JSON commits.
- "Remove" dispatches `criterion: undefined`.

## Versioning & downstream

- Ships as a 0.x `minor` for `@cyoda/workflow-core` (public op removed) and
  `@cyoda/workflow-react` (new UI + i18n keys + store summary).
- Changeset documents the `setWorkflowCriterion` removal and flags a downstream
  check: confirm `cyoda-dev-console` does not construct `setWorkflowCriterion`
  (nothing in this repo ever did).

## Non-goals / deferred

- Validation warning for same-entity workflows lacking disambiguating criteria.
- Any change to transition or processor-config criterion editing.
- The `Selection` type's reserved `{ kind: "criterion"; hostKind: "workflow" }`
  variant — not needed; the workflow criterion is edited inline in
  `WorkflowForm`, mirroring how transitions edit theirs inline.
