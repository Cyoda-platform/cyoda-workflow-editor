import type { Criterion, DomainPatch, HostRef } from "@cyoda/workflow-core";
import type { Selection } from "../state/types.js";
import { CriterionField } from "./CriterionField.js";

function criterionModelKey(host: HostRef): string {
  if (host.kind === "transition") return `transition-${host.transitionUuid}`;
  if (host.kind === "processorConfig") return `processor-${host.processorUuid}`;
  return `host-${host.workflow}`;
}

export function CriterionSection({
  host, manual, criterion, disabled, onDispatch, onSelectionChange: _onSelectionChange,
}: {
  host: HostRef;
  stateCode?: string;
  transitionName?: string;
  targetState?: string;
  manual?: boolean;
  criterion: Criterion | undefined;
  disabled: boolean;
  onDispatch: (patch: DomainPatch) => void;
  onSelectionChange?: (selection: Selection) => void;
}) {
  const path = ["criterion"];
  return (
    <CriterionField
      value={criterion}
      manual={manual}
      disabled={disabled}
      modelKey={criterionModelKey(host)}
      onCommit={(next) => onDispatch({ op: "setCriterion", host, path, criterion: next })}
      onRemove={() => onDispatch({ op: "setCriterion", host, path, criterion: undefined })}
    />
  );
}
