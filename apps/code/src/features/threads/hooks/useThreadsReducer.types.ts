import type {
  AccountSnapshot,
  ApprovalRequest,
  ConversationItem,
  DynamicToolCallRequest,
  RateLimitSnapshot,
  RequestUserInputRequest,
  ThreadListSortKey,
  ThreadSummary,
  ThreadTokenUsage,
  TurnPlan,
} from "../../../types";
import type { ThreadExecutionState } from "../utils/threadExecutionState";

export type ThreadActivityStatus = {
  isProcessing: boolean;
  hasUnread: boolean;
  isReviewing: boolean;
  executionState?: ThreadExecutionState;
  processingStartedAt: number | null;
  lastDurationMs: number | null;
};

export type ThreadState = {
  activeThreadIdByWorkspace: Record<string, string | null>;
  itemsByThread: Record<string, ConversationItem[]>;
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  hiddenThreadIdsByWorkspace: Record<string, Record<string, true>>;
  threadParentById: Record<string, string>;
  threadStatusById: Record<string, ThreadActivityStatus>;
  threadResumeLoadingById: Record<string, boolean>;
  threadListLoadingByWorkspace: Record<string, boolean>;
  threadListPagingByWorkspace: Record<string, boolean>;
  threadListCursorByWorkspace: Record<string, string | null>;
  threadSortKeyByWorkspace: Record<string, ThreadListSortKey>;
  activeTurnIdByThread: Record<string, string | null>;
  turnDiffByThread: Record<string, string>;
  approvals: ApprovalRequest[];
  userInputRequests: RequestUserInputRequest[];
  toolCallRequests: DynamicToolCallRequest[];
  tokenUsageByThread: Record<string, ThreadTokenUsage>;
  rateLimitsByWorkspace: Record<string, RateLimitSnapshot | null>;
  accountByWorkspace: Record<string, AccountSnapshot | null>;
  planByThread: Record<string, TurnPlan | null>;
  lastAgentMessageByThread: Record<string, { text: string; timestamp: number }>;
};

export type ThreadAction =
  | { type: "setActiveThreadId"; workspaceId: string; threadId: string | null }
  | { type: "ensureThread"; workspaceId: string; threadId: string }
  | { type: "hideThread"; workspaceId: string; threadId: string }
  | { type: "removeThread"; workspaceId: string; threadId: string }
  | { type: "setThreadParent"; threadId: string; parentId: string }
  | {
      type: "markProcessing";
      threadId: string;
      isProcessing: boolean;
      executionState?: ThreadExecutionState;
      timestamp: number;
    }
  | { type: "markImmediateCompletion"; threadId: string }
  | { type: "hydrateThreadStatus"; threadId: string; lastDurationMs: number }
  | { type: "markReviewing"; threadId: string; isReviewing: boolean }
  | { type: "markUnread"; threadId: string; hasUnread: boolean }
  | { type: "addAssistantMessage"; threadId: string; text: string }
  | { type: "setThreadName"; workspaceId: string; threadId: string; name: string }
  | {
      type: "setThreadTimestamp";
      workspaceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "appendAgentDelta";
      workspaceId: string;
      threadId: string;
      itemId: string;
      delta: string;
      hasCustomName: boolean;
    }
  | {
      type: "completeAgentMessage";
      workspaceId: string;
      threadId: string;
      itemId: string;
      text: string;
      hasCustomName: boolean;
    }
  | {
      type: "upsertItem";
      workspaceId: string;
      threadId: string;
      item: ConversationItem;
      hasCustomName?: boolean;
    }
  | { type: "setThreadItems"; threadId: string; items: ConversationItem[] }
  | {
      type: "appendReasoningSummary";
      threadId: string;
      itemId: string;
      delta: string;
    }
  | {
      type: "appendReasoningSummaryBoundary";
      threadId: string;
      itemId: string;
    }
  | { type: "appendReasoningContent"; threadId: string; itemId: string; delta: string }
  | { type: "appendPlanDelta"; threadId: string; itemId: string; delta: string }
  | { type: "appendToolOutput"; threadId: string; itemId: string; delta: string }
  | { type: "completePendingTurnItems"; threadId: string }
  | {
      type: "setThreads";
      workspaceId: string;
      threads: ThreadSummary[];
      sortKey: ThreadListSortKey;
    }
  | {
      type: "setThreadListLoading";
      workspaceId: string;
      isLoading: boolean;
    }
  | {
      type: "setThreadResumeLoading";
      threadId: string;
      isLoading: boolean;
    }
  | {
      type: "setThreadListPaging";
      workspaceId: string;
      isLoading: boolean;
    }
  | {
      type: "setThreadListCursor";
      workspaceId: string;
      cursor: string | null;
    }
  | { type: "addApproval"; approval: ApprovalRequest }
  | { type: "removeApproval"; requestId: number | string; workspaceId: string }
  | { type: "addUserInputRequest"; request: RequestUserInputRequest }
  | {
      type: "removeUserInputRequest";
      requestId: number | string;
      workspaceId: string;
    }
  | { type: "addToolCallRequest"; request: DynamicToolCallRequest }
  | {
      type: "removeToolCallRequest";
      requestId: number | string;
      workspaceId: string;
    }
  | { type: "setThreadTokenUsage"; threadId: string; tokenUsage: ThreadTokenUsage }
  | {
      type: "setRateLimits";
      workspaceId: string;
      rateLimits: RateLimitSnapshot | null;
    }
  | {
      type: "setAccountInfo";
      workspaceId: string;
      account: AccountSnapshot | null;
    }
  | { type: "setActiveTurnId"; threadId: string; turnId: string | null }
  | { type: "setThreadTurnDiff"; threadId: string; diff: string }
  | { type: "setThreadPlan"; threadId: string; plan: TurnPlan | null }
  | { type: "clearThreadPlan"; threadId: string }
  | {
      type: "setLastAgentMessage";
      threadId: string;
      text: string;
      timestamp: number;
    };

const emptyItems: Record<string, ConversationItem[]> = {};

export const initialState: ThreadState = {
  activeThreadIdByWorkspace: {},
  itemsByThread: emptyItems,
  threadsByWorkspace: {},
  hiddenThreadIdsByWorkspace: {},
  threadParentById: {},
  threadStatusById: {},
  threadResumeLoadingById: {},
  threadListLoadingByWorkspace: {},
  threadListPagingByWorkspace: {},
  threadListCursorByWorkspace: {},
  threadSortKeyByWorkspace: {},
  activeTurnIdByThread: {},
  turnDiffByThread: {},
  approvals: [],
  userInputRequests: [],
  toolCallRequests: [],
  tokenUsageByThread: {},
  rateLimitsByWorkspace: {},
  accountByWorkspace: {},
  planByThread: {},
  lastAgentMessageByThread: {},
};
