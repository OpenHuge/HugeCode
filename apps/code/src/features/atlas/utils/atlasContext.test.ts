import { describe, expect, it } from "vitest";
import type { ConversationItem, ThreadTokenUsage, TurnPlan } from "../../../types";
import {
  ATLAS_DRIVER_PRESETS,
  buildAtlasContextPrefix,
  buildAtlasDriverSummaries,
  DEFAULT_ATLAS_DETAIL_LEVEL,
  DEFAULT_ATLAS_DRIVER_ORDER,
  normalizeAtlasDetailLevel,
  normalizeAtlasDriverOrder,
  resolveAtlasPresetId,
} from "./atlasContext";

function buildMessage(role: "user" | "assistant", text: string): ConversationItem {
  return {
    id: `${role}-${text}`,
    kind: "message",
    role,
    text,
  };
}

function buildContextCompactionItem(status = "completed"): ConversationItem {
  return {
    id: `tool-${status}`,
    kind: "tool",
    toolType: "contextCompaction",
    title: "Context compaction",
    detail: "Compacting conversation context to fit token limits.",
    status,
  };
}

const plan: TurnPlan = {
  turnId: "turn-1",
  explanation: "Use a two-phase migration.",
  steps: [
    { step: "Create schema", status: "inProgress" },
    { step: "Backfill data", status: "pending" },
  ],
};

const tokenUsage: ThreadTokenUsage = {
  total: {
    totalTokens: 5000,
    inputTokens: 3000,
    cachedInputTokens: 400,
    outputTokens: 1600,
    reasoningOutputTokens: 500,
  },
  last: {
    totalTokens: 1300,
    inputTokens: 900,
    cachedInputTokens: 100,
    outputTokens: 400,
    reasoningOutputTokens: 100,
  },
  modelContextWindow: 10000,
};

describe("normalizeAtlasDriverOrder", () => {
  it("returns defaults for empty input", () => {
    expect(normalizeAtlasDriverOrder(undefined)).toEqual(DEFAULT_ATLAS_DRIVER_ORDER);
  });

  it("drops unknown ids, de-duplicates, and appends missing defaults", () => {
    expect(normalizeAtlasDriverOrder(["plan", "plan", "unknown", "token_budget"])).toEqual([
      "plan",
      "token_budget",
      "recent_messages",
      "context_compaction",
      "long_term_memory",
      "execution_state",
    ]);
  });
});

describe("normalizeAtlasDetailLevel", () => {
  it("falls back to default for invalid values", () => {
    expect(normalizeAtlasDetailLevel(undefined)).toBe(DEFAULT_ATLAS_DETAIL_LEVEL);
    expect(normalizeAtlasDetailLevel("invalid")).toBe(DEFAULT_ATLAS_DETAIL_LEVEL);
  });

  it("accepts supported values", () => {
    expect(normalizeAtlasDetailLevel("concise")).toBe("concise");
    expect(normalizeAtlasDetailLevel("detailed")).toBe("detailed");
  });
});

describe("atlas driver presets", () => {
  it("exposes four stable preset ids", () => {
    expect(ATLAS_DRIVER_PRESETS.map((preset) => preset.id)).toEqual([
      "balanced",
      "fast_reply",
      "deep_reasoning",
      "cost_saver",
    ]);
  });

  it("resolves known preset orders", () => {
    expect(
      resolveAtlasPresetId([
        "plan",
        "recent_messages",
        "context_compaction",
        "long_term_memory",
        "token_budget",
        "execution_state",
      ])
    ).toBe("balanced");
    expect(
      resolveAtlasPresetId([
        "recent_messages",
        "execution_state",
        "token_budget",
        "long_term_memory",
        "plan",
        "context_compaction",
      ])
    ).toBe("fast_reply");
    expect(
      resolveAtlasPresetId([
        "plan",
        "long_term_memory",
        "context_compaction",
        "recent_messages",
        "execution_state",
        "token_budget",
      ])
    ).toBe("deep_reasoning");
    expect(
      resolveAtlasPresetId([
        "token_budget",
        "context_compaction",
        "long_term_memory",
        "execution_state",
        "recent_messages",
        "plan",
      ])
    ).toBe("cost_saver");
  });

  it("returns null for non-preset orderings", () => {
    expect(
      resolveAtlasPresetId([
        "recent_messages",
        "plan",
        "token_budget",
        "context_compaction",
        "execution_state",
      ])
    ).toBeNull();
  });
});

