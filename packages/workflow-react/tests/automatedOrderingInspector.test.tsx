import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import {
  idFor,
  parseImportPayload,
  validateAll,
  type DomainPatch,
  type WorkflowEditorDocument,
} from "@cyoda/workflow-core";
import { I18nContext } from "../src/i18n/context.js";
import { defaultMessages } from "../src/i18n/en.js";
import { Inspector } from "../src/inspector/Inspector.js";
import type { Selection } from "../src/state/types.js";

function fixture(): WorkflowEditorDocument {
  const { document } = parseImportPayload(
    JSON.stringify({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
          name: "wf",
          initialState: "start",
          active: true,
          states: {
            start: {
              transitions: [
                { name: "go", next: "end", manual: false, disabled: false },
                {
                  name: "fallback",
                  next: "end",
                  manual: false,
                  disabled: false,
                  criterion: {
                    type: "simple",
                    jsonPath: "$.x",
                    operation: "EQUALS",
                    value: 1,
                  },
                },
              ],
            },
            end: { transitions: [] },
          },
        },
      ],
    }),
  );
  if (!document) throw new Error("fixture parse failed");
  return document;
}

function renderInspector(doc: WorkflowEditorDocument, selection: Selection) {
  const issues = validateAll(doc);
  const onDispatch = vi.fn<(patch: DomainPatch) => void>();
  const view = render(
    <I18nContext.Provider value={defaultMessages}>
      <Inspector
        document={doc}
        selection={selection}
        issues={issues}
        readOnly={false}
        onDispatch={onDispatch}
        onSelectionChange={vi.fn()}
        onRequestDeleteState={vi.fn()}
      />
    </I18nContext.Provider>,
  );
  return { ...view, issues };
}

afterEach(() => cleanup());

describe("automated transition ordering — inspector surface", () => {
  it("shows one null-criterion-not-last warning on the offender; the dead transition carries no ordering issue", () => {
    const doc = fixture();
    const goUuid = idFor(doc.meta, {
      kind: "transition",
      workflow: "wf",
      state: "start",
      transitionName: "",
      ordinal: 0,
    });
    const fallbackUuid = idFor(doc.meta, {
      kind: "transition",
      workflow: "wf",
      state: "start",
      transitionName: "",
      ordinal: 1,
    });
    expect(goUuid).toBeTruthy();
    expect(fallbackUuid).toBeTruthy();

    // The per-victim `unreachable-automated-transition` code is collapsed into
    // the single offender warning, which targets the always-fires transition.
    const docIssues = validateAll(doc);
    const ordering = docIssues.filter((i) => i.code === "null-criterion-not-last");
    expect(ordering).toHaveLength(1);
    expect(ordering[0]?.targetId).toBe(goUuid);
    expect(docIssues.map((i) => i.code)).not.toContain("unreachable-automated-transition");

    const offenderView = renderInspector(doc, {
      kind: "transition",
      transitionUuid: goUuid!,
    });
    expect(offenderView.queryByText("null-criterion-not-last")).toBeTruthy();
    offenderView.unmount();

    const deadView = renderInspector(doc, {
      kind: "transition",
      transitionUuid: fallbackUuid!,
    });
    expect(deadView.queryByText("null-criterion-not-last")).toBeNull();
    expect(deadView.queryByText("unreachable-automated-transition")).toBeNull();
  });
});
