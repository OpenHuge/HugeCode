import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import {
  Fragment,
  Suspense,
  lazy,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ApprovalRequest,
  ConversationItem,
  DynamicToolCallRequest,
  DynamicToolCallResponse,
  OpenAppTarget,
  RequestUserInputRequest,
  RequestUserInputResponse,
  SkillOption,
} from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import { CoreLoopStatePanel } from "../../../design-system";
import { isPlanReadyTaggedMessage } from "../../../utils/internalPlanReadyMessages";
import { useFileLinkOpener } from "../hooks/useFileLinkOpener";
import { useTimelinePanelsState } from "../hooks/useTimelinePanelsState";
import { useTimelineInspectorSelection } from "../hooks/useTimelineInspectorSelection";
import {
  buildCurrentTurnBreakdownLabels,
  buildToolGroupBreakdownLabels,
  buildToolGroups,
  formatCount,
  formatDurationMs,
  parseReasoning,
  resolveMetaNotice,
  resolveCurrentTurnChromeState,
  resolveCurrentTurnItems,
  resolveCurrentTurnMeta,
  resolveCurrentTurnProjectionFlags,
  SCROLL_THRESHOLD_PX,
  shouldHideInternalToolItem,
  scrollKeyForItems,
  summarizeCurrentTurnActivity,
  summarizeCurrentTurnArtifacts,
  summarizeCurrentTurnProgress,
} from "../utils/messageRenderUtils";
import {
  entryContainsItemId,
  isNarrativeTimelineEntry,
  splitTimelinePresentationEntries,
} from "../utils/messagePresentation";
import {
  buildTimelineArtifactActions,
  type TimelineArtifactAction,
} from "../utils/artifactActions";
import {
  DiffRow,
  ExploreRow,
  MessageRow,
  MetaNoticeRow,
  type DiffRowProps,
  ReasoningRow,
  ReviewRow,
  ToolRow,
  WorkingIndicator,
} from "./MessageRows";
import { TimelineStatusBannerPanel, TimelineTurnDiffPanel } from "./MessageTimelinePanels";
import * as styles from "./Messages.styles.css";
import {
  buildTurnDiffTimelineItem,
  extractTimelineDiffFiles,
  resolveTimelineMessageBanner,
  resolveTimelineStatusBanner,
} from "../utils/timelineSurface";
import { resolveMessagesEmptyState } from "../utils/messagesEmptyState";
import { markFeatureVisible } from "../../shared/featurePerformance";

const loadMessagesDeferredPanels = () => import("./MessagesDeferredPanels");
const DeferredPlanReadyFollowupMessage = lazy(() =>
  loadMessagesDeferredPanels().then((module) => ({
    default: module.DeferredPlanReadyFollowupMessage,
  }))
);
const DeferredRequestUserInputMessage = lazy(() =>
  loadMessagesDeferredPanels().then((module) => ({
    default: module.DeferredRequestUserInputMessage,
  }))
);
const DeferredToolCallRequestMessage = lazy(() =>
  loadMessagesDeferredPanels().then((module) => ({
    default: module.DeferredToolCallRequestMessage,
  }))
);
const DeferredTimelineApprovalPanel = lazy(() =>
  loadMessagesDeferredPanels().then((module) => ({
    default: module.DeferredTimelineApprovalPanel,
  }))
);

type MessagesProps = {
  items: ConversationItem[];
  threadId: string | null;
  activeTurnId?: string | null;
  workspaceId?: string | null;
  skills?: SkillOption[];
  isThinking: boolean;
  isLoadingMessages?: boolean;
  isRestoringThreadHistory?: boolean;
  processingStartedAt?: number | null;
  lastDurationMs?: number | null;
  workspacePath?: string | null;
  openTargets: OpenAppTarget[];
  selectedOpenAppId: string;
  codeBlockCopyUseModifier?: boolean;
  showMessageFilePath?: boolean;
  userInputRequests?: RequestUserInputRequest[];
  approvals?: ApprovalRequest[];
  toolCallRequests?: DynamicToolCallRequest[];
  workspaceLoadError?: string | null;
  onUserInputSubmit?: (
    request: RequestUserInputRequest,
    response: RequestUserInputResponse
  ) => void;
  onApprovalDecision?: (request: ApprovalRequest, decision: "accept" | "decline") => void;
  onApprovalRemember?: (request: ApprovalRequest, command: string[]) => void;
  onToolCallSubmit?: (request: DynamicToolCallRequest, response: DynamicToolCallResponse) => void;
  onPlanAccept?: () => void;
  onPlanSubmitChanges?: (changes: string) => void;
  onOpenSettings?: () => void;
  onRevertAllGitChanges?: () => void | Promise<void>;
  onOpenThreadLink?: (threadId: string) => void;
  onEditMessage?: (item: Extract<ConversationItem, { kind: "message" }>) => void;
  showPollingFetchStatus?: boolean;
  pollingIntervalMs?: number;
  embedActiveUserInputInComposer?: boolean;
  composerApprovalRequestId?: ApprovalRequest["request_id"] | null;
  embedToolCallRequestInComposer?: boolean;
  embedPlanFollowupInComposer?: boolean;
  turnDiff?: string | null;
  enablePrimaryApprovalHotkey?: boolean;
  isPlanModeActive?: boolean;
  showInternalRuntimeDiagnostics?: boolean;
};

type GroupedTimelineEntry = ReturnType<typeof buildToolGroups>[number];

type TimelinePresentationEntry = {
  entry: GroupedTimelineEntry;
  showTurnDivider: boolean;
  anchoredPanels: ReturnType<typeof useTimelinePanelsState>["timelinePanels"];
};

