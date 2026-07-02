# Floating inspector + roomy inline JSON editing (annotations & criteria)

**Date:** 2026-07-02
**Packages:** `@cyoda/workflow-react` only (the UI).
**Depends on:** the annotations model + `setAnnotations` patch (`@cyoda/workflow-core` 0.4.0, PR #43) and the existing `setCriterion` patch. **No `workflow-core` / canonical-model change** — so this ships as a `@cyoda/workflow-react` **minor** (0.x convention).
**Status:** Design — approved in brainstorming; awaiting written-spec review.
**Prototype:** validated interactively (dock→float, drag, resize, translucency, word-wrapped inline editing).

## Problem

Editing a node's **annotations** — and, it turns out, its **criteria** — is cramped and, for criteria, hides the workflow you're reasoning about:

- **Annotations** (`inspector/AnnotationsField.tsx:208`) render in a Monaco pane locked to `height: 220`, inside a **fixed-width right rail** (`inspector/Inspector.tsx:54`, `width = 384`, `minWidth: 360`) that only scrolls vertically. With **word-wrap off**, large/nested annotation JSON is both vertically cramped (~11 lines) *and* horizontally clipped — widening the rail (which is already possible) doesn't help because content clips instead of reflowing.
- **Criteria** (`inspector/CriterionForm.tsx`) show only a 140-char summary card in the rail and open a **canvas-hiding modal** (`CriterionEditorModal`, up to 760×760px) to edit. The modal solved "narrow rail → room" but at the cost of covering the workflow graph while you edit.

Both problems share one root cause: **a big editing surface currently has to either fit the narrow rail or cover the canvas.** The fix is to let the surface get bigger *without* covering the canvas.

## Governing principles (unchanged from the annotations spec)

1. **Ride the existing edit/save model — no special-casing.** Every edit is a patch (`setAnnotations` / `setCriterion`) → a new in-memory `WorkflowEditorDocument`, undoable, surfaced in the Save diff, persisted only on explicit Save. This design adds **zero** new persistence paths.
2. **No canonical-model change.** All work is in `@cyoda/workflow-react`. The `setCriterion` and `setAnnotations` patch ops already exist and are unchanged.
3. **Keep the Monaco-or-`<textarea>` split.** Monaco is host-injected via `useCriterionMonaco()`; when absent, fall back to `<textarea>`. Both new/changed editors preserve this.

## Design

Four pieces.

### 1. Placement layer — a dockable / floating inspector

The inspector gains a **placement mode**: `docked` (default) or `floating`. This lives in the editor shell (`components/WorkflowEditor.tsx`), which already owns the rail mount (`WorkflowEditor.tsx:1065-1093`), the `col-resize` width handle + `handleInspectorResizeStart` (`:277-291`), the `inspectorWidth` state (`:205`), and the simulated-fullscreen CSS trick (`:924`).

**Docked (default).** Exactly today's behavior: a `position: relative`, width-resizable right rail. Unchanged.

**Floating.** The inspector renders as a `position: fixed` panel over the canvas:
- **Move:** drag the header region to reposition. Pointer handlers mirror `handleInspectorResizeStart` (mousedown → track delta → clamp). Ignore drags that start on a header button.
- **Resize:** a bottom-right (at minimum) resize grip adjusts width/height, with a **min size** (~340×260) and a **viewport clamp** so it can't be dragged/resized fully offscreen. Corner/edge affordances beyond the single grip are a nice-to-have, not required for v1.
- **Translucency = the "get out of the way / focus" mechanism (the only focus behavior chosen).** The floating panel is **~55% opaque by default and snaps to 100% on `:hover` / `:focus-within`** (and while grabbed), with a short opacity transition gated by `prefers-reduced-motion`. This single rule covers all three of the user's asks — move around, see the canvas *through* it, pull it into focus — with no z-order buttons, minimize state, or snap-docking to manage. It is **translucent, not click-through**: keep `pointer-events` fully live at any opacity; only visual opacity changes, never hit-testing.
  - **`:focus-within` must survive Monaco's popup widgets.** Monaco renders suggestion/hover/parameter-hint widgets in an overlay layer that can be portaled *outside* the editor DOM; if it escapes the panel subtree, `focus-within` drops and the panel would fade **mid-type**. Verify during implementation and, if needed, hold opacity while the pane has an *active* editor (track focus/blur on the Monaco instance) rather than relying on CSS `:focus-within` alone.
- **Toggle:** a **detach / dock** button in the inspector header (beside the existing `×` close, `Inspector.tsx:99-123`) flips the mode.

**State & persistence.** Placement mode + floating rect (`{left, top, width, height}`) are React state in `WorkflowEditor`, kept across dock/undock so re-detaching returns the panel to where it last was within a session. **Persisted across reloads via localStorage**, written on `pointerup`, restored-rect clamped to the current viewport. **Reuse the editor's existing persistence channel** — `WorkflowEditor` already threads a `localStorageKey` prop and honors `localStorageKey === null` as a host opt-out (`WorkflowEditor.tsx:92, 184, 254`); store placement as a *namespaced field under that same key* and obey the same `null` disable, rather than inventing a separate always-on key. The read/write stays `try/catch`-guarded: when storage is unavailable — a browser blocking/partitioning storage for the dev-console's embedding iframe, SSR, or a host opt-out — it **degrades silently to in-memory** (i.e. exactly the non-persisted behavior). On first detach with nothing stored, seed the rect from the current docked width and a sensible height.

**Structure.** Introduce a thin `InspectorFrame` (or inline wrapper in `WorkflowEditor`) that owns mode/rect/drag/resize/translucency and renders `<Inspector>` as its child. `Inspector.tsx` stays the *content* (forms, tabs, breadcrumb) and is largely untouched aside from the header toggle button. This keeps the placement concern isolated and testable.

> **Hard requirement — dock↔float must NOT remount `<Inspector>`.** The Monaco panes inside carry live editor state (cursor, scroll, undo history, unapplied buffer). If the frame renders two *different* branches (`floating ? <Float><Inspector/></Float> : <Dock><Inspector/></Dock>`), React reconciliation tears down and recreates the whole subtree on every toggle → Monaco disposed and rebuilt, edits lost. The frame MUST be **one stable wrapper element at a fixed tree position** whose *style* flips between `position: relative` (docked) and `position: fixed` (floating); `<Inspector>` keeps the same element identity across toggles. This single detail is the difference between the feature feeling solid and losing your edit every time you detach — treat it as an acceptance criterion, with a test.

> **Keep the panel in-tree, not portaled.** The editor's undo/redo/Ctrl+S are React `onKeyDown` handlers on the editor root (`WorkflowEditor.tsx:929-930`); the delete guard is both a React capture handler and a `document`-capture listener (`:703-727`). Portaling the floating panel to `document.body` would stop keydowns from bubbling to the root React handlers → Ctrl+Z/Y/S dead while focused in the panel. Render it **in-tree** so event routing is unchanged. Caveat: a `position: fixed` descendant is positioned relative to the nearest ancestor with a `transform`/`filter`/`will-change` (it establishes a containing block) — confirm no such ancestor sits between the frame and the viewport, or the "fixed" panel won't be viewport-relative.

**Coexistence & stacking.** The editor's simulated fullscreen (`WorkflowEditor.tsx:924`, `position:fixed; inset:0; zIndex:9999`) and the global key handler (which already bails when a Monaco pane / `<textarea>` is the typing target via `isTypingTarget`, `:128-140`, so document undo/redo + Ctrl+S don't fire mid-edit) both continue to work; floating is just an alternate container for the same inspector. Because floating is `position:fixed`, define the **z-index relationships explicitly**: canvas < floating inspector < the app's blocking modals (`ModalFrame`: AddState / DeleteState / DragConnect / Help / VersionSwitch, `:1095-1136`). The floating inspector sits inside the editor root, so it inherits the fullscreen container's stacking context automatically; give it a z-index above the canvas but below `ModalFrame`, so an open modal always covers it.

