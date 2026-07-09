# Processor & Criterion Annotations + Tooltip Metadata — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Round-trip and edit the cyoda-go 0.8.2 (`#384`) `processor.annotations` and workflow/transition `criterionAnnotations` fields, and surface their `displayName`/`description` in the transition hover tooltip.

**Architecture:** Add three optional `Annotations` fields to the canonical model; extend the existing `"0.8"` dialect (no new dialect) to allowlist + emit them; read them in the transition tooltip (no projection change); edit them with the existing raw-JSON `AnnotationsField` (processor via modal draft, criterion via a new `setAnnotations` target).

**Tech Stack:** TypeScript, Zod, React, Vitest (+ Node 20 for `@cyoda/workflow-react`), pnpm workspaces, Changesets. Released reference binary: `cyoda` 0.8.2 (`/opt/homebrew/bin/cyoda`).

**Spec:** `docs/superpowers/specs/2026-07-08-processor-criteria-annotations-design.md`

## Global Constraints

- **Schema shape (verbatim from released v0.8.2):** annotation bag = open JSON object, well-known keys `displayName`/`description` (strings, advisory), object-only, ≤ 64 KB compacted. Placements: `processor.annotations` (embedded); `criterionAnnotations` sibling to `criterion` on **workflow and transition only**; all `omitempty`.
- **Dialect:** extend `"0.8"` in place. `LATEST_CYODA_VERSION`/`SUPPORTED_CYODA_VERSIONS` unchanged (`["0.7","0.8"]`). No `version`-tag restamp (round-trip verbatim). `omitempty` ⇒ a workflow using none of the new fields serialises **byte-identically** to today; the 0.7 dialect omits all annotation fields.
- **Editing UX:** reuse the raw-JSON `AnnotationsField` (no structured displayName/description inputs).
- **Versioning:** canonical-model change ⇒ major-class ⇒ 0.x **`minor`** for `@cyoda/workflow-core`; coordinated `minor` for `-viewer` and `-react`. `-graph` unchanged. No `cyoda-dev-console` version-union change (dialect string unchanged).
- **Node:** run `@cyoda/workflow-react` Vitest on Node 20 (`export PATH="$(brew --prefix node@20)/bin:$PATH"`).
- **`Annotations` type** is `Record<string, unknown>`; `AnnotationsSchema` is `z.record(z.string(), z.unknown())`. Reuse both.

---

## File Structure

- `packages/workflow-core/src/schema/annotations.ts` — **new**; hoist `AnnotationsSchema` here to avoid a workflow↔processor schema import cycle.
- `packages/workflow-core/src/schema/workflow.ts` — re-export `AnnotationsSchema` from the new file; add `criterionAnnotations` to `WorkflowSchema` + `TransitionSchema`.
- `packages/workflow-core/src/schema/processor.ts` — add `annotations` to `ExternalizedProcessorSchema`.
- `packages/workflow-core/src/types/processor.ts` — add `annotations?: Annotations` to `ExternalizedProcessor`.
- `packages/workflow-core/src/types/workflow.ts` — add `criterionAnnotations?: Annotations` to `Workflow` + `Transition`.
- `packages/workflow-core/src/parse/operator-alias.ts` — skip `criterionAnnotations` (as it skips `annotations`).
- `packages/workflow-core/src/dialect/cyoda-0_8.ts` — allowlist the three new fields.
- `packages/workflow-core/src/normalize/output.ts` — emit the three new fields under the `annotations` output flag.
- `packages/workflow-core/src/types/patch.ts` — extend `AnnotationsTarget` with criterion variants.
- `packages/workflow-core/src/patch/apply.ts` / `invert.ts` — handle the criterion targets.
- `packages/workflow-core/src/validate/semantic.ts` — extend `annotations-too-large` to processor + criterion annotations.
- `packages/workflow-viewer/src/components/TransitionTooltip.tsx` — annotation display + shared `readAnnotationText`/`AnnotationLines` helper.
- `packages/workflow-react/src/components/TransitionTooltip.tsx` — same annotation display (imports the shared helper from `@cyoda/workflow-viewer`).
- `packages/workflow-react/src/inspector/ProcessorForm.tsx` — annotations in the processor draft + modal.
- `packages/workflow-react/src/inspector/CriterionForm.tsx` — `criterionAnnotations` `AnnotationsField` + dispatch.
- Tests + a `.changeset/` entry + `ai/cyoda-schema-versions.md` v0.8.2 subsection + a golden fixture.

