/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ApprovalRequest,
  CollaborationModeOption,
  DynamicToolCallRequest,
  DynamicToolCallResponse,
  RequestUserInputRequest,
  WorkspaceInfo,
} from "../../../types";
import type { ResolvedPlanArtifact } from "../../messages/utils/planArtifact";
import { isMobilePlatform } from "../../../utils/platformPaths";
import { Composer } from "./Composer";

vi.mock("../../git/hooks/useGitBranches", () => ({
  useGitBranches: () => ({
    branches: [
      { name: "main", current: true, lastCommit: 1 },
      { name: "feature/free-figma", current: false, lastCommit: 2 },
    ],
  }),
}));

vi.mock("../../../services/dragDrop", () => ({
  subscribeWindowDragDrop: vi.fn(() => () => undefined),
}));

vi.mock("@desktop-host/core", () => ({
  convertFileSrc: (path: string) => `desktop-host://${path}`,
}));

vi.mock("../../../utils/platformPaths", async () => {
  const actual = await vi.importActual<typeof import("../../../utils/platformPaths")>(
    "../../../utils/platformPaths"
  );
  return {
    ...actual,
    isMobilePlatform: vi.fn(() => false),
  };
});

type HarnessProps = {
  onSend: (text: string, images: string[]) => void;
  onQueue?: (text: string, images: string[]) => void;
  onDraftChangeSpy?: (text: string) => void;
  accountOptions?: Array<{ id: string; label: string; status: string }>;
  onSelectAccountIds?: (ids: string[]) => void;
  isProcessing?: boolean;
  steerEnabled?: boolean;
  variant?: "thread" | "home" | "workspace";
  pendingUserInputRequest?: RequestUserInputRequest | null;
  pendingUserInputRequestIndex?: number;
  pendingUserInputRequestCount?: number;
  onPendingUserInputSubmit?: (
    request: RequestUserInputRequest,
    response: { answers: Record<string, { answers: string[] }> }
  ) => void;
  pendingApprovalRequest?: ApprovalRequest | null;
  onPendingApprovalDecision?: (request: ApprovalRequest, decision: "accept" | "decline") => void;
  onPendingApprovalRemember?: (request: ApprovalRequest, command: string[]) => void;
  pendingPlanFollowup?: ResolvedPlanArtifact | null;
  onPendingPlanAccept?: () => void;
  onPendingPlanSubmitChanges?: (changes: string) => void;
  pendingToolCallRequest?: DynamicToolCallRequest | null;
  onPendingToolCallSubmit?: (
    request: DynamicToolCallRequest,
    response: DynamicToolCallResponse
  ) => void;
  initialDraftText?: string;
  collaborationModes?: CollaborationModeOption[];
  selectedCollaborationModeId?: string | null;
  onSelectCollaborationMode?: (id: string | null) => void;
  accessMode?: "read-only" | "on-request" | "full-access";
  onSelectAccessMode?: (mode: "read-only" | "on-request" | "full-access") => void;
  workspaceControls?: {
    mode: "local" | "worktree";
    branchLabel: string | null;
    currentBranch: string | null;
    branchTriggerLabel: string;
    repositoryWorkspace: WorkspaceInfo | null;
    activeWorkspace: WorkspaceInfo | null;
    workspaces: WorkspaceInfo[];
    onSelectGitWorkflowSelection?: (selection: unknown) => void;
  } | null;
};