**Accessibility.** The toggle is a real `<button>`. Docked mode remains fully keyboard-operable. Coarse-pointer/touch devices have no `:hover`: treat the floating panel as **always opaque on coarse pointers** (via `@media (hover: none)`) so it never gets stuck faded. Keyboard-driven move/resize is out of scope for v1 (documented limitation) — the panel can always be re-docked to regain full keyboard flow.

### 2. `JsonMonacoField` — the shared JSON pane primitive

Extract the runtime-or-textarea JSON pane that `CriterionJsonEditor` and `AnnotationsField`'s `MonacoJsonPane` currently duplicate into one primitive (the annotations spec already anticipated this as `JsonMonacoField`).

**Props (shape):**
```
buffer: string                 // controlled text
disabled: boolean
modelKey: string               // remount identity
modelUri: string               // e.g. cyoda://annotations/<t>.json | cyoda://criterion/<t>.json
onChange: (text: string) => void
registerSchema?: (monaco) => Disposable   // criterion passes registerCriterionSchema; annotations passes none
seed?: string                  // controlled re-seed input for the inline three-way sync (Monaco setValue without echo)
```

**Behavior baked in (the readability wins):**
- **`wordWrap: "on"`** — the single biggest fix; long strings reflow instead of clipping. (Textarea fallback wraps natively.)
- **Format action** — a small "Format" control that runs Monaco's format-document (JSON) — or `JSON.parse`→`stringify(_, 2)` for the textarea path — re-indenting without changing meaning.
- **Grow-to-content up to a cap** — replace the hard-coded `220`/`320` px with a height that fits content up to a cap (then the pane scrolls internally). In a tall floating panel there's simply more room before the cap bites.
- Preserves the `automaticLayout`, `minimap: false`, `theme: "vs"` options and the Monaco cancellation-filter / disposal safety already used.

