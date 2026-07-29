import { useEffect, useState } from "react";
import {
  NAME_REGEX,
  type Annotations,
  type DomainPatch,
  type ExecutionMode,
  type ExternalizedProcessor,
  type Processor,
  type Transition,
} from "@cyoda/workflow-core";
import { useMessages } from "../i18n/context.js";
import { normalizeTags } from "./tags.js";
import { colors, radii } from "../style/tokens.js";
import { CustomSelectInput } from "./fields.js";
import { ModalFrame } from "../modals/DeleteStateModal.js";
import { AnnotationsField } from "./AnnotationsField.js";

const EXECUTION_MODES: ExecutionMode[] = [
  "ASYNC_NEW_TX",
  "ASYNC_SAME_TX",
  "SYNC",
  "COMMIT_BEFORE_DISPATCH",
];

function parseOptionalInteger(value: string, label: string): { value?: number; error?: string } {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { value: undefined };
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { error: `${label} must be an integer greater than or equal to 0.` };
  }
  return { value: parsed };
}

type ProcessorDraft = {
  type: string;
  name: string;
  // "" means ABSENT, not a mode. The serializer preserves an absent
  // executionMode (spec §4a) and the documented default at fire is SYNC, so
  // the form must be able to represent "the source had none" without
  // inventing a value on Apply.
  executionMode: ExecutionMode | "";
  startNewTxOnDispatch: boolean;
  // Tri-state, mirroring TransitionForm's schedule.function.attachEntity:
  // "" clears the key (server default: true), "true"/"false" write an explicit
  // boolean. A checkbox cannot represent this, and collapsing an explicit
  // `false` to absent inverts the user's setting.
  attachEntity: "" | "true" | "false";
  calculationNodesTags: string;
  responseTimeoutMs: string;
  retryPolicy: string;
  context: string;
  asyncResult: boolean;
  crossoverToAsyncMs: string;
  annotations?: Annotations;
};

// Reads every field regardless of `type` — cyoda-go 0.8.3 round-trips `type`
// verbatim (EXTERNAL, SCHEDULED, internalized, ""), so a processor whose type
// isn't the canonical "externalized" must still be visible, not blanked out.
// The modal renders such drafts read-only (see `readOnly` below) rather than
// guessing at a shape the editor doesn't actually know.
function toDraft(processor?: Processor): ProcessorDraft {
  return {
    type: processor?.type ?? "externalized",
    name: processor?.name ?? "",
    executionMode: processor?.executionMode ?? "",
    startNewTxOnDispatch: processor?.config?.startNewTxOnDispatch ?? false,
    attachEntity:
      processor?.config?.attachEntity === undefined
        ? ""
        : processor.config.attachEntity
          ? "true"
          : "false",
    calculationNodesTags: processor?.config?.calculationNodesTags ?? "",
    responseTimeoutMs:
      processor?.config?.responseTimeoutMs !== undefined
        ? String(processor.config.responseTimeoutMs)
        : "",
    retryPolicy: processor?.config?.retryPolicy ?? "",
    context: processor?.config?.context ?? "",
    asyncResult: processor?.config?.asyncResult ?? false,
    crossoverToAsyncMs:
      processor?.config?.crossoverToAsyncMs !== undefined
        ? String(processor.config.crossoverToAsyncMs)
        : "",
    annotations: processor?.annotations,
  };
}

/** True for any processor whose type isn't the canonical "externalized" (an
 * absent/empty type is treated as canonical — see coerceCanonicalDefaults). */
function isNonCanonicalType(type: string): boolean {
  return type !== "externalized" && type !== "";
}

const JSON_EDITOR_ESCAPE_HATCH =
  `Shown read-only to avoid guessing at fields this type may not actually support. To edit it ` +
  `anyway, switch to the JSON view, which edits the workflow directly.`;

function nonCanonicalTypeMessage(type: string): string {
  if (type === "internalized") {
    return (
      `This processor uses the reserved type "internalized". cyoda-go accepts it at import ` +
      `but rejects it at dispatch with WORKFLOW_FAILED, so any transition firing this ` +
      `processor will fail at runtime. ${JSON_EDITOR_ESCAPE_HATCH}`
    );
  }
  return (
    `This processor has a non-canonical type "${type}". cyoda-go accepts it today and treats ` +
    `it as externalized, but this permissiveness is documented as narrowing in a future ` +
    `release. ${JSON_EDITOR_ESCAPE_HATCH}`
  );
}