---

## Task 1: Core model + schema + parse (in-memory round-trip)

**Files:**
- Create: `packages/workflow-core/src/schema/annotations.ts`
- Modify: `schema/workflow.ts`, `schema/processor.ts`, `types/processor.ts`, `types/workflow.ts`, `parse/operator-alias.ts`
- Test: `packages/workflow-core/tests/parse/annotations-pc.test.ts` (new)

**Interfaces produced:** `ExternalizedProcessor.annotations?: Annotations`; `Workflow.criterionAnnotations?: Annotations`; `Transition.criterionAnnotations?: Annotations`; schemas accept them; `parseImportPayload` round-trips them in-memory.

- [ ] **Step 1: Write the failing test**

Create `packages/workflow-core/tests/parse/annotations-pc.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { parseImportPayload } from "../../src/index.js";

const PAYLOAD = {
  importMode: "REPLACE",
  workflows: [{
    version: "1.2", name: "wf", initialState: "S", active: true,
    criterionAnnotations: { displayName: "WF guard" },
    states: { S: { transitions: [{
      name: "t", next: "S", manual: true,
      criterionAnnotations: { displayName: "T guard", description: "d" },
      criterion: { type: "simple", jsonPath: "$.x", operation: "EQUALS", value: 1 },
      processors: [{ type: "externalized", name: "p1", executionMode: "SYNC",
        annotations: { displayName: "Proc One" } }],
    }] } },
  }],
};

describe("processor & criterion annotations parse", () => {
  test("parses the three new fields into the canonical model", () => {
    const { document, issues } = parseImportPayload(JSON.stringify(PAYLOAD));
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    const wf = document!.session.workflows[0]!;
    expect(wf.criterionAnnotations).toEqual({ displayName: "WF guard" });
    const t = wf.states.S!.transitions[0]!;
    expect(t.criterionAnnotations).toEqual({ displayName: "T guard", description: "d" });
    expect(t.processors![0]!.annotations).toEqual({ displayName: "Proc One" });
    // The criterion blob is untouched.
    expect(t.criterion).toMatchObject({ type: "simple", jsonPath: "$.x" });
  });

  test("does not alias operatorType inside criterionAnnotations", () => {
    const payload = { ...PAYLOAD, workflows: [{ ...PAYLOAD.workflows[0]!,
      criterionAnnotations: { operatorType: "keep-me" } }] };
    const { document } = parseImportPayload(JSON.stringify(payload));
    expect(document!.session.workflows[0]!.criterionAnnotations).toEqual({ operatorType: "keep-me" });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter=@cyoda/workflow-core exec vitest run annotations-pc`
Expected: FAIL — schema drops the unknown fields, so the assertions are `undefined`.

- [ ] **Step 3: Hoist `AnnotationsSchema` to avoid a schema import cycle**

Create `packages/workflow-core/src/schema/annotations.ts`:

```ts
import { z } from "zod";

/**
 * Client-owned metadata object (cyoda-go 0.8.1+). Object-only by contract:
 * arrays/primitives/null are rejected. Inner keys/values are arbitrary JSON and
 * are never inspected. Well-known optional keys `displayName`/`description`
 * (strings) are an advisory renderer convention, not enforced here.
 */
export const AnnotationsSchema = z.record(z.string(), z.unknown());
```

In `packages/workflow-core/src/schema/workflow.ts`, replace the local declaration:

```ts
export const AnnotationsSchema = z.record(z.string(), z.unknown());
```

with a re-export (keep the import at the top with the other imports):

```ts
export { AnnotationsSchema } from "./annotations.js";
```

- [ ] **Step 4: Add the schema fields**

In `packages/workflow-core/src/schema/workflow.ts`, add `criterionAnnotations` to `TransitionSchema` (after `criterion`) and `WorkflowSchema` (after `criterion`):

```ts
// TransitionSchema — add:
  criterionAnnotations: AnnotationsSchema.optional(),
// WorkflowSchema — add:
  criterionAnnotations: AnnotationsSchema.optional(),
```

In `packages/workflow-core/src/schema/processor.ts`, import the schema and add the field:

```ts
import { AnnotationsSchema } from "./annotations.js";
// …
export const ExternalizedProcessorSchema = z.object({
  type: z.literal("externalized"),
  name: NameSchema,
  executionMode: ExecutionModeSchema.optional(),
  startNewTxOnDispatch: z.boolean().optional(),
  annotations: AnnotationsSchema.optional(),
  config: FunctionConfigSchema.and(
    z.object({
      asyncResult: z.boolean().optional(),
      crossoverToAsyncMs: z.number().int().nonnegative().optional(),
    }),
  ).optional(),
});
```

