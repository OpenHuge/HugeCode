import {
  type ClipboardEvent,
  type CSSProperties,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppMention } from "../../../types";
import { getApprovalCommandInfo } from "../../../utils/approvalRules";
import { getCaretPosition } from "../../../utils/caretPosition";
import {
  getLineIndent,
  getFenceTriggerLine,
  getListContinuation,
  isCodeLikeSingleLine,
  isCursorInsideFence,
  normalizePastedText,
} from "../../../utils/composerText";
import { isComposingEvent } from "../../../utils/keys";
import { isMobilePlatform } from "../../../utils/platformPaths";
import {
  type AppMentionBinding,
  connectorMentionSlug,
  resolveBoundAppMentions,
} from "../utils/appMentionBindings";
import {
  buildRequestUserInputResponse,
  createInitialRequestUserInputState,
  getRequestUserInputNoteKey,
} from "../../app/utils/requestUserInput";
import { useComposerAutocompleteState } from "../hooks/useComposerAutocompleteState";
import { type ComposerDraftSyncMode, useComposerDraftSync } from "../hooks/useComposerDraftSync";
import { resolveComposerInteractionState } from "../utils/collaborationModes";
import { usePromptHistory } from "../hooks/usePromptHistory";
import { insertComposerLineBreak } from "../utils/composerEditorInsertion";
import { normalizeSkillReferenceText } from "../../skills/utils/skillPresentation";
import {
  CARET_ANCHOR_GAP,
  DEFAULT_EDITOR_SETTINGS,
  PENDING_INPUT_AUTO_ADVANCE_MS,
} from "../utils/composerEditorConfig";
import {
  applyPendingInputTextInsertion,
  getPendingInputAnswerPlaceholder,
  resolvePendingInputArrowShortcut,
  resolvePendingInputDraftView,
  resolvePendingInputNumberShortcut,
} from "../utils/pendingInputDraft";
import { ComposerInput } from "./ComposerInput";
import { ComposerMetaBar } from "./ComposerMetaBar";
import { ComposerAutoDriveStatusBar } from "./ComposerMetaBarAutoDriveMeta";
import {
  ComposerActionRail,
  ComposerFrame,
  ComposerPendingPanel,
  ComposerToolbar,
} from "./ComposerShell";
import { ComposerWorkspaceBar } from "./ComposerWorkspaceBar";
import type { ComposerProps } from "./Composer.types";

const LazyComposerQueue = lazy(async () => {
  const module = await import("./ComposerQueue");
  return { default: module.ComposerQueue };
});

const LazyComposerPendingTopContent = lazy(async () => {
  const module = await import("./ComposerPendingStateChrome");
  return { default: module.ComposerPendingTopContent };
});

const LazyComposerPendingFooterActions = lazy(async () => {
  const module = await import("./ComposerPendingStateChrome");
  return { default: module.ComposerPendingFooterActions };
});

const AUTO_DRIVE_STATUS_RAIL_EXIT_MS = 220;

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return typeof value === "object" && value !== null && "then" in value;
}

function equalStringArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function equalAppMentionBindings(left: AppMentionBinding[], right: AppMentionBinding[]) {
  return (
    left.length === right.length &&
    left.every(
      (binding, index) =>
        binding.slug === right[index]?.slug &&
        binding.mention.name === right[index]?.mention.name &&
        binding.mention.path === right[index]?.mention.path
    )
  );
}

