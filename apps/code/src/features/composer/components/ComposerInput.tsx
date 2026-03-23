import { Button, Icon, Switch, Textarea } from "../../../design-system";
import Brain from "lucide-react/dist/esm/icons/brain";
import FileText from "lucide-react/dist/esm/icons/file-text";
import GitFork from "lucide-react/dist/esm/icons/git-fork";
import Info from "lucide-react/dist/esm/icons/info";
import Plug from "lucide-react/dist/esm/icons/plug";
import Plus from "lucide-react/dist/esm/icons/plus";
import { PopoverMenuItem, PopoverSurface } from "../../../design-system";
import PlusCircle from "lucide-react/dist/esm/icons/plus-circle";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import Wrench from "lucide-react/dist/esm/icons/wrench";
import Zap from "lucide-react/dist/esm/icons/zap";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent, RefObject, SyntheticEvent } from "react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { joinClassNames } from "../../../utils/classNames";
import { getCaretPosition } from "../../../utils/caretPosition";
import { isComposingEvent } from "../../../utils/keys";
import type { SkillOption } from "../../../types";
import { FileTypeIconImage } from "../../shared/components/FileTypeIconImage";
import {
  formatSkillDisplayName,
  splitTextWithSkillReferences,
} from "../../skills/utils/skillPresentation";
import type { ReviewPromptState, ReviewPromptStep } from "../../threads/hooks/useReviewPrompt";
import type { AutocompleteItem } from "../hooks/useComposerAutocomplete";
import type { ComposerDraftSyncMode } from "../hooks/useComposerDraftSync";
import { useComposerImageDrop } from "../hooks/useComposerImageDrop";
import { resolveComposerFooterLayout } from "../utils/composerFooterLayout";
import { ComposerAttachments } from "./ComposerAttachments";
import { InlineSkillOverlayChip, useElementStyleMap } from "./ComposerDynamicStyle";
import * as suggestionStyles from "./ComposerSuggestions.css";
import { ComposerDraftZone, ComposerFooterBar } from "./ComposerShell";
import * as styles from "./ComposerInput.styles.css";

const LazyReviewInlinePrompt = lazy(async () => {
  const module = await import("./ReviewInlinePrompt");
  return { default: module.ReviewInlinePrompt };
});

type ComposerInputProps = {
  surfaceVariant?: "default" | "launchpad";
  text: string;
  disabled: boolean;
  sendLabel: string;
  canStop: boolean;
  canSend: boolean;
  canQueue?: boolean;
  isProcessing: boolean;
  onStop: () => void;
  onSend: () => void;
  onQueue?: () => void;
  attachments?: string[];
  onAddAttachment?: () => void;
  onAttachImages?: (paths: string[]) => void;
  onRemoveAttachment?: (path: string) => void;
  reasoningOptions?: string[];
  selectedEffort?: string | null;
  onSelectEffort?: (effort: string) => void;
  fastModeEnabled?: boolean;
  onToggleFastMode?: (enabled: boolean) => void;
  reasoningSupported?: boolean;
  onTextChange: (
    next: string,
    selectionStart: number | null,
    syncMode?: ComposerDraftSyncMode
  ) => void;
  onTextBlur?: () => void;
  onTextPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onSelectionChange: (selectionStart: number | null) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  suggestionsOpen: boolean;
  suggestions: AutocompleteItem[];
  highlightIndex: number;
  onHighlightIndex: (index: number) => void;
  onSelectSuggestion: (item: AutocompleteItem) => void;
  suggestionsStyle?: React.CSSProperties;
  placeholderText?: string;
  skills?: SkillOption[];
  reviewPrompt?: ReviewPromptState;
  onReviewPromptClose?: () => void;
  onReviewPromptShowPreset?: () => void;
  onReviewPromptChoosePreset?: (
    preset: Exclude<ReviewPromptStep, "preset"> | "uncommitted"
  ) => void;
  highlightedPresetIndex?: number;
  onReviewPromptHighlightPreset?: (index: number) => void;
  highlightedBranchIndex?: number;
  onReviewPromptHighlightBranch?: (index: number) => void;
  highlightedCommitIndex?: number;
  onReviewPromptHighlightCommit?: (index: number) => void;
  onReviewPromptSelectBranch?: (value: string) => void;
  onReviewPromptSelectBranchAtIndex?: (index: number) => void;
  onReviewPromptConfirmBranch?: () => Promise<void>;
  onReviewPromptSelectCommit?: (sha: string, title: string) => void;
  onReviewPromptSelectCommitAtIndex?: (index: number) => void;
  onReviewPromptConfirmCommit?: () => Promise<void>;
  onReviewPromptUpdateCustomInstructions?: (value: string) => void;
  onReviewPromptConfirmCustom?: () => Promise<void>;
  onReviewPromptKeyDown?: (event: {
    key: string;
    shiftKey?: boolean;
    preventDefault: () => void;
  }) => boolean;
  topContent?: React.ReactNode;
  bottomContent?: React.ReactNode;
  footerActions?: React.ReactNode;
  children?: React.ReactNode;
};

