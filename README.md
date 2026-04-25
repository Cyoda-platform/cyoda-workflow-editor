# Cyoda Workflow Editor

A TypeScript monorepo of reusable packages for parsing, projecting,
rendering, and editing Cyoda workflow JSON. The same building blocks power
three distinct use cases:

1. **Display-only embeds** — a slim SVG viewer you drop onto a static website
   or documentation page.
2. **Full editor** — a React Flow + Inspector shell for read/write editing
   inside the Cyoda configurator or any React app.
3. **Developer playground** — Monaco JSON editing kept in sync with the
   canvas, both driving the same canonical model.

Canonical state is the Cyoda workflow JSON; the graph is a projection only.
Round-tripping is byte-identical.

> Repo-local implementation notes currently live in
> [`ai/PLAN-workflow-editor-editing.md`](ai/PLAN-workflow-editor-editing.md).

---

## Repository layout

```
workflow-editor/
├── packages/
│   ├── workflow-core      # Pure domain: parse, normalize, validate, patch, serialize
│   ├── workflow-graph     # Projection: domain → nodes/edges/annotations
│   ├── workflow-viewer    # Slim read-only SVG renderer (no React Flow, no Monaco)
│   ├── workflow-layout    # ELK adapter (three presets, sync + worker)
│   ├── workflow-react     # Full editor shell (React Flow + Inspector + modals)
│   └── workflow-monaco    # Monaco JSON editor wired to the domain
├── apps/
│   └── docs-embed-demo    # Minimal viewer-embedding example (Vite + Playwright)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

Package dependency graph:

```
workflow-core
   ├── workflow-graph ──┬── workflow-viewer
   │                    ├── workflow-layout
   │                    └── workflow-react ── (peer: react, reactflow)
   └── workflow-monaco  ── (peer: monaco-editor, optional react)
```

Packages use explicit `exports` (no `export *` at roots) and ship ESM + CJS
+ `.d.ts` via `tsup`.

## Package publication targets

Publishable npm packages under the `@cyoda` scope:

- `@cyoda/workflow-core`
- `@cyoda/workflow-graph`
- `@cyoda/workflow-layout`
- `@cyoda/workflow-monaco`
- `@cyoda/workflow-react`
- `@cyoda/workflow-viewer`

Private workspace packages:

- `cyoda-workflow-editor` (root workspace package)
- `@cyoda/docs-embed-demo` (internal demo app)

All public packages are published to npm under the `@cyoda` scope with
Changesets-managed versioning.

---

## In-situ run

Prerequisites: Node ≥ 20, pnpm ≥ 9.

```sh
pnpm install

# Build every package
pnpm build

# Typecheck the whole workspace
pnpm typecheck

# Run all unit tests
pnpm test

# Run micro-benchmarks (parse/validate/serialize/patch budgets per spec §22.3)
pnpm bench

# Launch the docs-embed-demo (viewer on a static page)
pnpm --filter @cyoda/docs-embed-demo dev
# → http://localhost:5173
```

Per-package commands follow the same pattern:

```sh
pnpm --filter @cyoda/workflow-core test
pnpm --filter @cyoda/workflow-core test:watch
pnpm --filter @cyoda/workflow-core bench
pnpm --filter @cyoda/workflow-core build
```

Visual regression (Playwright) inside `apps/docs-embed-demo`:

```sh
pnpm --filter @cyoda/docs-embed-demo visual:update   # capture baselines
pnpm --filter @cyoda/docs-embed-demo test:visual     # diff vs baselines
```

[Inference] Playwright browsers must be installed once via `pnpm exec
playwright install chromium` before the visual commands succeed.

## Release and publishing

This monorepo uses [Changesets](https://github.com/changesets/changesets)
for versioning and npm releases. Detailed release policy lives in
[`ai/npm-release-mechanism.md`](ai/npm-release-mechanism.md).

Release rules:

- Changesets is the source of truth for package versions.
- CI is the only publisher.
- Do not run `npm publish` from a laptop.
- `cyoda-workflow-editor` and `@cyoda/docs-embed-demo` remain private.
- Trusted publishing via GitHub Actions OIDC is preferred; bootstrap token
  publishing is temporary only.

Stable release flow:

```sh
# 1. Add a changeset in the PR that changes a public package
pnpm changeset

# 2. Merge PRs to main; CI maintains the Version Packages PR

# 3. Review and merge the Version Packages PR when ready to ship

# 4. CI publishes changed public packages from main
```

Prerelease flow uses Changesets prerelease mode:

```sh
pnpm prerelease:enter rc
pnpm version-packages
# commit the prerelease versions on the stabilization branch
# then use the release workflow from CI for publication
pnpm prerelease:exit
```

The release workflow publishes only the public library packages listed above.
The root workspace package and `@cyoda/docs-embed-demo` are not publish
targets.

Consumer install examples:

```sh
npm install @cyoda/workflow-core
npm install @cyoda/workflow-core @cyoda/workflow-graph @cyoda/workflow-viewer react react-dom
npm install @cyoda/workflow-core @cyoda/workflow-graph @cyoda/workflow-layout @cyoda/workflow-viewer @cyoda/workflow-react react react-dom reactflow
npm install @cyoda/workflow-core @cyoda/workflow-monaco monaco-editor
```

---

## Use case 1 — Display-only viewer

Target: enterprise website / docs page. Bundle budget per spec §4.5 is
**< 80 KB gzipped with React externalised**.

Install (when consumed externally):

```sh
npm i @cyoda/workflow-core @cyoda/workflow-graph @cyoda/workflow-viewer react react-dom
```

Minimal embed:

```tsx
import { parseImportPayload } from "@cyoda/workflow-core";
import { projectToGraph } from "@cyoda/workflow-graph";
import { WorkflowViewer } from "@cyoda/workflow-viewer";

const parsed = parseImportPayload(workflowJson);
if (!parsed.document) throw new Error("Invalid workflow JSON");
const graph = projectToGraph(parsed.document);

export function Embedded() {
  return (
    <div style={{ height: 600 }}>
      <WorkflowViewer
        graph={graph}
        onSelectionChange={(id) => console.log("selected", id)}
      />
    </div>
  );
}
```

What the viewer gives you:

- SVG state nodes + transition edges using Cyoda visual conventions
  (initial marker, terminal pill, dashed loopbacks, role-coloured borders).
- Pan / zoom via mouse drag and Ctrl+wheel.
- Click-to-select; selection is the synthetic UUID — map it back to domain
  objects via `document.meta.ids.*`.
- Theme tokens exported from `@cyoda/workflow-viewer/theme`; override via
  CSS custom properties to re-skin.

What it does **not** do:

- No drag-connect, delete, or edit affordances (use `@cyoda/workflow-react`).
- No JSON editor (pair with `@cyoda/workflow-monaco`).
- No automatic layout — if you want ELK routing, compute a `LayoutResult`
  with `@cyoda/workflow-layout` and pass it via the `layout` prop.

---

## Use case 2 — Full editor

Target: Cyoda configurator (read/write).

Install:

```sh
npm i @cyoda/workflow-core @cyoda/workflow-graph @cyoda/workflow-layout \
      @cyoda/workflow-viewer @cyoda/workflow-react \
      react react-dom reactflow
```

Minimal editor shell:

```tsx
import { parseImportPayload, type WorkflowEditorDocument } from "@cyoda/workflow-core";
import { WorkflowEditor } from "@cyoda/workflow-react";
import "reactflow/dist/style.css";

const parsed = parseImportPayload(workflowJson);
if (!parsed.document) throw new Error("Invalid workflow JSON");

export function EditorPage() {
  return (
    <WorkflowEditor
      document={parsed.document}
      mode="editor"                // "viewer" | "playground" | "editor"
      onChange={(doc) => persist(doc)}
      onSave={(doc) => pushToBackend(doc)}
    />
  );
}
```

`WorkflowEditorProps`:

| Prop        | Type                                          | Notes |
|-------------|-----------------------------------------------|-------|
| `document`  | `WorkflowEditorDocument`                      | Canonical parsed + normalized model. |
| `mode`      | `"viewer" \| "playground" \| "editor"`        | Default `"editor"`. `"viewer"` hides edit affordances; `"playground"` enables all edits without save. |
| `messages`  | `PartialMessages`                             | i18n override; English defaults live in `src/i18n/en.ts`. |
| `onChange`  | `(doc) => void`                               | Fires after every applied patch. |
| `onSave`    | `(doc) => void`                               | Fires on Ctrl/Cmd+S when enabled. |

Features provided by `WorkflowEditor`:

- React Flow canvas with selection, multi-workflow tab strip, toolbar.
- Inspector with Properties / JSON tabs, per-entity editors (Workflow /
  State / Transition / Processor / Criterion).
- Drag-connect modal (no anonymous transitions on cancel — spec §11.5).
- Delete-state confirmation with cascade counts (spec §11.7).
- Undo / redo via `invertPatch`.
- Keyboard shortcuts: Ctrl/Cmd+Z undo, Ctrl+Shift+Z / Ctrl+Y redo,
  Ctrl/Cmd+S save (when `onSave` set and no validation errors).
- Toolbar validation pills (`role="status"`, `aria-live="polite"`).
- Focus-trapped modals (`role="dialog"`, `aria-modal="true"`, Escape cancels).

---

## Use case 3 — JSON editor (Monaco)

Target: playground, admin tools, raw-JSON power users.

Install:

```sh
npm i @cyoda/workflow-core @cyoda/workflow-monaco monaco-editor
```

Attach to an existing Monaco editor instance:

```ts
import * as monaco from "monaco-editor";
import {
  registerWorkflowSchema,
  attachWorkflowJsonController,
} from "@cyoda/workflow-monaco";

