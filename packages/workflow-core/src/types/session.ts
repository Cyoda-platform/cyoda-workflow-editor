import type { Workflow } from "./workflow.js";

export type ImportMode = "MERGE" | "REPLACE" | "ACTIVATE";

export interface EntityIdentity {
  entityName: string;
  modelVersion: number;
}

export interface WorkflowSession {
  entity: EntityIdentity | null;
  importMode: ImportMode;
  workflows: Workflow[];
}

export interface ImportPayload {
  importMode: ImportMode;
  workflows: Workflow[];
}

export interface ExportPayload {
  entityName: string;
  modelVersion: number;
  workflows: Workflow[];
}
