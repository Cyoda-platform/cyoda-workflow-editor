# Workflow-level Criterion Editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user add / edit / remove the criterion on a workflow from the inspector, and delete the redundant dead `setWorkflowCriterion` patch op.

**Architecture:** Reuse the existing host-agnostic criterion editor. The general `setCriterion` op already models a `{ kind: "workflow" }` host in `apply` and `invert`, so we standardise on it, delete the orphaned `setWorkflowCriterion` op, mount the existing `CriterionSection` in `WorkflowForm` with a workflow host, and give the empty state workflow-appropriate copy.

**Tech Stack:** TypeScript, React, Vitest + @testing-library/react, pnpm workspaces, Zod (existing `CriterionSchema`), Monaco (existing `registerCriterionSchema`).

## Global Constraints

- **Versioning:** breaking-class changes ship as a 0.x **`minor`** Changeset (never `major`). This change is minor for `@cyoda/workflow-core` (public op removed) and `@cyoda/workflow-react` (new UI + i18n keys).
- **Node for react tests:** run `@cyoda/workflow-react` Vitest on **Node 20** — `export PATH="$(brew --prefix node@20)/bin:$PATH"` before the command. Default Node's built-in `localStorage` global breaks jsdom localStorage tests.
- **No new op / no new apply-invert logic:** the workflow host is already supported by `setCriterion`. Do not add a replacement op.
- **i18n wording (verbatim):**
  - `criterion.workflowCaption` = `"Determines whether this workflow applies to an entity of its model — set one to disambiguate when several workflows target the same model."`
  - `criterion.workflowNone` = `"No workflow criterion set."`
- **Reducer/build coupling:** removing the `setWorkflowCriterion` member of `DomainPatch` makes the `case "setWorkflowCriterion"` in `workflow-react/src/state/store.ts` a type error. Both edits live in **Task 1** so no intermediate commit fails typecheck.
- **Package manager:** commands use `pnpm --filter=<pkg>`.

---

## File Structure

- `packages/workflow-core/src/types/patch.ts` — remove the `setWorkflowCriterion` union member.
- `packages/workflow-core/src/patch/apply.ts` — remove its apply case.
- `packages/workflow-core/src/patch/invert.ts` — remove its invert case.
- `packages/workflow-core/tests/patch/workflow-criterion.test.ts` — **new**; characterises `setCriterion` with a workflow host (apply + exact inverse + parse/serialize round-trip).
- `packages/workflow-react/src/state/store.ts` — remove the dead summary case; make the surviving `setCriterion` summary host-aware.
- `packages/workflow-react/src/inspector/CriterionField.tsx` — add optional `emptyText` prop; use it and suppress the automated warning when present.
- `packages/workflow-react/src/i18n/en.ts` — add `criterion.workflowCaption` and `criterion.workflowNone`.
- `packages/workflow-react/src/inspector/CriterionForm.tsx` — branch `CriterionSection` on `host.kind === "workflow"`: render the caption and pass `emptyText`.
- `packages/workflow-react/src/inspector/WorkflowForm.tsx` — mount `CriterionSection` with a workflow host after the annotations block.
- `packages/workflow-react/tests/workflowCriterion.test.tsx` — **new**; workflow criterion UI (empty copy, Add dispatch, Remove dispatch) + undo label.
- `.changeset/workflow-criterion-editing.md` — **new**; minor changeset.

---

## Task 1: Core — characterise `setCriterion` workflow host, then delete the dead `setWorkflowCriterion` op

**Files:**
- Create: `packages/workflow-core/tests/patch/workflow-criterion.test.ts`
- Modify: `packages/workflow-core/src/types/patch.ts` (delete line `| { op: "setWorkflowCriterion"; workflow: string; criterion?: Criterion }`)
- Modify: `packages/workflow-core/src/patch/apply.ts` (delete the `case "setWorkflowCriterion": { … }` block)
- Modify: `packages/workflow-core/src/patch/invert.ts` (delete the `case "setWorkflowCriterion": { … }` block)
- Modify: `packages/workflow-react/src/state/store.ts` (delete the `case "setWorkflowCriterion":` summary line)

