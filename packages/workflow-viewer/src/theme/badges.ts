import type { TransitionSummary } from "@cyoda/workflow-graph";

export interface BadgeDescriptor {
  key: "manual" | "processor" | "criterion" | "disabled" | "execution";
  label: string;
}

/**
 * Translate a transition summary + flags into the ordered list of badges the
 * edge chip should render. Mirrors §10 chip summaries + the visual design
 * section of the implementation plan.
 */
export function badgesFor(
  summary: TransitionSummary,
  flags: { manual: boolean; disabled: boolean },
): BadgeDescriptor[] {
  const out: BadgeDescriptor[] = [];

  // Manual badge removed – hidden from display

  if (summary.processor) {
    if (summary.processor.kind === "single") {
      out.push({ key: "processor", label: summary.processor.name });
    } else if (summary.processor.kind === "multiple") {
      out.push({ key: "processor", label: `${summary.processor.count} processors` });
    }
  }

  if (summary.criterion) {
    const c = summary.criterion;
    if (c.kind === "group") {
      out.push({ key: "criterion", label: `${c.operator} · ${c.count}` });
    } else {
      out.push({ key: "criterion", label: "Criterion" });
    }
  }

  // Only COMMIT_BEFORE_DISPATCH is surfaced here: it's the operationally
  // significant mode (Cyoda commits the entity before calling the
  // processor, so the intermediate state is publicly observable and the
  // processor must be idempotent). SYNC/ASYNC_SAME_TX/ASYNC_NEW_TX stay
  // hidden to keep arrow labels uncluttered.
  if (summary.commitBeforeDispatch) {
    out.push({ key: "execution", label: "COMMIT BEFORE DISPATCH" });
  }

  if (flags.disabled) out.push({ key: "disabled", label: "Disabled" });

  return out;
}
