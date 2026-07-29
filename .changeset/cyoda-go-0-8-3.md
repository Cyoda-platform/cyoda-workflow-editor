---
"@cyoda/workflow-core": minor
"@cyoda/workflow-react": minor
"@cyoda/workflow-graph": minor
"@cyoda/workflow-viewer": patch
---

Support cyoda-go 0.8.3 (workflow schema 1.3).

- `transitions[].schedule.function` — per-entity scheduled-transition timing
- `allowCycles` on the import payload, with a matching cycle-detection warning
- Strict `version`-tag validation; new workflows are stamped `1.3` (the editor
  previously emitted `1.0`, which 0.8.3 rejects outright)
- **Breaking:** the `"0.7"` dialect is removed. Upgrade configs to `"0.8"`.
- **Breaking:** `startNewTxOnDispatch` moves into `config`, matching the wire
  format. It was emitted at processor level, which 0.8.3 rejects with a 400.
- **Breaking:** processor `type` is a preserved string rather than the literal
  `"externalized"`, because cyoda-go round-trips it verbatim.
- **Breaking (`@cyoda/workflow-core`):** `CyodaDialect.schemaVersionTag` is now
  a **required** field. Any host-registered dialect must declare which
  in-document `version` tag it stamps on new workflows (`"1.3"` for the shipped
  `"0.8"` dialect); there is no default. Add the field to your dialect object.
- **Breaking (`@cyoda/workflow-graph`):** `TransitionSummary.execution` is
  replaced by `commitBeforeDispatch?: boolean`. The three-way execution badge
  hint conveyed nothing a renderer acted on; the one operationally significant
  mode — COMMIT_BEFORE_DISPATCH, where Cyoda commits the entity before calling
  the processor — is now a plain flag. `summarizeExecution` and the
  `ExecutionSummary` type are no longer exported. Renderers reading
  `summary.execution` must switch to `summary.commitBeforeDispatch`.
- Fixes five round-trip defects that silently dropped, invented, or
  over-constrained processor config data.
