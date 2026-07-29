import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  applyPatch,
  parseImportPayload,
  serializeImportPayload,
  type DomainPatch,
  type WorkflowEditorDocument,
} from "@cyoda/workflow-core";
import { I18nContext } from "../src/i18n/context.js";
import { defaultMessages } from "../src/i18n/en.js";
import { ProcessorEditorModal } from "../src/inspector/ProcessorForm.js";

afterEach(() => cleanup());

/**
 * Full draft -> Apply -> applyPatch -> serialize round trip for a single
 * processor. `applyPatch`'s `updateProcessor` REPLACES the processor
 * wholesale, so a key the form's `toProcessor` omits is a real deletion, not
 * a no-op — the dispatched-patch-only tests in processorContext.test.tsx
 * don't exercise that replace-wholesale hazard, this file does.
 */
function loadDocWithProcessor(config: Record<string, unknown>, executionMode: string) {
  const { document } = parseImportPayload(
    JSON.stringify({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.3",
          name: "wf",
          initialState: "a",
          active: true,
          states: {
            a: {
              transitions: [
                {
                  name: "go",
                  next: "b",
                  manual: false,
                  disabled: false,
                  processors: [{ type: "externalized", name: "p", executionMode, config }],
                },
              ],
            },
            b: { transitions: [] },
          },
        },
      ],
    }),
  );
  if (!document) throw new Error("fixture parse failed");
  return document;
}

/** Opens the modal for the document's single processor, clicks Apply
 * without touching any field, and returns the re-serialized wire JSON. */
function editAndApplyUntouched(doc: WorkflowEditorDocument): unknown {
  const processor = doc.session.workflows[0]!.states["a"]!.transitions[0]!.processors![0]!;
  const processorUuid = Object.keys(doc.meta.ids.processors)[0]!;

  let current = doc;
  const onDispatch = (patch: DomainPatch) => {
    current = applyPatch(current, patch);
  };

  render(
    <I18nContext.Provider value={defaultMessages}>
      <ProcessorEditorModal
        title="Edit p"
        initialProcessor={processor}
        existingNames={[]}
        disabled={false}
        onCancel={() => {}}
        onApply={(next) => onDispatch({ op: "updateProcessor", processorUuid, updates: next })}
      />
    </I18nContext.Provider>,
  );

  expect(screen.queryByTestId("processor-modal-error")).toBeNull();
  fireEvent.click(screen.getByTestId("processor-modal-apply"));

  return JSON.parse(serializeImportPayload(current));
}

function wireConfig(wire: unknown): Record<string, unknown> {
  const w = wire as {
    workflows: [{ states: { a: { transitions: [{ processors: [{ config?: Record<string, unknown> }] }] } } }];
  };
  return w.workflows[0]!.states["a"]!.transitions[0]!.processors[0]!.config ?? {};
}

describe("processor modal round-trip fidelity (spec §4a, residual items 5-7)", () => {
  it("preserves startNewTxOnDispatch: false through a full round trip", () => {
    const doc = loadDocWithProcessor(
      { startNewTxOnDispatch: false, calculationNodesTags: "t" },
      "COMMIT_BEFORE_DISPATCH",
    );
    const config = wireConfig(editAndApplyUntouched(doc));
    expect(config["startNewTxOnDispatch"]).toBe(false);
  });

  it("preserves an explicit startNewTxOnDispatch: true even when executionMode is not COMMIT_BEFORE_DISPATCH", () => {
    // This combination is invalid (flagged by the hard
    // start-new-tx-without-commit-before-dispatch error), but a migrated
    // legacy document can carry it, and Apply must not be the thing that
    // silently deletes the field the migration restored.
    const doc = loadDocWithProcessor({ startNewTxOnDispatch: true }, "SYNC");
    const config = wireConfig(editAndApplyUntouched(doc));
    expect(config["startNewTxOnDispatch"]).toBe(true);
  });

  it("preserves asyncResult: false through a full round trip", () => {
    const doc = loadDocWithProcessor(
      { asyncResult: false, calculationNodesTags: "t" },
      "SYNC",
    );
    const config = wireConfig(editAndApplyUntouched(doc));
    expect(config["asyncResult"]).toBe(false);
  });

  it("preserves a negative responseTimeoutMs through a full round trip", () => {
    // Verified against a live cyoda-go 0.8.3: responseTimeoutMs: -1 is
    // accepted with a 200, and the canonical schema was deliberately
    // relaxed to any integer. The modal must not block Apply for it.
    const doc = loadDocWithProcessor({ responseTimeoutMs: -1 }, "SYNC");
    const config = wireConfig(editAndApplyUntouched(doc));
    expect(config["responseTimeoutMs"]).toBe(-1);
  });
});
