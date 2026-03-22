/** @vitest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const useFileLinkOpenerMock = vi.fn(
  (_workspacePath: string | null, _openTargets: unknown[], _selectedOpenAppId: string) => ({
    openFileLink: vi.fn(),
    showFileLinkMenu: vi.fn(),
  })
);

function createDeferredModule<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

vi.mock("../hooks/useFileLinkOpener", () => ({
  useFileLinkOpener: (
    workspacePath: string | null,
    openTargets: unknown[],
    selectedOpenAppId: string
  ) => useFileLinkOpenerMock(workspacePath, openTargets, selectedOpenAppId),
}));

describe("Messages lazy adjunct boundary", () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("./MessagesDeferredPanels");
  });

  beforeEach(() => {
    useFileLinkOpenerMock.mockClear();
  });

  it("does not require the deferred adjunct chunk for ordinary timeline rows", async () => {
    const deferredModule = createDeferredModule<{
      DeferredPlanReadyFollowupMessage: () => JSX.Element;
      DeferredRequestUserInputMessage: () => JSX.Element;
      DeferredToolCallRequestMessage: () => JSX.Element;
      DeferredTimelineApprovalPanel: () => JSX.Element;
    }>();
    const moduleFactory = vi.fn(() => deferredModule.promise);

    vi.doMock("./MessagesDeferredPanels", moduleFactory);

    const { Messages } = await import("./Messages");

    render(
      <Messages
        items={[
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "Ordinary timeline content",
          },
        ]}
        threadId="thread-ordinary"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByText("Ordinary timeline content")).toBeTruthy();
    expect(moduleFactory).not.toHaveBeenCalled();
  }, 20_000);

  it("loads the deferred adjunct chunk only when a rare message panel is needed", async () => {
    const deferredModule = createDeferredModule<{
      DeferredPlanReadyFollowupMessage: () => JSX.Element;
      DeferredRequestUserInputMessage: (props: { interactive?: boolean }) => JSX.Element;
      DeferredToolCallRequestMessage: () => JSX.Element;
      DeferredTimelineApprovalPanel: () => JSX.Element;
    }>();
    const moduleFactory = vi.fn(() => deferredModule.promise);

    vi.doMock("./MessagesDeferredPanels", moduleFactory);

    const { Messages } = await import("./Messages");

    render(
      <Messages
        items={[]}
        threadId="thread-input"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        userInputRequests={[
          {
            workspace_id: "ws-1",
            request_id: 1,
            params: {
              thread_id: "thread-input",
              turn_id: "turn-input",
              item_id: "item-input",
              questions: [
                {
                  id: "q_mode",
                  header: "Execution",
                  question: "How should I proceed?",
                  options: [{ label: "Safe mode", description: "Prefer safer changes first." }],
                },
              ],
            },
          },
        ]}
        onUserInputSubmit={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(moduleFactory).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Deferred input requested")).toBeNull();

    await act(async () => {
      deferredModule.resolve({
        DeferredPlanReadyFollowupMessage: () => <div>Deferred plan followup</div>,
        DeferredRequestUserInputMessage: ({ interactive = true }) => (
          <div>{interactive ? "Deferred input requested" : "Deferred input summary"}</div>
        ),
        DeferredToolCallRequestMessage: () => <div>Deferred tool call</div>,
        DeferredTimelineApprovalPanel: () => <div>Deferred approval</div>,
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("Deferred input requested")).toBeTruthy();
  }, 20_000);
});
