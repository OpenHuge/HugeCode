import { useCallback, useMemo } from "react";
import type { GitHubPullRequest, GitHubPullRequestDiff, WorkspaceInfo } from "../../../types";
import { buildPullRequestDraft, buildPullRequestPrompt } from "../../../utils/pullRequestPrompt";
import { isBuiltInSlashCommandText } from "../../../utils/slashCommands";
import type { AppTab } from "../../shell/types/shellRoute";

type UsePullRequestComposerOptions = {
  activeWorkspace: WorkspaceInfo | null;
  selectedPullRequest: GitHubPullRequest | null;
  gitPullRequestDiffs: GitHubPullRequestDiff[];
  filePanelMode: "git" | "files" | "atlas" | "prompts";
  gitPanelMode: "diff" | "log" | "issues" | "prs";
  centerMode: "chat" | "diff";
  isCompact: boolean;
  setSelectedPullRequest: (pullRequest: GitHubPullRequest | null) => void;
  setDiffSource: (source: "local" | "pr" | "commit") => void;
  setSelectedDiffPath: (path: string | null) => void;
  setCenterMode: (mode: "chat" | "diff") => void;
  setGitPanelMode: (mode: "diff" | "log" | "issues" | "prs") => void;
  setPrefillDraft: (draft: { id: string; text: string; createdAt: number }) => void;
  setActiveTab: (tab: AppTab) => void;
  connectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  startThreadForWorkspace: (
    workspaceId: string,
    options?: { activate?: boolean }
  ) => Promise<string | null>;
  sendUserMessageToThread: (
    workspace: WorkspaceInfo,
    threadId: string,
    text: string,
    images?: string[]
  ) => Promise<void>;
  clearActiveImages: () => void;
  handleSend: (text: string, images: string[]) => Promise<void | false>;
  queueMessage: (text: string, images: string[]) => Promise<void | false>;
};

export function usePullRequestComposer({
  activeWorkspace,
  selectedPullRequest,
  gitPullRequestDiffs,
  filePanelMode,
  gitPanelMode,
  centerMode,
  isCompact,
  setSelectedPullRequest,
  setDiffSource,
  setSelectedDiffPath,
  setCenterMode,
  setGitPanelMode,
  setPrefillDraft,
  setActiveTab,
  connectWorkspace,
  startThreadForWorkspace,
  sendUserMessageToThread,
  clearActiveImages,
  handleSend,
  queueMessage,
}: UsePullRequestComposerOptions) {
  const isPullRequestComposer = useMemo(
    () =>
      Boolean(selectedPullRequest) &&
      filePanelMode === "git" &&
      gitPanelMode === "prs" &&
      centerMode === "diff",
    [centerMode, filePanelMode, gitPanelMode, selectedPullRequest]
  );

  const handleSelectPullRequest = useCallback(
    (pullRequest: GitHubPullRequest) => {
      setSelectedPullRequest(pullRequest);
      setDiffSource("pr");
      setSelectedDiffPath(null);
      setCenterMode("diff");
      setGitPanelMode("prs");
      setPrefillDraft({
        id: `pr-prefill-${pullRequest.number}-${Date.now()}`,
        text: buildPullRequestDraft(pullRequest),
        createdAt: Date.now(),
      });
      if (isCompact) {
        setActiveTab("review");
      }
    },
    [
      isCompact,
      setActiveTab,
      setCenterMode,
      setDiffSource,
      setGitPanelMode,
      setPrefillDraft,
      setSelectedDiffPath,
      setSelectedPullRequest,
    ]
  );

  const resetPullRequestSelection = useCallback(() => {
    setDiffSource("local");
    setSelectedPullRequest(null);
  }, [setDiffSource, setSelectedPullRequest]);

  const sendPullRequestQuestion = useCallback(
    async (text: string, images: string[] = []) => {
      const trimmed = text.trim();
      if (!activeWorkspace || !selectedPullRequest) {
        return;
      }
      if (!trimmed && images.length === 0) {
        return;
      }
      if (!activeWorkspace.connected) {
        await connectWorkspace(activeWorkspace);
      }
      const prompt = buildPullRequestPrompt(selectedPullRequest, gitPullRequestDiffs, trimmed);
      const threadId = await startThreadForWorkspace(activeWorkspace.id, {
        activate: false,
      });
      if (!threadId) {
        return;
      }
      await sendUserMessageToThread(activeWorkspace, threadId, prompt, images);
      clearActiveImages();
    },
    [
      activeWorkspace,
      clearActiveImages,
      connectWorkspace,
      gitPullRequestDiffs,
      selectedPullRequest,
      sendUserMessageToThread,
      startThreadForWorkspace,
    ]
  );

  const handleSendPullRequestQuestion = useCallback(
    async (text: string, images: string[] = []) => {
      const trimmed = text.trim();
      if (isBuiltInSlashCommandText(trimmed)) {
        return await handleSend(trimmed, images);
      }
      await sendPullRequestQuestion(text, images);
    },
    [handleSend, sendPullRequestQuestion]
  );

  const handleQueuePullRequestQuestion = useCallback(
    async (text: string, images: string[] = []) => {
      const trimmed = text.trim();
      if (isBuiltInSlashCommandText(trimmed)) {
        return await queueMessage(trimmed, images);
      }
      await sendPullRequestQuestion(text, images);
    },
    [queueMessage, sendPullRequestQuestion]
  );

  const composerSendLabel = isPullRequestComposer ? "Ask PR" : undefined;
  const handleComposerSend = isPullRequestComposer ? handleSendPullRequestQuestion : handleSend;
  const handleComposerQueue = isPullRequestComposer ? handleQueuePullRequestQuestion : queueMessage;

  return {
    handleSelectPullRequest,
    resetPullRequestSelection,
    isPullRequestComposer,
    composerSendLabel,
    handleComposerSend,
    handleComposerQueue,
  };
}
