import type { Workflow } from "@cyoda/workflow-core";
import { useMessages } from "../i18n/context.js";

export interface WorkflowTabsProps {
  workflows: Workflow[];
  activeWorkflow: string | null;
  onSelect: (name: string) => void;
  onAdd?: () => void;
  onClose?: (name: string) => void;
  readOnly: boolean;
}

/**
 * Multi-workflow strip per spec §16. Hidden by `WorkflowEditor` when the
 * session has only a single workflow.
 */
export function WorkflowTabs({
  workflows,
  activeWorkflow,
  onSelect,
  onAdd,
  onClose,
  readOnly,
}: WorkflowTabsProps) {
  const messages = useMessages();
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 12px",
        borderBottom: "1px solid #E2E8F0",
        background: "#F8FAFC",
        overflowX: "auto",
      }}
      data-testid="workflow-tabs"
    >
      {workflows.map((w) => {
        const active = w.name === activeWorkflow;
        return (
          <div
            key={w.name}
            style={{
              display: "flex",
              alignItems: "center",
              borderRadius: 4,
              border: `1px solid ${active ? "#0F172A" : "#CBD5E1"}`,
              background: active ? "white" : "transparent",
            }}
          >
            <button
              type="button"
              onClick={() => onSelect(w.name)}
              style={{
                padding: "4px 10px",
                background: "transparent",
                border: "none",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
              }}
              data-testid={`tab-${w.name}`}
            >
              {w.name || messages.tabs.untitled}
            </button>
            {onClose && !readOnly && workflows.length > 1 && (
              <button
                type="button"
                onClick={() => onClose(w.name)}
                style={{
                  padding: "0 8px",
                  background: "transparent",
                  border: "none",
                  color: "#64748B",
                  cursor: "pointer",
                  fontSize: 14,
                }}
                aria-label={messages.tabs.closeTab}
                data-testid={`tab-close-${w.name}`}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      {onAdd && !readOnly && (
        <button
          type="button"
          onClick={onAdd}
          style={{
            padding: "4px 8px",
            background: "white",
            border: "1px solid #CBD5E1",
            borderRadius: 4,
            fontSize: 12,
            cursor: "pointer",
          }}
          data-testid="tab-add"
        >
          + {messages.toolbar.addWorkflow}
        </button>
      )}
    </nav>
  );
}
