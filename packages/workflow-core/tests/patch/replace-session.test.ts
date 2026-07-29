/**
 * Regression test for the "replaceSession" patch case in src/patch/apply.ts.
 *
 * `replaceSession` is how workflow-monaco's `liftJsonToPatch` dispatches an
 * edit made directly in the JSON/Monaco surface: it parses the edited text
 * into a full `WorkflowSession` and asks the editor to swap the canonical
 * session for it wholesale.
 *
 * A prior version of the `replaceSession` case in `applyPatch` copied only
 * `workflows`, `importMode` and `entity` from `patch.session`, silently
 * dropping `allowCycles`. User-visible consequence: toggle "Allow cycles" on,
 * then edit anything through the JSON/Monaco surface, and the flag reverts to
 * unset — after which an import the user believed was permitted gets
 * rejected by the server (`cyoda-go rejects this import unless allowCycles is
 * set`, per the semantic validator's own message for the check this flag
 * gates).
 */
import { describe, expect, test } from "vitest";
import { applyPatch, parseImportPayload } from "../../src/index.js";
import type { WorkflowEditorDocument, WorkflowSession } from "../../src/index.js";

function baseDoc(allowCycles?: boolean): WorkflowEditorDocument {
  const result = parseImportPayload(
    JSON.stringify({
      importMode: "MERGE",
      ...(allowCycles !== undefined ? { allowCycles } : {}),
      workflows: [
        {
          version: "1.3",
          name: "wf",
          initialState: "a",
          active: true,
          states: {
            a: { transitions: [{ name: "go", next: "b", manual: false, disabled: false }] },
            b: { transitions: [] },
          },
        },
      ],
    }),
  );
  if (!result.document) throw new Error("fixture failed to parse");
  return result.document;
}

describe("replaceSession preserves allowCycles", () => {
  test("a replaceSession patch carrying allowCycles: true is not dropped", () => {
    const doc = baseDoc(); // allowCycles unset
    expect(doc.session.allowCycles).toBeUndefined();

    const nextSession: WorkflowSession = {
      ...doc.session,
      allowCycles: true,
    };

    const after = applyPatch(doc, { op: "replaceSession", session: nextSession });

    // Falsifiable: before the fix, applyPatch's "replaceSession" case copied
    // only workflows/importMode/entity, so this would come back `undefined`
    // instead of `true` even though the incoming session explicitly set it.
    expect(after.session.allowCycles).toBe(true);
  });

  test("a replaceSession patch that drops allowCycles actually clears it", () => {
    const doc = baseDoc(true); // allowCycles: true
    expect(doc.session.allowCycles).toBe(true);

    // Simulate the user editing the JSON to remove the allowCycles key
    // entirely (not set it to false) — e.g. via a fresh parseImportPayload
    // of edited text that never mentions allowCycles.
    const edited = parseImportPayload(
      JSON.stringify({
        importMode: "MERGE",
        workflows: doc.session.workflows,
      }),
    );
    if (!edited.document) throw new Error("edited fixture failed to parse");
    expect("allowCycles" in edited.document.session).toBe(false);

    const after = applyPatch(doc, {
      op: "replaceSession",
      session: edited.document.session,
    });

    // Falsifiable: a naive `Object.assign(draft, patch.session)` fix would
    // pass the first test above but fail this one, because Object.assign
    // only copies keys that are *present* on the source — it would leave the
    // stale `allowCycles: true` from the prior session in place instead of
    // clearing it.
    expect(after.session.allowCycles).toBeUndefined();
  });

  test("replaceSession still carries workflows, importMode and entity (no regression on the existing fields)", () => {
    const doc = baseDoc();
    const nextSession: WorkflowSession = {
      entity: { entityName: "Order", modelVersion: 3 },
      importMode: "REPLACE",
      allowCycles: true,
      workflows: [
        {
          version: "1.3",
          name: "wf2",
          initialState: "x",
          active: true,
          states: { x: { transitions: [] } },
        },
      ],
    };

    const after = applyPatch(doc, { op: "replaceSession", session: nextSession });

    expect(after.session.entity).toEqual({ entityName: "Order", modelVersion: 3 });
    expect(after.session.importMode).toBe("REPLACE");
    expect(after.session.allowCycles).toBe(true);
    expect(after.session.workflows).toHaveLength(1);
    expect(after.session.workflows[0]?.name).toBe("wf2");
  });
});
