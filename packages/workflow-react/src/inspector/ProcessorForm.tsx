import type { DomainPatch, Processor } from "@cyoda/workflow-core";
import { useMessages } from "../i18n/context.js";
import { CheckboxField, FieldGroup, SelectField, TextField } from "./fields.js";

const EXECUTION_MODES = [
  { value: "ASYNC_NEW_TX", label: "ASYNC_NEW_TX" },
  { value: "ASYNC_SAME_TX", label: "ASYNC_SAME_TX" },
  { value: "SYNC", label: "SYNC" },
] as const;

export function ProcessorForm({
  processor,
  processorUuid,
  processorIndex,
  transitionUuid,
  disabled,
  onDispatch,
}: {
  processor: Processor;
  processorUuid: string;
  processorIndex: number;
  transitionUuid: string;
  disabled: boolean;
  onDispatch: (patch: DomainPatch) => void;
}) {
  const messages = useMessages();
  const update = (updates: Partial<Processor>) =>
    onDispatch({ op: "updateProcessor", processorUuid, updates });

  const isExternalized = processor.type === "externalized";

  return (
    <FieldGroup title={messages.inspector.properties}>
      <TextField
        label={messages.inspector.name}
        value={processor.name}
        disabled={disabled}
        onCommit={(next) => update({ name: next } as Partial<Processor>)}
        testId="inspector-processor-name"
      />
      {isExternalized && (
        <>
          <SelectField
            label={messages.inspector.executionMode}
            value={processor.executionMode ?? "ASYNC_NEW_TX"}
            options={EXECUTION_MODES}
            disabled={disabled}
            onChange={(next) => update({ executionMode: next } as Partial<Processor>)}
            testId="inspector-processor-execmode"
          />
          <CheckboxField
            label="Attach entity"
            checked={processor.config?.attachEntity ?? false}
            disabled={disabled}
            onChange={(next) =>
              update({
                config: { ...(processor.config ?? {}), attachEntity: next },
              } as Partial<Processor>)
            }
            testId="inspector-processor-attachentity"
          />
          <TextField
            label="Response timeout (ms)"
            value={String(processor.config?.responseTimeoutMs ?? 5000)}
            disabled={disabled}
            onCommit={(next) => {
              const parsed = Number.parseInt(next, 10);
              if (!Number.isFinite(parsed)) return;
              update({
                config: { ...(processor.config ?? {}), responseTimeoutMs: parsed },
              } as Partial<Processor>);
            }}
            testId="inspector-processor-timeout"
          />
        </>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          disabled={disabled || processorIndex === 0}
          onClick={() =>
            onDispatch({
              op: "reorderProcessor",
              transitionUuid,
              processorUuid,
              toIndex: processorIndex - 1,
            })
          }
          style={ghostBtn}
        >
          {messages.inspector.moveUp}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onDispatch({
              op: "reorderProcessor",
              transitionUuid,
              processorUuid,
              toIndex: processorIndex + 1,
            })
          }
          style={ghostBtn}
        >
          {messages.inspector.moveDown}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDispatch({ op: "removeProcessor", processorUuid })}
          style={dangerBtn}
          data-testid="inspector-processor-delete"
        >
          {messages.inspector.removeProcessor}
        </button>
      </div>
    </FieldGroup>
  );
}

const ghostBtn = {
  padding: "4px 8px",
  background: "white",
  border: "1px solid #CBD5E1",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
};

const dangerBtn = {
  ...ghostBtn,
  background: "#FEF2F2",
  borderColor: "#FCA5A5",
  color: "#B91C1C",
};
