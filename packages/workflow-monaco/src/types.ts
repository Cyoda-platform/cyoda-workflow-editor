/**
 * Structural subset of the Monaco editor surface we rely on.
 * Typed structurally so callers can pass the `monaco-editor` module or any
 * compatible reimplementation (e.g. `@monaco-editor/react`'s `monaco` instance)
 * without us hard-depending on their class types.
 */

export interface MarkerData {
  severity: number;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  code?: string;
  source?: string;
}

export interface Position {
  lineNumber: number;
  column: number;
}

export interface Range {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface TextModelLike {
  uri: { toString(): string };
  getValue(): string;
  setValue(v: string): void;
  getPositionAt(offset: number): Position;
  getOffsetAt(position: Position): number;
  onDidChangeContent(listener: () => void): { dispose(): void };
}

export interface EditorLike {
  getModel(): TextModelLike | null;
  setModel(model: TextModelLike | null): void;
  setSelection(range: Range): void;
  revealRangeInCenterIfOutsideViewport(range: Range): void;
  onDidChangeCursorPosition(listener: (e: { position: Position }) => void): {
    dispose(): void;
  };
}

export interface JsonDiagnosticsOptions {
  validate?: boolean;
  allowComments?: boolean;
  schemas?: Array<{
    uri: string;
    fileMatch?: string[];
    schema: object;
  }>;
  [k: string]: unknown;
}

export interface MonacoLike {
  editor: {
    setModelMarkers(model: TextModelLike, owner: string, markers: MarkerData[]): void;
  };
  languages: {
    json: {
      jsonDefaults: {
        diagnosticsOptions: JsonDiagnosticsOptions;
        setDiagnosticsOptions(opts: JsonDiagnosticsOptions): void;
      };
    };
  };
  MarkerSeverity: {
    Error: number;
    Warning: number;
    Info: number;
    Hint: number;
  };
}

export interface JsonSchemaHandle {
  schemaUri: string;
  fileMatchPrefix: string;
  dispose(): void;
}
