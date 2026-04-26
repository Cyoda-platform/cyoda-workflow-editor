# Cyoda Workflow Editor Release Guide

Detailed release policy lives in
[`ai/npm-release-mechanism.md`](ai/npm-release-mechanism.md).

Quick rules:

- Changesets is authoritative for package versioning.
- CI is the only publisher.
- Do not run `npm publish` from a laptop.
- Stable releases normally flow through the Changesets version PR on `main`.
- Prereleases use Changesets prerelease mode, for example `pnpm prerelease:enter rc`.
- `cyoda-workflow-editor` and `@cyoda/docs-embed-demo` stay private.

Useful commands:

```sh
pnpm changeset
pnpm version-packages
pnpm prerelease:enter rc
pnpm prerelease:exit
pnpm release:preflight
```
