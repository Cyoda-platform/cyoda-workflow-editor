# Design: processor & criterion annotations + tooltip metadata

**Date:** 2026-07-08
**Status:** Design — pending user review, then implementation plan
**Depends on:** cyoda-go **v0.8.2** (issue #384 / PR #385, releasing today) — schema **1.2**
**Packages:** `@cyoda/workflow-core` (major-class), `@cyoda/workflow-graph`, `@cyoda/workflow-viewer`, `@cyoda/workflow-react`; downstream `cyoda-dev-console`

## Problem

cyoda-go v0.8.2 extends the engine-ignored `annotations` bag — which today exists on
workflow / state / transition — to the two remaining elements, **processors** and
**criteria**, and documents two well-known optional keys, `displayName` and
`description`, uniformly across all five element types. The editor should:

1. **(primary)** enhance the **transition hover tooltip** to show `displayName` /
   `description` (when present) for the transition itself, each of its processors,
   and its criterion (guard).
2. round-trip and **edit** the two new annotation placements.

## Authoritative wire shape (schema 1.2)

Confirmed against PR #385's generated DTOs (`api/generated.go`) and its e2e
round-trip payload (`e2e/parity/workflow.go`). The annotation bag is one open object
everywhere (well-known `displayName` / `description` strings + arbitrary keys;
object-only; ≤ 64 KB compacted). New placements:

```jsonc
{
  "version": "1.2", "name": "wf", "initialState": "S", "active": true,
  "criterionAnnotations": { "displayName": "WF guard" },        // NEW: sibling to workflow.criterion
  "states": { "S": { "transitions": [
    { "name": "t", "next": "S", "manual": true,
      "annotations": { "displayName": "…" },                    // existing (transition)
      "criterionAnnotations": { "displayName": "T guard" },     // NEW: sibling to transition.criterion
      "criterion": { /* opaque, verbatim */ },
      "processors": [
        { "name": "p1", "type": "externalized",
          "annotations": { "displayName": "Proc One" } }        // NEW: embedded on processor
      ]
    }
  ] } }
}
```

- `criterionAnnotations` is a **sibling** field (not nested inside the opaque
  criterion), on **workflow and transition only** (the two elements that own a
  criterion). This keeps the verbatim criterion blob untouched.
- All three new fields are `omitempty` — emitted only when present.
- Schema tag bumps 1.1 → 1.2, **additive and dual-shape** (SupportedSchemaRanges
  1.1–1.2; 1.1 payloads stay valid; the new fields are accepted regardless of tag).

## Core model changes — `@cyoda/workflow-core` (major-class → 0.x `minor`)

Reuse the existing `Annotations` type (`Record<string, unknown>`, `AnnotationsSchema =
z.record(z.string(), z.unknown())`). The well-known keys are a read convention, not a
stricter type.

- **`src/types/processor.ts`**: add `annotations?: Annotations` to `ExternalizedProcessor`.
- **`src/types/workflow.ts`**: add `criterionAnnotations?: Annotations` to `Workflow`
  and `Transition` (sibling to the existing `criterion?`).
- **`src/schema/processor.ts`**: add `annotations: AnnotationsSchema.optional()`.
- **`src/schema/workflow.ts`**: add `criterionAnnotations: AnnotationsSchema.optional()`
  to `WorkflowSchema` and `TransitionSchema`.
- **Normalization** (`src/normalize/input.ts`): preserve the new fields through the
  workflow/transition rebuild (transition is spread today; processor objects and the
  criterionAnnotations sibling must be carried). `normalizeOperatorAlias`
  (`src/parse/operator-alias.ts`) already skips any key named `annotations`; extend
  the skip to `criterionAnnotations` so opaque client data inside it is never aliased.

## Dialect / schema version — `src/dialect/`

**Decision (per project owner): extend the existing `"0.8"` dialect in place — no new
`"0.8.2"` dialect, and no `version`-tag restamp.** Patch-level dialect granularity
isn't warranted: the project has near-zero adoption, 0.8.2 supersedes 0.8.1 (shipping
now), and this exactly follows the precedent the schema-versions doc set for 0.8.1
(*"a single MAJOR.MINOR-keyed dialect can carry the new field safely"*). `"0.8"` now
targets cyoda-go 0.8.2; `LATEST_CYODA_VERSION` and `SUPPORTED_CYODA_VERSIONS` are
unchanged (`["0.7", "0.8"]`).

- Add `annotations` to the 0.8 processor wire-field allowlist, and
  `criterionAnnotations` to the workflow and transition allowlists (ordered next to
  `criterion`) in `src/dialect/cyoda-0_8.ts`.
- Extend the output (`src/normalize/output.ts`) to emit the three new fields when
  present — reuse/extend the existing `OutputOptions.annotations` flag the 0.8 dialect
  already passes. Because all three are `omitempty`, a workflow that uses none of them
  serialises **byte-identically** to today, so nothing changes for non-users.
- The 0.7 dialect continues to omit all annotation fields.
- **`version` tag:** round-trip verbatim (informational; cyoda-go restamps on its own
  export). No `1.1 → 1.2` restamp — it would mutate user data and add diff noise for no
  benefit, since the new fields are additive and accepted under any tag.

Residual risk (accepted): a project pointed at a **0.8.1** server that *adds* one of
the new annotations would get a 400 (`DisallowUnknownFields`). Given traction and the
same-day 0.8.2 release this is a phantom case; if a real 0.8.1 pin ever needs the
guarantee, split a `"0.8.2"` dialect then.

Per `ai/cyoda-schema-versions.md`, add a **v0.8.2 subsection under the `"0.8"` dialect**
(mirroring the existing v0.8.1 subsection) listing the wire changes before merge, and a
**golden round-trip fixture** built from a real export of the released v0.8.2 binary
under `tests/dialect/` or `tests/golden/`.

