import type { CyodaDialect } from "./dialect.js";
import type { CyodaSchemaVersion } from "./version.js";

const registry = new Map<CyodaSchemaVersion, CyodaDialect>();

/**
 * Versions this library used to ship and deliberately removed. Distinguished
 * from never-known versions so a stranded consumer gets "this was dropped and
 * here is what to do" rather than a message that reads like a typo.
 *
 * `null`-prototyped, and read through `Object.hasOwn` below: `version` comes
 * from untrusted document metadata, and a plain object literal answered
 * `"constructor"`, `"__proto__"` and friends out of the prototype chain,
 * turning an actionable "unknown version" error into e.g.
 * `Error: function Object() { [native code] }`.
 */
const REMOVED_VERSIONS: Record<string, string> = Object.assign(Object.create(null), {
  "0.7": 'cyoda-go schema dialect "0.7" was removed in the 0.8.3 release. Upgrade your workflow configs to the "0.8" dialect, or register a custom dialect with registerDialect().',
});

/**
 * Register (or replace) the dialect for a cyoda-go schema version. Host apps
 * can call this to support versions this library does not ship.
 */
export function registerDialect(dialect: CyodaDialect): void {
  registry.set(dialect.version, dialect);
}

/** Resolve a dialect, throwing a clear error if the version is unregistered. */
export function getDialect(version: CyodaSchemaVersion): CyodaDialect {
  const dialect = registry.get(version);
  if (!dialect) {
    if (Object.hasOwn(REMOVED_VERSIONS, version)) {
      throw new Error(REMOVED_VERSIONS[version]!);
    }
    const supported = [...registry.keys()].map((v) => `"${v}"`).join(", ") || "(none)";
    throw new Error(
      `Unknown cyoda-go schema version "${version}"; registered dialects: ${supported}.`,
    );
  }
  return dialect;
}

/** List the versions of all currently registered dialects. */
export function listDialects(): readonly CyodaSchemaVersion[] {
  return [...registry.keys()];
}
