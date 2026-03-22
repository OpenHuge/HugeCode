import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  buildToolSummary,
  buildToolGroups,
  extractToolPlannerDiagnostics,
  formatToolDetail,
  resolveMetaNotice,
  summarizeCurrentTurnActivity,
  summarizeCurrentTurnArtifacts,
} from "./messageRenderUtils";

describe("buildToolGroups", () => {
  it("tracks update counters independently for tool, explore, and reasoning entries", () => {
    const items: ConversationItem[] = [
      {
        id: "tool-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git status",
        detail: "/repo",
        status: "completed",
        output: "",
      },
      {
        id: "reasoning-1",
        kind: "reasoning",
        summary: "Planning\nReviewing timeline render",
        content: "",
      },
      {
        id: "explore-1",
        kind: "explore",
        status: "explored",
        entries: [
          { kind: "search", label: "Messages.tsx" },
          { kind: "read", label: "messageRenderUtils.ts" },
        ],
      },
    ];

    const entries = buildToolGroups(items);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("toolGroup");
    if (entries[0].kind !== "toolGroup") {
      return;
    }
    expect(entries[0].group.updateCount).toBe(4);
    expect(entries[0].group.toolCallCount).toBe(1);
    expect(entries[0].group.exploreStepCount).toBe(2);
    expect(entries[0].group.reasoningStepCount).toBe(1);
  });

  it("merges consecutive explore runs before counting explore steps", () => {
    const items: ConversationItem[] = [
      {
        id: "explore-1",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "search", label: "first" }],
      },
      {
        id: "explore-2",
        kind: "explore",
        status: "explored",
        entries: [
          { kind: "read", label: "second" },
          { kind: "read", label: "third" },
        ],
      },
      {
        id: "tool-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git diff",
        detail: "/repo",
        status: "completed",
        output: "",
      },
    ];

    const entries = buildToolGroups(items);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("toolGroup");
    if (entries[0].kind !== "toolGroup") {
      return;
    }
    expect(entries[0].group.items).toHaveLength(2);
    expect(entries[0].group.updateCount).toBe(4);
    expect(entries[0].group.toolCallCount).toBe(1);
    expect(entries[0].group.exploreStepCount).toBe(3);
    expect(entries[0].group.reasoningStepCount).toBe(0);
  });

  it("keeps merged single explore runs as plain items", () => {
    const items: ConversationItem[] = [
      {
        id: "explore-1",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "search", label: "first" }],
      },
      {
        id: "explore-2",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "second" }],
      },
    ];

    const entries = buildToolGroups(items);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("item");
    if (entries[0].kind !== "item" || entries[0].item.kind !== "explore") {
      return;
    }
    expect(entries[0].item.entries).toHaveLength(2);
  });

  it("does not group across message boundaries", () => {
    const items: ConversationItem[] = [
      {
        id: "tool-before",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git status",
        detail: "/repo",
        status: "completed",
        output: "",
      },
      {
        id: "assistant-message",
        kind: "message",
        role: "assistant",
        text: "Boundary",
      },
      {
        id: "tool-after",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git diff",
        detail: "/repo",
        status: "completed",
        output: "",
      },
    ];

    const entries = buildToolGroups(items);
    expect(entries).toHaveLength(3);
    expect(entries[0].kind).toBe("item");
    expect(entries[1].kind).toBe("item");
    expect(entries[2].kind).toBe("item");
    if (entries[1].kind !== "item") {
      return;
    }
    expect(entries[1].item.kind).toBe("message");
  });
});

