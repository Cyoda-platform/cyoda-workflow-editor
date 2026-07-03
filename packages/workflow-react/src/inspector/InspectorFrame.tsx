import { colors } from "../style/tokens.js";
import { clampRect, MIN_FLOAT_W, MIN_FLOAT_H, type FloatRect, type PlacementMode } from "./inspectorPlacement.js";

export const FLOATING_Z = 40;

export interface InspectorFrameProps {
  mode: PlacementMode;
  rect: FloatRect;
  dockedWidth: number;
  onRectChange: (rect: FloatRect) => void;
  onDockedWidthChange: (w: number) => void;
  children: React.ReactNode;
}

export function InspectorFrame({ mode, rect, dockedWidth, onRectChange, onDockedWidthChange, children }: InspectorFrameProps) {
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
  const style: React.CSSProperties = floating
    ? { position: "fixed", left: rect.left, top: rect.top, width: rect.width, height: rect.height, zIndex: FLOATING_Z, boxShadow: "0 22px 48px -12px rgba(15,23,42,0.42)", borderRadius: 12, overflow: "hidden", display: "flex" }
    : { position: "relative", flex: `0 0 ${dockedWidth}px`, width: dockedWidth, height: "100%", display: "flex" };

  return (
    <>
      {!floating && (
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
        className={floating ? "cyoda-inspector-floating" : undefined}
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
    </>
  );
}
