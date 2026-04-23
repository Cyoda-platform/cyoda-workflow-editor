// Public API of @cyoda/workflow-core.
// Per spec §3: explicit re-exports only; no `export *`.

export type {
  ArrayCriterion,
  ConcurrencyToken,
  Criterion,
  DomainPatch,
  EdgeAnchor,
  EdgeAnchorPair,
  EditorMetadata,
  EntityFieldHintProvider,
  EntityIdentity,
  ExecutionMode,
  ExportPayload,
  ExportResult,
  ExternalizedProcessor,
  ExternalizedProcessorConfig,
  FieldHint,
  FunctionConfig,
  FunctionCriterion,
  GroupCriterion,
  HostRef,
  ImportMode,
  ImportPayload,
  ImportResult,
  JsonValue,
  LifecycleCriterion,
  OperatorType,
  Processor,
  ProcessorPointer,
  SaveStatus,
  ScheduledProcessor,
  Severity,
  SimpleCriterion,
  State,
  StateCode,
  StatePointer,
  SyntheticIdMap,
  Transition,
  TransitionName,
  TransitionPointer,
  CriterionPointer,
  ValidationIssue,
  Workflow,
  WorkflowApi,
  WorkflowEditorDocument,
  WorkflowSession,
  WorkflowUiMeta,
} from "./types/index.js";

export {
  OPERATOR_TYPES,
  WorkflowApiConflictError,
  WorkflowApiTransportError,
} from "./types/index.js";

export {
  ArrayCriterionSchema,
  CriterionSchema,
  ExecutionModeSchema,
  ExportPayloadSchema,
  ExternalizedProcessorSchema,
  FunctionConfigSchema,
  FunctionCriterionSchema,
  GroupCriterionSchema,
  ImportPayloadSchema,
  LifecycleCriterionSchema,
  NAME_REGEX,
  NameSchema,
  OperatorEnum,
  ProcessorSchema,
  ScheduledProcessorSchema,
  SimpleCriterionSchema,
  StateSchema,
  TransitionSchema,
  WorkflowSchema,
} from "./schema/index.js";

export {
  ParseJsonError,
  SchemaError,
  normalizeOperatorAlias,
  parseEditorDocument,
  parseExportPayload,
  parseImportPayload,
} from "./parse/index.js";
export type { ParseResult } from "./parse/index.js";

export {
  normalizeCriterion,
  normalizeProcessor,
  normalizeWorkflowInput,
  outputCriterion,
  outputFunctionConfig,
  outputProcessor,
  outputTransition,
  outputWorkflow,
} from "./normalize/index.js";

export {
  prettyStringify,
  serializeEditorDocument,
  serializeExportPayload,
  serializeImportPayload,
} from "./serialize/index.js";

export {
  assignSyntheticIds,
  idFor,
  lookupById,
  mintCriterionIds,
} from "./identity/index.js";
export type { IdRef, LookupResult } from "./identity/index.js";

export {
  validateAll,
  validateExportSchema,
  validateImportSchema,
  validateSemantics,
  validateSession,
  zodErrorToIssues,
} from "./validate/index.js";

export {
  applyPatch,
  applyPatches,
  invertPatch,
  validateAfterPatch,
} from "./patch/index.js";

export {
  findMigrationPath,
  listMigrations,
  migrateSession,
  registerMigration,
} from "./migrate/index.js";
export type { MigrationEntry, MigrationFn } from "./migrate/index.js";