registerWorkflowSchema(monaco);

const model = monaco.editor.createModel(
  workflowJson,
  "json",
  monaco.Uri.parse("cyoda://workflow/alertTriage.json"),
);
const editor = monaco.editor.create(document.getElementById("root")!, { model });

const controller = attachWorkflowJsonController({
  monaco,
  editor,
  debounceMs: 300,
  autoApply: true,
  onPatch: (patch) => console.log("replaceSession patch", patch),
  onStatus: (s) => console.log("status", s),
  onIssues: (issues) => console.log("validation", issues),
});

// later
controller.dispose();
```

Behaviour (spec §12.5, §18.4):

- 300 ms debounce on edits.
- Valid JSON → a `replaceSession` patch is emitted; synthetic UUIDs are
  reused across edits because the controller passes the prior
  `EditorMetadata` to `parseImportPayload`.
- Invalid JSON → canonical model is left untouched; status becomes
  `invalid-json` / `invalid-schema` / `semantic-errors`.
- `ValidationIssue[]` are mapped to Monaco markers via
  `issuesToMarkers(...)` using `jsonc-parser` AST ranges.
- `idAtOffset` / `revealIdInEditor` / `attachCursorSelectionBridge` let you
  wire canvas ↔ JSON bidirectional selection (spec §15.5).

Structural typing: the package imports **no** Monaco symbols at runtime.
All Monaco API surfaces are described by `MonacoLike` / `TextModelLike` /
`EditorLike` interfaces, so consumers may inject their own Monaco build.

---

## Backend integration (configurator)

Implement `WorkflowApi` from `@cyoda/workflow-core`:

```ts
import type {
  EntityIdentity,
  ExportResult,
  ImportPayload,
  ImportResult,
  WorkflowApi,
} from "@cyoda/workflow-core";
import {
  WorkflowApiConflictError,
  WorkflowApiTransportError,
} from "@cyoda/workflow-core";

