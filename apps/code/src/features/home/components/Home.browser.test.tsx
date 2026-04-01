import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { userEvent } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectRuntimeMode } from "../../../application/runtime/ports/runtimeClientMode";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import { Home } from "./Home";

vi.mock("../../workspaces/components/WorkspaceHomeAgentControl", () => ({
  WorkspaceHomeAgentControl: () => <div data-testid="workspace-home-agent-control-stub" />,
}));

vi.mock("../../../application/runtime/ports/runtimeClientMode", () => ({
  detectRuntimeMode: vi.fn(() => "electron-bridge"),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

const baseProps = {
  onOpenProject: vi.fn(),
  onOpenSettings: vi.fn(),
  onConnectLocalRuntimePort: vi.fn(),
  latestAgentRuns: [],
  isLoadingLatestAgents: false,
  localUsageSnapshot: null,
  isLoadingLocalUsage: false,
  localUsageError: null,
  workspaceLoadError: null,
  onRefreshLocalUsage: vi.fn(),
  usageMetric: "tokens" as const,
  onUsageMetricChange: vi.fn(),
  usageWorkspaceId: null,
  usageWorkspaceOptions: [],
  onUsageWorkspaceChange: vi.fn(),
  onSelectThread: vi.fn(),
};

function getLaunchpadComposerControls() {
  const input = Array.from(
    document.querySelectorAll<HTMLTextAreaElement>('textarea[aria-label="Composer draft"]')
  ).at(-1);
  const sendButton = Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[aria-label="Send"]')
  ).at(-1);
  if (!input || !sendButton) {
    throw new Error("Expected launchpad composer controls");
  }
  return { input, sendButton };
}

function getHomeWorkspaceTrigger() {
  const trigger = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      'button[data-ui-select-trigger="true"][aria-label="Select workspace"]'
    )
  ).find((candidate) => candidate.disabled === false);
  if (!trigger) {
    throw new Error("Expected workspace selector trigger");
  }
  return trigger;
}

function getRuntimeTargetInput() {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Runtime target"]');
  if (!input) {
    throw new Error("Expected runtime target input");
  }
  return input;
}

function getRuntimeConnectButton() {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) =>
      candidate.textContent?.trim() === "Connect" ||
      candidate.textContent?.trim() === "Connecting..."
  );
  if (!button) {
    throw new Error("Expected runtime connect button");
  }
  return button;
}

async function click(element: Element) {
  await act(async () => {
    await userEvent.click(element);
  });
}

async function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    fireEvent.input(element, { target: { value } });
    fireEvent.change(element, { target: { value } });
  });
}

async function clear(element: HTMLInputElement | HTMLTextAreaElement) {
  await act(async () => {
    fireEvent.input(element, { target: { value: "" } });
    fireEvent.change(element, { target: { value: "" } });
  });
}

async function dispatchClick(element: Element) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function dispatchWindowEvent(event: Event) {
  await act(async () => {
    window.dispatchEvent(event);
  });
}

async function flushAsyncEffects() {
  await Promise.resolve();
  await Promise.resolve();
}

