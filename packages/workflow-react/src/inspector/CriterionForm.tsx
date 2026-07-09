import type { Annotations, AnnotationsTarget, Criterion, DomainPatch, HostRef } from "@cyoda/workflow-core";
import type { Selection } from "../state/types.js";
import { useMessages } from "../i18n/context.js";
import { colors } from "../style/tokens.js";
import { CriterionField } from "./CriterionField.js";
import { AnnotationsField } from "./AnnotationsField.js";

function criterionModelKey(host: HostRef): string {
  if (host.kind === "transition") return `transition-${host.transitionUuid}`;
  if (host.kind === "processorConfig") return `processor-${host.processorUuid}`;
  return `host-${host.workflow}`;
}

/**
 * Map a criterion's host to the `setAnnotations` target that writes/reads
 * `.criterionAnnotations` on that host. `processorConfig` hosts have no
 * criterion-annotations target (criterion annotations only exist at the
 * workflow and transition level) and are intentionally excluded.
 */
function criterionAnnotationsTarget(host: HostRef): AnnotationsTarget | undefined {
  if (host.kind === "workflow") return { kind: "workflowCriterion", workflow: host.workflow };
  if (host.kind === "transition") return { kind: "transitionCriterion", transitionUuid: host.transitionUuid };
  return undefined;
}

export function CriterionSection({
  host, manual, criterion, criterionAnnotations, disabled, onDispatch, onSelectionChange: _onSelectionChange,
}: {
  host: HostRef;
  stateCode?: string;
  transitionName?: string;
  targetState?: string;
  manual?: boolean;
  criterion: Criterion | undefined;
  /** Current `.criterionAnnotations` value on the host (workflow or transition). */
  criterionAnnotations?: Annotations;
  disabled: boolean;
  onDispatch: (patch: DomainPatch) => void;
  onSelectionChange?: (selection: Selection) => void;
}) {
  const m = useMessages().criterion;
  const isWorkflow = host.kind === "workflow";
  const path = ["criterion"];
  const annotationsTarget = criterionAnnotationsTarget(host);
  return (
    <>
      {isWorkflow && (
        <p
          data-testid="workflow-criterion-caption"
          style={{ margin: "0 0 6px", fontSize: 12, lineHeight: 1.4, color: colors.textSecondary }}
        >
          {m.workflowCaption}
        </p>
      )}
      <CriterionField
        value={criterion}
        manual={manual}
        disabled={disabled}
        modelKey={criterionModelKey(host)}
        emptyText={isWorkflow ? m.workflowNone : undefined}
        onCommit={(next) => onDispatch({ op: "setCriterion", host, path, criterion: next })}
        onRemove={() => onDispatch({ op: "setCriterion", host, path, criterion: undefined })}
      />
      {annotationsTarget && (
        <div
          data-testid="inspector-criterion-annotations"
          style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: colors.textSecondary,
            }}
          >
            Criterion annotations
          </span>
          <AnnotationsField
            value={criterionAnnotations}
            disabled={disabled}
            showLabel={false}
            modelKey={`criterion-annotations-${criterionModelKey(host)}`}
            onCommit={(annotations) => onDispatch({ op: "setAnnotations", target: annotationsTarget, annotations })}
            onRemove={() => onDispatch({ op: "setAnnotations", target: annotationsTarget })}
          />
        </div>
      )}
    </>
  );
}