function ComposerHarness({
  onSend,
  onQueue,
  onDraftChangeSpy,
  accountOptions = [],
  onSelectAccountIds,
  isProcessing = false,
  steerEnabled = false,
  variant = "thread",
  pendingUserInputRequest = null,
  pendingUserInputRequestIndex = 1,
  pendingUserInputRequestCount = 0,
  onPendingUserInputSubmit,
  pendingApprovalRequest = null,
  onPendingApprovalDecision,
  onPendingApprovalRemember,
  pendingPlanFollowup = null,
  onPendingPlanAccept,
  onPendingPlanSubmitChanges,
  pendingToolCallRequest = null,
  onPendingToolCallSubmit,
  initialDraftText = "",
  collaborationModes = [],
  selectedCollaborationModeId = null,
  onSelectCollaborationMode,
  accessMode = "on-request",
  onSelectAccessMode,
  workspaceControls = null,
}: HarnessProps) {
  const [draftText, setDraftText] = useState(initialDraftText);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <Composer
      variant={variant}
      onSend={onSend}
      onQueue={onQueue ?? (() => undefined)}
      onStop={() => undefined}
      canStop={false}
      isProcessing={isProcessing}
      steerEnabled={steerEnabled}
      collaborationModes={collaborationModes}
      selectedCollaborationModeId={selectedCollaborationModeId}
      onSelectCollaborationMode={onSelectCollaborationMode ?? (() => undefined)}
      accountOptions={accountOptions}
      selectedAccountIds={selectedAccountIds}
      onSelectAccountIds={(ids) => {
        setSelectedAccountIds(ids);
        onSelectAccountIds?.(ids);
      }}
      models={[]}
      selectedModelId={null}
      onSelectModel={() => undefined}
      reasoningOptions={[]}
      selectedEffort={null}
      onSelectEffort={() => undefined}
      reasoningSupported={false}
      accessMode={accessMode}
      onSelectAccessMode={onSelectAccessMode ?? (() => undefined)}
      executionOptions={[{ value: "runtime", label: "Runtime" }]}
      selectedExecutionMode="runtime"
      onSelectExecutionMode={() => undefined}
      skills={[]}
      prompts={[]}
      files={[]}
      draftText={draftText}
      onDraftChange={(next) => {
        onDraftChangeSpy?.(next);
        setDraftText(next);
      }}
      textareaRef={textareaRef}
      pendingUserInputRequest={pendingUserInputRequest}
      pendingUserInputRequestIndex={pendingUserInputRequestIndex}
      pendingUserInputRequestCount={pendingUserInputRequestCount}
      onPendingUserInputSubmit={onPendingUserInputSubmit}
      pendingApprovalRequest={pendingApprovalRequest}
      onPendingApprovalDecision={onPendingApprovalDecision}
      onPendingApprovalRemember={onPendingApprovalRemember}
      pendingPlanFollowup={pendingPlanFollowup}
      onPendingPlanAccept={onPendingPlanAccept}
      onPendingPlanSubmitChanges={onPendingPlanSubmitChanges}
      pendingToolCallRequest={pendingToolCallRequest}
      onPendingToolCallSubmit={onPendingToolCallSubmit}
      workspaceControls={workspaceControls}
    />
  );
}