- [ ] **Step 5: Add the model type fields**

In `packages/workflow-core/src/types/processor.ts`:

```ts
import type { Annotations } from "./workflow.js";
// …
export interface ExternalizedProcessor {
  type: "externalized";
  name: string;
  executionMode?: ExecutionMode;
  startNewTxOnDispatch?: boolean;
  annotations?: Annotations;
  config?: ExternalizedProcessorConfig;
}
```

In `packages/workflow-core/src/types/workflow.ts`, add `criterionAnnotations?: Annotations` to `Workflow` (after `criterion?`) and `Transition` (after `criterion?`), and update the `Annotations` docstring to say "workflow, state, transition, processor, or criterion (via criterionAnnotations)".

- [ ] **Step 6: Skip `criterionAnnotations` in operator-alias**

In `packages/workflow-core/src/parse/operator-alias.ts`, change the skip condition:

```ts
    result[k] =
      k === "annotations" || k === "criterionAnnotations"
        ? structuredClone(v)
        : normalizeOperatorAlias(v);
```

(`annotations` on a processor is already covered — the skip matches any key named `annotations` at any depth.)

- [ ] **Step 7: Run — expect PASS + typecheck**

Run: `pnpm --filter=@cyoda/workflow-core exec vitest run annotations-pc`
Expected: PASS (both tests).
Run: `pnpm --filter=@cyoda/workflow-core run typecheck`
Expected: `Done` (watch for a circular-import type error — the new `annotations.ts` avoids it).

- [ ] **Step 8: Commit**

```bash
git add packages/workflow-core/src/schema/annotations.ts packages/workflow-core/src/schema/workflow.ts packages/workflow-core/src/schema/processor.ts packages/workflow-core/src/types/processor.ts packages/workflow-core/src/types/workflow.ts packages/workflow-core/src/parse/operator-alias.ts packages/workflow-core/tests/parse/annotations-pc.test.ts
git commit -m "feat(core): model processor.annotations and criterionAnnotations (cyoda-go 0.8.2)"
```

---

## Task 2: Extend the 0.8 dialect (allowlist + emit) + schema-versions doc

**Files:**
- Modify: `packages/workflow-core/src/dialect/cyoda-0_8.ts`, `packages/workflow-core/src/normalize/output.ts`, `ai/cyoda-schema-versions.md`
- Test: `packages/workflow-core/tests/dialect/annotations-pc.test.ts` (new)

**Interfaces:** the 0.8 `workflowsToWire` emits `processor.annotations`, workflow/transition `criterionAnnotations` when present (and omits them when absent); the 0.7 dialect omits all three.

- [ ] **Step 1: Write the failing test**

Create `packages/workflow-core/tests/dialect/annotations-pc.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { parseImportPayload, serializeImportPayload } from "../../src/index.js";

const PAYLOAD = JSON.stringify({
  importMode: "REPLACE",
  workflows: [{
    version: "1.2", name: "wf", initialState: "S", active: true,
    criterionAnnotations: { displayName: "WF guard" },
    states: { S: { transitions: [{
      name: "t", next: "S", manual: true,
      criterionAnnotations: { displayName: "T guard" },
      processors: [{ type: "externalized", name: "p1", executionMode: "SYNC",
        annotations: { displayName: "Proc One" } }],
    }] } },
  }],
});

function wire(json: string, targetVersion: string) {
  const { document } = parseImportPayload(json);
  const out = serializeImportPayload(document!, { targetVersion });
  return JSON.parse(out).workflows[0];
}

describe("0.8 dialect emits processor & criterion annotations", () => {
  test("0.8 wire carries the three new fields", () => {
    const wf = wire(PAYLOAD, "0.8");
    expect(wf.criterionAnnotations).toEqual({ displayName: "WF guard" });
    const t = wf.states.S.transitions[0];
    expect(t.criterionAnnotations).toEqual({ displayName: "T guard" });
    expect(t.processors[0].annotations).toEqual({ displayName: "Proc One" });
  });

  test("0.7 wire omits all annotation fields", () => {
    const wf = wire(PAYLOAD, "0.7");
    expect(wf.criterionAnnotations).toBeUndefined();
    expect(wf.states.S.transitions[0].criterionAnnotations).toBeUndefined();
    expect(wf.states.S.transitions[0].processors?.[0]?.annotations).toBeUndefined();
  });

  test("a workflow without the new fields is byte-identical to before", () => {
    const plain = JSON.stringify({ importMode: "REPLACE", workflows: [{
      version: "1.2", name: "wf", initialState: "S", active: true,
      states: { S: { transitions: [{ name: "t", next: "S", manual: true }] } } }] });
    const { document } = parseImportPayload(plain);
    const out = serializeImportPayload(document!, { targetVersion: "0.8" });
    expect(JSON.parse(out).workflows[0].states.S.transitions[0]).not.toHaveProperty("annotations");
    expect(JSON.parse(out).workflows[0]).not.toHaveProperty("criterionAnnotations");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter=@cyoda/workflow-core exec vitest run dialect/annotations-pc`
