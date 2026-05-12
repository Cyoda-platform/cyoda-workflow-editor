import { useMessages } from "../i18n/context.js";
import type { DerivedState } from "../state/derive.js";

export interface ToolbarProps {
  derived: DerivedState;
  canUndo: boolean;
  canRedo: boolean;
  readOnly: boolean;
  saveDisabled?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave?: () => void;
  onAddState?: () => void;
  onAddComment?: () => void;
  onResetLayout?: () => void;
  onAutoLayout?: () => void;
}

export function Toolbar({
  derived,
  canUndo,
  canRedo,
  readOnly,
  saveDisabled = false,
  onUndo,
  onRedo,
  onSave,
  onAddState,
  onAddComment,
  onResetLayout,
  onAutoLayout,
}: ToolbarProps) {
  const messages = useMessages();
  return (
    <header
      style={{
        padding: "8px 12px",
        borderBottom: "1px solid #E2E8F0",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "white",
      }}
      data-testid="toolbar"
    >
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo || readOnly}
        style={btnStyle}
        data-testid="toolbar-undo"
      >
        {messages.toolbar.undo}
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo || readOnly}
        style={btnStyle}
        data-testid="toolbar-redo"
      >
        {messages.toolbar.redo}
      </button>
      {!readOnly && onAddState && (
        <button
          type="button"
          onClick={onAddState}
          style={{ ...btnStyle, background: "#0F172A", color: "white", borderColor: "#0F172A" }}
          data-testid="toolbar-add-state"
          title="Add State (A)"
        >
          + State
        </button>
      )}
      {!readOnly && onAddComment && (
        <button
          type="button"
          onClick={onAddComment}
          style={btnStyle}
          data-testid="toolbar-add-comment"
          title="Add canvas comment"
        >
          + Note
        </button>
      )}
      {!readOnly && onAutoLayout && (
        <button
          type="button"
          onClick={onAutoLayout}
          style={btnStyle}
          data-testid="toolbar-auto-layout"
          title="Re-run automatic layout (L)"
        >
          Auto Layout
        </button>
      )}
      {!readOnly && onResetLayout && (
        <button
          type="button"
          onClick={onResetLayout}
          style={btnStyle}
          data-testid="toolbar-reset-layout"
          title="Reset all manual positions (Shift+L)"
        >
          Reset Layout
        </button>
      )}
      <div style={{ flex: 1 }} />
      <ValidationPill
        count={derived.errorCount}
        label={messages.toolbar.errors}
        background="#FEF2F2"
        borderColor="#FCA5A5"
        color="#B91C1C"
        testId="toolbar-errors"
      />
      <ValidationPill
        count={derived.warningCount}
        label={messages.toolbar.warnings}
        background="#FFFBEB"
        borderColor="#FCD34D"
        color="#B45309"
        testId="toolbar-warnings"
      />
      <ValidationPill
        count={derived.infoCount}
        label={messages.toolbar.infos}
        background="#EFF6FF"
        borderColor="#93C5FD"
        color="#1D4ED8"
        testId="toolbar-infos"
      />
      {onSave && (
        <button
          type="button"
          onClick={onSave}
          disabled={readOnly || saveDisabled}
          style={{ ...btnStyle, background: "#0F172A", color: "white", borderColor: "#0F172A" }}
          data-testid="toolbar-save"
        >
          {messages.toolbar.save}
        </button>
      )}
    </header>
  );
}

function ValidationPill({
  count,
  label,
  background,
  borderColor,
  color,
  testId,
}: {
  count: number;
  label: string;
  background: string;
  borderColor: string;
  color: string;
  testId: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={`${count} ${label}`}
      style={{
        padding: "3px 8px",
        background,
        border: `1px solid ${borderColor}`,
        color,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
      }}
      data-testid={testId}
    >
      {count} {label}
    </span>
  );
}

const btnStyle = {
  padding: "4px 10px",
  background: "white",
  border: "1px solid #CBD5E1",
  borderRadius: 4,
  fontSize: 13,
  cursor: "pointer",
};