**Interfaces:**
- Consumes: `applyPatch`, `invertPatch`, `parseImportPayload`, `serializeImportPayload` from `@cyoda/workflow-core`; `makeDoc` from `tests/patch/helpers.ts`.
- Produces: no new exports. After this task the only criterion-setting op is `setCriterion { host: HostRef; path: string[]; criterion? }`, where `HostRef` includes `{ kind: "workflow"; workflow: string }`.

- [ ] **Step 1: Write the characterization test**

Create `packages/workflow-core/tests/patch/workflow-criterion.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  applyPatch,
  invertPatch,
  parseImportPayload,
  serializeImportPayload,
} from "../../src/index.js";
import type { Criterion, DomainPatch } from "../../src/index.js";
import { makeDoc } from "./helpers.js";

const CRIT: Criterion = {
  type: "simple",
  jsonPath: "$.kind",
  operation: "EQUALS",
  value: "order",
};

const setWorkflowCrit = (criterion?: Criterion): DomainPatch => ({
  op: "setCriterion",
  host: { kind: "workflow", workflow: "wf" },
  path: ["criterion"],
  criterion,
});

describe("setCriterion with a workflow host", () => {
  test("apply sets the workflow-level criterion", () => {
    const doc = makeDoc();
    const after = applyPatch(doc, setWorkflowCrit(CRIT));
    expect(after.session.workflows[0]!.criterion).toEqual(CRIT);
  });

  test("apply with undefined clears the workflow-level criterion", () => {
    const doc0 = makeDoc();
    const doc1 = applyPatch(doc0, setWorkflowCrit(CRIT));
    const doc2 = applyPatch(doc1, setWorkflowCrit(undefined));
    expect(doc2.session.workflows[0]!.criterion).toBeUndefined();
  });

  test("invert restores the prior workflow criterion (set then undo)", () => {
    const doc = makeDoc();
    const patch = setWorkflowCrit(CRIT);
    const afterApply = applyPatch(doc, patch);
    const inverse = invertPatch(doc, patch);
    const afterInvert = applyPatch(afterApply, inverse);
    expect(afterInvert.session).toEqual(doc.session);
  });

  test("workflow criterion survives a parse -> serialize round-trip", () => {
    const doc = applyPatch(makeDoc(), setWorkflowCrit(CRIT));
    const wire = serializeImportPayload(doc);
    const reparsed = parseImportPayload(wire);
    expect(reparsed.document?.session.workflows[0]!.criterion).toEqual(CRIT);
  });
});
```

- [ ] **Step 2: Run the test to confirm the survivor path already works**

Run: `pnpm --filter=@cyoda/workflow-core test -- workflow-criterion`
Expected: PASS (the workflow host is already implemented by `setCriterion`). This locks the behaviour we standardise on before deleting the redundant op.

- [ ] **Step 3: Delete the dead op in `@cyoda/workflow-core`**

In `packages/workflow-core/src/types/patch.ts`, delete this union line (currently line 22):

```ts
  | { op: "setWorkflowCriterion"; workflow: string; criterion?: Criterion }
```

In `packages/workflow-core/src/patch/apply.ts`, delete the whole block (currently lines 62–68):

```ts
      case "setWorkflowCriterion": {
        const wf = draft.workflows.find((w) => w.name === patch.workflow);
        if (!wf) return;
        if (patch.criterion === undefined) delete wf.criterion;
        else wf.criterion = patch.criterion;
        return;
      }
```

In `packages/workflow-core/src/patch/invert.ts`, delete the whole block (currently lines 49–55):

```ts
    case "setWorkflowCriterion": {
      const wf = findWorkflow(doc, patch.workflow);
      if (!wf) return noop();
      return wf.criterion
        ? { op: "setWorkflowCriterion", workflow: patch.workflow, criterion: cloneCriterion(wf.criterion) }
        : { op: "setWorkflowCriterion", workflow: patch.workflow };
    }
```

- [ ] **Step 4: Delete the dead summary case in `@cyoda/workflow-react`**

In `packages/workflow-react/src/state/store.ts`, delete these two lines (currently 32–33):

```ts
    case "setWorkflowCriterion":
      return patch.criterion ? `Set workflow criterion` : `Clear workflow criterion`;
```

