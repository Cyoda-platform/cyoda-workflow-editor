import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const args = ["exec", "changeset", "publish"];
const preStatePath = ".changeset/pre.json";

if (existsSync(preStatePath)) {
  const preState = JSON.parse(readFileSync(preStatePath, "utf8"));
  if (preState.mode === "pre" && typeof preState.tag === "string" && preState.tag.length > 0) {
    console.log(`Changesets prerelease mode detected; publishing with dist-tag "${preState.tag}".`);
    args.push("--tag", preState.tag);
  }
}

const result = spawnSync("pnpm", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
