import { describe, expect, test } from "vitest";
import {
  parseEditorDocument,
  parseImportPayload,
  serializeEditorDocument,
  serializeImportPayload,
} from "../../src/index.js";

function parse(transition: Record<string, unknown>) {
  return parseImportPayload(JSON.stringify({
    importMode: "MERGE",
    workflows: [{
      version: "1.3", name: "w", initialState: "A", active: true,
      states: { A: { transitions: [transition] } },
    }],
  }));
}

function parseStates(states: Record<string, unknown>) {
  return parseImportPayload(JSON.stringify({
    importMode: "MERGE",
    workflows: [{
      version: "1.3", name: "w", initialState: "A", active: true,
      states,
    }],
  }));
}

const FN = { name: "c", resultKind: "Schedule", calculationNodesTags: "s" };

describe("0.8 dialect normalization (spec §2)", () => {
  test("drops the delayMs: 0 the server emits beside function", () => {
    const parsed = parse({
      name: "t", next: "A", manual: false,
      schedule: { delayMs: 0, timeoutMs: 500, function: FN },
    });
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
    // Asserted against the canonical document rather than serialized wire
    // output: outputSchedule (normalize/output.ts) does not emit `function`
    // yet — that's Task 8's job (see progress.md's Task 5 note). Checking the
    // canonical model still proves normalize08 dropped `delayMs: 0` and left
    // `function` intact, which is what this dialect pass is responsible for.
    const s = parsed.document!.session.workflows[0]!.states["A"]!.transitions[0]!.schedule;
    expect(s).not.toHaveProperty("delayMs");
    expect(s?.function).toMatchObject(FN);
  });

  test("drops a negative delayMs, which the server also reads as absent", () => {
    const parsed = parse({
      name: "t", next: "A", manual: false, schedule: { delayMs: -5, function: FN },
    });
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  test("treats schedule: null as absent", () => {
    const parsed = parse({ name: "t", next: "A", manual: true, schedule: null });
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  test.each([
    ["criterion", { name: "t", next: "A", manual: true, criterion: null }],
    ["processors", { name: "t", next: "A", manual: true, processors: null }],
    ["disabled", { name: "t", next: "A", manual: true, disabled: null }],
    ["annotations", { name: "t", next: "A", manual: true, annotations: null }],
  ])("strips a null %s", (_label, transition) => {
    const parsed = parse(transition as Record<string, unknown>);
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  test("treats state.transitions: null as the same default a transition-less state gets", () => {
    const parsed = parseStates({ A: { transitions: null } });
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(parsed.document!.session.workflows[0]!.states["A"]!.transitions).toEqual([]);
  });

  test("treats a null state object the same as a transition-less state", () => {
    const parsed = parseStates({ A: null });
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(parsed.document!.session.workflows[0]!.states["A"]!.transitions).toEqual([]);
  });

  test("treats processors[].config: null as absent", () => {
    const parsed = parse({
      name: "t", next: "A", manual: true,
      processors: [{ type: "externalized", name: "p", config: null }],
    });
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
    const proc = parsed.document!.session.workflows[0]!.states["A"]!.transitions[0]!.processors?.[0];
    expect(proc).not.toHaveProperty("config");
  });

  test("strips null-valued keys inside processor config without warning", () => {
    const parsed = parse({
      name: "t", next: "A", manual: true,
      processors: [{
        type: "externalized", name: "p",
        config: { context: null, calculationNodesTags: "x" },
      }],
    });
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
    // context is a known config key (PROCESSOR_CONFIG_FIELDS) — nulling it
    // out must not be mistaken for an unknown, silently-dropped key.
    expect(parsed.warnings ?? []).toEqual([]);
    const cfg = parsed.document!.session.workflows[0]!.states["A"]!.transitions[0]!.processors?.[0]?.config;
    expect(cfg).not.toHaveProperty("context");
    expect(cfg?.calculationNodesTags).toBe("x");
  });

  test("warns when unknown processor config keys are discarded", () => {
    const parsed = parse({
      name: "t", next: "A", manual: true,
      processors: [{
        type: "scheduled", name: "RetryLater",
        config: { delaySeconds: 300, transition: "retry" },
      }],
    });
    expect(parsed.warnings ?? []).toContainEqual(
      expect.stringContaining("processor-config-keys-dropped"),
    );
  });

  test("warns when unknown processor-level keys are discarded", () => {
    const parsed = parse({
      name: "t", next: "A", manual: true,
      processors: [{ type: "externalized", name: "p", delaySeconds: 300, transition: "retry" }],
    });
    expect(parsed.warnings ?? []).toContainEqual(
      expect.stringContaining("processor-keys-dropped:p:delaySeconds,transition"),
    );
  });

  // Spec §1 justified the config-key warning as "the editor's only signal that
  // it discarded the meaning of a processor". `ParseResult.warnings` had one
  // reader, inside a version-switch flow that is unreachable while a single
  // dialect ships — so the signal reached nobody. Mirror them into `issues`,
  // which every surface (toolbar pills, issues drawer) already renders.
  describe("dialect warnings also surface as info-severity issues", () => {
    test("dropped processor config keys become an issue naming processor and keys", () => {
      const parsed = parse({
        name: "t", next: "A", manual: true,
        processors: [{
          type: "scheduled", name: "RetryLater",
          config: { delaySeconds: 300, transition: "retry" },
        }],
      });
      const issue = parsed.issues.find((i) => i.code === "processor-config-keys-dropped");
      expect(issue?.severity).toBe("info");
      expect(issue?.message).toContain("RetryLater");
      expect(issue?.message).toContain("delaySeconds");
      expect(issue?.message).toContain("transition");
      // The raw array stays: it is public API and other consumers read it.
      expect(parsed.warnings ?? []).toContainEqual(
        expect.stringContaining("processor-config-keys-dropped"),
      );
    });

    test("dropped processor-level keys become an issue", () => {
      const parsed = parse({
        name: "t", next: "A", manual: true,
        processors: [{ type: "externalized", name: "p", delaySeconds: 300, transition: "retry" }],
      });
      const issue = parsed.issues.find((i) => i.code === "processor-keys-dropped");
      expect(issue?.severity).toBe("info");
      expect(issue?.message).toContain('"p"');
      expect(issue?.message).toContain("delaySeconds,transition");
    });

    test("a clean payload adds no warning issues", () => {
      const parsed = parse({
        name: "t", next: "A", manual: true,
        processors: [{ type: "externalized", name: "p", executionMode: "SYNC" }],
      });
      expect(parsed.warnings).toBeUndefined();
      expect(parsed.issues.map((i) => i.code)).not.toContain("processor-keys-dropped");
    });

    test("the editor-document path surfaces them too", () => {
      // parseEditorDocument is the path a saved editor file takes on reopen —
      // the same dropped-key signal, and it must reach the same drawer.
      const parsed = parseEditorDocument(JSON.stringify({
        session: {
          entity: null,
          importMode: "MERGE",
          workflows: [{
            version: "1.3", name: "w", initialState: "A", active: true,
            states: { A: { transitions: [{
              name: "t", next: "A", manual: true,
              processors: [{ type: "externalized", name: "p", delaySeconds: 300 }],
            }] } },
          }],
        },
        meta: {
          revision: 0,
          ids: { workflows: {}, states: {}, transitions: {}, processors: {}, criteria: {} },
          workflowUi: {},
        },
      }));
      expect(parsed.warnings ?? []).toContainEqual(
        expect.stringContaining("processor-keys-dropped:p:delaySeconds"),
      );
      const issue = parsed.issues.find((i) => i.code === "processor-keys-dropped");
      expect(issue?.severity).toBe("info");
      expect(issue?.message).toContain("delaySeconds");
    });

    test("warnings still surface when the payload fails schema validation", () => {
      // The schema-failure return path bails before semantic validation; the
      // dropped-key signal must not be lost with it.
      const parsed = parse({
        name: "t", next: 42, manual: true,
        processors: [{ type: "externalized", name: "p", delaySeconds: 300 }],
      });
      expect(parsed.ok).toBe(false);
      expect(parsed.issues.map((i) => i.code)).toContain("processor-keys-dropped");
    });
  });

  test.each([
    ["type", { type: null, name: "p", executionMode: "SYNC" }],
    ["executionMode", { type: "externalized", name: "p", executionMode: null }],
    ["annotations", { type: "externalized", name: "p", annotations: null }],
  ])("strips a null processor %s (the server accepts all three with 200)", (_label, processor) => {
    const parsed = parse({
      name: "t", next: "A", manual: true, processors: [processor],
    });
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
    const proc = parsed.document!.session.workflows[0]!.states["A"]!.transitions[0]!.processors![0]!;
    // A null `type` falls back to the server's own default rather than
    // vanishing — `type` is required by the canonical schema.
    expect(proc.type).toBe("externalized");
  });

  test("routes a hand-edited, saved-and-reloaded editor document through the same normalization", () => {
    const parsed = parse({ name: "t", next: "A", manual: false, schedule: { delayMs: 1000 } });
    const saved = JSON.parse(serializeEditorDocument(parsed.document!));
    // Simulate a user pasting a raw 0.8.3-shaped snippet (delayMs: 0 beside
    // function, a null optional key) into the editor's JSON view, then
    // reloading. parseEditorDocument must apply the same dialect rules
    // parseImportPayload does, not just normalizeOperatorAlias.
    const tx = saved.session.workflows[0].states.A.transitions[0];
    tx.schedule = { delayMs: 0, function: FN };
    tx.disabled = null;
    const reloaded = parseEditorDocument(JSON.stringify(saved));
    expect(reloaded.issues.filter((i) => i.severity === "error")).toEqual([]);
    const reloadedTx = reloaded.document!.session.workflows[0]!.states["A"]!.transitions[0]!;
    expect(reloadedTx.schedule).not.toHaveProperty("delayMs");
    expect(reloadedTx.schedule?.function).toMatchObject(FN);
  });
});

describe("legacy processor-level startNewTxOnDispatch migration", () => {
  const legacy = (extra: Record<string, unknown> = {}) => ({
    type: "externalized",
    name: "p",
    executionMode: "COMMIT_BEFORE_DISPATCH",
    startNewTxOnDispatch: true,
    ...extra,
  });

  test("relocates a legacy processor-level flag into config and round-trips it", () => {
    // Every release of this library before 0.8.3 emitted `startNewTxOnDispatch`
    // on the processor object. 0.8.3 hard-400s that shape, so without a
    // migration these documents are broken against the server AND silently
    // stripped here.
    const parsed = parse({
      name: "t", next: "A", manual: true,
      processors: [legacy({ config: { calculationNodesTags: "t" } })],
    });
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
    const proc = parsed.document!.session.workflows[0]!.states["A"]!.transitions[0]!.processors![0]!;
    expect(proc.config?.startNewTxOnDispatch).toBe(true);
    expect(proc).not.toHaveProperty("startNewTxOnDispatch");

    const wire = JSON.parse(serializeImportPayload(parsed.document!));
    const wireProc = wire.workflows[0].states.A.transitions[0].processors[0];
    expect(wireProc.config.startNewTxOnDispatch).toBe(true);
    expect(wireProc).not.toHaveProperty("startNewTxOnDispatch");
  });

  test("creates config when the legacy document has none", () => {
    const parsed = parse({ name: "t", next: "A", manual: true, processors: [legacy()] });
    const proc = parsed.document!.session.workflows[0]!.states["A"]!.transitions[0]!.processors![0]!;
    expect(proc.config?.startNewTxOnDispatch).toBe(true);
  });

  test("relocates an explicit false as faithfully as a true", () => {
    const parsed = parse({
      name: "t", next: "A", manual: true,
      processors: [legacy({ startNewTxOnDispatch: false })],
    });
    const proc = parsed.document!.session.workflows[0]!.states["A"]!.transitions[0]!.processors![0]!;
    expect(proc.config?.startNewTxOnDispatch).toBe(false);
  });

  test("prefers the config value when both positions carry the key", () => {
    const parsed = parse({
      name: "t", next: "A", manual: true,
      processors: [legacy({ config: { startNewTxOnDispatch: false } })],
    });
    const proc = parsed.document!.session.workflows[0]!.states["A"]!.transitions[0]!.processors![0]!;
    expect(proc.config?.startNewTxOnDispatch).toBe(false);
  });

  test("does not report the migrated field as a dropped processor key", () => {
    const parsed = parse({ name: "t", next: "A", manual: true, processors: [legacy()] });
    expect(parsed.warnings ?? []).toEqual([]);
  });
});
