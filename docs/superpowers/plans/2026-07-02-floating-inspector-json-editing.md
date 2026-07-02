# Floating Inspector + Inline JSON Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the workflow-editor Inspector dockable/floating (translucent when unfocused) and give annotations and transition-criteria roomy, word-wrapped inline JSON editing via one shared pane, retiring the canvas-hiding criterion modal.

**Architecture:** Extract a shared `JsonMonacoField` pane (Monaco-or-`<textarea>`, word-wrap on, Format, grow-to-content). `AnnotationsField` adopts it; a new inline `CriterionField` (built on it) replaces `CriterionEditorModal` + `CriterionJsonEditor`. A new `InspectorFrame` wraps the existing `<Inspector>` in a single stable element whose style flips docked↔floating, adding drag/resize/translucency. All changes are `@cyoda/workflow-react`-only.

**Tech Stack:** React 19, TypeScript (ESM, explicit `.js` import extensions), inline-style design tokens (`src/style/tokens.ts`), host-injected Monaco via `useCriterionMonaco()`, Vitest + `@testing-library/react` (jsdom), Playwright (in `apps/docs-embed-demo`).

## Global Constraints

- **Package scope:** `@cyoda/workflow-react` only. **No `workflow-core` change.** Ships as a Changesets **`minor`** (0.x convention — a breaking-ish UI change is a 0.x minor, never a major).
- **ESM:** every intra-package import uses an explicit `.js` extension (e.g. `./JsonMonacoField.js`).
- **Styling:** inline `React.CSSProperties` sourced from `src/style/tokens.ts` (`colors`, `radii`, `fonts`, `btnStyle`/`primaryBtnStyle`/`ghostBtnStyle`/`destructiveBtnStyle`). No CSS modules / Tailwind / styled-components.
- **Monaco fallback is mandatory:** Monaco is `null` under jsdom, so every editor keeps the `useCriterionMonaco() === null → <textarea>` path. Unit tests exercise the textarea path; the Monaco path is covered by Playwright.
- **Inline criteria = transition host only.** `CriterionSection` is only mounted in `TransitionForm` with a `kind:"transition"` host. `setCriterion` for `processorConfig` is a no-op in `apply.ts`; workflow-level criteria use a different op. Do not attempt other hosts.
- **HARD REQUIREMENT — dock↔float MUST NOT remount `<Inspector>`.** One stable wrapper element at a fixed tree position whose *style* flips `relative`↔`fixed`; `<Inspector>` keeps element identity across toggles. Render it **in-tree, not portaled**, so editor key handlers (undo/redo/Ctrl+S) keep bubbling. There is a dedicated test for this.
- **z-index:** canvas `< 40` < floating inspector `= 40` < `ModalFrame` app modals (`9999`+). An open modal must cover the floating inspector.
- **Placement persistence** rides the existing `localStorageKey` prop and honors `localStorageKey === null` (disable). Store under a derived key `${localStorageKey}:inspector`, `try/catch`-guarded, degrading to in-memory.
- **Test commands:** whole suite `pnpm --filter @cyoda/workflow-react test`; single file `pnpm --filter @cyoda/workflow-react exec vitest run <path>`; single test add `-t "<name>"`. Typecheck: `pnpm --filter @cyoda/workflow-react typecheck`.
- **Commits:** conventional-commit subjects; footer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File Structure

- `src/inspector/JsonMonacoField.tsx` *(new)* — shared JSON pane: Monaco-or-textarea, word-wrap, Format, grow-to-content, controlled `buffer` + `seed` re-seed, optional `registerSchema`.
- `src/inspector/AnnotationsField.tsx` *(modify)* — replace its private `MonacoJsonPane`/`textarea` with `JsonMonacoField`.
- `src/inspector/CriterionField.tsx` *(new)* — inline criterion editor: preview + expand-to-edit (lazy Monaco), three-way sync, Apply/Revert/Remove; built on `JsonMonacoField`.
- `src/inspector/CriterionForm.tsx` *(modify)* — `CriterionSection` renders `CriterionField`; **delete `CriterionEditorModal`**.
- `src/inspector/CriterionJsonEditor.tsx` *(delete)* — no consumer after the modal retires.
- `src/inspector/inspectorPlacement.ts` *(new)* — pure `clampRect` + `loadPlacement`/`savePlacement` (unit-tested).
- `src/inspector/InspectorFrame.tsx` *(new)* — stable dock/float wrapper (drag, resize, translucency, no-remount).
- `src/inspector/Inspector.tsx` *(modify)* — header detach/dock button (props-driven); root fills its container.
- `src/components/WorkflowEditor.tsx` *(modify)* — mount `InspectorFrame`, thread placement state + persistence, reconcile the `setCriterion` reselect.
- `src/i18n/en.ts` *(modify)* — new labels `format`, `detachPanel`, `dockPanel`.
- Tests under `tests/`: new `jsonMonacoField.test.tsx`, `criterionField.test.tsx`, `inspectorPlacement.test.ts`, `inspectorFrame.test.tsx`; migrate `criterionModal.test.tsx`; delete `criterionJsonEditor.test.tsx`.
- `apps/docs-embed-demo/tests/visual/` — migrate `criteria-editor.spec.ts`, `criterion-delete-key.spec.ts`; add `inspector-docking.spec.ts`.
- `.changeset/*.md` *(new)*.

---

### Task 1: `JsonMonacoField` shared pane primitive

**Files:**
- Create: `packages/workflow-react/src/inspector/JsonMonacoField.tsx`
- Modify: `packages/workflow-react/src/i18n/en.ts` (add `inspector.format`)
- Test: `packages/workflow-react/tests/jsonMonacoField.test.tsx`

**Interfaces:**
- Consumes: `useCriterionMonaco()` from `./CriterionMonacoContext.js`; `installMonacoCancellationFilter` from `../components/monacoDisposal.js`; `colors, radii, fonts, ghostBtnStyle` from `../style/tokens.js`; `useMessages` from `../i18n/context.js`; types `WorkflowJsonMonacoRuntime, WorkflowJsonEditorInstance, WorkflowJsonModelLike` from `@cyoda/workflow-monaco`.
- Produces:
  ```ts
  export interface JsonMonacoFieldProps {
    buffer: string;                 // controlled text (source of truth)
    disabled: boolean;
    modelUri: string;               // e.g. cyoda://annotations/<k>.json
    onChange: (text: string) => void;
    seed?: string;                  // when this changes and differs from model text, push via setValue (no echo)
    registerSchema?: (monaco: WorkflowJsonMonacoRuntime) => { dispose(): void };
    minHeightPx?: number;           // default 120
    maxHeightPx?: number;           // default 480 (then internal scroll)
    testId: string;                 // container (Monaco) / textarea test id — callers pass their existing id
  }
  export function JsonMonacoField(props: JsonMonacoFieldProps): JSX.Element;
  ```

- [ ] **Step 1: Add the i18n label.** In `packages/workflow-react/src/i18n/en.ts`, inside the `inspector: { … }` object (after `annotationsDocChanged`, line ~87), add:

```ts
    format: "Format",
```

- [ ] **Step 2: Write the failing test** — `packages/workflow-react/tests/jsonMonacoField.test.tsx` (no `CriterionMonacoProvider` → textarea path):

