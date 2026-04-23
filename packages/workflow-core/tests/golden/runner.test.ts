import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  parseImportPayload,
  prettyStringify,
  serializeImportPayload,
} from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));

describe("golden round-trip", () => {
  for (const file of fixtures) {
    test(`${file} parses, validates clean, serializes byte-identical`, () => {
      const raw = readFileSync(join(fixturesDir, file), "utf8");
      const expected = prettyStringify(JSON.parse(raw));

      const first = parseImportPayload(raw);
      expect(first.issues.filter((i) => i.severity === "error")).toEqual([]);
      expect(first.document).toBeDefined();

      const firstOut = serializeImportPayload(first.document!);
      expect(firstOut).toBe(expected);

      // Double round-trip stability.
      const second = parseImportPayload(firstOut);
      expect(second.issues.filter((i) => i.severity === "error")).toEqual([]);
      const secondOut = serializeImportPayload(second.document!);
      expect(secondOut).toBe(firstOut);
    });
  }
});