(The surviving `setCriterion` summary at line ~58 stays for now; Task 3 makes it host-aware.)

- [ ] **Step 5: Confirm zero references remain**

Run: `grep -rn "setWorkflowCriterion" packages --include='*.ts' --include='*.tsx' | grep -v dist/`
Expected: no output.

- [ ] **Step 6: Re-run core tests + typecheck both packages**

Run: `pnpm --filter=@cyoda/workflow-core test -- workflow-criterion`
Expected: PASS.
Run: `pnpm --filter=@cyoda/workflow-core --filter=@cyoda/workflow-react run typecheck`
Expected: both `Done`, no errors (proves the union-member removal is fully reconciled).

- [ ] **Step 7: Commit**

```bash
git add packages/workflow-core/tests/patch/workflow-criterion.test.ts \
  packages/workflow-core/src/types/patch.ts \
  packages/workflow-core/src/patch/apply.ts \
  packages/workflow-core/src/patch/invert.ts \
  packages/workflow-react/src/state/store.ts
git commit -m "refactor(core): drop dead setWorkflowCriterion op; standardise on setCriterion workflow host"
```

---

## Task 2: React — injectable empty-state copy in `CriterionField` + i18n keys

**Files:**
- Modify: `packages/workflow-react/src/inspector/CriterionField.tsx`
- Modify: `packages/workflow-react/src/i18n/en.ts`
- Test: `packages/workflow-react/tests/workflowCriterion.test.tsx` (create; extended further in Task 3)

**Interfaces:**
- Consumes: `defaultMessages`, `I18nContext` from the i18n module.
- Produces: `CriterionFieldProps` gains `emptyText?: string`. When `emptyText` is set, the empty state renders it and does **not** render the `criterion-automated-warning`. New i18n keys `criterion.workflowCaption`, `criterion.workflowNone`.

- [ ] **Step 1: Write the failing test**

Create `packages/workflow-react/tests/workflowCriterion.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nContext } from "../src/i18n/context.js";
import { defaultMessages } from "../src/i18n/en.js";
import { CriterionField } from "../src/inspector/CriterionField.js";

afterEach(() => cleanup());

function renderField(emptyText?: string) {
  return render(
    <I18nContext.Provider value={defaultMessages}>
      <CriterionField
        value={undefined}
        disabled={false}
        modelKey="host-wf"
        emptyText={emptyText}
        onCommit={() => {}}
        onRemove={() => {}}
      />
    </I18nContext.Provider>,
  );
}

describe("CriterionField empty-state copy", () => {
  it("shows injected empty text and suppresses the automated warning", () => {
    renderField(defaultMessages.criterion.workflowNone);
    expect(screen.getByText(defaultMessages.criterion.workflowNone)).toBeTruthy();
    expect(screen.queryByTestId("criterion-automated-warning")).toBeNull();
  });

  it("falls back to the automated transition copy when no emptyText is given", () => {
    renderField(undefined);
    expect(screen.getByText(defaultMessages.criterion.noneAutomated)).toBeTruthy();
    expect(screen.getByTestId("criterion-automated-warning")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$(brew --prefix node@20)/bin:$PATH"; pnpm --filter=@cyoda/workflow-react test -- workflowCriterion`
Expected: FAIL — `CriterionField` has no `emptyText` prop and still renders the automated warning; `workflowNone` key does not exist (type error / undefined text).

- [ ] **Step 3: Add the i18n keys**

In `packages/workflow-react/src/i18n/en.ts`, inside the `criterion: { … }` block, add these two keys (place them after `noneAutomatedWarning`):

```ts
    workflowCaption:
      "Determines whether this workflow applies to an entity of its model — set one to disambiguate when several workflows target the same model.",
    workflowNone: "No workflow criterion set.",
```

- [ ] **Step 4: Add the `emptyText` prop and use it**

In `packages/workflow-react/src/inspector/CriterionField.tsx`, add `emptyText?: string` to the props interface:

```ts
export interface CriterionFieldProps {
  value: Criterion | undefined;
  manual?: boolean;
  disabled: boolean;
  modelKey: string;
  emptyText?: string;
  onCommit: (next: Criterion) => void;
  onRemove: () => void;
}
```

