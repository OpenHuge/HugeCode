// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ThreadSummary } from "../../../types";
import { PinnedThreadList } from "./PinnedThreadList";

const thread: ThreadSummary = {
  id: "thread-1",
  name: "Pinned Alpha",
  updatedAt: 1000,
};

const otherThread: ThreadSummary = {
  id: "thread-2",
  name: "Pinned Beta",
  updatedAt: 800,
};

const statusMap = {
  "thread-1": { isProcessing: false, hasUnread: false, isReviewing: true },
  "thread-2": { isProcessing: true, hasUnread: false, isReviewing: false },
};

const baseProps = {
  rows: [{ thread, depth: 0, workspaceId: "ws-1" }],
  activeWorkspaceId: "ws-1",
  activeThreadId: "thread-1",
  threadStatusById: statusMap,
  getThreadTime: () => "1h",
  isThreadPinned: () => true,
  onSelectThread: vi.fn(),
  onShowThreadMenu: vi.fn(),
  onPinThread: vi.fn(() => true),
  onUnpinThread: vi.fn(),
  onArchiveThread: vi.fn(),
};

describe("PinnedThreadList", () => {
  it("renders pinned rows and handles click/context menu", () => {
    const onSelectThread = vi.fn();
    const onShowThreadMenu = vi.fn();

    const { container } = render(
      <PinnedThreadList
        {...baseProps}
        onSelectThread={onSelectThread}
        onShowThreadMenu={onShowThreadMenu}
      />
    );

    const row = container.querySelector('.thread-row[title="Pinned Alpha"]');
    expect(row).toBeTruthy();
    if (!row) {
      throw new Error("Missing pinned row");
    }
    expect(row.classList.contains("active")).toBe(true);
    expect(row.querySelector(".thread-status")?.className).toContain("reviewing");
    expect(screen.getByRole("button", { name: "Unpin thread" })).toBeTruthy();
    expect(container.querySelector('[data-sidebar-section="pinned-threads"]')).toBeTruthy();
    expect(row.getAttribute("data-sidebar-row")).toBe("true");

    const rowButton = row.querySelector(".thread-row-main");
    expect(rowButton).toBeTruthy();
    fireEvent.click(rowButton as HTMLElement);
    expect(onSelectThread).toHaveBeenCalledWith("ws-1", "thread-1");

    fireEvent.contextMenu(row);
    expect(onShowThreadMenu).toHaveBeenCalledWith(expect.anything(), "ws-1", "thread-1", true);
  });

  it("routes callbacks for rows across workspaces", () => {
    const onSelectThread = vi.fn();
    const onShowThreadMenu = vi.fn();

    const { container } = render(
      <PinnedThreadList
        {...baseProps}
        rows={[
          { thread, depth: 0, workspaceId: "ws-1" },
          { thread: otherThread, depth: 0, workspaceId: "ws-2" },
        ]}
        onSelectThread={onSelectThread}
        onShowThreadMenu={onShowThreadMenu}
      />
    );

    const secondRow = container.querySelector('.thread-row[title="Pinned Beta"]');
    expect(secondRow).toBeTruthy();
    if (!secondRow) {
      throw new Error("Missing second pinned row");
    }

    const secondRowButton = secondRow.querySelector(".thread-row-main");
    expect(secondRowButton).toBeTruthy();
    fireEvent.click(secondRowButton as HTMLElement);
    expect(onSelectThread).toHaveBeenCalledWith("ws-2", "thread-2");

    fireEvent.contextMenu(secondRow);
    expect(onShowThreadMenu).toHaveBeenCalledWith(expect.anything(), "ws-2", "thread-2", true);
  });

  it("shows approval pill when pinned thread awaits approval", () => {
    const { container } = render(
      <PinnedThreadList
        {...baseProps}
        threadStatusById={{
          "thread-1": {
            isProcessing: true,
            hasUnread: false,
            isReviewing: false,
            executionState: "awaitingApproval",
          },
        }}
      />
    );

    const row = container.querySelector('.thread-row[title="Pinned Alpha"]');
    expect(row?.getAttribute("data-thread-state")).toBe("awaitingApproval");
    expect(container.querySelector(".thread-status")?.className).toContain("awaitingApproval");
  });

  it("unpinns from the inline action for pinned rows", () => {
    const onUnpinThread = vi.fn();
    const { container } = render(<PinnedThreadList {...baseProps} onUnpinThread={onUnpinThread} />);
    const row = container.querySelector('.thread-row[title="Pinned Alpha"]');
    expect(row).toBeTruthy();
    if (!row) {
      throw new Error("Missing pinned row");
    }

    fireEvent.click(within(row).getByRole("button", { name: "Unpin thread" }));
    expect(onUnpinThread).toHaveBeenCalledWith("ws-1", "thread-1");
  });
});
