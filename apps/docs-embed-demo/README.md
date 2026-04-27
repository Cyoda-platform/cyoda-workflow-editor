# docs-embed-demo

Minimal React + Vite page that embeds `@cyoda/workflow-viewer` on a static
site, demonstrating the "slim viewer" target (spec §4.5 — bundle budget
< 80 KB gzipped).

## Run

```sh
pnpm install
pnpm --filter @cyoda/docs-embed-demo dev
```

Dev server listens on http://localhost:5173.

Routes:

- `http://localhost:5173/` or `http://localhost:5173/examples` for the workflow playground page
- `http://localhost:5173/embed` for the original slim viewer embed example

## Embed recipe

```tsx
import { parseImportPayload } from "@cyoda/workflow-core";
import { projectToGraph } from "@cyoda/workflow-graph";
import { WorkflowViewer } from "@cyoda/workflow-viewer";

const { document } = parseImportPayload(workflowJson);
const graph = projectToGraph(document);

<div style={{ height: 600 }}>
  <WorkflowViewer graph={graph} onSelectionChange={(id) => console.log(id)} />
</div>;
```

### What the viewer gives you

- SVG state nodes + transition edges with the Cyoda visual conventions
  (initial-state marker, terminal pill, dashed loopbacks).
- Pan / zoom via mouse drag and ctrl+wheel.
- Click-to-select — selection is a synthetic UUID, map it back to domain
  objects via `document.meta.ids.*`.
- Theme tokens exported from `@cyoda/workflow-viewer/theme` — override via
  CSS custom properties to skin for the enterprise website.

### What it does **not** do

- No drag-connect, delete, or other edit affordances — use
  `@cyoda/workflow-react` (`WorkflowEditor`) for those.
- No Monaco / JSON editor — pair with `@cyoda/workflow-monaco` when needed.
- No automatic layout — if you want ELK routing, compute a `LayoutResult`
  with `@cyoda/workflow-layout` and pass it via the `layout` prop.

## Bundle check

The slim viewer target is < 80 KB gzipped with React externalised. After
`pnpm build`, inspect `dist/assets/*.js` sizes — the Cyoda packages should
contribute roughly 30-40 KB gzipped; the remainder is React.