describe("buildAtlasDriverSummaries", () => {
  it("builds driver summaries from thread context", () => {
    const summaries = buildAtlasDriverSummaries({
      order: [
        "recent_messages",
        "plan",
        "context_compaction",
        "long_term_memory",
        "token_budget",
        "execution_state",
      ],
      detailLevel: "balanced",
      items: [buildMessage("user", "hello"), buildContextCompactionItem("completed")],
      plan,
      tokenUsage,
      longTermMemoryDigest: {
        summary: "Use chunked migration and preserve indexes.",
        updatedAt: 1_737_000_000_000,
      },
      threadStatus: {
        isProcessing: true,
        hasUnread: false,
        isReviewing: false,
        executionState: "running",
      },
      activeTurnId: "turn-42",
    });

    expect(summaries.map((entry) => entry.id)).toEqual([
      "recent_messages",
      "plan",
      "context_compaction",
      "long_term_memory",
      "token_budget",
      "execution_state",
    ]);
    expect(summaries[0]?.summary).toContain("U: hello");
    expect(summaries[1]?.summary).toContain("Use a two-phase migration.");
    expect(summaries[2]?.summary).toContain("Last compaction");
    expect(summaries[3]?.summary).toContain("Use chunked migration");
    expect(summaries[4]?.summary).toContain("free");
    expect(summaries[5]?.summary).toContain("Running turn turn-42");
  });
});

describe("buildAtlasContextPrefix", () => {
  it("returns a wrapped atlas context prefix", () => {
    const prefix = buildAtlasContextPrefix({
      items: [
        buildMessage("user", "Need a migration plan"),
        buildMessage("assistant", "I'll draft one"),
        buildContextCompactionItem(),
      ],
      order: [
        "execution_state",
        "plan",
        "recent_messages",
        "context_compaction",
        "long_term_memory",
        "token_budget",
      ],
      plan,
      tokenUsage,
      threadStatus: {
        isProcessing: false,
        hasUnread: false,
        isReviewing: false,
        executionState: "awaitingApproval",
      },
      activeTurnId: "turn-1",
      detailLevel: "balanced",
      longTermMemoryDigest: {
        summary: "Remember to follow the migration runbook and verify indexes.",
        updatedAt: 1_737_000_000_000,
      },
    });

    expect(prefix).toContain("[ATLAS_CONTEXT v1]");
    expect(prefix).toContain("Internal runtime context only.");
    expect(prefix).toContain("1. execution_state:");
    expect(prefix).toContain("2. plan:");
    expect(prefix).toContain("[/ATLAS_CONTEXT]");
  });

  it("clamps very large payloads", () => {
    const largeText = "x".repeat(6000);
    const prefix = buildAtlasContextPrefix({
      items: [buildMessage("user", largeText), buildMessage("assistant", largeText)],
      order: [
        "recent_messages",
        "plan",
        "context_compaction",
        "long_term_memory",
        "token_budget",
        "execution_state",
      ],
      plan,
      tokenUsage,
      threadStatus: null,
      activeTurnId: null,
      detailLevel: "concise",
    });

    expect(prefix).not.toBeNull();
    expect((prefix ?? "").length).toBeLessThanOrEqual(1300);
    expect(prefix).toContain("[/ATLAS_CONTEXT]");
  });

  it("returns fallback content when thread data is empty", () => {
    const prefix = buildAtlasContextPrefix({
      items: [],
      order: ["recent_messages"],
      plan: null,
      tokenUsage: null,
      detailLevel: "balanced",
    });

    expect(prefix).toContain("No recent messages");
  });

  it("includes long-term memory fallback when digest is unavailable", () => {
    const prefix = buildAtlasContextPrefix({
      items: [],
      order: ["long_term_memory"],
      plan: null,
      tokenUsage: null,
      detailLevel: "balanced",
      longTermMemoryDigest: null,
    });

    expect(prefix).toContain("No long-term memory digest is available yet");
  });
});