Expected: FAIL — the allowlist strips `criterionAnnotations`/processor `annotations`.

- [ ] **Step 3: Allowlist the new fields**

In `packages/workflow-core/src/dialect/cyoda-0_8.ts`, add `criterionAnnotations` after `criterion` in both `WORKFLOW_FIELDS` and `TRANSITION_FIELDS`, and add `annotations` to `PROCESSOR_FIELDS`:

```ts
const WORKFLOW_FIELDS = [
  "version", "name", "desc", "initialState", "active",
  "annotations", "criterion", "criterionAnnotations", "states",
] as const;
const TRANSITION_FIELDS = [
  "name", "next", "manual", "annotations", "disabled",
  "criterion", "criterionAnnotations", "processors", "schedule",
] as const;
const PROCESSOR_FIELDS = [
  "type", "name", "executionMode", "startNewTxOnDispatch", "annotations", "config",
] as const;
```

- [ ] **Step 4: Emit the fields in output.ts**

In `packages/workflow-core/src/normalize/output.ts`:

In `outputWorkflow`, after the `criterion` line, add:

```ts
  if (options?.annotations && w.criterionAnnotations !== undefined) {
    out["criterionAnnotations"] = w.criterionAnnotations;
  }
```

In `outputTransition`, after the `criterion` line, add:

```ts
  if (options?.annotations && t.criterionAnnotations !== undefined) {
    out["criterionAnnotations"] = t.criterionAnnotations;
  }
```

`outputProcessor`/`outputExternalizedProcessor` do not currently take `OutputOptions`. Thread the flag through:

```ts
// outputStates / outputTransition already pass `options`; update the processor mapping:
  if (t.processors !== undefined && t.processors.length > 0) {
    out["processors"] = t.processors.map((p) => outputProcessor(p, options));
  }
// …
export function outputProcessor(p: Processor, options?: OutputOptions): Record<string, unknown> {
  return outputExternalizedProcessor(p, options);
}
function outputExternalizedProcessor(p: ExternalizedProcessor, options?: OutputOptions): Record<string, unknown> {
  const out: Record<string, unknown> = { type: "externalized", name: p.name };
  out["executionMode"] = p.executionMode ?? "ASYNC_NEW_TX";
  if ("startNewTxOnDispatch" in p && p.startNewTxOnDispatch !== undefined) {
    out["startNewTxOnDispatch"] = p.startNewTxOnDispatch;
  }
  if (options?.annotations && p.annotations !== undefined) out["annotations"] = p.annotations;
  if (p.config !== undefined) {
    const cfg = outputExternalizedConfig(p.config);
    if (Object.keys(cfg).length > 0) out["config"] = cfg;
  }
  return out;
}
```

(The 0.8 dialect already passes `{ schedule: true, annotations: true }`; the 0.7 dialect passes no `annotations` flag, so it keeps omitting all three. The `annotations` field on a processor sits before `config` to match `PROCESSOR_FIELDS`; the allowlist reorders regardless.)

- [ ] **Step 5: Run — expect PASS + typecheck**

Run: `pnpm --filter=@cyoda/workflow-core exec vitest run dialect/annotations-pc`
Expected: PASS.
Run: `pnpm --filter=@cyoda/workflow-core run typecheck` → `Done`.

- [ ] **Step 6: Document in `ai/cyoda-schema-versions.md`**

Append a `## v0.8.2 (dialect "0.8")` subsection after the v0.8.1 section, describing: `processor.annotations` (embedded) and `criterionAnnotations` (sibling to `criterion` on workflow/transition) added, schema tag 1.1→1.2 additive/dual-shape, all `omitempty` (byte-identical for non-users), `"0.8"` extended in place (no new dialect, no version-tag restamp), the 0.7 dialect still omits them, and `operator-alias` skips `criterionAnnotations`.

