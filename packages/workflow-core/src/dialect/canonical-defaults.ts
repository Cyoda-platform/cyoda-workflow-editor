/**
 * Pre-schema coercion shared by every dialect. Runs before Zod validation on the
 * raw parsed value so the schema stays unchanged and round-trip semantics hold.
 *
 * Fills an ABSENT processor `type` with `"externalized"` — the server's own
 * documented default, so this is not lossy. Present values are never rewritten:
 * cyoda-go 0.8.3 stores and returns `type` verbatim (`"EXTERNAL"`, `"SCHEDULED"`,
 * `""`, `"internalized"`), and rewriting one would discard user data.
 */
export function coerceCanonicalDefaults(value: unknown): unknown {
  if (!isObj(value)) return value;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v["workflows"])) return value;
  return {
    ...v,
    workflows: v["workflows"].map((wf) => {
      if (!isObj(wf)) return wf;
      const w = wf as Record<string, unknown>;
      if (!isObj(w["states"])) return wf;
      const states = w["states"] as Record<string, unknown>;
      const nextStates: Record<string, unknown> = {};
      for (const [code, state] of Object.entries(states)) {
        if (!isObj(state)) {
          nextStates[code] = state;
          continue;
        }
        const s = state as Record<string, unknown>;
        if (!Array.isArray(s["transitions"])) {
          nextStates[code] = state;
          continue;
        }
        nextStates[code] = {
          ...s,
          transitions: s["transitions"].map((t) => {
            if (!isObj(t)) return t;
            const tx = t as Record<string, unknown>;
            if (!Array.isArray(tx["processors"])) return t;
            return {
              ...tx,
              processors: tx["processors"].map((p) => {
                if (!isObj(p)) return p;
                const proc = p as Record<string, unknown>;
                // Present `type` is preserved verbatim — see doc comment.
                if (typeof proc["type"] === "string") return p;
                return { type: "externalized", ...proc };
              }),
            };
          }),
        };
      }
      return { ...w, states: nextStates };
    }),
  };
}

export function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
