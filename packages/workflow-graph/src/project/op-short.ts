import type { OperatorType } from "@cyoda/workflow-core";

/**
 * Short-form operator labels used in edge-chip criterion summaries (spec §10.3).
 * Keys cover the full OperatorType union. Anything missing falls back to the
 * raw operator name.
 */
const SHORT: Record<string, string> = {
  EQUALS: "=",
  NOT_EQUAL: "≠",
  IS_NULL: "is null",
  NOT_NULL: "not null",
  GREATER_THAN: ">",
  LESS_THAN: "<",
  GREATER_OR_EQUAL: "≥",
  LESS_OR_EQUAL: "≤",
  CONTAINS: "contains",
  NOT_CONTAINS: "!contains",
  STARTS_WITH: "starts",
  NOT_STARTS_WITH: "!starts",
  ENDS_WITH: "ends",
  NOT_ENDS_WITH: "!ends",
  MATCHES: "matches",
  NOT_MATCHES: "!matches",
  I_EQUALS: "i=",
  I_NOT_EQUAL: "i≠",
  I_CONTAINS: "i∋",
  I_NOT_CONTAINS: "i∌",
  BETWEEN: "between",
  NOT_BETWEEN: "!between",
  BETWEEN_INCLUSIVE: "[between]",
  IN: "in",
  NOT_IN: "not in",
  LENGTH_EQUALS: "len=",
  LENGTH_GREATER: "len>",
  LENGTH_LESS: "len<",
  IS_CHANGED: "changed",
};

export function opShort(op: OperatorType | string): string {
  return SHORT[op] ?? op;
}

export function truncate(s: string, max = 24): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
