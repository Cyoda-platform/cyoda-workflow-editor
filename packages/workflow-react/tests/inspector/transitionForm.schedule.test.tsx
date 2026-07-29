import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  applyPatch,
  parseImportPayload,
  type DomainPatch,
  type Transition,
  type WorkflowEditorDocument,
} from "@cyoda/workflow-core";
import { I18nContext } from "../../src/i18n/context.js";
import { defaultMessages } from "../../src/i18n/en.js";
import { TransitionForm } from "../../src/inspector/TransitionForm.js";

afterEach(() => cleanup());

function loadDoc(schedule?: unknown): WorkflowEditorDocument {
  const { document } = parseImportPayload(
    JSON.stringify({
      importMode: "MERGE",
      workflows: [
        {
          version: "1.0",
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
                  ...(schedule !== undefined ? { schedule } : {}),
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

/**
 * Renders TransitionForm wired to a real applyPatch loop: every dispatched
 * patch is applied to the in-memory document and the form is re-rendered
 * with the resulting transition, mirroring how the real app's reducer keeps
 * the form's props in sync with canonical state. This lets tests chain
 * multiple interactions (enable → set delay → set timeout) and assert on
 * the final canonical schedule, not just the most recent dispatched patch.
 */
function renderScheduleForm(initialSchedule?: unknown) {
  let doc = loadDoc(initialSchedule);
  const transitionUuid = Object.keys(doc.meta.ids.transitions)[0]!;

  const currentTransition = (): Transition => doc.session.workflows[0]!.states["a"]!.transitions[0]!;

  const onDispatch = vi.fn((patch: DomainPatch) => {
    doc = applyPatch(doc, patch);
    rerender(
      <I18nContext.Provider value={defaultMessages}>
        <TransitionForm
          workflow={doc.session.workflows[0]!}
          stateCode="a"
          transition={currentTransition()}
          transitionUuid={transitionUuid}
          transitionIndex={0}
          processorUuids={[]}
          anchors={undefined}
          disabled={false}
          onDispatch={onDispatch}
        />
      </I18nContext.Provider>,
    );
  });

  const { rerender } = render(
    <I18nContext.Provider value={defaultMessages}>
      <TransitionForm
        workflow={doc.session.workflows[0]!}
        stateCode="a"
        transition={currentTransition()}
        transitionUuid={transitionUuid}
        transitionIndex={0}
        processorUuids={[]}
        anchors={undefined}
        disabled={false}
        onDispatch={onDispatch}
      />
    </I18nContext.Provider>,
  );

  return {
    onDispatch,
    getSchedule: () => currentTransition().schedule,
  };
}

function enableSchedule() {
  fireEvent.click(screen.getByTestId("inspector-transition-schedule-enabled"));
}

function commit(testId: string, value: string) {
  const input = screen.getByTestId(testId) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("TransitionForm schedule editing (task 14)", () => {
  it("timeoutMs of 0 is accepted and does not invent a delayMs", () => {
    const { getSchedule } = renderScheduleForm();

    enableSchedule();
    commit("inspector-transition-schedule-delay", "1000");
    commit("inspector-transition-schedule-timeout", "0");

    // Falsifiable: with the pre-existing bug (`parsed <= 0` guard rejecting
    // 0, and `delayMs: transition.schedule?.delayMs ?? 1` on the timeout
    // path), timeoutMs would either be dropped or delayMs would be
    // silently overwritten — this exact shape only appears once both
    // defects are fixed.
    expect(getSchedule()).toEqual({ delayMs: 1000, timeoutMs: 0 });
  });

  it("a negative timeoutMs is accepted (no UI-side lower bound)", () => {
    const { getSchedule } = renderScheduleForm();

    enableSchedule();
    commit("inspector-transition-schedule-timeout", "-5");

    // Falsifiable: the old `parsed <= 0` guard would silently refuse this,
    // leaving timeoutMs unset.
    expect(getSchedule()).toEqual({ delayMs: 1, timeoutMs: -5 });
  });

  it("switching to function mode clears delayMs", () => {
    const { getSchedule } = renderScheduleForm();

    enableSchedule();
    fireEvent.click(screen.getByTestId("inspector-transition-schedule-mode-function"));

    const schedule = getSchedule();
    // Falsifiable: without a fresh-object rebuild, spreading the previous
    // static schedule would leave delayMs alongside the new function,
    // violating the server's XOR.
    expect(schedule).not.toHaveProperty("delayMs");
    expect(schedule?.function).toMatchObject({ resultKind: "Schedule" });
  });

  it("switching back to static mode clears function", () => {
    const { getSchedule } = renderScheduleForm();

    enableSchedule();
    fireEvent.click(screen.getByTestId("inspector-transition-schedule-mode-function"));
    fireEvent.click(screen.getByTestId("inspector-transition-schedule-mode-static"));

    const schedule = getSchedule();
    // Falsifiable: without a fresh-object rebuild on the static handler,
    // spreading the previous function-mode schedule would leave `function`
    // alongside the restored delayMs, violating the server's XOR.
    expect(schedule).not.toHaveProperty("function");
    expect(schedule?.delayMs).toBe(1);
  });

  it("switching to function mode preserves a previously set timeoutMs", () => {
    const { getSchedule } = renderScheduleForm();

    enableSchedule();
    commit("inspector-transition-schedule-timeout", "250");
    fireEvent.click(screen.getByTestId("inspector-transition-schedule-mode-function"));

    const schedule = getSchedule();
    // Falsifiable: if the mode handler didn't carry timeoutMs across (e.g.
    // by always building a bare `{ function: {...} }`), this would be
    // undefined instead of 250.
    expect(schedule?.timeoutMs).toBe(250);
    // Falsifiable independent of the above: a naive
    // `{ ...transition.schedule, function: {...} }` spread would *also*
    // carry timeoutMs across "for free" while leaving delayMs behind too —
    // this assertion is what actually discriminates a fresh-object rebuild
    // from a spread-based one, since the timeoutMs assertion alone passes
    // under both implementations.
    expect(schedule).not.toHaveProperty("delayMs");
  });

  it("re-clicking the already-active static mode button does not reset delayMs/timeoutMs", () => {
    const { getSchedule } = renderScheduleForm();

    enableSchedule();
    commit("inspector-transition-schedule-delay", "86400000");
    commit("inspector-transition-schedule-timeout", "500");

    fireEvent.click(screen.getByTestId("inspector-transition-schedule-mode-static"));

    // Falsifiable: without the no-op guard, re-clicking "Static delay"
    // rebuilds the schedule from scratch as `{ delayMs: 1 }`, silently
    // discarding the entered delay and timeout.
    expect(getSchedule()).toEqual({ delayMs: 86400000, timeoutMs: 500 });
  });

  it("re-clicking the already-active function mode button does not blank out its fields", () => {
    const { getSchedule } = renderScheduleForm();

    enableSchedule();
    fireEvent.click(screen.getByTestId("inspector-transition-schedule-mode-function"));

    fireEvent.change(screen.getByTestId("inspector-transition-schedule-function-name"), {
      target: { value: "computeFireTime" },
    });
    fireEvent.blur(screen.getByTestId("inspector-transition-schedule-function-name"));
    fireEvent.change(screen.getByTestId("inspector-transition-schedule-function-tags"), {
      target: { value: "alpha,beta" },
    });
    fireEvent.blur(screen.getByTestId("inspector-transition-schedule-function-tags"));
    fireEvent.change(screen.getByTestId("inspector-transition-schedule-function-attach-entity"), {
      target: { value: "false" },
    });
    commit("inspector-transition-schedule-function-response-timeout", "42");

    fireEvent.click(screen.getByTestId("inspector-transition-schedule-mode-function"));

    // Falsifiable: without the no-op guard, re-clicking "Function" rebuilds
    // the schedule as a blank
    // `{ function: { name: "", resultKind: "Schedule", calculationNodesTags: "" } }`,
    // silently discarding everything entered above.
    expect(getSchedule()?.function).toEqual({
      name: "computeFireTime",
      resultKind: "Schedule",
      calculationNodesTags: "alpha,beta",
      attachEntity: false,
      responseTimeoutMs: 42,
    });
  });

  it("setting timeoutMs while in function mode does not invent a delayMs", () => {
    const { getSchedule } = renderScheduleForm();

    enableSchedule();
    fireEvent.click(screen.getByTestId("inspector-transition-schedule-mode-function"));
    commit("inspector-transition-schedule-timeout", "30");

    const schedule = getSchedule();
    // Falsifiable: the pre-existing bug wrote
    // `delayMs: transition.schedule?.delayMs ?? 1` unconditionally on the
    // timeout-commit path. Since function mode has no delayMs, `?? 1` would
    // fire and inject `delayMs: 1` alongside `function`, breaking the XOR.
    expect(schedule).not.toHaveProperty("delayMs");
    expect(schedule).toMatchObject({ timeoutMs: 30 });
  });

  it("mode buttons use radio semantics (role + aria-checked) consistent with the radiogroup wrapper", () => {
    renderScheduleForm();
    enableSchedule();

    const staticBtn = screen.getByTestId("inspector-transition-schedule-mode-static");
    const functionBtn = screen.getByTestId("inspector-transition-schedule-mode-function");

    // Falsifiable: the wrapper is role="radiogroup" — children advertising
    // aria-pressed (a toggle-button attribute) instead of role="radio" +
    // aria-checked would mismatch the container's promised semantics.
    expect(staticBtn.getAttribute("role")).toBe("radio");
    expect(functionBtn.getAttribute("role")).toBe("radio");
    expect(staticBtn.getAttribute("aria-checked")).toBe("true");
    expect(functionBtn.getAttribute("aria-checked")).toBe("false");
    expect(staticBtn.hasAttribute("aria-pressed")).toBe(false);
    expect(functionBtn.hasAttribute("aria-pressed")).toBe(false);

    fireEvent.click(functionBtn);

    expect(staticBtn.getAttribute("aria-checked")).toBe("false");
    expect(functionBtn.getAttribute("aria-checked")).toBe("true");
  });

  it("edits function name, tags, context, and responseTimeoutMs", () => {
    const { getSchedule } = renderScheduleForm();

    enableSchedule();
    fireEvent.click(screen.getByTestId("inspector-transition-schedule-mode-function"));

    fireEvent.change(screen.getByTestId("inspector-transition-schedule-function-name"), {
      target: { value: "computeFireTime" },
    });
    fireEvent.blur(screen.getByTestId("inspector-transition-schedule-function-name"));

    fireEvent.change(screen.getByTestId("inspector-transition-schedule-function-tags"), {
      target: { value: "alpha,beta" },
    });
    fireEvent.blur(screen.getByTestId("inspector-transition-schedule-function-tags"));

    fireEvent.change(screen.getByTestId("inspector-transition-schedule-function-context"), {
      target: { value: "ctx-payload" },
    });
    fireEvent.blur(screen.getByTestId("inspector-transition-schedule-function-context"));

    commit("inspector-transition-schedule-function-response-timeout", "-1");

    expect(getSchedule()?.function).toEqual({
      name: "computeFireTime",
      resultKind: "Schedule",
      calculationNodesTags: "alpha,beta",
      context: "ctx-payload",
      responseTimeoutMs: -1,
    });
  });

  it("calculationNodesTags is normalized the same way ProcessorForm normalizes tags", () => {
    const { getSchedule } = renderScheduleForm();

    enableSchedule();
    fireEvent.click(screen.getByTestId("inspector-transition-schedule-mode-function"));

    fireEvent.change(screen.getByTestId("inspector-transition-schedule-function-tags"), {
      target: { value: "  a , b ,, " },
    });
    fireEvent.blur(screen.getByTestId("inspector-transition-schedule-function-tags"));

    // Falsifiable: writing the raw string verbatim (the pre-fix behaviour)
    // would store "  a , b ,, " rather than the trimmed/deduped "a,b" that
    // ProcessorForm's normalizeTags produces for the same input.
    expect(getSchedule()?.function?.calculationNodesTags).toBe("a,b");
  });

  it("attachEntity round-trips an explicit false, distinct from the default", () => {
    const { getSchedule } = renderScheduleForm();

    enableSchedule();
    fireEvent.click(screen.getByTestId("inspector-transition-schedule-mode-function"));

    // Default (unset) leaves attachEntity absent.
    expect(getSchedule()?.function).not.toHaveProperty("attachEntity");

    fireEvent.change(screen.getByTestId("inspector-transition-schedule-function-attach-entity"), {
      target: { value: "false" },
    });

    // Falsifiable: a plain checkbox (or any control that treats "off" as
    // "omit the key") cannot distinguish explicit false from absent — this
    // assertion only holds if the control actually writes `false`.
    expect(getSchedule()?.function?.attachEntity).toBe(false);

    fireEvent.change(screen.getByTestId("inspector-transition-schedule-function-attach-entity"), {
      target: { value: "true" },
    });
    expect(getSchedule()?.function?.attachEntity).toBe(true);

    fireEvent.change(screen.getByTestId("inspector-transition-schedule-function-attach-entity"), {
      target: { value: "" },
    });
    expect(getSchedule()?.function).not.toHaveProperty("attachEntity");
  });

  it("a non-integer responseTimeoutMs is rejected without corrupting the schedule", () => {
    const { getSchedule } = renderScheduleForm();

    enableSchedule();
    fireEvent.click(screen.getByTestId("inspector-transition-schedule-mode-function"));
    commit("inspector-transition-schedule-function-response-timeout", "not-a-number");

    // Falsifiable: without the integer guard, `Number("not-a-number")` is
    // NaN, which would either write NaN into the schedule or crash — this
    // assertion only holds if the invalid input was rejected outright.
    expect(getSchedule()?.function).not.toHaveProperty("responseTimeoutMs");
  });

  it("the notice no longer claims scheduled transitions return 400 on their own", () => {
    renderScheduleForm();

    const notice = screen.getByTestId("inspector-transition-schedule-notice").textContent ?? "";
    expect(notice).not.toMatch(/not yet executed/i);
    expect(notice).toMatch(/fires on its own/i);
    expect(notice).toMatch(/manually by name/i);
  });

  it("the round trip through applyPatch stays a valid XOR after a function-mode edit", () => {
    const doc = loadDoc({ delayMs: 1 });
    const uuid = Object.keys(doc.meta.ids.transitions)[0]!;

    const after = applyPatch(doc, {
      op: "updateTransition",
      transitionUuid: uuid,
      updates: {
        schedule: {
          function: { name: "fn", resultKind: "Schedule", calculationNodesTags: "tag" },
        },
      },
    });

    const schedule = after.session.workflows[0]!.states["a"]!.transitions[0]!.schedule;
    expect(schedule?.delayMs).toBeUndefined();
    expect(schedule?.function).toEqual({
      name: "fn",
      resultKind: "Schedule",
      calculationNodesTags: "tag",
    });
  });
});

describe("TransitionForm processor type chip (task 14 defect fix)", () => {
  function loadDocWithProcessor() {
    const { document } = parseImportPayload(
      JSON.stringify({
        importMode: "MERGE",
        workflows: [
          {
            version: "1.0",
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
                    processors: [{ type: "EXTERNAL", name: "notify", executionMode: "SYNC" }],
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

  it("renders a preserved processor type verbatim, not lowercased", () => {
    const doc = loadDocWithProcessor();
    const workflow = doc.session.workflows[0]!;
    const transitionUuid = Object.keys(doc.meta.ids.transitions)[0]!;
    const processorUuid = Object.keys(doc.meta.ids.processors)[0]!;
    const transition = workflow.states["a"]!.transitions[0]!;
    const onDispatch = vi.fn<(patch: DomainPatch) => void>();

    render(
      <I18nContext.Provider value={defaultMessages}>
        <TransitionForm
          workflow={workflow}
          stateCode="a"
          transition={transition}
          transitionUuid={transitionUuid}
          transitionIndex={0}
          processorUuids={[processorUuid]}
          anchors={undefined}
          disabled={false}
          onDispatch={onDispatch}
        />
      </I18nContext.Provider>,
    );

    const chip = screen.getByText("EXTERNAL");
    // Falsifiable: with the pre-existing `textTransform: "lowercase"` style,
    // the browser/JSDOM-visible text-transform would still say "lowercase"
    // even though textContent stores the raw string — this checks the
    // actual inline style, not just the DOM text node.
    expect((chip as HTMLElement).style.textTransform).not.toBe("lowercase");
  });
});