const isFileSuggestion = (item: AutocompleteItem) => item.group === "Files";

const suggestionIcon = (item: AutocompleteItem) => {
  if (isFileSuggestion(item)) {
    return FileText;
  }
  if (item.id.startsWith("skill:")) {
    return Wrench;
  }
  if (item.id.startsWith("app:")) {
    return Plug;
  }
  if (item.id === "review") {
    return Brain;
  }
  if (item.id === "fork") {
    return GitFork;
  }
  if (item.id === "mcp") {
    return Plug;
  }
  if (item.id === "apps") {
    return Plug;
  }
  if (item.id === "new") {
    return PlusCircle;
  }
  if (item.id === "resume") {
    return RotateCcw;
  }
  if (item.id === "status") {
    return Info;
  }
  if (item.id.startsWith("prompt:")) {
    return ScrollText;
  }
  return Wrench;
};

const fileTitle = (path: string) => {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
};

function buildComposerPlaceholder({
  disabled,
  placeholderText,
  isProcessing,
  queueAvailable,
}: {
  disabled: boolean;
  placeholderText: string;
  isProcessing: boolean;
  queueAvailable: boolean;
}) {
  if (disabled) {
    return "Review in progress. Chat will re-enable when it completes.";
  }

  const hints: string[] = [];
  if (isProcessing) {
    hints.push("Run active.");
  }
  if (queueAvailable) {
    hints.push("Tab to queue.");
  }
  hints.push("Shift+Enter for a new line.");

  return `${placeholderText} ${hints.join(" ")}`.trim();
}

const COLLAPSED_TEXTAREA_MIN_HEIGHT = {
  desktop: 40,
  phone: 44,
} as const;

type InlineSkillReference = {
  key: string;
  label: string;
  skill: SkillOption;
  start: number;
  end: number;
};

type InlineSkillChipLayout = InlineSkillReference & {
  top: number;
  left: number;
  width: number;
  height: number;
};

const INLINE_SKILL_MAX_CHARACTERS = 24;

function clampInlineSkillLabel(label: string, maxCharacters = INLINE_SKILL_MAX_CHARACTERS) {
  if (label.length <= maxCharacters) {
    return label;
  }
  return `${label.slice(0, Math.max(1, maxCharacters - 1)).trimEnd()}…`;
}

function getInlineSkillCursorEnd(text: string, tokenEnd: number) {
  let cursor = tokenEnd;
  while (cursor < text.length && /\s/.test(text[cursor] ?? "")) {
    cursor += 1;
  }
  return cursor;
}

function areInlineSkillChipLayoutsEqual(
  left: InlineSkillChipLayout[],
  right: InlineSkillChipLayout[]
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((layout, index) => {
    const candidate = right[index];
    if (!candidate) {
      return false;
    }
    return (
      layout.key === candidate.key &&
      layout.label === candidate.label &&
      layout.top === candidate.top &&
      layout.left === candidate.left &&
      layout.width === candidate.width &&
      layout.height === candidate.height
    );
  });
}

function findSkillDeletionRange(
  text: string,
  references: InlineSkillReference[],
  selectionStart: number,
  selectionEnd: number,
  key: "Backspace" | "Delete"
) {
  if (selectionStart !== selectionEnd) {
    const overlapping = references.filter(
      (reference) => selectionStart < reference.end && selectionEnd > reference.start
    );
    if (overlapping.length === 0) {
      return null;
    }
    return {
      start: Math.min(selectionStart, ...overlapping.map((reference) => reference.start)),
      end: Math.max(selectionEnd, ...overlapping.map((reference) => reference.end)),
    };
  }

  if (key === "Backspace") {
    const match = references.find((reference) => {
      const cursorEnd = getInlineSkillCursorEnd(text, reference.end);
      return selectionStart === cursorEnd || selectionStart === reference.end;
    });
    if (!match) {
      return null;
    }
    return {
      start: match.start,
      end: getInlineSkillCursorEnd(text, match.end),
    };
  }

  const match = references.find((reference) => selectionStart === reference.start);
  if (!match) {
    return null;
  }
  return {
    start: match.start,
    end: getInlineSkillCursorEnd(text, match.end),
  };
}