describe("extractToolPlannerDiagnostics", () => {
  it("parses planner diagnostics from tool detail JSON with trailing metadata lines", () => {
    const item: Extract<ConversationItem, { kind: "tool" }> = {
      id: "planner-lint",
      kind: "tool",
      toolType: "mcpToolCall",
      title: "Tool: runtime / runtime-plan-validation",
      detail:
        '{"plannerDiagnostics":{"diagnostics":[{"code":"planner.missing_success_criteria","severity":"warning","message":"Add explicit verification."},{"code":"planner.invalid_dependency","severity":"fatal","message":"Cycle detected.","stepIndex":1}]}}\\nbatch: lint\\nattempt: 1',
      status: "failed",
      output: "",
    };

    const diagnostics = extractToolPlannerDiagnostics(item);
    expect(diagnostics).toBeTruthy();
    expect(diagnostics?.warningCount).toBe(1);
    expect(diagnostics?.fatalCount).toBe(1);
    expect(diagnostics?.hasFatal).toBe(true);
    expect(diagnostics?.diagnostics[1]?.stepIndex).toBe(1);
  });

  it("returns null for tools without planner diagnostics payload", () => {
    const item: Extract<ConversationItem, { kind: "tool" }> = {
      id: "no-planner",
      kind: "tool",
      toolType: "mcpToolCall",
      title: "Tool: runtime / read-workspace-file",
      detail: '{"path":"README.md"}',
      status: "completed",
      output: "",
    };

    expect(extractToolPlannerDiagnostics(item)).toBeNull();
  });

  it("returns null for non-validation runtime tools even when planner diagnostics are present", () => {
    const item: Extract<ConversationItem, { kind: "tool" }> = {
      id: "runtime-read",
      kind: "tool",
      toolType: "mcpToolCall",
      title: "Tool: runtime / read-workspace-file",
      detail: JSON.stringify({
        plannerDiagnostics: {
          diagnostics: [
            {
              code: "planner.missing_success_criteria",
              severity: "warning",
              message: "Add explicit verification step.",
            },
          ],
        },
      }),
      status: "failed",
      output: "",
    };

    expect(extractToolPlannerDiagnostics(item)).toBeNull();
  });
});

describe("runtime bash tool rendering", () => {
  it("uses the shell command as the summary title and keeps detail compact", () => {
    const item: Extract<ConversationItem, { kind: "tool" }> = {
      id: "runtime-bash",
      kind: "tool",
      toolType: "mcpToolCall",
      title: "Tool: runtime / bash",
      detail: JSON.stringify({
        command: "Get-ChildItem -Name; rg --files -g package.json src apps packages .",
        shellFamily: "powershell",
        effectiveAccessMode: "full-access",
        sandboxed: false,
        exitCode: 1,
        workspaceId: "ws-1",
        batchId: "turn-123:runtime-plan-batch",
        attempt: 1,
      }),
      status: "failed",
      output: "Access is denied.",
    };

    const summary = buildToolSummary(item, "");
    const detail = formatToolDetail(item);

    expect(summary.value).toBe(
      "Get-ChildItem -Name; rg --files -g package.json src apps packages ."
    );
    expect(detail).toContain("shell: powershell");
    expect(detail).toContain("access: full-access");
    expect(detail).toContain("sandbox: off");
    expect(detail).toContain("exit code: 1");
    expect(detail).not.toContain('"command"');
    expect(detail).not.toContain("batchId");
    expect(detail).not.toContain("attempt");
  });
});

describe("resolveMetaNotice", () => {
  it("does not classify ordinary assistant text as a meta notice", () => {
    const item: Extract<ConversationItem, { kind: "message" }> = {
      id: "assistant-plain",
      kind: "message",
      role: "assistant",
      text: "I updated the implementation and added the missing test coverage.",
    };

    expect(resolveMetaNotice(item)).toBeNull();
  });

  it("classifies model changed from A to B as a model switch notice", () => {
    const item: Extract<ConversationItem, { kind: "message" }> = {
      id: "assistant-model-switch",
      kind: "message",
      role: "assistant",
      text: "Model changed from GPT-5.4 to GPT-5.3-Codex.",
    };

    expect(resolveMetaNotice(item)).toMatchObject({
      kind: "metaNotice",
      noticeType: "modelSwitch",
      title: "模型已从 GPT-5.4 切换到 GPT-5.3-Codex",
      sourceMessageId: "assistant-model-switch",
    });
  });

  it("classifies context may compact notices as context compaction", () => {
    const item: Extract<ConversationItem, { kind: "message" }> = {
      id: "assistant-context-compact",
      kind: "message",
      role: "assistant",
      text: "Context may automatically compact to keep this conversation going.",
    };

    expect(resolveMetaNotice(item)).toMatchObject({
      kind: "metaNotice",
      noticeType: "contextCompaction",
      title: "上下文已整理",
      sourceMessageId: "assistant-context-compact",
    });
  });

  it("falls back to a generic model switch notice when details are unavailable", () => {
    const item: Extract<ConversationItem, { kind: "message" }> = {
      id: "assistant-model-generic",
      kind: "message",
      role: "assistant",
      text: "Changing models mid-conversation will degrade performance.",
    };

    expect(resolveMetaNotice(item)).toMatchObject({
      kind: "metaNotice",
      noticeType: "modelSwitch",
      title: "模型已切换",
      description: "会话中途切换模型可能影响回答表现，且上下文可能会被压缩。",
      sourceMessageId: "assistant-model-generic",
    });
  });

  it("classifies reasoning level updates as reasoningChange", () => {
    const item: Extract<ConversationItem, { kind: "message" }> = {
      id: "assistant-reasoning-change",
      kind: "message",
      role: "assistant",
      text: "Reasoning effort changed to high for the current thread.",
    };

    expect(resolveMetaNotice(item)).toMatchObject({
      kind: "metaNotice",
      noticeType: "reasoningChange",
      title: "推理等级已调整",
      sourceMessageId: "assistant-reasoning-change",
    });
  });

  it("classifies permission/capability updates as permissionChange", () => {
    const item: Extract<ConversationItem, { kind: "message" }> = {
      id: "assistant-permission-change",
      kind: "message",
      role: "assistant",
      text: "Capabilities changed: tool access was restricted for this session.",
    };

    expect(resolveMetaNotice(item)).toMatchObject({
      kind: "metaNotice",
      noticeType: "permissionChange",
      title: "能力范围已更新",
      sourceMessageId: "assistant-permission-change",
    });
  });

  it("classifies contextCompaction tool items as contextCompaction notices", () => {
    const item: Extract<ConversationItem, { kind: "tool" }> = {
      id: "tool-context-compaction",
      kind: "tool",
      toolType: "contextCompaction",
      title: "Context compaction",
      detail: "Compacting context",
      status: "completed",
      output: "",
    };

    expect(resolveMetaNotice(item)).toMatchObject({
      kind: "metaNotice",
      noticeType: "contextCompaction",
      title: "上下文已整理",
      sourceMessageId: "tool-context-compaction",
    });
  });
});

