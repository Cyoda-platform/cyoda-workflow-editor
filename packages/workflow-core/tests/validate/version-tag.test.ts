import { describe, expect, test } from "vitest";
import { parseImportPayload } from "../../src/index.js";

function parse(version: string) {
  return parseImportPayload(JSON.stringify({
    importMode: "MERGE",
    workflows: [{
      version, name: "w", initialState: "A", active: true,
      states: { A: { transitions: [] } },
    }],
  }));
}

describe("workflow schema version tag (spec §4)", () => {
  test.each(["1", "1.0.0", "1.03", "2.0", "1.4"])("%j is a blocking error", (v) => {
    const issue = parse(v).issues.find((i) => i.code === "workflow-schema-version-malformed");
    expect(issue?.severity).toBe("error");
  });

  test("1.0 is a warning carrying a fix, not an error", () => {
    const issue = parse("1.0").issues.find((i) => i.code === "workflow-schema-version-outdated");
    expect(issue?.severity).toBe("warning");
    expect(issue?.fix?.label).toMatch(/1\.3/);
  });

  test("the fix rewrites the tag to the dialect's", () => {
    const parsed = parse("1.0");
    const issue = parsed.issues.find((i) => i.code === "workflow-schema-version-outdated")!;
    const fixed = issue.fix!.apply(parsed.document!);
    expect(fixed.session.workflows[0]!.version).toBe("1.3");
  });

  test.each(["1.1", "1.2", "1.3"])("%j is clean", (v) => {
    const codes = parse(v).issues.map((i) => i.code);
    expect(codes).not.toContain("workflow-schema-version-malformed");
    expect(codes).not.toContain("workflow-schema-version-outdated");
  });
});
