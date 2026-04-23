import { bench, describe } from "vitest";
import {
  applyPatch,
  parseImportPayload,
  serializeImportPayload,
} from "../../src/index.js";
import { generateChain, generateGrid } from "./generators.js";

/**
 * Performance benchmarks per spec §22.3. Budgets (M1-class CPU; CI adds 1.5x
 * slack). The thresholds here are NOT asserted automatically; `pnpm bench`
 * prints them so CI can diff vs. previous runs. A >15% regression should fail
 * CI (wire up in Phase 8 polish on the CI side).
 *
 * | Benchmark                                              | Budget       |
 * |--------------------------------------------------------|--------------|
 * | Parse + validate, 50 states / 200 transitions          | < 30 ms      |
 * | Parse + validate, 500 states / 2000 transitions        | < 250 ms     |
 * | Serialize, 500 states / 2000 transitions               | < 100 ms     |
 * | Apply patch + revalidate, 100-state graph              | < 8 ms/patch |
 * | Round-trip parse → serialize, 100 states               | < 60 ms      |
 */

describe("parse + validate", () => {
  const small = JSON.stringify(generateGrid(50, 4));
  const large = JSON.stringify(generateGrid(500, 4));

  bench("50 states / ~200 transitions (budget < 30 ms)", () => {
    parseImportPayload(small);
  });

  bench("500 states / ~2000 transitions (budget < 250 ms)", () => {
    parseImportPayload(large);
  });
});

describe("serialize", () => {
  const large = JSON.stringify(generateGrid(500, 4));
  const parsed = parseImportPayload(large);
  if (!parsed.document) throw new Error("bench setup failed");
  const doc = parsed.document;

  bench("500 states / ~2000 transitions (budget < 100 ms)", () => {
    serializeImportPayload(doc);
  });
});

describe("apply patch + revalidate", () => {
  const hundred = JSON.stringify(generateChain(100));
  const parsed = parseImportPayload(hundred);
  if (!parsed.document) throw new Error("bench setup failed");
  const doc = parsed.document;

  bench("renameWorkflow on 100-state graph (budget < 8 ms)", () => {
    applyPatch(doc, { op: "renameWorkflow", from: "chain", to: "renamed" });
  });
});

describe("round-trip", () => {
  const hundred = JSON.stringify(generateChain(100));

  bench("parse → serialize, 100 states (budget < 60 ms)", () => {
    const r = parseImportPayload(hundred);
    if (r.document) serializeImportPayload(r.document);
  });
});
