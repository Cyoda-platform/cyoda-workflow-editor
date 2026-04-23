import { useMessages } from "../i18n/context.js";

export interface ConflictBannerProps {
  onReload: () => void;
  onForceOverwrite: () => void;
}

/**
 * 409-conflict banner per spec §17.4. Non-dismissable; the user must pick
 * Reload (discard local) or Force overwrite (resend without the token).
 */
export function ConflictBanner({ onReload, onForceOverwrite }: ConflictBannerProps) {
  const messages = useMessages();
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "#FEF3C7",
        borderBottom: "1px solid #F59E0B",
        color: "#78350F",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
      role="alert"
      data-testid="conflict-banner"
    >
      <span style={{ flex: 1 }}>{messages.conflict.message}</span>
      <button
        type="button"
        onClick={onReload}
        style={btn}
        data-testid="conflict-reload"
      >
        {messages.conflict.reload}
      </button>
      <button
        type="button"
        onClick={onForceOverwrite}
        style={{ ...btn, background: "#DC2626", color: "white", borderColor: "#DC2626" }}
        data-testid="conflict-force"
      >
        {messages.conflict.forceOverwrite}
      </button>
    </div>
  );
}

const btn = {
  padding: "4px 10px",
  background: "white",
  border: "1px solid #CBD5E1",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
};
