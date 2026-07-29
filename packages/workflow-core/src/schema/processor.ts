import { z } from "zod";
import { AnnotationsSchema } from "./annotations.js";
import { FunctionConfigSchema } from "./criterion.js";
import { NameSchema } from "./name.js";

export const ExecutionModeSchema = z.enum([
  "SYNC",
  "ASYNC_SAME_TX",
  "ASYNC_NEW_TX",
  "COMMIT_BEFORE_DISPATCH",
]);

export const ExternalizedProcessorSchema = z.object({
  // Open string: cyoda-go 0.8.3 stores and returns `type` verbatim for every
  // value. A literal here cannot parse the server's own exports.
  type: z.string(),
  name: NameSchema,
  executionMode: ExecutionModeSchema.optional(),
  annotations: AnnotationsSchema.optional(),
  config: FunctionConfigSchema.and(
    z.object({
      asyncResult: z.boolean().optional(),
      // Kept `.nonnegative()` here (not relaxed per the brief's snippet) —
      // that constraint is verified server behaviour and
      // tests/processor/processor-contract.test.ts asserts -1 is an error.
      crossoverToAsyncMs: z.number().int().nonnegative().optional(),
      startNewTxOnDispatch: z.boolean().optional(),
    }),
  ).optional(),
});

/**
 * The canonical processor schema. `type` is an open string (see above) because
 * cyoda-go 0.8.3 round-trips whatever value it was given; non-canonical values
 * are surfaced as validation warnings rather than rejected or rewritten.
 */
export const ProcessorSchema = ExternalizedProcessorSchema;
