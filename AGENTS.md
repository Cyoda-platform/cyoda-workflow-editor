# Agent Guidance

Read [`ai/npm-release-mechanism.md`](ai/npm-release-mechanism.md) before
changing release workflows, package publish metadata, or Changesets config.
That document is the normative release authority for this repository.

Release rules that must be preserved:

- Changesets is the source of truth for published package versioning.
- CI is the only publisher. Do not introduce laptop-driven `npm publish`.
- Preserve the pnpm workspace monorepo release model.
- Keep `cyoda-workflow-editor` and `@cyoda/docs-embed-demo` private.
- Do not convert this repo to a single-package root-tag/root-version model.
- Do not remove Changesets from the release flow.
- Do not make private packages publishable.
- Preserve prerelease support, release-preflight validation, and provenance-friendly publishing.

When changing release automation:

- Keep workflows aligned with real root scripts.
- Treat repo tags and GitHub Releases as release markers, not the source of package versions.
- Prefer trusted publishing/OIDC. Use token-based npm auth only as a temporary bootstrap fallback.
