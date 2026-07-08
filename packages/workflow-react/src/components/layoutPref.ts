import type { LayoutOptions, LayoutPreset } from "@cyoda/workflow-layout";

export type Orientation = "vertical" | "horizontal";

/** User-controllable auto-layout preferences, persisted per editor. */
export interface LayoutPref {
  orientation: Orientation;
  preset: LayoutPreset;
}

/** Density choices, ordered tightest → roomiest, with user-facing labels. */
export const DENSITY_OPTIONS: ReadonlyArray<{ value: LayoutPreset; label: string }> = [
  { value: "websiteCompact", label: "Compact" },
  { value: "opsAudit", label: "Comfortable" },
  { value: "configuratorReadable", label: "Roomy" },
];

const KNOWN_PRESETS: ReadonlySet<string> = new Set(
  DENSITY_OPTIONS.map((d) => d.value),
);

export function defaultLayoutPref(opts?: LayoutOptions): LayoutPref {
  return {
    orientation: opts?.orientation === "horizontal" ? "horizontal" : "vertical",
    preset: opts?.preset && KNOWN_PRESETS.has(opts.preset) ? opts.preset : "configuratorReadable",
  };
}

function prefKey(base: string | null): string | null {
  return base === null ? null : `${base}:pref`;
}

/**
 * Load the persisted layout preference, falling back to the host-provided
 * `layoutOptions` defaults (then vertical / configuratorReadable).
 */
export function loadLayoutPref(base: string | null, opts?: LayoutOptions): LayoutPref {
  const fallback = defaultLayoutPref(opts);
  const key = prefKey(base);
  if (key === null || typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<LayoutPref>;
    return {
      orientation: parsed.orientation === "horizontal" ? "horizontal" : "vertical",
      preset:
        typeof parsed.preset === "string" && KNOWN_PRESETS.has(parsed.preset)
          ? (parsed.preset as LayoutPreset)
          : fallback.preset,
    };
  } catch {
    return fallback;
  }
}

export function saveLayoutPref(base: string | null, pref: LayoutPref): void {
  const key = prefKey(base);
  if (key === null || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(pref));
  } catch {
    // ignore quota / unavailable storage
  }
}
