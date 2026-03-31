import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ApprovalRequest,
  CollaborationModeOption,
  DynamicToolCallRequest,
  DynamicToolCallResponse,
  RequestUserInputRequest,
  SkillOption,
  ThreadTokenUsage,
  WorkspaceInfo,
} from "../../../types";
import {
  flushBrowserMicrotasks,
  flushLazyBoundary,
  waitForAppTimer,
} from "../../../test/asyncTestUtils";
import type { ResolvedPlanArtifact } from "../../messages/utils/planArtifact";
import type { ReviewPromptState, ReviewPromptStep } from "../../threads/hooks/useReviewPrompt";
import { PENDING_INPUT_AUTO_ADVANCE_MS } from "../utils/composerEditorConfig";
import { isMobilePlatform } from "../../../utils/platformPaths";
import { Composer } from "./Composer";

vi.mock("../../../services/dragDrop", () => ({
  subscribeWindowDragDrop: vi.fn(() => () => undefined),
}));

vi.mock("@desktop-host/core", () => ({
  invoke: vi.fn(),
  isDesktopHostRuntime: vi.fn(() => false),
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
  onSend: (text: string, images: string[]) => void | false | Promise<void | false>;
  onQueue?: (text: string, images: string[]) => void | false | Promise<void | false>;
  isProcessing?: boolean;
  steerEnabled?: boolean;
  initialDraftText?: string;
  pendingUserInputRequest?: RequestUserInputRequest | null;
  onPendingUserInputSubmit?: (
    request: RequestUserInputRequest,
    response: { answers: Record<string, { answers: string[] }> }
  ) => void;
  pendingApprovalRequest?: ApprovalRequest | null;
  onPendingApprovalDecision?: (request: ApprovalRequest, decision: "accept" | "decline") => void;
  onPendingApprovalRemember?: (request: ApprovalRequest, command: string[]) => void;
  collaborationModes?: CollaborationModeOption[];
  selectedCollaborationModeId?: string | null;
  pendingPlanFollowup?: ResolvedPlanArtifact | null;
  onPendingPlanAccept?: () => void;
  onPendingPlanSubmitChanges?: (changes: string) => void;
  pendingToolCallRequest?: DynamicToolCallRequest | null;
  onPendingToolCallSubmit?: (
    request: DynamicToolCallRequest,
    response: DynamicToolCallResponse
  ) => void;
  variant?: "thread" | "home" | "workspace";
  contextUsage?: ThreadTokenUsage | null;
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
  skills?: SkillOption[];
};

function ComposerHarness({
  onSend,
  onQueue,
  isProcessing = false,
  steerEnabled = false,
  initialDraftText = "",
  pendingUserInputRequest = null,
  onPendingUserInputSubmit,
  pendingApprovalRequest = null,
  onPendingApprovalDecision,
  onPendingApprovalRemember,
  collaborationModes = [],
  selectedCollaborationModeId = null,
  pendingPlanFollowup = null,
  onPendingPlanAccept,
  onPendingPlanSubmitChanges,
  pendingToolCallRequest = null,
  onPendingToolCallSubmit,
  variant = "thread",
  contextUsage = null,
  workspaceControls = null,
  skills = [],
}: HarnessProps) {
  const [draftText, setDraftText] = useState(initialDraftText);
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
      skills={skills}
      prompts={[]}
      files={[]}
      draftText={draftText}
      onDraftChange={setDraftText}
      textareaRef={textareaRef}
      pendingUserInputRequest={pendingUserInputRequest}
      onPendingUserInputSubmit={onPendingUserInputSubmit}
      pendingApprovalRequest={pendingApprovalRequest}
      onPendingApprovalDecision={onPendingApprovalDecision}
      onPendingApprovalRemember={onPendingApprovalRemember}
      pendingPlanFollowup={pendingPlanFollowup}
      onPendingPlanAccept={onPendingPlanAccept}
      onPendingPlanSubmitChanges={onPendingPlanSubmitChanges}
      pendingToolCallRequest={pendingToolCallRequest}
      onPendingToolCallSubmit={onPendingToolCallSubmit}
      contextUsage={contextUsage}
      workspaceControls={workspaceControls}
    />
  );
}

function getComposerControls() {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="Composer draft"]'
  );
  if (!textarea) {
    throw new Error("Expected composer textarea");
  }
  return { textarea };
}

function getSendButton() {
  const sendButton = document.querySelector<HTMLButtonElement>('button[aria-label="Send"]');
  if (!sendButton) {
    throw new Error("Expected send button");
  }
  return sendButton;
}

function getQueueButton() {
  const queueButton = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Queue message"]'
  );
  if (!queueButton) {
    throw new Error("Expected queue button");
  }
  return queueButton;
}

function getButtonByText(label: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent?.replace(/\s+/g, " ").trim().includes(label)
  );
  if (!button) {
    throw new Error(`Expected button with text: ${label}`);
  }
  return button;
}

const PRESET_REVIEW_OPTIONS = ["baseBranch", "uncommitted", "commit", "custom"] as const;
const PLAN_COLLABORATION_MODES: CollaborationModeOption[] = [
  {
    id: "default",
    label: "Default",
    mode: "default",
    model: "gpt-5",
    reasoningEffort: null,
    developerInstructions: null,
    value: {},
  },
  {
    id: "plan",
    label: "Plan",
    mode: "plan",
    model: "gpt-5",
    reasoningEffort: null,
    developerInstructions: null,
    value: {},
  },
];

function createReviewPromptState(
  step: ReviewPromptStep = "preset"
): NonNullable<ReviewPromptState> {
  const workspace: WorkspaceInfo = {
    id: "ws-review",
    name: "Review Workspace",
    path: "/tmp/review-workspace",
    connected: true,
    settings: { sidebarCollapsed: false },
  };

  return {
    workspace,
    threadIdSnapshot: "thread-review",
    step,
    branches: [
      {
        name: "main",
        lastCommit: 1,
        current: false,
        isDefault: true,
        isRemote: false,
        remoteName: null,
        worktreePath: null,
      },
    ],
    commits: [
      {
        sha: "abc1234",
        summary: "Fix review prompt focus",
        author: "HugeCode",
        timestamp: 1,
      },
    ],
    isLoadingBranches: false,
    isLoadingCommits: false,
    selectedBranch: "main",
    selectedCommitSha: "abc1234",
    selectedCommitTitle: "Fix review prompt focus",
    customInstructions: "",
    error: null,
    isSubmitting: false,
  };
}

