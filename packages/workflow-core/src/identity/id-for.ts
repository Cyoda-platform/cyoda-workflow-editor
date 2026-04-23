import type { EditorMetadata, HostRef } from "../types/editor.js";

export type IdRef =
  | { kind: "workflow"; workflow: string }
  | { kind: "state"; workflow: string; state: string }
  | {
      kind: "transition";
      workflow: string;
      state: string;
      transitionName: string;
      ordinal: number;
    }
  | { kind: "processor"; transitionUuid: string; processorName: string; ordinal: number }
  | { kind: "criterion"; host: HostRef; path: string[] };

/**
 * Resolve an address-style reference to a synthetic UUID using the current metadata.
 * Returns `null` if no such ID exists.
 *
 * Transition lookups use (workflow, state) + ordinal: we return the Nth
 * transition UUID registered for that state (in insertion order).
 */
export function idFor(meta: EditorMetadata, ref: IdRef): string | null {
  switch (ref.kind) {
    case "workflow":
      return meta.ids.workflows[ref.workflow] ?? null;
    case "state": {
      for (const [uuid, ptr] of Object.entries(meta.ids.states)) {
        if (ptr.workflow === ref.workflow && ptr.state === ref.state) return uuid;
      }
      return null;
    }
    case "transition": {
      const matches: string[] = [];
      for (const [uuid, ptr] of Object.entries(meta.ids.transitions)) {
        if (ptr.workflow === ref.workflow && ptr.state === ref.state) {
          matches.push(uuid);
        }
      }
      return matches[ref.ordinal] ?? null;
    }
    case "processor": {
      const matches: string[] = [];
      for (const [uuid, ptr] of Object.entries(meta.ids.processors)) {
        if (ptr.transitionUuid === ref.transitionUuid) matches.push(uuid);
      }
      return matches[ref.ordinal] ?? null;
    }
    case "criterion": {
      const target = JSON.stringify(ref.path);
      for (const [uuid, ptr] of Object.entries(meta.ids.criteria)) {
        if (
          JSON.stringify(ptr.host) === JSON.stringify(ref.host) &&
          JSON.stringify(ptr.path) === target
        ) {
          return uuid;
        }
      }
      return null;
    }
  }
}
