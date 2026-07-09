---
"@cyoda/workflow-core": minor
---

Triage the workflow validation ruleset: drop noisy heuristics, demote soft ones, make more issues clickable, and document the catalog.

- **Removed** four rules that flag valid designs or judgements the editor can't
  make: `all-transitions-manual` (a manual-only state is normal),
  `sync-on-likely-bottleneck-transition` (SYNC is fine in the STP path; slowness
  isn't detectable here), `matches-pattern-unanchored`, and `like-wildcard-warning`.
- **Collapsed** the per-victim `unreachable-automated-transition` into
  `null-criterion-not-last`: one warning on the always-fires transition now names
  the transitions it shadows (in `detail.unreachable`), instead of a separate
  warning per dead transition.
- **Demoted to `info`** five opinionated heuristics: `excessive-fan-out`,
  `processor-overload`, `disabled-transition-on-active-workflow`,
  `lifecycle-path-in-simple`, `function-without-quick-exit`.
- **Added jump targets** so the issues drawer's "Jump to" works for the
  node-scoped survivors: `unreachable-state`, `excessive-fan-out`,
  `unknown-transition-target`, `duplicate-transition-name`,
  `duplicate-processor-name`, `processor-overload`,
  `disabled-transition-on-active-workflow`, and
  `start-new-tx-without-commit-before-dispatch`.
- **Documented** every code in `docs/validation-rules.md`, kept honest by a
  drift-guard test that fails if a rule is added or removed without updating the
  catalog.

Criterion-scoped clickability (e.g. `unsupported-operator`) is left for a
follow-up — it needs a criterion→host targeting path the current drawer doesn't
resolve.
