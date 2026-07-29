---
"@cyoda/workflow-core": minor
"@cyoda/workflow-react": minor
"@cyoda/workflow-graph": minor
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
- Fixes five round-trip defects that silently dropped, invented, or
  over-constrained processor config data.
