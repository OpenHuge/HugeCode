import type { ComponentProps, RefObject } from "react";
import type {
  AccessMode,
  ApprovalRequest,
  CollaborationModeOption,
  ComposerEditorSettings,
  ComposerExecutionMode,
  ComposerModelSelectionMode,
  CustomPromptOption,
  DynamicToolCallRequest,
  DynamicToolCallResponse,
  QueuedMessage,
  RequestUserInputRequest,
  RequestUserInputResponse,
  SkillOption,
  ThreadTokenUsage,
} from "../../../types";
import type { ResolvedPlanArtifact } from "../../messages/utils/planArtifact";
import type { ReviewPromptState, ReviewPromptStep } from "../../threads/hooks/useReviewPrompt";
import type { ComposerMetaBar } from "./ComposerMetaBar";
import type { ComposerWorkspaceControls } from "./ComposerWorkspaceControls";

export type ComposerProps = {
  variant?: "thread" | "home" | "workspace";
  onSend: (text: string, images: string[]) => void | false | Promise<void | false>;
  onQueue: (text: string, images: string[]) => void | false | Promise<void | false>;
  onStop: () => void;
  canStop: boolean;
  disabled?: boolean;
  isProcessing: boolean;
  steerEnabled: boolean;
  collaborationModes: CollaborationModeOption[];
  selectedCollaborationModeId: string | null;
  onSelectCollaborationMode: (id: string | null) => void;
  accountOptions?: { id: string; label: string; status: string }[];
  selectedAccountIds?: string[];
  onSelectAccountIds?: (ids: string[]) => void;
  models: { id: string; displayName: string; model: string; available?: boolean }[];
  modelSelectionMode?: ComposerModelSelectionMode;
  selectedProviderId?: string | null;
  onSelectProvider?: (providerId: string) => void;
  onSelectAutoRoute?: (providerId: string | null) => void;
  onSelectModelSelectionMode?: (mode: ComposerModelSelectionMode) => void;
  selectedModelId: string | null;
  onSelectModel: (id: string) => void;
  reasoningOptions: string[];
  selectedEffort: string | null;
  onSelectEffort: (effort: string) => void;
  fastModeEnabled?: boolean;
  onToggleFastMode?: (enabled: boolean) => void;
  reasoningSupported: boolean;
  accessMode: AccessMode;
  onSelectAccessMode: (mode: AccessMode) => void;
  executionOptions: Array<{ value: ComposerExecutionMode; label: string; disabled?: boolean }>;
  selectedExecutionMode: ComposerExecutionMode;
  onSelectExecutionMode: (mode: ComposerExecutionMode) => void;
  remoteBackendOptions?: Array<{ value: string; label: string }>;
  selectedRemoteBackendId?: string | null;
  onSelectRemoteBackendId?: (backendId: string | null) => void;
  resolvedRemotePlacement?: {
    summary: string;
    detail: string | null;
    tone: "neutral" | "warning";
  } | null;
  autoDrive?: ComponentProps<typeof ComposerMetaBar>["autoDrive"];
  skills: SkillOption[];
  prompts: CustomPromptOption[];
  files: string[];
  contextUsage?: ThreadTokenUsage | null;
  queuedMessages?: QueuedMessage[];
  queuePausedReason?: string | null;
  onEditQueued?: (item: QueuedMessage) => void;
  onDeleteQueued?: (id: string) => void;
  sendLabel?: string;
  draftText?: string;
  onDraftChange?: (text: string) => void;
  historyKey?: string | null;
  attachedImages?: string[];
  onPickImages?: () => void;
  onAttachImages?: (paths: string[]) => void;
  onRemoveImage?: (path: string) => void;
  prefillDraft?: QueuedMessage | null;
  onPrefillHandled?: (id: string) => void;
  insertText?: QueuedMessage | null;
  onInsertHandled?: (id: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  editorSettings?: ComposerEditorSettings;
  editorExpanded?: boolean;
  onToggleEditorExpanded?: () => void;
  reviewPrompt?: ReviewPromptState;
  onReviewPromptClose?: () => void;
  onReviewPromptShowPreset?: () => void;
  onReviewPromptChoosePreset?: (
    preset: Exclude<ReviewPromptStep, "preset"> | "uncommitted"
  ) => void;
  highlightedPresetIndex?: number;
  onReviewPromptHighlightPreset?: (index: number) => void;
  highlightedBranchIndex?: number;
  onReviewPromptHighlightBranch?: (index: number) => void;
  highlightedCommitIndex?: number;
  onReviewPromptHighlightCommit?: (index: number) => void;
  onReviewPromptKeyDown?: (event: {
    key: string;
    shiftKey?: boolean;
    preventDefault: () => void;
  }) => boolean;
  onReviewPromptSelectBranch?: (value: string) => void;
  onReviewPromptSelectBranchAtIndex?: (index: number) => void;
  onReviewPromptConfirmBranch?: () => Promise<void>;
  onReviewPromptSelectCommit?: (sha: string, title: string) => void;
  onReviewPromptSelectCommitAtIndex?: (index: number) => void;
  onReviewPromptConfirmCommit?: () => Promise<void>;
  onReviewPromptUpdateCustomInstructions?: (value: string) => void;
  onReviewPromptConfirmCustom?: () => Promise<void>;
  onFileAutocompleteActiveChange?: (active: boolean) => void;
  pendingUserInputRequest?: RequestUserInputRequest | null;
  pendingUserInputRequestIndex?: number;
  pendingUserInputRequestCount?: number;
  onPendingUserInputSubmit?: (
    request: RequestUserInputRequest,
    response: RequestUserInputResponse
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
  workspaceControls?: ComposerWorkspaceControls | null;
};
