import { useMemo, useState } from "react";
import { parseImportPayload } from "@cyoda/workflow-core";
import { projectToGraph } from "@cyoda/workflow-graph";
import { WorkflowViewer } from "@cyoda/workflow-viewer";

const ALERT_TRIAGE = `{
  "importMode": "MERGE",
  "workflows": [
    {
      "version": "1.0",
      "name": "alertTriage",
      "initialState": "raised",
      "active": true,
      "states": {
        "raised": {
          "transitions": [
            { "name": "classify", "next": "triaged", "manual": false, "disabled": false }
          ]
        },
        "triaged": {
          "transitions": [
            { "name": "assign", "next": "investigating", "manual": true, "disabled": false },
            { "name": "autoResolve", "next": "resolved", "manual": false, "disabled": false }
          ]
        },
        "investigating": {
          "transitions": [
            { "name": "escalate", "next": "escalated", "manual": true, "disabled": false },
            { "name": "resolve", "next": "resolved", "manual": false, "disabled": false }
          ]
        },
        "escalated": {
          "transitions": [
            { "name": "resolve", "next": "resolved", "manual": false, "disabled": false }
          ]
        },
        "resolved": { "transitions": [] }
      }
    }
  ]
}`;

export function App() {
  const [selected, setSelected] = useState<string | null>(null);

  const graph = useMemo(() => {
    const parsed = parseImportPayload(ALERT_TRIAGE);
    if (!parsed.document) return null;
    return projectToGraph(parsed.document);
  }, []);

  if (!graph) return <main>Failed to parse example workflow.</main>;

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Alert triage workflow</h1>
      <p style={{ color: "#475569", fontSize: 14, marginBottom: 16 }}>
        Embedded read-only viewer — drop <code>@cyoda/workflow-viewer</code> into any
        React page to render a Cyoda workflow from its canonical JSON.
      </p>
      <div className="viewer-card">
        <WorkflowViewer
          graph={graph}
          selectedId={selected ?? undefined}
          onSelectionChange={setSelected}
        />
      </div>
      {selected && (
        <p style={{ fontSize: 13, color: "#334155", marginTop: 12 }}>
          Selected id: <code>{selected}</code>
        </p>
      )}
    </main>
  );
}
