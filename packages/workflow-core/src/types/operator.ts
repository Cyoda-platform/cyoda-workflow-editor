export type OperatorType =
  | "EQUALS"
  | "NOT_EQUAL"
  | "IS_NULL"
  | "NOT_NULL"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "GREATER_OR_EQUAL"
  | "LESS_OR_EQUAL"
  | "BETWEEN"
  | "BETWEEN_INCLUSIVE"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "STARTS_WITH"
  | "NOT_STARTS_WITH"
  | "ENDS_WITH"
  | "NOT_ENDS_WITH"
  | "MATCHES_PATTERN"
  | "LIKE"
  | "IEQUALS"
  | "INOT_EQUAL"
  | "ICONTAINS"
  | "INOT_CONTAINS"
  | "ISTARTS_WITH"
  | "INOT_STARTS_WITH"
  | "IENDS_WITH"
  | "INOT_ENDS_WITH"
  | "IS_UNCHANGED"
  | "IS_CHANGED";

export const OPERATOR_TYPES: ReadonlySet<OperatorType> = new Set<OperatorType>([
  "EQUALS",
  "NOT_EQUAL",
  "IS_NULL",
  "NOT_NULL",
  "GREATER_THAN",
  "LESS_THAN",
  "GREATER_OR_EQUAL",
  "LESS_OR_EQUAL",
  "BETWEEN",
  "BETWEEN_INCLUSIVE",
  "CONTAINS",
  "NOT_CONTAINS",
  "STARTS_WITH",
  "NOT_STARTS_WITH",
  "ENDS_WITH",
  "NOT_ENDS_WITH",
  "MATCHES_PATTERN",
  "LIKE",
  "IEQUALS",
  "INOT_EQUAL",
  "ICONTAINS",
  "INOT_CONTAINS",
  "ISTARTS_WITH",
  "INOT_STARTS_WITH",
  "IENDS_WITH",
  "INOT_ENDS_WITH",
  "IS_UNCHANGED",
  "IS_CHANGED",
]);

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };
