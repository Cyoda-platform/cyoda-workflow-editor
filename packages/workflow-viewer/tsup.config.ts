import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/theme/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  splitting: false,
  external: ["react", "react-dom", "react/jsx-runtime"],
});