`CriterionJsonEditor` keeps its criterion-specific glue (`registerCriterionSchema`, `parseCriterionJson`, `criterionModelUri`) but delegates the pane to `JsonMonacoField`.

### 3. Annotations — adopt the primitive

Swap `AnnotationsField`'s bespoke `MonacoJsonPane` (`AnnotationsField.tsx:150-211`) for `JsonMonacoField`. Its buffer / three-way-sync / Apply-Revert-Remove lifecycle (`:59-147`) is already correct for an inline pane and stays; it simply gains word-wrap, Format, and flexible height, and drops the fixed 220.

### 4. Criteria — move inline, retire the modal

A new inline `CriterionField` **reuses `AnnotationsField`'s edit lifecycle** (buffer, three-way sync, Apply/Revert/Remove) so criteria edit in place with the canvas visible — but wraps it in a compact preview that expands on demand (see below):
- **Absent** → the existing "Add" affordance, preserving the current **type default** flow (`defaultCriterion(...)`, default `simple`) and the **automated-criterion warning** (`criterion.noneAutomatedWarning`).
- **Present → compact preview, expand-to-edit (lazy Monaco).** Keep the existing summary card (type **badge** + the ~140-char JSON preview) as the resting state; an **Edit / expand** control reveals the inline `JsonMonacoField` (with `registerCriterionSchema` + `criterionModelUri`) plus **Apply / Revert / Remove**, and collapse returns to the preview. **Rationale — avoid double Monaco:** a selected transition commonly has *both* a criterion and annotations; mounting the criterion editor eagerly would keep **two heavyweight Monaco instances live at once**, recreated on *every* transition selection (forms are keyed on `transitionUuid`, `Inspector.tsx:169`). Lazy expand-on-demand means the criterion Monaco exists only while you're actually editing — the same lifetime as today's modal, just inline and non-blocking. (Annotations keep their current always-open-when-present behavior — typically the lone editor; the two-Monaco case is then only the transient "editing both at once," which is acceptable.)
- **Inline three-way sync is required.** `CriterionJsonEditor` today *pins text on mount* (`CriterionJsonEditor.tsx:24-25`) — safe only because the modal remounts on each open. Inline, the field must track the document like annotations do: echo-apply is a no-op, external change with a clean buffer re-seeds, external change with a dirty buffer is kept with a "document changed" note. Reuse the exact rule annotations implements. **Compare on the validated/normalized value** (the parsed `result.criterion`, mirroring how annotations compares parsed values via `sameJson` in `annotationsJson.ts`) — never on buffer text, so key-ordering / pretty-print differences don't read as changes.
- **Transition host only (scope correction).** In practice `CriterionSection` is mounted **only** in `TransitionForm.tsx` and always with a `kind:"transition"` host — so the inline field only ever addresses the transition criterion via `setCriterion({ host:{kind:"transition",…}, path:["criterion"] })`, which needs no core change. Note the boundaries: `setCriterion` for `processorConfig` is an explicit **no-op in `apply.ts` (`:214-217`)**, and **workflow-level** criteria use a *different* op (`setWorkflowCriterion`) and aren't wired to `CriterionSection` at all. Neither is in scope here (both would require `workflow-core` work).
- **Reconcile BOTH reselect paths.** There are two, and the modal's is the lesser: the **primary** is a dispatch-level intercept in `WorkflowEditor.tsx:305-323` that, on *every* transition `setCriterion`, sets `pendingSelectionRestoreRef` and schedules a `setTimeout(50)` `setSelection`. The transition UUID is preserved across `setCriterion` (synthetic ids reuse it), so `TransitionForm`'s key is stable and it won't remount — good — but that deferred reselect becomes pointless mid-edit churn / focus wobble on every inline Apply/Remove. Reconcile it together with the redundant `CriterionEditorModal.onApplied` (`CriterionForm.tsx:77-88`) and `removeCriterion` (`:51-55`) reselects; don't remove only the modal one.