export const Composer = memo(function Composer({
  variant = "thread",
  onSend,
  onQueue,
  onStop,
  canStop,
  disabled = false,
  isProcessing,
  steerEnabled,
  collaborationModes,
  selectedCollaborationModeId,
  onSelectCollaborationMode,
  models,
  modelSelectionMode = "manual",
  selectedProviderId = null,
  onSelectProvider = () => undefined,
  onSelectAutoRoute = () => undefined,
  onSelectModelSelectionMode = () => undefined,
  selectedModelId,
  onSelectModel,
  reasoningOptions,
  selectedEffort,
  onSelectEffort,
  fastModeEnabled = false,
  onToggleFastMode,
  reasoningSupported,
  accessMode,
  onSelectAccessMode,
  executionOptions,
  selectedExecutionMode,
  onSelectExecutionMode,
  remoteBackendOptions = [],
  selectedRemoteBackendId = null,
  onSelectRemoteBackendId,
  autoDrive = null,
  skills,
  prompts,
  files,
  contextUsage = null,
  queuedMessages = [],
  queuePausedReason = null,
  onEditQueued,
  onDeleteQueued,
  sendLabel = "Send",
  draftText = "",
  onDraftChange,
  historyKey = null,
  attachedImages = [],
  onPickImages,
  onAttachImages,
  onRemoveImage,
  prefillDraft = null,
  onPrefillHandled,
  insertText = null,
  onInsertHandled,
  textareaRef: externalTextareaRef,
  editorSettings: editorSettingsProp,
  editorExpanded = false,
  onToggleEditorExpanded: _onToggleEditorExpanded,
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
  onReviewPromptKeyDown,
  onReviewPromptSelectBranch,
  onReviewPromptSelectBranchAtIndex,
  onReviewPromptConfirmBranch,
  onReviewPromptSelectCommit,
  onReviewPromptSelectCommitAtIndex,
  onReviewPromptConfirmCommit,
  onReviewPromptUpdateCustomInstructions,
  onReviewPromptConfirmCustom,
  onFileAutocompleteActiveChange,
  pendingUserInputRequest = null,
  pendingUserInputRequestIndex = 1,
  pendingUserInputRequestCount = 0,
  onPendingUserInputSubmit,
  pendingApprovalRequest = null,
  onPendingApprovalDecision,
  onPendingApprovalRemember,
  pendingPlanFollowup = null,
  onPendingPlanAccept,
  onPendingPlanSubmitChanges,
  pendingToolCallRequest = null,
  onPendingToolCallSubmit,
  workspaceControls = null,
}: ComposerProps) {
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [appMentionBindings, setAppMentionBindings] = useState<AppMentionBinding[]>([]);
  const [suggestionsStyle, setSuggestionsStyle] = useState<CSSProperties | undefined>(undefined);
  const [pendingQuestionIndex, setPendingQuestionIndex] = useState(0);
  const [pendingSelections, setPendingSelections] = useState<Record<string, number | null>>({});
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({});
  const [pendingPlanChanges, setPendingPlanChanges] = useState("");
  const [pendingToolCallOutput, setPendingToolCallOutput] = useState("");
  const [pendingToolCallSuccess, setPendingToolCallSuccess] = useState(true);
  const internalRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingAdvanceTimerRef = useRef<number | null>(null);
  const textareaRef = externalTextareaRef ?? internalRef;
  const { text, setComposerText, flushDraftToParent } = useComposerDraftSync({
    draftText,
    onDraftChange,
    textareaRef,
    historyKey,
  });
  const editorSettings = editorSettingsProp ?? DEFAULT_EDITOR_SETTINGS;
  const canQueueInFlight = steerEnabled && isProcessing;
  const selectedRemoteBackendLabel = useMemo(() => {
    const normalizedSelectedBackendId = selectedRemoteBackendId?.trim() || null;
    if (!normalizedSelectedBackendId) {
      return "Automatic runtime routing";
    }
    return (
      remoteBackendOptions.find((entry) => entry.value === normalizedSelectedBackendId)?.label ??
      normalizedSelectedBackendId
    );
  }, [remoteBackendOptions, selectedRemoteBackendId]);
  const showAutoDriveStatusBar = Boolean(autoDrive && (autoDrive.enabled || autoDrive.run));
  const [renderAutoDriveStatusBar, setRenderAutoDriveStatusBar] = useState(showAutoDriveStatusBar);
  const [autoDriveStatusBarVisibility, setAutoDriveStatusBarVisibility] = useState<
    "hidden" | "entering" | "visible" | "exiting"
  >(showAutoDriveStatusBar ? "visible" : "hidden");
  const autoDriveStatusBarFrameRef = useRef<number | null>(null);
  const autoDriveStatusBarExitTimerRef = useRef<number | null>(null);
  const previousAutoDriveStatusBarVisibleRef = useRef(showAutoDriveStatusBar);
  const {
    expandFenceOnSpace,
    expandFenceOnEnter,
    fenceLanguageTags,
    fenceWrapSelection,
    autoWrapPasteMultiline,
    autoWrapPasteCodeLike,
    continueListOnShiftEnter,
  } = editorSettings;
  const latestTextRef = useRef(text);
  const latestAttachedImagesRef = useRef(attachedImages);
  const latestAppMentionBindingsRef = useRef(appMentionBindings);
  useEffect(() => {
    latestTextRef.current = text;
  }, [text]);
  useEffect(() => {
    latestAttachedImagesRef.current = attachedImages;
  }, [attachedImages]);
  useEffect(() => {
    latestAppMentionBindingsRef.current = appMentionBindings;
  }, [appMentionBindings]);
  useEffect(() => {
    const normalized = normalizeSkillReferenceText(text, skills, selectionStart);
    if (normalized.text === text) {
      return;
    }
    setComposerText(normalized.text, "immediate");
    if (normalized.cursor === null) {
      return;
    }
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      textarea.setSelectionRange(normalized.cursor!, normalized.cursor!);
      setSelectionStart(normalized.cursor);
    });
  }, [selectionStart, setComposerText, skills, text, textareaRef]);
  useEffect(() => {
    if (!pendingUserInputRequest) {
      if (pendingAdvanceTimerRef.current !== null) {
        window.clearTimeout(pendingAdvanceTimerRef.current);
        pendingAdvanceTimerRef.current = null;
      }
      setPendingQuestionIndex(0);
      setPendingSelections({});
      setPendingNotes({});
      return;
    }
    const nextState = createInitialRequestUserInputState(pendingUserInputRequest);
    setPendingQuestionIndex(0);
    setPendingSelections(nextState.selections);
    setPendingNotes(nextState.notes);
    setSelectionStart(0);
  }, [pendingUserInputRequest]);
  useEffect(() => {
    if (autoDriveStatusBarFrameRef.current !== null) {
      window.cancelAnimationFrame(autoDriveStatusBarFrameRef.current);
      autoDriveStatusBarFrameRef.current = null;
    }
    if (autoDriveStatusBarExitTimerRef.current !== null) {
      window.clearTimeout(autoDriveStatusBarExitTimerRef.current);
      autoDriveStatusBarExitTimerRef.current = null;
    }

    if (showAutoDriveStatusBar) {
      setRenderAutoDriveStatusBar(true);
      if (previousAutoDriveStatusBarVisibleRef.current) {
        setAutoDriveStatusBarVisibility("visible");
      } else {
        setAutoDriveStatusBarVisibility("entering");
        autoDriveStatusBarFrameRef.current = window.requestAnimationFrame(() => {
          setAutoDriveStatusBarVisibility("visible");
          autoDriveStatusBarFrameRef.current = null;
        });
      }
    } else if (previousAutoDriveStatusBarVisibleRef.current && renderAutoDriveStatusBar) {
      setAutoDriveStatusBarVisibility("exiting");
      autoDriveStatusBarExitTimerRef.current = window.setTimeout(() => {
        setRenderAutoDriveStatusBar(false);
        setAutoDriveStatusBarVisibility("hidden");
        autoDriveStatusBarExitTimerRef.current = null;
      }, AUTO_DRIVE_STATUS_RAIL_EXIT_MS);
    } else {
      setRenderAutoDriveStatusBar(false);
      setAutoDriveStatusBarVisibility("hidden");
    }

    previousAutoDriveStatusBarVisibleRef.current = showAutoDriveStatusBar;

    return () => {
      if (autoDriveStatusBarFrameRef.current !== null) {
        window.cancelAnimationFrame(autoDriveStatusBarFrameRef.current);
        autoDriveStatusBarFrameRef.current = null;
      }
      if (autoDriveStatusBarExitTimerRef.current !== null) {
        window.clearTimeout(autoDriveStatusBarExitTimerRef.current);
        autoDriveStatusBarExitTimerRef.current = null;
      }
    };
  }, [showAutoDriveStatusBar]);
  useEffect(
    () => () => {
      if (pendingAdvanceTimerRef.current !== null) {
        window.clearTimeout(pendingAdvanceTimerRef.current);
      }
      if (autoDriveStatusBarFrameRef.current !== null) {
        window.cancelAnimationFrame(autoDriveStatusBarFrameRef.current);
      }
      if (autoDriveStatusBarExitTimerRef.current !== null) {
        window.clearTimeout(autoDriveStatusBarExitTimerRef.current);
      }
    },
    []
  );
  useEffect(() => {
    if (!pendingPlanFollowup) {
      setPendingPlanChanges("");
      return;
    }
    setPendingPlanChanges("");
  }, [pendingPlanFollowup]);
  useEffect(() => {
    if (!pendingToolCallRequest) {
      setPendingToolCallOutput("");
      setPendingToolCallSuccess(true);
      return;
    }
    setPendingToolCallOutput("");
    setPendingToolCallSuccess(true);
  }, [pendingToolCallRequest]);
  const bindingsFromMentions = useCallback(
    (mentions?: AppMention[]) =>
      (mentions ?? []).map((mention) => ({
        slug: connectorMentionSlug(mention.name),
        mention,
      })),
    []
  );
  const {
    isAutocompleteOpen,
    autocompleteMatches,
    autocompleteAnchorIndex,
    highlightIndex,
    setHighlightIndex,
    applyAutocomplete,
    handleInputKeyDown,
    handleTextChange,
    handleSelectionChange,
    fileTriggerActive,
  } = useComposerAutocompleteState({
    text,
    selectionStart,
    disabled,
    skills,
    prompts,
    files,
    textareaRef,
    setText: setComposerText,
    setSelectionStart,
  });
  useEffect(() => {
    onFileAutocompleteActiveChange?.(fileTriggerActive);
  }, [fileTriggerActive, onFileAutocompleteActiveChange]);
  const reviewPromptOpen = Boolean(reviewPrompt);
  const pendingUserInputActive = Boolean(pendingUserInputRequest && onPendingUserInputSubmit);
  const pendingApprovalActive = Boolean(pendingApprovalRequest && onPendingApprovalDecision);
  const pendingToolCallActive = Boolean(pendingToolCallRequest && onPendingToolCallSubmit);
  const { pendingPlanReviewActive, suggestionsOpen } = resolveComposerInteractionState({
    collaborationModes,
    selectedCollaborationModeId,
    pendingPlanFollowup,
    onPendingPlanAccept,
    onPendingPlanSubmitChanges,
    pendingUserInputActive,
    pendingApprovalActive,
    pendingToolCallActive,
    reviewPromptOpen,
    isAutocompleteOpen,
  });
  const pendingQuestions = pendingUserInputRequest?.params.questions ?? [];
  const {
    activeQuestion: activePendingQuestion,
    activeQuestionKey: activePendingQuestionKey,
    activeSelectedIndex: activePendingSelectedIndex,
    activeNoteKey: activePendingNoteKey,
    activeAnswerText,
  } = resolvePendingInputDraftView({
    request: pendingUserInputActive ? pendingUserInputRequest : null,
    questionIndex: pendingQuestionIndex,
    selections: pendingSelections,
    notes: pendingNotes,
  });
  const getCurrentComposerText = () => textareaRef.current?.value ?? text;
  const canSend = getCurrentComposerText().trim().length > 0 || attachedImages.length > 0;
  const suggestions = reviewPromptOpen ? [] : autocompleteMatches;
  const pendingApprovalCommandInfo = pendingApprovalRequest
    ? getApprovalCommandInfo(pendingApprovalRequest.params)
    : null;
  const hasQueuedMessages = queuedMessages.length > 0;
  const hasPendingStateChrome =
    (pendingUserInputActive && Boolean(activePendingQuestion)) ||
    pendingApprovalActive ||
    pendingToolCallActive ||
    pendingPlanReviewActive;
  useLayoutEffect(() => {
    if (!isAutocompleteOpen) {
      setSuggestionsStyle(undefined);
      return;
    }
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const cursor =
      autocompleteAnchorIndex ?? textarea.selectionStart ?? selectionStart ?? text.length;
    const caret = getCaretPosition(textarea, cursor);
    if (!caret) {
      return;
    }
    const textareaRect = textarea.getBoundingClientRect();
    const container = textarea.closest(".composer-input");
    const containerRect = container?.getBoundingClientRect();
    const offsetLeft = textareaRect.left - (containerRect?.left ?? 0);
    const containerWidth = container?.clientWidth ?? textarea.clientWidth ?? 0;
    const popoverWidth = Math.min(containerWidth, 420);
    const rawLeft = offsetLeft + caret.left;
    const maxLeft = Math.max(0, containerWidth - popoverWidth);
    const left = Math.min(Math.max(0, rawLeft), maxLeft);
    setSuggestionsStyle({
      left,
      right: "auto",
      bottom: `calc(100% + ${CARET_ANCHOR_GAP}px)`,
      top: "auto",
    });
  }, [autocompleteAnchorIndex, isAutocompleteOpen, selectionStart, text, textareaRef]);
  const { handleHistoryKeyDown, handleHistoryTextChange, recordHistory, resetHistoryNavigation } =
    usePromptHistory({
      historyKey,
      text,
      hasAttachments: attachedImages.length > 0,
      disabled,
      isAutocompleteOpen: suggestionsOpen,
      textareaRef,
      setText: setComposerText,
      setSelectionStart,
    });

  const focusTextarea = useCallback(() => {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus();
      const cursor = textarea.value.length;
      textarea.setSelectionRange(cursor, cursor);
      setSelectionStart(cursor);
    });
  }, [textareaRef]);

  const handlePendingSelect = useCallback(
    (index: number) => {
      if (!activePendingQuestionKey || !activePendingQuestion) {
        return;
      }
      const nextNoteKey = getRequestUserInputNoteKey(
        activePendingQuestionKey,
        (activePendingQuestion.options?.length ?? 0) > 0,
        index
      );
      setPendingSelections((current) => ({ ...current, [activePendingQuestionKey]: index }));
      setPendingNotes((current) => {
        const currentNote = activePendingNoteKey ? (current[activePendingNoteKey] ?? "") : "";
        if (!currentNote || nextNoteKey === activePendingNoteKey || current[nextNoteKey]?.trim()) {
          return current;
        }
        return { ...current, [nextNoteKey]: currentNote };
      });
      focusTextarea();
    },
    [activePendingNoteKey, activePendingQuestion, activePendingQuestionKey, focusTextarea]
  );
  const handlePendingAnswerChange = useCallback(
    (value: string) => {
      if (!activePendingNoteKey) {
        return;
      }
      if (pendingAdvanceTimerRef.current !== null && value.trim().length > 0) {
        window.clearTimeout(pendingAdvanceTimerRef.current);
        pendingAdvanceTimerRef.current = null;
      }
      setPendingNotes((current) => ({ ...current, [activePendingNoteKey]: value }));
    },
    [activePendingNoteKey]
  );
  const handleTextChangeWithHistory = useCallback(
    (next: string, cursor: number | null, syncMode: ComposerDraftSyncMode = "deferred") => {
      if (pendingUserInputActive) {
        handlePendingAnswerChange(next);
        setSelectionStart(cursor);
        return;
      }
      handleHistoryTextChange(next);
      handleTextChange(next, cursor, syncMode);
    },
    [handleHistoryTextChange, handlePendingAnswerChange, handleTextChange, pendingUserInputActive]
  );

  const handlePendingAdvance = useCallback(() => {
    if (!pendingUserInputRequest || !onPendingUserInputSubmit) {
      return;
    }
    const nextIndex = pendingQuestionIndex + 1;
    if (nextIndex < pendingQuestions.length) {
      setPendingQuestionIndex(nextIndex);
      focusTextarea();
      return;
    }
    onPendingUserInputSubmit(
      pendingUserInputRequest,
      buildRequestUserInputResponse(pendingUserInputRequest, pendingSelections, pendingNotes)
    );
  }, [
    focusTextarea,
    onPendingUserInputSubmit,
    pendingNotes,
    pendingQuestionIndex,
    pendingQuestions.length,
    pendingSelections,
    pendingUserInputRequest,
  ]);
  const schedulePendingAdvance = useCallback(
    (nextSelectedIndex: number | null) => {
      if (pendingAdvanceTimerRef.current !== null) {
        window.clearTimeout(pendingAdvanceTimerRef.current);
      }
      if (!activePendingQuestionKey || !activePendingQuestion) {
        pendingAdvanceTimerRef.current = null;
        return;
      }
      const getNextAnswerText = (nextSelectedIndex: number | null) => {
        if (activeAnswerText.trim().length > 0) {
          return activeAnswerText;
        }
        const nextNoteKey = getRequestUserInputNoteKey(
          activePendingQuestionKey,
          (activePendingQuestion.options?.length ?? 0) > 0,
          nextSelectedIndex
        );
        return pendingNotes[nextNoteKey] ?? "";
      };
      if (getNextAnswerText(nextSelectedIndex).trim().length > 0) {
        pendingAdvanceTimerRef.current = null;
        return;
      }
      pendingAdvanceTimerRef.current = window.setTimeout(() => {
        pendingAdvanceTimerRef.current = null;
        handlePendingAdvance();
      }, PENDING_INPUT_AUTO_ADVANCE_MS);
    },
    [
      activeAnswerText,
      activePendingQuestion,
      activePendingQuestionKey,
      handlePendingAdvance,
      pendingNotes,
    ]
  );

  const handlePendingPrevious = useCallback(() => {
    if (pendingQuestionIndex <= 0) {
      return;
    }
    if (pendingAdvanceTimerRef.current !== null) {
      window.clearTimeout(pendingAdvanceTimerRef.current);
      pendingAdvanceTimerRef.current = null;
    }
    setPendingQuestionIndex((current) => Math.max(0, current - 1));
    focusTextarea();
  }, [focusTextarea, pendingQuestionIndex]);

  const handlePendingPlanSubmitChanges = useCallback(() => {
    const trimmed = pendingPlanChanges.trim();
    if (!trimmed || !onPendingPlanSubmitChanges) {
      return;
    }
    onPendingPlanSubmitChanges(trimmed);
    setPendingPlanChanges("");
  }, [onPendingPlanSubmitChanges, pendingPlanChanges]);

  const handlePendingPlanAccept = useCallback(() => {
    if (!onPendingPlanAccept) {
      return;
    }
    onPendingPlanAccept();
    setPendingPlanChanges("");
  }, [onPendingPlanAccept]);

  const handlePendingToolCallSubmit = useCallback(() => {
    if (!pendingToolCallRequest || !onPendingToolCallSubmit) {
      return;
    }
    const trimmed = pendingToolCallOutput.trim();
    onPendingToolCallSubmit(pendingToolCallRequest, {
      contentItems: trimmed ? [{ type: "inputText", text: trimmed }] : [],
      success: pendingToolCallSuccess,
    });
    setPendingToolCallOutput("");
    setPendingToolCallSuccess(true);
  }, [
    onPendingToolCallSubmit,
    pendingToolCallOutput,
    pendingToolCallRequest,
    pendingToolCallSuccess,
  ]);
  const shouldResetSubmittedDraft = useCallback(
    (submittedText: string, submittedImages: string[], submittedBindings: AppMentionBinding[]) => {
      const currentText = textareaRef.current?.value ?? latestTextRef.current;
      return (
        currentText === submittedText &&
        equalStringArray(latestAttachedImagesRef.current, submittedImages) &&
        equalAppMentionBindings(latestAppMentionBindingsRef.current, submittedBindings)
      );
    },
    [textareaRef]
  );
  const finalizeAcceptedDispatch = useCallback(
    (submittedText: string, submittedImages: string[], submittedBindings: AppMentionBinding[]) => {
      if (submittedText) {
        recordHistory(submittedText);
      }
      if (!shouldResetSubmittedDraft(submittedText, submittedImages, submittedBindings)) {
        return;
      }
      resetHistoryNavigation();
      setComposerText("", "immediate");
      setAppMentionBindings([]);
    },
    [recordHistory, resetHistoryNavigation, setComposerText, shouldResetSubmittedDraft]
  );
  const handleSend = useCallback(() => {
    if (disabled) {
      return;
    }
    const trimmed = getCurrentComposerText().trim();
    if (!trimmed && attachedImages.length === 0) {
      return;
    }
    const resolvedMentions = resolveBoundAppMentions(trimmed, appMentionBindings);
    const submittedBindings = [...appMentionBindings];
    const submittedImages = [...attachedImages];
    const sendResult =
      resolvedMentions.length > 0
        ? onSend(trimmed, submittedImages, resolvedMentions)
        : onSend(trimmed, submittedImages);
    if (sendResult === false) {
      return;
    }
    if (isPromiseLike(sendResult)) {
      void Promise.resolve(sendResult)
        .then((result) => {
          if (result === false) {
            return;
          }
          finalizeAcceptedDispatch(trimmed, submittedImages, submittedBindings);
        })
        .catch(() => undefined);
      return;
    }
    finalizeAcceptedDispatch(trimmed, submittedImages, submittedBindings);
  }, [
    appMentionBindings,
    attachedImages,
    disabled,
    finalizeAcceptedDispatch,
    getCurrentComposerText,
    onSend,
  ]);
  const handleQueue = useCallback(() => {
    if (disabled) {
      return;
    }
    const trimmed = getCurrentComposerText().trim();
    if (!trimmed && attachedImages.length === 0) {
      return;
    }
    const resolvedMentions = resolveBoundAppMentions(trimmed, appMentionBindings);
    const submittedBindings = [...appMentionBindings];
    const submittedImages = [...attachedImages];
    const queueResult =
      resolvedMentions.length > 0
        ? onQueue(trimmed, submittedImages, resolvedMentions)
        : onQueue(trimmed, submittedImages);
    if (queueResult === false) {
      return;
    }
    if (isPromiseLike(queueResult)) {
      void Promise.resolve(queueResult)
        .then((result) => {
          if (result === false) {
            return;
          }
          finalizeAcceptedDispatch(trimmed, submittedImages, submittedBindings);
        })
        .catch(() => undefined);
      return;
    }
    finalizeAcceptedDispatch(trimmed, submittedImages, submittedBindings);
  }, [
    appMentionBindings,
    attachedImages,
    disabled,
    finalizeAcceptedDispatch,
    getCurrentComposerText,
    onQueue,
  ]);

  useEffect(() => {
    void historyKey;
    setAppMentionBindings([]);
  }, [historyKey]);

  useEffect(() => {
    if (!prefillDraft) {
      return;
    }
    setComposerText(prefillDraft.text, "immediate");
    setAppMentionBindings(bindingsFromMentions(prefillDraft.appMentions));
    resetHistoryNavigation();
    onPrefillHandled?.(prefillDraft.id);
  }, [
    bindingsFromMentions,
    onPrefillHandled,
    prefillDraft,
    resetHistoryNavigation,
    setComposerText,
  ]);

  useEffect(() => {
    if (!insertText) {
      return;
    }
    setComposerText(insertText.text, "immediate");
    setAppMentionBindings(bindingsFromMentions(insertText.appMentions));
    resetHistoryNavigation();
    onInsertHandled?.(insertText.id);
  }, [bindingsFromMentions, insertText, onInsertHandled, resetHistoryNavigation, setComposerText]);

  const applyTextInsertion = useCallback(
    (nextText: string, nextCursor: number) => {
      setComposerText(nextText);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
        handleSelectionChange(nextCursor);
      });
    },
    [handleSelectionChange, setComposerText, textareaRef]
  );

  const handleTextPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      if (disabled) {
        return;
      }
      if (
        pendingUserInputActive ||
        pendingApprovalActive ||
        pendingToolCallActive ||
        pendingPlanReviewActive
      ) {
        return;
      }
      if (!autoWrapPasteMultiline && !autoWrapPasteCodeLike) {
        return;
      }
      const pasted = event.clipboardData?.getData("text/plain") ?? "";
      if (!pasted) {
        return;
      }
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      const start = textarea.selectionStart ?? text.length;
      const end = textarea.selectionEnd ?? start;
      if (isCursorInsideFence(text, start)) {
        return;
      }
      const normalized = normalizePastedText(pasted);
      if (!normalized) {
        return;
      }
      const isMultiline = normalized.includes("\n");
      if (isMultiline && !autoWrapPasteMultiline) {
        return;
      }
      if (!isMultiline && !(autoWrapPasteCodeLike && isCodeLikeSingleLine(normalized))) {
        return;
      }
      event.preventDefault();
      const indent = getLineIndent(text, start);
      const content = indent
        ? normalized
            .split("\n")
            .map((line) => `${indent}${line}`)
            .join("\n")
        : normalized;
      const before = text.slice(0, start);
      const after = text.slice(end);
      const block = `${indent}\`\`\`\n${content}\n${indent}\`\`\``;
      const nextText = `${before}${block}${after}`;
      const nextCursor = before.length + block.length;
      applyTextInsertion(nextText, nextCursor);
    },
    [
      applyTextInsertion,
      autoWrapPasteCodeLike,
      autoWrapPasteMultiline,
      disabled,
      pendingApprovalActive,
      pendingToolCallActive,
      pendingPlanReviewActive,
      pendingUserInputActive,
      text,
      textareaRef,
    ]
  );

  const tryExpandFence = useCallback(
    (start: number, end: number) => {
      if (start !== end && !fenceWrapSelection) {
        return false;
      }
      const fence = getFenceTriggerLine(text, start, fenceLanguageTags);
      if (!fence) {
        return false;
      }
      const before = text.slice(0, fence.lineStart);
      const after = text.slice(fence.lineEnd);
      const openFence = `${fence.indent}\`\`\`${fence.tag}`;
      const closeFence = `${fence.indent}\`\`\``;
      if (fenceWrapSelection && start !== end) {
        const selection = normalizePastedText(text.slice(start, end));
        const content = fence.indent
          ? selection
              .split("\n")
              .map((line) => `${fence.indent}${line}`)
              .join("\n")
          : selection;
        const block = `${openFence}\n${content}\n${closeFence}`;
        const nextText = `${before}${block}${after}`;
        const nextCursor = before.length + block.length;
        applyTextInsertion(nextText, nextCursor);
        return true;
      }
      const block = `${openFence}\n${fence.indent}\n${closeFence}`;
      const nextText = `${before}${block}${after}`;
      const nextCursor = before.length + openFence.length + 1 + fence.indent.length;
      applyTextInsertion(nextText, nextCursor);
      return true;
    },
    [applyTextInsertion, fenceLanguageTags, fenceWrapSelection, text]
  );
  return (
    <ComposerFrame disabled={disabled} variant={variant}>
      {hasQueuedMessages ? (
        <Suspense fallback={null}>
          <LazyComposerQueue
            queuedMessages={queuedMessages}
            queuePausedReason={queuePausedReason}
            onEditQueued={onEditQueued}
            onDeleteQueued={onDeleteQueued}
          />
        </Suspense>
      ) : null}
      <ComposerInput
        surfaceVariant={variant === "home" ? "launchpad" : "default"}
        text={pendingUserInputActive ? activeAnswerText : text}
        disabled={disabled}
        sendLabel={sendLabel}
        canStop={canStop}
        canSend={canSend}
        canQueue={
          pendingUserInputActive ||
          pendingApprovalActive ||
          pendingToolCallActive ||
          pendingPlanReviewActive
            ? false
            : canQueueInFlight
        }
        isProcessing={isProcessing}
        onStop={onStop}
        onSend={handleSend}
        onQueue={handleQueue}
        attachments={attachedImages}
        onAddAttachment={onPickImages}
        onAttachImages={onAttachImages}
        onRemoveAttachment={onRemoveImage}
        reasoningOptions={reasoningOptions}
        selectedEffort={selectedEffort}
        onSelectEffort={onSelectEffort}
        fastModeEnabled={fastModeEnabled}
        onToggleFastMode={onToggleFastMode}
        reasoningSupported={reasoningSupported}
        onTextChange={handleTextChangeWithHistory}
        onSelectionChange={handleSelectionChange}
        onTextPaste={handleTextPaste}
        onTextBlur={() => flushDraftToParent()}
        isExpanded={editorExpanded}
        skills={skills}
        onKeyDown={(event) => {
          if (isComposingEvent(event)) {
            return;
          }
          if (pendingUserInputActive && activePendingQuestion) {
            const optionCount = activePendingQuestion.options?.length ?? 0;
            const numberShortcut =
              !event.metaKey && !event.ctrlKey && !event.altKey
                ? resolvePendingInputNumberShortcut(optionCount, event.key)
                : null;
            if (numberShortcut !== null) {
              event.preventDefault();
              handlePendingSelect(numberShortcut);
              schedulePendingAdvance(numberShortcut);
              return;
            }
            const arrowShortcut = resolvePendingInputArrowShortcut({
              optionCount,
              key: event.key,
              selectedIndex: activePendingSelectedIndex,
            });
            if (arrowShortcut !== null) {
              event.preventDefault();
              handlePendingSelect(arrowShortcut);
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const textarea = textareaRef.current;
              if (!textarea) {
                return;
              }
              const start = textarea.selectionStart ?? activeAnswerText.length;
              const end = textarea.selectionEnd ?? start;
              const { nextText, nextCursor } = insertComposerLineBreak({
                text: activeAnswerText,
                selectionStart: start,
                selectionEnd: end,
              });
              applyPendingInputTextInsertion({
                nextText,
                nextCursor,
                textarea,
                onAnswerChange: handlePendingAnswerChange,
                onSelectionChange: handleSelectionChange,
              });
              return;
            }
          }
          if (
            (pendingApprovalActive || pendingToolCallActive || pendingPlanReviewActive) &&
            event.key === "Enter" &&
            !event.shiftKey
          ) {
            event.preventDefault();
            const textarea = textareaRef.current;
            if (!textarea) {
              return;
            }
            const start = textarea.selectionStart ?? text.length;
            const end = textarea.selectionEnd ?? start;
            const { nextText, nextCursor } = insertComposerLineBreak({
              text,
              selectionStart: start,
              selectionEnd: end,
            });
            applyTextInsertion(nextText, nextCursor);
            return;
          }
          handleHistoryKeyDown(event);
          if (event.defaultPrevented) {
            return;
          }
          if (
            expandFenceOnSpace &&
            event.key === " " &&
            !event.shiftKey &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.altKey
          ) {
            const textarea = textareaRef.current;
            if (!textarea) {
              return;
            }
            const start = textarea.selectionStart ?? text.length;
            const end = textarea.selectionEnd ?? start;
            if (tryExpandFence(start, end)) {
              event.preventDefault();
              return;
            }
          }
          if (event.key === "Enter" && event.shiftKey) {
            if (continueListOnShiftEnter && !suggestionsOpen) {
              const textarea = textareaRef.current;
              if (textarea) {
                const start = textarea.selectionStart ?? text.length;
                const end = textarea.selectionEnd ?? start;
                if (start === end) {
                  const marker = getListContinuation(text, start);
                  if (marker) {
                    event.preventDefault();
                    const before = text.slice(0, start);
                    const after = text.slice(end);
                    const nextText = `${before}\n${marker}${after}`;
                    const nextCursor = before.length + 1 + marker.length;
                    applyTextInsertion(nextText, nextCursor);
                    return;
                  }
                }
              }
            }
            event.preventDefault();
            const textarea = textareaRef.current;
            if (!textarea) {
              return;
            }
            const start = textarea.selectionStart ?? text.length;
            const end = textarea.selectionEnd ?? start;
            const { nextText, nextCursor } = insertComposerLineBreak({
              text,
              selectionStart: start,
              selectionEnd: end,
            });
            applyTextInsertion(nextText, nextCursor);
            return;
          }
          if (event.key === "Tab" && !event.shiftKey && canQueueInFlight && !suggestionsOpen) {
            event.preventDefault();
            handleQueue();
            return;
          }
          if (reviewPromptOpen && onReviewPromptKeyDown) {
            const handled = onReviewPromptKeyDown(event);
            if (handled) {
              return;
            }
          }
          handleInputKeyDown(event);
          if (event.defaultPrevented) {
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            if (expandFenceOnEnter) {
              const textarea = textareaRef.current;
              if (textarea) {
                const start = textarea.selectionStart ?? text.length;
                const end = textarea.selectionEnd ?? start;
                if (tryExpandFence(start, end)) {
                  event.preventDefault();
                  return;
                }
              }
            }
            event.preventDefault();
            if (isProcessing && !canStop) return;
            const dismissKeyboardAfterSend = canSend && isMobilePlatform();
            handleSend();
            if (dismissKeyboardAfterSend) {
              textareaRef.current?.blur();
            }
          }
        }}
        textareaRef={textareaRef}
        suggestionsOpen={suggestionsOpen}
        suggestions={suggestions}
        highlightIndex={highlightIndex}
        onHighlightIndex={setHighlightIndex}
        onSelectSuggestion={applyAutocomplete}
        suggestionsStyle={suggestionsStyle}
        placeholderText={
          pendingUserInputActive
            ? getPendingInputAnswerPlaceholder(activePendingQuestion)
            : undefined
        }
        reviewPrompt={reviewPrompt}
        onReviewPromptClose={onReviewPromptClose}
        onReviewPromptShowPreset={onReviewPromptShowPreset}
        onReviewPromptChoosePreset={onReviewPromptChoosePreset}
        highlightedPresetIndex={highlightedPresetIndex}
        onReviewPromptHighlightPreset={onReviewPromptHighlightPreset}
        highlightedBranchIndex={highlightedBranchIndex}
        onReviewPromptHighlightBranch={onReviewPromptHighlightBranch}
        highlightedCommitIndex={highlightedCommitIndex}
        onReviewPromptHighlightCommit={onReviewPromptHighlightCommit}
        onReviewPromptSelectBranch={onReviewPromptSelectBranch}
        onReviewPromptSelectBranchAtIndex={onReviewPromptSelectBranchAtIndex}
        onReviewPromptConfirmBranch={onReviewPromptConfirmBranch}
        onReviewPromptSelectCommit={onReviewPromptSelectCommit}
        onReviewPromptSelectCommitAtIndex={onReviewPromptSelectCommitAtIndex}
        onReviewPromptConfirmCommit={onReviewPromptConfirmCommit}
        onReviewPromptUpdateCustomInstructions={onReviewPromptUpdateCustomInstructions}
        onReviewPromptConfirmCustom={onReviewPromptConfirmCustom}
        onReviewPromptKeyDown={onReviewPromptKeyDown}
        topContent={
          renderAutoDriveStatusBar || hasPendingStateChrome ? (
            <>
              {renderAutoDriveStatusBar && autoDrive ? (
                <ComposerAutoDriveStatusBar
                  autoDrive={autoDrive}
                  disabled={disabled}
                  autoDriveBackendLabel={selectedRemoteBackendLabel}
                  visibilityState={autoDriveStatusBarVisibility}
                />
              ) : null}
              {hasPendingStateChrome ? (
                <Suspense fallback={null}>
                  <ComposerPendingPanel>
                    <LazyComposerPendingTopContent
                      pendingUserInputActive={pendingUserInputActive}
                      activePendingQuestion={activePendingQuestion}
                      pendingUserInputRequestIndex={pendingUserInputRequestIndex}
                      pendingUserInputRequestCount={pendingUserInputRequestCount}
                      pendingQuestionIndex={pendingQuestionIndex}
                      pendingQuestions={pendingQuestions}
                      activePendingSelectedIndex={activePendingSelectedIndex}
                      onSelectPendingOption={(index) => {
                        handlePendingSelect(index);
                        schedulePendingAdvance(index);
                      }}
                      onPendingPrevious={handlePendingPrevious}
                      onPendingAdvance={handlePendingAdvance}
                      pendingApprovalActive={pendingApprovalActive}
                      pendingApprovalRequest={pendingApprovalRequest}
                      pendingApprovalCommandTokens={pendingApprovalCommandInfo?.tokens ?? null}
                      onPendingApprovalDecision={onPendingApprovalDecision}
                      onPendingApprovalRemember={onPendingApprovalRemember}
                      pendingToolCallActive={pendingToolCallActive}
                      pendingToolCallRequest={pendingToolCallRequest}
                      pendingToolCallOutput={pendingToolCallOutput}
                      pendingToolCallSuccess={pendingToolCallSuccess}
                      onPendingToolCallOutputChange={setPendingToolCallOutput}
                      onPendingToolCallSuccessChange={setPendingToolCallSuccess}
                      onPendingToolCallSubmit={handlePendingToolCallSubmit}
                      pendingPlanReviewActive={pendingPlanReviewActive}
                      pendingPlanFollowup={pendingPlanFollowup}
                      pendingPlanChanges={pendingPlanChanges}
                      onPendingPlanChangesChange={setPendingPlanChanges}
                      onPendingPlanAccept={handlePendingPlanAccept}
                      onPendingPlanSubmitChanges={handlePendingPlanSubmitChanges}
                    />
                  </ComposerPendingPanel>
                </Suspense>
              ) : null}
            </>
          ) : undefined
        }
        footerActions={
          hasPendingStateChrome ? (
            <Suspense fallback={null}>
              <ComposerActionRail>
                <LazyComposerPendingFooterActions
                  pendingUserInputActive={pendingUserInputActive}
                  activePendingQuestion={activePendingQuestion}
                  pendingUserInputRequestIndex={pendingUserInputRequestIndex}
                  pendingUserInputRequestCount={pendingUserInputRequestCount}
                  pendingQuestionIndex={pendingQuestionIndex}
                  pendingQuestions={pendingQuestions}
                  activePendingSelectedIndex={activePendingSelectedIndex}
                  onSelectPendingOption={(index) => {
                    handlePendingSelect(index);
                    schedulePendingAdvance(index);
                  }}
                  onPendingPrevious={handlePendingPrevious}
                  onPendingAdvance={handlePendingAdvance}
                  pendingApprovalActive={pendingApprovalActive}
                  pendingApprovalRequest={pendingApprovalRequest}
                  pendingApprovalCommandTokens={pendingApprovalCommandInfo?.tokens ?? null}
                  onPendingApprovalDecision={onPendingApprovalDecision}
                  onPendingApprovalRemember={onPendingApprovalRemember}
                  pendingToolCallActive={pendingToolCallActive}
                  pendingToolCallRequest={pendingToolCallRequest}
                  pendingToolCallOutput={pendingToolCallOutput}
                  pendingToolCallSuccess={pendingToolCallSuccess}
                  onPendingToolCallOutputChange={setPendingToolCallOutput}
                  onPendingToolCallSuccessChange={setPendingToolCallSuccess}
                  onPendingToolCallSubmit={handlePendingToolCallSubmit}
                  pendingPlanReviewActive={pendingPlanReviewActive}
                  pendingPlanFollowup={pendingPlanFollowup}
                  pendingPlanChanges={pendingPlanChanges}
                  onPendingPlanChangesChange={setPendingPlanChanges}
                  onPendingPlanAccept={handlePendingPlanAccept}
                  onPendingPlanSubmitChanges={handlePendingPlanSubmitChanges}
                />
              </ComposerActionRail>
            </Suspense>
          ) : undefined
        }
        bottomContent={undefined}
      >
        <ComposerToolbar>
          <ComposerMetaBar
            disabled={disabled}
            collaborationModes={collaborationModes}
            selectedCollaborationModeId={selectedCollaborationModeId}
            onSelectCollaborationMode={onSelectCollaborationMode}
            modelSelectionMode={modelSelectionMode}
            models={models}
            selectedProviderId={selectedProviderId}
            onSelectProvider={onSelectProvider}
            onSelectAutoRoute={onSelectAutoRoute}
            onSelectModelSelectionMode={onSelectModelSelectionMode}
            selectedModelId={selectedModelId}
            onSelectModel={onSelectModel}
            reasoningOptions={reasoningOptions}
            selectedEffort={selectedEffort}
            onSelectEffort={onSelectEffort}
            reasoningSupported={reasoningSupported}
            accessMode={accessMode}
            onSelectAccessMode={onSelectAccessMode}
            executionOptions={executionOptions}
            selectedExecutionMode={selectedExecutionMode}
            onSelectExecutionMode={onSelectExecutionMode}
            remoteBackendOptions={remoteBackendOptions}
            selectedRemoteBackendId={selectedRemoteBackendId}
            onSelectRemoteBackendId={onSelectRemoteBackendId}
            autoDrive={autoDrive}
          />
        </ComposerToolbar>
      </ComposerInput>
      <ComposerWorkspaceBar
        controls={variant === "workspace" ? workspaceControls : null}
        contextUsage={contextUsage}
        accessMode={accessMode}
        onSelectAccessMode={onSelectAccessMode}
        disabled={disabled}
      />
    </ComposerFrame>
  );
});

Composer.displayName = "Composer";
