import type { CSSProperties } from "react";
import type { LayoutPreset } from "@cyoda/workflow-layout";
import { DENSITY_OPTIONS, type Orientation } from "./layoutPref.js";

const ORIENTATION_OPTIONS: ReadonlyArray<{ value: Orientation; label: string }> = [
  { value: "vertical", label: "Vertical" },
  { value: "horizontal", label: "Horizontal" },
];

export function LayoutOptionsMenu({
  orientation,
  density,
  onSetOrientation,
  onSetDensity,
}: {
  orientation: Orientation;
  density: LayoutPreset;
  onSetOrientation: (o: Orientation) => void;
  onSetDensity: (p: LayoutPreset) => void;
}) {
  return (
    <div style={panelStyle} data-testid="layout-options-menu" role="group" aria-label="Auto-layout options">
      <div style={labelStyle}>Orientation</div>
      <Segmented
        options={ORIENTATION_OPTIONS}
        value={orientation}
        onChange={onSetOrientation}
        testIdPrefix="layout-orientation"
      />
      <div style={labelStyle}>Density</div>
      <Segmented
        options={DENSITY_OPTIONS}
        value={density}
        onChange={onSetDensity}
        testIdPrefix="layout-density"
      />
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  testIdPrefix,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  testIdPrefix: string;
}) {
  return (
    <div style={segmentedStyle}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            data-testid={`${testIdPrefix}-${opt.value}`}
            style={active ? segActiveStyle : segStyle}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: 10,
  width: 210,
  background: "white",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  boxShadow: "0 4px 16px rgba(15,23,42,0.14)",
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  color: "#64748B",
};

const segmentedStyle: CSSProperties = {
  display: "flex",
  gap: 3,
  padding: 3,
  background: "#F1F5F9",
  border: "1px solid #E2E8F0",
  borderRadius: 7,
};

const segStyle: CSSProperties = {
  flex: 1,
  border: "none",
  background: "transparent",
  color: "#475569",
  fontSize: 12,
  fontWeight: 550,
  padding: "5px 4px",
  borderRadius: 5,
  cursor: "pointer",
};

const segActiveStyle: CSSProperties = {
  ...segStyle,
  background: "#2E63D6",
  color: "white",
  boxShadow: "0 1px 2px rgba(15,23,42,0.18)",
};
