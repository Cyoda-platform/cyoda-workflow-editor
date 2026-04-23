import { z } from "zod";
import { NameSchema } from "./name.js";
import { WorkflowSchema } from "./workflow.js";

export const ImportPayloadSchema = z.object({
  importMode: z.enum(["MERGE", "REPLACE", "ACTIVATE"]),
  workflows: z.array(WorkflowSchema).min(1),
});

export const ExportPayloadSchema = z.object({
  entityName: NameSchema,
  modelVersion: z.number().int().positive(),
  workflows: z.array(WorkflowSchema).min(1),
});