function toProcessor(draft: ProcessorDraft): Processor {
  const responseTimeout = parseOptionalInteger(draft.responseTimeoutMs, "Response timeout");
  const crossover = parseOptionalInteger(draft.crossoverToAsyncMs, "Crossover to async");
  const config: NonNullable<ExternalizedProcessor["config"]> = {};
  if (draft.attachEntity !== "") config.attachEntity = draft.attachEntity === "true";
  const tags = normalizeTags(draft.calculationNodesTags);
  if (tags !== undefined) config.calculationNodesTags = tags;
  if (responseTimeout.value !== undefined) config.responseTimeoutMs = responseTimeout.value;
  if (draft.retryPolicy.trim().length > 0) config.retryPolicy = draft.retryPolicy.trim();
  if (draft.context.trim().length > 0) config.context = draft.context;
  if (draft.asyncResult) config.asyncResult = true;
  // Emitted independently of `asyncResult` (spec §4a): a document that parses
  // with a `crossover-unsupported` warning must not lose the field on Apply.
  if (crossover.value !== undefined) config.crossoverToAsyncMs = crossover.value;
  // cyoda-go 0.8.3 requires this INSIDE config, not on the processor.
  if (draft.executionMode === "COMMIT_BEFORE_DISPATCH" && draft.startNewTxOnDispatch) {
    config.startNewTxOnDispatch = true;
  }

  return {
    // Carries the draft's type through verbatim rather than hardcoding
    // "externalized" — for a non-canonical type the form is read-only (see
    // `isNonCanonicalType`), so this only ever writes back the value that was
    // read in.
    type: draft.type,
    name: draft.name.trim(),
    // Omitted when the source had none — see ProcessorDraft.executionMode.
    ...(draft.executionMode !== "" ? { executionMode: draft.executionMode } : {}),
    ...(Object.keys(config).length > 0 ? { config } : {}),
    ...(draft.annotations !== undefined ? { annotations: draft.annotations } : {}),
  };
}

function validateDraft(
  draft: ProcessorDraft,
  existingNames: string[],
  originalName?: string,
): string | null {
  const name = draft.name.trim();
  if (name.length === 0) return "Processor name is required.";
  if (!NAME_REGEX.test(name)) {
    return "Processor name must start with a letter and contain only letters, digits, underscores, or hyphens.";
  }
  if (existingNames.some((existing) => existing === name && existing !== originalName)) {
    return `Processor "${name}" already exists on this transition.`;
  }

  const responseTimeout = parseOptionalInteger(draft.responseTimeoutMs, "Response timeout");
  if (responseTimeout.error) return responseTimeout.error;
  // Validated regardless of `asyncResult`, because it is now emitted
  // regardless of `asyncResult` (spec §4a).
  const crossover = parseOptionalInteger(draft.crossoverToAsyncMs, "Crossover to async");
  if (crossover.error) return crossover.error;
  return null;
}

export function summarizeProcessor(processor: Processor): string {
  // SYNC, not ASYNC_NEW_TX, is the documented default at fire (spec §4a).
  const parts: string[] = [processor.executionMode ?? "SYNC"];
  if (processor.config?.calculationNodesTags) {
    parts.push(`tags ${processor.config.calculationNodesTags}`);
  }
  if (processor.config?.asyncResult) parts.push("async result");
  return parts.join(" · ");
}

