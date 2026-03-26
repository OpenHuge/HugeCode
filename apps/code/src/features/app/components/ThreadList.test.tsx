// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ThreadSummary } from "../../../types";
import { ThreadList } from "./ThreadList";

const nestedThread: ThreadSummary = {
  id: "thread-2",
  name: "Nested Agent",
  updatedAt: 900,
};

const thread: ThreadSummary = {
  id: "thread-1",
  name: "Alpha",
  updatedAt: 1000,
  agentRole: "reviewAgent",
};

const statusMap = {
  "thread-1": { isProcessing: false, hasUnread: true, isReviewing: false },
  "thread-2": { isProcessing: false, hasUnread: false, isReviewing: false },
};

const baseProps = {
  workspaceId: "ws-1",
  pinnedRows: [],
  unpinnedRows: [{ thread, depth: 0 }],
  totalThreadRoots: 1,
  isExpanded: false,
  nextCursor: null,
  isPaging: false,
  nested: false,
  activeWorkspaceId: "ws-1",
  activeThreadId: "thread-1",
  threadStatusById: statusMap,
  getThreadTime: () => "2m",
  isThreadPinned: () => false,
  onToggleExpanded: vi.fn(),
  onLoadOlderThreads: vi.fn(),
  onSelectThread: vi.fn(),
  onShowThreadMenu: vi.fn(),
  onPinThread: vi.fn(() => true),
  onUnpinThread: vi.fn(),
  onArchiveThread: vi.fn(),
};

describe("ThreadList", () => {
  it("renders active row and handles click/context menu", () => {
    const onSelectThread = vi.fn();
    const onShowThreadMenu = vi.fn();

    const { container } = render(
      <ThreadList
        {...baseProps}
        onSelectThread={onSelectThread}
        onShowThreadMenu={onShowThreadMenu}
      />
    );

    const row = container.querySelector('.thread-row[title="Alpha"]');
    expect(row).toBeTruthy();
    if (!row) {
      throw new Error("Missing thread row");
    }
    expect(row.classList.contains("active")).toBe(true);
    expect(row.querySelector(".thread-status")?.className).toContain("unread");
    expect(container.querySelector('[data-sidebar-section="threads"]')).toBeTruthy();
    expect(row.getAttribute("data-sidebar-row")).toBe("true");

    const rowButton = row.querySelector(".thread-row-main");
    expect(rowButton).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Open thread Alpha" })).toBeTruthy();
    fireEvent.click(rowButton as HTMLElement);
    expect(onSelectThread).toHaveBeenCalledWith("ws-1", "thread-1");

    fireEvent.contextMenu(row);
    expect(onShowThreadMenu).toHaveBeenCalledWith(expect.anything(), "ws-1", "thread-1", true);
  });

  it("shows the more button and toggles expanded", () => {
    const onToggleExpanded = vi.fn();
    render(<ThreadList {...baseProps} totalThreadRoots={4} onToggleExpanded={onToggleExpanded} />);

    const moreButton = screen.getByRole("button", { name: "Show 1 more" });
    fireEvent.click(moreButton);
    expect(onToggleExpanded).toHaveBeenCalledWith("ws-1");
  });

  it("shows archive confirmation inline and archives on confirm", () => {
    const onArchiveThread = vi.fn();
    const { container } = render(<ThreadList {...baseProps} onArchiveThread={onArchiveThread} />);
    const row = container.querySelector('.thread-row[title="Alpha"]');
    expect(row).toBeTruthy();
    if (!row) {
      throw new Error("Missing thread row");
    }

    fireEvent.click(within(row).getByRole("button", { name: "Archive thread Alpha" }));
    fireEvent.click(within(row).getByRole("button", { name: "Confirm archive thread Alpha" }));

    expect(onArchiveThread).toHaveBeenCalledWith("ws-1", "thread-1");
  });

  it("pins from the inline action for root rows", () => {
    const onPinThread = vi.fn(() => true);
    const { container } = render(
      <ThreadList {...baseProps} isThreadPinned={() => false} onPinThread={onPinThread} />
    );
    const row = container.querySelector('.thread-row[title="Alpha"]');
    expect(row).toBeTruthy();
    if (!row) {
      throw new Error("Missing thread row");
    }

    fireEvent.click(within(row).getByRole("button", { name: "Pin thread Alpha" }));
    expect(onPinThread).toHaveBeenCalledWith("ws-1", "thread-1");
  });

  it("loads older threads when a cursor is available", () => {
    const onLoadOlderThreads = vi.fn();
    render(
      <ThreadList {...baseProps} nextCursor="cursor" onLoadOlderThreads={onLoadOlderThreads} />
    );

    const loadButton = screen.getByRole("button", { name: "Load older..." });
    fireEvent.click(loadButton);
    expect(onLoadOlderThreads).toHaveBeenCalledWith("ws-1");
  });

  it("renders awaiting approval state from execution metadata", () => {
    const { container } = render(
      <ThreadList
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

    const row = container.querySelector('.thread-row[title="Alpha"]');
    expect(row?.getAttribute("data-thread-state")).toBe("awaitingApproval");
    expect(container.querySelector(".thread-status")?.className).toContain("awaitingApproval");
  });

  it("renders nested rows with indentation and disables pinning", () => {
    const onShowThreadMenu = vi.fn();
    const { container } = render(
      <ThreadList
        {...baseProps}
        nested
        unpinnedRows={[
          { thread, depth: 0 },
          { thread: nestedThread, depth: 1 },
        ]}
        onShowThreadMenu={onShowThreadMenu}
      />
    );

    const nestedRow = container.querySelector('.thread-row[title="Nested Agent"]');
    expect(nestedRow).toBeTruthy();
    if (!nestedRow) {
      throw new Error("Missing nested thread row");
    }
    expect(nestedRow.getAttribute("data-thread-depth")).toBe("1");
    expect(nestedRow.getAttribute("style")).toBeNull();

    fireEvent.contextMenu(nestedRow);
    expect(onShowThreadMenu).toHaveBeenCalledWith(expect.anything(), "ws-1", "thread-2", false);
  });

  it("renders inline pin and archive actions on root rows", () => {
    const { container } = render(<ThreadList {...baseProps} />);

    expect(container.querySelector('button[aria-label="Pin thread Alpha"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Archive thread Alpha"]')).toBeTruthy();
  });
});
