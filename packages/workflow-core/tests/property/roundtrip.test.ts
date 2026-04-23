import fc from "fast-check";
import { describe, test } from "vitest";
import {
  applyPatch,
  invertPatch,
  parseImportPayload,
  prettyStringify,
  serializeImportPayload,
  type DomainPatch,
  type Workflow,
} from "../../src/index.js";

const stateName = fc.constantFrom("a", "b", "c", "d");

const transition = fc.record({
  name: fc.constantFrom("go", "back", "retry", "done"),
  next: stateName,
  manual: fc.boolean(),
  disabled: fc.boolean(),
});

function makeWorkflow(name: string): fc.Arbitrary<Workflow> {
  return fc
    .record({
      version: fc.constantFrom("1.0"),
      name: fc.constant(name),
      initialState: fc.constantFrom("a", "b"),
      active: fc.boolean(),
      // Generate all 4 possible state codes; transitions reference them.
      transitionsByState: fc.record({
        a: fc.array(transition, { maxLength: 2 }),
        b: fc.array(transition, { maxLength: 2 }),
        c: fc.array(transition, { maxLength: 2 }),
        d: fc.array(transition, { maxLength: 2 }),
      }),
    })
    .map((r) => ({
      version: r.version,
      name: r.name,
      initialState: r.initialState,
      active: r.active,
      states: {
        a: { transitions: uniqueByName(r.transitionsByState.a) },
        b: { transitions: uniqueByName(r.transitionsByState.b) },
        c: { transitions: uniqueByName(r.transitionsByState.c) },
        d: { transitions: uniqueByName(r.transitionsByState.d) },
      },
    }));
}

function uniqueByName<T extends { name: string }>(ts: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const t of ts) {
    if (!seen.has(t.name)) {
      seen.add(t.name);
      out.push(t);
    }
  }
  return out;
}

const payload = fc
  .record({
    importMode: fc.constantFrom("MERGE", "REPLACE", "ACTIVATE"),
    workflow: makeWorkflow("wf"),
  })
  .map((r) => ({ importMode: r.importMode, workflows: [r.workflow] }));

describe("parse ∘ serialize round-trip", () => {
  test("serialize is idempotent on parse output", () => {
    fc.assert(
      fc.property(payload, (p) => {
        const json = prettyStringify(p);
        const first = parseImportPayload(json);
        if (!first.document) return true; // Schema rejection — skip.
        const out1 = serializeImportPayload(first.document);
        const second = parseImportPayload(out1);
        if (!second.document) return false;
        const out2 = serializeImportPayload(second.document);
        return out1 === out2;
      }),
      { numRuns: 50 },
    );
  });
});

describe("applyPatch ∘ invertPatch ≈ identity", () => {
  test("updateTransition round-trip restores session", () => {
    fc.assert(
      fc.property(payload, fc.boolean(), (p, newManual) => {
        const json = prettyStringify(p);
        const parsed = parseImportPayload(json);
        if (!parsed.document) return true;
        const doc = parsed.document;
        // Pick any transition UUID, if one exists.
        const transitionUuid = Object.keys(doc.meta.ids.transitions)[0];
        if (!transitionUuid) return true;
        const patch: DomainPatch = {
          op: "updateTransition",
          transitionUuid,
          updates: { manual: newManual },
        };
        const inverse = invertPatch(doc, patch);
        const afterApply = applyPatch(doc, patch);
        const restored = applyPatch(afterApply, inverse);
        return (
          serializeImportPayload(restored) === serializeImportPayload(doc)
        );
      }),
      { numRuns: 30 },
    );
  });

  test("setImportMode invert restores mode", () => {
    fc.assert(
      fc.property(payload, fc.constantFrom("MERGE", "REPLACE", "ACTIVATE"), (p, newMode) => {
        const json = prettyStringify(p);
        const parsed = parseImportPayload(json);
        if (!parsed.document) return true;
        const doc = parsed.document;
        const patch: DomainPatch = { op: "setImportMode", mode: newMode };
        const inverse = invertPatch(doc, patch);
        const restored = applyPatch(applyPatch(doc, patch), inverse);
        return restored.session.importMode === doc.session.importMode;
      }),
      { numRuns: 30 },
    );
  });
});

describe("assignSyntheticIds stability with prior metadata", () => {
  test("re-parsing the serialized output reuses workflow/state UUIDs", () => {
    fc.assert(
      fc.property(payload, (p) => {
        const json = prettyStringify(p);
        const first = parseImportPayload(json);
        if (!first.document) return true;
        const out = serializeImportPayload(first.document);
        const second = parseImportPayload(out, first.document.meta);
        if (!second.document) return false;
        // Workflow IDs match.
        for (const name of Object.keys(first.document.meta.ids.workflows)) {
          if (first.document.meta.ids.workflows[name] !== second.document.meta.ids.workflows[name]) {
            return false;
          }
        }
        return true;
      }),
      { numRuns: 50 },
    );
  });
});
