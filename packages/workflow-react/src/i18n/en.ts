export const defaultMessages = {
  toolbar: {
    undo: "Undo",
    redo: "Redo",
    validate: "Validate",
    errors: "errors",
    warnings: "warnings",
    infos: "infos",
    save: "Save",
    addWorkflow: "Add workflow",
  },
  inspector: {
    empty: "Select a node or edge to edit its properties.",
    properties: "Properties",
    json: "JSON",
    name: "Name",
    description: "Description",
    version: "Version",
    active: "Active",
    initialState: "Initial state",
    manual: "Manual",
    disabled: "Disabled",
    processors: "Processors",
    criterion: "Criterion",
    executionMode: "Execution mode",
    addProcessor: "Add processor",
    removeProcessor: "Remove",
    moveUp: "Move up",
    moveDown: "Move down",
    issues: "Issues",
    sourceAnchor: "Source anchor",
    targetAnchor: "Target anchor",
    anchorDefault: "Default",
    anchorTop: "Top",
    anchorRight: "Right",
    anchorBottom: "Bottom",
    anchorLeft: "Left",
  },
  confirmDelete: {
    title: "Delete state?",
    message: "Deleting this state will also remove transitions that reference it.",
    transitionsAffected: "Transitions affected",
    confirm: "Delete",
    cancel: "Cancel",
  },
  dragConnect: {
    title: "New transition",
    transitionName: "Transition name",
    create: "Create",
    cancel: "Cancel",
    invalidName:
      "Name must start with a letter and contain only letters, digits, underscores, or hyphens.",
    duplicateName: "A transition with this name already exists on the source state.",
  },
  tabs: {
    closeTab: "Close",
    untitled: "(unnamed)",
  },
  editorView: {
    graph: "Graph",
    json: "JSON",
    unavailable:
      "Monaco runtime not configured. Pass jsonEditor.monaco to enable direct JSON editing.",
    invalidJson:
      "JSON syntax is invalid. The graph is still showing the last valid workflow.",
    invalidSchema:
      "JSON does not match the workflow schema. The graph is still showing the last valid workflow.",
    semanticErrors:
      "The graph has updated, but JSON validation still has semantic errors. Save stays blocked until they are resolved.",
  },
  saveConfirm: {
    title: "Save workflows?",
    modeLabel: "Import mode",
    ackReplace:
      "I understand this will REPLACE all workflows on the server for this entity.",
    ackActivate:
      "I understand this will ACTIVATE these workflows and deactivate the current set.",
    ackWarnings: "I acknowledge {count} warning(s) will be saved.",
    confirm: "Save",
    cancel: "Cancel",
  },
  conflict: {
    message:
      "Server state has changed since this editor was opened. Choose Reload to discard local changes or Force overwrite to keep them.",
    reload: "Reload",
    forceOverwrite: "Force overwrite",
  },
};

export type Messages = typeof defaultMessages;
