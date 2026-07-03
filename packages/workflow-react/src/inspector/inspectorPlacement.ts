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
