/**
 * Content-aware node size estimator.
 *
 * The estimate must match what `RfStateNode` actually renders so that ELK's
 * layout and React Flow's render agree on node footprints.
 *
 * Constants are calibrated to the design tokens in
 * `packages/workflow-viewer/src/theme/tokens.ts`:
 *   - title font: 14px monospace  → ~8.5 px per character
 *   - node height is fixed at 72 px (two rows: category + title)
 *   - horizontal padding inside node: 8 px each side (the node has `padding: "0 8px"`)
 *
 * Width is snapped to the next 16-px grid increment so nodes align cleanly
 * with React Flow's default snapGrid.
 */

const BASE_WIDTH = 144;
const BASE_HEIGHT = 72;
const CHAR_WIDTH = 8.5;   // monospace 14px, average glyph width
const H_PADDING = 16;     // 8px padding × 2 sides
const SNAP = 16;

export function estimateNodeSize(stateCode: string): { width: number; height: number } {
  const contentWidth = stateCode.length * CHAR_WIDTH + H_PADDING;
  const rawWidth = Math.max(BASE_WIDTH, contentWidth);
  const width = Math.ceil(rawWidth / SNAP) * SNAP;
  return { width, height: BASE_HEIGHT };
}