```tsx
import { expect, test, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { JsonMonacoField } from "../src/inspector/JsonMonacoField.js";

afterEach(cleanup);

// No provider needed: useMessages() defaults to defaultMessages; no CriterionMonacoProvider → textarea path.
function renderField(props: Partial<React.ComponentProps<typeof JsonMonacoField>> = {}) {
  const onChange = vi.fn();
  render(
    <JsonMonacoField
      buffer={props.buffer ?? '{"a":1}'}
      disabled={props.disabled ?? false}
      modelUri="cyoda://test/x.json"
      onChange={props.onChange ?? onChange}
      testId="test-json"
      {...props}
    />,
  );
  return { onChange: props.onChange ?? onChange };
}

test("textarea path: renders the buffer and reports edits via onChange", () => {
  const { onChange } = renderField({ buffer: '{"a":1}' });
  const ta = screen.getByTestId("test-json") as HTMLTextAreaElement;
  expect(ta.value).toBe('{"a":1}');
  fireEvent.change(ta, { target: { value: '{"a":2}' } });
  expect(onChange).toHaveBeenLastCalledWith('{"a":2}');
});

test("Format re-indents valid JSON via onChange; leaves invalid JSON untouched", () => {
  const onChange = vi.fn();
  renderField({ buffer: '{"a":1,"b":2}', onChange });
  fireEvent.click(screen.getByTestId("test-json-format"));
  expect(onChange).toHaveBeenLastCalledWith('{\n  "a": 1,\n  "b": 2\n}');

  onChange.mockClear();
  cleanup();
  renderField({ buffer: "{ not json", onChange });
  fireEvent.click(screen.getByTestId("test-json-format"));
  expect(onChange).not.toHaveBeenCalled();
});

test("disabled makes the textarea read-only", () => {
  renderField({ disabled: true });
  expect((screen.getByTestId("test-json") as HTMLTextAreaElement).disabled).toBe(true);
});
```

- [ ] **Step 3: Run it, expect failure**

Run: `pnpm --filter @cyoda/workflow-react exec vitest run tests/jsonMonacoField.test.tsx`
Expected: FAIL — cannot find module `../src/inspector/JsonMonacoField.js`.

- [ ] **Step 4: Implement `JsonMonacoField.tsx`.** This generalizes `AnnotationsField`'s `MonacoJsonPane` (controlled buffer + `seed` re-seed) and adds word-wrap, a Format button, grow-to-content, and optional schema registration:

```tsx
import { useEffect, useRef } from "react";
import type {
  WorkflowJsonMonacoRuntime,
  WorkflowJsonEditorInstance,
  WorkflowJsonModelLike,
} from "@cyoda/workflow-monaco";
import { useCriterionMonaco } from "./CriterionMonacoContext.js";
import { installMonacoCancellationFilter } from "../components/monacoDisposal.js";
import { useMessages } from "../i18n/context.js";
import { colors, fonts, radii, ghostBtnStyle } from "../style/tokens.js";

export interface JsonMonacoFieldProps {
  buffer: string;
  disabled: boolean;
  modelUri: string;
  onChange: (text: string) => void;
  seed?: string;
  registerSchema?: (monaco: WorkflowJsonMonacoRuntime) => { dispose(): void };
  minHeightPx?: number;
  maxHeightPx?: number;
  testId: string;
}

/** Pretty-print if the text is valid JSON; otherwise return null (caller no-ops). */
function reformat(text: string): string | null {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return null;
  }
}

export function JsonMonacoField(props: JsonMonacoFieldProps) {
  const monaco = useCriterionMonaco();
  const messages = useMessages();
  const onFormat = () => {
    const next = reformat(props.buffer);
    if (next !== null && next !== props.buffer) props.onChange(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onFormat}
          disabled={props.disabled}
          data-testid={`${props.testId}-format`}
          style={{ ...ghostBtnStyle, fontSize: 11, padding: "2px 8px" }}
        >
          {messages.inspector.format}
        </button>
      </div>
      {monaco ? (
        <MonacoPane {...props} monaco={monaco} />
      ) : (
        <textarea
          value={props.buffer}
          disabled={props.disabled}
          rows={12}
          data-testid={props.testId}
          onChange={(e) => props.onChange(e.target.value)}
          style={{
            fontFamily: fonts.mono,
            fontSize: 12,
            padding: 8,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            border: `1px solid ${colors.border}`,
            borderRadius: radii.sm,
            background: colors.surface,
            resize: "vertical",
            minHeight: props.minHeightPx ?? 120,
          }}
        />
      )}
    </div>
  );
}

function MonacoPane({
  monaco,
  buffer,
  disabled,
  modelUri,
  onChange,
  seed,
  registerSchema,
  minHeightPx = 120,
  maxHeightPx = 480,
  testId,
}: JsonMonacoFieldProps & { monaco: WorkflowJsonMonacoRuntime }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<WorkflowJsonEditorInstance | null>(null);
  const modelRef = useRef<WorkflowJsonModelLike | null>(null);

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return;
    const model = monaco.editor.createModel(buffer, "json", monaco.Uri.parse(modelUri));
    modelRef.current = model;
    const editor = monaco.editor.create(containerRef.current, {
      model,
      automaticLayout: true,
      minimap: { enabled: false },
      wordWrap: "on",
      fontSize: 13,
      tabSize: 2,
      scrollBeyondLastLine: false,
      theme: "vs",
      readOnly: disabled,
    });
    editorRef.current = editor;
    installMonacoCancellationFilter();
    const schemaHandle = registerSchema?.(monaco) ?? null;

    // Grow-to-content up to the cap, then internal scroll.
    const applyHeight = () => {
      const h = Math.min(Math.max(editor.getContentHeight?.() ?? minHeightPx, minHeightPx), maxHeightPx);
      if (containerRef.current) containerRef.current.style.height = `${h}px`;
      editor.layout?.();
    };
    applyHeight();
    const sizeSub = editor.onDidContentSizeChange?.(applyHeight) ?? { dispose() {} };
    const sub = model.onDidChangeContent(() => onChange(model.getValue()));

    return () => {
      sub.dispose();
      sizeSub.dispose();
      schemaHandle?.dispose();
      editor.dispose();
      editorRef.current = null;
      model.dispose();
      modelRef.current = null;
    };
    // created once per modelUri; buffer is pushed via the seed effect below.
  }, [monaco, modelUri]);

  // Push external re-seed into the model without echoing (revert / undo / redo).
  useEffect(() => {
    const model = modelRef.current;
    if (model && seed !== undefined && model.getValue() !== seed) model.setValue(seed);
  }, [seed]);

  useEffect(() => {
    editorRef.current?.updateOptions?.({ readOnly: disabled });
  }, [disabled]);

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      style={{ height: minHeightPx, border: `1px solid ${colors.border}`, borderRadius: radii.sm }}
    />
  );
}
```

Note: `getContentHeight`/`onDidContentSizeChange` are optional on the runtime type — the `?.`/fallbacks keep the pane working if a host runtime omits them.

- [ ] **Step 5: Run the tests, expect pass**

Run: `pnpm --filter @cyoda/workflow-react exec vitest run tests/jsonMonacoField.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @cyoda/workflow-react typecheck`
Expected: no errors. If `getContentHeight`/`onDidContentSizeChange` aren't on `WorkflowJsonEditorInstance`, keep the optional-call form (already `?.`) — do not widen the shared runtime type in this task.

- [ ] **Step 7: Commit**

```bash
git add packages/workflow-react/src/inspector/JsonMonacoField.tsx packages/workflow-react/src/i18n/en.ts packages/workflow-react/tests/jsonMonacoField.test.tsx
git commit -m "feat(react): add shared JsonMonacoField pane (word-wrap, Format, grow-to-content)"
```

---

### Task 2: Annotations adopt `JsonMonacoField`

**Files:**
- Modify: `packages/workflow-react/src/inspector/AnnotationsField.tsx` (replace private `MonacoJsonPane` at `:99-115, :150-211` and the `textarea` fallback at `:106-115`)
- Test: `packages/workflow-react/tests/annotationsField.test.tsx` (must stay green, unchanged)

**Interfaces:**
- Consumes: `JsonMonacoField` from Task 1.
- Produces: no signature change to `AnnotationsField`.

- [ ] **Step 1: Confirm the existing annotations tests pass first (baseline)**

Run: `pnpm --filter @cyoda/workflow-react exec vitest run tests/annotationsField.test.tsx`
Expected: PASS (7 tests). This is the regression net for the refactor.

