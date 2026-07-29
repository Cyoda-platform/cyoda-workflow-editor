import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

/** Every quoted `code: "..."` literal emitted by a source file. */
function sourceCodes(src: string): Set<string> {
  const codes = new Set<string>();
  const re = /code:\s*"([a-z0-9-]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) codes.add(m[1]!);
  return codes;
}

/** Codes documented as the leading cell of a catalog table row (`| \`code\` |`). */
function documentedCodes(md: string): Set<string> {
  const codes = new Set<string>();
  const re = /\|\s*`([a-z0-9-]+\*?)`\s*\|/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) codes.add(m[1]!);
  return codes;
}

/**
 * The severity each code is actually emitted with. Every `code:` literal in
 * `semantic.ts` is immediately preceded by its `severity:`, so the pair can be
 * read straight off the source.
 */
function sourceSeverities(src: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const re = /severity:\s*"(error|warning|info)",\s*code:\s*"([a-z0-9-]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const set = map.get(m[2]!) ?? new Set<string>();
    set.add(m[1]!);
    map.set(m[2]!, set);
  }
  return map;
}

/** Which `## Errors` / `## Warnings` / `## Info` section each code's row sits in. */
function documentedSections(md: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current: string | null = null;
  for (const line of md.split("\n")) {
    const heading = /^##\s+(Errors|Warnings|Info)\s*$/.exec(line);
    if (heading) {
      current = heading[1]!.toLowerCase().replace(/s$/, "");
      continue;
    }
    if (/^##\s/.test(line)) {
      current = null;
      continue;
    }
    const row = /^\|\s*`([a-z0-9-]+\*?)`\s*\|/.exec(line);
    if (row && current) sections.set(row[1]!, current);
  }
  return sections;
}

// This guard is why docs/validation-rules.md can be trusted: add or remove a
// rule in semantic.ts and this fails until the catalog is updated to match.
describe("validation rule catalog is in sync with the source", () => {
  const semantic = read("../../src/validate/semantic.ts");
  const schema = read("../../src/validate/schema.ts");
  const docs = read("../../../../docs/validation-rules.md");

  const source = sourceCodes(semantic);
  const documented = documentedCodes(docs);

  test("every code emitted by semantic.ts is documented", () => {
    const undocumented = [...source].filter((c) => !documented.has(c)).sort();
    expect(undocumented).toEqual([]);
  });

  test("every documented code (except the dynamic schema-* family) exists in the source", () => {
    const orphaned = [...documented]
      .filter((c) => c !== "schema-*")
      .filter((c) => !source.has(c))
      .sort();
    expect(orphaned).toEqual([]);
  });

  test("the dynamic schema-* family is emitted and documented", () => {
    expect(schema).toContain("`schema-${issue.code}`");
    expect(documented.has("schema-*")).toBe(true);
  });

  // Membership, not mere presence: the previous guards only asserted a code
  // appeared *somewhere* in the file, so a severity change in semantic.ts left
  // the row sitting under the wrong heading with nothing to catch it.
  test("each code's catalog section matches the severity it is emitted with", () => {
    const severities = sourceSeverities(semantic);
    const sections = documentedSections(docs);
    const mismatched = [...severities]
      .map(([code, sevs]) => ({ code, sevs: [...sevs].sort(), section: sections.get(code) }))
      .filter(({ sevs, section }) => sevs.length !== 1 || section !== sevs[0])
      .map(({ code, sevs, section }) => `${code}: emitted ${sevs.join("|")}, documented ${section}`)
      .sort();
    expect(mismatched).toEqual([]);
  });
});
