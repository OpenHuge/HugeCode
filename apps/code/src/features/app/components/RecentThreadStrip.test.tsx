// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ThreadSummary } from "../../../types";
import { type RecentThreadItem, RecentThreadStrip } from "./RecentThreadStrip";

const threadA: ThreadSummary = {
  id: "thread-a",
  name: "Alpha thread",
  updatedAt: 1000,
};

const threadB: ThreadSummary = {
  id: "thread-b",
  name: "Beta thread",
  updatedAt: 900,
};

const threadC: ThreadSummary = {
  id: "thread-c",
  name: "Gamma thread",
  updatedAt: 800,
};

const threadD: ThreadSummary = {
  id: "thread-d",
  name: "Delta thread",
  updatedAt: 700,
};

const threadE: ThreadSummary = {
  id: "thread-e",
  name: "Epsilon thread",
  updatedAt: 600,
};

function makeItem(
  thread: ThreadSummary,
  status: RecentThreadItem["status"],
  isActive = false
): RecentThreadItem {
  return {
    thread,
    status,
    isActive,
  };
}

describe("RecentThreadStrip", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not render when there is only one thread", () => {
    const { container } = render(
      <RecentThreadStrip threads={[makeItem(threadA, "ready", true)]} />
    );
    expect(container.querySelector(".workspace-thread-strip")).toBeNull();
  });

  it("renders recent threads and selects thread on click", () => {
    const onSelectThread = vi.fn();
    render(
      <RecentThreadStrip
        threads={[
          makeItem(threadA, "processing", true),
          makeItem(threadB, "unread"),
          makeItem(threadC, "reviewing"),
        ]}
        onSelectThread={onSelectThread}
      />
    );

    const summaryButton = screen.getByRole("button", { name: "Recent threads" });
    expect(summaryButton.textContent).toContain("Alpha thread");
    expect(summaryButton.textContent).toContain("+2");
    expect(summaryButton.getAttribute("data-workspace-chrome")).toBe("pill");

    fireEvent.click(summaryButton);
    const betaButton = screen.getByRole("menuitem", { name: "Beta thread" });
    fireEvent.click(betaButton);
    expect(onSelectThread).toHaveBeenCalledWith("thread-b");

    fireEvent.click(summaryButton);
    const activeButton = screen.getByRole("menuitem", { name: "Alpha thread" });
    expect(activeButton.getAttribute("aria-current")).toBe("true");
  });

  it("shows a compact recent-thread summary instead of inline thread tabs", () => {
    render(
      <RecentThreadStrip
        threads={[
          makeItem(threadA, "ready"),
          makeItem(threadB, "ready"),
          makeItem(threadC, "ready"),
          makeItem(threadD, "ready"),
          makeItem(threadE, "ready"),
        ]}
      />
    );

    const summaryButton = screen.getByRole("button", { name: "Recent threads" });
    expect(summaryButton.textContent).toContain("Alpha thread");
    expect(summaryButton.textContent).toContain("+4");
    expect(summaryButton.getAttribute("data-workspace-chrome")).toBe("pill");
    expect(screen.queryByRole("menuitem", { name: "Epsilon thread" })).toBeNull();
  });

  it("opens the recent-thread menu and selects a thread", () => {
    const onSelectThread = vi.fn();
    const { container } = render(
      <RecentThreadStrip
        threads={[
          makeItem(threadA, "ready"),
          makeItem(threadB, "ready"),
          makeItem(threadC, "ready"),
          makeItem(threadD, "ready"),
          makeItem(threadE, "unread"),
        ]}
        onSelectThread={onSelectThread}
      />
    );

    const scoped = within(container);
    fireEvent.click(scoped.getByRole("button", { name: "Recent threads" }));
    const option = scoped.getByRole("menuitem", { name: "Epsilon thread" });
    expect(option.getAttribute("data-app-popover-item")).toBe("true");
    fireEvent.click(option);

    expect(onSelectThread).toHaveBeenCalledWith("thread-e");
  });

  it("opens the menu from the summary button with arrow keys", async () => {
    render(
      <RecentThreadStrip
        threads={[
          makeItem(threadA, "ready"),
          makeItem(threadB, "ready"),
          makeItem(threadC, "ready"),
          makeItem(threadD, "ready"),
          makeItem(threadE, "ready"),
        ]}
      />
    );

    const summaryButton = screen.getByRole("button", { name: "Recent threads" });
    summaryButton.focus();
    fireEvent.keyDown(summaryButton, { key: "ArrowDown" });

    const firstOption = screen.getByRole("menuitem", { name: "Alpha thread" });
    await waitFor(() => {
      expect(document.activeElement).toBe(firstOption);
    });
  });

  it("supports keyboard-only selection from overflow menu", async () => {
    const onSelectThread = vi.fn();
    render(
      <RecentThreadStrip
        threads={[
          makeItem(threadA, "ready"),
          makeItem(threadB, "ready"),
          makeItem(threadC, "ready"),
          makeItem(threadD, "ready"),
          makeItem(threadE, "unread"),
        ]}
        onSelectThread={onSelectThread}
      />
    );

    const summaryButton = screen.getByRole("button", { name: "Recent threads" });
    summaryButton.focus();
    fireEvent.keyDown(summaryButton, { key: "ArrowDown" });

    const overflowOption = screen.getByRole("menuitem", { name: "Alpha thread" });
    await waitFor(() => {
      expect(document.activeElement).toBe(overflowOption);
    });

    fireEvent.keyDown(overflowOption, { key: "ArrowUp" });
    const lastOption = screen.getByRole("menuitem", { name: "Epsilon thread" });
    await waitFor(() => {
      expect(document.activeElement).toBe(lastOption);
    });

    fireEvent.keyDown(lastOption, { key: "Enter" });
    expect(onSelectThread).toHaveBeenCalledWith("thread-e");
    expect(screen.queryByRole("menuitem", { name: "Epsilon thread" })).toBeNull();
  });

  it("renders awaiting approval status chips", () => {
    const { container } = render(
      <RecentThreadStrip
        threads={[makeItem(threadA, "awaitingApproval", true), makeItem(threadB, "ready")]}
      />
    );

    const statusDot = container.querySelector(
      '.workspace-thread-chip-status.awaitingApproval[data-status-tone="warning"]'
    );
    expect(statusDot).toBeTruthy();
  });

  it("keeps reviewing status on the shared success tone", () => {
    const { container } = render(
      <RecentThreadStrip
        threads={[makeItem(threadA, "reviewing", true), makeItem(threadB, "ready")]}
      />
    );

    expect(
      container.querySelector('.workspace-thread-chip-status.reviewing[data-status-tone="success"]')
    ).toBeTruthy();
  });
});