- [ ] **Step 2: Replace the pane usage.** In `AnnotationsField.tsx`, the render currently branches on `monaco ?` between `MonacoJsonPane` and a `<textarea>` (`:98-115`). Replace that whole branch with a single `JsonMonacoField`, keeping the same `data-testid="annotations-json-editor"` and driving `seed` from `buffer` so external re-seeds still push into Monaco:

```tsx
        <JsonMonacoField
          buffer={buffer}
          disabled={disabled}
          modelUri={annotationsModelUri(modelKey)}
          onChange={setBuffer}
          seed={buffer}
          testId="annotations-json-editor"
        />
```

Then delete the now-unused `MonacoJsonPane` function (`:150-211`), the `useCriterionMonaco`/`installMonacoCancellationFilter`/Monaco-type imports it needed, and the `textareaStyle` const if unreferenced. Add `import { JsonMonacoField } from "./JsonMonacoField.js";`. Keep everything else (buffer state, three-way `useEffect`, `parseAnnotationsJson` gating, Apply/Revert/Remove, error + doc-changed banners).

> Why `seed={buffer}`: `buffer` is already the controlled source of truth here; passing it as `seed` reproduces the old `MonacoJsonPane` "push external buffer changes into the model" effect (revert / three-way re-seed) without echoing.

- [ ] **Step 3: Run the annotations tests, expect pass (unchanged)**

Run: `pnpm --filter @cyoda/workflow-react exec vitest run tests/annotationsField.test.tsx`
Expected: PASS (7 tests) — same behavior, now via the shared pane.

- [ ] **Step 4: Run the annotations form-integration + typecheck**

Run: `pnpm --filter @cyoda/workflow-react exec vitest run tests/annotationsFormIntegration.test.tsx && pnpm --filter @cyoda/workflow-react typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/workflow-react/src/inspector/AnnotationsField.tsx
git commit -m "refactor(react): AnnotationsField uses shared JsonMonacoField"
```

---

### Task 3: Inline `CriterionField`

**Files:**
- Create: `packages/workflow-react/src/inspector/CriterionField.tsx`
- Test: `packages/workflow-react/tests/criterionField.test.tsx`

**Interfaces:**
- Consumes: `JsonMonacoField` (Task 1); `parseCriterionJson, criterionModelUri, CriterionJsonResult` from `./criterionJson.js`; `sameJson` from `./annotationsJson.js`; `registerCriterionSchema` from `@cyoda/workflow-monaco`; `useMessages` from `../i18n/context.js`; tokens; `defaultCriterion` (move it out of `CriterionForm.tsx` — see Task 4 — or re-declare locally). Type `Criterion` from `@cyoda/workflow-core`.
- Produces:
  ```ts
  export interface CriterionFieldProps {
    value: Criterion | undefined;
    manual?: boolean;
    disabled: boolean;
    modelKey: string;                        // `transition-${transitionUuid}`
    onCommit: (next: Criterion) => void;     // → setCriterion(...criterion)
    onRemove: () => void;                    // → setCriterion(...undefined)
  }
  export function CriterionField(props: CriterionFieldProps): JSX.Element;
  ```

Behavior: **absent** → summary text (`noneManual`/`noneAutomated`, plus `noneAutomatedWarning` when `!manual`) + an **Add criterion** button that commits `defaultCriterion("simple")`. **Present + collapsed** → a type badge + a ~140-char compact preview + **Edit** and **Remove** buttons. **Present + expanded** (Edit clicked) → the `JsonMonacoField` (Monaco lazily mounts here only) with **Apply / Revert / Remove**, three-way sync comparing parsed values, and an inline error. Collapsing (Apply, or a Collapse control) disposes the pane.

- [ ] **Step 1: Write the failing test** — `tests/criterionField.test.tsx` (textarea path; mirrors `annotationsField.test.tsx` conventions):

```tsx
import { expect, test, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CriterionField } from "../src/inspector/CriterionField.js";
import type { Criterion } from "@cyoda/workflow-core";

afterEach(cleanup);

// No provider needed (useMessages() defaults); no CriterionMonacoProvider → textarea path.
const wrap = (ui: React.ReactNode) => ui;
const simple: Criterion = { type: "simple", jsonPath: "$.x", operation: "EQUALS", value: 1 };

test("absent + automated: shows the automated warning and an Add button that commits a default", () => {
  const onCommit = vi.fn();
  render(wrap(<CriterionField value={undefined} manual={false} disabled={false} modelKey="t1" onCommit={onCommit} onRemove={vi.fn()} />));
  expect(screen.getByTestId("criterion-automated-warning")).toBeTruthy();
  fireEvent.click(screen.getByTestId("inspector-criterion-add"));
  expect(onCommit).toHaveBeenCalledWith({ type: "simple", jsonPath: "", operation: "EQUALS" });
});

test("present: collapsed preview expands to the editor on Edit; lazy pane only mounts when expanded", () => {
  render(wrap(<CriterionField value={simple} disabled={false} modelKey="t1" onCommit={vi.fn()} onRemove={vi.fn()} />));
  expect(screen.getByTestId("criterion-compact-json")).toBeTruthy();
  expect(screen.queryByTestId("criterion-json-editor")).toBeNull();          // not mounted while collapsed
  fireEvent.click(screen.getByTestId("inspector-criterion-edit"));
  expect(screen.getByTestId("criterion-json-editor")).toBeTruthy();          // mounts on expand
});

test("expanded: Apply enabled only when valid + changed; commits parsed criterion", () => {
  const onCommit = vi.fn();
  render(wrap(<CriterionField value={simple} disabled={false} modelKey="t1" onCommit={onCommit} onRemove={vi.fn()} />));
  fireEvent.click(screen.getByTestId("inspector-criterion-edit"));
  const ta = screen.getByTestId("criterion-json-editor") as HTMLTextAreaElement;
  const apply = () => screen.getByTestId("inspector-criterion-apply") as HTMLButtonElement;
  expect(apply().disabled).toBe(true); // unchanged
  fireEvent.change(ta, { target: { value: JSON.stringify({ ...simple, value: 2 }) } });
  expect(apply().disabled).toBe(false);
  fireEvent.click(apply());
  expect(onCommit).toHaveBeenCalledWith({ ...simple, value: 2 });
});

test("expanded: invalid JSON disables Apply and shows an error", () => {
  render(wrap(<CriterionField value={simple} disabled={false} modelKey="t1" onCommit={vi.fn()} onRemove={vi.fn()} />));
  fireEvent.click(screen.getByTestId("inspector-criterion-edit"));
  fireEvent.change(screen.getByTestId("criterion-json-editor"), { target: { value: "{ not json" } });
  expect((screen.getByTestId("inspector-criterion-apply") as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByTestId("criterion-error")).toBeTruthy();
});

test("Remove dispatches onRemove", () => {
  const onRemove = vi.fn();
  render(wrap(<CriterionField value={simple} disabled={false} modelKey="t1" onCommit={vi.fn()} onRemove={onRemove} />));
  fireEvent.click(screen.getByTestId("inspector-criterion-remove"));
  expect(onRemove).toHaveBeenCalledTimes(1);
});

test("three-way sync: clean buffer re-seeds on external change; dirty buffer is kept", () => {
  const { rerender } = render(wrap(<CriterionField value={simple} disabled={false} modelKey="t1" onCommit={vi.fn()} onRemove={vi.fn()} />));
  fireEvent.click(screen.getByTestId("inspector-criterion-edit"));
  const ta = () => screen.getByTestId("criterion-json-editor") as HTMLTextAreaElement;
  const next: Criterion = { ...simple, value: 9 };
  rerender(wrap(<CriterionField value={next} disabled={false} modelKey="t1" onCommit={vi.fn()} onRemove={vi.fn()} />));
  expect(JSON.parse(ta().value)).toEqual(next);          // clean → re-seed
  fireEvent.change(ta(), { target: { value: JSON.stringify({ ...simple, value: 100 }) } });
  rerender(wrap(<CriterionField value={{ ...simple, value: 55 }} disabled={false} modelKey="t1" onCommit={vi.fn()} onRemove={vi.fn()} />));
  expect(JSON.parse(ta().value)).toEqual({ ...simple, value: 100 });  // dirty → kept
  expect(screen.getByTestId("criterion-doc-changed")).toBeTruthy();
});

test("read-only shows no Add/Edit/Apply/Remove", () => {
  render(wrap(<CriterionField value={simple} disabled onCommit={vi.fn()} onRemove={vi.fn()} modelKey="t1" />));
  expect(screen.queryByTestId("inspector-criterion-edit")).toBeNull();
  expect(screen.queryByTestId("inspector-criterion-remove")).toBeNull();
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `pnpm --filter @cyoda/workflow-react exec vitest run tests/criterionField.test.tsx`
Expected: FAIL — cannot find `../src/inspector/CriterionField.js`.

- [ ] **Step 3: Implement `CriterionField.tsx`.** Mirrors `AnnotationsField`'s lifecycle but wraps it in preview/expand, and compares parsed `result.criterion` for dirty/three-way rules:

```tsx
import { useEffect, useRef, useState } from "react";
import type { Criterion } from "@cyoda/workflow-core";
import { registerCriterionSchema } from "@cyoda/workflow-monaco";
import { JsonMonacoField } from "./JsonMonacoField.js";
import { parseCriterionJson, criterionModelUri } from "./criterionJson.js";
import { sameJson } from "./annotationsJson.js";
import { useMessages } from "../i18n/context.js";
import { colors, fonts, radii, btnStyle, primaryBtnStyle, ghostBtnStyle, destructiveBtnStyle, metaChipStyle } from "../style/tokens.js";

