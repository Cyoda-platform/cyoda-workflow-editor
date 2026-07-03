import { useEffect, useRef } from "react";
import type {
  WorkflowJsonMonacoRuntime,
  WorkflowJsonEditorInstance,
  WorkflowJsonModelLike,
} from "@cyoda/workflow-monaco";
import { useCriterionMonaco } from "./CriterionMonacoContext.js";
import { installMonacoCancellationFilter } from "../components/monacoDisposal.js";
import { useMessages } from "../i18n/context.js";
import { colors, fonts, radii, ghostBtnStyle } from "../style/tokens.js";

export interface JsonMonacoFieldProps {
  buffer: string;
  disabled: boolean;
  modelUri: string;
  onChange: (text: string) => void;
  seed?: string;
  registerSchema?: (monaco: WorkflowJsonMonacoRuntime) => { dispose(): void };
  minHeightPx?: number;
  maxHeightPx?: number;
  testId: string;
}

/** Pretty-print if the text is valid JSON; otherwise return null (caller no-ops). */
function reformat(text: string): string | null {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return null;
  }
}

export function JsonMonacoField(props: JsonMonacoFieldProps) {
  const monaco = useCriterionMonaco();
  const messages = useMessages();
  const onFormat = () => {
    const next = reformat(props.buffer);
    if (next !== null && next !== props.buffer) props.onChange(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onFormat}
          disabled={props.disabled}
          data-testid={`${props.testId}-format`}
          style={{ ...ghostBtnStyle, fontSize: 11, padding: "2px 8px" }}
        >
          {messages.inspector.format}
        </button>
      </div>
      {monaco ? (
        <MonacoPane {...props} monaco={monaco} />
      ) : (
        <textarea
          value={props.buffer}
          disabled={props.disabled}
          rows={12}
          data-testid={props.testId}
          onChange={(e) => props.onChange(e.target.value)}
          style={{
            fontFamily: fonts.mono,
            fontSize: 12,
            padding: 8,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            border: `1px solid ${colors.border}`,
            borderRadius: radii.sm,
            background: colors.surface,
            resize: "vertical",
            minHeight: props.minHeightPx ?? 120,
          }}
        />
      )}
    </div>
  );
}

/**
 * `getContentHeight`/`onDidContentSizeChange` are not part of the shared
 * `WorkflowJsonEditorInstance` runtime type (out of scope to widen here — see
 * task brief), but the real Monaco editor instance provides them. Narrow
 * locally so the optional-call form below type-checks without touching the
 * `@cyoda/workflow-monaco` package.
 */
type EditorWithContentSize = WorkflowJsonEditorInstance & {
  getContentHeight?: () => number;
  onDidContentSizeChange?: (listener: () => void) => { dispose(): void };
};

function MonacoPane({
  monaco,
  buffer,
  disabled,
  modelUri,
  onChange,
  seed,
  registerSchema,
  minHeightPx = 120,
  maxHeightPx = 480,
  testId,
}: JsonMonacoFieldProps & { monaco: WorkflowJsonMonacoRuntime }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<WorkflowJsonEditorInstance | null>(null);
  const modelRef = useRef<WorkflowJsonModelLike | null>(null);

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return;
    const model = monaco.editor.createModel(buffer, "json", monaco.Uri.parse(modelUri));
    modelRef.current = model;
    const editor: EditorWithContentSize = monaco.editor.create(containerRef.current, {
      model,
      automaticLayout: true,
      minimap: { enabled: false },
      wordWrap: "on",
      fontSize: 13,
      tabSize: 2,
      scrollBeyondLastLine: false,
      theme: "vs",
      readOnly: disabled,
    });
    editorRef.current = editor;
    installMonacoCancellationFilter();
    const schemaHandle = registerSchema?.(monaco) ?? null;

    // Grow-to-content up to the cap, then internal scroll.
    const applyHeight = () => {
      const h = Math.min(Math.max(editor.getContentHeight?.() ?? minHeightPx, minHeightPx), maxHeightPx);
      if (containerRef.current) containerRef.current.style.height = `${h}px`;
      editor.layout?.();
    };
    applyHeight();
    const sizeSub = editor.onDidContentSizeChange?.(applyHeight) ?? { dispose() {} };
    const sub = model.onDidChangeContent(() => onChange(model.getValue()));

    return () => {
      sub.dispose();
      sizeSub.dispose();
      schemaHandle?.dispose();
      editor.dispose();
      editorRef.current = null;
      model.dispose();
      modelRef.current = null;
    };
    // created once per modelUri; buffer is pushed via the seed effect below.
  }, [monaco, modelUri]);

  // Push external re-seed into the model without echoing (revert / undo / redo).
  useEffect(() => {
    const model = modelRef.current;
    if (model && seed !== undefined && model.getValue() !== seed) model.setValue(seed);
  }, [seed]);

  useEffect(() => {
    editorRef.current?.updateOptions?.({ readOnly: disabled });
  }, [disabled]);

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      style={{ height: minHeightPx, border: `1px solid ${colors.border}`, borderRadius: radii.sm }}
    />
  );
}
