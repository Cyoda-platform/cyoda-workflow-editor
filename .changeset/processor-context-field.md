---
"@cyoda/workflow-react": minor
---

Expose the processor `context` and `startNewTxOnDispatch` config fields in the processor editor.

Both already round-tripped on save but had no form control, so an imported
processor's `context` (e.g. `"channel=email,customer"`) was preserved yet
invisible. The processor modal now has:

- **Context** — a text field for the pass-through string forwarded verbatim as
  the outgoing request's `parameters` node (empty ⇒ omitted).
- **Start new transaction on dispatch** — a checkbox, enabled only for
  `COMMIT_BEFORE_DISPATCH` execution mode (and cleared when the mode changes
  away from it), matching the engine's validation.