- [ ] **Step 7: Commit**

```bash
git add packages/workflow-core/src/dialect/cyoda-0_8.ts packages/workflow-core/src/normalize/output.ts packages/workflow-core/tests/dialect/annotations-pc.test.ts ai/cyoda-schema-versions.md
git commit -m "feat(core): 0.8 dialect emits processor & criterion annotations (v0.8.2)"
```

---

## Task 3: Golden round-trip fixture against the released v0.8.2 binary

**Files:**
- Create: `packages/workflow-core/tests/golden/pc-annotations.wire.json` (real export) + `packages/workflow-core/tests/golden/pc-annotations.test.ts`

**Interface:** proves the editor's parse→serialize reproduces a real v0.8.2 export of a workflow carrying all three fields.

- [ ] **Step 1: Capture a real export from the released binary**

Using `/opt/homebrew/bin/cyoda` (v0.8.2), start a local server, import a model, import the workflow payload below, `GET …/workflow/export`, and save the exported `workflows[0]` (pretty or compact — record which) to `packages/workflow-core/tests/golden/pc-annotations.wire.json`. Import payload:

```json
{ "importMode": "REPLACE", "workflows": [{ "version": "1.2", "name": "pc-annot",
  "initialState": "S", "active": true, "criterionAnnotations": { "displayName": "WF guard" },
  "states": { "S": { "transitions": [{ "name": "t", "next": "S", "manual": true,
    "criterionAnnotations": { "displayName": "T guard", "description": "d" },
    "criterion": { "type": "simple", "jsonPath": "$.x", "operation": "EQUALS", "value": 1 },
    "processors": [{ "name": "p1", "type": "externalized", "executionMode": "SYNC",
      "annotations": { "displayName": "Proc One" } }] }] } } }] }
```

If a running server isn't available in this environment, record that, and instead use the cyoda-go PR #385 e2e round-trip payload (`e2e/parity/workflow.go`, `workflowProcCriterionAnnotationsPayload`) — which cyoda's own e2e test verifies survives import→export — as the fixture, noting the substitution in the test file.

- [ ] **Step 2: Write the golden test**

Create `packages/workflow-core/tests/golden/pc-annotations.test.ts`: parse the captured wire JSON via `parseImportPayload`, then `serializeImportPayload(doc, { targetVersion: "0.8" })`, and assert the three annotation fields (and the untouched criterion) match the captured export. If the binary's export is byte-stable for these fields, assert deep-equality of `criterionAnnotations`/processor `annotations`; otherwise assert field-level equality (the runbook allows either).

- [ ] **Step 3: Run + commit**

Run: `pnpm --filter=@cyoda/workflow-core exec vitest run golden/pc-annotations` → PASS.
```bash
git add packages/workflow-core/tests/golden/pc-annotations.wire.json packages/workflow-core/tests/golden/pc-annotations.test.ts
git commit -m "test(core): golden round-trip for v0.8.2 processor/criterion annotations"
```

---

## Task 4: Transition tooltip — displayName/description (the primary goal)

**Files:**
- Modify: `packages/workflow-viewer/src/components/TransitionTooltip.tsx` (add shared helper + display)
- Modify: `packages/workflow-react/src/components/TransitionTooltip.tsx` (same display, import shared helper)
- Test: `packages/workflow-viewer/tests/transitionTooltip.test.tsx` (new/extend)

**Interfaces produced:** exported `readAnnotationText(annotations, key)` and `AnnotationLines({ annotations })` from `@cyoda/workflow-viewer`.

- [ ] **Step 1: Write the failing test**

Create `packages/workflow-viewer/tests/transitionTooltip.test.tsx`:

