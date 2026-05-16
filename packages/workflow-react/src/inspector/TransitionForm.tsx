import { useEffect, useRef, useState } from "react";
import type {
  DomainPatch,
  EdgeAnchor,
  EdgeAnchorPair,
  HostRef,
  Transition,
  ValidationIssue,
  Workflow,
} from "@cyoda/workflow-core";
import { NAME_REGEX } from "@cyoda/workflow-core";
import { useMessages } from "../i18n/context.js";
import { CheckboxField, FieldGroup, SelectField, TextField } from "./fields.js";
import { CriterionSection } from "./CriterionForm.js";
import { ProcessorForm } from "./ProcessorForm.js";
import type { Selection } from "../state/types.js";

export function TransitionForm({
  workflow,
  stateCode,
  transition,
  transitionUuid,
  transitionIndex,
  processorUuids,
  anchors,
  disabled,
  issues,
  onDispatch,
  onSelectionChange,
}: {
  workflow: Workflow;
  stateCode: string;
  transition: Transition;
  transitionUuid: string;
  transitionIndex: number;
  processorUuids: string[];
  anchors: EdgeAnchorPair | undefined;
  disabled: boolean;
  issues?: ValidationIssue[];
  onDispatch: (patch: DomainPatch) => void;
  onSelectionChange?: (selection: Selection) => void;
}) {
  const messages = useMessages();
  const [renameError, setRenameError] = useState<string | null>(null);
  const [expandedProcessorIndex, setExpandedProcessorIndex] = useState<number | null>(null);
  const [expandNewProcessor, setExpandNewProcessor] = useState(false);
  const priorProcessorCount = useRef(transition.processors?.length ?? 0);

  const update = (updates: Partial<Transition>) =>
    onDispatch({ op: "updateTransition", transitionUuid, updates });

  const removeTransition = () => onDispatch({ op: "removeTransition", transitionUuid });

  const handleRename = (next: string) => {
    if (next === transition.name) return;
    setRenameError(null);
    if (!NAME_REGEX.test(next)) {
      setRenameError(`"${next}" is not a valid transition name`);
      return;
    }
    const sibling = workflow.states[stateCode]?.transitions ?? [];
    if (sibling.some((t) => t.name === next)) {
      setRenameError(`Transition "${next}" already exists on this state`);
      return;
    }
    update({ name: next });
  };

  const setAnchor = (role: "source" | "target", next: EdgeAnchor | "") => {
    const current: EdgeAnchorPair = anchors ?? {};
    const updated: EdgeAnchorPair = { ...current };
    if (next === "") delete updated[role];
    else updated[role] = next;
    const isEmpty = updated.source === undefined && updated.target === undefined;
    onDispatch({ op: "setEdgeAnchors", transitionUuid, anchors: isEmpty ? null : updated });
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

  const allStateNames = Object.keys(workflow.states);
  const stateOptions = allStateNames.map((s) => ({ value: s, label: s }));

  const processorCount = transition.processors?.length ?? 0;
  const host: HostRef = {
    kind: "transition",
    workflow: workflow.name,
    state: stateCode,
    transitionUuid,
  };

  useEffect(() => {
    if (expandNewProcessor && processorCount > priorProcessorCount.current) {
      setExpandedProcessorIndex(processorCount - 1);
      setExpandNewProcessor(false);
    }
    priorProcessorCount.current = processorCount;
  }, [expandNewProcessor, processorCount]);

  return (
    <div style={transitionFormStyle}>
      <FieldGroup title={messages.inspector.properties}>
        <TextField
          label={messages.inspector.name}
          value={transition.name}
          disabled={disabled}
          onCommit={handleRename}
          testId="inspector-transition-name"
        />
        {renameError && (
          <div role="alert" style={{ color: "#B91C1C", fontSize: 12 }}>
            {renameError}
          </div>
        )}

        {/* Target state — dropdown instead of free text */}
        <SelectField
          label="Target state"
          value={transition.next as (typeof allStateNames)[number]}
          options={stateOptions}
          disabled={disabled}
          onChange={(next) => update({ next })}
          testId="inspector-transition-next"
        />

        {/* Move to different source state */}
        {!disabled && (
          <SelectField
            label="Source state (move)"
            value={stateCode as (typeof allStateNames)[number]}
            options={stateOptions}
            disabled={disabled}
            onChange={(toState) => {
              if (toState === stateCode) return;
              onDispatch({
                op: "moveTransitionSource",
                workflow: workflow.name,
                fromState: stateCode,
                toState,
                transitionName: transition.name,
              });
            }}
            testId="inspector-transition-source-state"
          />
        )}

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

        {/* Inline validation issues */}
        {issues && issues.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {issues.map((issue, i) => (
              <div
                key={`${issue.code}-${i}`}
                role="alert"
                style={{
                  padding: "4px 8px",
                  background: issue.severity === "error" ? "#FEF2F2" : "#FFFBEB",
                  border: `1px solid ${issue.severity === "error" ? "#FCA5A5" : "#FCD34D"}`,
                  borderRadius: 4,
                  fontSize: 12,
                  color: issue.severity === "error" ? "#B91C1C" : "#B45309",
                }}
              >
                {issue.message}
              </div>
            ))}
          </div>
        )}
      </FieldGroup>

      <TransitionSection
        title={messages.inspector.criteria}
        testId="inspector-transition-criteria-section"
      >
        <CriterionSection
          host={host}
          stateCode={stateCode}
          transitionName={transition.name}
          targetState={transition.next}
          manual={transition.manual}
          criterion={transition.criterion}
          disabled={disabled}
          onDispatch={onDispatch}
          onSelectionChange={onSelectionChange}
        />
      </TransitionSection>

      <TransitionSection
        title={`${messages.inspector.processes} (${processorCount})`}
        testId="inspector-transition-processes-section"
      >
        {(transition.processors ?? []).map((p, i) => (
          <div key={processorUuids[i] ?? `${p.name}-${i}`} style={processorCardStyle}>
            <button
              type="button"
              onClick={() =>
                setExpandedProcessorIndex(expandedProcessorIndex === i ? null : i)
              }
              style={{
                ...processorBtn,
                borderColor: expandedProcessorIndex === i ? "#94A3B8" : "#CBD5E1",
              }}
              data-testid={`inspector-processor-${i}`}
              aria-expanded={expandedProcessorIndex === i}
            >
              {p.name}
              <span style={{ marginLeft: 6, color: "#94a3b8", fontSize: 11 }}>
                [{p.type}]
              </span>
            </button>
            {expandedProcessorIndex === i && processorUuids[i] && (
              <div
                style={inlineProcessorEditorStyle}
                data-testid={`inspector-inline-processor-${i}`}
              >
                <ProcessorForm
                  processor={p}
                  processorUuid={processorUuids[i]}
                  processorIndex={i}
                  transitionUuid={transitionUuid}
                  workflow={workflow}
                  disabled={disabled}
                  onDispatch={onDispatch}
                />
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setExpandNewProcessor(true);
            onDispatch({
              op: "addProcessor",
              transitionUuid,
              processor: {
                type: "externalized",
                name: `proc${processorCount + 1}`,
                executionMode: "ASYNC_NEW_TX",
                config: { attachEntity: false, responseTimeoutMs: 5000 },
              },
            });
          }}
          style={ghostBtn}
          data-testid="inspector-add-processor"
        >
          {messages.inspector.addProcessor}
        </button>
      </TransitionSection>
    </div>
  );
}

function TransitionSection({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <section style={transitionSectionStyle} data-testid={testId}>
      <header style={sectionHeaderStyle}>{title}</header>
      {children}
    </section>
  );
}

const transitionFormStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
};

const transitionSectionStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  paddingTop: 12,
  borderTop: "1px solid #E2E8F0",
};

const sectionHeaderStyle = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "#475569",
};

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
  width: "100%",
  textAlign: "left" as const,
  background: "#F8FAFC",
};

const processorCardStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
};

const inlineProcessorEditorStyle = {
  padding: 8,
  border: "1px solid #E2E8F0",
  borderRadius: 4,
  background: "white",
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
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#334155" }}>
      <span style={{ fontWeight: 500 }}>{label}</span>
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value === "" ? "" : (event.target.value as EdgeAnchor))
        }
        data-testid={testId}
        style={{ padding: "4px 6px", border: "1px solid #CBD5E1", borderRadius: 4, background: "white", fontSize: 12 }}
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