export function duplicateProcessorName(existingNames: string[], originalName: string): string {
  const base = `${originalName}-copy`;
  if (!existingNames.includes(base)) return base;
  let index = 2;
  while (existingNames.includes(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

export function ProcessorEditorModal({
  title,
  initialProcessor,
  existingNames,
  disabled,
  onCancel,
  onApply,
}: {
  title: string;
  initialProcessor?: Processor;
  existingNames: string[];
  disabled: boolean;
  onCancel: () => void;
  onApply: (processor: Processor) => void;
}) {
  const [draft, setDraft] = useState<ProcessorDraft>(() => toDraft(initialProcessor));

  useEffect(() => {
    setDraft(toDraft(initialProcessor));
  }, [initialProcessor]);

  // A non-canonical type means the editor doesn't actually know this
  // processor's field shape (cyoda-go round-trips whatever it was given).
  // Render read-only rather than let Apply write back fields the form merely
  // assumes — see toDraft/toProcessor above.
  const readOnly = isNonCanonicalType(draft.type);
  const fieldsDisabled = disabled || readOnly;
  const error = validateDraft(draft, existingNames, initialProcessor?.name);

  const apply = () => {
    if (fieldsDisabled || error) return;
    onApply(toProcessor(draft));
  };

  return (
    <ModalFrame onCancel={onCancel} labelledBy="processor-modal-title">
      <div style={modalStyle} data-testid="processor-editor-modal">
        <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 id="processor-modal-title" style={{ margin: 0, fontSize: 18 }}>
            {title}
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: colors.textTertiary }}>
            Processor changes stay local until Apply.
          </p>
        </header>

        {readOnly && (
          <div role="alert" style={warningStyle} data-testid="processor-non-canonical-type-warning">
            {nonCanonicalTypeMessage(draft.type)}
          </div>
        )}

        <div style={modalBodyStyle}>
          <FormField label="Name">
            <input
              type="text"
              value={draft.name}
              disabled={fieldsDisabled}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              data-testid="processor-name-input"
              style={fieldsDisabled ? disabledInputStyle : inputStyle}
            />
          </FormField>

          <FormField label="Execution mode">
            <CustomSelectInput
              value={draft.executionMode}
              options={[
                { value: "", label: "Default (SYNC)" },
                ...EXECUTION_MODES.map((mode) => ({ value: mode, label: mode })),
              ]}
              disabled={fieldsDisabled}
              onChange={(next) =>
                setDraft((current) => ({
                  ...current,
                  executionMode: next as ExecutionMode | "",
                  // startNewTxOnDispatch is only valid for COMMIT_BEFORE_DISPATCH.
                  startNewTxOnDispatch:
                    next === "COMMIT_BEFORE_DISPATCH" ? current.startNewTxOnDispatch : false,
                }))
              }
              testId="processor-execution-mode"
            />
          </FormField>

          <label
            style={
              draft.executionMode === "COMMIT_BEFORE_DISPATCH"
                ? checkboxRowStyle
                : { ...checkboxRowStyle, opacity: 0.5 }
            }
            title="Only for COMMIT_BEFORE_DISPATCH: open a fresh transaction context for the dispatched call."
          >
            <input
              type="checkbox"
              checked={draft.startNewTxOnDispatch}
              disabled={fieldsDisabled || draft.executionMode !== "COMMIT_BEFORE_DISPATCH"}
              onChange={(event) =>
                setDraft((current) => ({ ...current, startNewTxOnDispatch: event.target.checked }))
              }
              data-testid="processor-start-new-tx"
            />
            <span>Start new transaction on dispatch</span>
          </label>

          <FormField label="Attach entity">
            {/* Three options, not a checkbox: absent means `true` to the
                server, so an explicit `false` must be distinguishable from
                "not set" — same shape as TransitionForm's schedule function. */}
            <CustomSelectInput
              value={draft.attachEntity}
              options={[
                { value: "" as const, label: "Default (true)" },
                { value: "true" as const, label: "True" },
                { value: "false" as const, label: "False" },
              ]}
              disabled={fieldsDisabled}
              onChange={(next) =>
                setDraft((current) => ({
                  ...current,
                  attachEntity: next as "" | "true" | "false",
                }))
              }
              testId="processor-attach-entity"
            />
          </FormField>

          <FormField label="Calculation node tags">
            <input
              type="text"
              value={draft.calculationNodesTags}
              disabled={fieldsDisabled}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  calculationNodesTags: event.target.value,
                }))
              }
              data-testid="processor-tags-input"
              style={fieldsDisabled ? disabledInputStyle : inputStyle}
            />
          </FormField>

          <FormField label="Response timeout ms">
            <input
              type="text"
              value={draft.responseTimeoutMs}
              disabled={fieldsDisabled}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  responseTimeoutMs: event.target.value,
                }))
              }
              style={fieldsDisabled ? disabledInputStyle : inputStyle}
            />
          </FormField>

          <FormField label="Retry policy">
            <CustomSelectInput
              value={draft.retryPolicy}
              options={[
                { value: "", label: "Default (FIXED)" },
                { value: "NONE", label: "NONE" },
                { value: "FIXED", label: "FIXED" },
              ]}
              disabled={fieldsDisabled}
              onChange={(next) => setDraft((current) => ({ ...current, retryPolicy: next }))}
              testId="processor-retry-policy"
            />
          </FormField>

          <FormField label="Context">
            <input
              type="text"
              value={draft.context}
              placeholder="passed verbatim as request parameters"
              disabled={fieldsDisabled}
              onChange={(event) =>
                setDraft((current) => ({ ...current, context: event.target.value }))
              }
              data-testid="processor-context-input"
              style={fieldsDisabled ? disabledInputStyle : inputStyle}
            />
          </FormField>

          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={draft.asyncResult}
              disabled={fieldsDisabled}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  asyncResult: event.target.checked,
                  crossoverToAsyncMs: event.target.checked ? current.crossoverToAsyncMs : "",
                }))
              }
              data-testid="processor-async-result"
            />
            <span>Async result</span>
          </label>

          <FormField label="Crossover to async ms">
            <input
              type="text"
              value={draft.crossoverToAsyncMs}
              disabled={fieldsDisabled || !draft.asyncResult}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  crossoverToAsyncMs: event.target.value,
                }))
              }
              data-testid="processor-crossover-input"
              style={fieldsDisabled ? disabledInputStyle : inputStyle}
            />
          </FormField>
        </div>

        <div
          data-testid="processor-annotations"
          style={{ display: "flex", flexDirection: "column", gap: 8, gridColumn: "1 / -1" }}
        >
          <AnnotationsField
            value={draft.annotations}
            disabled={fieldsDisabled}
            modelKey={`processor-${initialProcessor?.name ?? "new"}`}
            onCommit={(a) => setDraft((c) => ({ ...c, annotations: a }))}
            onRemove={() => setDraft((c) => ({ ...c, annotations: undefined }))}
          />
        </div>

        {error && (
          <div role="alert" style={errorStyle} data-testid="processor-modal-error">
            {error}
          </div>
        )}

        <footer style={modalFooterStyle}>
          <button type="button" onClick={onCancel} style={ghostBtn} data-testid="processor-modal-cancel">
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={fieldsDisabled || !!error}
            style={fieldsDisabled || error ? disabledPrimaryBtn : primaryBtn}
            data-testid="processor-modal-apply"
          >
            Apply processor
          </button>
        </footer>
      </div>
    </ModalFrame>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