export function defaultSimpleCriterion(): Criterion {
  return { type: "simple", jsonPath: "", operation: "EQUALS" };
}

export interface CriterionFieldProps {
  value: Criterion | undefined;
  manual?: boolean;
  disabled: boolean;
  modelKey: string;
  onCommit: (next: Criterion) => void;
  onRemove: () => void;
}

const pretty = (c: Criterion): string => JSON.stringify(c, null, 2);

export function CriterionField(props: CriterionFieldProps) {
  const m = useMessages().criterion;
  if (props.value === undefined) {
    return (
      <div style={cardStyle} data-testid="criterion-summary-card">
        <p style={summaryTextStyle}>{props.manual ? m.noneManual : m.noneAutomated}</p>
        {!props.manual && (
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
  return <CriterionEditor key={props.modelKey} {...props} value={props.value} />;
}

function CriterionEditor({ value, manual, disabled, modelKey, onCommit, onRemove }: CriterionFieldProps & { value: Criterion }) {
  const m = useMessages().criterion;
  const [expanded, setExpanded] = useState(false);
  const [buffer, setBuffer] = useState<string>(() => pretty(value));
  const [docChanged, setDocChanged] = useState(false);
  const prevValueRef = useRef<Criterion>(value);

  // Three-way sync on external value change — compare PARSED values, never buffer text.
  useEffect(() => {
    if (sameJson(prevValueRef.current, value)) return;
    const parsed = parseCriterionJson(buffer).criterion;
    if (parsed !== null && sameJson(parsed, value)) {
      setDocChanged(false);
    } else if (parsed !== null && sameJson(parsed, prevValueRef.current)) {
      setBuffer(pretty(value));
      setDocChanged(false);
    } else {
      setDocChanged(true);
    }
    prevValueRef.current = value;
  }, [value, buffer]);

  const result = parseCriterionJson(buffer);
  const dirty = result.criterion !== null && !sameJson(result.criterion, value);
  const applyEnabled = !disabled && result.criterion !== null && dirty;

  const apply = () => {
    if (!applyEnabled || result.criterion === null) return;
    onCommit(result.criterion);
    setDocChanged(false);
    setExpanded(false);
  };
  const revert = () => { setBuffer(pretty(value)); setDocChanged(false); };

  return (
    <div style={cardStyle} data-testid="criterion-summary-card">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={metaChipStyle}>{value.type}</span>
        <span style={{ flex: 1 }} />
        {!disabled && !expanded && (
          <button type="button" style={ghostBtnStyle} data-testid="inspector-criterion-edit" onClick={() => setExpanded(true)}>{m.edit}</button>
        )}
        {!disabled && (
          <button type="button" style={destructiveBtnStyle} data-testid="inspector-criterion-remove" onClick={onRemove}>{m.remove}</button>
        )}
      </div>

      {!expanded && <CompactJson criterion={value} />}

      {expanded && (
        <>
          <JsonMonacoField
            buffer={buffer}
            disabled={disabled}
            modelUri={criterionModelUri(modelKey)}
            onChange={setBuffer}
            seed={buffer}
            registerSchema={registerCriterionSchema}
            testId="criterion-json-editor"
          />
          {result.error && <div role="alert" data-testid="criterion-error" style={errorStyle}>{result.error}</div>}
          {docChanged && <div role="alert" data-testid="criterion-doc-changed" style={warnLineStyle}>{/* reuse annotations copy */}Document changed underneath — Revert to reload.</div>}
          {!disabled && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" onClick={apply} disabled={!applyEnabled} style={applyEnabled ? primaryBtnStyle : { ...primaryBtnStyle, opacity: 0.5, cursor: "not-allowed" }} data-testid="inspector-criterion-apply">{m.applyModal}</button>
              <button type="button" onClick={revert} disabled={!dirty} style={ghostBtnStyle} data-testid="inspector-criterion-revert">{m.cancel === "Cancel" ? "Revert" : m.cancel}</button>
              <button type="button" onClick={() => setExpanded(false)} style={ghostBtnStyle} data-testid="inspector-criterion-collapse">Collapse</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CompactJson({ criterion }: { criterion: Criterion }) {
  const text = JSON.stringify(criterion);
  const display = text.length > 140 ? `${text.slice(0, 137)}…` : text;
  return (
    <code data-testid="criterion-compact-json" style={{ display: "block", fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary, background: colors.surfaceMuted, padding: "6px 8px", borderRadius: radii.sm, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {display}
    </code>
  );
}

const cardStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8, padding: 10, border: `1px solid ${colors.border}`, borderRadius: radii.md, background: colors.surface };
const summaryTextStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 };
const warnStyle: React.CSSProperties = { margin: 0, padding: "6px 8px", background: colors.warningBg, border: `1px solid ${colors.warningBorder}`, borderRadius: radii.sm, color: colors.warning, fontSize: 11 };
const errorStyle: React.CSSProperties = { color: colors.danger, fontSize: 11 };
const warnLineStyle: React.CSSProperties = { color: colors.warning, fontSize: 11 };
```

> i18n note: there's no dedicated "Revert"/"Collapse"/"doc changed" criterion key. Rather than hard-code English, add `criterion.revert: "Revert"`, `criterion.collapse: "Collapse"`, and reuse `inspector.annotationsDocChanged` for the doc-changed line. **Do that in this step** — add the three references and the two new keys to `en.ts` — so no literal English strings ship. (Replace the inline `"Revert"`/`"Collapse"`/doc-changed literals above with `m.revert`, `m.collapse`, and `useMessages().inspector.annotationsDocChanged`.)

- [ ] **Step 4: Add the criterion i18n keys.** In `en.ts` `criterion: { … }`, add after `applyModal`:

```ts
    revert: "Revert",
    collapse: "Collapse",
```

- [ ] **Step 5: Run the tests, expect pass**

Run: `pnpm --filter @cyoda/workflow-react exec vitest run tests/criterionField.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 6: Typecheck, then commit**

Run: `pnpm --filter @cyoda/workflow-react typecheck`

```bash
git add packages/workflow-react/src/inspector/CriterionField.tsx packages/workflow-react/src/i18n/en.ts packages/workflow-react/tests/criterionField.test.tsx
git commit -m "feat(react): inline CriterionField (preview + expand-to-edit, three-way sync)"
```

---

### Task 4: Wire inline criteria into `TransitionForm`; retire the modal + `CriterionJsonEditor`; reconcile reselect

**Files:**
- Modify: `packages/workflow-react/src/inspector/CriterionForm.tsx` (replace `CriterionSection` internals; delete `CriterionEditorModal`, `CriterionSummaryCard`, `defaultCriterion`)
- Delete: `packages/workflow-react/src/inspector/CriterionJsonEditor.tsx`
- Delete: `packages/workflow-react/tests/criterionJsonEditor.test.tsx`
- Modify: `packages/workflow-react/src/components/WorkflowEditor.tsx` (`:305-323`)
- Modify (migrate): `packages/workflow-react/tests/criterionModal.test.tsx` → `tests/criterionInline.test.tsx`

**Interfaces:**
- Consumes: `CriterionField` (Task 3), the existing `setCriterion` patch (`op:"setCriterion"`, `host`, `path:["criterion"]`).
- Produces: `CriterionSection` keeps its current prop signature (`host, stateCode?, transitionName?, targetState?, manual?, criterion, disabled, onDispatch, onSelectionChange?`) so `TransitionForm.tsx:324-334` needs no change.

- [ ] **Step 1: Rewrite `CriterionSection` to render `CriterionField`.** Replace the whole body of `CriterionForm.tsx` with the thin wrapper below and remove `CriterionEditorModal`, `CriterionSummaryCard`, `CriterionCompactJson`, `SectionHeader`, `defaultCriterion`, and their styles/imports:

```tsx
import type { Criterion, DomainPatch, HostRef } from "@cyoda/workflow-core";
import type { Selection } from "../state/types.js";
import { CriterionField } from "./CriterionField.js";

function criterionModelKey(host: HostRef): string {
  if (host.kind === "transition") return `transition-${host.transitionUuid}`;
  if (host.kind === "processorConfig") return `processor-${host.processorUuid}`;
  return `host-${host.workflow}`;
}

export function CriterionSection({
  host, manual, criterion, disabled, onDispatch, onSelectionChange,
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
  const path = ["criterion"];
  return (
    <CriterionField
      value={criterion}
      manual={manual}
      disabled={disabled}
      modelKey={criterionModelKey(host)}
      onCommit={(next) => onDispatch({ op: "setCriterion", host, path, criterion: next })}
      onRemove={() => onDispatch({ op: "setCriterion", host, path, criterion: undefined })}
    />
  );
}
```

> The old `removeCriterion` reselect (`CriterionForm.tsx:51-55`) and the modal's `onApplied` reselect (`:77-88`) are both **deleted** — the dispatch-level intercept in `WorkflowEditor` is the single reselect path (adjusted in Step 3). `stateCode`/`transitionName`/`targetState` props remain accepted (for signature compatibility) but unused.

- [ ] **Step 2: Delete the dead modal editor + its test**

```bash
git rm packages/workflow-react/src/inspector/CriterionJsonEditor.tsx packages/workflow-react/tests/criterionJsonEditor.test.tsx
```

- [ ] **Step 3: Simplify the `setCriterion` reselect in `WorkflowEditor.tsx`.** The transition UUID is stable across `setCriterion`, so `TransitionForm` won't remount; the deferred `setTimeout(50)` reselect is now unnecessary churn. Replace the intercept block (`:305-323`) so it still records the transaction with `selectionAfter` but drops the timer:

```tsx
      if (patch.op === "setCriterion" && patch.host.kind === "transition") {
        const restoreSelection: Selection = {
          kind: "transition",
          transitionUuid: patch.host.transitionUuid,
        };
        actions.dispatchTransaction({
          summary: patch.criterion ? "Set criterion" : "Clear criterion",
          patches: [patch],
          inverses: [invertPatch(state.document, patch)],
          selectionAfter: restoreSelection,
        });
        return;
      }
```

Remove `pendingSelectionRestoreRef` if it has no other users (grep first: `grep -n pendingSelectionRestoreRef packages/workflow-react/src/components/WorkflowEditor.tsx`; if only these lines, delete the `useRef` at `:227` and the `sameSelection` import if now unused).

- [ ] **Step 4: Migrate the modal e2e-ish unit test.** `git mv tests/criterionModal.test.tsx tests/criterionInline.test.tsx`, then update it: it selects a transition via the mocked Canvas and previously clicked `inspector-criterion-edit` → asserted `criterion-editor-modal`. Now it must click `inspector-criterion-edit` to **expand inline** and assert `criterion-json-editor` is present (no modal), edit the textarea, click `inspector-criterion-apply`, and assert the dispatched `setCriterion` patch reached the document. Keep the "select auto transition" harness; drop every `criterion-editor-modal` / `criterion-modal-*` query.

- [ ] **Step 5: Run the affected tests + typecheck**

Run: `pnpm --filter @cyoda/workflow-react exec vitest run tests/criterionInline.test.tsx tests/criterionField.test.tsx && pnpm --filter @cyoda/workflow-react typecheck`
Expected: PASS; no type errors; no dangling imports of `CriterionJsonEditor`/`CriterionEditorModal` (grep to confirm: `grep -rn "CriterionEditorModal\|CriterionJsonEditor" packages/workflow-react/src` returns nothing).

- [ ] **Step 6: Run the full package suite (catch collateral)**

Run: `pnpm --filter @cyoda/workflow-react test`
Expected: PASS. If any other test referenced the modal test-ids, update it to the inline ids.

- [ ] **Step 7: Commit**

```bash
git add -A packages/workflow-react/src/inspector/CriterionForm.tsx packages/workflow-react/src/components/WorkflowEditor.tsx packages/workflow-react/tests/
git commit -m "feat(react): inline transition criteria; retire CriterionEditorModal + CriterionJsonEditor"
```

---

### Task 5: Placement helpers (`clampRect`, persistence) — pure & unit-tested

**Files:**
- Create: `packages/workflow-react/src/inspector/inspectorPlacement.ts`
- Test: `packages/workflow-react/tests/inspectorPlacement.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type PlacementMode = "docked" | "floating";
  export interface FloatRect { left: number; top: number; width: number; height: number; }
  export interface Placement { mode: PlacementMode; rect: FloatRect; }
  export const MIN_FLOAT_W = 340;
  export const MIN_FLOAT_H = 260;
  export function clampRect(rect: FloatRect, viewport: { w: number; h: number }): FloatRect;
  export function placementStorageKey(base: string): string;   // `${base}:inspector`
  export function loadPlacement(base: string | null): Placement | null;
  export function savePlacement(base: string | null, p: Placement): void;
  ```

- [ ] **Step 1: Write the failing test** — `tests/inspectorPlacement.test.ts`:

```ts
import { expect, test, beforeEach } from "vitest";
import { clampRect, loadPlacement, savePlacement, placementStorageKey, MIN_FLOAT_W, MIN_FLOAT_H } from "../src/inspector/inspectorPlacement.js";

beforeEach(() => localStorage.clear());

test("clampRect enforces min size and keeps the panel within the viewport", () => {
  const r = clampRect({ left: -50, top: -20, width: 100, height: 100 }, { w: 1000, h: 800 });
  expect(r.width).toBe(MIN_FLOAT_W);
  expect(r.height).toBe(MIN_FLOAT_H);
  expect(r.left).toBe(0);
  expect(r.top).toBe(0);
});

test("clampRect pulls an off-right/bottom panel back inside", () => {
  const r = clampRect({ left: 5000, top: 5000, width: 400, height: 300 }, { w: 1000, h: 800 });
  expect(r.left).toBe(1000 - 400);
  expect(r.top).toBe(800 - 300);
});

test("save/load round-trips under the derived key; null base disables persistence", () => {
  const p = { mode: "floating" as const, rect: { left: 10, top: 20, width: 400, height: 300 } };
  savePlacement("cyoda-editor-layout", p);
  expect(localStorage.getItem(placementStorageKey("cyoda-editor-layout"))).toBeTruthy();
  expect(loadPlacement("cyoda-editor-layout")).toEqual(p);

  savePlacement(null, p);                 // opt-out: no write
  expect(loadPlacement(null)).toBeNull();
});

test("loadPlacement tolerates corrupt storage", () => {
  localStorage.setItem(placementStorageKey("k"), "{not json");
  expect(loadPlacement("k")).toBeNull();
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `pnpm --filter @cyoda/workflow-react exec vitest run tests/inspectorPlacement.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `inspectorPlacement.ts`:**

```ts
export type PlacementMode = "docked" | "floating";
export interface FloatRect { left: number; top: number; width: number; height: number; }
export interface Placement { mode: PlacementMode; rect: FloatRect; }

export const MIN_FLOAT_W = 340;
export const MIN_FLOAT_H = 260;

export function clampRect(rect: FloatRect, viewport: { w: number; h: number }): FloatRect {
  const width = Math.min(Math.max(rect.width, MIN_FLOAT_W), viewport.w);
  const height = Math.min(Math.max(rect.height, MIN_FLOAT_H), viewport.h);
  const left = Math.min(Math.max(rect.left, 0), Math.max(0, viewport.w - width));
  const top = Math.min(Math.max(rect.top, 0), Math.max(0, viewport.h - height));
  return { left, top, width, height };
}

export function placementStorageKey(base: string): string {
  return `${base}:inspector`;
}

export function loadPlacement(base: string | null): Placement | null {
  if (base === null) return null;
  try {
    const raw = localStorage.getItem(placementStorageKey(base));
    if (!raw) return null;
    const p = JSON.parse(raw) as Placement;
    if (p && (p.mode === "docked" || p.mode === "floating") && p.rect) return p;
    return null;
  } catch {
    return null;
  }
}

export function savePlacement(base: string | null, p: Placement): void {
  if (base === null) return;
  try {
    localStorage.setItem(placementStorageKey(base), JSON.stringify(p));
  } catch {
    /* storage blocked/partitioned → in-memory only */
  }
}
```

- [ ] **Step 4: Run the tests, expect pass**

Run: `pnpm --filter @cyoda/workflow-react exec vitest run tests/inspectorPlacement.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/workflow-react/src/inspector/inspectorPlacement.ts packages/workflow-react/tests/inspectorPlacement.test.ts
git commit -m "feat(react): inspector placement helpers (clampRect + guarded persistence)"
```

---

### Task 6: `InspectorFrame` (dock/float wrapper) + Inspector header toggle

**Files:**
- Create: `packages/workflow-react/src/inspector/InspectorFrame.tsx`
- Modify: `packages/workflow-react/src/inspector/Inspector.tsx` (header button; root fills container)
- Modify: `packages/workflow-react/src/i18n/en.ts` (`inspector.detachPanel`, `inspector.dockPanel`)
- Test: `packages/workflow-react/tests/inspectorFrame.test.tsx`

**Interfaces:**
- Consumes: `PlacementMode, FloatRect, clampRect, MIN_FLOAT_W, MIN_FLOAT_H` from `./inspectorPlacement.js`.
- Produces:
  ```ts
  export const FLOATING_Z = 40;
  export interface InspectorFrameProps {
    mode: PlacementMode;
    rect: FloatRect;                 // used only when floating
    dockedWidth: number;
    onRectChange: (rect: FloatRect) => void;
    onDockedWidthChange: (w: number) => void;
    children: React.ReactNode;       // the <Inspector/>
  }
  export function InspectorFrame(props: InspectorFrameProps): JSX.Element;
  ```
- Inspector gains two optional props: `docked?: boolean; onToggleDock?: () => void;` — when `onToggleDock` is set, render a header button (test id `inspector-dock-toggle`) beside `×`.

- [ ] **Step 1: Add the i18n labels.** In `en.ts` `inspector`, add:

```ts
    detachPanel: "Detach panel",
    dockPanel: "Dock panel",
```

- [ ] **Step 2: Write the failing test** — `tests/inspectorFrame.test.tsx` (focus: the no-remount guarantee + mode-driven positioning; drag/resize/translucency are covered by Playwright in Task 8):

```tsx
import { expect, test, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { InspectorFrame } from "../src/inspector/InspectorFrame.js";

afterEach(cleanup);

function Child({ onMount }: { onMount: () => void }) {
  const seen = useRef(false);
  useEffect(() => { if (!seen.current) { seen.current = true; onMount(); } }, [onMount]);
  return <div data-testid="child">content</div>;
}

test("toggling mode does NOT remount children (Monaco-state preservation)", () => {
  const onMount = vi.fn();
  const rect = { left: 40, top: 40, width: 400, height: 300 };
  const { rerender } = render(
    <InspectorFrame mode="docked" rect={rect} dockedWidth={384} onRectChange={vi.fn()} onDockedWidthChange={vi.fn()}>
      <Child onMount={onMount} />
    </InspectorFrame>,
  );
  expect(onMount).toHaveBeenCalledTimes(1);
  rerender(
    <InspectorFrame mode="floating" rect={rect} dockedWidth={384} onRectChange={vi.fn()} onDockedWidthChange={vi.fn()}>
      <Child onMount={onMount} />
    </InspectorFrame>,
  );
  expect(onMount).toHaveBeenCalledTimes(1);          // same element identity → no remount
});

test("floating mode positions the panel fixed at the rect", () => {
  const rect = { left: 40, top: 50, width: 420, height: 320 };
  render(
    <InspectorFrame mode="floating" rect={rect} dockedWidth={384} onRectChange={vi.fn()} onDockedWidthChange={vi.fn()}>
      <div data-testid="child">c</div>
    </InspectorFrame>,
  );
  const panel = screen.getByTestId("inspector-frame");
  expect(panel.style.position).toBe("fixed");
  expect(panel.style.left).toBe("40px");
  expect(panel.style.width).toBe("420px");
});

test("docked mode is relative and sized by dockedWidth; the col-resize handle is present", () => {
  render(
    <InspectorFrame mode="docked" rect={{ left: 0, top: 0, width: 400, height: 300 }} dockedWidth={384} onRectChange={vi.fn()} onDockedWidthChange={vi.fn()}>
      <div data-testid="child">c</div>
    </InspectorFrame>,
  );
  const panel = screen.getByTestId("inspector-frame");
  expect(panel.style.position).toBe("relative");
  expect(panel.style.width).toBe("384px");
  expect(screen.getByTestId("inspector-resize-handle")).toBeTruthy();
});
```

- [ ] **Step 3: Run it, expect failure**

Run: `pnpm --filter @cyoda/workflow-react exec vitest run tests/inspectorFrame.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `InspectorFrame.tsx`.** One stable `<div data-testid="inspector-frame">` whose style flips; siblings (resize handle vs drag/resize grips) are conditional but never wrap the children:

```tsx
import { useRef } from "react";
import { colors } from "../style/tokens.js";
import { clampRect, MIN_FLOAT_W, MIN_FLOAT_H, type FloatRect, type PlacementMode } from "./inspectorPlacement.js";

export const FLOATING_Z = 40;

export interface InspectorFrameProps {
  mode: PlacementMode;
  rect: FloatRect;
  dockedWidth: number;
  onRectChange: (rect: FloatRect) => void;
  onDockedWidthChange: (w: number) => void;
  children: React.ReactNode;
}

export function InspectorFrame({ mode, rect, dockedWidth, onRectChange, onDockedWidthChange, children }: InspectorFrameProps) {
  const grabbedRef = useRef(false);

  // Docked width drag (mirrors the old handleInspectorResizeStart).
  const startWidthDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = dockedWidth;
    const onMove = (ev: MouseEvent) => onDockedWidthChange(Math.max(360, startW + (startX - ev.clientX)));
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });

  const startMove = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;   // don't drag from header buttons
    e.preventDefault();
    grabbedRef.current = true;
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    const onMove = (ev: MouseEvent) => onRectChange(clampRect({ ...rect, left: ev.clientX - dx, top: ev.clientY - dy }, viewport()));
    const onUp = () => { grabbedRef.current = false; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, sw = rect.width, sh = rect.height;
    const onMove = (ev: MouseEvent) => onRectChange(clampRect({ ...rect, width: Math.max(MIN_FLOAT_W, sw + (ev.clientX - sx)), height: Math.max(MIN_FLOAT_H, sh + (ev.clientY - sy)) }, viewport()));
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const floating = mode === "floating";
  const style: React.CSSProperties = floating
    ? { position: "fixed", left: rect.left, top: rect.top, width: rect.width, height: rect.height, zIndex: FLOATING_Z, boxShadow: "0 22px 48px -12px rgba(15,23,42,0.42)", borderRadius: 12, overflow: "hidden", display: "flex" }
    : { position: "relative", flex: `0 0 ${dockedWidth}px`, width: dockedWidth, height: "100%", display: "flex" };

  return (
    <>
      {!floating && (
        <div
          data-testid="inspector-resize-handle"
          onMouseDown={startWidthDrag}
          style={{ width: 3, flexShrink: 0, cursor: "col-resize", background: "transparent", borderLeft: `1px solid ${colors.borderSubtle}`, zIndex: 10 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = colors.border)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        />
      )}
      <div
        data-testid="inspector-frame"
        className={floating ? "cyoda-inspector-floating" : undefined}
        onMouseDownCapture={floating ? startMove : undefined}
        style={style}
      >
        {children}
        {floating && (
          <div
            data-testid="inspector-resize-grip"
            onMouseDown={startResize}
            style={{ position: "absolute", right: 2, bottom: 2, width: 16, height: 16, cursor: "nwse-resize", zIndex: 5 }}
          />
        )}
      </div>
    </>
  );
}
```

> **Translucency** is CSS-driven (can't be unit-tested in jsdom; Playwright covers it in Task 8). Add a module-level stylesheet-injection once, or (preferred, no global CSS files in this package) a `<style>` string rendered once by `WorkflowEditor` in Task 7:
> ```css
> .cyoda-inspector-floating { opacity: .55; transition: opacity .18s ease; }
> .cyoda-inspector-floating:hover, .cyoda-inspector-floating:focus-within { opacity: 1; }
> @media (hover: none) { .cyoda-inspector-floating { opacity: 1; } }
> @media (prefers-reduced-motion: reduce) { .cyoda-inspector-floating { transition: none; } }
> ```
> `startMove` uses `onMouseDownCapture` so the drag begins before Monaco swallows the event, but bails on header buttons; the header is the only draggable strip because `Inspector`'s body sits below it and the grip has its own handler.

- [ ] **Step 5: Add the header toggle to `Inspector.tsx`.** Extend `InspectorProps` with `docked?: boolean; onToggleDock?: () => void;`. In the header (`Inspector.tsx:85-124`), before the existing `onClose` button, render:

```tsx
        {onToggleDock && (
          <button
            type="button"
            aria-label={docked ? messages.inspector.detachPanel : messages.inspector.dockPanel}
            title={docked ? messages.inspector.detachPanel : messages.inspector.dockPanel}
            data-testid="inspector-dock-toggle"
            onClick={onToggleDock}
            style={{ width: 24, height: 24, border: `1px solid ${colors.border}`, borderRadius: radii.sm, background: "white", color: colors.textSecondary, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, fontSize: 13 }}
          >
            {docked ? "⤢" : "⤡"}
          </button>
        )}
```

Also change the root `<aside>` style so it **fills its frame** rather than sizing itself: replace `flex: 0 0 ${width}px, width, minWidth: 360` with `flex: 1 1 auto, width: "100%", height: "100%", minWidth: 0`. Keep the `width` prop in the signature (now unused for layout) to avoid touching call sites in this task; it's removed in Task 7.

- [ ] **Step 6: Run the frame test + full suite + typecheck**

Run: `pnpm --filter @cyoda/workflow-react exec vitest run tests/inspectorFrame.test.tsx && pnpm --filter @cyoda/workflow-react test && pnpm --filter @cyoda/workflow-react typecheck`
Expected: PASS (frame 3 tests + full suite), no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/workflow-react/src/inspector/InspectorFrame.tsx packages/workflow-react/src/inspector/Inspector.tsx packages/workflow-react/src/i18n/en.ts packages/workflow-react/tests/inspectorFrame.test.tsx
git commit -m "feat(react): InspectorFrame dock/float wrapper + header detach toggle"
```

---

### Task 7: Wire `InspectorFrame` into `WorkflowEditor` (state, persistence, translucency CSS)

**Files:**
- Modify: `packages/workflow-react/src/components/WorkflowEditor.tsx`
- Test: `packages/workflow-react/tests/inspectorDocking.test.tsx`

**Interfaces:**
- Consumes: `InspectorFrame` (Task 6); `loadPlacement, savePlacement, clampRect, type Placement, type FloatRect, type PlacementMode` (Task 5).

- [ ] **Step 1: Write the failing integration test** — `tests/inspectorDocking.test.tsx`. Reuse the mocked-Canvas + document harness from `criterionInline.test.tsx` (copy its `vi.mock("../src/components/Canvas.js", …)` and doc-builder). Render `<WorkflowEditor>` in editor mode, select a transition to open the inspector, then assert the detach toggle flips docked↔floating:

```tsx
// (imports + Canvas mock + doc builder copied from criterionInline.test.tsx)
test("detach toggles the inspector between docked and floating", async () => {
  renderEditorWithSelectedTransition();                 // helper from the shared harness
  const frame = () => screen.getByTestId("inspector-frame");
  expect(frame().style.position).toBe("relative");
  fireEvent.click(screen.getByTestId("inspector-dock-toggle"));
  expect(frame().style.position).toBe("fixed");
  fireEvent.click(screen.getByTestId("inspector-dock-toggle"));
  expect(frame().style.position).toBe("relative");
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `pnpm --filter @cyoda/workflow-react exec vitest run tests/inspectorDocking.test.tsx`
Expected: FAIL — no `inspector-dock-toggle` yet wired / `inspector-frame` not mounted by the editor.

- [ ] **Step 3: Add placement state + persistence to `WorkflowEditor`.** Near the other `useState` (`:205`):

```tsx
  const [placement, setPlacement] = useState<Placement>(() =>
    loadPlacement(localStorageKey) ?? { mode: "docked", rect: { left: 120, top: 96, width: 460, height: 560 } },
  );
  useEffect(() => { savePlacement(localStorageKey, placement); }, [placement, localStorageKey]);
  const toggleDock = useCallback(() => {
    setPlacement((p) => {
      if (p.mode === "docked") {
        const seeded = clampRect(
          { left: Math.max(24, window.innerWidth - inspectorWidth - 40), top: 84, width: Math.max(inspectorWidth, 460), height: Math.min(window.innerHeight - 120, 640) },
          { w: window.innerWidth, h: window.innerHeight },
        );
        return { mode: "floating", rect: seeded };
      }
      return { ...p, mode: "docked" };
    });
  }, [inspectorWidth]);
```

(Keep `inspectorWidth`/`setInspectorWidth`; the frame now owns the docked-width drag, so the old `handleInspectorResizeStart` can be removed once the mount is swapped — grep for other users first.)

- [ ] **Step 4: Swap the inspector mount (`:1065-1093`).** Replace the fragment (`resize handle` + `<Inspector>`) with the frame wrapping `<Inspector>`; drop the now-duplicated col-resize `<div>` (the frame renders it in docked mode):

```tsx
          {inspectorVisible && (
            <InspectorFrame
              mode={placement.mode}
              rect={placement.rect}
              dockedWidth={inspectorWidth}
              onRectChange={(rect) => setPlacement((p) => ({ ...p, rect }))}
              onDockedWidthChange={setInspectorWidth}
            >
              <Inspector
                document={state.document}
                selection={state.selection}
                issues={derived.issues}
                readOnly={readOnly}
                onDispatch={dispatch}
                onSelectionChange={handleSelectionChange}
                onClose={() => handleSelectionChange(null)}
                onRequestDeleteState={requestDeleteState}
                docked={placement.mode === "docked"}
                onToggleDock={toggleDock}
              />
            </InspectorFrame>
          )}
```

Remove the `width={inspectorWidth}` prop from `<Inspector>` (and drop the now-unused `width` prop from `InspectorProps` in `Inspector.tsx`). Add imports for `InspectorFrame` and the placement helpers.

- [ ] **Step 5: Inject the translucency stylesheet once.** Add a single static `<style>` inside the editor's root render (near the top-level container return), containing the CSS from Task 6 Step 4 (the `.cyoda-inspector-floating` rules). A plain string in a `<style>` element is fine — no CSS-file tooling needed.

- [ ] **Step 6: Run the docking test, the full suite, and typecheck**

Run: `pnpm --filter @cyoda/workflow-react exec vitest run tests/inspectorDocking.test.tsx && pnpm --filter @cyoda/workflow-react test && pnpm --filter @cyoda/workflow-react typecheck`
Expected: PASS across the board. Fix any leftover references to the removed `handleInspectorResizeStart` / `Inspector width` prop.

- [ ] **Step 7: Commit**

```bash
git add packages/workflow-react/src/components/WorkflowEditor.tsx packages/workflow-react/src/inspector/Inspector.tsx packages/workflow-react/tests/inspectorDocking.test.tsx
git commit -m "feat(react): mount InspectorFrame, thread placement + persistence + translucency"
```

---

### Task 8: Playwright coverage (migrate modal specs, add docking spec) + Changeset

**Files:**
- Modify: `apps/docs-embed-demo/tests/visual/criteria-editor.spec.ts`, `apps/docs-embed-demo/tests/visual/criterion-delete-key.spec.ts`
- Create: `apps/docs-embed-demo/tests/visual/inspector-docking.spec.ts`
- Create: `.changeset/floating-inspector-inline-json.md`

**Interfaces:** none (e2e drives the real editor + real Monaco on `/editor`).

- [ ] **Step 1: Migrate `criteria-editor.spec.ts`.** It currently clicks `inspector-criterion-edit` and asserts `criterion-editor-modal`, then interacts with `criterion-modal-apply`. Rewrite the flow to: select a transition, click `inspector-criterion-edit` to **expand inline**, assert `criterion-json-editor` is visible and **no** `criterion-editor-modal` exists, type valid criterion JSON into the Monaco pane, click `inspector-criterion-apply`, and assert the change took (e.g. the compact preview updates / the badge reflects the type). Update every `criterion-modal-*` selector to the inline `inspector-criterion-*` ids.

- [ ] **Step 2: Migrate `criterion-delete-key.spec.ts` (regression guard).** This proves Backspace/Delete inside the criterion editor does **not** delete the transition. Now the editor is inline (not shielded by a modal overlay), so: select a transition, expand the criterion (`inspector-criterion-edit`), focus the Monaco pane, press Backspace/Delete repeatedly, and assert the transition still exists (node/edge count unchanged). This validates the `isTypingTarget` guard (`WorkflowEditor.tsx:128-140`) against the inline pane.

- [ ] **Step 3: Add `inspector-docking.spec.ts`:**

```ts
import { test, expect } from "@playwright/test";

test("inspector detaches, floats, and preserves Monaco state across dock/float", async ({ page }) => {
  await page.goto("/editor");
  // select a transition so the inspector shows (reuse the app's selection affordance)
  await page.getByTestId("inspector-dock-toggle").click();               // detach
  const frame = page.getByTestId("inspector-frame");
  await expect(frame).toHaveCSS("position", "fixed");

  // Expand annotations/criteria, type into Monaco, then toggle and assert the buffer survives.
  await page.getByTestId("inspector-criterion-edit").click();
  const editor = frame.locator(".monaco-editor").first();
  await editor.click();
  await page.keyboard.type(" ");
  await page.getByTestId("inspector-dock-toggle").click();               // dock
  await page.getByTestId("inspector-dock-toggle").click();               // detach again
  await expect(frame.locator(".monaco-editor")).toBeVisible();           // not remounted away
});
```

Adjust the selection step to the demo app's real affordance (check how `annotations-lifecycle.spec.ts` selects a transition and reuse that).

- [ ] **Step 4: Run the Playwright suite**

Run: `pnpm --filter docs-embed-demo exec playwright test tests/visual/criteria-editor.spec.ts tests/visual/criterion-delete-key.spec.ts tests/visual/inspector-docking.spec.ts`
(If the demo needs a dev server, follow the existing `annotations-lifecycle.spec.ts` setup / `playwright.config` webServer.)
Expected: PASS. Fix selectors until green.

- [ ] **Step 5: Add the Changeset.** Create `.changeset/floating-inspector-inline-json.md`:

```md
---
"@cyoda/workflow-react": minor
---

Dockable/floating, translucent Inspector and roomy inline JSON editing. The
inspector can detach into a draggable, resizable panel that fades when
unfocused so the workflow canvas stays visible. Annotations and transition
criteria now edit inline via a shared word-wrapped, format-capable JSON pane
(`JsonMonacoField`); the canvas-hiding criterion modal is retired. Placement
persists via the existing `localStorageKey` (honoring its `null` opt-out).
No `@cyoda/workflow-core` change (0.x minor per convention).
```

- [ ] **Step 6: Final full check + commit**

Run: `pnpm --filter @cyoda/workflow-react test && pnpm --filter @cyoda/workflow-react typecheck`
Expected: PASS.

```bash
git add apps/docs-embed-demo/tests/visual/ .changeset/floating-inspector-inline-json.md
git commit -m "test(e2e): migrate criterion specs to inline; add inspector-docking spec; changeset"
```

---

## Self-Review

**Spec coverage:**
- Placement layer (dock/float, drag, resize, translucency, toggle) → Tasks 5–7. ✓
- No-remount hard requirement → Task 6 (dedicated test) + Task 7 (single mount). ✓
- In-tree/z-index → Task 6 (`FLOATING_Z = 40`, no portal) + Global Constraints. ✓
- Persistence under `localStorageKey` + `null` opt-out → Task 5 + Task 7. ✓
- `JsonMonacoField` (word-wrap, Format, grow-to-content, seed, schema) → Task 1. ✓
- Annotations adopt it → Task 2. ✓
- Inline criteria (preview+expand lazy Monaco, three-way sync on parsed value, transition-host only) → Tasks 3–4. ✓
- Retire modal + `CriterionJsonEditor`; reconcile both reselect paths → Task 4. ✓
- Translucency focus/coarse-pointer/reduced-motion caveats → Task 6 CSS. ✓
- Tests incl. Monaco-survives-toggle, lazy-mount, delete-key regression, modal-spec migration → Tasks 6, 3, 8. ✓
- Changeset (react minor, no core) → Task 8. ✓

**Placeholder scan:** No TBD/TODO; every code step shows real code. The two "reuse the demo's selection affordance" notes in Task 8 are e2e wiring against an app this plan doesn't fully enumerate — the referenced `annotations-lifecycle.spec.ts` is the concrete template.

**Type consistency:** `JsonMonacoFieldProps` (Task 1) is consumed with matching props in Tasks 2 & 3. `Placement`/`FloatRect`/`clampRect`/`MIN_FLOAT_*` (Task 5) match their use in Tasks 6 & 7. `CriterionSection`'s prop signature is preserved (Task 4) so `TransitionForm:324` is untouched. `InspectorFrameProps` (Task 6) matches the Task 7 mount. Inspector's new `docked`/`onToggleDock` props are defined in Task 6 and passed in Task 7.

**Known risk to watch during execution:** grow-to-content and translucency are not jsdom-testable; they rely on Task 8's Playwright specs. If a host Monaco runtime lacks `getContentHeight`/`onDidContentSizeChange`, the pane falls back to a fixed min height (acceptable) — do not add these to the shared runtime type as part of this plan.