`CriterionEditorModal` and the modal-open path retire. `CriterionSection`/`CriterionSummaryCard` become the preview-plus-expand field above (Add-when-absent / preview+expand-when-present), keeping its badge + warning.

### Data flow & save integration — nothing special

`Field (buffer + validate) → onCommit/onRemove → setAnnotations|setCriterion patch → applyPatch → new document → field re-seeds from updated value`. Undo/redo and whole-config JSON edits re-seed the panes the same way. Persistence only via the standard, gated Save. The Save diff, error-gating (`errorCount`), and optimistic concurrency all apply unchanged.

## Files touched

- `components/WorkflowEditor.tsx` — placement state, drag/resize/translucency, detach/dock wiring; reconcile the dispatch-level `setCriterion` reselect (`:305-323`) with the new inline field.
- `components/InspectorFrame.tsx` *(new)* — floating/docked container (or an inline wrapper if kept in `WorkflowEditor`).
- `inspector/Inspector.tsx` — header **detach/dock** button; otherwise unchanged.
- `inspector/JsonMonacoField.tsx` *(new)* — shared pane primitive.
- `inspector/AnnotationsField.tsx` — use `JsonMonacoField`; drop fixed height.
- `inspector/CriterionJsonEditor.tsx` — delegate pane to `JsonMonacoField`.
- `inspector/CriterionField.tsx` *(new)* + `inspector/CriterionForm.tsx` — inline editing; **remove `CriterionEditorModal`**.
- `style/tokens.ts` / `i18n/en.ts` — labels for detach/dock/Format (there is only `en.ts` under `src/i18n/`); dedupe the button styles `AnnotationsField` currently redefines.

## Out of scope

