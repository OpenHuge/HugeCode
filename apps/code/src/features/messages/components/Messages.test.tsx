// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { Messages } from "./Messages";

const useFileLinkOpenerMock = vi.fn(
  (_workspacePath: string | null, _openTargets: unknown[], _selectedOpenAppId: string) => ({
    openFileLink: openFileLinkMock,
    showFileLinkMenu: showFileLinkMenuMock,
  })
);
const openFileLinkMock = vi.fn();
const showFileLinkMenuMock = vi.fn();
const clipboardWriteTextMock = vi.fn<(value: string) => Promise<void>>();

vi.mock("../hooks/useFileLinkOpener", () => ({
  useFileLinkOpener: (
    workspacePath: string | null,
    openTargets: unknown[],
    selectedOpenAppId: string
  ) => useFileLinkOpenerMock(workspacePath, openTargets, selectedOpenAppId),
}));

describe("Messages", () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useFileLinkOpenerMock.mockClear();
    openFileLinkMock.mockReset();
    showFileLinkMenuMock.mockReset();
    clipboardWriteTextMock.mockReset();
    clipboardWriteTextMock.mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteTextMock },
    });
  });

  it("renders image grid above message text and opens lightbox", async () => {
    const items: ConversationItem[] = [
      {
        id: "msg-1",
        kind: "message",
        role: "user",
        text: "Hello",
        images: ["data:image/png;base64,AAA"],
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const grid = container.querySelector(".message-image-grid");
    const markdownText = await screen.findByText("Hello");
    expect(grid).toBeTruthy();
    expect(markdownText).toBeTruthy();
    if (grid) {
      expect(grid.compareDocumentPosition(markdownText) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    }
    const openButton = screen.getByRole("button", { name: "Open image 1" });
    fireEvent.click(openButton);
    expect(screen.getByRole("dialog")).toBeTruthy();
  }, 20_000);

  it("does not render copy button for image-only messages", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-image-only",
        kind: "message",
        role: "assistant",
        text: "   ",
        images: ["data:image/png;base64,BBB"],
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-image-only"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.queryByRole("button", { name: "Copy message" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open image 1" })).toBeTruthy();
  });

  it("does not wrap message content in a button when timeline selection is enabled", async () => {
    const items: ConversationItem[] = [
      {
        id: "msg-semantic-assistant",
        kind: "message",
        role: "assistant",
        text: "Plain assistant reply",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-semantic-assistant"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect((await screen.findByText("Plain assistant reply")).closest("button")).toBeNull();
    expect(screen.getByRole("button", { name: "Copy message" })).toBeTruthy();
  });

  it("keeps request and response rows visually minimal without redundant role copy", async () => {
    const items: ConversationItem[] = [
      {
        id: "msg-header-user",
        kind: "message",
        role: "user",
        text: "Audit the runtime lane and summarize the launch blockers.",
      },
      {
        id: "msg-header-assistant",
        kind: "message",
        role: "assistant",
        text: "Two launch blockers remain: auth refresh and stale diagnostics.",
        images: ["data:image/png;base64,CCC"],
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-message-headers"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(
      await screen.findByText("Audit the runtime lane and summarize the launch blockers.")
    ).toBeTruthy();
    expect(
      screen.getByText("Two launch blockers remain: auth refresh and stale diagnostics.")
    ).toBeTruthy();
    expect(screen.queryByText("Prompt", { exact: true })).toBeNull();
    expect(screen.queryByText("Response", { exact: true })).toBeNull();
    expect(screen.queryByText("1 image", { exact: true })).toBeNull();
  });

  it("renders model switch system text as a dedicated meta notice row instead of a normal message row", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-meta-model-switch",
        kind: "message",
        role: "assistant",
        text: "Model changed from GPT-5.4 to GPT-5.3-Codex.",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-meta-model-switch"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const notice = screen.getByTestId("meta-notice-row");
    expect(notice.getAttribute("data-meta-notice-type")).toBe("modelSwitch");
    expect(screen.getByText("模型已从 GPT-5.4 切换到 GPT-5.3-Codex")).toBeTruthy();
    expect(
      screen.getByText("会话中途切换模型可能影响回答表现，且上下文可能会被压缩。")
    ).toBeTruthy();
    expect(screen.queryByText("Model changed from GPT-5.4 to GPT-5.3-Codex.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy message" })).toBeNull();
  });

  it("renders context compaction tool items as timeline meta notices", () => {
    const items: ConversationItem[] = [
      {
        id: "tool-meta-context",
        kind: "tool",
        toolType: "contextCompaction",
        title: "Context compaction",
        detail: "Compacting conversation context to fit token limits.",
        status: "completed",
        output: "",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-meta-context"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const notice = screen.getByTestId("meta-notice-row");
    expect(notice.getAttribute("data-meta-notice-type")).toBe("contextCompaction");
    expect(screen.getByText("上下文已整理")).toBeTruthy();
    expect(
      screen.getByText("为继续当前会话，部分上下文可能已被压缩，后续回答可能受影响。")
    ).toBeTruthy();
    expect(screen.queryByText("Context compaction")).toBeNull();
  });

  it("shows copied state only when message copy succeeds", async () => {
    const items: ConversationItem[] = [
      {
        id: "msg-copy-success",
        kind: "message",
        role: "assistant",
        text: "Copy this content",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-copy-success"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const button = screen.getByRole("button", { name: "Copy message" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith("Copy this content");
      expect(container.querySelector(".message-copy-button")?.className ?? "").toContain(
        "is-copied"
      );
    });
  });

  it("shows an edit button for user messages and forwards the message payload", () => {
    const onEditMessage = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "msg-edit-user",
        kind: "message",
        role: "user",
        text: "Please revise this prompt",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-edit-user"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onEditMessage={onEditMessage}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
    expect(onEditMessage).toHaveBeenCalledWith(items[0]);
  });

  it("does not render an edit button for assistant messages", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-edit-assistant",
        kind: "message",
        role: "assistant",
        text: "Assistant response",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-edit-assistant"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.queryByRole("button", { name: "Edit message" })).toBeNull();
  });

  it("exposes a stable message role attribute for timeline rows", async () => {
    const items: ConversationItem[] = [
      {
        id: "msg-role-user",
        kind: "message",
        role: "user",
        text: "User prompt",
      },
      {
        id: "msg-role-assistant",
        kind: "message",
        role: "assistant",
        text: "Assistant reply",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-message-role"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    await screen.findByText("Assistant reply");
    expect(container.querySelector('[data-message-role="user"]')?.textContent ?? "").toContain(
      "User prompt"
    );
    expect(container.querySelector('[data-message-role="assistant"]')?.textContent ?? "").toContain(
      "Assistant reply"
    );
  });

  it("keeps the ready empty state during background refresh after an empty thread has settled", () => {
    const { rerender } = render(
      <Messages
        items={[]}
        threadId="thread-empty-refresh"
        workspaceId="ws-1"
        isThinking={false}
        isLoadingMessages={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByText("Continue in the composer.")).toBeTruthy();
    expect(screen.getByText("Skills")).toBeTruthy();
    expect(screen.getByText("Commands")).toBeTruthy();
    expect(screen.getByText("Mentions")).toBeTruthy();
    expect(document.querySelector('[data-core-loop-state-panel="true"]')).toBeTruthy();
    expect(screen.queryByText("Loading this thread")).toBeNull();

    rerender(
      <Messages
        items={[]}
        threadId="thread-empty-refresh"
        workspaceId="ws-1"
        isThinking={false}
        isLoadingMessages
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByText("Continue in the composer.")).toBeTruthy();
    expect(screen.queryByText("Loading this thread")).toBeNull();
  });

  it("shows the loading empty state for an empty thread before the first resume completes", () => {
    render(
      <Messages
        items={[]}
        threadId="thread-empty-initial-load"
        workspaceId="ws-1"
        isThinking={false}
        isLoadingMessages
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByText("Loading this thread")).toBeTruthy();
    expect(document.querySelector('[data-core-loop-tone="loading"]')).toBeTruthy();
    expect(screen.queryByText("Continue in the composer.")).toBeNull();
  });

  it("teaches real composer syntax when starting a brand-new agent", () => {
    render(
      <Messages
        items={[]}
        threadId={null}
        workspaceId="ws-new"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByText("Start in the composer.")).toBeTruthy();
    expect(screen.getByText("Skills")).toBeTruthy();
    expect(screen.getByText("Commands")).toBeTruthy();
    expect(screen.getByText("Mentions")).toBeTruthy();
  });

  it("keeps the thread empty state on a flatter shell instead of a glowing hero card", () => {
    const source = readFileSync(resolve(import.meta.dirname, "Messages.styles.css.ts"), "utf8");

    expect(source).not.toContain("radial-gradient(circle");
    expect(source).not.toContain('filter: "blur(16px)"');
    expect(source).not.toContain('borderRadius: "32px"');
    expect(source).not.toContain("linear-gradient(145deg");
    expect(source).not.toContain(
      'boxShadow: "0 18px 32px -28px color-mix(in srgb, var(--ds-shadow-color) 18%, transparent)"'
    );
  });

  it("keeps message rows on flatter surfaces instead of glassy raised cards", () => {
    const source = readFileSync(resolve(import.meta.dirname, "MessageRows.styles.css.ts"), "utf8");

    expect(source).not.toContain('backdropFilter: "blur(10px)"');
    expect(source).not.toContain('backdropFilter: "blur(12px)"');
    expect(source).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 94%, transparent), color-mix(in srgb, var(--ds-surface-command) 76%, transparent))"
    );
    expect(source).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card-base) 97%, transparent), color-mix(in srgb, var(--ds-surface-muted) 72%, transparent))"
    );
    expect(source).not.toContain(
      'boxShadow: "0 10px 22px -24px color-mix(in srgb, var(--ds-shadow-color) 18%, transparent)"'
    );
    expect(source).not.toContain(
      '"inset 0 0 0 1px color-mix(in srgb, var(--ds-panel-border) 88%, transparent), 0 0 0 3px color-mix(in srgb, var(--ds-panel-focus-ring) 20%, transparent)"'
    );
  });

  it("keeps rich content cards on muted shell surfaces instead of gradient promo cards", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "MessagesRichContent.global.css.ts"),
      "utf8"
    );

    expect(source).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card-base) 99%, transparent) 0%, color-mix(in srgb, var(--ds-surface-muted) 18%, var(--ds-surface-card-base)) 100%)"
    );
    expect(source).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card-base) 99%, transparent) 0%, color-mix(in srgb, var(--ds-surface-command) 6%, var(--ds-surface-card-base)) 100%)"
    );
    expect(source).not.toContain(
      '"0 10px 20px -18px color-mix(in srgb, var(--ds-color-black) 8%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 4%, transparent)"'
    );
    expect(source).not.toContain(
      '"0 8px 16px -16px color-mix(in srgb, var(--ds-color-black) 8%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 3%, transparent)"'
    );
    expect(source).not.toContain("radial-gradient(circle at 35% 35%");
    expect(source).not.toContain(
      'boxShadow: "0 2px 8px color-mix(in srgb, var(--ds-color-black) 4%, transparent)"'
    );
    expect(source).not.toContain(
      'boxShadow: "0 0 0 5px color-mix(in srgb, var(--ds-brand-primary) 10%, transparent)"'
    );
    expect(source).not.toContain(
      'boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 6%, transparent)"'
    );
    expect(source).not.toContain(
      '"inset 0 0 0 1px color-mix(in srgb, var(--ds-panel-border) 88%, transparent), 0 0 0 3px color-mix(in srgb, var(--ds-panel-focus-ring) 18%, transparent)"'
    );
    expect(source).not.toContain(
      'boxShadow: "0 0 0 4px color-mix(in srgb, var(--ds-brand-primary) 10%, transparent)"'
    );
    expect(source).not.toContain(
      'boxShadow: "0 0 0 3px color-mix(in srgb, var(--ds-brand-primary) 8%, transparent)"'
    );
    expect(source).not.toContain("message-skill-link");
    expect(source).not.toContain("skillReferenceLink");
  });

  it("keeps tool output overflow local instead of creating a horizontal scrollbar on the whole message lane", () => {
    const messagesSource = readFileSync(
      resolve(import.meta.dirname, "Messages.styles.css.ts"),
      "utf8"
    );
    const richContentSource = readFileSync(
      resolve(import.meta.dirname, "MessagesRichContent.global.css.ts"),
      "utf8"
    );
    const markdownSource = readFileSync(
      resolve(import.meta.dirname, "Markdown.styles.css.ts"),
      "utf8"
    );

    expect(messagesSource).toContain('overflowX: "hidden"');
    expect(richContentSource).toContain('feature(".tool-inline-output", {');
    expect(richContentSource).toContain('overflow: "hidden"');
    expect(markdownSource).toContain('globalStyle(".tool-inline-output pre", {');
    expect(markdownSource).toContain('whiteSpace: "pre-wrap"');
    expect(markdownSource).toContain('overflowX: "auto"');
  });

  it("caps expanded tool details and terminal output with local scrolling", () => {
    const richContentSource = readFileSync(
      resolve(import.meta.dirname, "MessagesRichContent.global.css.ts"),
      "utf8"
    );

    expect(richContentSource).toContain('feature(".tool-inline-detail", {');
    expect(richContentSource).toContain('maxHeight: "min(32vh, 280px)"');
    expect(richContentSource).toContain('overflowY: "auto"');
    expect(richContentSource).toContain('overscrollBehavior: "contain"');
    expect(richContentSource).toContain('feature(".tool-inline-terminal-lines", {');
    expect(richContentSource).toContain('maxHeight: "min(32vh, 260px)"');
    expect(richContentSource).toContain('feature(".command-inline .tool-inline-terminal-lines", {');
    expect(richContentSource).toContain('maxHeight: "min(42vh, 360px)"');
    expect(richContentSource).toContain('scrollbarGutter: "stable"');
  });

  it("keeps markdown paragraph rhythm compact enough for chat-style reading", () => {
    const markdownSource = readFileSync(
      resolve(import.meta.dirname, "Markdown.styles.css.ts"),
      "utf8"
    );

    expect(markdownSource).toContain('margin: "12px 0"');
    expect(markdownSource).toContain("globalStyle(`.${markdown} p`, {");
    expect(markdownSource).toContain('marginBottom: "12px"');
    expect(markdownSource).toContain("globalStyle(`.${markdown} ul, .${markdown} ol`, {");
    expect(markdownSource).toContain("globalStyle(`.${markdown} li`, {");
    expect(markdownSource).toContain('lineHeight: "var(--line-height-content)"');
    expect(markdownSource).not.toContain('marginBottom: "24px"');
  });

  it("exposes thread history loading state for restore-aware tests", () => {
    const { rerender } = render(
      <Messages
        items={[]}
        threadId="thread-history-loading"
        workspaceId="ws-1"
        isThinking={false}
        isLoadingMessages
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByTestId("messages-root").getAttribute("data-thread-history-loading")).toBe(
      "true"
    );

    rerender(
      <Messages
        items={[
          {
            id: "assistant-loaded",
            kind: "message",
            role: "assistant",
            text: "Loaded",
          },
        ]}
        threadId="thread-history-loading"
        workspaceId="ws-1"
        isThinking={false}
        isLoadingMessages={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByTestId("messages-root").getAttribute("data-thread-history-loading")).toBe(
      "false"
    );
  });

  it("does not show copied state when clipboard write fails", async () => {
    clipboardWriteTextMock.mockRejectedValueOnce(new Error("clipboard unavailable"));
    const items: ConversationItem[] = [
      {
        id: "msg-copy-failed",
        kind: "message",
        role: "assistant",
        text: "Cannot copy this now",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-copy-failed"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const button = screen.getByRole("button", { name: "Copy message" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith("Cannot copy this now");
    });
    expect(container.querySelector(".message-copy-button")?.className ?? "").not.toContain(
      "is-copied"
    );
  });

  it("copies ordinary runtime tool details without planner diagnostics", async () => {
    const items: ConversationItem[] = [
      {
        id: "tool-copy",
        kind: "tool",
        toolType: "mcpToolCall",
        title: "Tool: runtime / read",
        detail: JSON.stringify(
          {
            path: "src/components/thread/ThreadMessage.tsx",
            plannerDiagnostics: {
              diagnostics: [
                {
                  code: "planner.missing_success_criteria",
                  severity: "warning",
                  message: "Add explicit verification step.",
                },
              ],
            },
          },
          null,
          2
        ),
        status: "failed",
        output: "batch: turn-123\nattempt: 1",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-tool-copy"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle tool details" }));
    const copyButton = screen.getByRole("button", { name: "Copy tool message" });
    expect((copyButton as HTMLButtonElement).type).toBe("button");
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledTimes(1);
    });
    const copiedText = clipboardWriteTextMock.mock.calls[0]?.[0] ?? "";
    expect(copiedText).toContain("Tool: runtime / read");
    expect(copiedText).toContain("Status: Failed");
    expect(copiedText).toContain('"path": "src/components/thread/ThreadMessage.tsx"');
    expect(copiedText).not.toContain("Planner diagnostics:");
    expect(copiedText).not.toContain("WARNING planner.missing_success_criteria");
    expect(copiedText).not.toContain('"plannerDiagnostics"');

    await waitFor(() => {
      expect(
        container.querySelector('[aria-label="Copy tool message"]')?.getAttribute("title")
      ).toBe("Copied");
    });
  });

  it("copies runtime bash tools with the simplified command summary", async () => {
    const items: ConversationItem[] = [
      {
        id: "tool-bash-copy",
        kind: "tool",
        toolType: "mcpToolCall",
        title: "Tool: runtime / bash",
        detail: JSON.stringify({
          command: "Get-ChildItem -Name; rg --files -g package.json src apps packages .",
          shellFamily: "powershell",
          effectiveAccessMode: "full-access",
          sandboxed: false,
          exitCode: 1,
          batchId: "turn-123:runtime-plan-batch",
          attempt: 1,
        }),
        status: "failed",
        output: "Access is denied.",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-tool-bash-copy"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle tool details" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy tool message" }));

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledTimes(1);
    });
    const copiedText = clipboardWriteTextMock.mock.calls[0]?.[0] ?? "";
    expect(copiedText).toContain("Tool: runtime / bash");
    expect(copiedText).toContain(
      "Get-ChildItem -Name; rg --files -g package.json src apps packages ."
    );
    expect(copiedText).toContain("shell: powershell");
    expect(copiedText).not.toContain('"command"');
    expect(copiedText).not.toContain("batchId");
    expect(copiedText).not.toContain("attempt");
  });

  it("clears copied state when switching threads", async () => {
    const items: ConversationItem[] = [
      {
        id: "msg-shared-id",
        kind: "message",
        role: "assistant",
        text: "Same id across threads",
      },
    ];

    const { container, rerender } = render(
      <Messages
        items={items}
        threadId="thread-a"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    await waitFor(() => {
      expect(container.querySelector(".message-copy-button")?.className ?? "").toContain(
        "is-copied"
      );
    });

    rerender(
      <Messages
        items={items}
        threadId="thread-b"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(container.querySelector(".message-copy-button")?.className ?? "").not.toContain(
      "is-copied"
    );
  });

  it("renders running commands inside a shell-style card", () => {
    const items: ConversationItem[] = [
      {
        id: "command-shell-card",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: bash -lc 'cd /repo && pnpm validate:fast'",
        detail: "/repo",
        status: "running",
        durationMs: 95_000,
        output: "src/a.ts\nsrc/b.ts",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-command-shell-card"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByText("Running command for 1m 35s")).toBeTruthy();
    expect(screen.getByRole("button", { name: /toggle tool details/i })).toBeTruthy();
    expect(screen.getByText("Shell")).toBeTruthy();
    expect(screen.queryByText("pnpm validate:fast")).toBeNull();
    expect(screen.getByText("src/a.ts")).toBeTruthy();
    expect(screen.queryByText("Show details")).toBeNull();
    expect(container.querySelector(".command-inline")).toBeTruthy();
  });

  it("shows completed short command output without requiring expansion", () => {
    const items: ConversationItem[] = [
      {
        id: "command-shell-complete",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git rev-parse --short HEAD",
        detail: "/repo",
        status: "completed",
        durationMs: 120,
        output: "65b230e9",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-command-shell-complete"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByText("Command finished in 0s")).toBeTruthy();
    expect(screen.queryByText("git rev-parse --short HEAD")).toBeNull();
    expect(screen.getByText("65b230e9")).toBeTruthy();
    expect(container.querySelector(".command-inline")).toBeTruthy();
  });

  it("reveals the raw command only after expanding shell details", () => {
    render(
      <Messages
        items={[
          {
            id: "command-shell-expand",
            kind: "tool",
            toolType: "commandExecution",
            title: "Command: bash -lc 'cd /repo && pnpm validate:fast'",
            detail: "/repo",
            status: "completed",
            durationMs: 2200,
            output: "ok",
          },
        ]}
        threadId="thread-command-shell-expand"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.queryByText("pnpm validate:fast")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /toggle tool details/i }));

    expect(screen.getByText("pnpm validate:fast")).toBeTruthy();
    expect(screen.getAllByText("/repo").length).toBeGreaterThan(0);
  });

  it("keeps collapsed tool invocation summaries on a single-line clamp", () => {
    const { container } = render(
      <Messages
        items={[
          {
            id: "generic-tool-long",
            kind: "tool",
            toolType: "mcpToolCall",
            title: "Tool: workspace / bash",
            detail:
              '{"command":"pnpm exec vitest run src/features/messages/components/Messages.test.tsx --reporter=verbose"}',
            status: "completed",
            output: "",
          },
        ]}
        threadId="thread-tool-single-line"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(container.querySelector(".tool-inline-single-line")).toBeTruthy();
  });

  it("preserves newlines when images are attached", async () => {
    const items: ConversationItem[] = [
      {
        id: "msg-2",
        kind: "message",
        role: "user",
        text: "Line 1\n\n- item 1\n- item 2",
        images: ["data:image/png;base64,AAA"],
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    await waitFor(() => {
      const markdown = container.querySelector(".markdown");
      expect(markdown).toBeTruthy();
      expect(markdown?.textContent ?? "").toContain("Line 1");
      expect(markdown?.textContent ?? "").toContain("item 1");
      expect(markdown?.textContent ?? "").toContain("item 2");
    });
  });

  it("renders highlighted code blocks without waiting for post-render DOM mutation", async () => {
    const items: ConversationItem[] = [
      {
        id: "msg-code",
        kind: "message",
        role: "assistant",
        text: "```tsx\nconst answer = 42;\n```",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-code"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    await waitFor(() => {
      const code = container.querySelector("pre code.language-tsx");
      expect(code).toBeTruthy();
      expect(code?.innerHTML ?? "").toContain("token keyword");
      expect(code?.textContent ?? "").toContain("const answer = 42;");
    });
  });

  it("keeps code blocks highlighted across streaming rerenders", async () => {
    const firstItems: ConversationItem[] = [
      {
        id: "msg-code-stream",
        kind: "message",
        role: "assistant",
        text: "```tsx\nconst answer = 42;\n```",
      },
    ];
    const nextItems: ConversationItem[] = [
      {
        id: "msg-code-stream",
        kind: "message",
        role: "assistant",
        text: "```tsx\nconst answer = 42;\nconst next = answer + 1;\n```",
      },
    ];

    const { container, rerender } = render(
      <Messages
        items={firstItems}
        threadId="thread-code-stream"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    await waitFor(() => {
      const code = container.querySelector("pre code.language-tsx");
      expect(code).toBeTruthy();
      expect(code?.innerHTML ?? "").toContain("token keyword");
      expect(code?.textContent ?? "").toContain("const answer = 42;");
    });

    rerender(
      <Messages
        items={nextItems}
        threadId="thread-code-stream"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    await waitFor(() => {
      const code = container.querySelector("pre code.language-tsx");
      expect(code).toBeTruthy();
      expect(code?.innerHTML ?? "").toContain("token keyword");
      expect(code?.textContent ?? "").toContain("const next = answer + 1;");
    });
  });

  it("keeps literal [image] text when images are attached", async () => {
    const items: ConversationItem[] = [
      {
        id: "msg-3",
        kind: "message",
        role: "user",
        text: "Literal [image] token",
        images: ["data:image/png;base64,AAA"],
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    await screen.findByText("Literal [image] token");
    const markdown = container.querySelector(".markdown");
    expect(markdown?.textContent ?? "").toContain("Literal [image] token");
  });

  it("opens linked review thread when clicking thread link", async () => {
    await import("./Markdown");

    const onOpenThreadLink = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "msg-thread-link",
        kind: "message",
        role: "assistant",
        text: "Detached review completed. [Open review thread](/thread/thread-review-1)",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-parent"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onOpenThreadLink={onOpenThreadLink}
      />
    );

    const reviewLink = await waitFor(() => {
      const link = container.querySelector('a[href="/thread/thread-review-1"]');
      expect(link).toBeTruthy();
      return link as HTMLAnchorElement;
    });
    fireEvent.click(reviewLink);
    expect(onOpenThreadLink).toHaveBeenCalledWith("thread-review-1");
  });

  it("renders file references as compact links and opens them", async () => {
    const items: ConversationItem[] = [
      {
        id: "msg-file-link",
        kind: "message",
        role: "assistant",
        text: "Refactor candidate: `iosApp/src/views/DocumentsList/DocumentListView.swift:111`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const fileLinkName = await screen.findByText("DocumentListView.swift");
    const fileLinkLine = await screen.findByText("L111");
    const fileLinkPath = await screen.findByText("in iosApp/src/views/DocumentsList");
    const fileLink = await waitFor(() => {
      const link = container.querySelector(".message-file-link");
      expect(link).toBeTruthy();
      return link as HTMLElement;
    });
    expect(fileLinkName).toBeTruthy();
    expect(fileLinkLine).toBeTruthy();
    expect(fileLinkPath).toBeTruthy();

    fireEvent.click(fileLink);
    expect(openFileLinkMock).toHaveBeenCalledWith(
      "iosApp/src/views/DocumentsList/DocumentListView.swift:111"
    );
  });

  it("hides file parent paths when message file path display is disabled", async () => {
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-hidden-path",
        kind: "message",
        role: "assistant",
        text: "Refactor candidate: `iosApp/src/views/DocumentsList/DocumentListView.swift:111`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        showMessageFilePath={false}
      />
    );

    await screen.findByText("DocumentListView.swift");
    const fileName = container.querySelector(".message-file-link-name");
    const lineLabel = container.querySelector(".message-file-link-line");
    expect(fileName?.textContent).toBe("DocumentListView.swift");
    expect(lineLabel?.textContent).toBe("L111");
    expect(container.querySelector(".message-file-link-path")).toBeNull();
  });

  it("renders short relative paths with a readable parent path label", async () => {
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-short-relative",
        kind: "message",
        role: "assistant",
        text: "Update `src/App.jsx` and `src/App.css`.",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(await screen.findByText("App.jsx")).toBeTruthy();
    expect(await screen.findByText("App.css")).toBeTruthy();
    expect(await screen.findAllByText("in src")).toHaveLength(2);
  });

  it("renders absolute file references as workspace-relative paths", async () => {
    const workspacePath = "/Users/dimillian/Documents/Dev/CodexMonitor";
    const absolutePath =
      "/Users/dimillian/Documents/Dev/CodexMonitor/src/features/messages/components/Markdown.tsx:244";
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-absolute-inside",
        kind: "message",
        role: "assistant",
        text: `Reference: \`${absolutePath}\``,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        workspacePath={workspacePath}
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(await screen.findByText("Markdown.tsx")).toBeTruthy();
    expect(await screen.findByText("L244")).toBeTruthy();
    expect(await screen.findByText("in src/features/messages/components")).toBeTruthy();

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink).toBeTruthy();
    fireEvent.click(fileLink as Element);
    expect(openFileLinkMock).toHaveBeenCalledWith(absolutePath);
  });

  it("renders absolute file references outside workspace using dotdot-relative paths", async () => {
    const workspacePath = "/Users/dimillian/Documents/Dev/CodexMonitor";
    const absolutePath = "/Users/dimillian/Documents/Other/IceCubesApp/file.rs:123";
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-absolute-outside",
        kind: "message",
        role: "assistant",
        text: `Reference: \`${absolutePath}\``,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        workspacePath={workspacePath}
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(await screen.findByText("file.rs")).toBeTruthy();
    expect(await screen.findByText("L123")).toBeTruthy();
    expect(await screen.findByText("in ../../Other/IceCubesApp")).toBeTruthy();

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink).toBeTruthy();
    fireEvent.click(fileLink as Element);
    expect(openFileLinkMock).toHaveBeenCalledWith(absolutePath);
  });

  it("renders Windows extended-length file references using normalized display paths", async () => {
    const workspacePath = "\\\\?\\C:\\Dev\\demo";
    const absolutePath = "\\\\?\\C:\\Dev\\demo\\src\\chain-check.txt:7";
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-windows-device-path",
        kind: "message",
        role: "assistant",
        text: `Reference: ${absolutePath}`,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        workspacePath={workspacePath}
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(await screen.findByText("chain-check.txt")).toBeTruthy();
    expect(await screen.findByText("L7")).toBeTruthy();
    expect(await screen.findByText("in src")).toBeTruthy();
    expect(container.textContent).not.toContain("\\?\\");

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink).toBeTruthy();
    fireEvent.click(fileLink as Element);
    expect(openFileLinkMock).toHaveBeenCalledWith("C:\\Dev\\demo\\src\\chain-check.txt:7");
  });

  it("preserves the full normalized path when a message only contains a file reference", async () => {
    const workspacePath = "\\\\?\\C:\\Dev\\demo";
    const absolutePath = "\\\\?\\C:\\Dev\\demo\\chain-check.txt";
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-standalone-device-path",
        kind: "message",
        role: "assistant",
        text: absolutePath,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        workspacePath={workspacePath}
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(await screen.findByText("C:\\Dev\\demo\\chain-check.txt")).toBeTruthy();
    expect(container.querySelector(".message-file-link-line")).toBeNull();
    expect(container.querySelector(".message-file-link-path")).toBeNull();

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink).toBeTruthy();
    fireEvent.click(fileLink as Element);
    expect(openFileLinkMock).toHaveBeenCalledWith("C:\\Dev\\demo\\chain-check.txt");
  });

  it("collapses duplicate read labeling for simple file-read tool rows", async () => {
    const items: ConversationItem[] = [
      {
        id: "tool-read-file",
        kind: "tool",
        toolType: "mcpToolCall",
        title: "Tool: workspace / read",
        detail: JSON.stringify({ path: "chain-check.txt" }),
        status: "completed",
        output: "",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-tool-read-file"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(await screen.findByText("chain-check.txt")).toBeTruthy();
    expect(screen.getAllByText("Read")).toHaveLength(1);
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.queryByText("Show details")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Toggle tool details" }));

    expect(screen.getAllByText(/"path": "chain-check\.txt"/)).toHaveLength(1);
  });

  it("does not re-render messages while typing when message props stay stable", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-stable-1",
        kind: "message",
        role: "assistant",
        text: "Stable content",
      },
    ];
    const openTargets: [] = [];
    function Harness() {
      const [draft, setDraft] = useState("");
      const handleOpenThreadLink = useCallback(() => undefined, []);

      return (
        <div>
          <input
            aria-label="Draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Messages
            items={items}
            threadId="thread-stable"
            workspaceId="ws-1"
            isThinking={false}
            openTargets={openTargets}
            selectedOpenAppId=""
            onOpenThreadLink={handleOpenThreadLink}
          />
        </div>
      );
    }

    render(<Harness />);
    expect(useFileLinkOpenerMock).toHaveBeenCalledTimes(1);
    const input = screen.getByLabelText("Draft");
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.change(input, { target: { value: "abc" } });

    expect(useFileLinkOpenerMock).toHaveBeenCalledTimes(1);
  });

  it("uses reasoning title for the working indicator and keeps current-turn title-only rows collapsed", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-1",
        kind: "reasoning",
        summary: "Scanning repository",
        content: "",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Scanning repository");
    expect(container.querySelector(".reasoning-block")).toBeTruthy();
    expect(container.querySelector(".reasoning-content")).toBeNull();
  });

  it("renders reasoning rows when there is reasoning body content", async () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-2",
        kind: "reasoning",
        summary: "Scanning repository\nLooking for entry points",
        content: "",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 2_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(container.querySelector(".reasoning-block")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Scanning repository/i }));
    await waitFor(() => {
      expect(container.querySelector(".reasoning-content .markdown")).toBeTruthy();
    });
    const reasoningDetail = container.querySelector(".reasoning-content .markdown");
    expect(reasoningDetail?.textContent ?? "").toContain("Looking for entry points");
    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Scanning repository");
  });

  it("uses content for the reasoning title when summary is empty", async () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-content-title",
        kind: "reasoning",
        summary: "",
        content: "Plan from content\nMore detail here",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_500}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Plan from content");
    fireEvent.click(screen.getByRole("button", { name: /Plan from content/i }));
    await waitFor(() => {
      expect(container.querySelector(".reasoning-content .markdown")).toBeTruthy();
    });
    const reasoningDetail = container.querySelector(".reasoning-content .markdown");
    expect(reasoningDetail?.textContent ?? "").toContain("More detail here");
    expect(reasoningDetail?.textContent ?? "").not.toContain("Plan from content");
  });

  it("does not show a stale reasoning label from a previous turn", () => {
    const items: ConversationItem[] = [
      {
        id: "user-old",
        kind: "message",
        role: "user",
        text: "Old request",
      },
      {
        id: "reasoning-old",
        kind: "reasoning",
        summary: "Old reasoning title",
        content: "",
      },
      {
        id: "assistant-old",
        kind: "message",
        role: "assistant",
        text: "Previous assistant response",
      },
      {
        id: "user-current",
        kind: "message",
        role: "user",
        text: "Current request",
      },
      {
        id: "tool-current",
        kind: "tool",
        title: "Check current turn",
        detail: "",
        toolType: "commandExecution",
        output: "",
        status: "running",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 800}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Working");
    expect(workingText?.textContent ?? "").not.toContain("Old reasoning title");
  });

  it("keeps the latest title-only reasoning label while rendering the current-turn reasoning row", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-title-only",
        kind: "reasoning",
        summary: "Indexing workspace",
        content: "",
      },
      {
        id: "tool-after-reasoning",
        kind: "tool",
        title: "Command: rg --files",
        detail: "/tmp",
        toolType: "commandExecution",
        output: "",
        status: "running",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Indexing workspace");
    expect(container.querySelector(".reasoning-block")).toBeTruthy();
  });

  it("keeps historical title-only reasoning rows hidden", () => {
    const items: ConversationItem[] = [
      {
        id: "user-old",
        kind: "message",
        role: "user",
        text: "Old request",
      },
      {
        id: "reasoning-old",
        kind: "reasoning",
        summary: "Old hidden reasoning",
        content: "",
      },
      {
        id: "assistant-old",
        kind: "message",
        role: "assistant",
        text: "Old response",
      },
      {
        id: "user-current",
        kind: "message",
        role: "user",
        text: "Current request",
      },
      {
        id: "tool-current",
        kind: "tool",
        title: "Check",
        detail: "",
        toolType: "commandExecution",
        output: "",
        status: "running",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_200}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.queryByText("Old hidden reasoning")).toBeNull();
    expect(container.querySelectorAll(".reasoning-block")).toHaveLength(0);
  });
});