```tsx
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Transition } from "@cyoda/workflow-core";
import { TransitionTooltip } from "../src/components/TransitionTooltip.js";

afterEach(cleanup);

const t: Transition = {
  name: "APPROVE", next: "approved", manual: false, disabled: false,
  annotations: { displayName: "Approve request", description: "Manager sign-off" },
  criterion: { type: "simple", jsonPath: "$.ok", operation: "EQUALS", value: true },
  criterionAnnotations: { displayName: "Is ready" },
  processors: [{ type: "externalized", name: "notify", executionMode: "SYNC",
    annotations: { displayName: "Notify approver" } }],
};

describe("transition tooltip annotations", () => {
  test("shows displayName/description for transition, criterion, and processor", () => {
    render(<TransitionTooltip transition={t} x={0} y={0} />);
    expect(screen.getByText("Approve request")).toBeTruthy();
    expect(screen.getByText("Manager sign-off")).toBeTruthy();
    expect(screen.getByText("Is ready")).toBeTruthy();
    expect(screen.getByText("Notify approver")).toBeTruthy();
  });

  test("omits empty/absent annotation keys", () => {
    render(<TransitionTooltip transition={{ ...t, annotations: { displayName: "  " }, criterionAnnotations: undefined }} x={0} y={0} />);
    expect(screen.queryByText("Is ready")).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter=@cyoda/workflow-viewer exec vitest run transitionTooltip`
Expected: FAIL — the tooltip renders none of the annotation text.

- [ ] **Step 3: Add the shared helper + display to the viewer tooltip**

In `packages/workflow-viewer/src/components/TransitionTooltip.tsx`, add and export:

```tsx
import type { Annotations, Criterion, Processor, Transition } from "@cyoda/workflow-core";

/** A well-known annotation key's value, only when it's a non-empty string. */
export function readAnnotationText(
  annotations: Annotations | undefined,
  key: "displayName" | "description",
): string | undefined {
  const v = annotations?.[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

export function AnnotationLines({ annotations }: { annotations: Annotations | undefined }) {
  const name = readAnnotationText(annotations, "displayName");
  const desc = readAnnotationText(annotations, "description");
  if (!name && !desc) return null;
  return (
    <>
      {name && <div style={{ fontWeight: 600, fontSize: 12 }}>{name}</div>}
      {desc && <div style={{ fontSize: 11, color: workflowPalette.neutrals.slate500 }}>{desc}</div>}
    </>
  );
}
```

Render it: (a) directly under the transition-name header — `<AnnotationLines annotations={transition.annotations} />`; (b) inside the Criterion `<section>` header — `<AnnotationLines annotations={transition.criterionAnnotations} />`; (c) inside `ProcessorView`, after the name row — `<AnnotationLines annotations={processor.annotations} />`. Also render the Criterion section (with its `AnnotationLines`) when `transition.criterionAnnotations` is present even if `transition.criterion` is absent — guard becomes `transition.criterion || transition.criterionAnnotations`.

- [ ] **Step 4: Mirror the display in the react tooltip**

In `packages/workflow-react/src/components/TransitionTooltip.tsx`, import the helper from the viewer and add the same three render points:

```tsx
import { AnnotationLines } from "@cyoda/workflow-viewer";
```

(If `@cyoda/workflow-viewer`'s package entry doesn't already export `AnnotationLines`, add it to `packages/workflow-viewer/src/index.ts`.)

- [ ] **Step 5: Run — expect PASS**

Run: `pnpm --filter=@cyoda/workflow-viewer exec vitest run transitionTooltip` → PASS.
Run: `pnpm --filter=@cyoda/workflow-viewer --filter=@cyoda/workflow-react run typecheck` → `Done`.

- [ ] **Step 6: Commit**

```bash
git add packages/workflow-viewer/src/components/TransitionTooltip.tsx packages/workflow-viewer/src/index.ts packages/workflow-react/src/components/TransitionTooltip.tsx packages/workflow-viewer/tests/transitionTooltip.test.tsx
git commit -m "feat(viewer): show displayName/description in the transition tooltip"
```

---

## Task 5: Editing — processor annotations (modal) + criterion annotations (patch target)

**Files:**
- Modify: `packages/workflow-core/src/types/patch.ts`, `packages/workflow-core/src/patch/apply.ts`, `packages/workflow-core/src/patch/invert.ts`
- Modify: `packages/workflow-react/src/inspector/ProcessorForm.tsx`, `packages/workflow-react/src/inspector/CriterionForm.tsx`
- Test: `packages/workflow-core/tests/patch/criterion-annotations.test.ts` (new); extend `packages/workflow-react/tests/processorContext.test.tsx` or a new react test.

**Interfaces:** `AnnotationsTarget` gains `{ kind: "workflowCriterion"; workflow }` and `{ kind: "transitionCriterion"; transitionUuid }`, writing to `.criterionAnnotations`. Processor annotations ride the existing `addProcessor`/`updateProcessor` via the modal draft (no new op).

- [ ] **Step 1: Write the failing core test (criterion-annotations target)**