Replace the empty-state block (the `if (props.value === undefined) { … }` body) with:

```tsx
  if (props.value === undefined) {
    const emptyText = props.emptyText ?? (props.manual ? m.noneManual : m.noneAutomated);
    const showWarning = props.emptyText === undefined && !props.manual;
    return (
      <div style={cardStyle} data-testid="criterion-summary-card">
        <p style={summaryTextStyle}>{emptyText}</p>
        {showWarning && (
          <p style={warnStyle} data-testid="criterion-automated-warning">{m.noneAutomatedWarning}</p>
        )}
        {!props.disabled && (
          <button type="button" style={primaryBtnStyle} data-testid="inspector-criterion-add" onClick={() => props.onCommit(defaultSimpleCriterion())}>
            {m.add}
          </button>
        )}
      </div>
    );
  }
```

- [ ] **Step 5: Run to verify it passes**

Run: `export PATH="$(brew --prefix node@20)/bin:$PATH"; pnpm --filter=@cyoda/workflow-react test -- workflowCriterion`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add packages/workflow-react/src/inspector/CriterionField.tsx \
  packages/workflow-react/src/i18n/en.ts \
  packages/workflow-react/tests/workflowCriterion.test.tsx
git commit -m "feat(react): injectable empty-state copy for CriterionField + workflow i18n keys"
```

---

## Task 3: React — mount the workflow criterion editor in `WorkflowForm` + host-aware undo label

**Files:**
- Modify: `packages/workflow-react/src/inspector/CriterionForm.tsx`
- Modify: `packages/workflow-react/src/inspector/WorkflowForm.tsx`
- Modify: `packages/workflow-react/src/state/store.ts`
- Test: `packages/workflow-react/tests/workflowCriterion.test.tsx` (extend)

**Interfaces:**
- Consumes: `CriterionSection` (`inspector/CriterionForm.tsx`), `WorkflowForm` (`inspector/WorkflowForm.tsx`), `useEditorStore` (`state/store.ts`), `defaultMessages`, `I18nContext`, `makeDoc`-style fixture via `parseImportPayload`.
- Produces: `WorkflowForm` renders a `CriterionSection` with `host = { kind: "workflow", workflow: workflow.name }`. Dispatched patch shape on Add: `{ op: "setCriterion", host: { kind: "workflow", workflow }, path: ["criterion"], criterion: <Criterion> }`. Undo summary for a workflow-host `setCriterion` is `"Set workflow criterion"` / `"Clear workflow criterion"`.

- [ ] **Step 1: Write the failing tests (append to `workflowCriterion.test.tsx`)**

Add these imports at the top of the file (merge with existing imports):

```tsx
import { act, renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { parseImportPayload, type DomainPatch, type WorkflowEditorDocument } from "@cyoda/workflow-core";
import { vi } from "vitest";
import { WorkflowForm } from "../src/inspector/WorkflowForm.js";
import { useEditorStore } from "../src/state/store.js";
```

Append these blocks:

```tsx
function workflowDoc(): WorkflowEditorDocument {
  const result = parseImportPayload(
    JSON.stringify({
      importMode: "MERGE",
      workflows: [
        { version: "1.0", name: "wf", initialState: "start", active: true, states: { start: { transitions: [] } } },
      ],
    }),
  );
  if (!result.document) throw new Error("fixture parse failed");
  return result.document;
}

function renderWorkflowForm() {
  const workflow = workflowDoc().session.workflows[0]!;
  const onDispatch = vi.fn<(patch: DomainPatch) => void>();
  return {
    ...render(
      <I18nContext.Provider value={defaultMessages}>
        <WorkflowForm workflow={workflow} disabled={false} onDispatch={onDispatch} />
      </I18nContext.Provider>,
    ),
    onDispatch,
  };
}

describe("workflow criterion editing", () => {
  it("shows the workflow caption and empty copy, not the transition warning", () => {
    renderWorkflowForm();
    expect(screen.getByText(defaultMessages.criterion.workflowCaption)).toBeTruthy();
    expect(screen.getByText(defaultMessages.criterion.workflowNone)).toBeTruthy();
    expect(screen.queryByTestId("criterion-automated-warning")).toBeNull();
  });

  it("Add dispatches setCriterion with a workflow host", () => {
    const view = renderWorkflowForm();
    fireEvent.click(view.getByTestId("inspector-criterion-add"));
    expect(view.onDispatch).toHaveBeenCalledTimes(1);
    expect(view.onDispatch.mock.calls[0]![0]).toMatchObject({
      op: "setCriterion",
      host: { kind: "workflow", workflow: "wf" },
      path: ["criterion"],
      criterion: { type: "simple" },
    });
  });

  it("labels a workflow-host setCriterion undo entry", () => {
    const doc = workflowDoc();
    const { result } = renderHook(() => useEditorStore(doc));
    act(() => {
      result.current[1].dispatch({
        op: "setCriterion",
        host: { kind: "workflow", workflow: "wf" },
        path: ["criterion"],
        criterion: { type: "simple", jsonPath: "$.kind", operation: "EQUALS", value: "order" },
      });
    });
    expect(result.current[0].undoStack[0]!.summary).toBe("Set workflow criterion");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$(brew --prefix node@20)/bin:$PATH"; pnpm --filter=@cyoda/workflow-react test -- workflowCriterion`
Expected: FAIL — `WorkflowForm` renders no criterion section (caption/empty copy/Add button absent); undo summary is the generic `"Set criterion"`.

- [ ] **Step 3: Make `CriterionSection` host-aware**

Replace the body of `packages/workflow-react/src/inspector/CriterionForm.tsx` with:

```tsx
import type { Criterion, DomainPatch, HostRef } from "@cyoda/workflow-core";
import type { Selection } from "../state/types.js";
import { useMessages } from "../i18n/context.js";
import { colors } from "../style/tokens.js";
import { CriterionField } from "./CriterionField.js";

function criterionModelKey(host: HostRef): string {
  if (host.kind === "transition") return `transition-${host.transitionUuid}`;
  if (host.kind === "processorConfig") return `processor-${host.processorUuid}`;
  return `host-${host.workflow}`;
}

export function CriterionSection({
  host, manual, criterion, disabled, onDispatch, onSelectionChange: _onSelectionChange,
}: {
  host: HostRef;
  stateCode?: string;
  transitionName?: string;
  targetState?: string;
  manual?: boolean;
  criterion: Criterion | undefined;
  disabled: boolean;
  onDispatch: (patch: DomainPatch) => void;
  onSelectionChange?: (selection: Selection) => void;
}) {
  const m = useMessages().criterion;
  const isWorkflow = host.kind === "workflow";
  const path = ["criterion"];
  return (
    <>
      {isWorkflow && (
        <p
          data-testid="workflow-criterion-caption"
          style={{ margin: "0 0 6px", fontSize: 12, lineHeight: 1.4, color: colors.textSecondary }}
        >
          {m.workflowCaption}
        </p>
      )}
      <CriterionField
        value={criterion}
        manual={manual}
        disabled={disabled}
        modelKey={criterionModelKey(host)}
        emptyText={isWorkflow ? m.workflowNone : undefined}
        onCommit={(next) => onDispatch({ op: "setCriterion", host, path, criterion: next })}
        onRemove={() => onDispatch({ op: "setCriterion", host, path, criterion: undefined })}
      />
    </>
  );
}
```

(`colors.textSecondary` = `#334155` exists in `packages/workflow-react/src/style/tokens.ts`.)

- [ ] **Step 4: Mount `CriterionSection` in `WorkflowForm`**

In `packages/workflow-react/src/inspector/WorkflowForm.tsx`, add the import:

```ts
import { CriterionSection } from "./CriterionForm.js";
```

Insert, immediately after the closing `</AnnotationsField>`/`/>` of the annotations block and before the closing `</FieldGroup>`:

```tsx
      <CriterionSection
        host={{ kind: "workflow", workflow: workflow.name }}
        criterion={workflow.criterion}
        disabled={disabled}
        onDispatch={onDispatch}
      />
```

- [ ] **Step 5: Make the `setCriterion` undo summary host-aware**

In `packages/workflow-react/src/state/store.ts`, replace the surviving `setCriterion` summary case:

```ts
    case "setCriterion":
      return patch.criterion ? `Set criterion` : `Clear criterion`;
```

with:

```ts
    case "setCriterion": {
      const scope = patch.host.kind === "workflow" ? "workflow criterion" : "criterion";
      return patch.criterion ? `Set ${scope}` : `Clear ${scope}`;
    }
```

- [ ] **Step 6: Run to verify it passes**

Run: `export PATH="$(brew --prefix node@20)/bin:$PATH"; pnpm --filter=@cyoda/workflow-react test -- workflowCriterion`
Expected: PASS (all five tests in the file).

- [ ] **Step 7: Run the full react suite + typecheck to catch regressions**

Run: `export PATH="$(brew --prefix node@20)/bin:$PATH"; pnpm --filter=@cyoda/workflow-react test`
Expected: all pass (existing transition criterion tests still green — `emptyText` defaults preserve their behaviour).
Run: `pnpm --filter=@cyoda/workflow-react run typecheck`
Expected: `Done`.

- [ ] **Step 8: Commit**

```bash
git add packages/workflow-react/src/inspector/CriterionForm.tsx \
  packages/workflow-react/src/inspector/WorkflowForm.tsx \
  packages/workflow-react/src/state/store.ts \
  packages/workflow-react/tests/workflowCriterion.test.tsx
git commit -m "feat(react): edit workflow-level criterion in the inspector"
```

---

## Task 4: Changeset + full verification

**Files:**
- Create: `.changeset/workflow-criterion-editing.md`

- [ ] **Step 1: Write the changeset**

Create `.changeset/workflow-criterion-editing.md`:

```markdown
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
```

- [ ] **Step 2: Full monorepo verification**

Run: `pnpm -r --filter="./packages/*" run typecheck`
Expected: all packages `Done`.
Run: `pnpm lint`
Expected: no errors.
Run: `pnpm -r --filter="./packages/*" run build`
Expected: all `Done` (rebuilds dist so any app/integration test consumes the new behaviour).
Run: `pnpm --filter=@cyoda/workflow-core test` (core suite)
Expected: pass.
Run: `export PATH="$(brew --prefix node@20)/bin:$PATH"; pnpm --filter=@cyoda/workflow-react test` (react suite on Node 20)
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add .changeset/workflow-criterion-editing.md
git commit -m "chore(changeset): workflow-level criterion editing (minor)"
```

- [ ] **Step 4: Visual verification in the demo app**

Run the demo editor and confirm the workflow criterion UI end-to-end (this is a UI feature; drive it, don't just trust unit tests):

```bash
pnpm --filter=@cyoda/docs-embed-demo dev
```

Then in the editor showcase (`/editor`): click empty canvas to select the whole workflow → the inspector shows the "Criterion" area with the caption + "No workflow criterion set." → click **Add criterion** → a `simple` criterion appears and is editable as JSON → edit to valid JSON and Apply → Remove clears it. Confirm no "automated transition" warning appears. (A Playwright screenshot of the inspector is a good artifact for the PR.)

---

## Self-Review (completed during authoring)

- **Spec coverage:** §Core removal → Task 1. §Mount in WorkflowForm → Task 3 Step 4. §Host-appropriate empty copy → Task 2 + Task 3 Step 3. §Host-aware undo label → Task 3 Step 5. §Data flow (add/edit/remove/undo/serialize) → Task 1 tests (apply/invert/round-trip) + Task 3 tests (Add dispatch, undo label). §Testing → Tasks 1–3. §Versioning/downstream → Task 4. §Non-goals (validation rule, Selection variant) → not implemented, by design.
- **Placeholder scan:** none — every code step shows full code; the one soft note (token name check in Task 3 Step 3) has an explicit verification path.
- **Type consistency:** the dispatched patch shape `{ op: "setCriterion", host: { kind: "workflow", workflow }, path: ["criterion"], criterion }` is identical across Task 1 tests, Task 3 `CriterionSection`, and Task 3 tests. `emptyText?: string` is defined in Task 2 and consumed in Task 3. `undoStack[0].summary` matches `UndoEntry.summary` in `state/types.ts`.
