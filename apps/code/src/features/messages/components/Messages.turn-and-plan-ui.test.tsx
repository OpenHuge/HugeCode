// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalRequest, ConversationItem } from "../../../types";
import { Messages } from "./Messages";

const deferredWait = { timeout: 5_000 };

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

  it("shows a current-turn divider before grouped tool output", () => {
    const items: ConversationItem[] = [
      {
        id: "history-assistant",
        kind: "message",
        role: "assistant",
        text: "Previous turn output",
      },
      {
        id: "turn-user",
        kind: "message",
        role: "user",
        text: "Run checks",
      },
      {
        id: "turn-tool-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git status",
        detail: "/repo",
        status: "completed",
        output: "",
      },
      {
        id: "turn-tool-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git diff",
        detail: "/repo",
        status: "completed",
        output: "",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-divider"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const divider = screen.getByTestId("current-turn-divider");
    const toolGroup = screen.getByRole("button", { name: /tool group: 2 tool calls/i });
    expect(divider).toBeTruthy();
    expect(toolGroup).toBeTruthy();
    expect(divider.textContent).not.toContain("2 tool calls");
    const dividerBeforeToolGroup =
      (divider as Element).compareDocumentPosition(toolGroup as Element) &
      Node.DOCUMENT_POSITION_FOLLOWING;
    expect(dividerBeforeToolGroup).toBeTruthy();
  });

  it("does not show a current-turn divider when there is no earlier visible history", () => {
    const items: ConversationItem[] = [
      {
        id: "fresh-user",
        kind: "message",
        role: "user",
        text: "Start here",
      },
      {
        id: "fresh-assistant",
        kind: "message",
        role: "assistant",
        text: "First reply",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-fresh"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.queryByTestId("current-turn-divider")).toBeNull();
  });

  it("keeps the current-turn and tool-group chrome in a muted shell language", () => {
    const source = readFileSync(resolve(import.meta.dirname, "Messages.styles.css.ts"), "utf8");

    expect(source).not.toContain('backdropFilter: "blur(10px)"');
    expect(source).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card-base) 94%, transparent), color-mix(in srgb, var(--ds-surface-control) 72%, transparent))"
    );
    expect(source).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-control) 66%, transparent), color-mix(in srgb, var(--ds-surface-card-base) 90%, transparent))"
    );
    expect(source).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--ds-brand-primary) 12%, var(--ds-surface-card-base)), color-mix(in srgb, var(--ds-brand-primary) 8%, var(--ds-surface-control)))"
    );
    expect(source).not.toContain(
      "linear-gradient(90deg, transparent, color-mix(in srgb, var(--ds-border-subtle) 88%, transparent), transparent)"
    );
  });

  it("keeps current-turn activity in the divider without rendering a duplicate summary card", () => {
    const items: ConversationItem[] = [
      {
        id: "history-think",
        kind: "message",
        role: "assistant",
        text: "Earlier",
      },
      {
        id: "think-user",
        kind: "message",
        role: "user",
        text: "Continue",
      },
      {
        id: "think-tool",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: pnpm test",
        detail: "/repo",
        status: "in_progress",
        output: "",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-thinking-divider"
        workspaceId="ws-1"
        isThinking
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByTestId("current-turn-divider").textContent).toContain("Running command");
    expect(screen.queryByTestId("current-turn-summary")).toBeNull();
  });

  it("keeps the latest completed history slice visible as the current turn after reload", () => {
    const items: ConversationItem[] = [
      {
        id: "history-user",
        kind: "message",
        role: "user",
        text: "Earlier question",
      },
      {
        id: "history-assistant",
        kind: "message",
        role: "assistant",
        text: "Earlier answer",
      },
      {
        id: "completed-user",
        kind: "message",
        role: "user",
        text: "What exact marker appears earlier in this thread?",
      },
      {
        id: "completed-tool",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: runtime-plan-validation",
        detail: "{}",
        status: "completed",
        output: "",
      },
      {
        id: "completed-assistant",
        kind: "message",
        role: "assistant",
        text: "PERSIST_TEST_ALPHA",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-reloaded-history"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={null}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByTestId("current-turn-divider").textContent).toContain("Current turn");
    expect(screen.queryByText("TURN COMPLETE")).toBeNull();
  });

  it("shows a plan-ready follow-up prompt after a completed plan tool item", async () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-1",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "- Step 1",
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
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />
    );

    const openPlanPanelButton = await screen.findByRole(
      "button",
      { name: "Open plan panel" },
      deferredWait
    );
    const planCard = openPlanPanelButton.closest(".timeline-plan-card");
    expect(
      (await screen.findAllByText("Plan ready", undefined, deferredWait)).length
    ).toBeGreaterThan(0);
    expect(planCard).toBeTruthy();
    expect(within(planCard as HTMLElement).getByText("- Step 1")).toBeTruthy();
    expect(screen.getByText("Next step")).toBeTruthy();
    expect(openPlanPanelButton).toBeTruthy();
    expect(screen.getByRole("button", { name: "Implement plan" })).toBeTruthy();
  });

  it("renders runtime status guidance inside the message lane", () => {
    const onOpenSettings = vi.fn();

    render(
      <Messages
        items={[]}
        threadId="thread-runtime"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        workspaceLoadError="Code runtime is unavailable for list workspaces."
        onOpenSettings={onOpenSettings}
      />
    );

    expect(screen.getByText("Runtime offline")).toBeTruthy();
    expect(
      screen.getByText(
        "Reconnect the runtime from settings, or choose another workspace from the sidebar while this one is unavailable."
      )
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Continue in the composer.")).toBeNull();
  });

  it("shows a restoring-history state instead of a new-agent prompt while workspace threads are rehydrating", () => {
    render(
      <Messages
        items={[]}
        threadId={null}
        workspaceId="ws-1"
        isThinking={false}
        isRestoringThreadHistory
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.getByText("Restoring recent threads")).toBeTruthy();
    expect(screen.getByText("Loading history…")).toBeTruthy();
    expect(screen.queryByText("Start in the composer.")).toBeNull();
  });

  it("renders provider rejection failures as timeline error panels", () => {
    render(
      <Messages
        items={[
          {
            id: "provider-reject",
            kind: "message",
            role: "assistant",
            text: "Turn failed: runtime.turn.provider.rejected",
          },
        ]}
        threadId="thread-provider-reject"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    const title = screen.getByText("Provider rejected request");
    expect(title).toBeTruthy();
    expect(title.closest(".timeline-status-card--error")).toBeTruthy();
    expect(screen.getByText("runtime.turn.provider.rejected")).toBeTruthy();
  });

  it("routes provider setup failures to settings from inside the timeline", () => {
    const onOpenSettings = vi.fn();

    render(
      <Messages
        items={[
          {
            id: "provider-setup",
            kind: "message",
            role: "assistant",
            text: "No available model route in current runtime. Sign in with a provider account or configure API keys.",
          },
        ]}
        threadId="thread-provider-setup"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onOpenSettings={onOpenSettings}
      />
    );

    expect(screen.getByText("Provider setup required")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("renders approval requests inline and handles approve actions", async () => {
    const onApprovalDecision = vi.fn();
    const approvals: ApprovalRequest[] = [
      {
        workspace_id: "ws-1",
        request_id: "approval-1",
        method: "runtime/requestApproval/shell",
        params: {
          threadId: "thread-approval",
          command: "pnpm validate:fast",
        },
      },
    ];

    render(
      <Messages
        items={[]}
        threadId="thread-approval"
        workspaceId="ws-1"
        approvals={approvals}
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onApprovalDecision={onApprovalDecision}
      />
    );

    expect(await screen.findByText("Approval required", undefined, deferredWait)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve (Enter)" }));
    expect(onApprovalDecision).toHaveBeenCalledWith(approvals[0], "accept");
  });

  it("does not render unthreaded approval requests inline", () => {
    render(
      <Messages
        items={[]}
        threadId="thread-approval"
        workspaceId="ws-1"
        approvals={[
          {
            workspace_id: "ws-1",
            request_id: "approval-floating",
            method: "runtime/requestApproval/shell",
            params: {
              command: "pnpm validate:fast",
            },
          },
        ]}
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onApprovalDecision={vi.fn()}
      />
    );

    expect(screen.queryByText("Approval required")).toBeNull();
  });

  it("does not auto-approve inline requests when a button is focused", async () => {
    const onApprovalDecision = vi.fn();

    render(
      <Messages
        items={[]}
        threadId="thread-approval"
        workspaceId="ws-1"
        approvals={[
          {
            workspace_id: "ws-1",
            request_id: "approval-1",
            method: "runtime/requestApproval/shell",
            params: {
              threadId: "thread-approval",
              command: "pnpm validate:fast",
            },
          },
        ]}
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onApprovalDecision={onApprovalDecision}
      />
    );

    const declineButton = await screen.findByRole("button", { name: "Decline" }, deferredWait);
    declineButton.focus();
    fireEvent.keyDown(window, { key: "Enter" });

    expect(onApprovalDecision).not.toHaveBeenCalled();
  });

  it("renders a summary card when the active approval is handled in the composer", async () => {
    render(
      <Messages
        items={[]}
        threadId="thread-approval"
        workspaceId="ws-1"
        approvals={[
          {
            workspace_id: "ws-1",
            request_id: "approval-composer",
            method: "runtime/requestApproval/shell",
            params: {
              threadId: "thread-approval",
              command: "pnpm validate:fast",
            },
          },
        ]}
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onApprovalDecision={vi.fn()}
        composerApprovalRequestId="approval-composer"
      />
    );

    expect(
      await screen.findByText(
        "This approval is active in the composer below.",
        undefined,
        deferredWait
      )
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve (Enter)" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Decline" })).toBeNull();
  });

  it("synthesizes turn diff content into the timeline and exposes revert action", () => {
    const onRevertAllGitChanges = vi.fn();

    render(
      <Messages
        items={[]}
        threadId="thread-diff"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        turnDiff={[
          "diff --git a/src/a.ts b/src/a.ts",
          "--- a/src/a.ts",
          "+++ b/src/a.ts",
          "@@ -1 +1 @@",
          "-old",
          "+new",
        ].join("\n")}
        onRevertAllGitChanges={onRevertAllGitChanges}
      />
    );

    const title = screen.getByText("Turn diff");
    expect(title).toBeTruthy();
    expect(title.closest(".timeline-turn-diff-card")).toBeTruthy();
    expect(screen.getByText("src/a.ts")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show diff" }));
    expect(screen.getByRole("button", { name: "Hide diff" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Revert all changes" }));
    expect(onRevertAllGitChanges).toHaveBeenCalledTimes(1);
  });

  it("renders plan-ready follow-up inside the assistant message lane", async () => {
    const items: ConversationItem[] = [
      {
        id: "plan-layout",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-layout"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={vi.fn()}
        onPlanSubmitChanges={vi.fn()}
      />
    );

    const card = (
      await screen.findByRole("button", { name: "Open plan panel" }, deferredWait)
    ).closest(".timeline-plan-card");
    expect(card).toBeTruthy();
    expect(card?.closest(".message.assistant")).toBeTruthy();
    expect(card?.closest(".message-content")).toBeTruthy();
  });

  it("anchors the plan follow-up after the plan item instead of appending after later timeline messages", async () => {
    render(
      <Messages
        items={[
          {
            id: "plan-anchor",
            kind: "tool",
            toolType: "plan",
            title: "Plan",
            detail: "completed",
            status: "completed",
            output: "Anchored plan text",
          },
          {
            id: "assistant-after-plan",
            kind: "message",
            role: "assistant",
            text: "Later timeline content",
          },
        ]}
        threadId="thread-plan-anchor"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={vi.fn()}
        onPlanSubmitChanges={vi.fn()}
      />
    );

    const planCard = (
      await screen.findByRole("button", { name: "Open plan panel" }, deferredWait)
    ).closest(".timeline-plan-card");
    const laterMessage = screen.getByText("Later timeline content");

    expect(planCard).toBeTruthy();
    expect(
      (planCard as Element).compareDocumentPosition(laterMessage) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("hides the plan-ready follow-up once the user has replied after the plan", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-2",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
      },
      {
        id: "user-after-plan",
        kind: "message",
        role: "user",
        text: "OK",
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
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />
    );

    expect(screen.queryByText("Plan ready")).toBeNull();
  });

  it("hides the plan-ready follow-up when the plan tool item is still running", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-3",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "Generating plan...",
        status: "in_progress",
        output: "Partial plan",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={true}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />
    );

    expect(screen.queryByText("Plan ready")).toBeNull();
  });

  it("shows the plan-ready follow-up once the turn stops thinking even if the plan status stays in_progress", async () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-stuck-in-progress",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "Generating plan...",
        status: "in_progress",
        output: "Plan text",
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
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />
    );

    expect(
      (await screen.findAllByText("Plan ready", undefined, deferredWait)).length
    ).toBeGreaterThan(0);
  });

  it("renders the plan follow-up as an artifact summary without an inline textarea", async () => {
    const onPlanAccept = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-4",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
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
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={vi.fn()}
      />
    );

    expect(
      await screen.findByRole("button", { name: "Open plan panel" }, deferredWait)
    ).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Plan change request" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit changes" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Implement plan" }));
    expect(onPlanAccept).toHaveBeenCalledTimes(1);
  });

  it("dismisses the plan-ready follow-up when the plan is accepted", async () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-accept",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
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
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "Implement plan" }, deferredWait));
    expect(onPlanAccept).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Plan ready")).toBeNull();
  });

  it("does not render plan-ready tagged internal user messages", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-6",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
      },
      {
        id: "internal-user",
        kind: "message",
        role: "user",
        text: "[[cm_plan_ready:accept]] Implement this plan.",
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
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />
    );

    expect(screen.queryByText(/cm_plan_ready/)).toBeNull();
    expect(screen.queryByText("Plan ready")).toBeNull();
  });

  it("hides the plan follow-up when an input-requested bubble is active", async () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-5",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
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
        userInputRequests={[
          {
            workspace_id: "ws-1",
            request_id: 1,
            params: {
              thread_id: "thread-1",
              turn_id: "turn-1",
              item_id: "item-1",
              questions: [],
            },
          },
        ]}
        onUserInputSubmit={vi.fn()}
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />
    );

    expect(await screen.findByText("Input requested", undefined, deferredWait)).toBeTruthy();
    expect(screen.queryByText("Plan ready")).toBeNull();
  });

  it("hides the plan follow-up when a tool-call request bubble is active", async () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-tool-call-1",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
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
        toolCallRequests={[
          {
            workspace_id: "ws-1",
            request_id: 12,
            params: {
              thread_id: "thread-1",
              turn_id: "turn-1",
              call_id: "call-1",
              tool: "collect_system_info",
              arguments: { scope: "workspace" },
            },
          },
        ]}
        onToolCallSubmit={vi.fn()}
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />
    );

    expect(await screen.findByText("Tool call requested", undefined, deferredWait)).toBeTruthy();
    expect(screen.queryByText("Plan ready")).toBeNull();
  });

  it("hides non-blocking planner diagnostics outside plan mode", () => {
    const items: ConversationItem[] = [
      {
        id: "runtime-plan-lint-hidden",
        kind: "tool",
        toolType: "mcpToolCall",
        title: "Tool: runtime / runtime-plan-validation",
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
        status: "completed",
        output: "",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-plan-lint-hidden"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    expect(screen.queryByRole("button", { name: "Toggle tool details" })).toBeNull();
    expect(screen.queryByText("Planner diagnostics: 0 fatal, 1 warning")).toBeNull();
  });

  it("renders planner diagnostics from runtime validation tool payload in plan mode", () => {
    const items: ConversationItem[] = [
      {
        id: "runtime-plan-lint",
        kind: "tool",
        toolType: "mcpToolCall",
        title: "Tool: runtime / runtime-plan-validation",
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
        status: "completed",
        output: "",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-plan-lint"
        workspaceId="ws-1"
        isPlanModeActive
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle tool details" }));

    expect(screen.getByText("Planner diagnostics: 0 fatal, 1 warning")).toBeTruthy();
    expect(
      screen.getByText("WARNING planner.missing_success_criteria: Add explicit verification step.")
    ).toBeTruthy();
  });

  it("renders planner diagnostics when internal runtime diagnostics are enabled", () => {
    const items: ConversationItem[] = [
      {
        id: "runtime-plan-lint-debug",
        kind: "tool",
        toolType: "mcpToolCall",
        title: "Tool: runtime / runtime-plan-validation",
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
        status: "completed",
        output: "",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-plan-lint-debug"
        workspaceId="ws-1"
        showInternalRuntimeDiagnostics
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle tool details" }));

    expect(screen.getByText("Planner diagnostics: 0 fatal, 1 warning")).toBeTruthy();
    expect(
      screen.getByText("WARNING planner.missing_success_criteria: Add explicit verification step.")
    ).toBeTruthy();
  });

  it("keeps fatal planner diagnostics visible outside plan mode", () => {
    const items: ConversationItem[] = [
      {
        id: "runtime-plan-lint-fatal",
        kind: "tool",
        toolType: "mcpToolCall",
        title: "Tool: runtime / runtime-plan-validation",
        detail: JSON.stringify({
          plannerDiagnostics: {
            diagnostics: [
              {
                code: "planner.invalid_dependency",
                severity: "fatal",
                message: "Cycle detected.",
              },
            ],
          },
        }),
        status: "failed",
        output: "",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-plan-lint-fatal"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle tool details" }));

    expect(screen.getByText("Planner diagnostics: 1 fatal, 0 warning")).toBeTruthy();
    expect(screen.getByText("FATAL planner.invalid_dependency: Cycle detected.")).toBeTruthy();
  });

  it("does not surface planner diagnostics for ordinary runtime tool calls", () => {
    const items: ConversationItem[] = [
      {
        id: "runtime-read",
        kind: "tool",
        toolType: "mcpToolCall",
        title: "Tool: runtime / read",
        detail: JSON.stringify(
          {
            attempt: 1,
            batchId: "turn-123:runtime-plan-batch",
            path: "src/components/thread/ThreadMessage.tsx",
            plannerDiagnostics: {
              diagnostics: [
                {
                  code: "planner.missing_success_criteria",
                  severity: "warning",
                  message: "Planner output is missing explicit success criteria.",
                },
              ],
            },
          },
          null,
          2
        ),
        status: "failed",
        output: "",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-plan-lint"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle tool details" }));

    expect(container.textContent).toContain("ThreadMessage.tsx");
    expect(screen.queryByText("Planner diagnostics: 0 fatal, 1 warning")).toBeNull();
    expect(
      screen.queryByText(
        "WARNING planner.missing_success_criteria: Planner output is missing explicit success criteria."
      )
    ).toBeNull();
    expect(container.textContent).not.toContain('"plannerDiagnostics"');
    expect(container.textContent).not.toContain('"attempt"');
    expect(container.textContent).not.toContain('"batchId"');
  });

  it("submits tool-call output responses", async () => {
    const onToolCallSubmit = vi.fn();
    const request = {
      workspace_id: "ws-1",
      request_id: "tool-call-request-1",
      params: {
        thread_id: "thread-tool-call",
        turn_id: "turn-tool-call",
        call_id: "call-xyz",
        tool: "collect_system_info",
        arguments: {
          includeEnv: true,
        },
      },
    } as const;

    render(
      <Messages
        items={[]}
        threadId="thread-tool-call"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        toolCallRequests={[request]}
        onToolCallSubmit={onToolCallSubmit}
      />
    );

    expect(await screen.findByText("Tool call requested", undefined, deferredWait)).toBeTruthy();
    expect(screen.getAllByText("collect_system_info")).toHaveLength(2);
    expect(screen.getByText("call-xyz")).toBeTruthy();
    expect(screen.getByText("Tool")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Tool call output" }), {
      target: { value: "output payload" },
    });
    expect(
      screen.getByText("Uncheck this if the tool failed or should return an error outcome.")
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Mark call successful",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit output" }));

    expect(onToolCallSubmit).toHaveBeenCalledTimes(1);
    expect(onToolCallSubmit).toHaveBeenCalledWith(request, {
      contentItems: [{ type: "inputText", text: "output payload" }],
      success: false,
    });
  });

  it("anchors tool-call requests after the triggering item instead of appending after later messages", async () => {
    render(
      <Messages
        items={[
          {
            id: "call-xyz",
            kind: "tool",
            toolType: "commandExecution",
            title: "Command: collect_system_info",
            detail: "/repo",
            status: "completed",
            output: "",
          },
          {
            id: "assistant-after-tool-call",
            kind: "message",
            role: "assistant",
            text: "Later tool timeline content",
          },
        ]}
        threadId="thread-tool-call"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        toolCallRequests={[
          {
            workspace_id: "ws-1",
            request_id: "tool-call-request-2",
            params: {
              thread_id: "thread-tool-call",
              turn_id: "turn-tool-call",
              call_id: "call-xyz",
              tool: "collect_system_info",
              arguments: { includeEnv: true },
            },
          },
        ]}
        onToolCallSubmit={vi.fn()}
      />
    );

    const requestCard = (
      await screen.findByText("Tool call requested", undefined, deferredWait)
    ).closest(".timeline-tool-call-card");
    const laterMessage = screen.getByText("Later tool timeline content");

    expect(requestCard).toBeTruthy();
    expect(
      (requestCard as Element).compareDocumentPosition(laterMessage) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("renders a summary card when the active tool-call request is handled in the composer", async () => {
    const request = {
      workspace_id: "ws-1",
      request_id: "tool-call-request-summary",
      params: {
        thread_id: "thread-tool-call-summary",
        turn_id: "turn-tool-call-summary",
        call_id: "call-tool-summary",
        tool: "collect_system_info",
        arguments: { includeEnv: true },
      },
    } as const;

    render(
      <Messages
        items={[]}
        threadId="thread-tool-call-summary"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        toolCallRequests={[request]}
        onToolCallSubmit={vi.fn()}
        embedToolCallRequestInComposer
      />
    );

    expect(
      await screen.findByText(
        "This tool call is active in the composer below.",
        undefined,
        deferredWait
      )
    ).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Tool call output" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit output" })).toBeNull();
  });

  it("submits input-request answers and keeps the card in assistant layout", async () => {
    const onUserInputSubmit = vi.fn();
    const request = {
      workspace_id: "ws-1",
      request_id: 9,
      params: {
        thread_id: "thread-input",
        turn_id: "turn-input",
        item_id: "item-input",
        questions: [
          {
            id: "q_mode",
            header: "Execution",
            question: "How should I proceed?",
            options: [
              { label: "Safe mode", description: "Prefer safer changes first." },
              { label: "Fast mode", description: "Prioritize speed." },
            ],
          },
        ],
      },
    } as const;

    render(
      <Messages
        items={[]}
        threadId="thread-input"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        userInputRequests={[request]}
        onUserInputSubmit={onUserInputSubmit}
      />
    );

    const titleNode = await screen.findByText("Input requested", undefined, deferredWait);
    const card = titleNode.closest(".timeline-request-card");
    expect(card).toBeTruthy();
    expect(card?.closest(".message.assistant")).toBeTruthy();
    expect(card?.closest(".message-content")).toBeTruthy();
    expect(screen.getByText("1 question")).toBeTruthy();

    const modeGroup = screen.getByRole("radiogroup", {
      name: /Execution\W+How should I proceed\?/i,
    });
    expect(modeGroup).toBeTruthy();
    const safeModeOption = screen.getByRole("radio", { name: "Safe mode" });
    const fastModeOption = screen.getByRole("radio", { name: "Fast mode" });
    expect((safeModeOption as HTMLInputElement).checked).toBe(true);
    expect((fastModeOption as HTMLInputElement).checked).toBe(false);
    fireEvent.click(fastModeOption);
    expect((safeModeOption as HTMLInputElement).checked).toBe(false);
    expect((fastModeOption as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: /Notes for Execution:/i }), {
      target: { value: "Need audit trail" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    expect(onUserInputSubmit).toHaveBeenCalledTimes(1);
    expect(onUserInputSubmit).toHaveBeenCalledWith(request, {
      answers: {
        q_mode: {
          answers: ["Fast mode", "user_note: Need audit trail"],
        },
      },
    });
  });

  it("anchors input requests after the triggering item instead of appending after later messages", async () => {
    render(
      <Messages
        items={[
          {
            id: "item-input-anchor",
            kind: "message",
            role: "assistant",
            text: "Need your answer here",
          },
          {
            id: "assistant-after-input",
            kind: "message",
            role: "assistant",
            text: "Later request timeline content",
          },
        ]}
        threadId="thread-input-anchor"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        userInputRequests={[
          {
            workspace_id: "ws-1",
            request_id: 21,
            params: {
              thread_id: "thread-input-anchor",
              turn_id: "turn-input-anchor",
              item_id: "item-input-anchor",
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

    const requestCard = (
      await screen.findByText("Input requested", undefined, deferredWait)
    ).closest(".timeline-request-card");
    const laterMessage = screen.getByText("Later request timeline content");

    expect(requestCard).toBeTruthy();
    expect(
      (requestCard as Element).compareDocumentPosition(laterMessage) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("renders a summary card when the active request is handled in the composer", async () => {
    const request = {
      workspace_id: "ws-1",
      request_id: 14,
      params: {
        thread_id: "thread-input-summary",
        turn_id: "turn-input-summary",
        item_id: "item-input-summary",
        questions: [
          {
            id: "q_mode",
            header: "Execution",
            question: "How should I proceed?",
            options: [
              { label: "Safe mode", description: "Prefer safer changes first." },
              { label: "Fast mode", description: "Prioritize speed." },
            ],
          },
        ],
      },
    } as const;

    render(
      <Messages
        items={[]}
        threadId="thread-input-summary"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        userInputRequests={[request]}
        onUserInputSubmit={vi.fn()}
        embedActiveUserInputInComposer
      />
    );

    expect(
      await screen.findByText(
        "Continue in the composer below to answer this request.",
        undefined,
        deferredWait
      )
    ).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit answers" })).toBeNull();
  });

  it("renders a summary card when the active plan follow-up is handled in the composer", async () => {
    render(
      <Messages
        items={[
          {
            id: "plan-summary",
            kind: "tool",
            toolType: "plan",
            title: "Plan",
            detail: "completed",
            status: "completed",
            output: "1. Audit runtime setup",
          },
        ]}
        threadId="thread-plan-summary"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={vi.fn()}
        onPlanSubmitChanges={vi.fn()}
        embedPlanFollowupInComposer
      />
    );

    expect(
      await screen.findByText("This plan is active in the composer below.", undefined, deferredWait)
    ).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Plan change request" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit changes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Implement plan" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open plan panel" })).toBeTruthy();
  });

  it("submits skipped for empty freeform questions", async () => {
    const onUserInputSubmit = vi.fn();
    const request = {
      workspace_id: "ws-1",
      request_id: 12,
      params: {
        thread_id: "thread-freeform",
        turn_id: "turn-freeform",
        item_id: "item-freeform",
        questions: [
          {
            id: "q_notes",
            header: "Notes",
            question: "Any extra instructions?",
          },
        ],
      },
    } as const;

    render(
      <Messages
        items={[]}
        threadId="thread-freeform"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        userInputRequests={[request]}
        onUserInputSubmit={onUserInputSubmit}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "Submit answers" }, deferredWait));

    expect(onUserInputSubmit).toHaveBeenCalledWith(request, {
      answers: {
        q_notes: {
          answers: ["skipped"],
        },
      },
    });
  });

  it("renders secret request questions as password inputs", async () => {
    const onUserInputSubmit = vi.fn();
    const request = {
      workspace_id: "ws-1",
      request_id: 11,
      params: {
        thread_id: "thread-secret",
        turn_id: "turn-secret",
        item_id: "item-secret",
        questions: [
          {
            id: "q_secret",
            header: "API Key",
            question: "Provide credential",
            isSecret: true,
          },
        ],
      },
    } as const;

    render(
      <Messages
        items={[]}
        threadId="thread-secret"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        userInputRequests={[request]}
        onUserInputSubmit={onUserInputSubmit}
      />
    );

    const secretInput = await screen.findByLabelText(
      "Notes for API Key: Provide credential",
      undefined,
      deferredWait
    );
    expect(secretInput).toBeTruthy();
    expect((secretInput as HTMLInputElement).type).toBe("password");

    fireEvent.change(secretInput, { target: { value: "sk-test-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    expect(onUserInputSubmit).toHaveBeenCalledWith(request, {
      answers: {
        q_secret: {
          answers: ["sk-test-123"],
        },
      },
    });
  });
});