export const myApi: WorkflowApi = {
  async exportWorkflows(entity: EntityIdentity): Promise<ExportResult> {
    const res = await fetch(`/api/workflows/${entity.id}`);
    if (!res.ok) throw new WorkflowApiTransportError(res, res.statusText);
    return res.json();
  },
  async importWorkflows(entity, payload, opts) {
    const res = await fetch(`/api/workflows/${entity.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        ...(opts?.concurrencyToken ? { "if-match": opts.concurrencyToken } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (res.status === 409) {
      const body = await res.json();
      throw new WorkflowApiConflictError(entity, body.concurrencyToken);
    }
    if (!res.ok) throw new WorkflowApiTransportError(res, res.statusText);
    return res.json();
  },
};
```

Wire it into the editor via `useSaveFlow` + the provided modal / banner
components:

```tsx
import {
  useSaveFlow,
  SaveConfirmModal,
  ConflictBanner,
} from "@cyoda/workflow-react";

function SaveShell({ doc, api }) {
  const save = useSaveFlow({ api, document: doc });

  return (
    <>
      <button onClick={() => save.requestSave("MERGE")} disabled={save.status.kind === "saving"}>
        Save
      </button>
      {save.status.kind === "confirming" && (
        <SaveConfirmModal
          status={save.status}
          diff={save.diff}
          warnings={doc.validation.warnings}
          onConfirm={save.confirmSave}
          onCancel={save.cancel}
        />
      )}
      {save.status.kind === "conflict" && (
        <ConflictBanner
          onReload={save.reload}
          onForceOverwrite={save.forceOverwrite}
        />
      )}
    </>
  );
}
```

Save flow semantics (spec §17.3, §17.4, §18.5):

- `MERGE` is the default and requires no explicit ack.
- `REPLACE` requires an **explicit** ack checkbox.
- `ACTIVATE` requires an **explicit** ack checkbox.
- Any warnings add an additional ack checkbox.
- HTTP 409 → non-dismissable `ConflictBanner` with Reload / Force overwrite.
- `diffSummary(server, local)` returns a terse `+ added / - removed /
  ~ changed` list when server state was previously fetched.

---

## Domain model at a glance

- `parseImportPayload(json, prior?) → ParseResult<ImportPayload>` — runs
  JSON.parse → Zod schema → operator-alias normalisation → input
  normalisation → synthetic-ID assignment → semantic validation. When
  `prior` (previous `EditorMetadata`) is passed, synthetic UUIDs are
  reused via `(workflowName, stateCode, transitionName, ordinal)` tuples
  (spec §6.2).
- `projectToGraph(document) → GraphDocument` — one `StateNode` per state,
  one `StartMarkerNode` per workflow, one transition edge per transition
  with summaries (criterion / processor / execution) and loopback flags.
- `applyPatch(document, patch) → { document, inverse }` — Immer-backed;
  every apply bumps `meta.revision` and re-runs semantic validation.
- `invertPatch(patch)` — powers undo/redo for every patch family.
- `serialize(document) → string` — byte-stable output; fixed key order
  (spec §12.4), 2-space indent, LF, trailing newline, no `operatorType`.

Round-trip identity: `serialize(parse(x)) === serialize(parse(serialize(parse(x))))`.

---

## Accessibility contract

- Keyboard: Ctrl/Cmd+Z undo, Ctrl+Shift+Z / Ctrl+Y redo, Ctrl/Cmd+S save.
- Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` wired,
  Escape cancels, focus moves to first focusable child on mount and
  restores on unmount.
- Validation pills: `role="status"` with `aria-live="polite"`.
- Arrow-key navigation between connected nodes (spec §24) — **deferred**;
  tracked in the deferred list below.

---

## Testing & quality gates

| Package              | Tests | Notes |
|----------------------|------:|-------|
| `workflow-core`      |    16 | §22.1 golden fixtures + §22.2 semantic fixtures + §22.6 property tests |
| `workflow-graph`     |    11 | projection snapshots + loopback / parallel grouping |
| `workflow-viewer`    |     3 | rendering smoke tests |
| `workflow-layout`    |     7 | ELK sync + worker adapters |
| `workflow-react`     |    17 | editor smoke + save flow + a11y |
| `workflow-monaco`    |    12 | schema, markers, bridge, controller, selection |
| **Total**            | **66** | All green as of last run |

Perf budgets per spec §22.3 (verified via `pnpm bench` on M1):

- parse + validate at 50 states: < 30 ms (budget 200 ms)
- parse + validate at 500 states: < 150 ms (budget 2 s)
- serialize at 500 states: < 40 ms (budget 500 ms)
- applyPatch on 100-state graph: < 5 ms (budget 50 ms)

[Inference] Exact numbers vary by machine; the benchmark suite fails CI on
>15% regression relative to the tracked baseline.

Coverage thresholds (spec §22.5) are enforced per package.

Visual regression: `apps/docs-embed-demo/tests/visual/alert-triage.spec.ts`
drives Playwright against the running dev server; baseline PNGs are
captured with `pnpm visual:update` and diffed at 1% pixel tolerance.
[Unverified] No baselines are committed yet — capture them before the
first `test:visual` CI run.

---

## Deferred work

These items are scoped but not yet delivered:

- Arrow-key navigation between connected nodes (spec §24).
- ELK worker path for > 30-node graphs (spec §13.5) — sync path is in
  place; the worker wrapper is not.
- Answers to the four spec §30 open questions (scheduled processor
  `transition` scope, workflow-name uniqueness, concurrency token shape,
  field-hint endpoint availability).
- Visual-regression baseline PNGs and UX sign-off against
  `SVG-workflow.png`.
- Storybook catalogue for Inspector editors.
- `@cyoda/workflow-svg-export` (server-side SVG) — explicitly Phase 9.

---

## For AI coding agents

Read these first, in order:

1. [`README.md`](README.md) — package overview, usage, and release flow.
2. [`ai/PLAN-workflow-editor-editing.md`](ai/PLAN-workflow-editor-editing.md) — implementation notes and phased plan.
3. `ELK-SVG-workflow.png` at the repo root — visual reference for the viewer.

Invariants that must not be broken without spec consultation:

- Canonical state is JSON. The graph is derived.
- Synthetic UUIDs live only in `meta.ids.*`; they never leak into
  exported JSON.
- Patch-driven edits only; no mutation. Every patch has an inverse.
- Deterministic, byte-identical export (fixed key order, no
  `operatorType`).
- Eight architectural decisions in spec §2 are locked.

Entry points for modification:

- New semantic rules → `packages/workflow-core/src/validate/rules/`.
- New patch families → `packages/workflow-core/src/patch/` + inverse +
  revision bump.
- New projection badges → `packages/workflow-graph/src/summaries/` +
  matching viewer chip in `packages/workflow-viewer/src/components/`.
- New editor modals → `packages/workflow-react/src/modals/` + messages
  entry in `src/i18n/en.ts`.
- New Monaco wiring → `packages/workflow-monaco/src/` (no direct
  `monaco-editor` imports — use the structural types).

Out of scope (spec §27 — do not silently add): full BPMN, arbitrary
flowcharts, whiteboarding, criteria-as-graph-nodes by default,
multiplayer, in-editor VCS UI, execution simulation, immutable history
timeline, SVG-as-primary-runtime.

---

## Licence

Licensed under Apache-2.0. See [LICENSE](LICENSE).