- Multi-dock (left / bottom edges); only docked-right ↔ floating.
- Send-behind (z-order), minimize-to-pill, snap-to-edge — **translucency replaces all of these.**
- Keyboard-driven move/resize of the floating panel.
- Graph badges / at-a-glance annotation-presence indicators.
- Structured/schema-driven forms for annotation *contents* (opaque); annotations remain object-only via the Apply gate, no Monaco schema.
- **Workflow-level and processor-config criteria editing.** Inline criteria is **transition-host only** (the only place `CriterionSection` is mounted). Workflow-level criteria use a different op (`setWorkflowCriterion`) and aren't wired to a form; `processorConfig` `setCriterion` is a no-op in apply. Wiring either would need a `workflow-core` change and is deliberately out of scope.
- Any `workflow-core` change.

## Known limitations / accepted trade-offs

- **Touch / coarse pointers** have no hover, so translucency is disabled there (always opaque) — no fade-to-reveal on touch. Acceptable; docked mode is the touch-friendly default.
- **Floating panel is not keyboard-movable in v1.** Re-dock to regain full keyboard operation.
- **Retiring the criterion modal changes established, tested behavior.** Migrate its tests to the inline field; consumers (dev-console) get inline criteria editing on upgrade — same edit/save semantics, different surface. The Backspace/Delete → delete-transition regression the modal used to shield (`criterion-delete-key.spec.ts`) is *more* exposed inline, so the `isTypingTarget` guard (`WorkflowEditor.tsx:128-140`) must be re-verified against the inline Monaco pane.
- **Cross-reload persistence is best-effort.** localStorage is `try/catch`-guarded; when a host blocks/partitions storage, placement silently resets to docked on the next reload — the same outcome as having no persistence, so no downside.
- **Unapplied buffer lost on node switch** — unchanged from today (forms remount per selection); mitigated by the visible dirty state.

## Testing

**`JsonMonacoField`** — word-wrap on; Format on valid + invalid input; grow-to-content up to cap; textarea fallback in jsdom; `registerSchema` invoked when provided and not otherwise; `seed` re-seed pushes into the model without echoing.

**Annotations** — existing `AnnotationsField` tests pass unchanged after the pane swap.

**Criteria (inline)** — Add dispatches `setCriterion(defaultCriterion)`; expand mounts the Monaco pane, collapse disposes it (assert the lazy lifetime — not eagerly mounted alongside annotations); Apply enabled only when valid + dirty; invalid (bad JSON / schema) disables Apply with the error shown; Revert restores; Remove dispatches `setCriterion(undefined)`; three-way sync (echo no-op, clean re-seed, dirty kept — comparing on parsed values); automated-criterion warning when absent; type badge when present. **Transition host only** (drop the workflow/processorConfig cases — unreachable). Remove the `CriterionEditorModal` tests; add inline equivalents. **Migrate the Playwright specs that drive the modal** — `apps/docs-embed-demo/tests/visual/criteria-editor.spec.ts` and `criterion-delete-key.spec.ts` (they click `inspector-criterion-edit` / assert `criterion-editor-modal`) — to the inline field, and keep the delete-key regression assertion.

**Placement** — detach sets floating + seeds a rect; dock restores docked; **Monaco survives dock↔float** (same element identity: cursor/scroll/unapplied buffer preserved across a toggle — the make-or-break test); drag updates position within the viewport clamp; resize respects min size; translucency toggles on hover / focus-within / grabbed and holds opaque while the Monaco pane has focus; coarse-pointer media query forces opaque; an open `ModalFrame` covers the floating inspector. Persisted placement round-trips through the existing `localStorageKey` and is disabled when that key is `null`. Add an interaction test to `apps/docs-embed-demo` alongside the existing `tests/visual/annotations-lifecycle.spec.ts` driving real Monaco.

## Scope / release

`@cyoda/workflow-react` **minor** (0.x convention). No `workflow-core` change. Add a Changeset. The dev-console picks up the floating inspector + inline criteria editing on upgrade.
