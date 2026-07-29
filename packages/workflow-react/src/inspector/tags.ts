/**
 * Normalizes a user-typed comma-separated tag list: trims each part, drops
 * empty parts, and rejoins with a bare comma (no spaces) — the wire format
 * `calculationNodesTags` expects. Returns `undefined` for an empty/blank
 * result so callers with an optional field can omit the key entirely.
 *
 * Shared by ProcessorForm's `calculationNodesTags` and TransitionForm's
 * `schedule.function.calculationNodesTags` — same logical field, same
 * normalization, so it lives in one place rather than being reimplemented
 * per form.
 */
export function normalizeTags(value: string): string | undefined {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(",") : undefined;
}
