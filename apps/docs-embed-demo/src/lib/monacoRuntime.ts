import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import * as monaco from "monaco-editor";
import "monaco-editor/min/vs/editor/editor.main.css";

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker(_: string, label: string): Worker;
    };
  }
}

let configured = false;

export function getMonacoRuntime() {
  if (!configured) {
    window.MonacoEnvironment = {
      getWorker(_workerId: string, label: string) {
        if (label === "json") return new jsonWorker();
        return new editorWorker();
      },
    };
    configured = true;
  }
  return monaco;
}
