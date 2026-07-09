---
"@cyoda/workflow-react": patch
---

Compact the transition inspector by laying short controls out in a two-column grid.

Source/Target state, Type/Disabled, Source/Target anchor, and the scheduled
Delay/Timeout fields now sit two-up instead of each on its own full-width row;
Name, the criterion editor, the processor list, and annotations stay full width.
The grid uses `auto-fit` so it collapses back to a single column on a narrow
(docked) inspector. Purely presentational — no model or behaviour change.
