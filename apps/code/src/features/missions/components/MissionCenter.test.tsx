// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MissionCenter } from "./MissionCenter";

describe("MissionCenter", () => {
  it("scrolls the conversation into view when the active thread changes", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
      writable: true,
    });

    const { rerender } = render(
      <MissionCenter
        activeWorkspace
        activeThreadId={null}
        topbarLeftNode={<div>Topbar</div>}
        missionOverviewNode={<div>Overview</div>}
        messagesNode={<div>Messages</div>}
        composerNode={<div>Composer</div>}
        emptyNode={<div>Empty</div>}
      />
    );

    expect(screen.getByTestId("mission-center-content")).toBeTruthy();
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(
      <MissionCenter
        activeWorkspace
        activeThreadId="thread-1"
        topbarLeftNode={<div>Topbar</div>}
        missionOverviewNode={<div>Overview</div>}
        messagesNode={<div>Messages</div>}
        composerNode={<div>Composer</div>}
        emptyNode={<div>Empty</div>}
      />
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
    });
  });

  it("does not scroll again when the same thread stays active", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
      writable: true,
    });

    const { rerender } = render(
      <MissionCenter
        activeWorkspace
        activeThreadId="thread-1"
        topbarLeftNode={<div>Topbar</div>}
        missionOverviewNode={<div>Overview</div>}
        messagesNode={<div>Messages</div>}
        composerNode={<div>Composer</div>}
        emptyNode={<div>Empty</div>}
      />
    );

    scrollIntoView.mockClear();

    rerender(
      <MissionCenter
        activeWorkspace
        activeThreadId="thread-1"
        topbarLeftNode={<div>Topbar</div>}
        missionOverviewNode={<div>Overview</div>}
        messagesNode={<div>Messages</div>}
        composerNode={<div>Composer</div>}
        emptyNode={<div>Empty</div>}
      />
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls the messages list to the latest entry on phone thread changes", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
      writable: true,
    });
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    const { rerender } = render(
      <MissionCenter
        activeWorkspace
        activeThreadId={null}
        scrollMessagesToBottomOnThreadChange
        topbarLeftNode={<div>Topbar</div>}
        missionOverviewNode={<div>Overview</div>}
        messagesNode={<div data-testid="messages-root">Messages</div>}
        composerNode={<div>Composer</div>}
        emptyNode={<div>Empty</div>}
      />
    );

    const messagesRoot = screen.getByTestId("messages-root");
    Object.defineProperty(messagesRoot, "scrollHeight", {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(messagesRoot, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    });

    rerender(
      <MissionCenter
        activeWorkspace
        activeThreadId="thread-1"
        scrollMessagesToBottomOnThreadChange
        topbarLeftNode={<div>Topbar</div>}
        missionOverviewNode={<div>Overview</div>}
        messagesNode={<div data-testid="messages-root">Messages</div>}
        composerNode={<div>Composer</div>}
        emptyNode={<div>Empty</div>}
      />
    );

    expect(messagesRoot.scrollTop).toBe(640);
    window.requestAnimationFrame = originalRequestAnimationFrame;
  });
});
