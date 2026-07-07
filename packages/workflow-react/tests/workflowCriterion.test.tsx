import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nContext } from "../src/i18n/context.js";
import { defaultMessages } from "../src/i18n/en.js";
import { CriterionField } from "../src/inspector/CriterionField.js";

afterEach(() => cleanup());

function renderField(emptyText?: string) {
  return render(
    <I18nContext.Provider value={defaultMessages}>
      <CriterionField
        value={undefined}
        disabled={false}
        modelKey="host-wf"
        emptyText={emptyText}
        onCommit={() => {}}
        onRemove={() => {}}
      />
    </I18nContext.Provider>,
  );
}

describe("CriterionField empty-state copy", () => {
  it("shows injected empty text and suppresses the automated warning", () => {
    renderField(defaultMessages.criterion.workflowNone);
    expect(screen.getByText(defaultMessages.criterion.workflowNone)).toBeTruthy();
    expect(screen.queryByTestId("criterion-automated-warning")).toBeNull();
  });

  it("falls back to the automated transition copy when no emptyText is given", () => {
    renderField(undefined);
    expect(screen.getByText(defaultMessages.criterion.noneAutomated)).toBeTruthy();
    expect(screen.getByTestId("criterion-automated-warning")).toBeTruthy();
  });
});