function ReviewPromptBrowserHarness() {
  const [draftText, setDraftText] = useState("");
  const [reviewPrompt, setReviewPrompt] = useState<ReviewPromptState>(null);
  const [highlightedPresetIndex, setHighlightedPresetIndex] = useState(0);
  const [highlightedBranchIndex, setHighlightedBranchIndex] = useState(0);
  const [highlightedCommitIndex, setHighlightedCommitIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const closePrompt = () => {
    setReviewPrompt(null);
  };

  const showPresetStep = () => {
    setHighlightedPresetIndex(0);
    setReviewPrompt((current) =>
      current
        ? {
            ...current,
            step: "preset",
          }
        : current
    );
  };

  const choosePreset = (preset: Exclude<ReviewPromptStep, "preset"> | "uncommitted") => {
    if (preset === "uncommitted") {
      setReviewPrompt(null);
      return;
    }
    setReviewPrompt((current) =>
      current
        ? {
            ...current,
            step: preset,
          }
        : current
    );
  };

  const handleReviewPromptKeyDown = (event: {
    key: string;
    shiftKey?: boolean;
    preventDefault: () => void;
  }) => {
    if (!reviewPrompt) {
      return false;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (reviewPrompt.step === "preset") {
        closePrompt();
      } else {
        showPresetStep();
      }
      return true;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (reviewPrompt.step === "preset") {
        setHighlightedPresetIndex((current) => {
          const next =
            (current + direction + PRESET_REVIEW_OPTIONS.length) % PRESET_REVIEW_OPTIONS.length;
          return next;
        });
      }
      return true;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (reviewPrompt.step === "preset") {
        choosePreset(PRESET_REVIEW_OPTIONS[highlightedPresetIndex] ?? "baseBranch");
      } else {
        closePrompt();
      }
      return true;
    }
    return false;
  };

  return (
    <Composer
      onSend={(text) => {
        if (text === "/review") {
          setHighlightedPresetIndex(0);
          setReviewPrompt(createReviewPromptState());
        }
      }}
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
      onDraftChange={setDraftText}
      textareaRef={textareaRef}
      reviewPrompt={reviewPrompt}
      onReviewPromptClose={closePrompt}
      onReviewPromptShowPreset={showPresetStep}
      onReviewPromptChoosePreset={choosePreset}
      highlightedPresetIndex={highlightedPresetIndex}
      onReviewPromptHighlightPreset={setHighlightedPresetIndex}
      highlightedBranchIndex={highlightedBranchIndex}
      onReviewPromptHighlightBranch={setHighlightedBranchIndex}
      highlightedCommitIndex={highlightedCommitIndex}
      onReviewPromptHighlightCommit={setHighlightedCommitIndex}
      onReviewPromptSelectBranch={(value) => {
        setReviewPrompt((current) => (current ? { ...current, selectedBranch: value } : current));
      }}
      onReviewPromptSelectBranchAtIndex={(index) => {
        setHighlightedBranchIndex(index);
      }}
      onReviewPromptConfirmBranch={async () => {
        closePrompt();
      }}
      onReviewPromptSelectCommit={(sha, title) => {
        setReviewPrompt((current) =>
          current
            ? {
                ...current,
                selectedCommitSha: sha,
                selectedCommitTitle: title,
              }
            : current
        );
      }}
      onReviewPromptSelectCommitAtIndex={(index) => {
        setHighlightedCommitIndex(index);
      }}
      onReviewPromptConfirmCommit={async () => {
        closePrompt();
      }}
      onReviewPromptUpdateCustomInstructions={(value) => {
        setReviewPrompt((current) =>
          current ? { ...current, customInstructions: value } : current
        );
      }}
      onReviewPromptConfirmCustom={async () => {
        closePrompt();
      }}
      onReviewPromptKeyDown={handleReviewPromptKeyDown}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.mocked(isMobilePlatform).mockReturnValue(false);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function createPendingUserInputRequest(): RequestUserInputRequest {
  return {
    workspace_id: "ws-1",
    request_id: "pending-input-1",
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
}

function createSingleQuestionPendingUserInputRequest(): RequestUserInputRequest {
  return {
    workspace_id: "ws-1",
    request_id: "pending-input-single",
    params: {
      thread_id: "thread-pending-input-single",
      turn_id: "turn-pending-input-single",
      item_id: "item-pending-input-single",
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
  };
}

function createApprovalRequest(): ApprovalRequest {
  return {
    workspace_id: "ws-1",
    request_id: "approval-1",
    method: "runtime/requestApproval/shell",
    params: {
      threadId: "thread-approval",
      command: "pnpm validate:fast",
    },
  } as const;
}

function createToolCallRequest(
  overrides?: Partial<DynamicToolCallRequest["params"]> & {
    requestId?: DynamicToolCallRequest["request_id"];
  }
): DynamicToolCallRequest {
  return {
    workspace_id: "ws-1",
    request_id: overrides?.requestId ?? "tool-call-request-1",
    params: {
      thread_id: overrides?.thread_id ?? "thread-tool-call",
      turn_id: overrides?.turn_id ?? "turn-tool-call",
      call_id: overrides?.call_id ?? "call-xyz",
      tool: overrides?.tool ?? "collect_system_info",
      arguments: overrides?.arguments ?? { includeEnv: true },
    },
  };
}

function createCollaborationModes(): CollaborationModeOption[] {
  return [
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
  ];
}

function createPlanFollowup(overrides?: Partial<NonNullable<HarnessProps["pendingPlanFollowup"]>>) {
  return {
    planItemId: overrides?.planItemId ?? "plan-1",
    threadId: overrides?.threadId ?? "thread-plan-1",
    title: overrides?.title ?? "Stabilize runtime startup",
    preview: overrides?.preview ?? "1. Verify launch path\n2. Add boot diagnostics",
    body:
      overrides?.body ??
      "## Stabilize runtime startup\n1. Verify launch path\n2. Add boot diagnostics",
    awaitingFollowup: overrides?.awaitingFollowup ?? true,
  };
}

describe("Composer browser interactions", () => {
  describe("base composer send semantics", () => {
    it("sends exactly once on Enter in a real browser", async () => {
      const onSend = vi.fn();

      render(<ComposerHarness onSend={onSend} />);

      const { textarea } = getComposerControls();

      fireEvent.change(textarea, { target: { value: "hello world" } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledTimes(1);
        expect(onSend).toHaveBeenCalledWith("hello world", []);
      });
    });

    it("sends exactly once from the send button in a real browser", async () => {
      const onSend = vi.fn();

      render(<ComposerHarness onSend={onSend} />);

      const { textarea } = getComposerControls();
      const sendButton = getSendButton();

      fireEvent.change(textarea, { target: { value: "from button" } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledTimes(1);
        expect(onSend).toHaveBeenCalledWith("from button", []);
      });
    });

    it("preserves the draft when send is rejected asynchronously in a real browser", async () => {
      const onSend = vi.fn().mockResolvedValue(false);

      render(<ComposerHarness onSend={onSend} />);

      const { textarea } = getComposerControls();
      const sendButton = getSendButton();

      fireEvent.change(textarea, { target: { value: "/review" } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith("/review", []);
      });
      expect(getComposerControls().textarea.value).toBe("/review");
    });

    it("renders selected skills as styled chips and normalizes markdown skill links", async () => {
      render(
        <ComposerHarness
          onSend={vi.fn()}
          skills={[
            {
              name: "frontend-design",
              path: "C:\\Users\\Administrator\\.codex\\skills\\frontend-design\\SKILL.md",
              description: "Create polished frontend interfaces.",
              scope: "global",
              sourceFamily: "codex",
            },
          ]}
          initialDraftText="[$frontend-design](C:\\Users\\Administrator\\.codex\\skills\\frontend-design\\SKILL.md) "
        />
      );

      await waitFor(() => {
        expect(getComposerControls().textarea.value).toBe("$frontend-design ");
      });
      expect(document.querySelectorAll(".composer-inline-skill-chip")).toHaveLength(1);
      expect(document.querySelector(".composer-inline-skill-chip")?.textContent).toContain(
        "Frontend Design"
      );
      expect(document.querySelector(".composer-inline-skill-chip")?.getAttribute("title")).toBe(
        "Create polished frontend interfaces."
      );
      expect(window.getComputedStyle(getComposerControls().textarea).color).not.toBe("transparent");
    });

    it("supports inserting a second skill after a normalized markdown skill link without extra spaces", async () => {
      render(
        <ComposerHarness
          onSend={vi.fn()}
          skills={[
            {
              name: "design-taste-frontend",
              path: "C:\\Users\\Administrator\\.codex\\skills\\taste-skill\\SKILL.md",
              description: "Architect digital interfaces with balanced design engineering.",
            },
            {
              name: "frontend-design",
              path: "C:\\Users\\Administrator\\.codex\\skills\\frontend-design\\SKILL.md",
              description: "Create polished frontend interfaces.",
            },
          ]}
          initialDraftText="[$design-taste-frontend](C:\\Users\\Administrator\\.codex\\skills\\taste-skill\\SKILL.md) "
        />
      );

      await waitFor(() => {
        expect(getComposerControls().textarea.value).toBe("$design-taste-frontend ");
      });

      fireEvent.change(getComposerControls().textarea, {
        target: {
          value: "$design-taste-frontend $fr",
          selectionStart: "$design-taste-frontend $fr".length,
        },
      });

      await waitFor(() => {
        expect(getComposerControls().textarea.value).toBe("$design-taste-frontend $fr");
      });
      fireEvent.keyDown(getComposerControls().textarea, { key: "Enter" });

      await waitFor(() => {
        expect(getComposerControls().textarea.value).toBe(
          "$design-taste-frontend $frontend-design "
        );
      });
      expect(document.querySelectorAll(".composer-inline-skill-chip")).toHaveLength(2);
    });

    it("keeps the skill sigil when applying composer skill autocomplete", async () => {
      render(
        <ComposerHarness
          onSend={vi.fn()}
          skills={[
            {
              name: "review",
              path: "C:\\Users\\Administrator\\.codex\\skills\\review\\SKILL.md",
              description: "Review the current patch.",
            },
          ]}
        />
      );

      const { textarea } = getComposerControls();
      fireEvent.change(textarea, { target: { value: "$re", selectionStart: 3 } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      await waitFor(() => {
        expect(getComposerControls().textarea.value).toBe("$review ");
      });
      expect(document.querySelectorAll(".composer-inline-skill-chip")).toHaveLength(1);
      expect(document.querySelector(".composer-inline-skill-chip")?.textContent).toContain(
        "Review"
      );
    });

    it("allows continuing to type after inserting a skill chip", async () => {
      render(
        <ComposerHarness
          onSend={vi.fn()}
          skills={[
            {
              name: "frontend-design",
              path: "C:\\Users\\Administrator\\.codex\\skills\\frontend-design\\SKILL.md",
              description: "Create polished frontend interfaces.",
            },
          ]}
        />
      );

      const { textarea } = getComposerControls();
      fireEvent.change(textarea, { target: { value: "$fr", selectionStart: 3 } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      await waitFor(() => {
        expect(getComposerControls().textarea.value).toBe("$frontend-design ");
      });

      const chip = document.querySelector<HTMLElement>(".composer-inline-skill-chip");
      if (!chip) {
        throw new Error("Expected inline skill chip");
      }

      fireEvent.mouseDown(chip);
      fireEvent.click(chip);
      expect(document.activeElement).toBe(getComposerControls().textarea);
      expect(getComposerControls().textarea.selectionStart).toBe("$frontend-design ".length);

      fireEvent.change(getComposerControls().textarea, {
        target: {
          value: "$frontend-design continue typing",
          selectionStart: "$frontend-design continue typing".length,
        },
      });

      await waitFor(() => {
        expect(getComposerControls().textarea.value).toBe("$frontend-design continue typing");
      });
      expect(document.querySelectorAll(".composer-inline-skill-chip")).toHaveLength(1);
      expect(document.querySelector(".composer-inline-skill-chip")?.getAttribute("title")).toBe(
        "Create polished frontend interfaces."
      );
      expect(window.getComputedStyle(getComposerControls().textarea).color).not.toBe("transparent");
    });

    it("supports inserting a second skill after an existing inline skill", async () => {
      render(
        <ComposerHarness
          onSend={vi.fn()}
          skills={[
            {
              name: "frontend-design",
              path: "C:\\Users\\Administrator\\.codex\\skills\\frontend-design\\SKILL.md",
              description: "Create polished frontend interfaces.",
            },
            {
              name: "review",
              path: "C:\\Users\\Administrator\\.codex\\skills\\review\\SKILL.md",
              description: "Review the current patch.",
            },
          ]}
        />
      );

      const { textarea } = getComposerControls();
      fireEvent.change(textarea, { target: { value: "$fr", selectionStart: 3 } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      await waitFor(() => {
        expect(getComposerControls().textarea.value).toBe("$frontend-design ");
      });

      const chip = document.querySelector<HTMLElement>(".composer-inline-skill-chip");
      if (!chip) {
        throw new Error("Expected inline skill chip");
      }

      fireEvent.mouseDown(chip);
      fireEvent.click(chip);
      expect(getComposerControls().textarea.selectionStart).toBe("$frontend-design ".length);

      fireEvent.change(getComposerControls().textarea, {
        target: {
          value: "$frontend-design $re",
          selectionStart: "$frontend-design $re".length,
        },
      });

      await waitFor(() => {
        expect(getComposerControls().textarea.value).toBe("$frontend-design $re");
      });
      fireEvent.keyDown(getComposerControls().textarea, { key: "Enter" });

      await waitFor(() => {
        expect(getComposerControls().textarea.value).toBe("$frontend-design $review ");
      });
      expect(document.querySelectorAll(".composer-inline-skill-chip")).toHaveLength(2);
    });

    it("deletes a whole skill token when backspacing at the end of the chip", async () => {
      render(
        <ComposerHarness
          onSend={vi.fn()}
          skills={[
            {
              name: "frontend-design",
              path: "C:\\Users\\Administrator\\.codex\\skills\\frontend-design\\SKILL.md",
              description: "Create polished frontend interfaces.",
            },
          ]}
          initialDraftText="$frontend-design fdadf"
        />
      );

      const { textarea } = getComposerControls();
      fireEvent.select(textarea, {
        target: {
          selectionStart: "$frontend-design ".length,
          selectionEnd: "$frontend-design ".length,
        },
      });
      fireEvent.keyDown(textarea, { key: "Backspace" });

      await waitFor(() => {
        expect(getComposerControls().textarea.value).toBe("fdadf");
      });
      expect(document.querySelectorAll(".composer-inline-skill-chip")).toHaveLength(0);
    });

    it("deletes an entire selected skill token instead of leaving partial raw text", async () => {
      render(
        <ComposerHarness
          onSend={vi.fn()}
          skills={[
            {
              name: "frontend-design",
              path: "C:\\Users\\Administrator\\.codex\\skills\\frontend-design\\SKILL.md",
              description: "Create polished frontend interfaces.",
            },
          ]}
          initialDraftText="$frontend-design tail"
        />
      );

      const { textarea } = getComposerControls();
      fireEvent.select(textarea, {
        target: {
          selectionStart: 2,
          selectionEnd: 6,
        },
      });
      fireEvent.keyDown(textarea, { key: "Backspace" });

      await waitFor(() => {
        expect(getComposerControls().textarea.value).toBe(" tail");
      });
      expect(document.querySelectorAll(".composer-inline-skill-chip")).toHaveLength(0);
    });

    it("caps overly long skill labels instead of letting the chip width run away", async () => {
      render(
        <ComposerHarness
          onSend={vi.fn()}
          skills={[
            {
              name: "frontend-design-system-foundations-and-motion-language",
              path: "C:\\Users\\Administrator\\.codex\\skills\\frontend-design-system-foundations-and-motion-language\\SKILL.md",
              description: "Long skill description.",
            },
          ]}
          initialDraftText="$frontend-design-system-foundations-and-motion-language "
        />
      );

      await waitFor(() => {
        expect(document.querySelectorAll(".composer-inline-skill-chip")).toHaveLength(1);
      });
      expect(document.querySelector(".composer-inline-skill-chip")?.textContent).toContain("…");
    });

    it("does not send when IME composition confirms with Enter in a real browser", async () => {
      const onSend = vi.fn();

      render(<ComposerHarness onSend={onSend} />);

      const { textarea } = getComposerControls();

      fireEvent.compositionStart(textarea);
      fireEvent.change(textarea, { target: { value: "你好" } });
      fireEvent.keyDown(textarea, { key: "Enter", isComposing: true, keyCode: 229 });
      fireEvent.compositionEnd(textarea);
      fireEvent.keyDown(textarea, { key: "Enter" });

      expect(onSend).not.toHaveBeenCalled();

      await flushBrowserMicrotasks();
      fireEvent.keyDown(textarea, { key: "Enter" });

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledTimes(1);
        expect(onSend).toHaveBeenCalledWith("你好", []);
      });
    });

    it("keeps the disabled send button visually distinct from generic disabled actions", () => {
      render(<ComposerHarness onSend={vi.fn()} />);

      const sendButton = getSendButton();
      const attachButton = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Open composer menu"]'
      );
      if (!attachButton) {
        throw new Error("Expected composer menu button");
      }

      const sendStyles = window.getComputedStyle(sendButton);
      const attachStyles = window.getComputedStyle(attachButton);

      expect(sendButton.disabled).toBe(true);
      expect(attachButton.disabled).toBe(true);
      expect(sendStyles.boxShadow).toBe("none");
      expect(sendStyles.opacity).toBe("1");
      expect(attachStyles.opacity).not.toBe("1");
    });

    it("holds the draft on Enter while processing before stop is available in a real browser", () => {
      const onSend = vi.fn();
      const onQueue = vi.fn();

      render(
        <ComposerHarness
          onSend={onSend}
          onQueue={onQueue}
          isProcessing={true}
          steerEnabled={true}
        />
      );

      const { textarea } = getComposerControls();

      fireEvent.change(textarea, { target: { value: "queue me during startup" } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      expect(onSend).not.toHaveBeenCalled();
      expect(onQueue).not.toHaveBeenCalled();
      expect(textarea.value).toBe("queue me during startup");
    });

    it("shows the stop glyph while processing before stop is ready in a real browser", () => {
      render(<ComposerHarness onSend={vi.fn()} isProcessing={true} steerEnabled={true} />);

      const button = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Starting response"]'
      );
      if (!button) {
        throw new Error("Expected processing button");
      }

      const stopSquare = button.querySelector<HTMLElement>(".composer-action-stop-square");
      if (!stopSquare) {
        throw new Error("Expected stop square");
      }

      const buttonStyles = window.getComputedStyle(button);
      const stopSquareStyles = window.getComputedStyle(stopSquare);

      expect(buttonStyles.width).toBe("36px");
      expect(buttonStyles.height).toBe("36px");
      expect(buttonStyles.opacity).toBe("1");
      expect(buttonStyles.color).not.toBe("rgb(255, 255, 255)");
      expect(stopSquareStyles.width).toBe("10px");
      expect(stopSquareStyles.height).toBe("10px");
      expect(button.querySelector(".composer-action-spinner")).toBeNull();
    });

    it("queues from the explicit queue action while a run is active in a real browser", async () => {
      const onQueue = vi.fn();

      render(
        <ComposerHarness
          onSend={vi.fn()}
          onQueue={onQueue}
          isProcessing={true}
          steerEnabled={true}
        />
      );

      const { textarea } = getComposerControls();
      const queueButton = getQueueButton();

      fireEvent.change(textarea, { target: { value: "queue this next" } });
      fireEvent.click(queueButton);

      await waitFor(() => {
        expect(onQueue).toHaveBeenCalledTimes(1);
        expect(onQueue).toHaveBeenCalledWith("queue this next", []);
      });
    });

    it("queues from Tab while a run is active in a real browser", async () => {
      const onSend = vi.fn();
      const onQueue = vi.fn();

      render(
        <ComposerHarness
          onSend={onSend}
          onQueue={onQueue}
          isProcessing={true}
          steerEnabled={true}
        />
      );

      const { textarea } = getComposerControls();

      fireEvent.change(textarea, { target: { value: "queue via tab" } });
      fireEvent.keyDown(textarea, { key: "Tab" });

      await waitFor(() => {
        expect(onQueue).toHaveBeenCalledTimes(1);
        expect(onQueue).toHaveBeenCalledWith("queue via tab", []);
      });
      expect(onSend).not.toHaveBeenCalled();
    });

    it("keeps the workspace rail independent and interactive in a real browser", async () => {
      const workspace: WorkspaceInfo = {
        id: "workspace-1",
        name: "Workspace 1",
        path: "/tmp/workspace-1",
        connected: true,
        kind: "main",
        settings: { sidebarCollapsed: false },
      };

      render(
        <ComposerHarness
          onSend={vi.fn()}
          variant="workspace"
          contextUsage={{
            modelContextWindow: 32_000,
            last: {
              totalTokens: 24_000,
              inputTokens: 18_000,
              cachedInputTokens: 0,
              outputTokens: 6_000,
              reasoningOutputTokens: 0,
            },
            total: {
              totalTokens: 24_000,
              inputTokens: 18_000,
              cachedInputTokens: 0,
              outputTokens: 6_000,
              reasoningOutputTokens: 0,
            },
          }}
          workspaceControls={{
            mode: "worktree",
            branchLabel: "feature/free-figma",
            currentBranch: "feature/free-figma",
            branchTriggerLabel: "feature/free-figma",
            repositoryWorkspace: workspace,
            activeWorkspace: workspace,
            workspaces: [workspace],
            onSelectGitWorkflowSelection: vi.fn(),
          }}
        />
      );

      const composerFrame = document.querySelector('[data-composer-frame="true"]');
      const footerBar = document.querySelector('[data-composer-footer-bar="true"]');
      const workspaceFooter = document.querySelector('[data-composer-workspace-footer="true"]');
      expect(composerFrame?.getAttribute("data-composer-variant")).toBe("workspace");
      expect(workspaceFooter).toBeTruthy();
      expect(footerBar?.contains(workspaceFooter as HTMLElement) ?? false).toBe(false);

      const accessButton = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Agent access"]'
      );
      if (!accessButton) {
        throw new Error("Expected access mode button");
      }
      fireEvent.click(accessButton);
      await waitFor(() => {
        expect(document.body.textContent).toContain("Read only");
      });
      const readOnlyOption = await waitFor(() => {
        const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
          (candidate) => candidate.textContent?.trim() === "Read only"
        );
        expect(option).toBeTruthy();
        return option as HTMLElement;
      });
      fireEvent.click(readOnlyOption);

      await waitFor(() => {
        expect(document.querySelectorAll('[role="option"]').length).toBe(0);
        expect(document.querySelector('button[aria-label="Agent access"]')).toBeTruthy();
      });

      await waitFor(() => {
        expect(document.querySelectorAll('button[aria-label="Branch & worktree"]').length).toBe(1);
        expect(
          document.querySelector('[aria-label="Context usage 24.0k / 32.0k tokens (75%)"]')
        ).toBeTruthy();
      });
      fireEvent.click(
        document.querySelector('button[aria-label="Branch & worktree"]') as HTMLButtonElement
      );
      await waitFor(() => {
        expect(
          document.querySelector('input[aria-label="Search branches or pull requests"]')
        ).toBeTruthy();
      });
      const branchSearch = document.querySelector<HTMLInputElement>(
        'input[aria-label="Search branches or pull requests"]'
      );
      if (!branchSearch) {
        throw new Error("Expected branch search input");
      }
      expect(document.body.textContent).toContain("feature/free-figma");
    });
  });

  describe("slash suggestions", () => {
    it("accepts the /review slash suggestion before sending in a real browser", async () => {
      const onSend = vi.fn();

      render(<ComposerHarness onSend={onSend} />);

      const { textarea } = getComposerControls();

      fireEvent.change(textarea, { target: { value: "/rev" } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      await waitFor(() => {
        expect(textarea.value).toBe("/review ");
      });
      expect(onSend).not.toHaveBeenCalled();

      fireEvent.keyDown(textarea, { key: "Enter" });

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledTimes(1);
        expect(onSend).toHaveBeenCalledWith("/review", []);
      });
    });

    it("moves focus into the review prompt and restores it on close in a real browser", async () => {
      render(<ReviewPromptBrowserHarness />);

      const { textarea } = getComposerControls();

      fireEvent.change(textarea, { target: { value: "/rev" } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      await waitFor(() => {
        expect(textarea.value).toBe("/review ");
      });

      fireEvent.keyDown(textarea, { key: "Enter" });

      await waitFor(() => {
        const dialog = document.querySelector<HTMLElement>(
          '[role="dialog"][aria-label="Select a review preset"]'
        );
        expect(dialog).toBeTruthy();
        expect(dialog?.contains(document.activeElement)).toBe(true);
      });

      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLElement)) {
        throw new Error("Expected the review prompt to own focus");
      }

      fireEvent.keyDown(activeElement, { key: "Escape" });

      await waitFor(() => {
        expect(
          document.querySelector('[role="dialog"][aria-label="Select a review preset"]')
        ).toBeNull();
        expect(document.activeElement).toBe(textarea);
      });
    });
  });

  describe("approval resolver", () => {
    it("resolves approvals from the composer panel in a real browser", async () => {
      const request = createApprovalRequest();
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

      await flushLazyBoundary();
      await waitFor(() => {
        expect(getButtonByText("Always allow")).toBeTruthy();
      });

      fireEvent.click(getButtonByText("Always allow"));
      fireEvent.click(getButtonByText("Decline"));
      fireEvent.click(getButtonByText("Approve"));

      await waitFor(() => {
        expect(onPendingApprovalRemember).toHaveBeenCalledWith(request, ["pnpm", "validate:fast"]);
        expect(onPendingApprovalDecision).toHaveBeenNthCalledWith(1, request, "decline");
        expect(onPendingApprovalDecision).toHaveBeenNthCalledWith(2, request, "accept");
      });
    });
  });

  describe("pending-input resolver", () => {
    it("uses Enter as a newline while pending-input mode is active in a real browser", () => {
      const onSend = vi.fn();

      render(
        <ComposerHarness
          onSend={onSend}
          pendingUserInputRequest={{
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
          }}
          onPendingUserInputSubmit={vi.fn()}
        />
      );

      const { textarea } = getComposerControls();

      fireEvent.change(textarea, { target: { value: "line one" } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      expect(onSend).not.toHaveBeenCalled();
      expect(textarea.value).toBe("line one\n");
    });

    it("auto-advances a multi-question request after option selection without falling back to send", async () => {
      const onSend = vi.fn();

      render(
        <ComposerHarness
          onSend={onSend}
          pendingUserInputRequest={createPendingUserInputRequest()}
          onPendingUserInputSubmit={vi.fn()}
        />
      );

      fireEvent.click(getButtonByText("Safe mode"));

      await waitFor(() => {
        expect(getButtonByText("Submit answers")).toBeTruthy();
      });
      expect(onSend).not.toHaveBeenCalled();
      expect(getComposerControls().textarea.value).toBe("");
    });

    it("cancels pending-input auto-advance when a note is typed before the timer elapses", async () => {
      const onSend = vi.fn();
      const onPendingUserInputSubmit = vi.fn();

      render(
        <ComposerHarness
          onSend={onSend}
          pendingUserInputRequest={createPendingUserInputRequest()}
          onPendingUserInputSubmit={onPendingUserInputSubmit}
        />
      );

      fireEvent.click(getButtonByText("Safe mode"));
      fireEvent.change(getComposerControls().textarea, {
        target: { value: "Need explicit rollback notes" },
      });

      await waitForAppTimer(PENDING_INPUT_AUTO_ADVANCE_MS + 40);

      expect(() => getButtonByText("Next question")).not.toThrow();
      expect(
        Array.from(document.querySelectorAll<HTMLButtonElement>("button")).some((button) =>
          button.textContent?.replace(/\s+/g, " ").trim().includes("Submit answers")
        )
      ).toBe(false);
      expect(getComposerControls().textarea.value).toBe("Need explicit rollback notes");
      expect(onPendingUserInputSubmit).not.toHaveBeenCalled();
      expect(onSend).not.toHaveBeenCalled();
    });

    it("does not restart pending-input auto-advance when the user changes options after typing a note", async () => {
      const onSend = vi.fn();
      const onPendingUserInputSubmit = vi.fn();

      render(
        <ComposerHarness
          onSend={onSend}
          pendingUserInputRequest={createPendingUserInputRequest()}
          onPendingUserInputSubmit={onPendingUserInputSubmit}
        />
      );

      fireEvent.click(getButtonByText("Safe mode"));
      fireEvent.change(getComposerControls().textarea, {
        target: { value: "Need explicit rollback notes" },
      });
      fireEvent.click(getButtonByText("Fast mode"));

      await waitForAppTimer(PENDING_INPUT_AUTO_ADVANCE_MS + 40);

      expect(() => getButtonByText("Next question")).not.toThrow();
      expect(
        Array.from(document.querySelectorAll<HTMLButtonElement>("button")).some((button) =>
          button.textContent?.replace(/\s+/g, " ").trim().includes("Submit answers")
        )
      ).toBe(false);
      expect(getComposerControls().textarea.value).toBe("Need explicit rollback notes");
      expect(onPendingUserInputSubmit).not.toHaveBeenCalled();
      expect(onSend).not.toHaveBeenCalled();
    });

    it("does not auto-advance when switching back to an option that already has a saved note", async () => {
      const onSend = vi.fn();
      const onPendingUserInputSubmit = vi.fn();

      render(
        <ComposerHarness
          onSend={onSend}
          pendingUserInputRequest={createPendingUserInputRequest()}
          onPendingUserInputSubmit={onPendingUserInputSubmit}
        />
      );

      fireEvent.click(getButtonByText("Fast mode"));
      fireEvent.change(getComposerControls().textarea, {
        target: { value: "Keep audit trail" },
      });
      fireEvent.click(getButtonByText("Safe mode"));
      fireEvent.change(getComposerControls().textarea, {
        target: { value: "" },
      });
      fireEvent.click(getButtonByText("Fast mode"));

      await waitForAppTimer(PENDING_INPUT_AUTO_ADVANCE_MS + 40);

      expect(() => getButtonByText("Next question")).not.toThrow();
      expect(
        Array.from(document.querySelectorAll<HTMLButtonElement>("button")).some((button) =>
          button.textContent?.replace(/\s+/g, " ").trim().includes("Submit answers")
        )
      ).toBe(false);
      expect(getComposerControls().textarea.value).toBe("Keep audit trail");
      expect(onPendingUserInputSubmit).not.toHaveBeenCalled();
      expect(onSend).not.toHaveBeenCalled();
    });

    it("does not auto-advance when a number shortcut selects an option with a saved note", async () => {
      const onSend = vi.fn();
      const onPendingUserInputSubmit = vi.fn();

      render(
        <ComposerHarness
          onSend={onSend}
          pendingUserInputRequest={createPendingUserInputRequest()}
          onPendingUserInputSubmit={onPendingUserInputSubmit}
        />
      );

      const { textarea } = getComposerControls();
      fireEvent.change(textarea, { target: { value: "Keep audit trail" } });
      fireEvent.keyDown(textarea, { key: "2" });
      fireEvent.change(getComposerControls().textarea, {
        target: { value: "" },
      });
      fireEvent.keyDown(getComposerControls().textarea, { key: "1" });

      await waitForAppTimer(PENDING_INPUT_AUTO_ADVANCE_MS + 40);

      expect(() => getButtonByText("Next question")).not.toThrow();
      expect(
        Array.from(document.querySelectorAll<HTMLButtonElement>("button")).some((button) =>
          button.textContent?.replace(/\s+/g, " ").trim().includes("Submit answers")
        )
      ).toBe(false);
      expect(getComposerControls().textarea.value).toBe("Keep audit trail");
      expect(onPendingUserInputSubmit).not.toHaveBeenCalled();
      expect(onSend).not.toHaveBeenCalled();
    });

    it("restores saved notes while cycling options with arrow keys", () => {
      render(
        <ComposerHarness
          onSend={vi.fn()}
          pendingUserInputRequest={createPendingUserInputRequest()}
          onPendingUserInputSubmit={vi.fn()}
        />
      );

      const { textarea } = getComposerControls();
      fireEvent.change(textarea, { target: { value: "Keep audit trail" } });
      fireEvent.keyDown(textarea, { key: "ArrowRight" });
      fireEvent.change(getComposerControls().textarea, {
        target: { value: "" },
      });
      fireEvent.keyDown(getComposerControls().textarea, { key: "ArrowLeft" });

      expect(getComposerControls().textarea.value).toBe("Keep audit trail");
      expect(() => getButtonByText("Next question")).not.toThrow();
    });

    it("preserves answers across previous navigation and restores the normal draft after completion in a real browser", async () => {
      const request = createPendingUserInputRequest();
      const onSend = vi.fn();
      const onPendingUserInputSubmit = vi.fn();

      function PendingUserInputHarness() {
        const [pendingRequest, setPendingRequest] = useState<RequestUserInputRequest | null>(
          request
        );

        return (
          <ComposerHarness
            onSend={onSend}
            initialDraftText="keep this queued for later"
            pendingUserInputRequest={pendingRequest}
            onPendingUserInputSubmit={(submittedRequest, response) => {
              onPendingUserInputSubmit(submittedRequest, response);
              setPendingRequest(null);
            }}
          />
        );
      }

      render(<PendingUserInputHarness />);

      fireEvent.click(getButtonByText("Fast mode"));
      fireEvent.change(getComposerControls().textarea, {
        target: { value: "Need audit trail" },
      });
      fireEvent.click(getButtonByText("Next question"));

      await waitFor(() => {
        expect(getButtonByText("Submit answers")).toBeTruthy();
      });
      expect(getComposerControls().textarea.value).toBe("");

      fireEvent.change(getComposerControls().textarea, {
        target: { value: "Keep rollback path documented" },
      });
      fireEvent.click(getButtonByText("Previous"));
      expect(getComposerControls().textarea.value).toBe("Need audit trail");

      fireEvent.click(getButtonByText("Next question"));
      expect(getComposerControls().textarea.value).toBe("Keep rollback path documented");

      fireEvent.click(getButtonByText("Submit answers"));

      await waitFor(() => {
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
      await waitFor(() => {
        expect(getComposerControls().textarea.value).toBe("keep this queued for later");
      });
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe("plan follow-up resolver", () => {
    it("routes plan follow-up refinements through the plan callback in a real browser", async () => {
      const onSend = vi.fn();
      const onPendingPlanSubmitChanges = vi.fn();
      const onPendingPlanAccept = vi.fn();
      const onOpenPlanPanel = vi.fn();
      window.addEventListener("hugecode:show-plan-panel", onOpenPlanPanel, { once: true });

      render(
        <ComposerHarness
          onSend={onSend}
          collaborationModes={createCollaborationModes()}
          selectedCollaborationModeId="plan"
          pendingPlanFollowup={createPlanFollowup()}
          onPendingPlanAccept={onPendingPlanAccept}
          onPendingPlanSubmitChanges={onPendingPlanSubmitChanges}
        />
      );

      const changeRequest = document.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Plan change request"]'
      );
      if (!changeRequest) {
        throw new Error("Expected plan change request textarea");
      }

      fireEvent.change(changeRequest, { target: { value: "Add rollback checkpoints" } });
      fireEvent.click(getButtonByText("Open plan panel"));
      fireEvent.click(getButtonByText("Refine plan"));

      await waitFor(() => {
        expect(onOpenPlanPanel).toHaveBeenCalledTimes(1);
        expect(onPendingPlanSubmitChanges).toHaveBeenCalledWith("Add rollback checkpoints");
      });
      expect(onPendingPlanAccept).not.toHaveBeenCalled();
      expect(onSend).not.toHaveBeenCalled();
    });

    it("uses Enter as a newline while plan follow-up mode is active in a real browser", () => {
      const onSend = vi.fn();

      render(
        <ComposerHarness
          onSend={onSend}
          collaborationModes={createCollaborationModes()}
          selectedCollaborationModeId="plan"
          pendingPlanFollowup={createPlanFollowup({
            planItemId: "plan-newline",
            threadId: "thread-plan-newline",
            title: "Tighten runtime diagnostics",
            preview: "1. Collect logs\n2. Compare traces",
            body: "## Tighten runtime diagnostics\n1. Collect logs\n2. Compare traces",
          })}
          onPendingPlanAccept={vi.fn()}
          onPendingPlanSubmitChanges={vi.fn()}
        />
      );

      const { textarea } = getComposerControls();

      fireEvent.change(textarea, { target: { value: "keep this draft local" } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      expect(onSend).not.toHaveBeenCalled();
      expect(textarea.value).toBe("keep this draft local\n");
    });

    it("restores the normal send path after leaving plan follow-up mode in a real browser", async () => {
      const onSend = vi.fn();
      const view = render(
        <ComposerHarness
          onSend={onSend}
          collaborationModes={createCollaborationModes()}
          selectedCollaborationModeId="plan"
          pendingPlanFollowup={createPlanFollowup({
            planItemId: "plan-chat-mode",
            threadId: "thread-plan-chat",
            title: "Refine runtime audit",
            preview: "1. Inspect logs\n2. Compare planner states",
            body: "## Refine runtime audit\n1. Inspect logs\n2. Compare planner states",
          })}
          onPendingPlanAccept={vi.fn()}
          onPendingPlanSubmitChanges={vi.fn()}
        />
      );

      view.rerender(
        <ComposerHarness
          onSend={onSend}
          collaborationModes={createCollaborationModes()}
          selectedCollaborationModeId="default"
          pendingPlanFollowup={createPlanFollowup({
            planItemId: "plan-chat-mode",
            threadId: "thread-plan-chat",
            title: "Refine runtime audit",
            preview: "1. Inspect logs\n2. Compare planner states",
            body: "## Refine runtime audit\n1. Inspect logs\n2. Compare planner states",
          })}
          onPendingPlanAccept={vi.fn()}
          onPendingPlanSubmitChanges={vi.fn()}
        />
      );

      const { textarea } = getComposerControls();
      fireEvent.change(textarea, { target: { value: "continue in chat" } });
      fireEvent.click(getSendButton());

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith("continue in chat", []);
      });
    });
  });

  describe("tool-call response resolver", () => {
    it("submits tool-call output through the tool callback in a real browser", async () => {
      const request = createToolCallRequest();
      const onPendingToolCallSubmit = vi.fn();

      render(
        <ComposerHarness
          onSend={vi.fn()}
          pendingToolCallRequest={request}
          onPendingToolCallSubmit={onPendingToolCallSubmit}
        />
      );

      const outputTextarea = document.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Tool call output"]'
      );
      const successCheckbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (!outputTextarea || !successCheckbox) {
        throw new Error("Expected tool call controls");
      }

      fireEvent.change(outputTextarea, { target: { value: "output payload" } });
      fireEvent.click(successCheckbox);
      fireEvent.click(getButtonByText("Submit output"));

      await waitFor(() => {
        expect(onPendingToolCallSubmit).toHaveBeenCalledWith(request, {
          contentItems: [{ type: "inputText", text: "output payload" }],
          success: false,
        });
      });
    });

    it("uses Enter as a newline while tool-call mode is active in a real browser", () => {
      const onSend = vi.fn();
      const request = createToolCallRequest({
        requestId: "tool-call-newline",
        thread_id: "thread-tool-call-newline",
        turn_id: "turn-tool-call-newline",
        call_id: "call-newline",
      });

      render(
        <ComposerHarness
          onSend={onSend}
          pendingToolCallRequest={request}
          onPendingToolCallSubmit={vi.fn()}
        />
      );

      const { textarea } = getComposerControls();

      fireEvent.change(textarea, { target: { value: "draft stays local" } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      expect(onSend).not.toHaveBeenCalled();
      expect(textarea.value).toBe("draft stays local\n");
    });
  });

  describe("resolver priority boundaries", () => {
    it("prioritizes tool-call resolution over plan follow-up when both are present in a real browser", async () => {
      const onPendingToolCallSubmit = vi.fn();
      const onPendingPlanAccept = vi.fn();
      const onPendingPlanSubmitChanges = vi.fn();

      render(
        <ComposerHarness
          onSend={vi.fn()}
          collaborationModes={createCollaborationModes()}
          selectedCollaborationModeId="plan"
          pendingPlanFollowup={createPlanFollowup({
            planItemId: "plan-and-tool",
            threadId: "thread-plan-and-tool",
            title: "Review runtime plan",
            preview: "1. Compare state\n2. Record evidence",
            body: "## Review runtime plan\n1. Compare state\n2. Record evidence",
          })}
          onPendingPlanAccept={onPendingPlanAccept}
          onPendingPlanSubmitChanges={onPendingPlanSubmitChanges}
          pendingToolCallRequest={createToolCallRequest({
            requestId: "tool-call-priority",
            thread_id: "thread-tool-priority",
            turn_id: "turn-tool-priority",
            call_id: "call-priority",
            arguments: { includeEnv: false },
          })}
          onPendingToolCallSubmit={onPendingToolCallSubmit}
        />
      );

      expect(() => getButtonByText("Submit output")).not.toThrow();
      expect(
        Array.from(document.querySelectorAll<HTMLButtonElement>("button")).some(
          (button) => button.textContent?.trim() === "Implement plan"
        )
      ).toBe(false);

      const outputTextarea = document.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Tool call output"]'
      );
      if (!outputTextarea) {
        throw new Error("Expected tool call output textarea");
      }

      fireEvent.change(outputTextarea, { target: { value: "tool result wins priority" } });
      fireEvent.click(getButtonByText("Submit output"));

      await waitFor(() => {
        expect(onPendingToolCallSubmit).toHaveBeenCalledWith(
          createToolCallRequest({
            requestId: "tool-call-priority",
            thread_id: "thread-tool-priority",
            turn_id: "turn-tool-priority",
            call_id: "call-priority",
            arguments: { includeEnv: false },
          }),
          {
            contentItems: [{ type: "inputText", text: "tool result wins priority" }],
            success: true,
          }
        );
      });
      expect(onPendingPlanAccept).not.toHaveBeenCalled();
      expect(onPendingPlanSubmitChanges).not.toHaveBeenCalled();
    });

    it("prioritizes approval over tool-call and keeps Enter on the main draft local in a real browser", async () => {
      const onSend = vi.fn();
      const approvalRequest = createApprovalRequest();
      const onPendingApprovalDecision = vi.fn();
      const onPendingToolCallSubmit = vi.fn();

      render(
        <ComposerHarness
          onSend={onSend}
          pendingApprovalRequest={approvalRequest}
          onPendingApprovalDecision={onPendingApprovalDecision}
          pendingToolCallRequest={createToolCallRequest()}
          onPendingToolCallSubmit={onPendingToolCallSubmit}
        />
      );

      const { textarea } = getComposerControls();
      fireEvent.change(textarea, { target: { value: "review locally first" } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      expect(onSend).not.toHaveBeenCalled();
      expect(textarea.value).toBe("review locally first\n");

      fireEvent.click(getButtonByText("Approve"));

      await waitFor(() => {
        expect(onPendingApprovalDecision).toHaveBeenCalledWith(approvalRequest, "accept");
      });
      expect(onPendingToolCallSubmit).not.toHaveBeenCalled();
    });

    it("prioritizes approval over plan follow-up, then restores plan actions after approval clears", async () => {
      const approvalRequest = createApprovalRequest();
      const onSend = vi.fn();
      const onPendingApprovalDecision = vi.fn();
      const onPendingPlanAccept = vi.fn();
      const onPendingPlanSubmitChanges = vi.fn();
      const view = render(
        <ComposerHarness
          onSend={onSend}
          collaborationModes={createCollaborationModes()}
          selectedCollaborationModeId="plan"
          pendingApprovalRequest={approvalRequest}
          onPendingApprovalDecision={onPendingApprovalDecision}
          pendingPlanFollowup={createPlanFollowup({
            planItemId: "approval-plan-priority",
            threadId: "thread-approval-plan-priority",
            title: "Audit startup recovery",
            preview: "1. Collect failure evidence\n2. Confirm rollback steps",
            body: "## Audit startup recovery\n1. Collect failure evidence\n2. Confirm rollback steps",
          })}
          onPendingPlanAccept={onPendingPlanAccept}
          onPendingPlanSubmitChanges={onPendingPlanSubmitChanges}
        />
      );

      const { textarea } = getComposerControls();
      fireEvent.change(textarea, { target: { value: "keep approval draft local" } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      expect(onSend).not.toHaveBeenCalled();
      expect(textarea.value).toBe("keep approval draft local\n");
      expect(() => getButtonByText("Approve")).not.toThrow();
      expect(
        Array.from(document.querySelectorAll<HTMLButtonElement>("button")).some(
          (button) => button.textContent?.trim() === "Implement plan"
        )
      ).toBe(false);

      fireEvent.click(getButtonByText("Approve"));

      await waitFor(() => {
        expect(onPendingApprovalDecision).toHaveBeenCalledWith(approvalRequest, "accept");
      });
      expect(onPendingPlanAccept).not.toHaveBeenCalled();
      expect(onPendingPlanSubmitChanges).not.toHaveBeenCalled();

      view.rerender(
        <ComposerHarness
          onSend={onSend}
          collaborationModes={createCollaborationModes()}
          selectedCollaborationModeId="plan"
          pendingApprovalRequest={null}
          onPendingApprovalDecision={onPendingApprovalDecision}
          pendingPlanFollowup={createPlanFollowup({
            planItemId: "approval-plan-priority",
            threadId: "thread-approval-plan-priority",
            title: "Audit startup recovery",
            preview: "1. Collect failure evidence\n2. Confirm rollback steps",
            body: "## Audit startup recovery\n1. Collect failure evidence\n2. Confirm rollback steps",
          })}
          onPendingPlanAccept={onPendingPlanAccept}
          onPendingPlanSubmitChanges={onPendingPlanSubmitChanges}
        />
      );

      const changeRequest = document.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Plan change request"]'
      );
      if (!changeRequest) {
        throw new Error("Expected plan change request textarea after approval clears");
      }

      expect(() => getButtonByText("Implement plan")).not.toThrow();
      fireEvent.change(changeRequest, { target: { value: "Add verification checkpoints" } });
      fireEvent.click(getButtonByText("Refine plan"));

      await waitFor(() => {
        expect(onPendingPlanSubmitChanges).toHaveBeenCalledWith("Add verification checkpoints");
      });
      expect(onPendingPlanAccept).not.toHaveBeenCalled();
    });

    it("restores tool-call before plan after approval clears in a three-resolver stack", async () => {
      const approvalRequest = createApprovalRequest();
      const toolCallRequest = createToolCallRequest({
        requestId: "tool-call-priority-stack",
        thread_id: "thread-tool-priority-stack",
        turn_id: "turn-tool-priority-stack",
        call_id: "call-priority-stack",
      });
      const onPendingApprovalDecision = vi.fn();
      const onPendingToolCallSubmit = vi.fn();
      const onPendingPlanAccept = vi.fn();
      const onPendingPlanSubmitChanges = vi.fn();
      const view = render(
        <ComposerHarness
          onSend={vi.fn()}
          collaborationModes={PLAN_COLLABORATION_MODES}
          selectedCollaborationModeId="plan"
          pendingApprovalRequest={approvalRequest}
          onPendingApprovalDecision={onPendingApprovalDecision}
          pendingToolCallRequest={toolCallRequest}
          onPendingToolCallSubmit={onPendingToolCallSubmit}
          pendingPlanFollowup={createPlanFollowup({
            planItemId: "stacked-recovery",
            threadId: "thread-stacked-recovery",
            title: "Stabilize stacked resolvers",
            preview: "1. Clear approval\n2. Finish tool output\n3. Resume plan",
            body: "## Stabilize stacked resolvers\n1. Clear approval\n2. Finish tool output\n3. Resume plan",
          })}
          onPendingPlanAccept={onPendingPlanAccept}
          onPendingPlanSubmitChanges={onPendingPlanSubmitChanges}
        />
      );

      expect(() => getButtonByText("Approve")).not.toThrow();
      expect(
        Array.from(document.querySelectorAll<HTMLButtonElement>("button")).some(
          (button) => button.textContent?.trim() === "Submit output"
        )
      ).toBe(false);
      expect(
        Array.from(document.querySelectorAll<HTMLButtonElement>("button")).some(
          (button) => button.textContent?.trim() === "Implement plan"
        )
      ).toBe(false);

      fireEvent.click(getButtonByText("Approve"));

      await waitFor(() => {
        expect(onPendingApprovalDecision).toHaveBeenCalledWith(approvalRequest, "accept");
      });

      view.rerender(
        <ComposerHarness
          onSend={vi.fn()}
          collaborationModes={PLAN_COLLABORATION_MODES}
          selectedCollaborationModeId="plan"
          pendingApprovalRequest={null}
          onPendingApprovalDecision={onPendingApprovalDecision}
          pendingToolCallRequest={toolCallRequest}
          onPendingToolCallSubmit={onPendingToolCallSubmit}
          pendingPlanFollowup={createPlanFollowup({
            planItemId: "stacked-recovery",
            threadId: "thread-stacked-recovery",
            title: "Stabilize stacked resolvers",
            preview: "1. Clear approval\n2. Finish tool output\n3. Resume plan",
            body: "## Stabilize stacked resolvers\n1. Clear approval\n2. Finish tool output\n3. Resume plan",
          })}
          onPendingPlanAccept={onPendingPlanAccept}
          onPendingPlanSubmitChanges={onPendingPlanSubmitChanges}
        />
      );

      expect(() => getButtonByText("Submit output")).not.toThrow();
      expect(
        Array.from(document.querySelectorAll<HTMLButtonElement>("button")).some(
          (button) => button.textContent?.trim() === "Implement plan"
        )
      ).toBe(false);

      const outputTextarea = document.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Tool call output"]'
      );
      if (!outputTextarea) {
        throw new Error("Expected tool call output textarea after approval clears");
      }
      fireEvent.change(outputTextarea, { target: { value: "tool stack recovered" } });
      fireEvent.click(getButtonByText("Submit output"));

      await waitFor(() => {
        expect(onPendingToolCallSubmit).toHaveBeenCalledWith(toolCallRequest, {
          contentItems: [{ type: "inputText", text: "tool stack recovered" }],
          success: true,
        });
      });

      view.rerender(
        <ComposerHarness
          onSend={vi.fn()}
          collaborationModes={PLAN_COLLABORATION_MODES}
          selectedCollaborationModeId="plan"
          pendingApprovalRequest={null}
          onPendingApprovalDecision={onPendingApprovalDecision}
          pendingToolCallRequest={null}
          onPendingToolCallSubmit={onPendingToolCallSubmit}
          pendingPlanFollowup={createPlanFollowup({
            planItemId: "stacked-recovery",
            threadId: "thread-stacked-recovery",
            title: "Stabilize stacked resolvers",
            preview: "1. Clear approval\n2. Finish tool output\n3. Resume plan",
            body: "## Stabilize stacked resolvers\n1. Clear approval\n2. Finish tool output\n3. Resume plan",
          })}
          onPendingPlanAccept={onPendingPlanAccept}
          onPendingPlanSubmitChanges={onPendingPlanSubmitChanges}
        />
      );

      expect(() => getButtonByText("Implement plan")).not.toThrow();
      expect(onPendingPlanAccept).not.toHaveBeenCalled();
      expect(onPendingPlanSubmitChanges).not.toHaveBeenCalled();
    });

    it("keeps Enter local as stacked resolvers recover from approval to tool-call to plan", () => {
      const approvalRequest = createApprovalRequest();
      const onSend = vi.fn();
      const view = render(
        <ComposerHarness
          onSend={onSend}
          collaborationModes={PLAN_COLLABORATION_MODES}
          selectedCollaborationModeId="plan"
          pendingApprovalRequest={approvalRequest}
          onPendingApprovalDecision={vi.fn()}
          pendingToolCallRequest={createToolCallRequest({
            requestId: "tool-call-keyboard-stack",
            thread_id: "thread-tool-keyboard-stack",
            turn_id: "turn-tool-keyboard-stack",
            call_id: "call-keyboard-stack",
          })}
          onPendingToolCallSubmit={vi.fn()}
          pendingPlanFollowup={createPlanFollowup({
            planItemId: "keyboard-stacked-recovery",
            threadId: "thread-keyboard-stacked-recovery",
            title: "Validate keyboard recovery",
            preview: "1. Clear approval\n2. Keep tool-call local\n3. Keep plan local",
            body: "## Validate keyboard recovery\n1. Clear approval\n2. Keep tool-call local\n3. Keep plan local",
          })}
          onPendingPlanAccept={vi.fn()}
          onPendingPlanSubmitChanges={vi.fn()}
        />
      );

      const { textarea } = getComposerControls();
      fireEvent.change(textarea, { target: { value: "approval draft" } });
      fireEvent.keyDown(textarea, { key: "Enter" });
      expect(textarea.value).toBe("approval draft\n");
      expect(onSend).not.toHaveBeenCalled();

      view.rerender(
        <ComposerHarness
          onSend={onSend}
          collaborationModes={PLAN_COLLABORATION_MODES}
          selectedCollaborationModeId="plan"
          pendingApprovalRequest={null}
          onPendingApprovalDecision={vi.fn()}
          pendingToolCallRequest={createToolCallRequest({
            requestId: "tool-call-keyboard-stack",
            thread_id: "thread-tool-keyboard-stack",
            turn_id: "turn-tool-keyboard-stack",
            call_id: "call-keyboard-stack",
          })}
          onPendingToolCallSubmit={vi.fn()}
          pendingPlanFollowup={createPlanFollowup({
            planItemId: "keyboard-stacked-recovery",
            threadId: "thread-keyboard-stacked-recovery",
            title: "Validate keyboard recovery",
            preview: "1. Clear approval\n2. Keep tool-call local\n3. Keep plan local",
            body: "## Validate keyboard recovery\n1. Clear approval\n2. Keep tool-call local\n3. Keep plan local",
          })}
          onPendingPlanAccept={vi.fn()}
          onPendingPlanSubmitChanges={vi.fn()}
        />
      );

      fireEvent.change(getComposerControls().textarea, { target: { value: "tool-call draft" } });
      fireEvent.keyDown(getComposerControls().textarea, { key: "Enter" });
      expect(getComposerControls().textarea.value).toBe("tool-call draft\n");
      expect(onSend).not.toHaveBeenCalled();

      view.rerender(
        <ComposerHarness
          onSend={onSend}
          collaborationModes={PLAN_COLLABORATION_MODES}
          selectedCollaborationModeId="plan"
          pendingApprovalRequest={null}
          onPendingApprovalDecision={vi.fn()}
          pendingToolCallRequest={null}
          onPendingToolCallSubmit={vi.fn()}
          pendingPlanFollowup={createPlanFollowup({
            planItemId: "keyboard-stacked-recovery",
            threadId: "thread-keyboard-stacked-recovery",
            title: "Validate keyboard recovery",
            preview: "1. Clear approval\n2. Keep tool-call local\n3. Keep plan local",
            body: "## Validate keyboard recovery\n1. Clear approval\n2. Keep tool-call local\n3. Keep plan local",
          })}
          onPendingPlanAccept={vi.fn()}
          onPendingPlanSubmitChanges={vi.fn()}
        />
      );

      fireEvent.change(getComposerControls().textarea, { target: { value: "plan draft" } });
      fireEvent.keyDown(getComposerControls().textarea, { key: "Enter" });
      expect(getComposerControls().textarea.value).toBe("plan draft\n");
      expect(onSend).not.toHaveBeenCalled();
    });

    it("prioritizes pending-input over approval and preserves the multi-step answer flow in a real browser", async () => {
      const request = createPendingUserInputRequest();
      const onSend = vi.fn();
      const onPendingUserInputSubmit = vi.fn();
      const onPendingApprovalDecision = vi.fn();

      render(
        <ComposerHarness
          onSend={onSend}
          pendingUserInputRequest={request}
          onPendingUserInputSubmit={onPendingUserInputSubmit}
          pendingApprovalRequest={createApprovalRequest()}
          onPendingApprovalDecision={onPendingApprovalDecision}
        />
      );

      fireEvent.click(getButtonByText("Safe mode"));

      await waitFor(() => {
        expect(getButtonByText("Submit answers")).toBeTruthy();
      });

      fireEvent.change(getComposerControls().textarea, {
        target: { value: "Keep rollback visible" },
      });
      fireEvent.click(getButtonByText("Submit answers"));

      await waitFor(() => {
        expect(onPendingUserInputSubmit).toHaveBeenCalledWith(request, {
          answers: {
            q_mode: {
              answers: ["Safe mode"],
            },
            q_notes: {
              answers: ["Keep rollback visible"],
            },
          },
        });
      });
      expect(onPendingApprovalDecision).not.toHaveBeenCalled();
      expect(onSend).not.toHaveBeenCalled();
    });

    it("keeps pending-input in control when approval and tool-call are both present in a real browser", async () => {
      const request = createSingleQuestionPendingUserInputRequest();
      const onSend = vi.fn();
      const onPendingUserInputSubmit = vi.fn();
      const onPendingApprovalDecision = vi.fn();
      const onPendingToolCallSubmit = vi.fn();

      render(
        <ComposerHarness
          onSend={onSend}
          pendingUserInputRequest={request}
          onPendingUserInputSubmit={onPendingUserInputSubmit}
          pendingApprovalRequest={createApprovalRequest()}
          onPendingApprovalDecision={onPendingApprovalDecision}
          pendingToolCallRequest={createToolCallRequest({
            requestId: "tool-call-triple",
            thread_id: "thread-tool-triple",
            turn_id: "turn-tool-triple",
            call_id: "call-triple",
          })}
          onPendingToolCallSubmit={onPendingToolCallSubmit}
        />
      );

      const { textarea } = getComposerControls();
      fireEvent.change(textarea, { target: { value: "Need audit trail" } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      expect(onSend).not.toHaveBeenCalled();
      expect(textarea.value).toBe("Need audit trail\n");

      fireEvent.click(getButtonByText("Safe mode"));
      fireEvent.click(getButtonByText("Submit answers"));

      await waitFor(() => {
        expect(onPendingUserInputSubmit).toHaveBeenCalledWith(request, {
          answers: {
            q_mode: {
              answers: ["Safe mode", "user_note: Need audit trail"],
            },
          },
        });
      });
      expect(onPendingApprovalDecision).not.toHaveBeenCalled();
      expect(onPendingToolCallSubmit).not.toHaveBeenCalled();
    });
  });
});
