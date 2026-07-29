import { describe, expect, test } from "vitest";
import { parseImportPayload } from "../../src/index.js";

function issues(config: Record<string, unknown>) {
  return parseImportPayload(JSON.stringify({
    importMode: "MERGE",
    workflows: [{
      version: "1.3", name: "w", initialState: "A", active: true,
      states: { A: { transitions: [{
        name: "t", next: "A", manual: true,
        processors: [{ type: "externalized", name: "p", config }],
      }] } },
    }],
  })).issues;
}

describe("processor config rules (spec §4)", () => {
  test("rejects an unknown retryPolicy", () => {
    const i = issues({ retryPolicy: "EXPONENTIAL" }).find((x) => x.code === "unknown-retry-policy");
    expect(i?.severity).toBe("error");
  });

  test.each(["NONE", "FIXED", ""])("accepts retryPolicy %j", (retryPolicy) => {
    expect(issues({ retryPolicy }).map((i) => i.code)).not.toContain("unknown-retry-policy");
  });

  test("warns on asyncResult: true with a targetId", () => {
    const i = issues({ asyncResult: true }).find((x) => x.code === "async-result-unsupported");
    expect(i?.severity).toBe("warning");
    expect(i?.message).toMatch(/Cloud/);
    expect(i?.targetId).toBeDefined();
  });

  test("warns on any crossoverToAsyncMs, even with asyncResult true", () => {
    expect(issues({ asyncResult: true, crossoverToAsyncMs: 10 }).map((i) => i.code))
      .toContain("crossover-unsupported");
  });

  test("asyncResult: false is clean", () => {
    expect(issues({ asyncResult: false }).map((i) => i.code))
      .not.toContain("async-result-unsupported");
  });
});