Create `packages/workflow-core/tests/patch/criterion-annotations.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { applyPatch, invertPatch } from "../../src/index.js";
import { makeDoc } from "./helpers.js";

describe("setAnnotations criterion targets", () => {
  test("workflowCriterion sets and clears workflow.criterionAnnotations", () => {
    const doc = makeDoc();
    const set = applyPatch(doc, { op: "setAnnotations",
      target: { kind: "workflowCriterion", workflow: "wf" }, annotations: { displayName: "g" } });
    expect(set.session.workflows[0]!.criterionAnnotations).toEqual({ displayName: "g" });
    const inv = invertPatch(doc, { op: "setAnnotations",
      target: { kind: "workflowCriterion", workflow: "wf" }, annotations: { displayName: "g" } });
    const back = applyPatch(set, inv);
    expect(back.session).toEqual(doc.session);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm --filter=@cyoda/workflow-core exec vitest run criterion-annotations`) — the target kind doesn't exist.

- [ ] **Step 3: Extend `AnnotationsTarget` + apply/invert**

In `packages/workflow-core/src/types/patch.ts`:

```ts
export type AnnotationsTarget =
  | { kind: "workflow"; workflow: string }
  | { kind: "state"; workflow: string; stateCode: StateCode }
  | { kind: "transition"; transitionUuid: string }
  | { kind: "workflowCriterion"; workflow: string }
  | { kind: "transitionCriterion"; transitionUuid: string };
```

In `packages/workflow-core/src/patch/apply.ts`, replace the `setAnnotations` case with a field-aware version:

```ts
      case "setAnnotations": {
        const t = patch.target;
        let host: Record<string, unknown> | undefined;
        let field = "annotations";
        if (t.kind === "workflow") host = draft.workflows.find((w) => w.name === t.workflow);
        else if (t.kind === "state") host = draft.workflows.find((w) => w.name === t.workflow)?.states[t.stateCode];
        else if (t.kind === "transition") {
          const loc = locateTransition(doc, t.transitionUuid);
          if (loc) host = draft.workflows.find((w) => w.name === loc.workflow)?.states[loc.state]?.transitions[loc.index];
        } else if (t.kind === "workflowCriterion") {
          host = draft.workflows.find((w) => w.name === t.workflow); field = "criterionAnnotations";
        } else {
          const loc = locateTransition(doc, t.transitionUuid);
          if (loc) host = draft.workflows.find((w) => w.name === loc.workflow)?.states[loc.state]?.transitions[loc.index];
          field = "criterionAnnotations";
        }
        if (!host) return;
        if (patch.annotations === undefined) delete host[field];
        else host[field] = patch.annotations;
        return;
      }
```

In `packages/workflow-core/src/patch/invert.ts`, mirror the field resolution to read the prior value:

```ts
    case "setAnnotations": {
      const t = patch.target;
      let prior: Record<string, unknown> | undefined;
      if (t.kind === "workflow") prior = findWorkflow(doc, t.workflow)?.annotations;
      else if (t.kind === "state") prior = findWorkflow(doc, t.workflow)?.states[t.stateCode]?.annotations;
      else if (t.kind === "transition") prior = findTransition(doc, t.transitionUuid)?.annotations;
      else if (t.kind === "workflowCriterion") prior = findWorkflow(doc, t.workflow)?.criterionAnnotations;
      else prior = findTransition(doc, t.transitionUuid)?.criterionAnnotations;
      return prior === undefined
        ? { op: "setAnnotations", target: t }
        : { op: "setAnnotations", target: t, annotations: structuredClone(prior) };
    }
```

Run: `pnpm --filter=@cyoda/workflow-core exec vitest run criterion-annotations` → PASS; core typecheck → `Done`.

- [ ] **Step 4: Processor modal annotations (draft)**

In `packages/workflow-react/src/inspector/ProcessorForm.tsx`: add `annotations?: Annotations` to `ProcessorDraft`; hydrate in `toDraft` (`annotations: externalized?.annotations`); write back in `toProcessor` (`...(draft.annotations !== undefined ? { annotations: draft.annotations } : {})`); and mount an `AnnotationsField` in the modal body bound to the draft:

```tsx
<AnnotationsField
  value={draft.annotations}
  disabled={disabled}
  modelKey={`processor-${initialProcessor?.name ?? "new"}`}
  onCommit={(a) => setDraft((c) => ({ ...c, annotations: a }))}
  onRemove={() => setDraft((c) => ({ ...c, annotations: undefined }))}
/>
```

- [ ] **Step 5: Criterion-annotations editor**

