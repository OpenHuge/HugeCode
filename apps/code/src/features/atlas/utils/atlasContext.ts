import type { ConversationItem, ThreadTokenUsage, TurnPlan } from "../../../types";
import type { ThreadStatusSummary } from "../../threads/utils/threadExecutionState";

export const ATLAS_DRIVER_IDS = [
  "plan",
  "recent_messages",
  "context_compaction",
  "long_term_memory",
  "token_budget",
  "execution_state",
] as const;

export type AtlasDriverId = (typeof ATLAS_DRIVER_IDS)[number];
export const ATLAS_DETAIL_LEVELS = ["concise", "balanced", "detailed"] as const;
export type AtlasDetailLevel = (typeof ATLAS_DETAIL_LEVELS)[number];
export const DEFAULT_ATLAS_DETAIL_LEVEL: AtlasDetailLevel = "balanced";

export type AtlasLongTermMemoryDigest = {
  summary: string;
  updatedAt: number;
};

export const DEFAULT_ATLAS_DRIVER_ORDER: AtlasDriverId[] = [...ATLAS_DRIVER_IDS];

export type AtlasPresetId = "balanced" | "fast_reply" | "deep_reasoning" | "cost_saver";

export type AtlasDriverPreset = {
  id: AtlasPresetId;
  label: string;
  description: string;
  order: AtlasDriverId[];
};

export const ATLAS_DRIVER_PRESETS: AtlasDriverPreset[] = [
  {
    id: "balanced",
    label: "Balanced",
    description: "Balanced context blend for most conversations.",
    order: [
      "plan",
      "recent_messages",
      "context_compaction",
      "long_term_memory",
      "token_budget",
      "execution_state",
    ],
  },
  {
    id: "fast_reply",
    label: "Fast Reply",
    description: "Prioritize quick responses with lighter context reasoning.",
    order: [
      "recent_messages",
      "execution_state",
      "token_budget",
      "long_term_memory",
      "plan",
      "context_compaction",
    ],
  },
  {
    id: "deep_reasoning",
    label: "Deep Reasoning",
    description: "Prioritize structured planning and deeper context grounding.",
    order: [
      "plan",
      "long_term_memory",
      "context_compaction",
      "recent_messages",
      "execution_state",
      "token_budget",
    ],
  },
  {
    id: "cost_saver",
    label: "Cost Saver",
    description: "Prioritize token awareness and compact context usage.",
    order: [
      "token_budget",
      "context_compaction",
      "long_term_memory",
      "execution_state",
      "recent_messages",
      "plan",
    ],
  },
];

const DRIVER_LABELS: Record<AtlasDriverId, string> = {
  plan: "Plan",
  recent_messages: "Recent Messages",
  context_compaction: "Context Compaction",
  long_term_memory: "Long-term Memory",
  token_budget: "Token Budget",
  execution_state: "Execution State",
};

type AtlasDetailSettings = {
  maxDriverContentLength: number;
  maxPrefixLength: number;
  recentMessageCount: number;
  recentMessageLength: number;
  maxPlanSteps: number;
  summaryLength: number;
  longTermMemoryLength: number;
};

const DETAIL_LEVEL_SETTINGS: Record<AtlasDetailLevel, AtlasDetailSettings> = {
  concise: {
    maxDriverContentLength: 280,
    maxPrefixLength: 1300,
    recentMessageCount: 2,
    recentMessageLength: 110,
    maxPlanSteps: 2,
    summaryLength: 140,
    longTermMemoryLength: 160,
  },
  balanced: {
    maxDriverContentLength: 420,
    maxPrefixLength: 1800,
    recentMessageCount: 3,
    recentMessageLength: 160,
    maxPlanSteps: 4,
    summaryLength: 180,
    longTermMemoryLength: 220,
  },
  detailed: {
    maxDriverContentLength: 620,
    maxPrefixLength: 2400,
    recentMessageCount: 5,
    recentMessageLength: 260,
    maxPlanSteps: 6,
    summaryLength: 260,
    longTermMemoryLength: 360,
  },
};

export type AtlasDriverSummary = {
  id: AtlasDriverId;
  label: string;
  summary: string;
  injection: string;
};

