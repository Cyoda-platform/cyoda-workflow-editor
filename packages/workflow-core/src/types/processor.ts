import type { FunctionConfig } from "./criterion.js";
import type { Annotations } from "./workflow.js";

// As of the v0.8 major bump the `scheduled` processor type has been removed;
// `externalized` is the only canonical processor type.
export type Processor = ExternalizedProcessor;

export type ExecutionMode =
  | "SYNC"
  | "ASYNC_SAME_TX"
  | "ASYNC_NEW_TX"
  | "COMMIT_BEFORE_DISPATCH";

export interface ExternalizedProcessor {
  // Left as the literal here on purpose — Task 4 owns the widening. Changing it
  // in this task would desync the interface from ExternalizedProcessorSchema,
  // which still uses z.literal("externalized") until Task 4.
  type: "externalized";
  name: string;
  executionMode?: ExecutionMode;
  annotations?: Annotations;
  config?: ExternalizedProcessorConfig;
}

export interface ExternalizedProcessorConfig extends FunctionConfig {
  asyncResult?: boolean;
  crossoverToAsyncMs?: number;
  // cyoda-go 0.8.3 requires this INSIDE config. Both the OpenAPI and
  // `cyoda help workflows` place it on the processor; both are wrong — the
  // binary returns 400 `unknown field` for the processor-level position.
  startNewTxOnDispatch?: boolean;
}
