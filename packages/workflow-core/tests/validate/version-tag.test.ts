import { describe, expect, test } from "vitest";
import { parseImportPayload, validateSemantics } from "../../src/index.js";
import type { WorkflowSession } from "../../src/index.js";

function parse(version: string) {
  return parseImportPayload(JSON.stringify({
    importMode: "MERGE",
    workflows: [{
      version, name: "w", initialState: "A", active: true,
      states: { A: { transitions: [] } },
    }],
  }));
}

function sessionWithVersion(version: string): WorkflowSession {
  return {
    entity: null,
    importMode: "MERGE",
    workflows: [{
      version, name: "w", initialState: "A", active: true,
      states: { A: { transitions: [] } },
    }],
  };
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

  test("the fix rewrites the tag to the dialect's and bumps meta.revision", () => {
    const parsed = parse("1.0");
    const issue = parsed.issues.find((i) => i.code === "workflow-schema-version-outdated")!;
    const before = parsed.document!.meta.revision;
    const fixed = issue.fix!.apply(parsed.document!);
    expect(fixed.session.workflows[0]!.version).toBe("1.3");
    expect(fixed.meta.revision).toBe(before + 1);
  });

  test("with no document, the dialect falls back to LATEST_CYODA_VERSION and still fires", () => {
    const issues = validateSemantics(sessionWithVersion("1.03"));
    const issue = issues.find((i) => i.code === "workflow-schema-version-malformed");
    expect(issue?.severity).toBe("error");
  });

  test.each(["1.1", "1.2", "1.3"])("%j is clean", (v) => {
    const codes = parse(v).issues.map((i) => i.code);
    expect(codes).not.toContain("workflow-schema-version-malformed");
    expect(codes).not.toContain("workflow-schema-version-outdated");
  });
});
