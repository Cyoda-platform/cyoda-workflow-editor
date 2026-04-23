import type { WorkflowSession } from "../types/session.js";

export type MigrationFn = (session: WorkflowSession) => WorkflowSession;

export interface MigrationEntry {
  from: string;
  to: string;
  migrate: MigrationFn;
}

const registry: MigrationEntry[] = [];

export function registerMigration(entry: MigrationEntry): void {
  const dup = registry.find((e) => e.from === entry.from && e.to === entry.to);
  if (dup) return;
  registry.push(entry);
}

export function listMigrations(): readonly MigrationEntry[] {
  return registry;
}

export function findMigrationPath(from: string, to: string): MigrationEntry[] | null {
  if (from === to) return [];
  const visited = new Set<string>();
  const queue: Array<{ version: string; path: MigrationEntry[] }> = [
    { version: from, path: [] },
  ];
  while (queue.length > 0) {
    const head = queue.shift()!;
    if (head.version === to) return head.path;
    if (visited.has(head.version)) continue;
    visited.add(head.version);
    for (const entry of registry) {
      if (entry.from === head.version) {
        queue.push({ version: entry.to, path: [...head.path, entry] });
      }
    }
  }
  return null;
}

export function migrateSession(
  session: WorkflowSession,
  from: string,
  to: string,
): WorkflowSession {
  const path = findMigrationPath(from, to);
  if (!path) {
    throw new Error(`No migration path from ${from} to ${to}`);
  }
  return path.reduce((s, entry) => entry.migrate(s), session);
}

// Register the identity migration so callers can opt into version metadata
// without special-casing the default.
registerMigration({ from: "1.0", to: "1.0", migrate: (s) => s });
