import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Processor } from "@cyoda/workflow-core";
import { ProcessorEditorModal } from "../src/inspector/ProcessorForm.js";

afterEach(() => cleanup());

const base: Processor = { type: "externalized", name: "notify", executionMode: "SYNC" };

function renderModal(initial: Processor) {
  const onApply = vi.fn<(p: Processor) => void>();
  render(
    <ProcessorEditorModal
      title="Edit processor"
      initialProcessor={initial}
      existingNames={[]}
      disabled={false}
      onCancel={() => {}}
      onApply={onApply}
    />,
  );
  return { onApply };
}

describe("processor context field", () => {
  it("shows the existing context value and commits edits to config.context", () => {
    const { onApply } = renderModal({ ...base, config: { context: "channel=email" } });
    const input = screen.getByTestId("processor-context-input") as HTMLInputElement;
    expect(input.value).toBe("channel=email");

    fireEvent.change(input, { target: { value: "channel=sms,customer" } });
    fireEvent.click(screen.getByTestId("processor-modal-apply"));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0]![0].config?.context).toBe("channel=sms,customer");
  });

  it("omits context from config when cleared to whitespace", () => {
    const { onApply } = renderModal({ ...base, config: { context: "x" } });
    fireEvent.change(screen.getByTestId("processor-context-input"), { target: { value: "  " } });
    fireEvent.click(screen.getByTestId("processor-modal-apply"));
    expect(onApply.mock.calls[0]![0].config?.context).toBeUndefined();
  });
});

describe("processor startNewTxOnDispatch field", () => {
  it("disables the flag unless execution mode is COMMIT_BEFORE_DISPATCH", () => {
    renderModal({ ...base, executionMode: "SYNC" });
    const cb = screen.getByTestId("processor-start-new-tx") as HTMLInputElement;
    expect(cb.disabled).toBe(true);
  });

  it("emits startNewTxOnDispatch when set under COMMIT_BEFORE_DISPATCH", () => {
    const { onApply } = renderModal({ ...base, executionMode: "COMMIT_BEFORE_DISPATCH" });
    const cb = screen.getByTestId("processor-start-new-tx") as HTMLInputElement;
    expect(cb.disabled).toBe(false);

    fireEvent.click(cb);
    fireEvent.click(screen.getByTestId("processor-modal-apply"));

    expect(onApply.mock.calls[0]![0].startNewTxOnDispatch).toBe(true);
  });
});