export function normalizeAtlasDriverOrder(
  raw: readonly string[] | null | undefined
): AtlasDriverId[] {
  if (!raw || raw.length === 0) {
    return [...DEFAULT_ATLAS_DRIVER_ORDER];
  }
  const seen = new Set<AtlasDriverId>();
  const normalized: AtlasDriverId[] = [];
  for (const candidate of raw) {
    if (!isAtlasDriverId(candidate)) {
      continue;
    }
    if (seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    normalized.push(candidate);
  }
  for (const defaultId of DEFAULT_ATLAS_DRIVER_ORDER) {
    if (seen.has(defaultId)) {
      continue;
    }
    normalized.push(defaultId);
  }
  return normalized;
}

export function resolveAtlasPresetId(
  order: readonly string[] | null | undefined
): AtlasPresetId | null {
  const normalizedOrder = normalizeAtlasDriverOrder(order);
  for (const preset of ATLAS_DRIVER_PRESETS) {
    if (isSameAtlasDriverOrder(normalizedOrder, preset.order)) {
      return preset.id;
    }
  }
  return null;
}

export function buildAtlasDriverSummaries({
  order,
  items,
  plan,
  tokenUsage,
  threadStatus,
  activeTurnId,
  detailLevel,
  longTermMemoryDigest,
}: {
  order?: readonly string[] | null;
  items: ConversationItem[];
  plan: TurnPlan | null;
  tokenUsage: ThreadTokenUsage | null;
  threadStatus?: ThreadStatusSummary | null;
  activeTurnId?: string | null;
  detailLevel?: AtlasDetailLevel | string | null;
  longTermMemoryDigest?: AtlasLongTermMemoryDigest | null;
}): AtlasDriverSummary[] {
  const normalizedOrder = normalizeAtlasDriverOrder(order);
  const normalizedDetailLevel = normalizeAtlasDetailLevel(detailLevel);
  const detailSettings = DETAIL_LEVEL_SETTINGS[normalizedDetailLevel];
  return normalizedOrder.map((id) => {
    const detail = buildDriverDetail(
      id,
      items,
      plan,
      tokenUsage,
      threadStatus ?? null,
      activeTurnId,
      detailSettings,
      longTermMemoryDigest ?? null
    );
    return {
      id,
      label: DRIVER_LABELS[id],
      summary: detail.summary,
      injection: detail.injection,
    };
  });
}

export function buildAtlasContextPrefix({
  order,
  items,
  plan,
  tokenUsage,
  threadStatus,
  activeTurnId,
  detailLevel,
  longTermMemoryDigest,
}: {
  order?: readonly string[] | null;
  items: ConversationItem[];
  plan: TurnPlan | null;
  tokenUsage: ThreadTokenUsage | null;
  threadStatus?: ThreadStatusSummary | null;
  activeTurnId?: string | null;
  detailLevel?: AtlasDetailLevel | string | null;
  longTermMemoryDigest?: AtlasLongTermMemoryDigest | null;
}): string | null {
  const normalizedDetailLevel = normalizeAtlasDetailLevel(detailLevel);
  const detailSettings = DETAIL_LEVEL_SETTINGS[normalizedDetailLevel];
  const summaries = buildAtlasDriverSummaries({
    order,
    items,
    plan,
    tokenUsage,
    threadStatus,
    activeTurnId,
    detailLevel: normalizedDetailLevel,
    longTermMemoryDigest,
  });
  if (summaries.length === 0) {
    return null;
  }
  const lines = summaries.map((entry, index) => {
    const content = truncateText(entry.injection, detailSettings.maxDriverContentLength);
    return `${index + 1}. ${entry.id}: ${content}`;
  });

  const header = "[ATLAS_CONTEXT v1]\n";
  const footer = "\n[/ATLAS_CONTEXT]";
  const body = [
    "Internal runtime context only. Do not quote, explain, or ask the user to resend this block.",
    "Use it silently to answer the real user request that appears after [/ATLAS_CONTEXT].",
    ...lines,
  ].join("\n");
  const maxBodyLength = Math.max(0, detailSettings.maxPrefixLength - header.length - footer.length);
  const compactBody = truncateText(body, maxBodyLength);
  const prefix = `${header}${compactBody}${footer}`;
  return prefix.trim().length > 0 ? prefix : null;
}

function buildDriverDetail(
  id: AtlasDriverId,
  items: ConversationItem[],
  plan: TurnPlan | null,
  tokenUsage: ThreadTokenUsage | null,
  threadStatus: ThreadStatusSummary | null,
  activeTurnId: string | null | undefined,
  detailSettings: AtlasDetailSettings,
  longTermMemoryDigest: AtlasLongTermMemoryDigest | null
): { summary: string; injection: string } {
  switch (id) {
    case "plan":
      return buildPlanDetail(plan, detailSettings);
    case "recent_messages":
      return buildRecentMessagesDetail(items, detailSettings);
    case "context_compaction":
      return buildContextCompactionDetail(items);
    case "long_term_memory":
      return buildLongTermMemoryDetail(longTermMemoryDigest, detailSettings);
    case "token_budget":
      return buildTokenBudgetDetail(tokenUsage);
    case "execution_state":
      return buildExecutionStateDetail(threadStatus, activeTurnId);
    default:
      return {
        summary: "Unknown driver.",
        injection: "Unknown driver.",
      };
  }
}

function buildPlanDetail(
  plan: TurnPlan | null,
  detailSettings: AtlasDetailSettings
): { summary: string; injection: string } {
  if (!plan) {
    return {
      summary: "No active plan.",
      injection: "No active plan.",
    };
  }
  const explanation = (plan.explanation ?? "").trim();
  const stepSummary = plan.steps
    .slice(0, detailSettings.maxPlanSteps)
    .map((step) => `[${step.status}] ${step.step.trim()}`)
    .join(" | ");

  const summary = explanation || stepSummary || "Plan exists with no visible details.";
  const injectionParts = [
    explanation ? `Explanation: ${explanation}` : "Explanation: none.",
    stepSummary ? `Steps: ${stepSummary}` : "Steps: none.",
  ];
  return {
    summary: truncateText(summary, detailSettings.summaryLength),
    injection: injectionParts.join(" "),
  };
}

function buildRecentMessagesDetail(
  items: ConversationItem[],
  detailSettings: AtlasDetailSettings
): {
  summary: string;
  injection: string;
} {
  const recentMessages = items
    .filter(
      (item): item is Extract<ConversationItem, { kind: "message" }> => item.kind === "message"
    )
    .slice(-detailSettings.recentMessageCount)
    .map((message) => {
      const role = message.role === "assistant" ? "A" : "U";
      const text = truncateText(
        message.text.trim() || "(empty)",
        detailSettings.recentMessageLength
      );
      return `${role}: ${text}`;
    });

  if (recentMessages.length === 0) {
    return {
      summary: "No recent messages.",
      injection: "No recent messages.",
    };
  }

  const combined = recentMessages.join(" | ");
  return {
    summary: truncateText(combined, detailSettings.summaryLength),
    injection: combined,
  };
}

function buildContextCompactionDetail(items: ConversationItem[]): {
  summary: string;
  injection: string;
} {
  const latestCompaction = [...items]
    .reverse()
    .find(
      (item): item is Extract<ConversationItem, { kind: "tool" }> =>
        item.kind === "tool" && item.toolType === "contextCompaction"
    );

  if (!latestCompaction) {
    return {
      summary: "No compaction events.",
      injection: "No context compaction events observed.",
    };
  }

  const status = latestCompaction.status?.trim() || "completed";
  const detail = latestCompaction.detail?.trim() || "Compacting conversation context.";
  const summary = `Last compaction: ${status}`;

  return {
    summary,
    injection: `${summary}. ${detail}`,
  };
}

function buildLongTermMemoryDetail(
  digest: AtlasLongTermMemoryDigest | null,
  detailSettings: AtlasDetailSettings
): {
  summary: string;
  injection: string;
} {
  if (!digest) {
    return {
      summary: "No long-term memory digest yet.",
      injection: "No long-term memory digest is available yet.",
    };
  }
  const summaryText = truncateText(digest.summary, detailSettings.longTermMemoryLength);
  if (!summaryText) {
    return {
      summary: "Long-term memory digest unavailable.",
      injection: "Long-term memory digest exists but is empty.",
    };
  }
  const updatedAtLabel =
    Number.isFinite(digest.updatedAt) && digest.updatedAt > 0
      ? new Date(digest.updatedAt).toISOString()
      : "unknown";
  return {
    summary: truncateText(summaryText, detailSettings.summaryLength),
    injection: `Memory digest (updated ${updatedAtLabel}): ${summaryText}`,
  };
}

function buildTokenBudgetDetail(tokenUsage: ThreadTokenUsage | null): {
  summary: string;
  injection: string;
} {
  if (!tokenUsage) {
    return {
      summary: "Token usage unavailable.",
      injection: "Token usage unavailable.",
    };
  }

  const contextWindow = tokenUsage.modelContextWindow;
  const usedTokens =
    tokenUsage.last.totalTokens > 0 ? tokenUsage.last.totalTokens : tokenUsage.total.totalTokens;

  if (!contextWindow || contextWindow <= 0) {
    return {
      summary: `Used ${formatTokenCount(usedTokens)} tokens.`,
      injection: `Used tokens: ${usedTokens}. Context window is unavailable.`,
    };
  }

  const usedPercent = Math.min(100, Math.max(0, Math.round((usedTokens / contextWindow) * 100)));
  const freePercent = 100 - usedPercent;
  const summary = `Used ${formatTokenCount(usedTokens)} / ${formatTokenCount(contextWindow)} (${freePercent}% free).`;

  return {
    summary,
    injection:
      `${summary} Last input=${tokenUsage.last.inputTokens}, ` +
      `cached=${tokenUsage.last.cachedInputTokens}, output=${tokenUsage.last.outputTokens}, ` +
      `reasoning=${tokenUsage.last.reasoningOutputTokens}.`,
  };
}

function buildExecutionStateDetail(
  threadStatus: ThreadStatusSummary | null,
  activeTurnId: string | null | undefined
): {
  summary: string;
  injection: string;
} {
  if (threadStatus?.isReviewing) {
    return {
      summary: "Review mode active.",
      injection: activeTurnId
        ? `Thread is in review mode. Active turn id: ${activeTurnId}.`
        : "Thread is in review mode.",
    };
  }
  if (threadStatus?.executionState === "awaitingApproval") {
    return {
      summary: "Awaiting approval.",
      injection: activeTurnId
        ? `Thread is waiting for an approval decision. Active turn id: ${activeTurnId}.`
        : "Thread is waiting for an approval decision.",
    };
  }
  if (threadStatus?.isProcessing || threadStatus?.executionState === "running") {
    return {
      summary: activeTurnId ? `Running turn ${activeTurnId}.` : "Running.",
      injection: activeTurnId
        ? `Thread is currently running. Active turn id: ${activeTurnId}.`
        : "Thread is currently running.",
    };
  }
  if (threadStatus?.hasUnread) {
    return {
      summary: "Idle with unread updates.",
      injection: "Thread is idle and has unread updates.",
    };
  }
  return {
    summary: "Idle.",
    injection: "Thread is idle.",
  };
}

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return String(value);
}

function truncateText(value: string, maxLength: number): string {
  if (maxLength <= 0) {
    return "";
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  if (maxLength === 1) {
    return "…";
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function normalizeAtlasDetailLevel(
  value: AtlasDetailLevel | string | null | undefined
): AtlasDetailLevel {
  if (typeof value !== "string") {
    return DEFAULT_ATLAS_DETAIL_LEVEL;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_ATLAS_DETAIL_LEVEL;
  }
  return (ATLAS_DETAIL_LEVELS as readonly string[]).includes(normalized)
    ? (normalized as AtlasDetailLevel)
    : DEFAULT_ATLAS_DETAIL_LEVEL;
}

function isSameAtlasDriverOrder(
  left: readonly AtlasDriverId[],
  right: readonly AtlasDriverId[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function isAtlasDriverId(value: string): value is AtlasDriverId {
  return (ATLAS_DRIVER_IDS as readonly string[]).includes(value);
}