async function renderAndFlush(element: Parameters<typeof render>[0]) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(element);
    await flushAsyncEffects();
  });
  return view;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Home browser interactions", () => {
  it("sends launchpad input through the shared composer send flow in a real browser", async () => {
    const onSend = vi.fn();

    render(
      <Home
        {...baseProps}
        onSend={onSend}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId="workspace-1"
      />
    );

    const input = Array.from(
      document.querySelectorAll<HTMLTextAreaElement>('textarea[aria-label="Composer draft"]')
    ).at(-1);
    const sendButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button[aria-label="Send"]')
    ).at(-1);
    if (!input || !sendButton) {
      throw new Error("Expected launchpad composer controls");
    }

    await setValue(input, "ship the fix");
    await click(sendButton);

    expect(onSend).toHaveBeenCalledWith("ship the fix", []);
  });

  it("routes send into workspace setup when no workspace is available in a real browser", async () => {
    const onOpenProject = vi.fn();
    const onSend = vi.fn();

    render(<Home {...baseProps} onOpenProject={onOpenProject} onSend={onSend} />);

    const input = Array.from(
      document.querySelectorAll<HTMLTextAreaElement>('textarea[aria-label="Composer draft"]')
    ).at(-1);
    const sendButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button[aria-label="Send"]')
    ).at(-1);
    if (!input || !sendButton) {
      throw new Error("Expected launchpad composer controls");
    }

    await act(async () => {
      await setValue(input, "set up a workspace");
      await click(sendButton);
    });

    await waitFor(() => {
      expect(onOpenProject).toHaveBeenCalledOnce();
    });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("connects to a local runtime from home in a real browser", async () => {
    const onConnectLocalRuntimePort = vi.fn().mockResolvedValue(undefined);
    const onOpenSettings = vi.fn();

    await renderAndFlush(
      <Home
        {...baseProps}
        onOpenSettings={onOpenSettings}
        onConnectLocalRuntimePort={onConnectLocalRuntimePort}
        workspaceLoadError="Code runtime is unavailable for list workspaces."
      />
    );

    const runtimePortInput = getRuntimeTargetInput();
    const settingsButton = document.querySelector<HTMLButtonElement>(
      '[data-testid="home-settings-trigger"]'
    );
    if (!settingsButton) {
      throw new Error("Expected runtime notice controls");
    }

    await waitFor(() => {
      expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({ host: null, port: 8788 });
    });
    onConnectLocalRuntimePort.mockClear();

    await click(settingsButton);
    expect(onOpenSettings).toHaveBeenCalledOnce();

    await clear(runtimePortInput);
    await setValue(runtimePortInput, "8899");
    const connectButton = await waitFor(() => getRuntimeConnectButton());
    await click(connectButton);

    await waitFor(() => {
      expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({ host: null, port: 8899 });
    });
  });

  it("blocks invalid local runtime ports in a real browser", async () => {
    const onConnectLocalRuntimePort = vi.fn().mockResolvedValue(undefined);

    await renderAndFlush(
      <Home
        {...baseProps}
        onConnectLocalRuntimePort={onConnectLocalRuntimePort}
        workspaceLoadError="Code runtime is unavailable for list workspaces."
      />
    );

    const runtimePortInput = getRuntimeTargetInput();

    await waitFor(() => {
      expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({ host: null, port: 8788 });
    });
    onConnectLocalRuntimePort.mockClear();

    await clear(runtimePortInput);
    await setValue(runtimePortInput, "70000");
    const connectButton = await waitFor(() => getRuntimeConnectButton());
    await click(connectButton);

    expect(onConnectLocalRuntimePort).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.body.textContent).toContain(
        "Enter a valid runtime port between 1 and 65535."
      );
    });
  });

  it("passes a remote runtime address from home in a real browser", async () => {
    const onConnectLocalRuntimePort = vi.fn().mockResolvedValue(undefined);

    await renderAndFlush(
      <Home
        {...baseProps}
        onConnectLocalRuntimePort={onConnectLocalRuntimePort}
        workspaceLoadError="Code runtime is unavailable for list workspaces."
      />
    );

    await waitFor(() => {
      expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({ host: null, port: 8788 });
    });
    onConnectLocalRuntimePort.mockClear();

    const runtimeAddressInput = getRuntimeTargetInput();

    await setValue(runtimeAddressInput, "https://runtime.example.com:8788/rpc");
    const connectButton = await waitFor(() => getRuntimeConnectButton());
    await click(connectButton);

    await waitFor(() => {
      expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({
        host: "runtime.example.com",
        port: 8788,
      });
    });
  });

  it("auto-connects the default local runtime once in a real browser on local startup", async () => {
    const onConnectLocalRuntimePort = vi.fn().mockResolvedValue(undefined);

    await renderAndFlush(
      <Home
        {...baseProps}
        onConnectLocalRuntimePort={onConnectLocalRuntimePort}
        workspaceLoadError="Code runtime is unavailable for list workspaces."
      />
    );

    await waitFor(() => {
      expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({ host: null, port: 8788 });
    });
    expect(onConnectLocalRuntimePort).toHaveBeenCalledTimes(1);
  });

  it("routes send to the newly selected workspace before activation catches up in a real browser", async () => {
    const onSend = vi.fn();
    const onSendToWorkspace = vi.fn();
    const onSelectWorkspace = vi.fn();

    render(
      <Home
        {...baseProps}
        onSend={onSend}
        onSendToWorkspace={onSendToWorkspace}
        onSelectWorkspace={onSelectWorkspace}
        workspaces={[
          { id: "workspace-1", name: "Workspace One" },
          { id: "workspace-2", name: "Workspace Two" },
        ]}
        activeWorkspaceId="workspace-1"
        sidebarCollapsed
      />
    );

    const workspaceTrigger = getHomeWorkspaceTrigger();

    await click(workspaceTrigger);

    const workspaceTwoOption = await waitFor(() => {
      const option = Array.from(
        document.querySelectorAll<HTMLButtonElement>('button[role="option"]')
      ).find((candidate) => candidate.textContent?.trim() === "Workspace Two");
      expect(option).toBeTruthy();
      return option as HTMLButtonElement;
    });

    await click(workspaceTwoOption);

    const input = Array.from(
      document.querySelectorAll<HTMLTextAreaElement>('textarea[aria-label="Composer draft"]')
    ).at(-1);
    const sendButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button[aria-label="Send"]')
    ).at(-1);
    if (!input || !sendButton) {
      throw new Error("Expected launchpad composer controls");
    }

    await setValue(input, "route immediately");
    await click(sendButton);

    await waitFor(() => {
      expect(onSelectWorkspace).toHaveBeenNthCalledWith(1, "workspace-2");
      expect(onSelectWorkspace).toHaveBeenNthCalledWith(2, "workspace-2");
      expect(onSendToWorkspace).toHaveBeenCalledWith("workspace-2", "route immediately", []);
    });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("renders the workspace selector with the same pill chrome language as workspace shell", async () => {
    render(
      <Home
        {...baseProps}
        workspaces={[
          { id: "workspace-1", name: "Workspace One" },
          { id: "workspace-2", name: "Workspace Two" },
        ]}
        activeWorkspaceId="workspace-1"
        sidebarCollapsed
      />
    );

    const leading = document.querySelector<HTMLElement>('[data-home-thread-leading="true"]');
    const trigger = getHomeWorkspaceTrigger();
    if (!leading || !trigger) {
      throw new Error("Expected home workspace selector chrome");
    }

    const leadingStyle = window.getComputedStyle(leading);
    const triggerStyle = window.getComputedStyle(trigger);

    expect(leadingStyle.backgroundImage).toBe("none");
    expect(leadingStyle.boxShadow).toBe("none");
    expect(leadingStyle.paddingTop).toBe("0px");
    expect(leadingStyle.paddingRight).toBe("0px");

    expect(triggerStyle.minHeight).toBe("28px");
    expect(triggerStyle.borderTopLeftRadius).toBe("999px");
    expect(triggerStyle.boxShadow).toBe("none");
    expect(triggerStyle.backgroundImage).toBe("none");
    await click(trigger);

    const menu = document.querySelector<HTMLElement>(
      '[role="listbox"][aria-label="Select workspace"]'
    );
    if (!menu) {
      throw new Error("Expected workspace selector menu");
    }

    const menuStyle = window.getComputedStyle(menu);
    expect(menuStyle.borderTopLeftRadius).toBe("16px");
    expect(menuStyle.backgroundImage).toBe("none");
  });

  it("renders the home scaffold markers and keeps the dock outside the scroll area in a real browser", async () => {
    render(
      <Home
        {...baseProps}
        workspaces={[
          { id: "workspace-1", name: "Workspace One" },
          { id: "workspace-2", name: "Workspace Two" },
        ]}
        activeWorkspaceId="workspace-1"
      />
    );

    const homeFrame = document.querySelector<HTMLElement>("[data-home-frame='true']");
    const homeHero = document.querySelector<HTMLElement>("[data-home-hero='true']");
    const homeDock = document.querySelector<HTMLElement>("[data-home-dock='true']");
    const nestedDock = document.querySelector(
      "[data-home-scroll-area='true'] [data-home-dock='true']"
    );

    expect(homeFrame).toBeTruthy();
    expect(homeHero).toBeNull();
    expect(document.querySelector('[data-testid="home-mission-launchpad"]')).toBeTruthy();
    expect(homeDock).toBeTruthy();
    expect(nestedDock).toBeNull();
  });

  it("routes runtime-unavailable sends into settings instead of project setup in a real browser", async () => {
    const onOpenProject = vi.fn();
    const onOpenSettings = vi.fn();

    render(
      <Home
        {...baseProps}
        onOpenProject={onOpenProject}
        onOpenSettings={onOpenSettings}
        workspaceLoadError="Code runtime is unavailable for list workspaces."
      />
    );

    const { input, sendButton } = getLaunchpadComposerControls();

    await act(async () => {
      await setValue(input, "help me debug the runtime");
      await click(sendButton);
    });

    await waitFor(() => {
      expect(onOpenSettings).toHaveBeenCalledOnce();
    });
    expect(onOpenProject).not.toHaveBeenCalled();
  });

  it("queues send until the workspace becomes active in a real browser", async () => {
    const onSend = vi.fn();
    const onSelectWorkspace = vi.fn();
    const view = render(
      <Home
        {...baseProps}
        onSend={onSend}
        onSelectWorkspace={onSelectWorkspace}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId={null}
      />
    );

    const { input, sendButton } = getLaunchpadComposerControls();

    await setValue(input, "queue after select");
    await click(sendButton);

    await waitFor(() => {
      expect(onSelectWorkspace).toHaveBeenCalledWith("workspace-1");
    });
    expect(onSend).not.toHaveBeenCalled();

    view.rerender(
      <Home
        {...baseProps}
        onSend={onSend}
        onSelectWorkspace={onSelectWorkspace}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId="workspace-1"
      />
    );

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith("queue after select", []);
    });
  });

  it("routes the first send through an explicit workspace handler in a real browser", async () => {
    const onSend = vi.fn();
    const onSendToWorkspace = vi.fn();
    const onSelectWorkspace = vi.fn();

    render(
      <Home
        {...baseProps}
        onSend={onSend}
        onSendToWorkspace={onSendToWorkspace}
        onSelectWorkspace={onSelectWorkspace}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId={null}
      />
    );

    const { input, sendButton } = getLaunchpadComposerControls();

    await setValue(input, "send directly from home");
    await click(sendButton);

    await waitFor(() => {
      expect(onSelectWorkspace).toHaveBeenCalledWith("workspace-1");
      expect(onSendToWorkspace).toHaveBeenCalledWith("workspace-1", "send directly from home", []);
    });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("blocks home /review routing in web mode and shows a desktop-only toast in a real browser", async () => {
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    const onSend = vi.fn();
    const onSendToWorkspace = vi.fn();
    const onSelectWorkspace = vi.fn();

    render(
      <Home
        {...baseProps}
        onSend={onSend}
        onSendToWorkspace={onSendToWorkspace}
        onSelectWorkspace={onSelectWorkspace}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId={null}
      />
    );

    const { input, sendButton } = getLaunchpadComposerControls();

    await setValue(input, "/review");
    await click(sendButton);

    await waitFor(() => {
      expect(pushErrorToast).toHaveBeenCalledWith({
        title: "Desktop review only",
        message: "Review start is only available in the desktop app.",
      });
    });
    expect(onSelectWorkspace).not.toHaveBeenCalled();
    expect(onSendToWorkspace).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
    expect(input.value).toBe("/review");
  });

  it("prefers the connected workspace for first-submit routing in a real browser", async () => {
    const onSend = vi.fn();
    const onSelectWorkspace = vi.fn();

    render(
      <Home
        {...baseProps}
        onSend={onSend}
        onSelectWorkspace={onSelectWorkspace}
        workspaces={[
          { id: "workspace-1", name: "Workspace One", connected: false },
          { id: "workspace-2", name: "Workspace Two", connected: true },
        ]}
        activeWorkspaceId={null}
      />
    );

    const { input, sendButton } = getLaunchpadComposerControls();

    await setValue(input, "route to connected workspace");
    await click(sendButton);

    await waitFor(() => {
      expect(onSelectWorkspace).toHaveBeenCalledWith("workspace-2");
    });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("preserves submission order while waiting for workspace activation in a real browser", async () => {
    const onSend = vi.fn();
    const onSelectWorkspace = vi.fn();
    const view = render(
      <Home
        {...baseProps}
        onSend={onSend}
        onSelectWorkspace={onSelectWorkspace}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId={null}
      />
    );

    const { input, sendButton } = getLaunchpadComposerControls();

    await setValue(input, "first queued from home");
    await click(sendButton);
    await clear(input);
    await setValue(input, "second queued from home");
    await click(sendButton);

    await waitFor(() => {
      expect(onSelectWorkspace).toHaveBeenCalledWith("workspace-1");
    });

    view.rerender(
      <Home
        {...baseProps}
        onSend={onSend}
        onSelectWorkspace={onSelectWorkspace}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId="workspace-1"
      />
    );

    await waitFor(() => {
      expect(onSend).toHaveBeenNthCalledWith(1, "first queued from home", []);
      expect(onSend).toHaveBeenNthCalledWith(2, "second queued from home", []);
    });
  });

  it("routes the mission signal settings action through the shared handler in a real browser", async () => {
    const onOpenSettings = vi.fn();

    render(
      <Home
        {...baseProps}
        onOpenSettings={onOpenSettings}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId="workspace-1"
      />
    );

    const routingTile = document.querySelector<HTMLElement>(
      '[data-testid="home-mission-signal-routing"]'
    );
    if (!routingTile) {
      throw new Error("Expected routing mission signal");
    }

    await click(routingTile);

    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("opens a recent mission thread from home in a real browser", async () => {
    const onSelectThread = vi.fn();

    render(
      <Home
        {...baseProps}
        latestAgentRuns={[
          {
            message: "Ship the dashboard refresh",
            timestamp: Date.now(),
            projectName: "CodexMonitor",
            groupName: "Frontend",
            workspaceId: "workspace-1",
            threadId: "thread-1",
            runId: "run-1",
            taskId: "thread-1",
            statusLabel: "Running",
            statusKind: "active",
            source: "runtime_snapshot_v1",
            warningCount: 0,
          },
        ]}
        workspaces={[{ id: "workspace-1", name: "Workspace One", connected: true }]}
        activeWorkspaceId="workspace-1"
        onSelectThread={onSelectThread}
      />
    );

    const recentMission = document.querySelector<HTMLElement>(
      '[data-testid="home-recent-mission-thread-1"]'
    );
    if (!recentMission) {
      throw new Error("Expected recent mission card");
    }

    await click(recentMission);

    expect(onSelectThread).toHaveBeenCalledWith("workspace-1", "thread-1");
  });

  it("routes runtime-managed recent missions into review in a real browser", async () => {
    const onSelectThread = vi.fn();
    const onOpenReviewMission = vi.fn();

    render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One", connected: true }]}
        activeWorkspaceId="workspace-1"
        latestAgentRuns={[
          {
            message: "Runtime prepared a review pack without a thread destination.",
            timestamp: Date.now(),
            projectName: "CodexMonitor",
            workspaceId: "workspace-1",
            threadId: "runtime-task:task-7",
            runId: "task-7",
            taskId: "runtime-task:task-7",
            statusLabel: "Review ready",
            statusKind: "review_ready",
            source: "runtime_snapshot_v1",
            warningCount: 0,
            navigationTarget: {
              kind: "review",
              workspaceId: "workspace-1",
              taskId: "runtime-task:task-7",
              runId: "task-7",
              reviewPackId: "review-pack:task-7",
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
          },
        ]}
        onSelectThread={onSelectThread}
        onOpenReviewMission={onOpenReviewMission}
      />
    );

    const runtimeMission = document.querySelector<HTMLElement>(
      '[data-testid="home-recent-mission-runtime-task:task-7"]'
    );
    if (!runtimeMission) {
      throw new Error("Expected runtime-managed recent mission");
    }

    await click(runtimeMission);

    expect(onOpenReviewMission).toHaveBeenCalledWith(
      "workspace-1",
      "runtime-task:task-7",
      "task-7",
      "review-pack:task-7"
    );
    expect(onSelectThread).not.toHaveBeenCalled();
  });

  it("opens and closes the agent settings dialog from the top toolbar in a real browser", async () => {
    render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId="workspace-1"
      />
    );

    const settingsButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Open agent command center"]'
    );
    if (!settingsButton) {
      throw new Error("Expected agent settings trigger");
    }

    await click(settingsButton);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="home-agent-settings-dialog"]')).toBeTruthy();
    });

    const closeButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Close agent command center"]'
    );
    if (!closeButton) {
      throw new Error("Expected close agent settings button");
    }

    await click(closeButton);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="home-agent-settings-dialog"]')).toBeNull();
    });
  });

  it("closes the agent settings dialog by backdrop and escape in a real browser", async () => {
    render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId="workspace-1"
      />
    );

    const settingsButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Open agent command center"]'
    );
    if (!settingsButton) {
      throw new Error("Expected agent settings trigger");
    }

    await click(settingsButton);

    const backdrop = await waitFor(() => {
      const candidate = document.querySelector<HTMLElement>(".ds-modal-backdrop");
      expect(candidate).toBeTruthy();
      return candidate as HTMLElement;
    });

    await dispatchClick(backdrop);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="home-agent-settings-dialog"]')).toBeNull();
    });

    await click(settingsButton);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="home-agent-settings-dialog"]')).toBeTruthy();
    });

    await dispatchWindowEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    await waitFor(() => {
      expect(document.querySelector('[data-testid="home-agent-settings-dialog"]')).toBeNull();
    });
  });

  it("shows the active workspace summary without duplicating routing controls in a real browser", () => {
    render(
      <Home
        {...baseProps}
        workspaces={[
          {
            id: "workspace-1",
            name: "Workspace One",
            path: "/Users/han/Documents/Code/Y/Y-keep-up",
          },
          { id: "workspace-2", name: "Demo Workspace" },
        ]}
        activeWorkspaceId="workspace-1"
      />
    );

    const summary = document.querySelector<HTMLElement>('[data-testid="home-workspace-summary"]');
    if (!summary) {
      throw new Error("Expected workspace summary");
    }

    expect(summary.getAttribute("data-workspace-summary-scope")).toBe("active");
    expect(document.body.textContent).toContain("Active");
    expect(document.body.textContent).toContain("Workspace One");
    expect(document.body.textContent).toContain("/Users/han/Documents/Code/Y/Y-keep-up");
  });

  it("shows the connected workspace in the selector when home has no active workspace in a real browser", () => {
    render(
      <Home
        {...baseProps}
        workspaces={[
          { id: "workspace-1", name: "Workspace One", connected: false },
          { id: "workspace-2", name: "Workspace Two", connected: true },
        ]}
        activeWorkspaceId={null}
        sidebarCollapsed
      />
    );

    const workspaceTrigger = getHomeWorkspaceTrigger();

    expect(workspaceTrigger.textContent ?? "").toContain("Workspace Two");
  });

  it("keeps the workspace summary inside the launchpad setup grid in a real browser", () => {
    render(
      <Home
        {...baseProps}
        workspaces={[
          {
            id: "workspace-1",
            name: "Workspace One",
            path: "/Users/han/Documents/Code/Y/Y-keep-up",
          },
          { id: "workspace-2", name: "Workspace Two" },
        ]}
        activeWorkspaceId="workspace-1"
      />
    );

    const summary = document.querySelector<HTMLElement>('[data-testid="home-workspace-summary"]');
    const launchpad = document.querySelector<HTMLElement>('[data-testid="home-mission-launchpad"]');
    const setupGrid = document.querySelector<HTMLElement>(
      "[data-home-launchpad-setup-grid='true']"
    );
    if (!summary || !setupGrid || !launchpad) {
      throw new Error("Expected home launchpad panels");
    }

    expect(launchpad.contains(setupGrid)).toBe(true);
    expect(setupGrid.contains(summary)).toBe(true);
  });

  it("keeps the top-level launchpad layout in a single column in a real browser", () => {
    render(
      <Home
        {...baseProps}
        workspaces={[
          {
            id: "workspace-1",
            name: "Workspace One",
            path: "/Users/han/Documents/Code/Y/Y-keep-up",
          },
          { id: "workspace-2", name: "Workspace Two" },
        ]}
        activeWorkspaceId="workspace-1"
      />
    );

    const widgets = document.querySelector<HTMLElement>("[data-home-dashboard-widgets='true']");
    const summary = document.querySelector<HTMLElement>('[data-testid="home-workspace-summary"]');
    const launchpad = document.querySelector<HTMLElement>('[data-testid="home-mission-launchpad"]');
    if (!widgets || !summary || !launchpad) {
      throw new Error("Expected stacked home launchpad layout");
    }

    const widgetsStyle = getComputedStyle(widgets);

    expect(widgetsStyle.display).toBe("grid");
    expect(launchpad.contains(summary)).toBe(true);
  });

  it("keeps launchpad starters in a compact row density in a real browser", () => {
    render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId="workspace-1"
      />
    );

    const starter = document.querySelector<HTMLElement>(
      '[data-testid="home-launchpad-starter-audit-ui"]'
    );
    if (!starter) {
      throw new Error("Expected launchpad starter");
    }

    expect(starter.getBoundingClientRect().height).toBeLessThan(160);
  });

  it("describes the default workspace honestly when home has not activated one yet in a real browser", () => {
    render(
      <Home
        {...baseProps}
        workspaces={[
          { id: "workspace-1", name: "Workspace One", path: "/tmp/workspace-web" },
          { id: "workspace-2", name: "Workspace Two", connected: true, path: "/tmp/workspace-two" },
        ]}
        activeWorkspaceId={null}
      />
    );

    const summary = document.querySelector<HTMLElement>('[data-testid="home-workspace-summary"]');
    if (!summary) {
      throw new Error("Expected workspace summary");
    }

    expect(summary.getAttribute("data-workspace-summary-scope")).toBe("default");
    expect(document.body.textContent).toContain("Default");
    expect(document.body.textContent).toContain("/tmp/workspace-two");
    expect(document.body.textContent).not.toContain("Active workspace");
  });

  it("opens the review-ready mission signal into review in a real browser", async () => {
    const onOpenReviewMission = vi.fn();
    const onSelectThread = vi.fn();

    render(
      <Home
        {...baseProps}
        latestAgentRuns={[
          {
            message: "Runtime prepared a review pack without a thread destination.",
            timestamp: Date.now(),
            projectName: "CodexMonitor",
            workspaceId: "workspace-1",
            threadId: "runtime-task:task-7",
            runId: "task-7",
            taskId: "runtime-task:task-7",
            statusLabel: "Review ready",
            statusKind: "review_ready",
            source: "runtime_snapshot_v1",
            warningCount: 0,
            navigationTarget: {
              kind: "review",
              workspaceId: "workspace-1",
              taskId: "runtime-task:task-7",
              runId: "task-7",
              reviewPackId: "review-pack:task-7",
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
          },
        ]}
        workspaces={[{ id: "workspace-1", name: "Workspace One", connected: true }]}
        activeWorkspaceId="workspace-1"
        onSelectThread={onSelectThread}
        onOpenReviewMission={onOpenReviewMission}
      />
    );

    const reviewReadyTile = document.querySelector<HTMLElement>(
      '[data-testid="home-mission-signal-review-ready"]'
    );
    if (!reviewReadyTile) {
      throw new Error("Expected review-ready mission signal");
    }

    await click(reviewReadyTile);

    expect(onOpenReviewMission).toHaveBeenCalledWith(
      "workspace-1",
      "runtime-task:task-7",
      "task-7",
      "review-pack:task-7"
    );
    expect(onSelectThread).not.toHaveBeenCalled();
  });

  it("resumes the active mission from the routing signal in a real browser", async () => {
    const onOpenSettings = vi.fn();
    const onSelectThread = vi.fn();

    render(
      <Home
        {...baseProps}
        onOpenSettings={onOpenSettings}
        workspaces={[{ id: "workspace-1", name: "Workspace One", connected: true }]}
        activeWorkspaceId="workspace-1"
        latestAgentRuns={[
          {
            message: "Ship the dashboard refresh",
            timestamp: Date.now(),
            projectName: "CodexMonitor",
            groupName: "Frontend",
            workspaceId: "workspace-1",
            threadId: "thread-1",
            runId: "run-1",
            taskId: "thread-1",
            statusLabel: "Running",
            statusKind: "active",
            source: "runtime_snapshot_v1",
            warningCount: 0,
          },
        ]}
        onSelectThread={onSelectThread}
      />
    );

    const routingTile = document.querySelector<HTMLElement>(
      '[data-testid="home-mission-signal-routing"]'
    );
    if (!routingTile) {
      throw new Error("Expected routing mission signal");
    }

    await click(routingTile);

    expect(onSelectThread).toHaveBeenCalledWith("workspace-1", "thread-1");
    expect(onOpenSettings).not.toHaveBeenCalled();
  });
});
