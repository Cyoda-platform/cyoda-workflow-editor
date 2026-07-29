import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Package-local only (no repo-wide tsconfig change): lets a handful of
    // `*.test-d.ts` files assert against the compiled public type surface via
    // `expectTypeOf`, run in-band with `vitest run` (no separate `vitest
    // typecheck` invocation needed). See tests/types/ for the motivating case
    // — a type re-exported from src/index.ts but easy to silently regress.
    typecheck: {
      enabled: true,
      include: ["tests/**/*.test-d.ts"],
      // vitest's typecheck defaults to the nearest tsconfig.json, which is
      // tsconfig.json — and that file's "exclude": ["dist", "node_modules",
      // "tests"] means tests/ is never actually part of the checked program,
      // so a *.test-d.ts file "passes" trivially (zero files checked) even
      // when it imports a type that doesn't exist. tsconfig.test-d.json is a
      // package-local, typecheck-only config that includes tests/ so the
      // check is real.
      tsconfig: "./tsconfig.test-d.json",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts", "src/types/**"],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
    },
  },
});
