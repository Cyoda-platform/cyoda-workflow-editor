import { useMessages } from "../i18n/context.js";
import { colors, radii } from "../style/tokens.js";

export interface LoadNoticesBannerProps {
  /** Human-readable notices to display. Rendering nothing is the caller's
   * responsibility to signal via an empty array — this component always
   * renders when given at least one notice. */
  notices: string[];
  onDismiss: () => void;
}

/**
 * Dismissible, non-blocking banner surfacing what happened while the current
 * document was loaded (e.g. fields the parser could not recognise and
 * dropped). Rendered in normal document flow above the canvas so it never
 * covers diagram content, and it disappears entirely once dismissed or once
 * there is nothing to say.
 */
export function LoadNoticesBanner({ notices, onDismiss }: LoadNoticesBannerProps) {
  const messages = useMessages();
  if (notices.length === 0) return null;

  return (
    <div
      role="status"
      data-testid="load-notices-banner"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        margin: "8px 12px 0",
        padding: "8px 10px",
        background: colors.infoBg,
        border: `1px solid ${colors.infoBorder}`,
        borderRadius: radii.sm,
        color: colors.textPrimary,
        fontSize: 12,
      }}
    >
      <span aria-hidden style={{ color: colors.info, lineHeight: "16px" }}>
        ⓘ
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <strong style={{ color: colors.info, fontSize: 12 }}>{messages.loadNotices.heading}</strong>
        <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
          {notices.map((notice, idx) => (
            <li key={idx} data-testid={`load-notices-banner-item-${idx}`}>
              {notice}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={messages.loadNotices.dismiss}
        data-testid="load-notices-banner-dismiss"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: "16px",
          color: colors.textSecondary,
          padding: 0,
          width: 20,
          height: 20,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
