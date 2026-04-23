import type { DomainPatch, State, Workflow } from "@cyoda/workflow-core";
import { useMessages } from "../i18n/context.js";
import { FieldGroup, TextField } from "./fields.js";

export function StateForm({
  workflow,
  stateCode,
  state,
  disabled,
  onDispatch,
  onRequestDelete,
}: {
  workflow: Workflow;
  stateCode: string;
  state: State;
  disabled: boolean;
  onDispatch: (patch: DomainPatch) => void;
  onRequestDelete: () => void;
}) {
  const messages = useMessages();
  const transitionCount = state.transitions.length;
  return (
    <FieldGroup title={messages.inspector.properties}>
      <TextField
        label={messages.inspector.name}
        value={stateCode}
        disabled={disabled}
        onCommit={(next) =>
          next !== stateCode &&
          onDispatch({
            op: "renameState",
            workflow: workflow.name,
            from: stateCode,
            to: next,
          })
        }
        testId="inspector-state-name"
      />
      <div style={{ fontSize: 12, color: "#475569" }}>
        {transitionCount} outgoing transition{transitionCount === 1 ? "" : "s"}.
      </div>
      <button
        type="button"
        onClick={onRequestDelete}
        disabled={disabled}
        data-testid="inspector-state-delete"
        style={dangerBtn}
      >
        Delete state…
      </button>
    </FieldGroup>
  );
}

const dangerBtn = {
  alignSelf: "flex-start" as const,
  padding: "6px 10px",
  background: "#FEF2F2",
  border: "1px solid #FCA5A5",
  color: "#B91C1C",
  borderRadius: 4,
  fontSize: 13,
  cursor: "pointer",
};