export function ComposerInput({
  surfaceVariant = "default",
  text,
  disabled,
  sendLabel,
  canStop,
  canSend,
  canQueue = false,
  isProcessing,
  onStop,
  onSend,
  onQueue,
  attachments = [],
  onAddAttachment,
  onAttachImages,
  onRemoveAttachment,
  reasoningOptions = [],
  selectedEffort = null,
  onSelectEffort,
  fastModeEnabled = false,
  onToggleFastMode,
  reasoningSupported = false,
  onTextChange,
  onTextBlur,
  onTextPaste,
  onSelectionChange,
  onKeyDown,
  isExpanded = false,
  onToggleExpand: _onToggleExpand,
  textareaRef,
  suggestionsOpen,
  suggestions,
  highlightIndex,
  onHighlightIndex,
  onSelectSuggestion,
  suggestionsStyle,
  placeholderText = "Ask Codex to do something...",
  skills = [],
  reviewPrompt,
  onReviewPromptClose,
  onReviewPromptShowPreset,
  onReviewPromptChoosePreset,
  highlightedPresetIndex,
  onReviewPromptHighlightPreset,
  highlightedBranchIndex,
  onReviewPromptHighlightBranch,
  highlightedCommitIndex,
  onReviewPromptHighlightCommit,
  onReviewPromptSelectBranch,
  onReviewPromptSelectBranchAtIndex,
  onReviewPromptConfirmBranch,
  onReviewPromptSelectCommit,
  onReviewPromptSelectCommitAtIndex,
  onReviewPromptConfirmCommit,
  onReviewPromptUpdateCustomInstructions,
  onReviewPromptConfirmCustom,
  onReviewPromptKeyDown,
  topContent,
  bottomContent,
  footerActions,
  children,
}: ComposerInputProps) {
  const suggestionListRef = useRef<HTMLDivElement | null>(null);
  const suggestionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mobileActionsRef = useRef<HTMLDivElement | null>(null);
  const inputRowRef = useRef<HTMLDivElement | null>(null);
  const draftOverlayRef = useRef<HTMLDivElement | null>(null);
  const compositionSessionRef = useRef(false);
  const compositionCommitGuardTimerRef = useRef<number | null>(null);
  const previousReviewPromptOpenRef = useRef(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [isPhoneLayout, setIsPhoneLayout] = useState(false);
  const [isPhoneTallInput, setIsPhoneTallInput] = useState(false);
  const [footerWidth, setFooterWidth] = useState<number | null>(null);
  const [inlineSkillChipLayouts, setInlineSkillChipLayouts] = useState<InlineSkillChipLayout[]>([]);
  const reviewPromptOpen = Boolean(reviewPrompt);
  const showReviewInlinePrompt = Boolean(
    reviewPromptOpen &&
    reviewPrompt &&
    onReviewPromptClose &&
    onReviewPromptShowPreset &&
    onReviewPromptChoosePreset &&
    highlightedPresetIndex !== undefined &&
    onReviewPromptHighlightPreset &&
    highlightedBranchIndex !== undefined &&
    onReviewPromptHighlightBranch &&
    highlightedCommitIndex !== undefined &&
    onReviewPromptHighlightCommit &&
    onReviewPromptSelectBranch &&
    onReviewPromptSelectBranchAtIndex &&
    onReviewPromptConfirmBranch &&
    onReviewPromptSelectCommit &&
    onReviewPromptSelectCommitAtIndex &&
    onReviewPromptConfirmCommit &&
    onReviewPromptUpdateCustomInstructions &&
    onReviewPromptConfirmCustom
  );
  const reviewInlinePromptProps =
    showReviewInlinePrompt && reviewPrompt
      ? {
          reviewPrompt,
          onClose: onReviewPromptClose!,
          onShowPreset: onReviewPromptShowPreset!,
          onChoosePreset: onReviewPromptChoosePreset!,
          highlightedPresetIndex: highlightedPresetIndex!,
          onHighlightPreset: onReviewPromptHighlightPreset!,
          highlightedBranchIndex: highlightedBranchIndex!,
          onHighlightBranch: onReviewPromptHighlightBranch!,
          highlightedCommitIndex: highlightedCommitIndex!,
          onHighlightCommit: onReviewPromptHighlightCommit!,
          onSelectBranch: onReviewPromptSelectBranch!,
          onSelectBranchAtIndex: onReviewPromptSelectBranchAtIndex!,
          onConfirmBranch: onReviewPromptConfirmBranch!,
          onSelectCommit: onReviewPromptSelectCommit!,
          onSelectCommitAtIndex: onReviewPromptSelectCommitAtIndex!,
          onConfirmCommit: onReviewPromptConfirmCommit!,
          onUpdateCustomInstructions: onReviewPromptUpdateCustomInstructions!,
          onConfirmCustom: onReviewPromptConfirmCustom!,
          onKeyDown: onReviewPromptKeyDown,
        }
      : null;
  const shouldRenderSuggestionsSurface = Boolean(
    suggestionsOpen && (reviewInlinePromptProps || suggestions.length > 0)
  );
  useElementStyleMap(suggestionListRef, suggestionsStyle);
  const {
    dropTargetRef,
    isDragOver,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handlePaste,
  } = useComposerImageDrop({
    disabled,
    onAttachImages,
  });

  useEffect(() => {
    if (!suggestionsOpen || suggestions.length === 0) {
      return;
    }
    const list = suggestionListRef.current;
    const item = suggestionRefs.current[highlightIndex];
    if (!list || !item) {
      return;
    }
    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    if (itemRect.top < listRect.top) {
      item.scrollIntoView({ block: "nearest" });
      return;
    }
    if (itemRect.bottom > listRect.bottom) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex, suggestionsOpen, suggestions.length]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const appRoot = textarea.closest(".app");
    if (!(appRoot instanceof HTMLElement)) {
      setIsPhoneLayout(false);
      return;
    }

    const syncLayout = () => {
      const nextIsPhoneLayout = appRoot.classList.contains("layout-phone");
      setIsPhoneLayout((prev) => (prev === nextIsPhoneLayout ? prev : nextIsPhoneLayout));
    };

    syncLayout();
    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.attributeName === "class")) {
        syncLayout();
      }
    });
    observer.observe(appRoot, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
    };
  }, [textareaRef]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const minTextareaHeight = isExpanded
      ? isPhoneLayout
        ? 152
        : 180
      : isPhoneLayout
        ? COLLAPSED_TEXTAREA_MIN_HEIGHT.phone
        : COLLAPSED_TEXTAREA_MIN_HEIGHT.desktop;
    const maxTextareaHeight = isExpanded ? (isPhoneLayout ? 280 : 320) : isPhoneLayout ? 168 : 200;
    textarea.style.height = "auto";
    textarea.style.minHeight = `${minTextareaHeight}px`;
    textarea.style.maxHeight = `${maxTextareaHeight}px`;
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, minTextareaHeight),
      maxTextareaHeight
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxTextareaHeight ? "auto" : "hidden";

    if (!isPhoneLayout) {
      setIsPhoneTallInput((prev) => (prev ? false : prev));
      return;
    }

    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20;
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
    const contentHeight = Math.max(0, nextHeight - paddingTop - paddingBottom);
    const estimatedLineCount = contentHeight / lineHeight;
    const nextIsPhoneTallInput = estimatedLineCount > 2.25;
    setIsPhoneTallInput((prev) => (prev === nextIsPhoneTallInput ? prev : nextIsPhoneTallInput));
  }, [isExpanded, isPhoneLayout, text, textareaRef]);

  useEffect(() => {
    const textarea = textareaRef.current;
    const overlay = draftOverlayRef.current;
    if (!textarea || !overlay) {
      return;
    }
    overlay.scrollTop = textarea.scrollTop;
    overlay.scrollLeft = textarea.scrollLeft;
  }, [text, textareaRef]);

  useEffect(() => {
    if (!mobileActionsOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && mobileActionsRef.current?.contains(target)) {
        return;
      }
      setMobileActionsOpen(false);
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileActionsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileActionsOpen]);

  useEffect(() => {
    if (disabled && mobileActionsOpen) {
      setMobileActionsOpen(false);
    }
  }, [disabled, mobileActionsOpen]);

  useEffect(
    () => () => {
      if (compositionCommitGuardTimerRef.current !== null) {
        window.clearTimeout(compositionCommitGuardTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const wasReviewPromptOpen = previousReviewPromptOpenRef.current;
    previousReviewPromptOpenRef.current = reviewPromptOpen;
    if (!wasReviewPromptOpen || reviewPromptOpen) {
      return;
    }
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus();
      const cursor = textarea.value.length;
      textarea.setSelectionRange(cursor, cursor);
      onSelectionChange(cursor);
    });
  }, [onSelectionChange, reviewPromptOpen, textareaRef]);

  const sendBlockedByPendingProcessing = isProcessing && !canStop;
  const showStopAction = isProcessing || canStop;
  const sendButtonAriaLabel = canStop
    ? "Stop"
    : sendBlockedByPendingProcessing
      ? "Starting response"
      : sendLabel;

  const handleActionClick = useCallback(() => {
    if (sendBlockedByPendingProcessing) {
      return;
    }
    if (canStop) {
      onStop();
    } else {
      onSend();
    }
  }, [canStop, onSend, onStop, sendBlockedByPendingProcessing]);
  const sendButtonDisabled =
    disabled || sendBlockedByPendingProcessing || (!showStopAction && !canSend);
  const queueAvailable = canQueue && Boolean(onQueue);
  const footerLayout = resolveComposerFooterLayout({
    width: footerWidth,
    hasExpandControl: false,
    hasQueueControl: queueAvailable,
  });
  void reasoningOptions;
  void selectedEffort;
  void onSelectEffort;
  void reasoningSupported;
  const fastSpeedActive = fastModeEnabled;
  const canToggleFastSpeed = Boolean(onToggleFastMode);
  const showQueueInMenu = queueAvailable && !footerLayout.showInlineQueue;
  const hasMenuActions = Boolean(onAddAttachment || canToggleFastSpeed || showQueueInMenu);
  const textareaPlaceholder = buildComposerPlaceholder({
    disabled,
    placeholderText,
    isProcessing,
    queueAvailable,
  });
  const handleQueueClick = useCallback(() => {
    if (!queueAvailable || disabled || !canSend) {
      return;
    }
    onQueue?.();
  }, [canSend, disabled, onQueue, queueAvailable]);

  useLayoutEffect(() => {
    const row = inputRowRef.current;
    if (!row) {
      return;
    }
    const syncWidth = () => {
      const nextWidth = Math.round(row.clientWidth || row.getBoundingClientRect().width || 0);
      setFooterWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    syncWidth();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncWidth) : null;
    observer?.observe(row);
    return () => {
      observer?.disconnect();
    };
  }, [queueAvailable]);

  const handleTextareaChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const syncMode: ComposerDraftSyncMode = compositionSessionRef.current ? "skip" : "deferred";
      onTextChange(event.target.value, event.target.selectionStart, syncMode);
    },
    [onTextChange]
  );

  const handleTextareaSelect = useCallback(
    (event: SyntheticEvent<HTMLTextAreaElement>) => {
      onSelectionChange((event.target as HTMLTextAreaElement).selectionStart);
    },
    [onSelectionChange]
  );

  const handleTextareaPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      void handlePaste(event);
      if (!event.defaultPrevented) {
        onTextPaste?.(event);
      }
    },
    [handlePaste, onTextPaste]
  );

  const renderedDraftSegments = useMemo(
    () => splitTextWithSkillReferences(text, skills),
    [skills, text]
  );
  const inlineSkillReferences = useMemo(() => {
    let cursor = 0;
    const references: InlineSkillReference[] = [];

    renderedDraftSegments.forEach((segment, index) => {
      const start = cursor;
      const end = start + segment.value.length;
      if (segment.kind === "skill") {
        references.push({
          key: `${segment.skill.name}-${index}-${start}`,
          label: clampInlineSkillLabel(formatSkillDisplayName(segment.skill.name)),
          skill: segment.skill,
          start,
          end,
        });
      }
      cursor = end;
    });

    return references;
  }, [renderedDraftSegments]);
  const hasInlineSkills = inlineSkillReferences.length > 0;
  const resolveInlineSkillCursorEnd = useCallback(
    (tokenEnd: number) => getInlineSkillCursorEnd(text, tokenEnd),
    [text]
  );

  const clearCompositionCommitGuard = useCallback(() => {
    if (compositionCommitGuardTimerRef.current === null) {
      return;
    }
    window.clearTimeout(compositionCommitGuardTimerRef.current);
    compositionCommitGuardTimerRef.current = null;
  }, []);

  const handleTextareaCompositionStart = useCallback(() => {
    compositionSessionRef.current = true;
    clearCompositionCommitGuard();
  }, [clearCompositionCommitGuard]);

  const handleTextareaCompositionEnd = useCallback(
    (event: React.CompositionEvent<HTMLTextAreaElement>) => {
      const textarea = event.currentTarget;
      // IME candidate text is intermediate UI state and must not leak into parent draft sync.
      onTextChange(textarea.value, textarea.selectionStart, "deferred");
      onSelectionChange(textarea.selectionStart);
      compositionSessionRef.current = false;
      clearCompositionCommitGuard();
      // Some browsers dispatch a plain Enter immediately after compositionend.
      compositionCommitGuardTimerRef.current = window.setTimeout(() => {
        compositionCommitGuardTimerRef.current = null;
      }, 0);
    },
    [clearCompositionCommitGuard, onSelectionChange, onTextChange]
  );

  const handleTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (isComposingEvent(event) || compositionSessionRef.current) {
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        const textarea = event.currentTarget;
        const selectionStart = textarea.selectionStart ?? 0;
        const selectionEnd = textarea.selectionEnd ?? selectionStart;
        const deletionRange = findSkillDeletionRange(
          text,
          inlineSkillReferences,
          selectionStart,
          selectionEnd,
          event.key
        );
        if (deletionRange) {
          event.preventDefault();
          const nextText = `${text.slice(0, deletionRange.start)}${text.slice(deletionRange.end)}`;
          onTextChange(nextText, deletionRange.start, "deferred");
          onSelectionChange(deletionRange.start);
          requestAnimationFrame(() => {
            const nextTextarea = textareaRef.current;
            if (!nextTextarea) {
              return;
            }
            nextTextarea.focus();
            nextTextarea.setSelectionRange(deletionRange.start, deletionRange.start);
          });
          return;
        }
      }
      if (compositionCommitGuardTimerRef.current !== null && event.key === "Enter") {
        event.preventDefault();
        return;
      }
      onKeyDown(event);
    },
    [inlineSkillReferences, onKeyDown, onSelectionChange, onTextChange, text, textareaRef]
  );

  const handleMobileAttachClick = useCallback(() => {
    if (disabled || !onAddAttachment) {
      return;
    }
    setMobileActionsOpen(false);
    onAddAttachment();
  }, [disabled, onAddAttachment]);

  const handleFastSpeedToggle = useCallback(() => {
    if (disabled || !canToggleFastSpeed || !onToggleFastMode) {
      return;
    }
    onToggleFastMode(!fastSpeedActive);
  }, [canToggleFastSpeed, disabled, fastSpeedActive, onToggleFastMode]);

  const syncInlineSkillChipLayouts = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || inlineSkillReferences.length === 0) {
      setInlineSkillChipLayouts((current) => (current.length === 0 ? current : []));
      return;
    }

    const nextLayouts = inlineSkillReferences.flatMap((reference) => {
      const startPosition = getCaretPosition(textarea, reference.start);
      const endPosition = getCaretPosition(textarea, reference.end);
      if (!startPosition || !endPosition) {
        return [];
      }

      const chipHeight = Math.max(24, Math.min(Math.round(startPosition.lineHeight), 28));
      const sameLine = Math.round(startPosition.top) === Math.round(endPosition.top);
      const rawWidth = sameLine
        ? Math.max(0, Math.round(endPosition.left - startPosition.left))
        : Math.max(0, textarea.clientWidth - Math.round(startPosition.left) - 8);
      const top = Math.round(
        startPosition.top + Math.max((startPosition.lineHeight - chipHeight) / 2, 0)
      );

      return [
        {
          ...reference,
          top,
          left: Math.round(startPosition.left),
          width: rawWidth,
          height: chipHeight,
        },
      ] satisfies InlineSkillChipLayout[];
    });

    setInlineSkillChipLayouts((current) =>
      areInlineSkillChipLayoutsEqual(current, nextLayouts) ? current : nextLayouts
    );
  }, [inlineSkillReferences, textareaRef]);

  useLayoutEffect(() => {
    syncInlineSkillChipLayouts();
  }, [syncInlineSkillChipLayouts]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const handleWindowResize = () => {
      syncInlineSkillChipLayouts();
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            syncInlineSkillChipLayouts();
          })
        : null;

    resizeObserver?.observe(textarea);
    window.addEventListener("resize", handleWindowResize);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [syncInlineSkillChipLayouts, textareaRef]);

  return (
    <div
      className={joinClassNames(
        styles.input,
        "composer-input",
        isPhoneLayout && isPhoneTallInput && "is-phone-tall"
      )}
    >
      {/* dropzone container needs div semantics for current ref/event handling */}
      <div
        className={joinClassNames(
          styles.inputArea,
          (shouldRenderSuggestionsSurface || mobileActionsOpen) && styles.inputAreaSuggestionsOpen,
          surfaceVariant === "launchpad" && styles.inputAreaLaunchpad,
          isDragOver && styles.inputAreaDragOver,
          "composer-input-area",
          isDragOver && "is-drag-over"
        )}
        ref={dropTargetRef}
        role="group"
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <ComposerDraftZone className={joinClassNames(styles.editorBody, "composer-editor-body")}>
          {topContent ? (
            <div className={joinClassNames(styles.topContent, "composer-top-content")}>
              {topContent}
            </div>
          ) : null}
          <ComposerAttachments
            attachments={attachments}
            disabled={disabled}
            onRemoveAttachment={onRemoveAttachment}
          />
          <div className={joinClassNames(styles.draftField, "composer-draft-field")}>
            {hasInlineSkills ? (
              <div
                ref={draftOverlayRef}
                aria-hidden
                className={joinClassNames(styles.draftOverlay, "composer-draft-overlay")}
              >
                {inlineSkillChipLayouts.map((layout) => {
                  return (
                    <InlineSkillOverlayChip
                      key={layout.key}
                      layout={layout}
                      onSelectionChange={onSelectionChange}
                      resolveCursorEnd={resolveInlineSkillCursorEnd}
                      textareaRef={textareaRef}
                    />
                  );
                })}
              </div>
            ) : null}
            <Textarea
              ref={textareaRef}
              aria-label="Composer draft"
              rows={1}
              placeholder={textareaPlaceholder}
              value={text}
              onChange={handleTextareaChange}
              onBlur={onTextBlur}
              onSelect={handleTextareaSelect}
              disabled={disabled}
              onCompositionStart={handleTextareaCompositionStart}
              onCompositionEnd={handleTextareaCompositionEnd}
              onKeyDown={handleTextareaKeyDown}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onPaste={handleTextareaPaste}
              onScroll={(event) => {
                const overlay = draftOverlayRef.current;
                if (!overlay) {
                  return;
                }
                overlay.scrollTop = event.currentTarget.scrollTop;
                overlay.scrollLeft = event.currentTarget.scrollLeft;
              }}
              className={joinClassNames(
                styles.textarea,
                surfaceVariant === "launchpad" && styles.textareaLaunchpad,
                "composer-textarea"
              )}
            />
          </div>
        </ComposerDraftZone>
        <div
          ref={inputRowRef}
          className={joinClassNames(
            styles.inputRow,
            footerLayout.mode !== "full" && styles.inputRowCompact,
            "composer-input-row"
          )}
          data-footer-layout={footerLayout.mode}
        >
          <div
            className={joinClassNames(
              styles.bottomBarLeft,
              footerLayout.mode !== "full" && styles.bottomBarLeftCompact,
              "composer-bottom-left"
            )}
          >
            <div className={joinClassNames(styles.leadingActions, "composer-leading-actions")}>
              <div
                className={`composer-mobile-menu${mobileActionsOpen ? " is-open" : ""}`}
                ref={mobileActionsRef}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className={joinClassNames(
                    styles.action,
                    "composer-action composer-action--mobile-menu"
                  )}
                  onClick={() => setMobileActionsOpen((prev) => !prev)}
                  disabled={disabled || !hasMenuActions}
                  aria-expanded={mobileActionsOpen}
                  aria-haspopup="menu"
                  aria-label="Open composer menu"
                  title="Open composer menu"
                >
                  <Icon icon={Plus} size="sm" />
                </Button>
                {mobileActionsOpen && (
                  <PopoverSurface
                    className={joinClassNames(
                      styles.mobileActionsPopover,
                      "composer-mobile-actions-popover"
                    )}
                    role="menu"
                  >
                    <PopoverMenuItem
                      onClick={handleMobileAttachClick}
                      disabled={disabled || !onAddAttachment}
                      icon={<Icon icon={FileText} size="sm" />}
                    >
                      Add files
                    </PopoverMenuItem>
                    {canToggleFastSpeed && (
                      <div className={styles.menuSwitchRow} role="none">
                        <span className={styles.menuSwitchCopy}>
                          <span className={styles.menuSwitchIcon} aria-hidden>
                            <Icon icon={Zap} size="sm" />
                          </span>
                          <span className={styles.menuSwitchLabel}>Fast speed</span>
                        </span>
                        <Switch
                          aria-label="Fast speed"
                          checked={fastSpeedActive}
                          disabled={disabled}
                          onCheckedChange={handleFastSpeedToggle}
                          className={styles.menuSwitchControl}
                        />
                      </div>
                    )}
                    {showQueueInMenu && (
                      <PopoverMenuItem
                        onClick={() => {
                          setMobileActionsOpen(false);
                          handleQueueClick();
                        }}
                        disabled={disabled || !canSend}
                        icon={<Icon icon={GitFork} size="sm" />}
                      >
                        Queue message
                      </PopoverMenuItem>
                    )}
                  </PopoverSurface>
                )}
              </div>
            </div>
            {children ? (
              <div className={joinClassNames(styles.metaSlot, "composer-meta-slot")}>
                {children}
              </div>
            ) : null}
          </div>
          <div
            className={joinClassNames(
              styles.actionsGroup,
              footerLayout.mode !== "full" && styles.actionsGroupCompact,
              "composer-actions-group"
            )}
          >
            {footerActions ?? (
              <>
                {queueAvailable && footerLayout.showInlineQueue && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={joinClassNames(
                      styles.action,
                      "composer-action composer-action--queue"
                    )}
                    onClick={handleQueueClick}
                    disabled={disabled || !canSend}
                    aria-label="Queue message"
                    title="Queue message (Tab)"
                  >
                    <Icon icon={GitFork} />
                  </Button>
                )}
                <Button
                  variant={showStopAction ? "secondary" : "primary"}
                  size="icon"
                  className={joinClassNames(
                    styles.action,
                    `composer-action${showStopAction ? " is-stop" : " is-send"}`
                  )}
                  onClick={handleActionClick}
                  disabled={sendButtonDisabled}
                  aria-label={sendButtonAriaLabel}
                  title={sendButtonAriaLabel}
                >
                  {showStopAction ? (
                    <span
                      className={joinClassNames(styles.stopSquare, "composer-action-stop-square")}
                      aria-hidden
                    />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                      className="composer-send-icon"
                      width={14}
                      height={14}
                    >
                      <title>Send message</title>
                      <path
                        d="M12 21L12 3M12 3L5 10M12 3L19 10"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
        {bottomContent ? (
          <ComposerFooterBar>
            <div className={joinClassNames(styles.bottomContent, "composer-bottom-content")}>
              {bottomContent}
            </div>
          </ComposerFooterBar>
        ) : null}
        {shouldRenderSuggestionsSurface && (
          <PopoverSurface
            className={`composer-suggestions${
              reviewPromptOpen ? " review-inline-suggestions" : ""
            }`}
            role="listbox"
            ref={suggestionListRef}
          >
            {reviewInlinePromptProps ? (
              <Suspense fallback={null}>
                <LazyReviewInlinePrompt {...reviewInlinePromptProps} />
              </Suspense>
            ) : (
              suggestions.map((item, index) => {
                const prevGroup = suggestions[index - 1]?.group;
                const showGroup = Boolean(item.group && item.group !== prevGroup);
                return (
                  <div key={item.id}>
                    {showGroup && <div className="composer-suggestion-section">{item.group}</div>}
                    <button
                      type="button"
                      className={`composer-suggestion${
                        index === highlightIndex ? " is-active" : ""
                      }`}
                      role="option"
                      aria-selected={index === highlightIndex}
                      ref={(node) => {
                        suggestionRefs.current[index] = node;
                      }}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onSelectSuggestion(item)}
                      onMouseEnter={() => onHighlightIndex(index)}
                    >
                      {(() => {
                        const Icon = suggestionIcon(item);
                        const fileSuggestion = isFileSuggestion(item);
                        const skillSuggestion = item.id.startsWith("skill:");
                        const title = fileSuggestion ? fileTitle(item.label) : item.label;
                        const description = fileSuggestion ? item.label : item.description;
                        return (
                          <span className="composer-suggestion-row">
                            <span className="composer-suggestion-icon" aria-hidden>
                              {fileSuggestion ? (
                                <FileTypeIconImage
                                  path={item.label}
                                  alt=""
                                  className="composer-suggestion-icon-image"
                                  fallback={<Icon size={14} />}
                                />
                              ) : (
                                <Icon size={14} />
                              )}
                            </span>
                            <span className="composer-suggestion-content">
                              <span className="composer-suggestion-title">{title}</span>
                              {item.metaChips && item.metaChips.length > 0 ? (
                                <span className={suggestionStyles.suggestionMeta} aria-hidden>
                                  {item.metaChips.map((chip) => (
                                    <span
                                      key={`${item.id}-${chip}`}
                                      className={joinClassNames(
                                        suggestionStyles.suggestionMetaChip,
                                        skillSuggestion
                                          ? suggestionStyles.suggestionMetaChipSkill
                                          : null
                                      )}
                                    >
                                      {chip}
                                    </span>
                                  ))}
                                </span>
                              ) : null}
                              {description && (
                                <span
                                  className={`composer-suggestion-description${
                                    skillSuggestion ? " composer-suggestion-description--skill" : ""
                                  }`}
                                >
                                  {description}
                                </span>
                              )}
                              {!fileSuggestion && item.hint && (
                                <span className="composer-suggestion-description">{item.hint}</span>
                              )}
                            </span>
                          </span>
                        );
                      })()}
                    </button>
                  </div>
                );
              })
            )}
          </PopoverSurface>
        )}
      </div>
    </div>
  );
}
