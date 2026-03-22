// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../hooks/useFileLinkOpener", () => ({
  useFileLinkOpener: (
    workspacePath: string | null,
    openTargets: unknown[],
    selectedOpenAppId: string
  ) => useFileLinkOpenerMock(workspacePath, openTargets, selectedOpenAppId),
}));

describe("Messages jump-to-latest styles", () => {
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
  });

  it("keeps the icon-only jump-to-latest control square when no count label is shown", async () => {
    const items: ConversationItem[] = [
      {
        id: "msg-scroll-1",
        kind: "message",
        role: "assistant",
        text: "First response",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-scroll-shape"
        workspaceId="ws-1"
        isThinking
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const messagesNode = container.querySelector(".messages.messages-full");
    if (!(messagesNode instanceof HTMLDivElement)) {
      throw new Error("Expected messages scroll container");
    }

    Object.defineProperty(messagesNode, "clientHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(messagesNode, "scrollHeight", {
      configurable: true,
      value: 600,
    });
    messagesNode.scrollTop = 100;
    fireEvent.scroll(messagesNode);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Jump to latest updates" })).toBeTruthy();
    });

    const jumpButton = screen.getByRole("button", { name: "Jump to latest updates" });

    expect(jumpButton.className).toContain(styles.messagesJumpToLatestIconOnly);
    expect(jumpButton.className).toContain(styles.messagesJumpToLatest);
    expect(screen.queryByText(/new update/i)).toBeNull();
  });

  it("keeps the jump-to-latest chrome flatter than the earlier floating glass pill", () => {
    const source = readFileSync(resolve(import.meta.dirname, "Messages.styles.css.ts"), "utf8");

    expect(source).toContain('cursor: "pointer"');
    expect(source).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card-base) 96%, transparent), color-mix(in srgb, var(--ds-surface-muted) 54%, var(--ds-surface-card-base)))"
    );
    expect(source).not.toContain('backdropFilter: "blur(6px)"');
    expect(source).not.toContain(
      'boxShadow: "0 12px 24px -16px color-mix(in srgb, var(--ds-shadow-color) 28%, transparent)"'
    );
    expect(source).not.toContain(
      'boxShadow: "0 10px 18px -18px color-mix(in srgb, var(--ds-shadow-color) 18%, transparent)"'
    );
  });
});
