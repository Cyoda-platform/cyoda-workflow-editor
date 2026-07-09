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
});