async function flushSuspense() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("Composer send triggers", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.mocked(isMobilePlatform).mockReturnValue(false);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sends once on Enter", () => {
    const onSend = vi.fn();
    render(<ComposerHarness onSend={onSend} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "hello world" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("hello world", []);
  });

  it("sends once on send-button click", () => {
    const onSend = vi.fn();
    render(<ComposerHarness onSend={onSend} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "from button" } });
    fireEvent.click(screen.getByLabelText("Send"));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("from button", []);
  });

  it("prefers the live textarea value when sending after the DOM gets ahead of state", () => {
    const onSend = vi.fn();
    render(<ComposerHarness onSend={onSend} initialDraftText="stale draft" />);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.value = "latest DOM value";
    fireEvent.click(screen.getByLabelText("Send"));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("latest DOM value", []);
  });

  it("blurs the textarea after Enter send on mobile", () => {
    vi.mocked(isMobilePlatform).mockReturnValue(true);
    const onSend = vi.fn();
    const blurSpy = vi.spyOn(HTMLTextAreaElement.prototype, "blur");
    render(<ComposerHarness onSend={onSend} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "dismiss keyboard" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("dismiss keyboard", []);
    expect(blurSpy).toHaveBeenCalledTimes(1);
  });

  it("does not send while IME composition is active", () => {
    const onSend = vi.fn();
    render(<ComposerHarness onSend={onSend} />);

    const textarea = screen.getByRole("textbox", { name: "Composer draft" });
    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: "你好" } });
    fireEvent.keyDown(textarea, { key: "Enter", isComposing: true, keyCode: 229 });

    expect(onSend).not.toHaveBeenCalled();
    expect((textarea as HTMLTextAreaElement).value).toBe("你好");
  });

  it("ignores the trailing Enter immediately after IME composition ends", () => {
    vi.useFakeTimers();
    const onSend = vi.fn();
    render(<ComposerHarness onSend={onSend} />);

    const textarea = screen.getByRole("textbox", { name: "Composer draft" });
    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: "你好" } });
    fireEvent.compositionEnd(textarea);
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).not.toHaveBeenCalled();

    act(() => {
      vi.runAllTimers();
    });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("你好", []);
  });

  it("treats Process key events as IME composition input", () => {
    const onSend = vi.fn();
    render(<ComposerHarness onSend={onSend} />);

    const textarea = screen.getByRole("textbox", { name: "Composer draft" });
    fireEvent.change(textarea, { target: { value: "你好" } });
    fireEvent.keyDown(textarea, { key: "Process" });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not let stale IME draft echoes overwrite the committed Chinese text", () => {
    vi.useFakeTimers();

    function DelayedDraftEchoHarness() {
      const [draftText, setDraftText] = useState("");
      const textareaRef = useRef<HTMLTextAreaElement | null>(null);

      return (
        <Composer
          variant="thread"
          onSend={vi.fn()}
          onQueue={() => undefined}
          onStop={() => undefined}
          canStop={false}
          isProcessing={false}
          steerEnabled={false}
          collaborationModes={[]}
          selectedCollaborationModeId={null}
          onSelectCollaborationMode={() => undefined}
          models={[]}
          selectedModelId={null}
          onSelectModel={() => undefined}
          reasoningOptions={[]}
          selectedEffort={null}
          onSelectEffort={() => undefined}
          reasoningSupported={false}
          accessMode="on-request"
          onSelectAccessMode={() => undefined}
          executionOptions={[{ value: "runtime", label: "Runtime" }]}
          selectedExecutionMode="runtime"
          onSelectExecutionMode={() => undefined}
          skills={[]}
          prompts={[]}
          files={[]}
          draftText={draftText}
          onDraftChange={(next) => {
            setTimeout(() => {
              setDraftText(next);
            }, 250);
          }}
          textareaRef={textareaRef}
        />
      );
    }

    render(<DelayedDraftEchoHarness />);

    const textarea = screen.getByRole("textbox", { name: "Composer draft" });

    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: "升级依赖到zuzui'xi", selectionStart: 12 } });

    act(() => {
      vi.advanceTimersByTime(180);
    });

    fireEvent.change(textarea, { target: { value: "升级依赖到最新", selectionStart: 7 } });
    fireEvent.compositionEnd(textarea);

    expect((textarea as HTMLTextAreaElement).value).toBe("升级依赖到最新");

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(
      (screen.getByRole("textbox", { name: "Composer draft" }) as HTMLTextAreaElement).value
    ).toBe("升级依赖到最新");

    act(() => {
      vi.advanceTimersByTime(180);
      vi.advanceTimersByTime(250);
    });

    expect(
      (screen.getByRole("textbox", { name: "Composer draft" }) as HTMLTextAreaElement).value
    ).toBe("升级依赖到最新");
  });

  it("defers parent draft sync while the user is typing", () => {
    vi.useFakeTimers();
    const onDraftChangeSpy = vi.fn();
    render(<ComposerHarness onSend={vi.fn()} onDraftChangeSpy={onDraftChangeSpy} />);

    const textarea = screen.getByRole("textbox", { name: "Composer draft" });
    fireEvent.change(textarea, { target: { value: "Need audit trail" } });

    expect((textarea as HTMLTextAreaElement).value).toBe("Need audit trail");
    expect(onDraftChangeSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(179);
    });
    expect(onDraftChangeSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDraftChangeSpy).toHaveBeenCalledTimes(1);
    expect(onDraftChangeSpy).toHaveBeenCalledWith("Need audit trail");
  });

  it("flushes the deferred draft when the composer loses focus", () => {
    vi.useFakeTimers();
    const onDraftChangeSpy = vi.fn();
    render(<ComposerHarness onSend={vi.fn()} onDraftChangeSpy={onDraftChangeSpy} />);

    const textarea = screen.getByRole("textbox", { name: "Composer draft" });
    fireEvent.change(textarea, { target: { value: "Persist before thread switch" } });

    expect(onDraftChangeSpy).not.toHaveBeenCalled();
    fireEvent.blur(textarea);

    expect(onDraftChangeSpy).toHaveBeenCalledTimes(1);
    expect(onDraftChangeSpy).toHaveBeenCalledWith("Persist before thread switch");
  });

  it("holds the draft on Enter while processing before stop is available", () => {
    const onSend = vi.fn();
    const onQueue = vi.fn();
    render(
      <ComposerHarness onSend={onSend} onQueue={onQueue} isProcessing={true} steerEnabled={true} />
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "queue me during startup" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).not.toHaveBeenCalled();
    expect(onQueue).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "queue me during startup"
    );
  });

  it("disables the primary action while processing is pending and stop is not ready", () => {
    const onSend = vi.fn();
    render(
      <ComposerHarness
        onSend={onSend}
        isProcessing={true}
        steerEnabled={true}
        initialDraftText="x"
      />
    );

    const button = screen.getByRole("button", { name: "Starting response" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector(".composer-action-stop-square")).toBeTruthy();
    expect(button.querySelector(".composer-action-spinner")).toBeNull();
    fireEvent.click(button);

    expect(onSend).not.toHaveBeenCalled();
  });

  it("renders workspace controls and forwards access mode changes", async () => {
    const onSelectAccessMode = vi.fn();
    const workspace: WorkspaceInfo = {
      id: "ws-1",
      name: "Workspace",
      path: "/tmp/workspace",
      connected: true,
      kind: "main",
      settings: { sidebarCollapsed: false },
    };

    render(
      <ComposerHarness
        onSend={vi.fn()}
        variant="workspace"
        accessMode="full-access"
        onSelectAccessMode={onSelectAccessMode}
        workspaceControls={{
          mode: "local",
          branchLabel: "main",
          currentBranch: "main",
          branchTriggerLabel: "main",
          repositoryWorkspace: workspace,
          activeWorkspace: workspace,
          workspaces: [workspace],
          onSelectGitWorkflowSelection: vi.fn(),
        }}
      />
    );

    const footerBar = document.querySelector('[data-composer-footer-bar="true"]');
    const workspaceFooter = document.querySelector('[data-composer-workspace-footer="true"]');
    expect(workspaceFooter).toBeTruthy();
    expect(footerBar?.contains(workspaceFooter as HTMLElement) ?? false).toBe(false);
    expect(screen.getByRole("button", { name: "Branch & worktree" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agent access" }));
    fireEvent.click(screen.getByRole("option", { name: "Read only" }));

    expect(screen.getAllByText("Local").length).toBeGreaterThan(0);
    expect(screen.queryByText("Base branch")).toBeNull();
    expect(screen.getAllByText("main").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Full access").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("Switch branches or create a new worktree from the current repo.")
    ).toBeNull();
    expect(onSelectAccessMode).toHaveBeenCalledWith("read-only");
  });

  it("shows a branch selector placeholder when no branch is selected", () => {
    const workspace: WorkspaceInfo = {
      id: "ws-1",
      name: "Workspace",
      path: "/tmp/workspace",
      connected: true,
      kind: "main",
      settings: { sidebarCollapsed: false },
    };
    render(
      <ComposerHarness
        onSend={vi.fn()}
        variant="workspace"
        workspaceControls={{
          mode: "local",
          branchLabel: null,
          currentBranch: null,
          branchTriggerLabel: "Select branch",
          repositoryWorkspace: workspace,
          activeWorkspace: workspace,
          workspaces: [workspace],
          onSelectGitWorkflowSelection: vi.fn(),
        }}
      />
    );

    expect(screen.getByText("Local")).toBeTruthy();
    expect(screen.getByText("Select branch")).toBeTruthy();
    expect(screen.queryByText("No base branch selected")).toBeNull();
    expect(screen.queryByText("Select a branch before creating a new worktree.")).toBeNull();
  });

  it("does not render routing accounts in the composer meta area", () => {
    render(
      <ComposerHarness
        variant="workspace"
        onSend={vi.fn()}
        accountOptions={[
          { id: "acc-1", label: "Account 1", status: "enabled" },
          { id: "acc-2", label: "Account 2", status: "enabled" },
        ]}
      />
    );

    expect(screen.queryByRole("button", { name: "Routing accounts" })).toBeNull();
  });

  it("renders access controls in the bottom utility row for non-workspace variants", () => {
    const onSelectAccessMode = vi.fn();

    render(
      <ComposerHarness
        onSend={vi.fn()}
        accessMode="full-access"
        onSelectAccessMode={onSelectAccessMode}
      />
    );

    expect(screen.getByText("Local")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Agent access" })).toBeTruthy();
    expect(screen.getAllByText("Full access").length).toBeGreaterThan(0);
    expect(screen.queryByText("Base branch")).toBeNull();
  });

  it("queues a draft from the explicit queue action while a run is active", () => {
    const onQueue = vi.fn();
    render(
      <ComposerHarness onSend={vi.fn()} onQueue={onQueue} isProcessing={true} steerEnabled={true} />
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "queue this next" } });
    fireEvent.click(screen.getByLabelText("Queue message"));

    expect(onQueue).toHaveBeenCalledTimes(1);
    expect(onQueue).toHaveBeenCalledWith("queue this next", []);
  });

  it("prefers the live textarea value when queueing after the DOM gets ahead of state", () => {
    const onQueue = vi.fn();
    render(
      <ComposerHarness
        onSend={vi.fn()}
        onQueue={onQueue}
        initialDraftText="stale queue draft"
        isProcessing={true}
        steerEnabled={true}
      />
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.value = "latest queued value";
    fireEvent.click(screen.getByLabelText("Queue message"));

    expect(onQueue).toHaveBeenCalledTimes(1);
    expect(onQueue).toHaveBeenCalledWith("latest queued value", []);
  });

  it("submits pending user-input answers from the composer panel", async () => {
    const request: RequestUserInputRequest = {
      workspace_id: "ws-1",
      request_id: 4,
      params: {
        thread_id: "thread-pending-input",
        turn_id: "turn-pending-input",
        item_id: "item-pending-input",
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
          {
            id: "q_notes",
            header: "Notes",
            question: "Anything else to consider?",
          },
        ],
      },
    };
    const onPendingUserInputSubmit = vi.fn();
    render(
      <ComposerHarness
        onSend={vi.fn()}
        pendingUserInputRequest={request}
        pendingUserInputRequestCount={1}
        onPendingUserInputSubmit={onPendingUserInputSubmit}
      />
    );

    await flushSuspense();
    expect(await screen.findByText("How should I proceed?", {}, { timeout: 10_000 })).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /Fast mode/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Composer draft" }), {
      target: { value: "Need audit trail" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Next question" }));
    await flushSuspense();
    expect(
      await screen.findByText("Anything else to consider?", {}, { timeout: 10_000 })
    ).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Composer draft" }), {
      target: { value: "Keep rollback path documented" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Submit answers" }));

    await waitFor(() => {
      expect(onPendingUserInputSubmit).toHaveBeenCalledTimes(1);
      expect(onPendingUserInputSubmit).toHaveBeenCalledWith(request, {
        answers: {
          q_mode: {
            answers: ["Fast mode", "user_note: Need audit trail"],
          },
          q_notes: {
            answers: ["Keep rollback path documented"],
          },
        },
      });
    });
    expect(screen.queryByLabelText("Send")).toBeNull();
  }, 15_000);

  it("restores the normal draft after pending-input mode ends", async () => {
    const request: RequestUserInputRequest = {
      workspace_id: "ws-1",
      request_id: 5,
      params: {
        thread_id: "thread-draft-stable",
        turn_id: "turn-draft-stable",
        item_id: "item-draft-stable",
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
          {
            id: "q_notes",
            header: "Notes",
            question: "Anything else to consider?",
          },
        ],
      },
    };

    function PendingInputDraftHarness() {
      const [pendingRequest, setPendingRequest] = useState<RequestUserInputRequest | null>(request);

      return (
        <>
          <button type="button" onClick={() => setPendingRequest(null)}>
            Clear pending request
          </button>
          <ComposerHarness
            onSend={vi.fn()}
            initialDraftText="keep this queued for later"
            pendingUserInputRequest={pendingRequest}
            pendingUserInputRequestCount={2}
            onPendingUserInputSubmit={vi.fn()}
          />
        </>
      );
    }

    render(<PendingInputDraftHarness />);
    await flushSuspense();
    expect(await screen.findByText("How should I proceed?", {}, { timeout: 10_000 })).toBeTruthy();

    const draftTextbox = screen.getByRole("textbox", { name: "Composer draft" });
    expect((draftTextbox as HTMLTextAreaElement).value).toBe("");

    fireEvent.click(await screen.findByRole("button", { name: /Fast mode/i }));
    fireEvent.change(draftTextbox, { target: { value: "Need audit trail" } });

    expect(screen.getByText("Request 1 of 2")).toBeTruthy();
    expect((draftTextbox as HTMLTextAreaElement).value).toBe("Need audit trail");

    fireEvent.click(await screen.findByRole("button", { name: "Next question" }));
    expect(screen.getByText("2/2")).toBeTruthy();
    expect(
      (screen.getByRole("textbox", { name: "Composer draft" }) as HTMLTextAreaElement).value
    ).toBe("");

    fireEvent.click(await screen.findByRole("button", { name: "Previous" }));
    expect(
      (screen.getByRole("textbox", { name: "Composer draft" }) as HTMLTextAreaElement).value
    ).toBe("Need audit trail");

    fireEvent.click(screen.getByRole("button", { name: "Clear pending request" }));

    await waitFor(() => {
      expect(
        (screen.getByRole("textbox", { name: "Composer draft" }) as HTMLTextAreaElement).value
      ).toBe("keep this queued for later");
    });
  }, 15_000);

  it("uses the main composer field as the pending-input answer editor", () => {
    const request: RequestUserInputRequest = {
      workspace_id: "ws-1",
      request_id: 7,
      params: {
        thread_id: "thread-main-editor-answer",
        turn_id: "turn-main-editor-answer",
        item_id: "item-main-editor-answer",
        questions: [
          {
            id: "q_notes",
            header: "Notes",
            question: "Anything else to consider?",
          },
        ],
      },
    };

    render(
      <ComposerHarness
        onSend={vi.fn()}
        initialDraftText="preserve my normal draft"
        pendingUserInputRequest={request}
        onPendingUserInputSubmit={vi.fn()}
      />
    );

    const draftTextbox = screen.getByRole("textbox", { name: "Composer draft" });
    expect((draftTextbox as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByRole("textbox", { name: /Answer for Notes:/i })).toBeNull();

    fireEvent.change(draftTextbox, { target: { value: "Type in the main composer" } });

    expect(
      (screen.getByRole("textbox", { name: "Composer draft" }) as HTMLTextAreaElement).value
    ).toBe("Type in the main composer");
  });

  it("uses Enter in the main draft as a newline while pending-input mode is active", () => {
    const request: RequestUserInputRequest = {
      workspace_id: "ws-1",
      request_id: 6,
      params: {
        thread_id: "thread-draft-newline",
        turn_id: "turn-draft-newline",
        item_id: "item-draft-newline",
        questions: [
          {
            id: "q_notes",
            header: "Notes",
            question: "Anything else to consider?",
          },
        ],
      },
    };
    const onSend = vi.fn();

    render(
      <ComposerHarness
        onSend={onSend}
        pendingUserInputRequest={request}
        onPendingUserInputSubmit={vi.fn()}
      />
    );

    const draftTextbox = screen.getByRole("textbox", { name: "Composer draft" });
    fireEvent.change(draftTextbox, { target: { value: "line one" } });
    fireEvent.keyDown(draftTextbox, { key: "Enter" });

    expect(onSend).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("textbox", { name: "Composer draft" }) as HTMLTextAreaElement).value
    ).toBe("line one\n");
  });

  it("auto-advances pending input after selecting an option when no note is typed", () => {
    vi.useFakeTimers();
    const request: RequestUserInputRequest = {
      workspace_id: "ws-1",
      request_id: 11,
      params: {
        thread_id: "thread-auto-advance",
        turn_id: "turn-auto-advance",
        item_id: "item-auto-advance",
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
          {
            id: "q_notes",
            header: "Notes",
            question: "Anything else to consider?",
          },
        ],
      },
    };

    render(
      <ComposerHarness
        onSend={vi.fn()}
        pendingUserInputRequest={request}
        onPendingUserInputSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Safe mode/i }));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText("Anything else to consider?")).toBeTruthy();
  });

  it("submits plan follow-up changes from the composer panel", async () => {
    const onPendingPlanSubmitChanges = vi.fn();
    render(
      <ComposerHarness
        onSend={vi.fn()}
        collaborationModes={[
          {
            id: "default",
            label: "Default",
            mode: "default",
            model: "",
            reasoningEffort: null,
            developerInstructions: null,
            value: {},
          },
          {
            id: "plan",
            label: "Plan",
            mode: "plan",
            model: "",
            reasoningEffort: null,
            developerInstructions: null,
            value: {},
          },
        ]}
        selectedCollaborationModeId="plan"
        pendingPlanFollowup={{
          planItemId: "plan-1",
          threadId: "thread-plan-1",
          title: "Stabilize runtime startup",
          preview: "1. Verify launch path\n2. Add boot diagnostics",
          body: "## Stabilize runtime startup\n1. Verify launch path\n2. Add boot diagnostics",
          awaitingFollowup: true,
        }}
        onPendingPlanAccept={vi.fn()}
        onPendingPlanSubmitChanges={onPendingPlanSubmitChanges}
      />
    );

    expect(await screen.findByText("Stabilize runtime startup")).toBeTruthy();
    const previewLines = screen.getAllByTestId("plan-preview-line");
    expect(previewLines.map((line) => line.textContent)).toEqual([
      "1. Verify launch path",
      "2. Add boot diagnostics",
    ]);
    expect(await screen.findByRole("button", { name: "Implement plan" })).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Plan change request" }), {
      target: { value: "Add rollback checkpoints" },
    });

    const refinePlanButton = await screen.findByRole("button", { name: "Refine plan" });
    fireEvent.click(refinePlanButton);

    await waitFor(() => {
      expect(onPendingPlanSubmitChanges).toHaveBeenCalledWith("Add rollback checkpoints");
    });
  });

  it("accepts a plan follow-up from the composer panel", async () => {
    const onPendingPlanAccept = vi.fn();
    render(
      <ComposerHarness
        onSend={vi.fn()}
        collaborationModes={[
          {
            id: "default",
            label: "Default",
            mode: "default",
            model: "",
            reasoningEffort: null,
            developerInstructions: null,
            value: {},
          },
          {
            id: "plan",
            label: "Plan",
            mode: "plan",
            model: "",
            reasoningEffort: null,
            developerInstructions: null,
            value: {},
          },
        ]}
        selectedCollaborationModeId="plan"
        pendingPlanFollowup={{
          planItemId: "plan-2",
          threadId: "thread-plan-2",
          title: "Ship the settings polish",
          preview: "1. Tighten spacing\n2. Verify keyboard flow",
          body: "## Ship the settings polish\n1. Tighten spacing\n2. Verify keyboard flow",
          awaitingFollowup: true,
        }}
        onPendingPlanSubmitChanges={vi.fn()}
        onPendingPlanAccept={onPendingPlanAccept}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "Implement plan" }));

    await waitFor(() => {
      expect(onPendingPlanAccept).toHaveBeenCalledTimes(1);
    });
  });

  it("restores the normal send path when a plan follow-up exists but chat mode is selected", () => {
    const onSend = vi.fn();
    render(
      <ComposerHarness
        onSend={onSend}
        collaborationModes={[
          {
            id: "default",
            label: "Default",
            mode: "default",
            model: "",
            reasoningEffort: null,
            developerInstructions: null,
            value: {},
          },
          {
            id: "plan",
            label: "Plan",
            mode: "plan",
            model: "",
            reasoningEffort: null,
            developerInstructions: null,
            value: {},
          },
        ]}
        selectedCollaborationModeId="default"
        pendingPlanFollowup={{
          planItemId: "plan-chat-mode",
          threadId: "thread-plan-chat",
          title: "Refine runtime audit",
          preview: "1. Inspect logs\n2. Compare planner states",
          body: "## Refine runtime audit\n1. Inspect logs\n2. Compare planner states",
          awaitingFollowup: true,
        }}
        onPendingPlanSubmitChanges={vi.fn()}
        onPendingPlanAccept={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "continue in chat" } });
    fireEvent.click(screen.getByLabelText("Send"));

    expect(onSend).toHaveBeenCalledWith("continue in chat", []);
    expect(screen.queryByRole("button", { name: "Implement plan" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit changes" })).toBeNull();
  });

  it("resolves approvals from the composer panel", () => {
    const request = {
      workspace_id: "ws-1",
      request_id: "approval-1",
      method: "runtime/requestApproval/shell",
      params: {
        threadId: "thread-approval",
        command: "pnpm validate:fast",
      },
    } as const;
    const onPendingApprovalDecision = vi.fn();
    const onPendingApprovalRemember = vi.fn();

    render(
      <ComposerHarness
        onSend={vi.fn()}
        pendingApprovalRequest={request}
        onPendingApprovalDecision={onPendingApprovalDecision}
        onPendingApprovalRemember={onPendingApprovalRemember}
      />
    );

    expect(screen.getAllByText("Approval required").length).toBeGreaterThan(0);
    expect(screen.getByText("Agent wants to run: pnpm validate:fast")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Always allow" }));
    expect(onPendingApprovalRemember).toHaveBeenCalledWith(request, ["pnpm", "validate:fast"]);

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(onPendingApprovalDecision).toHaveBeenCalledWith(request, "decline");

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onPendingApprovalDecision).toHaveBeenCalledWith(request, "accept");
  });

  it("submits a tool-call response from the composer panel", () => {
    const request = {
      workspace_id: "ws-1",
      request_id: "tool-call-request-1",
      params: {
        thread_id: "thread-tool-call",
        turn_id: "turn-tool-call",
        call_id: "call-xyz",
        tool: "collect_system_info",
        arguments: { includeEnv: true },
      },
    } as const;
    const onPendingToolCallSubmit = vi.fn();

    render(
      <ComposerHarness
        onSend={vi.fn()}
        pendingToolCallRequest={request}
        onPendingToolCallSubmit={onPendingToolCallSubmit}
      />
    );

    expect(screen.getByText("Tool call requested")).toBeTruthy();
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

    expect(onPendingToolCallSubmit).toHaveBeenCalledWith(request, {
      contentItems: [{ type: "inputText", text: "output payload" }],
      success: false,
    });
  });
});
