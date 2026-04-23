import type { TransitionEdge } from "@cyoda/workflow-graph";
import { badgesFor, type BadgeDescriptor } from "../theme/badges.js";
import { geometry, typography, workflowPalette } from "../theme/tokens.js";

interface Props {
  edge: TransitionEdge;
  x: number;
  y: number;
  dimmed: boolean;
}

const BADGE_HEIGHT = 14;
const BADGE_GAP = 4;
const LABEL_PADDING_X = geometry.labelPill.paddingX;
const LABEL_PADDING_Y = geometry.labelPill.paddingY;
const BADGE_TEXT_PADDING_X = 6;

/**
 * Estimate label width in SVG units. Rough heuristic: avg glyph width ≈
 * fontSize * 0.58 for the sans/mono stack at these sizes. Good enough until
 * we measure via getBBox.
 */
function estimateWidth(text: string, fontSize: number): number {
  return Math.ceil(text.length * fontSize * 0.58);
}

export function EdgeLabel({ edge, x, y, dimmed }: Props) {
  const title = edge.summary.display;
  const badges = badgesFor(edge.summary, {
    manual: edge.manual,
    disabled: edge.disabled,
  });

  const titleW = estimateWidth(title, typography.edgeLabel.size);

  const badgeWidths = badges.map(
    (b) => estimateWidth(b.label, typography.badge.size) + BADGE_TEXT_PADDING_X * 2,
  );
  const badgesTotalW =
    badgeWidths.reduce((a, b) => a + b, 0) +
    Math.max(0, badges.length - 1) * BADGE_GAP;

  const pillW = Math.max(titleW, badgesTotalW) + LABEL_PADDING_X * 2;
  const hasBadges = badges.length > 0;
  const pillH =
    typography.edgeLabel.size +
    LABEL_PADDING_Y * 2 +
    (hasBadges ? BADGE_HEIGHT + BADGE_GAP : 0);

  const pillX = x - pillW / 2;
  const pillY = y - pillH / 2;
  const titleY = pillY + LABEL_PADDING_Y + typography.edgeLabel.size - 2;
  const badgeY = titleY + BADGE_GAP + 2;

  const opacity = dimmed ? 0.4 : 1;

  return (
    <g opacity={opacity} pointerEvents="none">
      <rect
        x={pillX}
        y={pillY}
        width={pillW}
        height={pillH}
        rx={geometry.labelPill.radius}
        ry={geometry.labelPill.radius}
        fill={workflowPalette.edgeLabel.fill}
        stroke={workflowPalette.edgeLabel.border}
        strokeWidth={1}
        filter="url(#wf-label-shadow)"
      />
      <text
        x={x}
        y={titleY}
        textAnchor="middle"
        fill={workflowPalette.edgeLabel.text}
        fontFamily={typography.fontFamily}
        fontSize={typography.edgeLabel.size}
        fontWeight={typography.edgeLabel.weight}
        letterSpacing={typography.edgeLabel.tracking}
      >
        {title}
      </text>
      {hasBadges && renderBadges(badges, badgeWidths, pillX, pillW, badgeY)}
    </g>
  );
}

function renderBadges(
  badges: BadgeDescriptor[],
  widths: number[],
  pillX: number,
  pillW: number,
  y: number,
) {
  const totalW =
    widths.reduce((a, b) => a + b, 0) +
    Math.max(0, badges.length - 1) * BADGE_GAP;
  let cursor = pillX + (pillW - totalW) / 2;
  return (
    <g>
      {badges.map((b, i) => {
        const w = widths[i]!;
        const slot = pickBadgePalette(b.key);
        const node = (
          <g key={`${b.key}-${i}`}>
            <rect
              x={cursor}
              y={y}
              width={w}
              height={BADGE_HEIGHT}
              rx={BADGE_HEIGHT / 2}
              ry={BADGE_HEIGHT / 2}
              fill={slot.fill}
              stroke={slot.border}
              strokeWidth={1}
            />
            <text
              x={cursor + w / 2}
              y={y + BADGE_HEIGHT - 4}
              textAnchor="middle"
              fill={workflowPalette.badge.text}
              fontFamily={typography.fontFamily}
              fontSize={typography.badge.size}
              fontWeight={typography.badge.weight}
              letterSpacing={typography.badge.tracking}
            >
              {b.label}
            </text>
          </g>
        );
        cursor += w + BADGE_GAP;
        return node;
      })}
    </g>
  );
}

function pickBadgePalette(key: BadgeDescriptor["key"]) {
  switch (key) {
    case "manual":
      return workflowPalette.badge.manual;
    case "processor":
      return workflowPalette.badge.processor;
    case "criterion":
      return workflowPalette.badge.criterion;
    case "execution":
      return workflowPalette.badge.processor;
    case "disabled":
      return workflowPalette.badge.disabled;
  }
}
