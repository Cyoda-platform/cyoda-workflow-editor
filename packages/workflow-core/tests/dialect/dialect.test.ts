import { afterEach, describe, expect, test } from "vitest";
import {
  type CyodaDialect,
  getDialect,
  LATEST_CYODA_VERSION,
  listDialects,
  parseImportPayload,
  registerDialect,
  serializeImportPayload,
} from "../../src/index.js";

// Issue #24 — version-aware cyoda-go schema dialects.

function importJson(workflow: Record<string, unknown>): string {
  return JSON.stringify({ importMode: "MERGE", workflows: [workflow] });
}

const baseWorkflow = {
  version: "1.0",
  name: "wf",
  initialState: "new",
  active: true,
  states: {
    new: {
      transitions: [
        {
          name: "go",
          next: "done",
          manual: false,
          processors: [{ type: "externalized", name: "validate", executionMode: "SYNC" }],
        },
      ],
    },
    done: { transitions: [] },
  },
};

describe("dialect registry", () => {
  test("0.8 ships and is the latest", () => {
    expect(LATEST_CYODA_VERSION).toBe("0.8");
    expect(listDialects()).toContain("0.8");
    expect(getDialect("0.8").version).toBe("0.8");
  });

  test("an unknown version throws a clear, actionable error", () => {
    expect(() => getDialect("9.9")).toThrowError(/Unknown cyoda-go schema version "9.9"/);
  });

  test("getDialect names removed versions distinctly from unknown ones", () => {
    expect(() => getDialect("0.7")).toThrow(/removed/i);
    expect(() => getDialect("0.7")).toThrow(/0\.8\.3/);
    expect(() => getDialect("9.9")).toThrow(/Unknown cyoda-go schema version/);
  });
});

describe("default dialect path records the latest version (0.8)", () => {
  test("parse records 0.8 and serialize is identical with/without explicit 0.8", () => {
    const json = importJson(baseWorkflow);

    const def = parseImportPayload(json);
    expect(def.ok).toBe(true);
    expect(def.document?.meta.cyodaVersion).toBe("0.8");

    const explicit = parseImportPayload(json, undefined, { sourceVersion: "0.8" });
    expect(explicit.document?.meta.cyodaVersion).toBe("0.8");

    // Default serialize == explicit-0.8 serialize.
    const a = serializeImportPayload(def.document!);
    const b = serializeImportPayload(explicit.document!, { targetVersion: "0.8" });
    expect(a).toBe(b);
  });
});

describe("pluggability: a host-registered dialect round-trips", () => {
  // A synthetic dialect proving the seam without fabricating a real cyoda-go
  // schema: it wraps 0.8 and uppercases processor `type` on the wire,
  // lowercasing it back on the way in.
  const base = getDialect("0.8");
  const mapProcessorType = (
    workflows: Array<Record<string, unknown>>,
    fn: (t: string) => string,
  ): Array<Record<string, unknown>> =>
    JSON.parse(
      JSON.stringify(workflows, (k, v) => (k === "type" && typeof v === "string" ? fn(v) : v)),
    );

  const upperDialect: CyodaDialect = {
    version: "test-upper",
    toCanonical(raw) {
      const lowered = JSON.parse(
        JSON.stringify(raw, (k, v) =>
          k === "type" && typeof v === "string" && v === v.toUpperCase() ? v.toLowerCase() : v,
        ),
      );
      return base.toCanonical(lowered);
    },
    workflowsToWire(workflows) {
      return mapProcessorType(base.workflowsToWire(workflows), (t) => t.toUpperCase());
    },
  };

  afterEach(() => {
    // Re-register the real 0.8 dialect in case a test replaced it; "test-upper"
    // is harmless to leave registered.
    registerDialect(base);
  });

  test("serialize emits the dialect's wire shape; re-parse restores canonical", () => {
    registerDialect(upperDialect);

    const parsed = parseImportPayload(importJson(baseWorkflow));
    const wire = serializeImportPayload(parsed.document!, { targetVersion: "test-upper" });

    // The custom dialect uppercased the processor type on the wire...
    expect(wire).toContain('"type": "EXTERNALIZED"');
    expect(wire).not.toContain('"type": "externalized"');

    // ...and reading it back through the same dialect restores the canonical form.
    const reparsed = parseImportPayload(wire, undefined, { sourceVersion: "test-upper" });
    expect(reparsed.issues.filter((i) => i.severity === "error")).toEqual([]);
    const proc =
      reparsed.value?.workflows[0]?.states["new"]?.transitions[0]?.processors?.[0];
    expect(proc?.type).toBe("externalized");
  });
});

describe("0.8 known gap: uppercase processor type (task-1-report.md)", () => {
  // KNOWN GAP: a later task in the cyoda-go-0.8.3 plan widens
  // `ExternalizedProcessorSchema.type` (currently `z.literal("externalized")`
  // in schema/processor.ts) to an open string. Task 1 only removes the
  // dialect-level rewrite that used to coerce "EXTERNAL" -> "externalized";
  // without that rewrite AND without a schema widening, a raw uppercase
  // `type` now fails schema validation instead of being silently mutated or
  // preserved verbatim. This test pins the *current*, temporary failure mode
  // specifically (ok: false, at least one error-severity issue) rather than
  // using `test.fails`, which would swallow any thrown/failed result — including
  // an unrelated regression — as an "expected failure". When the schema widens,
  // this assertion will start failing (parsed.ok flips to true), which is the
  // signal to replace it with a preservation assertion like:
  //   expect(parsed.document!.session.workflows[0]!.states["A"]!
  //     .transitions[0]!.processors![0]!.type).toBe("EXTERNAL");
  test("0.8 currently rejects a legacy uppercase processor type (flip when the schema widens)", () => {
    const raw = JSON.stringify({
      importMode: "MERGE",
      workflows: [{
        version: "1.3", name: "w", initialState: "A", active: true,
        states: { A: { transitions: [{
          name: "t", next: "A", manual: true,
          processors: [{ type: "EXTERNAL", name: "p" }],
        }] } },
      }],
    });
    const parsed = parseImportPayload(raw);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.some((i) => i.severity === "error")).toBe(true);
  });
});
