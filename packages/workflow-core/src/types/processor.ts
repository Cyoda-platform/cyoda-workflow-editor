import type { FunctionConfig } from "./criterion.js";
import type { Annotations } from "./workflow.js";

// cyoda-go 0.8.3 round-trips processor `type` verbatim. The canonical model
// preserves whatever the server stored; non-canonical values are surfaced as
// warnings rather than rewritten or dropped.
export type Processor = ExternalizedProcessor;

export type ExecutionMode =
  | "SYNC"
  | "ASYNC_SAME_TX"
  | "ASYNC_NEW_TX"
  | "COMMIT_BEFORE_DISPATCH";

export interface ExternalizedProcessor {
  type: string;
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
