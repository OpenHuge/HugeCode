// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { Messages } from "./Messages";
import * as styles from "./Messages.styles.css";

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
  function getToolSummaryButton(summaryValue: string) {
    const button = screen
      .getAllByRole("button")
      .find(
        (candidate) =>
          candidate.textContent?.includes(summaryValue) ||
          candidate.getAttribute("aria-label")?.includes(summaryValue)
      );
    if (!button) {
      throw new Error(`Expected tool summary button for ${summaryValue}`);
    }
    return button;
  }

  function getMessagesRoot() {
    return screen.getByTestId("messages-root");
  }

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

  it("surfaces current-turn activity in the working indicator without duplicating a sticky progress rail", () => {
    const items: ConversationItem[] = [
      {
        id: "turn-user",
        kind: "message",
        role: "user",
        text: "Refactor this flow",
      },
      {
        id: "turn-reasoning",
        kind: "reasoning",
        summary: "Planning changes",
        content: "",
      },
      {
        id: "turn-file-change",
        kind: "tool",
        toolType: "fileChange",
        title: "Tool: apply patch",
        detail: "{}",
        status: "completed",
        changes: [{ path: "src/a.ts" }, { path: "src/b.ts" }],
      },
      {
        id: "turn-assistant",
        kind: "message",
        role: "assistant",
        text: "Refactor finished.",
      },
    ];

    render(
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

    expect(screen.queryByTestId("turn-progress")).toBeNull();
    const workingSummary = document.querySelector(".working-text-enhanced");
    expect(workingSummary?.textContent ?? "").toContain("Planning changes");
    expect(workingSummary?.textContent ?? "").toContain("Drafting reply");
    expect(workingSummary?.textContent ?? "").toContain("Refactor finished.");
    expect(screen.getByLabelText(/1 tool call, 1 reasoning step/i)).toBeTruthy();
    expect(screen.getAllByText("a.ts +1").length).toBeGreaterThan(0);

    fireEvent.click(getToolSummaryButton("a.ts +1"));

    expect(screen.getAllByText("src/a.ts").length).toBeGreaterThan(0);
    expect(screen.getByText("src/b.ts")).toBeTruthy();
    expect(document.querySelector(".working-text-enhanced")?.textContent ?? "").toContain(
      "Planning changes"
    );
    expect(document.querySelector(".working-text-enhanced")?.textContent ?? "").toContain(
      "Drafting reply"
    );
    expect(document.querySelector(".working-text-enhanced")?.textContent ?? "").toContain(
      "Refactor finished."
    );
  });

  it("uses the latest tool activity label in the divider and working summary", () => {
    const items: ConversationItem[] = [
      {
        id: "history-user",
        kind: "message",
        role: "user",
        text: "Previous turn",
      },
      {
        id: "history-assistant",
        kind: "message",
        role: "assistant",
        text: "Previous answer",
      },
      {
        id: "current-user",
        kind: "message",
        role: "user",
        text: "Run checks",
      },
      {
        id: "current-command",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: bash -lc 'cd /repo && pnpm validate:fast'",
        detail: "/repo",
        status: "running",
        output: "",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 900}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByTestId("current-turn-divider").textContent).toContain("Running command");
    expect(screen.queryByTestId("turn-progress")).toBeNull();
    expect(screen.getAllByText("pnpm validate:fast")).toHaveLength(1);
    expect(container.querySelector(".working-text-enhanced")?.textContent ?? "").toContain(
      "Running command"
    );
    expect(container.querySelector(".working-text-enhanced")?.textContent ?? "").toContain(
      "pnpm validate:fast"
    );
    expect(screen.queryByTestId("current-turn-summary")).toBeNull();
  });

  it("surfaces current-turn review and diff artifacts without a duplicate summary card", () => {
    const items: ConversationItem[] = [
      {
        id: "history-user",
        kind: "message",
        role: "user",
        text: "Earlier turn",
      },
      {
        id: "history-assistant",
        kind: "message",
        role: "assistant",
        text: "Earlier answer",
      },
      {
        id: "current-user",
        kind: "message",
        role: "user",
        text: "Prepare review",
      },
      {
        id: "file-change",
        kind: "tool",
        toolType: "fileChange",
        title: "Tool: apply_patch",
        detail: "{}",
        status: "completed",
        changes: [
          { path: "src/a.ts" },
          { path: "src/b.ts" },
          { path: "src/c.ts" },
          { path: "src/d.ts" },
        ],
      },
      {
        id: "diff-ready",
        kind: "diff",
        title: "src/a.ts",
        diff: "@@",
        status: "completed",
      },
      {
        id: "review-ready",
        kind: "review",
        state: "completed",
        text: "Review complete",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 700}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByTestId("current-turn-divider").textContent).toContain("Review ready");
    expect(screen.queryByTestId("turn-progress")).toBeNull();
    expect(screen.queryByTestId("current-turn-summary")).toBeNull();
    expect(screen.getByText("a.ts +3")).toBeTruthy();

    fireEvent.click(getToolSummaryButton("a.ts +3"));

    expect(screen.getAllByText("src/a.ts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("src/b.ts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("src/c.ts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("src/d.ts").length).toBeGreaterThan(0);
    expect(screen.getByText("Review completed")).toBeTruthy();
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getByText("Diff")).toBeTruthy();
    expect(screen.getByText("Review")).toBeTruthy();
    expect(document.querySelector(".diff-title")?.textContent).toBe("src/a.ts");
    expect(screen.getByRole("button", { name: "Hide diff" })).toBeTruthy();
    expect(document.querySelector(".working-text-enhanced")?.textContent ?? "").toContain(
      "Review ready"
    );
    expect(document.querySelector(".working-text-enhanced")?.textContent ?? "").toContain(
      "Review complete"
    );
    expect(screen.getAllByText("src/a.ts").length).toBeGreaterThan(0);
    expect(screen.getByText("Review completed")).toBeTruthy();
  });

  it("shows changed files in the current-turn tool row without duplicate summary affordances", async () => {
    const items: ConversationItem[] = [
      {
        id: "history-user",
        kind: "message",
        role: "user",
        text: "Earlier turn",
      },
      {
        id: "history-assistant",
        kind: "message",
        role: "assistant",
        text: "Earlier answer",
      },
      {
        id: "current-user",
        kind: "message",
        role: "user",
        text: "Prepare review",
      },
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

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 700}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.queryByTestId("current-turn-summary")).toBeNull();
    expect(screen.queryByTestId("turn-progress")).toBeNull();
    expect(openFileLinkMock).not.toHaveBeenCalled();
    fireEvent.click(getToolSummaryButton("a.ts +1"));

    expect(screen.getByText("src/a.ts")).toBeTruthy();
    expect(screen.getByText("src/b.ts")).toBeTruthy();

    const copyButtons = screen.getAllByRole("button", { name: "Copy file path" });
    fireEvent.click(copyButtons[0] as HTMLButtonElement);

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith("src/a.ts");
    });
  });

  it("hides current-turn progress details when not thinking", () => {
    const items: ConversationItem[] = [
      {
        id: "turn-user-idle",
        kind: "message",
        role: "user",
        text: "Check status",
      },
      {
        id: "turn-tool-idle",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git status",
        detail: "{}",
        status: "completed",
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

    expect(screen.queryByTestId("current-turn-divider")).toBeNull();
  });

  it("merges consecutive explore items under a single explored block", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-1",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "search", label: "Find routes" }],
      },
      {
        id: "explore-2",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "routes.ts" }],
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
      expect(container.querySelector(".explore-inline")).toBeTruthy();
    });
    expect(screen.queryByText(/tool calls/i)).toBeNull();
    const exploreItems = container.querySelectorAll(".explore-inline-item");
    expect(exploreItems.length).toBe(2);
    expect(container.querySelector(".explore-inline-title")?.textContent ?? "").toContain(
      "Explored"
    );
  });

  it("uses the latest explore status when merging a consecutive run", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-started",
        kind: "explore",
        status: "exploring",
        entries: [{ kind: "search", label: "starting" }],
      },
      {
        id: "explore-finished",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "finished" }],
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
      expect(container.querySelectorAll(".explore-inline").length).toBe(1);
    });
    const exploreTitle = container.querySelector(".explore-inline-title");
    expect(exploreTitle?.textContent ?? "").toContain("Explored");
  });

  it("does not merge explore items across interleaved tools", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-a",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "search", label: "Find reducers" }],
      },
      {
        id: "tool-a",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg reducers",
        detail: "/repo",
        status: "completed",
        output: "",
      },
      {
        id: "explore-b",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "useThreadsReducer.ts" }],
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
      const exploreBlocks = container.querySelectorAll(".explore-inline");
      expect(exploreBlocks.length).toBe(2);
    });
    const exploreItems = container.querySelectorAll(".explore-inline-item");
    expect(exploreItems.length).toBe(2);
    expect(container.querySelectorAll('[data-kind="tool"]').length).toBe(1);
  });

  it("preserves chronology when reasoning with body appears between explore items", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-1",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "search", label: "first explore" }],
      },
      {
        id: "reasoning-body",
        kind: "reasoning",
        summary: "Reasoning title\nReasoning body",
        content: "",
      },
      {
        id: "explore-2",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "second explore" }],
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
      expect(container.querySelectorAll(".explore-inline").length).toBe(2);
    });
    const exploreBlocks = Array.from(container.querySelectorAll(".explore-inline"));
    const reasoningBlock = container.querySelector(".reasoning-block");
    expect(exploreBlocks.length).toBe(2);
    expect(reasoningBlock).toBeTruthy();
    const [firstExploreBlock, secondExploreBlock] = exploreBlocks;
    const firstBeforeReasoning =
      firstExploreBlock.compareDocumentPosition(reasoningBlock as Node) &
      Node.DOCUMENT_POSITION_FOLLOWING;
    const reasoningBeforeSecond =
      (reasoningBlock as Node).compareDocumentPosition(secondExploreBlock) &
      Node.DOCUMENT_POSITION_FOLLOWING;
    expect(firstBeforeReasoning).toBeTruthy();
    expect(reasoningBeforeSecond).toBeTruthy();
  });

  it("does not merge across message boundaries and does not drop messages", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-before",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "search", label: "before message" }],
      },
      {
        id: "assistant-msg",
        kind: "message",
        role: "assistant",
        text: "A message between explore blocks",
      },
      {
        id: "explore-after",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "after message" }],
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
      const exploreBlocks = container.querySelectorAll(".explore-inline");
      expect(exploreBlocks.length).toBe(2);
    });
    expect(screen.getByText("A message between explore blocks")).toBeTruthy();
  });

  it("counts explore entry steps in the tool group summary", async () => {
    const items: ConversationItem[] = [
      {
        id: "tool-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git status --porcelain=v1",
        detail: "/repo",
        status: "completed",
        output: "",
      },
      {
        id: "explore-steps-1",
        kind: "explore",
        status: "explored",
        entries: [
          { kind: "read", label: "Messages.tsx" },
          { kind: "search", label: "toolCount" },
        ],
      },
      {
        id: "explore-steps-2",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "types.ts" }],
      },
      {
        id: "tool-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git diff -- src/features/messages/components/Messages.tsx",
        detail: "/repo",
        status: "completed",
        output: "",
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

    await waitFor(() => {
      expect(screen.getByText("2 tool calls")).toBeTruthy();
    });
    expect(screen.getByText("2 tool calls")).toBeTruthy();
    expect(screen.getByText("3 explore steps")).toBeTruthy();
    expect(screen.queryByText("5 updates")).toBeNull();
  });

  it("shows separate update chips for tool, explore, and reasoning activity", async () => {
    const items: ConversationItem[] = [
      {
        id: "mixed-tool",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg --files",
        detail: "/repo",
        status: "completed",
        output: "",
      },
      {
        id: "mixed-reasoning",
        kind: "reasoning",
        summary: "Inspecting state\nChecking current render counters",
        content: "",
      },
      {
        id: "mixed-explore",
        kind: "explore",
        status: "explored",
        entries: [
          { kind: "search", label: "tool group summary" },
          { kind: "read", label: "Messages.tsx" },
        ],
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

    await waitFor(() => {
      expect(screen.getByText("1 tool call")).toBeTruthy();
    });
    expect(screen.getByText("1 tool call")).toBeTruthy();
    expect(screen.getByText("2 explore steps")).toBeTruthy();
    expect(screen.getByText("1 reasoning step")).toBeTruthy();
    const groupToggle = screen.getByRole("button", {
      name: /tool group: 1 tool call, 2 explore steps, 1 reasoning step/i,
    });
    const ariaLabel = groupToggle.getAttribute("aria-label") ?? "";
    expect(ariaLabel).toContain("1 tool call");
    expect(ariaLabel).toContain("2 explore steps");
    expect(ariaLabel).toContain("1 reasoning step");
    expect(ariaLabel).not.toContain("updates");
  });

  it("renders numbered explore step kinds for easier scan", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-numbered",
        kind: "explore",
        status: "explored",
        entries: [
          { kind: "search", label: "Find renderer" },
          { kind: "read", label: "Messages.tsx" },
        ],
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

    await waitFor(() => {
      expect(screen.getByText("1. Search")).toBeTruthy();
    });
    expect(screen.getByText("2. Read")).toBeTruthy();
  });

  it("re-pins to bottom on thread switch even when previous thread was scrolled up", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-shared",
        kind: "message",
        role: "assistant",
        text: "Shared tail",
      },
    ];

    const { container, rerender } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesNode = container.querySelector(".messages.messages-full");
    expect(messagesNode).toBeTruthy();
    const scrollNode = messagesNode as HTMLDivElement;

    Object.defineProperty(scrollNode, "clientHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      value: 600,
    });
    scrollNode.scrollTop = 100;
    fireEvent.scroll(scrollNode);

    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      value: 900,
    });

    rerender(
      <Messages
        items={items}
        threadId="thread-2"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(scrollNode.scrollTop).toBe(900);
  });

  it("shows jump-to-latest and pending updates while scrolled away from bottom", async () => {
    const initialItems: ConversationItem[] = [
      {
        id: "msg-scroll-1",
        kind: "message",
        role: "assistant",
        text: "First response",
      },
    ];

    const { container, rerender } = render(
      <Messages
        items={initialItems}
        threadId="thread-scroll"
        workspaceId="ws-1"
        isThinking
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesNode = container.querySelector(".messages.messages-full");
    expect(messagesNode).toBeTruthy();
    const scrollNode = messagesNode as HTMLDivElement;

    Object.defineProperty(scrollNode, "clientHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      value: 600,
    });
    scrollNode.scrollTop = 100;
    fireEvent.scroll(scrollNode);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Jump to latest updates" })).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Jump to latest updates" }).className).toContain(
      styles.messagesJumpToLatestIconOnly
    );
    expect(screen.queryByText("Jump to latest")).toBeNull();

    rerender(
      <Messages
        items={[
          ...initialItems,
          {
            id: "msg-scroll-2",
            kind: "tool",
            toolType: "commandExecution",
            title: "Command: git status",
            detail: "/repo",
            status: "completed",
            output: "",
          },
        ]}
        threadId="thread-scroll"
        workspaceId="ws-1"
        isThinking
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    await waitFor(() => {
      expect(screen.getByText("1 new update")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Jump to latest updates" }).className).not.toContain(
      styles.messagesJumpToLatestIconOnly
    );
  });

  it("keeps jump-to-latest below the working row so it stays closer to the composer", async () => {
    const items: ConversationItem[] = [
      {
        id: "msg-footer-order-1",
        kind: "message",
        role: "assistant",
        text: "First response",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-footer-order"
        workspaceId="ws-1"
        isThinking
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesNode = container.querySelector(".messages.messages-full");
    expect(messagesNode).toBeTruthy();
    const scrollNode = messagesNode as HTMLDivElement;

    Object.defineProperty(scrollNode, "clientHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      value: 600,
    });
    scrollNode.scrollTop = 100;
    fireEvent.scroll(scrollNode);

    const jumpButton = await screen.findByRole("button", { name: "Jump to latest updates" });
    const workingStatus = screen.getByText("Working");

    expect(
      jumpButton.compareDocumentPosition(workingStatus) & Node.DOCUMENT_POSITION_PRECEDING
    ).toBeTruthy();
  });

  it("keeps the working indicator dot vertically centered with the working row chrome", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "MessagesRichContent.global.css.ts"),
      "utf8"
    );
    const workingSpinnerStart = source.indexOf('feature(".working-spinner", {');
    const workingBodyStart = source.indexOf('feature(".working-body", {');
    const workingSpinnerBlock = source.slice(workingSpinnerStart, workingBodyStart);

    expect(source).toContain('feature(".working", {');
    expect(source).toContain('alignItems: "center"');
    expect(source).toContain('feature(".working-spinner", {');
    expect(workingSpinnerBlock).not.toContain('marginTop: "4px"');
  });

  it("returns to the bottom when jump-to-latest is clicked", async () => {
    const initialItems: ConversationItem[] = [
      {
        id: "msg-jump-1",
        kind: "message",
        role: "assistant",
        text: "Start",
      },
    ];

    const { container, rerender } = render(
      <Messages
        items={initialItems}
        threadId="thread-jump"
        workspaceId="ws-1"
        isThinking
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesNode = container.querySelector(".messages.messages-full");
    expect(messagesNode).toBeTruthy();
    const scrollNode = messagesNode as HTMLDivElement;

    Object.defineProperty(scrollNode, "clientHeight", {
      configurable: true,
      value: 220,
    });
    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      value: 620,
    });
    scrollNode.scrollTop = 120;
    fireEvent.scroll(scrollNode);

    rerender(
      <Messages
        items={[
          ...initialItems,
          {
            id: "msg-jump-2",
            kind: "message",
            role: "assistant",
            text: "Next update",
          },
        ]}
        threadId="thread-jump"
        workspaceId="ws-1"
        isThinking
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const jumpButton = await screen.findByRole("button", { name: "Jump to latest updates" });

    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      value: 920,
    });
    fireEvent.click(jumpButton);

    expect(scrollNode.scrollTop).toBe(920);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Jump to latest updates" })).toBeNull();
    });
  });

  it("re-pins restored thread history to the bottom when hydration finishes", async () => {
    const { container, rerender } = render(
      <Messages
        items={[]}
        threadId="thread-restore"
        workspaceId="ws-1"
        isThinking={false}
        isRestoringThreadHistory
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesNode = container.querySelector(".messages.messages-full");
    expect(messagesNode).toBeTruthy();
    const scrollNode = messagesNode as HTMLDivElement;

    Object.defineProperty(scrollNode, "clientHeight", {
      configurable: true,
      value: 220,
    });
    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      value: 620,
    });
    scrollNode.scrollTop = 120;
    fireEvent.scroll(scrollNode);

    rerender(
      <Messages
        items={[
          {
            id: "restore-user",
            kind: "message",
            role: "user",
            text: "Restore the thread",
          },
          {
            id: "restore-assistant",
            kind: "message",
            role: "assistant",
            text: "Thread restored",
          },
        ]}
        threadId="thread-restore"
        workspaceId="ws-1"
        isThinking={false}
        isRestoringThreadHistory={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(scrollNode.scrollTop).toBe(620);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Jump to latest updates" })).toBeNull();
    });
  });

  it("stays pinned when restored history expands after the initial hydration pass", async () => {
    const { container, rerender } = render(
      <Messages
        items={[]}
        threadId="thread-restore-expand"
        workspaceId="ws-1"
        isThinking={false}
        isRestoringThreadHistory
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesNode = container.querySelector(".messages.messages-full");
    expect(messagesNode).toBeTruthy();
    const scrollNode = messagesNode as HTMLDivElement;

    Object.defineProperty(scrollNode, "clientHeight", {
      configurable: true,
      value: 220,
    });
    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      get: () => (document.body.textContent?.includes("- Step 1") ? 920 : 620),
    });
    scrollNode.scrollTop = 120;
    fireEvent.scroll(scrollNode);

    rerender(
      <Messages
        items={[
          {
            id: "restore-user-expand",
            kind: "message",
            role: "user",
            text: "Restore the plan",
          },
          {
            id: "restore-plan-expand",
            kind: "tool",
            toolType: "plan",
            title: "Plan",
            detail: "completed",
            status: "completed",
            output: "- Step 1",
          },
        ]}
        threadId="thread-restore-expand"
        workspaceId="ws-1"
        isThinking={false}
        isRestoringThreadHistory={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    await waitFor(() => {
      expect(scrollNode.scrollTop).toBe(920);
    });
    expect(screen.queryByRole("button", { name: "Jump to latest updates" })).toBeNull();
  });

  it("shows polling fetch countdown text instead of done duration when requested", () => {
    vi.useFakeTimers();
    try {
      const items: ConversationItem[] = [
        {
          id: "assistant-msg-done",
          kind: "message",
          role: "assistant",
          text: "Completed response",
        },
      ];

      render(
        <Messages
          items={items}
          threadId="thread-1"
          workspaceId="ws-1"
          isThinking={false}
          lastDurationMs={4_000}
          showPollingFetchStatus
          pollingIntervalMs={12_000}
          openTargets={[]}
          selectedOpenAppId=""
        />
      );

      expect(screen.getByText("Waiting for the next sync")).toBeTruthy();
      expect(screen.getByText("Next refresh in 12s")).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(screen.getByText("Next refresh in 11s")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps done duration text when polling fetch countdown is not requested", () => {
    const items: ConversationItem[] = [
      {
        id: "assistant-msg-done-default",
        kind: "message",
        role: "assistant",
        text: "Completed response",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={4_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.queryByText("Turn complete")).toBeNull();
    expect(screen.queryByText("Done in 0:04")).toBeNull();
  });

  it("suppresses turn-complete chrome while the current turn still has a running tool", () => {
    const items: ConversationItem[] = [
      {
        id: "user-running-tool",
        kind: "message",
        role: "user",
        text: "Search for a token",
      },
      {
        id: "tool-running",
        kind: "tool",
        toolType: "mcpToolCall",
        title: "Tool: runtime / bash",
        detail: "{}",
        status: "inProgress",
        output: "",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-running-tool"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={4_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.queryByText("Turn complete")).toBeNull();
    expect(screen.queryByText("Done in 0:04")).toBeNull();
  });

  it("suppresses the turn-complete footer for immediate local completions", () => {
    const items: ConversationItem[] = [
      {
        id: "assistant-msg-immediate",
        kind: "message",
        role: "assistant",
        text: "Session status:\n- Model: gpt-5.4",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-immediate"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={0}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesRoot = getMessagesRoot();
    expect(screen.queryByText("Turn complete")).toBeNull();
    expect(screen.queryByText("Done in 0:00")).toBeNull();
    expect(messagesRoot.dataset.threadItemCount).toBe("1");
    expect(messagesRoot.dataset.currentTurnItemCount).toBe("1");
    expect(messagesRoot.dataset.currentTurnState).toBe("complete");
    expect(screen.queryByTestId("current-turn-footer")).toBeNull();
  });

  it("shows a warning footer when the latest user turn completes without visible output", () => {
    const items: ConversationItem[] = [
      {
        id: "user-history",
        kind: "message",
        role: "user",
        text: "What changed in the project root?",
      },
      {
        id: "assistant-history",
        kind: "message",
        role: "assistant",
        text: "I inspected the workspace and found the app entrypoint.",
      },
      {
        id: "user-current-empty",
        kind: "message",
        role: "user",
        text: "Use browser debugging tools to inspect the current page.",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-current-turn-empty"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={0}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesRoot = getMessagesRoot();
    expect(messagesRoot.dataset.threadItemCount).toBe("3");
    expect(messagesRoot.dataset.currentTurnItemCount).toBe("0");
    expect(messagesRoot.dataset.currentTurnHasItems).toBe("false");
    expect(messagesRoot.dataset.currentTurnState).toBe("empty");
    expect(screen.getByTestId("current-turn-footer")).toBeTruthy();
    expect(screen.getByText("No visible response")).toBeTruthy();
    expect(screen.getByText("Finished in 0:00 without agent output")).toBeTruthy();
  });

  it("omits the completion footer when the thread only contains settled historical output", () => {
    render(
      <Messages
        items={[
          {
            id: "user-historical-complete",
            kind: "message",
            role: "user",
            text: "Summarize the repo.",
          },
          {
            id: "assistant-historical-complete",
            kind: "message",
            role: "assistant",
            text: "The repo contains apps, packages, and docs.",
          },
        ]}
        threadId="thread-historical-complete"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesRoot = getMessagesRoot();
    expect(messagesRoot.dataset.currentTurnState).toBe("complete");
    expect(screen.queryByText("No visible response")).toBeNull();
    expect(screen.queryByTestId("current-turn-footer")).toBeNull();
    expect(screen.queryByText("Turn complete")).toBeNull();
  });

  it("uses a warning footer when a turn completes without visible output", () => {
    const items: ConversationItem[] = [
      {
        id: "user-no-visible-response",
        kind: "message",
        role: "user",
        text: "Reply with exactly OK.",
      },
      {
        id: "assistant-no-visible-response",
        kind: "message",
        role: "assistant",
        text: "Turn completed without any visible response or tool output. The agent may not have produced output. Check runtime logs and retry.",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-no-visible-response"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={4_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesRoot = getMessagesRoot();
    expect(screen.getAllByText("No visible response")).toHaveLength(2);
    expect(screen.getByText("Finished in 0:04 without agent output")).toBeTruthy();
    expect(screen.queryByText("Turn complete")).toBeNull();
    expect(messagesRoot.dataset.currentTurnState).toBe("no-visible-response");
    expect(messagesRoot.dataset.currentTurnHasNoVisibleResponse).toBe("true");
    expect(
      screen.getByTestId("current-turn-footer").getAttribute("data-current-turn-indicator-state")
    ).toBe("warning");
  });

  it("keeps tool-only turns on the execution rail without adding a redundant footer", () => {
    const items: ConversationItem[] = [
      {
        id: "user-tool-only-turn",
        kind: "message",
        role: "user",
        text: "Help me make this app better.",
      },
      {
        id: "tool-tool-only-turn",
        kind: "tool",
        toolType: "commandExecution",
        title: 'Command: bash -lc "echo Done"',
        detail: "C:\\Dev\\demo",
        status: "completed",
        output: "Done",
        durationMs: 4_000,
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-tool-only-turn"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={4_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByTestId("current-turn-panel")).toBeTruthy();
    expect(screen.getByTestId("current-turn-execution-rail")).toBeTruthy();
    expect(screen.getByTestId("current-turn-execution-summary")).toBeTruthy();
    expect(screen.getByText("1 tool call")).toBeTruthy();
    expect(screen.queryByTestId("current-turn-footer")).toBeNull();
    expect(screen.queryByText("Turn complete")).toBeNull();
    expect(screen.queryByText("Done in 0:04")).toBeNull();
    expect(screen.queryByText("Tool run finished")).toBeNull();
    expect(screen.queryByText("Finished in 0:04 without an assistant summary")).toBeNull();
  });

  it("renders the active turn inside separate narrative and execution rails", () => {
    const items: ConversationItem[] = [
      {
        id: "history-assistant-rail",
        kind: "message",
        role: "assistant",
        text: "Earlier context",
      },
      {
        id: "turn-user-rail",
        kind: "message",
        role: "user",
        text: "Audit the lane",
      },
      {
        id: "turn-tool-rail",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: pnpm validate:fast",
        detail: "/repo",
        status: "running",
        output: "",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-dual-rail"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_200}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const currentTurnPanel = screen.getByTestId("current-turn-panel");
    const narrativeRail = screen.getByTestId("current-turn-narrative-rail");
    const executionRail = screen.getByTestId("current-turn-execution-rail");

    expect(currentTurnPanel.contains(narrativeRail)).toBe(true);
    expect(currentTurnPanel.contains(executionRail)).toBe(true);
    expect(narrativeRail.textContent).toContain("Audit the lane");
    expect(executionRail.textContent).toContain("Running shell step");
    expect(executionRail.textContent).toContain("Running");
  });

  it("does not add a completion footer when a tool-only turn also has timeline followups", () => {
    const items: ConversationItem[] = [
      {
        id: "user-tool-followup-turn",
        kind: "message",
        role: "user",
        text: "Run a command and then ask me how to proceed.",
      },
      {
        id: "tool-tool-followup-turn",
        kind: "tool",
        toolType: "commandExecution",
        title: 'Command: bash -lc "echo Done"',
        detail: "C:\\Dev\\demo",
        status: "completed",
        output: "Done",
        durationMs: 4_000,
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-tool-followup-turn"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={4_000}
        openTargets={[]}
        selectedOpenAppId=""
        toolCallRequests={[
          {
            workspace_id: "ws-1",
            request_id: "tool-call-request-1",
            params: {
              thread_id: "thread-tool-followup-turn",
              turn_id: "turn-tool-followup-turn",
              call_id: "tool-tool-followup-turn",
              tool: "request_user_input",
              arguments: { question: "How should I proceed?" },
            },
          },
        ]}
        onToolCallSubmit={vi.fn()}
      />
    );

    const messagesRoot = getMessagesRoot();
    expect(messagesRoot.dataset.currentTurnState).toBe("complete");
    expect(screen.queryByTestId("current-turn-footer")).toBeNull();
    expect(screen.queryByText("Turn complete")).toBeNull();
    expect(screen.queryByText("Tool run finished")).toBeNull();
    expect(screen.queryByText("Finished in 0:04 without an assistant summary")).toBeNull();
  });

  it("keeps the warning footer when a no-visible-response turn also has timeline followups", () => {
    const items: ConversationItem[] = [
      {
        id: "user-warning-followup-turn",
        kind: "message",
        role: "user",
        text: "Reply with exactly OK.",
      },
      {
        id: "assistant-warning-followup-turn",
        kind: "message",
        role: "assistant",
        text: "Turn completed without any visible response or tool output. The agent may not have produced output. Check runtime logs and retry.",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-warning-followup-turn"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={4_000}
        openTargets={[]}
        selectedOpenAppId=""
        toolCallRequests={[
          {
            workspace_id: "ws-1",
            request_id: "tool-call-request-warning",
            params: {
              thread_id: "thread-warning-followup-turn",
              turn_id: "turn-warning-followup-turn",
              call_id: "assistant-warning-followup-turn",
              tool: "request_user_input",
              arguments: { question: "Retry or inspect logs?" },
            },
          },
        ]}
        onToolCallSubmit={vi.fn()}
      />
    );

    const messagesRoot = getMessagesRoot();
    expect(messagesRoot.dataset.currentTurnState).toBe("no-visible-response");
    expect(messagesRoot.dataset.currentTurnHasNoVisibleResponse).toBe("true");
    expect(screen.getAllByText("No visible response")).toHaveLength(2);
    expect(
      screen.getByTestId("current-turn-footer").getAttribute("data-current-turn-indicator-state")
    ).toBe("warning");
    expect(screen.queryByText("Turn complete")).toBeNull();
  });

  it("suppresses the turn-complete footer when the current turn ended with an interruption", () => {
    const items: ConversationItem[] = [
      {
        id: "user-interrupted-turn",
        kind: "message",
        role: "user",
        text: "Help me make this app better.",
      },
      {
        id: "assistant-interrupted-turn",
        kind: "message",
        role: "assistant",
        text: "Session stopped.",
      },
      {
        id: "assistant-interrupted-error",
        kind: "message",
        role: "assistant",
        text: "Turn failed: Turn interrupted by operator.",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-interrupted-turn"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={57_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesRoot = getMessagesRoot();
    expect(screen.getByText("Turn failed")).toBeTruthy();
    expect(screen.queryByText("Turn complete")).toBeNull();
    expect(screen.queryByText("Done in 0:57")).toBeNull();
    expect(messagesRoot.dataset.currentTurnState).toBe("failed");
    expect(messagesRoot.dataset.currentTurnHasTerminalFailure).toBe("true");
    expect(screen.queryByTestId("current-turn-footer")).toBeNull();
  });

  it("suppresses the turn-complete footer when the current turn only reports session stopped", () => {
    const items: ConversationItem[] = [
      {
        id: "user-interrupted-turn",
        kind: "message",
        role: "user",
        text: "Stop the active run.",
      },
      {
        id: "assistant-interrupted-turn",
        kind: "message",
        role: "assistant",
        text: "Session stopped.",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-interrupted-turn"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={57_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesRoot = getMessagesRoot();
    expect(screen.queryByText("Turn complete")).toBeNull();
    expect(screen.queryByText("Done in 0:57")).toBeNull();
    expect(messagesRoot.dataset.currentTurnState).toBe("failed");
    expect(messagesRoot.dataset.currentTurnHasTerminalFailure).toBe("true");
    expect(screen.queryByTestId("current-turn-footer")).toBeNull();
  });

  it("shows artifact summary chips in the execution summary while keeping the footer concise", () => {
    const items: ConversationItem[] = [
      {
        id: "user-summary",
        kind: "message",
        role: "user",
        text: "Wrap this up",
      },
      {
        id: "file-change-summary",
        kind: "tool",
        toolType: "fileChange",
        title: "Tool: apply_patch",
        detail: "{}",
        status: "completed",
        changes: [{ path: "src/a.ts" }, { path: "src/b.ts" }, { path: "src/b.ts" }],
      },
      {
        id: "diff-summary",
        kind: "diff",
        title: "src/a.ts",
        diff: "@@",
        status: "completed",
      },
      {
        id: "review-summary",
        kind: "review",
        state: "completed",
        text: "Looks solid",
      },
      {
        id: "assistant-summary",
        kind: "message",
        role: "assistant",
        text: "Finished.",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-summary"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={4_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByTestId("current-turn-execution-summary").textContent).toContain(
      "2 files changed"
    );
    expect(screen.getByTestId("current-turn-execution-summary").textContent).toContain("1 review");
    expect(screen.getByTestId("current-turn-execution-summary").textContent).toContain("1 diff");
    expect(screen.getByTestId("current-turn-footer")).toBeTruthy();
    expect(screen.getByText("Done in 0:04")).toBeTruthy();
    expect(screen.queryAllByText("2 files changed")).toHaveLength(1);
    expect(screen.queryAllByText("1 review")).toHaveLength(1);
    expect(screen.queryAllByText("1 diff")).toHaveLength(1);
  });

  it("offers direct artifact actions from the turn-complete footer and opens the targeted artifact", async () => {
    const scrollIntoViewSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    const items: ConversationItem[] = [
      {
        id: "user-summary-actions",
        kind: "message",
        role: "user",
        text: "Wrap this up",
      },
      {
        id: "file-change-summary-actions",
        kind: "tool",
        toolType: "fileChange",
        title: "Tool: apply_patch",
        detail: "{}",
        status: "completed",
        changes: [{ path: "src/a.ts" }, { path: "src/b.ts" }],
      },
      {
        id: "diff-summary-actions",
        kind: "diff",
        title: "Turn diff",
        diff: "@@",
        status: "completed",
      },
      {
        id: "review-summary-actions",
        kind: "review",
        state: "completed",
        text: "Looks solid",
      },
      {
        id: "assistant-summary-actions",
        kind: "message",
        role: "assistant",
        text: "Finished.",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-summary-actions"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={4_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.queryByRole("button", { name: "Inspect files" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand process summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Inspect files" }));
    fireEvent.click(screen.getByRole("button", { name: "Read review" }));
    fireEvent.click(screen.getByRole("button", { name: "Jump to diff" }));

    await waitFor(() => {
      expect(screen.getAllByText("src/a.ts").length).toBeGreaterThan(0);
      expect(screen.getByText("src/b.ts")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Hide diff" })).toBeTruthy();
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(3);
    });
    scrollIntoViewSpy.mockRestore();
  });

  it("resets diagnostic anchors to reflect the new thread on thread switch", () => {
    const threadAItems: ConversationItem[] = [
      {
        id: "thread-a-user",
        kind: "message",
        role: "user",
        text: "Inspect the page.",
      },
      {
        id: "thread-a-assistant",
        kind: "message",
        role: "assistant",
        text: "Turn failed: runtime error.",
      },
    ];

    const { rerender } = render(
      <Messages
        items={threadAItems}
        threadId="thread-a"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={2_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesRoot = getMessagesRoot();
    expect(messagesRoot.dataset.currentTurnState).toBe("failed");
    expect(messagesRoot.dataset.currentTurnHasTerminalFailure).toBe("true");
    expect(messagesRoot.dataset.threadId).toBe("thread-a");

    const threadBItems: ConversationItem[] = [
      {
        id: "thread-b-user",
        kind: "message",
        role: "user",
        text: "Add a test.",
      },
      {
        id: "thread-b-assistant",
        kind: "message",
        role: "assistant",
        text: "Test added.",
      },
    ];

    rerender(
      <Messages
        items={threadBItems}
        threadId="thread-b"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={3_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(messagesRoot.dataset.currentTurnState).toBe("complete");
    expect(messagesRoot.dataset.currentTurnHasTerminalFailure).toBe("false");
    expect(messagesRoot.dataset.threadId).toBe("thread-b");
    expect(messagesRoot.dataset.currentTurnItemCount).toBe("1");
  });

  it("produces correct anchor values after restore/hydration finishes", () => {
    const { rerender } = render(
      <Messages
        items={[]}
        threadId="thread-restore-anchors"
        workspaceId="ws-1"
        isThinking={false}
        isRestoringThreadHistory
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesRoot = getMessagesRoot();
    expect(messagesRoot.dataset.currentTurnItemCount).toBe("0");
    expect(messagesRoot.dataset.currentTurnState).toBe("idle");
    expect(messagesRoot.dataset.currentTurnHasItems).toBe("false");

    rerender(
      <Messages
        items={[
          {
            id: "restore-user-anchor",
            kind: "message",
            role: "user",
            text: "Earlier prompt",
          },
          {
            id: "restore-assistant-anchor",
            kind: "message",
            role: "assistant",
            text: "Earlier response",
          },
          {
            id: "restore-user-current",
            kind: "message",
            role: "user",
            text: "Use browser debugging to check the page.",
          },
          {
            id: "restore-assistant-warning",
            kind: "message",
            role: "assistant",
            text: "Turn completed without any visible response or tool output. The agent may not have produced output. Check runtime logs and retry.",
          },
        ]}
        threadId="thread-restore-anchors"
        workspaceId="ws-1"
        isThinking={false}
        isRestoringThreadHistory={false}
        lastDurationMs={5_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(messagesRoot.dataset.currentTurnItemCount).toBe("1");
    expect(messagesRoot.dataset.currentTurnHasItems).toBe("true");
    expect(messagesRoot.dataset.currentTurnHasNoVisibleResponse).toBe("true");
    expect(messagesRoot.dataset.currentTurnState).toBe("no-visible-response");
  });

  it("keeps the latest turn summary visible after restore when duration metadata is unavailable", () => {
    render(
      <Messages
        items={[
          {
            id: "restore-history-user",
            kind: "message",
            role: "user",
            text: "Earlier prompt",
          },
          {
            id: "restore-history-assistant",
            kind: "message",
            role: "assistant",
            text: "Earlier answer",
          },
          {
            id: "restore-summary-user",
            kind: "message",
            role: "user",
            text: "Wrap this up",
          },
          {
            id: "restore-summary-tool",
            kind: "tool",
            toolType: "fileChange",
            title: "Tool: apply_patch",
            detail: "{}",
            status: "completed",
            changes: [{ path: "src/a.ts" }, { path: "src/b.ts" }],
          },
          {
            id: "restore-summary-assistant",
            kind: "message",
            role: "assistant",
            text: "Finished.",
          },
        ]}
        threadId="thread-restore-summary"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={null}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByTestId("current-turn-panel")).toBeTruthy();
    expect(screen.getByTestId("current-turn-execution-summary").textContent).toContain(
      "1 tool call"
    );
    expect(screen.getByTestId("current-turn-execution-summary").textContent).toContain("1 reply");
    expect(screen.queryByTestId("current-turn-footer")).toBeNull();
  });

  it("keeps the current turn in a working state when an active turn id exists without projected output yet", () => {
    render(
      <Messages
        items={[
          {
            id: "pending-user",
            kind: "message",
            role: "user",
            text: "Inspect the live page.",
          },
        ]}
        threadId="thread-pending-active-turn"
        activeTurnId="turn-pending-1"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesRoot = getMessagesRoot();
    expect(messagesRoot.dataset.currentTurnItemCount).toBe("0");
    expect(messagesRoot.dataset.currentTurnHasActiveTurn).toBe("true");
    expect(messagesRoot.dataset.currentTurnState).toBe("working");
    expect(screen.getByTestId("current-turn-working-indicator")).toBeTruthy();
    expect(screen.queryByTestId("current-turn-footer")).toBeNull();
  });

  it("shows a no-visible-response footer when a turn completes without projected output", () => {
    render(
      <Messages
        items={[
          {
            id: "empty-user",
            kind: "message",
            role: "user",
            text: "List three folders.",
          },
        ]}
        threadId="thread-empty-complete"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesRoot = getMessagesRoot();
    expect(messagesRoot.dataset.currentTurnItemCount).toBe("0");
    expect(messagesRoot.dataset.currentTurnState).toBe("empty");
    expect(screen.getByTestId("current-turn-footer")).toBeTruthy();
    expect(screen.getByText("No visible response")).toBeTruthy();
    expect(screen.getByText("Finished in 0:01 without agent output")).toBeTruthy();
  });

  it("preserves delayed no-visible-response warning after thread switch and switch back", () => {
    const warningThread: ConversationItem[] = [
      {
        id: "warn-user",
        kind: "message",
        role: "user",
        text: "Debug the page.",
      },
      {
        id: "warn-no-response",
        kind: "message",
        role: "assistant",
        text: "Turn completed without any visible response or tool output. The agent may not have produced output. Check runtime logs and retry.",
      },
    ];

    const { rerender } = render(
      <Messages
        items={warningThread}
        threadId="thread-warn"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={3_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesRoot = getMessagesRoot();
    expect(messagesRoot.dataset.currentTurnState).toBe("no-visible-response");
    expect(messagesRoot.dataset.currentTurnHasNoVisibleResponse).toBe("true");

    const otherThread: ConversationItem[] = [
      {
        id: "other-user",
        kind: "message",
        role: "user",
        text: "Add a feature.",
      },
      {
        id: "other-assistant",
        kind: "message",
        role: "assistant",
        text: "Feature added.",
      },
    ];

    rerender(
      <Messages
        items={otherThread}
        threadId="thread-other"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(messagesRoot.dataset.currentTurnState).toBe("complete");
    expect(messagesRoot.dataset.currentTurnHasNoVisibleResponse).toBe("false");

    rerender(
      <Messages
        items={warningThread}
        threadId="thread-warn"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={3_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(messagesRoot.dataset.currentTurnState).toBe("no-visible-response");
    expect(messagesRoot.dataset.currentTurnHasNoVisibleResponse).toBe("true");
    expect(screen.getAllByText("No visible response").length).toBeGreaterThanOrEqual(1);
  });
});