export function ProcessorForm({
  processor,
  processorUuid,
  processorIndex,
  transition,
  transitionUuid,
  disabled,
  onDispatch,
}: {
  processor: Processor;
  processorUuid: string;
  processorIndex: number;
  transition: Transition;
  transitionUuid: string;
  disabled: boolean;
  onDispatch: (patch: DomainPatch) => void;
}) {
  const messages = useMessages();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div style={summaryCardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <strong style={{ fontSize: 13 }}>{processor.name}</strong>
          <span style={{ fontSize: 12, color: colors.textSecondary }}>{summarizeProcessor(processor)}</span>
        </div>
        <span style={chipStyle}>{processor.type}</span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setModalOpen(true)} style={ghostBtn}>
          Edit
        </button>
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

      {modalOpen && (
        <ProcessorEditorModal
          title={`Edit ${processor.name}`}
          initialProcessor={processor}
          existingNames={(transition.processors ?? [])
            .filter((_p, index) => index !== processorIndex)
            .map((p) => p.name)}
          disabled={disabled}
          onCancel={() => setModalOpen(false)}
          onApply={(nextProcessor) => {
            onDispatch({
              op: "updateProcessor",
              processorUuid,
              updates: nextProcessor,
            });
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

const labelStyle = {
  fontSize: 12,
  color: colors.textSecondary,
  marginBottom: 2,
};

const inputStyle = {
  padding: "6px 8px",
  fontSize: 13,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.sm,
  background: "white",
};

const disabledInputStyle = {
  ...inputStyle,
  background: colors.surfaceMuted,
  color: colors.textTertiary,
};

const modalStyle = {
  width: "min(760px, calc(100vw - 48px))",
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
};

const modalBodyStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const modalFooterStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};

const checkboxRowStyle = {
  display: "flex",
  flexDirection: "row" as const,
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: colors.textSecondary,
  cursor: "pointer",
};

const errorStyle = {
  padding: "8px 10px",
  border: `1px solid ${colors.dangerBorder}`,
  background: colors.dangerBg,
  borderRadius: radii.md,
  color: colors.danger,
  fontSize: 12,
};

const warningStyle = {
  padding: "8px 10px",
  border: `1px solid ${colors.warningBorder}`,
  background: colors.warningBg,
  borderRadius: radii.md,
  color: colors.warning,
  fontSize: 12,
};

const ghostBtn = {
  padding: "6px 10px",
  background: "white",
  border: `1px solid ${colors.border}`,
  borderRadius: radii.sm,
  fontSize: 12,
  cursor: "pointer",
};

const primaryBtn = {
  ...ghostBtn,
  background: colors.primary,
  color: "white",
  borderColor: colors.primary,
};

const disabledPrimaryBtn = {
  ...primaryBtn,
  opacity: 0.5,
  cursor: "not-allowed",
};

const dangerBtn = {
  ...ghostBtn,
  background: colors.dangerBg,
  borderColor: colors.dangerBorder,
  color: colors.danger,
};

const chipStyle = {
  fontSize: 11,
  padding: "2px 6px",
  borderRadius: radii.pill,
  background: colors.borderSubtle,
  color: colors.textSecondary,
  // No textTransform: a preserved type (e.g. "EXTERNAL") must render exactly
  // as stored — lowercasing it here would misrepresent the value elsewhere in
  // the UI, contradicting the point of preserving it verbatim.
};

const summaryCardStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  padding: 10,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.md,
  background: "white",
};
