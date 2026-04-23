import type {
  DomainPatch,
  EdgeAnchor,
  EdgeAnchorPair,
  Transition,
  Workflow,
} from "@cyoda/workflow-core";
import { useMessages } from "../i18n/context.js";
import { CheckboxField, FieldGroup, TextField } from "./fields.js";

export function TransitionForm({
  workflow,
  stateCode,
  transition,
  transitionUuid,
  transitionIndex,
  anchors,
  disabled,
  onDispatch,
  onSelectProcessor,
}: {
  workflow: Workflow;
  stateCode: string;
  transition: Transition;
  transitionUuid: string;
  transitionIndex: number;
  anchors: EdgeAnchorPair | undefined;
  disabled: boolean;
  onDispatch: (patch: DomainPatch) => void;
  onSelectProcessor: (processorUuid: string) => void;
}) {
  const messages = useMessages();
  const update = (updates: Partial<Transition>) =>
    onDispatch({ op: "updateTransition", transitionUuid, updates });

  const removeTransition = () =>
    onDispatch({ op: "removeTransition", transitionUuid });

  const setAnchor = (role: "source" | "target", next: EdgeAnchor | "") => {
    const current: EdgeAnchorPair = anchors ?? {};
    const updated: EdgeAnchorPair = { ...current };
    if (next === "") delete updated[role];
    else updated[role] = next;
    const isEmpty = updated.source === undefined && updated.target === undefined;
    onDispatch({
      op: "setEdgeAnchors",
      transitionUuid,
      anchors: isEmpty ? null : updated,
    });
  };

  const reorder = (direction: -1 | 1) => {
    const toIndex = transitionIndex + direction;
    if (toIndex < 0) return;
    onDispatch({
      op: "reorderTransition",
      workflow: workflow.name,
      fromState: stateCode,
      transitionUuid,
      toIndex,
    });
  };

  return (
    <FieldGroup title={messages.inspector.properties}>
      <TextField
        label={messages.inspector.name}
        value={transition.name}
        disabled={disabled}
        onCommit={(next) => update({ name: next })}
        testId="inspector-transition-name"
      />
      <TextField
        label="Target state"
        value={transition.next}
        disabled={disabled}
        onCommit={(next) => update({ next })}
        testId="inspector-transition-next"
      />
      <CheckboxField
        label={messages.inspector.manual}
        checked={transition.manual}
        disabled={disabled}
        onChange={(next) => update({ manual: next })}
        testId="inspector-transition-manual"
      />
      <CheckboxField
        label={messages.inspector.disabled}
        checked={transition.disabled}
        disabled={disabled}
        onChange={(next) => update({ disabled: next })}
        testId="inspector-transition-disabled"
      />

      <AnchorSelect
        label={messages.inspector.sourceAnchor}
        value={anchors?.source}
        disabled={disabled}
        messages={messages}
        onChange={(next) => setAnchor("source", next)}
        testId="inspector-transition-source-anchor"
      />
      <AnchorSelect
        label={messages.inspector.targetAnchor}
        value={anchors?.target}
        disabled={disabled}
        messages={messages}
        onChange={(next) => setAnchor("target", next)}
        testId="inspector-transition-target-anchor"
      />

      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" disabled={disabled} onClick={() => reorder(-1)} style={ghostBtn}>
          {messages.inspector.moveUp}
        </button>
        <button type="button" disabled={disabled} onClick={() => reorder(1)} style={ghostBtn}>
          {messages.inspector.moveDown}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={removeTransition}
          style={dangerBtn}
          data-testid="inspector-transition-delete"
        >
          Delete
        </button>
      </div>

      <section style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        <header style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>
          {messages.inspector.processors}
        </header>
        {(transition.processors ?? []).map((p, i) => (
          <button
            type="button"
            key={`${p.name}-${i}`}
            onClick={() => {
              // Processor UUIDs are looked up by ordinal in the resolver; this
              // shell relies on the caller to translate index → UUID, which
              // it does via inspector/resolve.ts helpers wired by WorkflowEditor.
              onSelectProcessor(`__ordinal:${transitionUuid}:${i}`);
            }}
            style={processorBtn}
            data-testid={`inspector-processor-${i}`}
          >
            {p.name}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onDispatch({
              op: "addProcessor",
              transitionUuid,
              processor: {
                type: "externalized",
                name: "newProcessor",
                executionMode: "ASYNC_NEW_TX",
                config: {
                  attachEntity: false,
                  responseTimeoutMs: 5000,
                },
              },
            })
          }
          style={ghostBtn}
          data-testid="inspector-add-processor"
        >
          {messages.inspector.addProcessor}
        </button>
      </section>
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

const processorBtn = {
  ...ghostBtn,
  textAlign: "left" as const,
  background: "#F8FAFC",
};

function AnchorSelect({
  label,
  value,
  disabled,
  messages,
  onChange,
  testId,
}: {
  label: string;
  value: EdgeAnchor | undefined;
  disabled: boolean;
  messages: ReturnType<typeof useMessages>;
  onChange: (next: EdgeAnchor | "") => void;
  testId: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 12,
        color: "#334155",
      }}
    >
      <span style={{ fontWeight: 500 }}>{label}</span>
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value === "" ? "" : (event.target.value as EdgeAnchor))
        }
        data-testid={testId}
        style={{
          padding: "4px 6px",
          border: "1px solid #CBD5E1",
          borderRadius: 4,
          background: "white",
          fontSize: 12,
        }}
      >
        <option value="">{messages.inspector.anchorDefault}</option>
        <option value="top">{messages.inspector.anchorTop}</option>
        <option value="right">{messages.inspector.anchorRight}</option>
        <option value="bottom">{messages.inspector.anchorBottom}</option>
        <option value="left">{messages.inspector.anchorLeft}</option>
      </select>
    </label>
  );
}