## Editing — raw-JSON `AnnotationsField` (your chosen UX)

Reuse the existing Monaco JSON `AnnotationsField` (no structured displayName/description
inputs). Two new mount points:

- **Processor annotations** — the processor editor modal (`ProcessorForm.tsx`) edits a
  local `ProcessorDraft` committed on Apply via `addProcessor`/`updateProcessor`. Add
  `annotations` to `ProcessorDraft`, hydrate in `toDraft`, write back in `toProcessor`,
  and mount an `AnnotationsField` in the modal whose `onCommit`/`onRemove` update the
  **draft** (not a dispatch). **No new patch op** — it rides the existing processor
  patch.
- **Criterion annotations** — the criterion editor (`CriterionSection`, mounted in
  `TransitionForm` for transitions and `WorkflowForm` for the workflow criterion). Add
  an `AnnotationsField` bound to `criterionAnnotations`. This is a live document edit,
  so it needs a **patch op**: extend `AnnotationsTarget` (`src/types/patch.ts`) with a
  criterion variant, e.g. `{ kind: "criterion"; host: { kind: "workflow"; workflow } |
  { kind: "transition"; transitionUuid } }`, and handle it in `apply.ts` / `invert.ts`
  (write to `workflow.criterionAnnotations` / `transition.criterionAnnotations`).
  `CriterionSection` dispatches `setAnnotations` with this target.

(Processor annotations do not need an `AnnotationsTarget` variant because they commit
through the processor draft. If a future non-modal processor-annotation edit is wanted,
a `{ kind: "processor"; processorUuid }` target can be added then — YAGNI now.)

## Tooltip — the primary goal

Both `TransitionTooltip.tsx` files (in `packages/workflow-viewer/src/components/` and
`packages/workflow-react/src/components/`) are near-duplicates and both receive the raw
core `Transition` — which, after the model change, carries `criterionAnnotations` and
per-processor `annotations`. So the tooltip reads the data directly; **no graph-projection
change is required**.

- **Dedupe first:** make the react `TransitionTooltip` re-export the viewer component
  (it already imports the viewer theme), so the enhancement is written once.
- **Transition:** if `transition.annotations` has `displayName`, show it as a subtitle
  under the transition name; show `description` below it (muted).
- **Criterion (guard):** in the Criterion section header, show
  `transition.criterionAnnotations.displayName` + `description` when present.
- **Processors:** next to each processor's name in `ProcessorView`, show that
  processor's `annotations.displayName` + `description`.
- Rendering rules: only render a line when the key is a non-empty string; keep the
  tooltip compact (displayName inline/bold, description as a smaller muted line);
  arbitrary non-well-known annotation keys are **not** shown in the tooltip.

Helper: a small `readAnnotationText(annotations, key)` that returns a trimmed string
only when the value is a non-empty string (well-known keys are convention, not
type-enforced).

## Validation

Extend the existing `annotations-too-large` rule (`src/validate/semantic.ts`,
`walkCriteria`/annotation walk) to also check `processor.annotations` and
workflow/transition `criterionAnnotations` (same 64 KB compacted cap), each carrying a
`targetId` so the issues drawer can navigate. No new error code.

## Projection — no change

`TransitionSummary` / `ProcessorSummary` / `CriterionSummary` in `@cyoda/workflow-graph`
need no annotation fields: the tooltip reads the raw transition, and the edge chip does
not surface annotations. (If we later want an annotation indicator on the edge badge,
that would extend the summary — out of scope.)

## Testing

- **Core:** parse→serialize round-trip of a workflow carrying all three new fields under
  the 0.8.2 dialect (byte-identity where the binary's export is byte-stable); the 0.8
  (0.8.1) dialect **omits** them; schema/normalize preserve them; `annotations-too-large`
  fires for oversized processor/criterion annotations with a targetId.
- **Golden:** a real v0.8.2 export fixture (added once the binary releases today).
- **React:** processor modal edits annotations (draft round-trip via `updateProcessor`);
  `CriterionSection` dispatches `setAnnotations` with the criterion target; tooltip shows
  displayName/description for transition/processor/criterion and omits absent/empty keys.

## Versioning & downstream coordination

Major-class (`@cyoda/workflow-core` canonical-model change) → ships as a 0.x **`minor`**.
Coordinated `minor`/`patch` bumps for `-viewer` and `-react` (`-graph` unchanged). Since
the dialect version string is unchanged (`"0.8"`), `cyoda-dev-console` needs **no**
`cyodaGoVersion` union change — the only downstream follow-up is picking up the new
`@cyoda/workflow-*` versions (and the new fields are optional, so nothing breaks). The
changeset documents the three new fields and the extended 0.8 wire output.

## Sequencing

One coordinated change, but landed in this order so each layer is testable:

1. **Core model + schema + normalize** (the three fields round-trip in-memory).
2. **Extend the `"0.8"` dialect (allowlist + emit) + `ai/cyoda-schema-versions.md`
   v0.8.2 subsection** (wire round-trip; golden fixture once the binary is out).
3. **Tooltip** (dedupe + displayName/description) — the primary deliverable.
4. **Editing** (processor modal annotations; criterion-annotations `AnnotationsField`
   + `setAnnotations` criterion target).
5. **Validation** extension + changeset + downstream note.

## Non-goals

- Structured `displayName`/`description` inputs (raw JSON editor chosen).
- Nested/leaf-level criterion sub-condition labelling (guard-level only, matching #384).
- Edge-badge annotation indicators / projection changes.
- Auto-restamping the workflow `version` tag (decided: round-trip verbatim).
- A separate `"0.8.2"` dialect (decided: extend `"0.8"` in place).
