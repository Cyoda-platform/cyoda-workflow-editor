import { describe, expect, test } from "vitest";
import { parseEditorDocument, parseImportPayload, serializeEditorDocument } from "../../src/index.js";

function parse(transition: Record<string, unknown>) {
  return parseImportPayload(JSON.stringify({
    importMode: "MERGE",
    workflows: [{
      version: "1.3", name: "w", initialState: "A", active: true,
      states: { A: { transitions: [transition] } },
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
  ])("strips a null %s", (_label, transition) => {
    const parsed = parse(transition as Record<string, unknown>);
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
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
