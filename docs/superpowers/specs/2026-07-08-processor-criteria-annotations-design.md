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

The 0.8 dialect targets cyoda-go 0.8.1, which enforces `DisallowUnknownFields`. The
new fields must **not** be emitted to a 0.8.1 server, but **must** be emitted to 0.8.2.

**Recommended: add a distinct `"0.8.2"` dialect** (`src/dialect/cyoda-0_8_2.ts`) that
composes the 0.8 pass and adds the new-field deltas; keep `"0.8"` (0.8.1) unchanged so
its allowlist strips the new fields. Set `LATEST_CYODA_VERSION = "0.8.2"` and add it to
`SUPPORTED_CYODA_VERSIONS` (`src/dialect/version.ts`). Concretely:

- Extend the wire allowlist for the 0.8.2 dialect: add `annotations` to the
  processor field set, and `criterionAnnotations` to the workflow and transition
  field sets (ordered next to `criterion`).
- Extend `outputWorkflow`/`outputTransition`/processor output
  (`src/normalize/output.ts`) with an `OutputOptions` flag (e.g. extend the existing
  `annotations` flag or add `criterionAnnotations` / `processorAnnotations`) to emit
  the three new fields when present. The 0.8.2 dialect passes them; 0.8/0.7 do not.
- **Schema `version` tag:** the in-document `version` is host/informational and the
  editor round-trips it verbatim (per `ai/cyoda-schema-versions.md`). Because the new
  fields are additive and accepted under any tag, the editor does **not** need to
  restamp `1.1 → 1.2`. (Open question below.)

> **Open decision for the schema maintainer (you):** distinct `"0.8.2"` dialect
> (recommended — keeps 0.8.1 pins safe, follows the runbook) **vs.** just extend the
> `"0.8"` dialect to mean 0.8.2 (simpler; risk only if a project pinned to a 0.8.1
> server adds the new annotations, which would 400). Also confirm whether the editor
> should restamp the emitted `version` tag to `"1.2"`.

Per `ai/cyoda-schema-versions.md`, this file must gain a **v0.8.2 section** listing
the wire changes before merge, and a **golden round-trip fixture** built from a real
export of the released v0.8.2 binary must be added under `tests/dialect/` or
`tests/golden/`.

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
Coordinated `minor`/`patch` bumps for `-graph` (unchanged here, likely none), `-viewer`,
`-react`. Changeset documents the new fields, the 0.8.2 dialect, and the downstream
follow-up in `cyoda-dev-console` (add `"0.8.2"` to its `cyodaGoVersion` union and default
new projects to it once v0.8.2 has released), per the schema-versions runbook step 8.

## Sequencing

One coordinated change, but landed in this order so each layer is testable:

1. **Core model + schema + normalize** (the three fields round-trip in-memory).
2. **0.8.2 dialect + version constants + `ai/cyoda-schema-versions.md` section**
   (wire round-trip; golden fixture once the binary is out).
3. **Tooltip** (dedupe + displayName/description) — the primary deliverable.
4. **Editing** (processor modal annotations; criterion-annotations `AnnotationsField`
   + `setAnnotations` criterion target).
5. **Validation** extension + changeset + downstream note.

## Non-goals

- Structured `displayName`/`description` inputs (raw JSON editor chosen).
- Nested/leaf-level criterion sub-condition labelling (guard-level only, matching #384).
- Edge-badge annotation indicators / projection changes.
- Auto-restamping the workflow `version` tag (pending the open decision above).
