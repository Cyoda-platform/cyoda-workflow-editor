import { colors, radii } from "../style/tokens.js";
import { useMessages } from "../i18n/context.js";
import { clampRect, MIN_FLOAT_W, MIN_FLOAT_H, type FloatRect, type PlacementMode } from "./inspectorPlacement.js";

export const FLOATING_Z = 40;
export const MIN_BAR_Z = 50;

export interface InspectorFrameProps {
  mode: PlacementMode;
  rect: FloatRect;
  dockedWidth: number;
  onRectChange: (rect: FloatRect) => void;
  onDockedWidthChange: (w: number) => void;
  /** Restore a minimized panel back to its prior docked/floating mode. */
  onRestore: () => void;
  /** Dismiss the panel entirely (used by the minimized bar's close button). */
  onClose?: () => void;
  children: React.ReactNode;
}

export function InspectorFrame({
  mode,
  rect,
  dockedWidth,
  onRectChange,
  onDockedWidthChange,
  onRestore,
  onClose,
  children,
}: InspectorFrameProps) {
  const messages = useMessages();

  const startWidthDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = dockedWidth;
    const onMove = (ev: MouseEvent) => onDockedWidthChange(Math.max(360, startW + (startX - ev.clientX)));
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });

  const startMove = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;                        // don't drag from header buttons
    if (!target.closest("[data-inspector-drag-handle]")) return;  // only the header strip drags
    e.preventDefault();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    const onMove = (ev: MouseEvent) => onRectChange(clampRect({ ...rect, left: ev.clientX - dx, top: ev.clientY - dy }, viewport()));
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, sw = rect.width, sh = rect.height;
    const onMove = (ev: MouseEvent) => onRectChange(clampRect({ ...rect, width: Math.max(MIN_FLOAT_W, sw + (ev.clientX - sx)), height: Math.max(MIN_FLOAT_H, sh + (ev.clientY - sy)) }, viewport()));
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const floating = mode === "floating";
  const minimized = mode === "minimized";

  // A single stable frame element at a fixed tree position — its STYLE flips per
  // mode, so <Inspector>/Monaco never remount (state survives dock/float/minimize).
  // Minimized keeps the panel mounted-but-hidden so its editor state is preserved.
  const style: React.CSSProperties = floating || minimized
    ? {
        position: "fixed",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        zIndex: FLOATING_Z,
        boxShadow: "0 24px 50px -12px rgba(15,23,42,0.45)",
        borderRadius: 12,
        overflow: "hidden",
        display: minimized ? "none" : "flex",
      }
    : { position: "relative", flex: `0 0 ${dockedWidth}px`, width: dockedWidth, height: "100%", display: "flex" };

  return (
    <>
      {mode === "docked" && (
        <div
          data-testid="inspector-resize-handle"
          onMouseDown={startWidthDrag}
          style={{ width: 3, flexShrink: 0, cursor: "col-resize", background: "transparent", borderLeft: `1px solid ${colors.borderSubtle}`, zIndex: 10 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = colors.border)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        />
      )}
      <div
        data-testid="inspector-frame"
        onMouseDownCapture={floating ? startMove : undefined}
        style={style}
      >
        {children}
        {floating && (
          <div
            data-testid="inspector-resize-grip"
            onMouseDown={startResize}
            style={{ position: "absolute", right: 2, bottom: 2, width: 16, height: 16, cursor: "nwse-resize", zIndex: 5 }}
          />
        )}
      </div>
      {minimized && (
        <div
          data-testid="inspector-min-bar"
          onClick={onRestore}
          title={messages.inspector.restore}
          style={minBarStyle}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors.primary, flex: "0 0 auto" }} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: colors.textSecondary }}>
            {messages.inspector.minimizedTitle}
          </span>
          <button
            type="button"
            data-testid="inspector-restore"
            aria-label={messages.inspector.restore}
            title={messages.inspector.restore}
            onClick={(e) => { e.stopPropagation(); onRestore(); }}
            style={barBtnStyle}
          >
            ⤢
          </button>
          {onClose && (
            <button
              type="button"
              data-testid="inspector-min-close"
              aria-label="Close inspector"
              title="Close inspector"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{ ...barBtnStyle, fontSize: 16 }}
            >
              ×
            </button>
          )}
        </div>
      )}
    </>
  );
}

const minBarStyle: React.CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  zIndex: MIN_BAR_Z,
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: 260,
  height: 40,
  padding: "0 6px 0 12px",
  borderRadius: 10,
  background: "white",
  border: `1px solid ${colors.border}`,
  boxShadow: "0 12px 28px -10px rgba(15,23,42,0.4)",
  cursor: "pointer",
  userSelect: "none",
};

const barBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  flex: "0 0 auto",
  border: `1px solid ${colors.border}`,
  borderRadius: radii.sm,
  background: "white",
  color: colors.textSecondary,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  fontSize: 13,
};