In `packages/workflow-react/src/inspector/CriterionForm.tsx` (`CriterionSection`), add an `AnnotationsField` bound to the host's `criterionAnnotations` that dispatches `setAnnotations` with the criterion target for the host kind (`workflowCriterion` / `transitionCriterion`). The section receives the host (workflow name or transition uuid) and the current `criterionAnnotations` value (thread it from `TransitionForm`/`WorkflowForm`, which already pass `criterion`). Use a distinct `data-testid` scope to avoid colliding with the transition's own annotations "Add" button.

- [ ] **Step 6: React tests + full suite (Node 20)**

Add/extend a react test asserting: the processor modal round-trips `annotations` through `updateProcessor`; `CriterionSection` dispatches `setAnnotations` with `{ kind: "transitionCriterion", … }`.
Run: `export PATH="$(brew --prefix node@20)/bin:$PATH"; pnpm --filter=@cyoda/workflow-react exec vitest run` → all pass. Typecheck → `Done`.

- [ ] **Step 7: Commit**

```bash
git add packages/workflow-core/src/types/patch.ts packages/workflow-core/src/patch/apply.ts packages/workflow-core/src/patch/invert.ts packages/workflow-core/tests/patch/criterion-annotations.test.ts packages/workflow-react/src/inspector/ProcessorForm.tsx packages/workflow-react/src/inspector/CriterionForm.tsx packages/workflow-react/tests/
git commit -m "feat(react): edit processor annotations and criterionAnnotations"
```

---

## Task 6: Validation extension + changeset + full verification

**Files:**
- Modify: `packages/workflow-core/src/validate/semantic.ts`
- Create: `.changeset/processor-criteria-annotations.md`

- [ ] **Step 1: Extend `annotations-too-large`**

In `packages/workflow-core/src/validate/semantic.ts` `annotationsSizeIssues`, also check, per workflow: `wf.criterionAnnotations` (workflow target id); per transition: `t.criterionAnnotations` and each `processor.annotations` (transition target id — reuse `transitionTargetId(doc, wf.name, stateCode, index)`; processors have no distinct target). Each emits `annotations-too-large` with the same `> ANNOTATIONS_MAX_BYTES` guard and `detail: { bytes, max }`. Add a focused test that an oversized `criterionAnnotations` / processor `annotations` fires the error.

- [ ] **Step 2: Changeset**

Create `.changeset/processor-criteria-annotations.md`:

```markdown
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
```

- [ ] **Step 3: Full verification**

Run: `pnpm -r --filter="./packages/*" run typecheck` → all `Done`.
Run: `pnpm lint` → clean.
Run: `pnpm -r --filter="./packages/*" run build` → all `Done`.
Run: `pnpm --filter=@cyoda/workflow-core --filter=@cyoda/workflow-viewer exec vitest run` → pass.
Run: `export PATH="$(brew --prefix node@20)/bin:$PATH"; pnpm --filter=@cyoda/workflow-react exec vitest run` → pass.

- [ ] **Step 4: Commit**

```bash
git add packages/workflow-core/src/validate/semantic.ts packages/workflow-core/tests .changeset/processor-criteria-annotations.md
git commit -m "feat(core): validate size of processor/criterion annotations + changeset"
```

- [ ] **Step 5: Visual verification in the demo**

Run the demo editor; on a transition with `displayName`/`description` in its `annotations`, `criterionAnnotations`, and a processor's `annotations`, hover the transition and confirm all three sets of labels appear. Confirm the processor modal and criterion editor round-trip annotations through the exported JSON. (Screenshot for the PR.)

---

## Self-Review (completed during authoring)

- **Spec coverage:** model fields → T1; dialect emit + schema-versions doc → T2; golden fixture → T3; tooltip (transition/criterion/processor displayName/description, dedup helper) → T4; editing (processor modal + criterion target) → T5; validation + versioning + changeset → T6. Non-goals (structured inputs, new dialect, version restamp, projection change) honored.
- **Placeholder scan:** none — each code step shows real code; the two soft spots (golden capture needing a running server; criterion-annotations testid scoping) have explicit fallbacks/instructions.
- **Type consistency:** `Annotations` reused everywhere; `AnnotationsTarget` variants defined in T5 and consumed by apply/invert in the same task; `readAnnotationText`/`AnnotationLines` defined in T4 and imported by the react tooltip in the same task; the 0.8 dialect's `{ annotations: true }` flag (existing) drives all three new emissions.
