import { useEffect, useMemo, useState } from "react";
import { WorkflowEditor } from "@cyoda/workflow-react";
import {
  applyPatch,
  type EntityIdentity,
  type WorkflowEditorDocument,
} from "@cyoda/workflow-core";
import {
  DocumentStats,
  FixtureSelector,
  JsonBlock,
  PageIntro,
} from "../components/DemoUi.js";
import { fixtureBySlug, fixturesFor } from "../examples/fixtureCatalog.js";
import { getMonacoRuntime } from "../lib/monacoRuntime.js";
import { loadFixture, serializeDocument } from "../lib/workflowDemo.js";
import { createSampleHintProvider } from "../lib/entityHints.js";
import tradeEntitySample from "../examples/entity/tradeEntity.json";

const ENTITY: EntityIdentity = {
  entityName: "StructuredTrade",
  modelVersion: 17,
};

function withEntity(
  doc: WorkflowEditorDocument,
  entity: EntityIdentity,
): WorkflowEditorDocument {
  return applyPatch(doc, { op: "setEntity", entity });
}

export function CriteriaEditorPage() {
  const monaco = useMemo(() => getMonacoRuntime(), []);
  const fixtures = fixturesFor("criteria");
  const defaultSlug = fixtures[0]?.slug ?? "trade-criteria-demo";
  const [selectedSlug, setSelectedSlug] = useState(defaultSlug);
  const [docVersion, setDocVersion] = useState(0);

  const hintProvider = useMemo(
    () =>
      createSampleHintProvider(
        {
          [ENTITY.entityName]: { sample: tradeEntitySample, maxDepth: 6 },
        },
        // Small latency so the loading row is observable in the demo.
        120,
      ),
    [],
  );

  const selectedFixture = fixtureBySlug(selectedSlug) ?? fixtures[0];
  const loaded = useMemo(
    () => (selectedFixture ? loadFixture(selectedFixture) : null),
    [selectedFixture],
  );
  const initialDocument = useMemo(
    () => (loaded?.document ? withEntity(loaded.document, ENTITY) : null),
    [loaded],
  );

  const [currentDocument, setCurrentDocument] =
    useState<WorkflowEditorDocument | null>(initialDocument);

  useEffect(() => {
    setCurrentDocument(initialDocument);
    setDocVersion((v) => v + 1);
  }, [initialDocument]);

  const resetDocument = () => {
    setCurrentDocument(initialDocument);
    setDocVersion((v) => v + 1);
  };

  const handleFixtureChange = (slug: string) => {
    const fixture = fixtureBySlug(slug);
    if (!fixture) return;
    setSelectedSlug(slug);
  };

  if (!selectedFixture || !loaded || !initialDocument || !currentDocument) {
    return (
      <section className="page-section">
        <PageIntro
          eyebrow="Criteria editor"
          title="Criteria editor demo"
          description="No criteria-demo fixture could be loaded."
        />
      </section>
    );
  }

  const entitySampleText = JSON.stringify(tradeEntitySample, null, 2);

  return (
    <section className="page-section" data-testid="criteria-page">
      <PageIntro
        eyebrow="Criteria editor"
        title="Criterion editor — full coverage demo"
        description="Trade settlement variant wired to the StructuredTrade entity sample. Select a transition, use the compact inspector card to add or edit a criterion, then work in the focused modal. Apply commits one patch; Cancel discards the draft. The JSONPath input is wired to an EntityFieldHintProvider derived from the entity sample below."
      />

      <FixtureSelector
        fixtures={fixtures}
        selectedSlug={selectedSlug}
        onSelect={handleFixtureChange}
      />
      <DocumentStats
        fixture={selectedFixture}
        document={currentDocument}
        issues={loaded.issues}
        extra={[
          { label: "Entity", value: `${ENTITY.entityName} v${ENTITY.modelVersion}` },
          { label: "Hint provider", value: "sample-backed" },
        ]}
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Coverage matrix</h2>
            <p className="muted-text">
              Each transition in the loaded workflow demonstrates a different
              criterion shape, operator family, or no-criterion state. Edit any
              of them to exercise the modal workflow.
            </p>
          </div>
          <div className="panel-actions">
            <button type="button" className="action-button" onClick={resetDocument}>
              Reset editor state
            </button>
          </div>
        </div>
        <ul className="issues-list" style={{ margin: 0 }}>
          <li>
            <strong>No criterion compact card:</strong>{" "}
            <code>ROUTE_TO_OPS</code>, <code>APPLY_REPAIR</code>, and{" "}
            <code>CANCEL_TRADE</code> show the Add criterion path from the
            inspector summary card.
          </li>
          <li>
            <strong>Simple — equality / null / pattern:</strong>{" "}
            <code>RECEIVED → VALIDATING</code> (EQUALS),{" "}
            <code>VALIDATING → REPAIR_REQUESTED</code> (IS_NULL inside OR),{" "}
            <code>VALIDATING</code> uses MATCHES_PATTERN inside AND.
          </li>
          <li>
            <strong>Simple — BETWEEN_INCLUSIVE (range):</strong>{" "}
            <code>FIXED_RATE_IN_BAND</code> and <code>DV01_WITHIN_LIMITS</code>{" "}
            both edit a two-element [low, high] value.
          </li>
          <li>
            <strong>Simple — case-insensitive substring:</strong>{" "}
            <code>MATCH_MISMATCH</code> (IEQUALS) and{" "}
            <code>SETTLEMENT_BREAK</code> (ICONTAINS).
          </li>
          <li>
            <strong>Group — AND / OR / nested NOT:</strong>{" "}
            <code>VALID_LARGE_USD_TRADE</code> (AND of 4),{" "}
            <code>VALIDATION_FAILED</code> (OR of 2),{" "}
            <code>CLEARED_AT_LCH</code> (AND with a nested NOT).
          </li>
          <li>
            <strong>Function — with quick-exit:</strong>{" "}
            <code>ALL_RATE_FIXINGS_OBSERVED</code> wraps an external function
            call and a nested simple criterion.
          </li>
          <li>
            <strong>Lifecycle — previousTransition:</strong>{" "}
            <code>JUST_ARRIVED_FROM_CLEARING</code> and{" "}
            <code>ARRIVED_VIA_APPROVAL</code>.
          </li>
          <li>
            <strong>Array — CONTAINS on string list:</strong>{" "}
            <code>MATCHED_WITH_KEY_FIELDS</code> (matchedFields) and{" "}
            <code>APPROVED_AND_USD_SSI</code> (businessCenters).
          </li>
        </ul>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Workflow editor</h2>
            <p className="muted-text">
              Select a transition, click Add/Edit criterion in the inspector,
              then focus any JSONPath input in the modal to see entity-scoped
              autocomplete. Apply updates the graph badge and exported JSON;
              Cancel leaves both untouched.
            </p>
          </div>
        </div>
        <div className="editor-shell" data-testid="workflow-editor-shell">
          <WorkflowEditor
            key={`${selectedFixture.slug}-${docVersion}`}
            document={currentDocument}
            mode="editor"
            enableJsonEditor
            jsonEditorPlacement="tab"
            jsonEditor={{
              monaco,
              modelUri: `cyoda://criteria-demo/${selectedFixture.slug}.json`,
            }}
            hintProvider={hintProvider}
            onChange={setCurrentDocument}
            onSave={() => {}}
          />
        </div>
      </section>

      <JsonBlock
        title="Exported Cyoda workflow JSON"
        text={serializeDocument(currentDocument)}
      />
      <JsonBlock
        title={`Entity sample — ${ENTITY.entityName} v${ENTITY.modelVersion}`}
        text={entitySampleText}
      />
    </section>
  );
}