export const Messages = memo(function Messages({
  items,
  threadId,
  activeTurnId = null,
  workspaceId = null,
  skills = [],
  isThinking,
  isLoadingMessages = false,
  isRestoringThreadHistory = false,
  processingStartedAt = null,
  lastDurationMs = null,
  workspacePath = null,
  openTargets,
  selectedOpenAppId,
  codeBlockCopyUseModifier = false,
  showMessageFilePath = true,
  userInputRequests = [],
  approvals = [],
  toolCallRequests = [],
  workspaceLoadError = null,
  onUserInputSubmit,
  onApprovalDecision,
  onApprovalRemember,
  onToolCallSubmit,
  onPlanAccept,
  onPlanSubmitChanges,
  onOpenSettings,
  onRevertAllGitChanges,
  onOpenThreadLink,
  onEditMessage,
  showPollingFetchStatus = false,
  pollingIntervalMs = 12_000,
  embedActiveUserInputInComposer = false,
  composerApprovalRequestId = null,
  embedToolCallRequestInComposer = false,
  embedPlanFollowupInComposer = false,
  turnDiff = null,
  enablePrimaryApprovalHotkey = true,
  isPlanModeActive = false,
  showInternalRuntimeDiagnostics = false,
}: MessagesProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const settledThreadIdsRef = useRef<Record<string, boolean>>({});
  const previousThreadIdRef = useRef<string | null>(threadId);
  const lastSeenItemCountRef = useRef(items.length);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [pendingUpdateCount, setPendingUpdateCount] = useState(0);
  const manuallyToggledExpandedRef = useRef<Set<string>>(new Set());
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const baseScrollKey = `${scrollKeyForItems(items)}-${turnDiff ? "with-diff" : "no-diff"}-${
    workspaceLoadError ? "with-status" : "no-status"
  }`;
  const { openFileLink, showFileLinkMenu } = useFileLinkOpener(
    workspacePath,
    openTargets,
    selectedOpenAppId
  );
  const renderTimelineLane = (node: ReactNode, key?: string) => (
    <div key={key} className={styles.timelineLane}>
      {node}
    </div>
  );
  const { getSelectionProps } = useTimelineInspectorSelection();
  const isNearBottom = useCallback(
    (node: HTMLDivElement) =>
      node.scrollHeight - node.scrollTop - node.clientHeight <= SCROLL_THRESHOLD_PX,
    []
  );
  const markUpdatesAsSeen = useCallback((itemCount: number) => {
    lastSeenItemCountRef.current = itemCount;
    setPendingUpdateCount(0);
  }, []);
  const updateAutoScroll = useCallback(() => {
    if (isRestoringThreadHistory || (isLoadingMessages && items.length === 0)) return;
    const container = containerRef.current;
    if (!container) return;
    const nearBottom = isNearBottom(container);
    autoScrollRef.current = nearBottom;
    setIsPinnedToBottom(nearBottom);
    if (nearBottom) {
      markUpdatesAsSeen(items.length);
      return;
    }
    setPendingUpdateCount(Math.max(0, items.length - lastSeenItemCountRef.current));
  }, [isLoadingMessages, isNearBottom, isRestoringThreadHistory, items.length, markUpdatesAsSeen]);
  const requestAutoScroll = useCallback(() => {
    const container = containerRef.current;
    const shouldScroll = autoScrollRef.current || (container ? isNearBottom(container) : true);
    if (!shouldScroll) {
      return;
    }
    if (container) {
      container.scrollTop = container.scrollHeight;
      autoScrollRef.current = true;
      setIsPinnedToBottom(true);
      markUpdatesAsSeen(items.length);
      return;
    }
    bottomRef.current?.scrollIntoView({ block: "end" });
    autoScrollRef.current = true;
    setIsPinnedToBottom(true);
    markUpdatesAsSeen(items.length);
  }, [isNearBottom, items.length, markUpdatesAsSeen]);

  useLayoutEffect(() => {
    if (previousThreadIdRef.current === threadId) {
      return;
    }
    previousThreadIdRef.current = threadId;
    setCopiedItemId(null);
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
    autoScrollRef.current = true;
    setIsPinnedToBottom(true);
    markUpdatesAsSeen(items.length);
  }, [items.length, markUpdatesAsSeen, threadId]);
  const reasoningMetaById = useMemo(() => {
    const meta = new Map<string, ReturnType<typeof parseReasoning>>();
    items.forEach((item) => {
      if (item.kind === "reasoning") {
        meta.set(item.id, parseReasoning(item));
      }
    });
    return meta;
  }, [items]);
  const lastUserMessageIndex = useMemo(() => {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item.kind === "message" && item.role === "user") {
        return index;
      }
    }
    return -1;
  }, [items]);
  const latestReasoningLabel = useMemo(() => {
    for (let index = items.length - 1; index > lastUserMessageIndex; index -= 1) {
      const item = items[index];
      if (item.kind !== "reasoning") {
        continue;
      }
      const parsed = reasoningMetaById.get(item.id);
      if (parsed?.workingLabel) {
        return parsed.workingLabel;
      }
    }
    return null;
  }, [items, lastUserMessageIndex, reasoningMetaById]);

  const visibleItems = useMemo(
    () =>
      items.filter((item, index) => {
        if (
          item.kind === "message" &&
          item.role === "user" &&
          isPlanReadyTaggedMessage(item.text)
        ) {
          return false;
        }
        if (item.kind !== "reasoning") {
          return !shouldHideInternalToolItem(item, {
            isPlanModeActive,
            showInternalRuntimeDiagnostics,
          });
        }
        const parsed = reasoningMetaById.get(item.id);
        if (parsed?.hasBody) {
          return true;
        }
        return index > lastUserMessageIndex;
      }),
    [
      isPlanModeActive,
      items,
      lastUserMessageIndex,
      reasoningMetaById,
      showInternalRuntimeDiagnostics,
    ]
  );
  const turnDiffItem = useMemo(
    () => buildTurnDiffTimelineItem(threadId, turnDiff),
    [threadId, turnDiff]
  );
  const turnDiffFiles = turnDiffItem ? extractTimelineDiffFiles(turnDiffItem.diff) : [];
  const visibleTimelineItems = turnDiffItem ? [...visibleItems, turnDiffItem] : visibleItems;
  const timelineStatusBanner = useMemo(
    () => resolveTimelineStatusBanner(workspaceLoadError),
    [workspaceLoadError]
  );

  const visibleItemIndexById = useMemo(() => {
    const indexById = new Map<string, number>();
    visibleItems.forEach((item, index) => {
      indexById.set(item.id, index);
    });
    return indexById;
  }, [visibleItems]);

  const currentTurnMeta = useMemo(
    () => resolveCurrentTurnMeta(items, lastUserMessageIndex, visibleItemIndexById),
    [items, lastUserMessageIndex, visibleItemIndexById]
  );

  useEffect(() => {
    const frameHandle = window.requestAnimationFrame(() => {
      markFeatureVisible("messages_timeline");
    });
    return () => {
      window.cancelAnimationFrame(frameHandle);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isPinnedToBottom) {
      return;
    }
    setPendingUpdateCount(Math.max(0, items.length - lastSeenItemCountRef.current));
  }, [isPinnedToBottom, items.length]);
  const copyTextToClipboard = useCallback(async (itemId: string, value: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopiedItemId(itemId);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedItemId(null);
      }, 1200);
    } catch {
      // No-op: clipboard errors can occur in restricted contexts.
    }
  }, []);
  const handleCopyMessage = useCallback(
    async (item: Extract<ConversationItem, { kind: "message" }>) => {
      await copyTextToClipboard(item.id, item.text);
    },
    [copyTextToClipboard]
  );
  const handleCopyTool = useCallback(
    async (itemId: string, text: string) => {
      await copyTextToClipboard(itemId, text);
    },
    [copyTextToClipboard]
  );

  const handleJumpToLatest = useCallback(() => {
    autoScrollRef.current = true;
    requestAutoScroll();
  }, [requestAutoScroll]);
  const currentTurnProgress = useMemo(
    () =>
      summarizeCurrentTurnProgress(items, currentTurnMeta.lastUserMessageIndex, {
        isPlanModeActive,
        showInternalRuntimeDiagnostics,
      }),
    [currentTurnMeta.lastUserMessageIndex, isPlanModeActive, items, showInternalRuntimeDiagnostics]
  );

  const currentTurnItems = useMemo(
    () =>
      resolveCurrentTurnItems({
        items,
        lastUserMessageIndex: currentTurnMeta.lastUserMessageIndex,
        isThinking,
        lastDurationMs,
        isPlanModeActive,
        showInternalRuntimeDiagnostics,
      }),
    [
      currentTurnMeta.lastUserMessageIndex,
      isPlanModeActive,
      isThinking,
      items,
      lastDurationMs,
      showInternalRuntimeDiagnostics,
    ]
  );
  const currentTurnTerminalItemId = useMemo(() => {
    if (turnDiffItem) {
      return turnDiffItem.id;
    }
    for (let index = currentTurnItems.length - 1; index >= 0; index -= 1) {
      const item = currentTurnItems[index];
      if (visibleItemIndexById.has(item.id)) {
        return item.id;
      }
    }
    return visibleTimelineItems[visibleTimelineItems.length - 1]?.id ?? null;
  }, [currentTurnItems, turnDiffItem, visibleItemIndexById, visibleTimelineItems]);
  const currentTurnActivity = useMemo(
    () => summarizeCurrentTurnActivity(currentTurnItems, isThinking),
    [currentTurnItems, isThinking]
  );
  const currentTurnArtifacts = useMemo(() => {
    const summary = summarizeCurrentTurnArtifacts(currentTurnItems);
    if (turnDiffItem && summary.diffCount === 0) {
      return {
        ...summary,
        diffCount: 1,
      };
    }
    return summary;
  }, [currentTurnItems, turnDiffItem]);
  const currentTurnPrimaryLabel = latestReasoningLabel ?? currentTurnActivity?.label ?? null;
  const currentTurnSecondaryDetail = useMemo(() => {
    if (!currentTurnActivity) {
      return null;
    }
    if (!latestReasoningLabel || currentTurnActivity.label === latestReasoningLabel) {
      return currentTurnActivity.detail;
    }
    return [currentTurnActivity.label, currentTurnActivity.detail].filter(Boolean).join(" · ");
  }, [currentTurnActivity, latestReasoningLabel]);
  const emptyState = resolveMessagesEmptyState({ threadId, isRestoringThreadHistory });

  const scrollToTimelineArtifact = useCallback((itemId: string) => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const target = [...container.querySelectorAll<HTMLElement>("[data-timeline-item-id]")].find(
      (candidate) => candidate.dataset.timelineItemId === itemId
    );
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);
  const groupedItems = useMemo(() => buildToolGroups(visibleTimelineItems), [visibleTimelineItems]);
  const hasCurrentTurnPresentationSeed =
    currentTurnItems.length > 0 || isThinking || lastDurationMs !== null;
  const turnStartId = useMemo(() => {
    if (!hasCurrentTurnPresentationSeed || currentTurnMeta.lastUserMessageIndex < 0) {
      return currentTurnMeta.currentTurnStartVisibleItemId;
    }
    const lastUserItem = items[currentTurnMeta.lastUserMessageIndex];
    if (lastUserItem && visibleItemIndexById.has(lastUserItem.id)) {
      return lastUserItem.id;
    }
    return currentTurnMeta.currentTurnStartVisibleItemId;
  }, [
    currentTurnItems.length,
    currentTurnMeta.currentTurnStartVisibleItemId,
    currentTurnMeta.lastUserMessageIndex,
    hasCurrentTurnPresentationSeed,
    isThinking,
    items,
    lastDurationMs,
    visibleItemIndexById,
  ]);
  const dividerMetaLabel = isThinking ? currentTurnPrimaryLabel : null;
  const toolGroupIdByItemId = useMemo(() => {
    const groupByItemId = new Map<string, string>();
    groupedItems.forEach((entry) => {
      if (entry.kind !== "toolGroup") {
        return;
      }
      entry.group.items.forEach((item) => {
        groupByItemId.set(item.id, entry.group.id);
      });
    });
    return groupByItemId;
  }, [groupedItems]);
  const currentTurnArtifactActions = useMemo<TimelineArtifactAction[]>(
    () =>
      buildTimelineArtifactActions({
        items: currentTurnItems,
        artifactSummary: currentTurnArtifacts,
        turnDiffItem,
      }),
    [currentTurnArtifacts, currentTurnItems, turnDiffItem]
  );
  const {
    hasNoVisibleResponse: currentTurnHasNoVisibleResponse,
    hasTerminalFailure: currentTurnHasTerminalFailure,
    hasRunningToolChrome: currentTurnHasRunningToolChrome,
    hasProjectedItems: currentTurnHasProjectedItems,
    hasActiveTurn: currentTurnHasActiveTurn,
    hasToolOnlyCompletion: currentTurnHasToolOnlyCompletion,
    showCompleteFooter: showCurrentTurnCompleteFooter,
    shouldHoldWorkingState: shouldHoldCurrentTurnInWorkingState,
  } = useMemo(
    () => resolveCurrentTurnProjectionFlags({ items: currentTurnItems, activeTurnId, isThinking }),
    [activeTurnId, currentTurnItems, isThinking]
  );
  const groupedItemsWithTurnDivider = useMemo(() => {
    if (!hasCurrentTurnPresentationSeed) {
      return groupedItems.map((entry) => ({ entry, showTurnDivider: false }));
    }
    let dividerInserted = false;
    return groupedItems.map((entry) => {
      if (!turnStartId || dividerInserted) {
        return { entry, showTurnDivider: false };
      }
      if (entryContainsItemId(entry, turnStartId)) {
        dividerInserted = true;
        return { entry, showTurnDivider: true };
      }
      return { entry, showTurnDivider: false };
    });
  }, [groupedItems, hasCurrentTurnPresentationSeed, turnStartId]);
  const timelinePanelsState = useTimelinePanelsState({
    items,
    threadId,
    workspaceId,
    isThinking,
    userInputRequests,
    approvals,
    toolCallRequests,
    currentTurnTerminalItemId,
    visibleTimelineItemIds: visibleTimelineItems.map((item) => item.id),
    onUserInputSubmit,
    onApprovalDecision,
    onPlanAccept,
    onPlanSubmitChanges,
    onToolCallSubmit,
    composerApprovalRequestId,
    embedActiveUserInputInComposer,
    embedToolCallRequestInComposer,
    embedPlanFollowupInComposer,
    enablePrimaryApprovalHotkey,
  });
  const {
    expandedItems,
    collapsedToolGroups,
    activeUserInputRequests,
    activeUserInputRequestId,
    activeToolCallRequests,
    activeToolCallRequestId,
    timelineApprovals,
    timelinePanels,
    trailingTimelinePanels,
    toggleExpanded,
    ensureExpanded,
    toggleToolGroup,
    dismissPlanFollowup,
  } = timelinePanelsState;
  const timelinePresentationEntries = useMemo<TimelinePresentationEntry[]>(
    () =>
      groupedItemsWithTurnDivider.map(({ entry, showTurnDivider }) => ({
        entry,
        showTurnDivider,
        anchoredPanels: timelinePanels.filter(
          (panel) => panel.anchorItemId && entryContainsItemId(entry, panel.anchorItemId)
        ),
      })),
    [groupedItemsWithTurnDivider, timelinePanels]
  );
  const { historyPresentationEntries, currentTurnPresentationEntries } = useMemo(
    () => splitTimelinePresentationEntries(timelinePresentationEntries),
    [timelinePresentationEntries]
  );
  const handleToggleExpanded = useCallback(
    (id: string) => {
      manuallyToggledExpandedRef.current.add(id);
      toggleExpanded(id);
    },
    [toggleExpanded]
  );
  const scrollKey = `${baseScrollKey}-${activeUserInputRequestId ?? "no-input"}-${
    activeToolCallRequestId ?? "no-tool-call"
  }-${timelineApprovals.length}`;
  const scrollSignal = `${scrollKey}-${expandedItems.size}-${collapsedToolGroups.size}-${
    isThinking ? "thinking" : "idle"
  }-${threadId ?? "none"}`;
  useEffect(() => {
    for (let index = visibleItems.length - 1; index >= 0; index -= 1) {
      const item = visibleItems[index];
      if (
        item.kind === "tool" &&
        item.toolType === "plan" &&
        (item.output ?? "").trim().length > 0
      ) {
        if (manuallyToggledExpandedRef.current.has(item.id)) {
          return;
        }
        ensureExpanded(item.id);
        return;
      }
    }
  }, [ensureExpanded, visibleItems]);
  useLayoutEffect(() => {
    if (!scrollSignal) {
      return;
    }
    const container = containerRef.current;
    const shouldScroll = autoScrollRef.current || (container ? isNearBottom(container) : true);
    if (!shouldScroll) {
      setIsPinnedToBottom(false);
      setPendingUpdateCount(Math.max(0, items.length - lastSeenItemCountRef.current));
      return;
    }
    if (container) {
      container.scrollTop = container.scrollHeight;
    } else {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
    autoScrollRef.current = true;
    setIsPinnedToBottom(true);
    markUpdatesAsSeen(items.length);
  }, [isNearBottom, items.length, markUpdatesAsSeen, scrollSignal]);
  useEffect(() => {
    if (!threadId) return;
    const wasSettled = settledThreadIdsRef.current[threadId] === true;
    if (items.length === 0 && isLoadingMessages) return;
    settledThreadIdsRef.current[threadId] = true;
    if (!wasSettled && items.length > 0) {
      autoScrollRef.current = true;
      requestAnimationFrame(() => requestAutoScroll());
    }
  }, [isLoadingMessages, items.length, requestAutoScroll, threadId]);

  const shouldShowInitialThreadLoadingState =
    isRestoringThreadHistory ||
    (isLoadingMessages && (!threadId || !settledThreadIdsRef.current[threadId]));
  const hasTimelineFollowups = timelinePanels.length > 0;
  const { footerKind: currentTurnFooterKind, diagnosticState: currentTurnDiagnosticState } =
    useMemo(
      () =>
        resolveCurrentTurnChromeState({
          isThinking: isThinking || shouldHoldCurrentTurnInWorkingState,
          hasTerminalFailure: currentTurnHasTerminalFailure,
          hasNoVisibleResponse: currentTurnHasNoVisibleResponse,
          hasToolOnlyCompletion: currentTurnHasToolOnlyCompletion,
          hasTimelineFollowups,
          lastDurationMs,
          showCompleteFooter: showCurrentTurnCompleteFooter,
          hasProjectedItems: currentTurnHasProjectedItems,
        }),
      [
        currentTurnHasNoVisibleResponse,
        currentTurnHasActiveTurn,
        currentTurnHasProjectedItems,
        currentTurnHasTerminalFailure,
        currentTurnHasToolOnlyCompletion,
        hasTimelineFollowups,
        isThinking,
        lastDurationMs,
        showCurrentTurnCompleteFooter,
        shouldHoldCurrentTurnInWorkingState,
      ]
    );
  const lastItem = items[items.length - 1];
  const endsWithUserMessage = lastItem?.kind === "message" && lastItem.role === "user";
  const currentTurnCompletedWithoutVisibleOutput =
    currentTurnDiagnosticState === "empty" && lastDurationMs !== null && endsWithUserMessage;
  const shouldRenderCurrentTurnFooter =
    showCurrentTurnCompleteFooter &&
    lastDurationMs !== null &&
    (currentTurnHasNoVisibleResponse ||
      currentTurnCompletedWithoutVisibleOutput ||
      showPollingFetchStatus ||
      currentTurnArtifactActions.length > 0);
  const showJumpToLatest = !isPinnedToBottom && (isThinking || items.length > 0);
  const hasMessageStageContent =
    Boolean(timelineStatusBanner) ||
    groupedItemsWithTurnDivider.length > 0 ||
    trailingTimelinePanels.length > 0 ||
    isThinking ||
    shouldHoldCurrentTurnInWorkingState ||
    currentTurnCompletedWithoutVisibleOutput ||
    (showCurrentTurnCompleteFooter && lastDurationMs !== null && currentTurnHasProjectedItems);

  const renderItem = (item: ConversationItem) => {
    const metaNotice = resolveMetaNotice(item);
    if (metaNotice && (item.kind === "message" || item.kind === "tool")) {
      const selection = getSelectionProps(item.kind, item.id);
      return (
        <MetaNoticeRow
          key={item.id}
          itemId={item.id}
          notice={metaNotice}
          isSelected={selection.isSelected}
          onSelect={selection.onSelect}
        />
      );
    }
    if (item.kind === "message") {
      const timelineMessageBanner =
        item.role === "assistant" ? resolveTimelineMessageBanner(item) : null;
      if (timelineMessageBanner) {
        return (
          <TimelineStatusBannerPanel
            key={item.id}
            banner={timelineMessageBanner}
            onAction={timelineMessageBanner.actionLabel ? onOpenSettings : undefined}
          />
        );
      }
      const isCopied = copiedItemId === item.id;
      return (
        <MessageRow
          key={item.id}
          item={item}
          isCopied={isCopied}
          onCopy={handleCopyMessage}
          onEdit={onEditMessage}
          codeBlockCopyUseModifier={codeBlockCopyUseModifier}
          {...getSelectionProps("message", item.id)}
          skills={skills}
          showMessageFilePath={showMessageFilePath}
          workspacePath={workspacePath}
          onOpenFileLink={openFileLink}
          onOpenFileLinkMenu={showFileLinkMenu}
          onOpenThreadLink={onOpenThreadLink}
        />
      );
    }
    if (item.kind === "reasoning") {
      const isExpanded = expandedItems.has(item.id);
      const parsed = reasoningMetaById.get(item.id) ?? parseReasoning(item);
      return (
        <ReasoningRow
          key={item.id}
          item={item}
          parsed={parsed}
          isExpanded={isExpanded}
          onToggle={handleToggleExpanded}
          {...getSelectionProps("reasoning", item.id)}
          skills={skills}
          showMessageFilePath={showMessageFilePath}
          workspacePath={workspacePath}
          onOpenFileLink={openFileLink}
          onOpenFileLinkMenu={showFileLinkMenu}
          onOpenThreadLink={onOpenThreadLink}
        />
      );
    }
    if (item.kind === "review") {
      return (
        <ReviewRow
          key={item.id}
          item={item}
          {...getSelectionProps("review", item.id)}
          skills={skills}
          showMessageFilePath={showMessageFilePath}
          workspacePath={workspacePath}
          onOpenFileLink={openFileLink}
          onOpenFileLinkMenu={showFileLinkMenu}
          onOpenThreadLink={onOpenThreadLink}
        />
      );
    }
    if (item.kind === "diff") {
      if (item.id === turnDiffItem?.id) {
        return (
          <TimelineTurnDiffPanel
            key={item.id}
            itemId={item.id}
            diff={item.diff}
            files={turnDiffFiles}
            onRevertAllChanges={onRevertAllGitChanges}
          />
        );
      }
      const diffRowProps: DiffRowProps = {
        item,
        forceExpanded: expandedItems.has(item.id),
        onRevertAllChanges: item.id === turnDiffItem?.id ? onRevertAllGitChanges : undefined,
        ...getSelectionProps("diff", item.id),
      };
      return <DiffRow key={item.id} {...diffRowProps} />;
    }
    if (item.kind === "tool") {
      const isExpanded = expandedItems.has(item.id);
      const isCopied = copiedItemId === item.id;
      return (
        <ToolRow
          key={item.id}
          item={item}
          isExpanded={isExpanded}
          isCopied={isCopied}
          onToggle={handleToggleExpanded}
          onCopy={handleCopyTool}
          {...getSelectionProps("tool", item.id)}
          skills={skills}
          showMessageFilePath={showMessageFilePath}
          workspacePath={workspacePath}
          onOpenFileLink={openFileLink}
          onOpenFileLinkMenu={showFileLinkMenu}
          onOpenThreadLink={onOpenThreadLink}
          onRequestAutoScroll={requestAutoScroll}
        />
      );
    }
    if (item.kind === "explore") {
      return <ExploreRow key={item.id} item={item} {...getSelectionProps("explore", item.id)} />;
    }
    return null;
  };
  const renderTimelinePanel = useCallback(
    (panel: ReturnType<typeof useTimelinePanelsState>["timelinePanels"][number]) => {
      if (panel.kind === "approval" && onApprovalDecision) {
        return renderTimelineLane(
          <Suspense fallback={null}>
            <DeferredTimelineApprovalPanel
              request={panel.request}
              onDecision={onApprovalDecision}
              onRemember={onApprovalRemember}
              isPrimary={panel.isPrimary}
              enablePrimaryHotkey={enablePrimaryApprovalHotkey}
              interactive={panel.interactive}
            />
          </Suspense>,
          panel.key
        );
      }
      if (panel.kind === "plan_followup" && onPlanAccept && onPlanSubmitChanges) {
        return renderTimelineLane(
          <Suspense fallback={null}>
            <DeferredPlanReadyFollowupMessage
              artifact={panel.artifact}
              interactive={panel.interactive}
              onAccept={() => {
                dismissPlanFollowup(panel.artifact.planItemId);
                onPlanAccept();
              }}
            />
          </Suspense>,
          panel.key
        );
      }
      if (panel.kind === "tool_call_request" && onToolCallSubmit) {
        return renderTimelineLane(
          <Suspense fallback={null}>
            <DeferredToolCallRequestMessage
              requests={activeToolCallRequests}
              activeThreadId={threadId}
              activeWorkspaceId={workspaceId}
              onSubmit={onToolCallSubmit}
              interactive={panel.interactive}
            />
          </Suspense>,
          panel.key
        );
      }
      if (panel.kind === "user_input_request" && onUserInputSubmit) {
        return renderTimelineLane(
          <Suspense fallback={null}>
            <DeferredRequestUserInputMessage
              requests={activeUserInputRequests}
              activeThreadId={threadId}
              activeWorkspaceId={workspaceId}
              onSubmit={onUserInputSubmit}
              interactive={panel.interactive}
            />
          </Suspense>,
          panel.key
        );
      }
      return null;
    },
    [
      activeToolCallRequests,
      activeUserInputRequests,
      dismissPlanFollowup,
      enablePrimaryApprovalHotkey,
      onApprovalDecision,
      onApprovalRemember,
      onPlanAccept,
      onPlanSubmitChanges,
      onToolCallSubmit,
      onUserInputSubmit,
      threadId,
      workspaceId,
    ]
  );
  const currentTurnExecutionSummaryLabels = useMemo(() => {
    const labels = buildCurrentTurnBreakdownLabels(currentTurnProgress);
    if (currentTurnArtifacts.reviewCount > 0 && !labels.some((label) => label.includes("review"))) {
      labels.push(formatCount(currentTurnArtifacts.reviewCount, "review", "reviews"));
    }
    if (currentTurnArtifacts.diffCount > 0 && !labels.some((label) => label.includes("diff"))) {
      labels.push(formatCount(currentTurnArtifacts.diffCount, "diff", "diffs"));
    }
    if (
      currentTurnArtifacts.changedFiles.length > 0 &&
      !labels.some((label) => label.includes("file"))
    ) {
      labels.push(
        formatCount(currentTurnArtifacts.changedFiles.length, "file changed", "files changed")
      );
    }
    if (labels.length === 0 && currentTurnProgress.updates > 0) {
      labels.push(formatCount(currentTurnProgress.updates, "update", "updates"));
    }
    return labels;
  }, [currentTurnArtifacts, currentTurnProgress]);
  const currentTurnHasSection =
    currentTurnPresentationEntries.length > 0 ||
    currentTurnHasProjectedItems ||
    isThinking ||
    shouldHoldCurrentTurnInWorkingState ||
    currentTurnCompletedWithoutVisibleOutput;
  const currentTurnNarrativeEntries = currentTurnPresentationEntries.filter((presentationEntry) =>
    isNarrativeTimelineEntry(presentationEntry.entry)
  );
  const currentTurnExecutionEntries = currentTurnPresentationEntries.filter(
    (presentationEntry) => !isNarrativeTimelineEntry(presentationEntry.entry)
  );
  const currentTurnHasNarrativeContent = currentTurnNarrativeEntries.length > 0;
  const currentTurnHasExecutionContent =
    currentTurnExecutionSummaryLabels.length > 0 ||
    currentTurnExecutionEntries.length > 0 ||
    currentTurnNarrativeEntries.some(
      (presentationEntry) => presentationEntry.anchoredPanels.length > 0
    );
  const renderPresentationEntry = (presentationEntry: TimelinePresentationEntry) => {
    const { entry } = presentationEntry;
    if (entry.kind === "toolGroup") {
      const { group } = entry;
      const isCollapsed = collapsedToolGroups.has(group.id);
      const breakdownLabels = buildToolGroupBreakdownLabels(group);
      const summaryParts = (
        breakdownLabels.length > 0
          ? breakdownLabels
          : [formatCount(group.updateCount, "update", "updates")]
      ).map((value, index) => ({
        value,
        emphasis: index === 0 ? "primary" : "secondary",
      }));
      const summaryAriaLabel = summaryParts.map((part) => part.value).join(", ");
      const groupBodyId = `tool-group-${group.id}`;
      const ChevronIcon = isCollapsed ? ChevronDown : ChevronUp;
      return (
        <div
          key={`tool-group-${group.id}`}
          className={joinClassNames(
            styles.toolGroup,
            isCollapsed ? styles.toolGroupCollapsed : null
          )}
        >
          <div className={styles.toolGroupHeader}>
            <button
              type="button"
              className={styles.toolGroupToggle}
              onClick={() => toggleToolGroup(group.id)}
              aria-expanded={!isCollapsed}
              aria-controls={groupBodyId}
              aria-label={`${
                isCollapsed ? "Expand tool group" : "Collapse tool group"
              }: ${summaryAriaLabel}`}
            >
              <span className={styles.toolGroupChevron} aria-hidden>
                <ChevronIcon size={14} />
              </span>
              <span className={styles.toolGroupSummary}>
                {summaryParts.map((part) => (
                  <span
                    key={`${part.emphasis}-${part.value}`}
                    className={joinClassNames(
                      styles.toolGroupSummaryChip,
                      part.emphasis === "primary" ? styles.statePrimary : null
                    )}
                  >
                    {part.value}
                  </span>
                ))}
              </span>
            </button>
          </div>
          {!isCollapsed && (
            <div className={styles.toolGroupBody} id={groupBodyId}>
              {group.items.map(renderItem)}
            </div>
          )}
        </div>
      );
    }
    return <Fragment key={entry.item.id}>{renderItem(entry.item)}</Fragment>;
  };
  return (
    <div
      className={joinClassNames(styles.messages, "messages", styles.messagesFull, "messages-full")}
      ref={containerRef}
      onScroll={updateAutoScroll}
      data-testid="messages-root"
      data-thread-id={threadId ?? ""}
      data-thread-item-count={items.length}
      data-current-turn-item-count={currentTurnItems.length}
      data-current-turn-has-items={currentTurnHasProjectedItems ? "true" : "false"}
      data-current-turn-has-active-turn={currentTurnHasActiveTurn ? "true" : "false"}
      data-current-turn-has-running-tool={currentTurnHasRunningToolChrome ? "true" : "false"}
      data-current-turn-has-terminal-failure={currentTurnHasTerminalFailure ? "true" : "false"}
      data-current-turn-has-no-visible-response={currentTurnHasNoVisibleResponse ? "true" : "false"}
      data-current-turn-state={currentTurnDiagnosticState}
      data-thread-history-loading={isLoadingMessages || isRestoringThreadHistory ? "true" : "false"}
    >
      {hasMessageStageContent ? (
        <div className={styles.messagesStage}>
          {timelineStatusBanner
            ? renderTimelineLane(
                <TimelineStatusBannerPanel
                  banner={timelineStatusBanner}
                  onAction={onOpenSettings}
                />
              )
            : null}
          {historyPresentationEntries.map((presentationEntry) => (
            <Fragment
              key={
                presentationEntry.entry.kind === "toolGroup"
                  ? `history-${presentationEntry.entry.group.id}`
                  : `history-${presentationEntry.entry.item.id}`
              }
            >
              {renderTimelineLane(renderPresentationEntry(presentationEntry))}
              {presentationEntry.anchoredPanels.map(renderTimelinePanel)}
            </Fragment>
          ))}
          {currentTurnHasSection
            ? renderTimelineLane(
                <section
                  className={styles.currentTurnPanel}
                  data-testid="current-turn-panel"
                  data-current-turn-state={currentTurnDiagnosticState}
                >
                  {historyPresentationEntries.length > 0 ? (
                    <div
                      className={styles.messagesCurrentTurnDivider}
                      data-testid="current-turn-divider"
                    >
                      <span className={styles.messagesCurrentTurnDividerLine} aria-hidden />
                      <span className={styles.messagesCurrentTurnDividerChip}>Current turn</span>
                      {dividerMetaLabel && (
                        <span className={styles.messagesCurrentTurnDividerMeta}>
                          {dividerMetaLabel}
                        </span>
                      )}
                      <span className={styles.messagesCurrentTurnDividerLine} aria-hidden />
                    </div>
                  ) : null}
                  <div className={styles.currentTurnBody}>
                    {currentTurnHasNarrativeContent ? (
                      <div
                        className={styles.currentTurnNarrativeRail}
                        data-testid="current-turn-narrative-rail"
                      >
                        {currentTurnNarrativeEntries.length > 0
                          ? currentTurnNarrativeEntries.map(renderPresentationEntry)
                          : null}
                      </div>
                    ) : null}
                    {currentTurnHasExecutionContent ? (
                      <div
                        className={styles.currentTurnExecutionRail}
                        data-testid="current-turn-execution-rail"
                      >
                        {currentTurnExecutionSummaryLabels.length > 0 ? (
                          <div
                            className={styles.currentTurnExecutionSummary}
                            data-testid="current-turn-execution-summary"
                          >
                            {currentTurnExecutionSummaryLabels.map((label, index) => (
                              <span
                                key={`${label}-${index}`}
                                className={joinClassNames(
                                  styles.toolGroupSummaryChip,
                                  index === 0 ? styles.statePrimary : null
                                )}
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {currentTurnExecutionEntries.map((presentationEntry) => (
                          <Fragment
                            key={
                              presentationEntry.entry.kind === "toolGroup"
                                ? `current-execution-${presentationEntry.entry.group.id}`
                                : `current-execution-${presentationEntry.entry.item.id}`
                            }
                          >
                            {renderPresentationEntry(presentationEntry)}
                            {presentationEntry.anchoredPanels.map(renderTimelinePanel)}
                          </Fragment>
                        ))}
                        {currentTurnNarrativeEntries.flatMap((presentationEntry) =>
                          presentationEntry.anchoredPanels.map(renderTimelinePanel)
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.currentTurnFooterDock}>
                    <WorkingIndicator
                      isThinking={isThinking || shouldHoldCurrentTurnInWorkingState}
                      processingStartedAt={processingStartedAt}
                      lastDurationMs={lastDurationMs}
                      hasItems={
                        currentTurnHasProjectedItems || currentTurnCompletedWithoutVisibleOutput
                      }
                      showTurnComplete={shouldRenderCurrentTurnFooter}
                      turnCompleteStatusLabel={
                        currentTurnHasNoVisibleResponse || currentTurnCompletedWithoutVisibleOutput
                          ? "No visible response"
                          : null
                      }
                      turnCompleteDurationLabel={
                        (currentTurnHasNoVisibleResponse ||
                          currentTurnCompletedWithoutVisibleOutput) &&
                        lastDurationMs !== null
                          ? `Finished in ${formatDurationMs(lastDurationMs)} without agent output`
                          : null
                      }
                      turnCompleteKind={
                        currentTurnCompletedWithoutVisibleOutput ? "warning" : currentTurnFooterKind
                      }
                      reasoningLabel={latestReasoningLabel}
                      activityLabel={currentTurnPrimaryLabel}
                      activityDetail={currentTurnSecondaryDetail}
                      artifactSummary={currentTurnArtifacts}
                      showArtifactSummaryChips={currentTurnExecutionSummaryLabels.length === 0}
                      artifactActions={currentTurnArtifactActions.map((action) => ({
                        key: action.key,
                        label: action.label,
                        onClick: () => {
                          const targetGroupId = toolGroupIdByItemId.get(action.itemId);
                          if (targetGroupId) {
                            if (collapsedToolGroups.has(targetGroupId)) {
                              toggleToolGroup(targetGroupId);
                            }
                          }
                          if (action.expandsTarget) {
                            manuallyToggledExpandedRef.current.add(action.itemId);
                            ensureExpanded(action.itemId);
                          }
                          window.setTimeout(() => {
                            scrollToTimelineArtifact(action.itemId);
                          }, 0);
                        },
                      }))}
                      showPollingFetchStatus={showPollingFetchStatus}
                      pollingIntervalMs={pollingIntervalMs}
                    />
                  </div>
                </section>
              )
            : null}
          {trailingTimelinePanels.map(renderTimelinePanel)}
        </div>
      ) : null}
      {showJumpToLatest && (
        <button
          type="button"
          className={joinClassNames(
            styles.messagesJumpToLatest,
            pendingUpdateCount > 0 ? null : styles.messagesJumpToLatestIconOnly
          )}
          onClick={handleJumpToLatest}
          aria-label="Jump to latest updates"
        >
          <ChevronDown size={14} aria-hidden />
          {pendingUpdateCount > 0 && (
            <span className={styles.messagesJumpToLatestCount}>
              {formatCount(pendingUpdateCount, "new update", "new updates")}
            </span>
          )}
        </button>
      )}
      {!items.length &&
        !hasTimelineFollowups &&
        !isThinking &&
        !shouldShowInitialThreadLoadingState &&
        !turnDiffItem &&
        !timelineStatusBanner && (
          <div
            className={joinClassNames(
              styles.empty,
              "empty",
              styles.messagesEmpty,
              "messages-empty"
            )}
          >
            <CoreLoopStatePanel
              compact
              eyebrow={emptyState.eyebrow}
              title={emptyState.title}
              description={emptyState.description}
              checklistTitle={emptyState.checklistTitle ?? "Launch sequence"}
              showStepNumbers={emptyState.showStepNumbers}
              steps={emptyState.steps}
            />
          </div>
        )}
      {!items.length &&
        !hasTimelineFollowups &&
        !isThinking &&
        shouldShowInitialThreadLoadingState &&
        !turnDiffItem &&
        !timelineStatusBanner && (
          <div
            className={joinClassNames(
              styles.empty,
              "empty",
              styles.messagesEmpty,
              "messages-empty"
            )}
          >
            <CoreLoopStatePanel
              compact
              tone="loading"
              eyebrow={emptyState.eyebrow}
              title={emptyState.loadingTitle}
              description={emptyState.description}
              showStepNumbers={emptyState.showStepNumbers}
              status={
                <output
                  className={joinClassNames(
                    styles.messagesLoadingIndicator,
                    "messages-loading-indicator"
                  )}
                  aria-live="polite"
                >
                  <span className={styles.workingSpinner} aria-hidden />
                  <span
                    className={joinClassNames(
                      styles.messagesLoadingLabel,
                      "messages-loading-label"
                    )}
                  >
                    {emptyState.loadingLabel}
                  </span>
                </output>
              }
            />
          </div>
        )}
      <div ref={bottomRef} />
    </div>
  );
});