describe("summarizeCurrentTurnActivity", () => {
  it("surfaces running command activity with the cleaned command text", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-running",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: bash -lc 'cd /repo && pnpm test --filter app'",
        detail: "/repo",
        status: "running",
        output: "",
      },
    ];

    expect(summarizeCurrentTurnActivity(items, true)).toEqual({
      label: "Running command",
      detail: "pnpm test --filter app",
      tone: "processing",
    });
  });

  it("surfaces file edit activity with a compact file summary", () => {
    const items: ConversationItem[] = [
      {
        id: "file-change",
        kind: "tool",
        toolType: "fileChange",
        title: "Tool: apply_patch",
        detail: "{}",
        status: "completed",
        changes: [{ path: "src/a.ts" }, { path: "src/b.ts" }],
      },
    ];

    expect(summarizeCurrentTurnActivity(items, false)).toEqual({
      label: "Files edited",
      detail: "a.ts +1",
      tone: "completed",
    });
  });

  it("prefers the latest reasoning label when that is the freshest current-turn item", () => {
    const items: ConversationItem[] = [
      {
        id: "tool-before",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg messages",
        detail: "/repo",
        status: "completed",
        output: "",
      },
      {
        id: "reasoning-latest",
        kind: "reasoning",
        summary: "Planning message rail\nReviewing status chips",
        content: "",
      },
    ];

    expect(summarizeCurrentTurnActivity(items, true)).toEqual({
      label: "Planning message rail",
      detail: "Reviewing status chips",
      tone: "processing",
    });
  });
});

describe("summarizeCurrentTurnArtifacts", () => {
  it("collects deduped changed files plus review and diff counts", () => {
    const items: ConversationItem[] = [
      {
        id: "file-change-1",
        kind: "tool",
        toolType: "fileChange",
        title: "Tool: apply_patch",
        detail: "{}",
        status: "completed",
        changes: [{ path: "src/a.ts" }, { path: "src/b.ts" }],
      },
      {
        id: "diff-1",
        kind: "diff",
        title: "src/a.ts",
        diff: "@@",
        status: "completed",
      },
      {
        id: "review-1",
        kind: "review",
        state: "completed",
        text: "Looks good",
      },
      {
        id: "file-change-2",
        kind: "tool",
        toolType: "fileChange",
        title: "Tool: apply_patch",
        detail: "{}",
        status: "completed",
        changes: [{ path: "src/b.ts" }, { path: "src/c.ts" }],
      },
    ];

    expect(summarizeCurrentTurnArtifacts(items)).toEqual({
      changedFiles: [
        { path: "src/a.ts", label: "a.ts" },
        { path: "src/b.ts", label: "b.ts" },
        { path: "src/c.ts", label: "c.ts" },
      ],
      diffCount: 1,
      reviewCount: 1,
    });
  });
});
