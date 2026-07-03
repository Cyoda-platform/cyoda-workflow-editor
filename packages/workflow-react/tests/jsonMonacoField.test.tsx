import { expect, test, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { JsonMonacoField } from "../src/inspector/JsonMonacoField.js";

afterEach(cleanup);

// No provider needed: useMessages() defaults to defaultMessages; no CriterionMonacoProvider → textarea path.
function renderField(props: Partial<React.ComponentProps<typeof JsonMonacoField>> = {}) {
  const onChange = vi.fn();
  render(
    <JsonMonacoField
      buffer={props.buffer ?? '{"a":1}'}
      disabled={props.disabled ?? false}
      modelUri="cyoda://test/x.json"
      onChange={props.onChange ?? onChange}
      testId="test-json"
      {...props}
    />,
  );
  return { onChange: props.onChange ?? onChange };
}

test("textarea path: renders the buffer and reports edits via onChange", () => {
  const { onChange } = renderField({ buffer: '{"a":1}' });
  const ta = screen.getByTestId("test-json") as HTMLTextAreaElement;
  expect(ta.value).toBe('{"a":1}');
  fireEvent.change(ta, { target: { value: '{"a":2}' } });
  expect(onChange).toHaveBeenLastCalledWith('{"a":2}');
});

test("Format re-indents valid JSON via onChange; leaves invalid JSON untouched", () => {
  const onChange = vi.fn();
  renderField({ buffer: '{"a":1,"b":2}', onChange });
  fireEvent.click(screen.getByTestId("test-json-format"));
  expect(onChange).toHaveBeenLastCalledWith('{\n  "a": 1,\n  "b": 2\n}');

  onChange.mockClear();
  cleanup();
  renderField({ buffer: "{ not json", onChange });
  fireEvent.click(screen.getByTestId("test-json-format"));
  expect(onChange).not.toHaveBeenCalled();
});

test("disabled makes the textarea read-only", () => {
  renderField({ disabled: true });
  expect((screen.getByTestId("test-json") as HTMLTextAreaElement).disabled).toBe(true);
});
