---
"@cyoda/workflow-react": patch
---

Processor editor: "Retry policy" is now a dropdown (Default (FIXED) / NONE / FIXED) instead of a free-text field.

cyoda-go only accepts `NONE`, `FIXED`, or empty for a processor's `retryPolicy` (empty defaults to `FIXED`; anything else is rejected at import). The dropdown prevents entering an invalid value. The number of retries and the delay are server-configured, not part of the workflow JSON.
