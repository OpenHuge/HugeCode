import type { ComposerEditorSettings } from "../../../types";

export const DEFAULT_EDITOR_SETTINGS: ComposerEditorSettings = {
  preset: "default",
  expandFenceOnSpace: false,
  expandFenceOnEnter: false,
  fenceLanguageTags: false,
  fenceWrapSelection: false,
  autoWrapPasteMultiline: false,
  autoWrapPasteCodeLike: false,
  continueListOnShiftEnter: false,
};

export const CARET_ANCHOR_GAP = 8;
export const PENDING_INPUT_AUTO_ADVANCE_MS = 180;
