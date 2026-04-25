/**
 * Design tokens for the Cyoda workflow viewer.
 *
 * Palette values match the existing Cyoda Launchpad workflow diagram at
 * `cyoda-launchpad/src/lib/workflow-diagram/cyoda/CyodaWorkflowDiagram.tsx`.
 * Changes here should be coordinated with that renderer so the website and
 * editor remain visually identical.
 */

export interface RolePaletteEntry {
  fill: string;
  border: string;
  meta: string;
  title: string;
}

export interface TerminalPaletteEntry extends RolePaletteEntry {
  innerRing: string;
}

export interface NodePalette {
  default: RolePaletteEntry;
  initial: RolePaletteEntry;
  terminal: TerminalPaletteEntry;
  manualReview: RolePaletteEntry;
  processing: RolePaletteEntry;
}

export interface EdgePalette {
  automated: string;
  manual: string;
  conditional: string;
  processing: string;
  terminal: string;
  loop: string;
  disabled: string;
  arrowhead: string;
}

export interface BadgePaletteEntry {
  fill: string;
  border: string;
}

export interface BadgePalette {
  manual: BadgePaletteEntry;
  processor: BadgePaletteEntry;
  criterion: BadgePaletteEntry;
  disabled: BadgePaletteEntry;
  text: string;
}

export interface EdgeLabelPalette {
  fill: string;
  border: string;
  text: string;
}

export interface NeutralPalette {
  white: string;
  white95: string;
  white75: string;
  slate200: string;
  slate300: string;
  slate500: string;
  slate600: string;
  slate900: string;
}

export interface WorkflowPalette {
  neutrals: NeutralPalette;
  node: NodePalette;
  edge: EdgePalette;
  edgeLabel: EdgeLabelPalette;
  badge: BadgePalette;
}

export const workflowPalette: WorkflowPalette = {
  neutrals: {
    white: "#FFFFFF",
    white95: "#FFFFFFF2",
    white75: "#FFFFFFBF",
    slate200: "#E2E8F0",
    slate300: "#CBD5E1",
    slate500: "#64748B",
    slate600: "#475569",
    slate900: "#0F172A",
  },
  node: {
    default: {
      fill: "#F0FDFA",
      border: "#2DD4BF",
      meta: "#0F766E",
      title: "#0F172A",
    },
    initial: {
      fill: "#D1FAE5",
      border: "#059669",
      meta: "#047857",
      title: "#022C22",
    },
    terminal: {
      fill: "#FFF1F2",
      border: "#FDA4AF",
      meta: "#BE123C",
      title: "#4C0519",
      innerRing: "#FFFFFFBF",
    },
    manualReview: {
      fill: "#F5F3FF",
      border: "#C4B5FD",
      meta: "#6D28D9",
      title: "#2E1065",
    },
    processing: {
      fill: "#F0F9FF",
      border: "#7DD3FC",
      meta: "#0369A1",
      title: "#082F49",
    },
  },
  edge: {
    automated: "#64748B",
    manual: "#8B5CF6",
    conditional: "#F59E0B",
    processing: "#0EA5E9",
    terminal: "#FB7185",
    loop: "#14B8A6",
    disabled: "#CBD5E1",
    arrowhead: "#64748B",
  },
  edgeLabel: {
    fill: "#FFFFFFF2",
    border: "#E2E8F0",
    text: "#475569",
  },
  badge: {
    manual: { fill: "#F5F3FF", border: "#DDD6FE" },
    processor: { fill: "#F0F9FF", border: "#BAE6FD" },
    criterion: { fill: "#FFFBEB", border: "#FDE68A" },
    disabled: { fill: "#F8FAFC", border: "#E2E8F0" },
    text: "#475569",
  },
};

export const typography = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", system-ui, sans-serif',
  monoFamily: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace',
  stateCategory: { size: 10, weight: 700, tracking: "0.12em" },
  stateTitle: { size: 14, weight: 700, tracking: "0.01em" },
  edgeLabel: { size: 9, weight: 700, tracking: "0.04em" },
  badge: { size: 8, weight: 600, tracking: "0.04em" },
};

export const geometry = {
  node: {
    width: 144,
    height: 72,
    radius: 8,
    strokeWidth: 1.5,
    terminalInset: 3,
    terminalInnerRadius: 6,
  },
  edge: {
    strokeWidth: 1.8,
    loopStrokeWidth: 1.6,
    arrowheadSize: 6,
  },
  labelPill: {
    paddingX: 6,
    paddingY: 3,
    radius: 6,
    shadowOpacity: 0.08,
  },
};
