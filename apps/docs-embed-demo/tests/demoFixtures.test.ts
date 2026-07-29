/**
 * Regression test for the demo workflow fixtures under
 * src/examples/workflows/*.json (surfaced through demoFixtures in
 * fixtureCatalog.ts).
 *
 * Two of the five demo workflows (kitchen-sink-workflows.json,
 * sample-workflow.json) previously failed to parse against the 0.8 dialect
 * even before the cyoda-go 0.8.3 canonical-model widening landed:
 *   - kitchen-sink used `criteria` instead of the schema's `conditions` key
 *     on group criterion, and a `function` criterion carrying an invalid
 *     `outputPath` field.
 *   - Both kitchen-sink and sample-workflow used a `lifecycle` criterion
 *     value ("NOW_MINUS_30D") that cyoda-go's Condition DSL does not
 *     support — the server has no relative-date operand, only literal
 *     timestamps (confirmed against a running 0.8.3 binary).
 *   - kitchen-sink's "RetryLater" processor carried
 *     `config.{delaySeconds,transition}`, neither of which is a valid
 *     cyoda-go processor-config key — a 400 on import ("unknown field
 *     delaySeconds") no matter how the JSON parses.
 *
 * This test guards the fix: every shipped demo fixture must parse with zero
 * error-severity issues (the "invalid-json"/"intentionally-invalid" fixture
 * is deliberately excluded — it exists to prove *broken* JSON handling).
 */
import { describe, expect, it } from "vitest";
import { parseImportPayload } from "@cyoda/workflow-core";
import { demoFixtures } from "../src/examples/fixtureCatalog.js";
import { buildWorkflowPayload } from "../src/lib/workflowDemo.js";

const realFixtures = demoFixtures.filter((f) => f.slug !== "invalid-json");

describe("demo workflow fixtures", () => {
  it("covers all five real demo workflows (not just the invalid-json one)", () => {
    // Falsifiable: if a future edit removes a fixture from the catalog (or
    // this filter is mis-typed), this count check catches an empty/short
    // suite silently passing "zero errors" over zero fixtures.
    expect(realFixtures.length).toBe(5);
  });

  it.each(realFixtures.map((f) => [f.slug, f] as const))(
    "%s parses with a document and zero error-severity issues",
    (_slug, fixture) => {
      const payload = buildWorkflowPayload(fixture.rawJson);
      const result = parseImportPayload(payload);

      expect(result.document, `${fixture.slug} failed to produce a document`).toBeTruthy();

      const errors = (result.issues ?? []).filter((issue) => issue.severity === "error");
      expect(errors, `${fixture.slug} has error-severity issues: ${JSON.stringify(errors)}`).toHaveLength(0);
    },
  );

  it("kitchen-sink's DispatchPipeline no longer carries the invalid RetryLater config keys", () => {
    const kitchenSink = realFixtures.find((f) => f.slug === "kitchen-sink");
    if (!kitchenSink) throw new Error("kitchen-sink fixture missing");

    // Falsifiable: before the fix, this raw JSON contained
    // `"delaySeconds"` and a processor `"transition"` key inside a
    // processor config — cyoda-go rejects both with a 400 "unknown field"
    // regardless of whether the editor's schema accepts them.
    expect(kitchenSink.rawJson).not.toMatch(/"delaySeconds"/);
    expect(kitchenSink.rawJson).toMatch(/"delayMs"\s*:\s*300000/);
  });
});
