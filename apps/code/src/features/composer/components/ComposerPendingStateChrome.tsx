import { requestOpenPlanPanel } from "../../plan/utils/planPanelSurface";
import type {
  ApprovalRequest,
  DynamicToolCallRequest,
  RequestUserInputQuestion,
} from "../../../types";
import { Button } from "../../../design-system";
import type { ResolvedPlanArtifact } from "../../messages/utils/planArtifact";
import { ComposerApprovalActions } from "./ComposerApprovalActions";
import { ComposerApprovalPanel } from "./ComposerApprovalPanel";
import { ComposerPlanFollowupPanel } from "./ComposerPlanFollowupPanel";
import { ComposerPendingUserInputPanel } from "./ComposerPendingUserInputPanel";
import { ComposerToolCallRequestPanel } from "./ComposerToolCallRequestPanel";

type ComposerPendingStateChromeProps = {
  pendingUserInputActive: boolean;
  activePendingQuestion: RequestUserInputQuestion | null;
  pendingUserInputRequestIndex: number;
  pendingUserInputRequestCount: number;
  pendingQuestionIndex: number;
  pendingQuestions: RequestUserInputQuestion[];
  activePendingSelectedIndex: number | null;
  onSelectPendingOption: (index: number) => void;
  onPendingPrevious: () => void;
  onPendingAdvance: () => void;
  pendingApprovalActive: boolean;
  pendingApprovalRequest: ApprovalRequest | null;
  pendingApprovalCommandTokens: string[] | null;
  onPendingApprovalDecision?: (request: ApprovalRequest, decision: "accept" | "decline") => void;
  onPendingApprovalRemember?: (request: ApprovalRequest, command: string[]) => void;
  pendingToolCallActive: boolean;
  pendingToolCallRequest: DynamicToolCallRequest | null;
  pendingToolCallOutput: string;
  pendingToolCallSuccess: boolean;
  onPendingToolCallOutputChange: (value: string) => void;
  onPendingToolCallSuccessChange: (value: boolean) => void;
  onPendingToolCallSubmit: () => void;
  pendingPlanReviewActive: boolean;
  pendingPlanFollowup: ResolvedPlanArtifact | null;
  pendingPlanChanges: string;
  onPendingPlanChangesChange: (value: string) => void;
  onPendingPlanAccept: () => void;
  onPendingPlanSubmitChanges: () => void;
};

export function ComposerPendingTopContent({
  pendingUserInputActive,
  activePendingQuestion,
  pendingUserInputRequestIndex,
  pendingUserInputRequestCount,
  pendingQuestionIndex,
  pendingQuestions,
  activePendingSelectedIndex,
  onSelectPendingOption,
  pendingApprovalActive,
  pendingApprovalRequest,
  pendingToolCallActive,
  pendingToolCallRequest,
  pendingToolCallOutput,
  pendingToolCallSuccess,
  onPendingToolCallOutputChange,
  onPendingToolCallSuccessChange,
  pendingPlanReviewActive,
  pendingPlanFollowup,
  pendingPlanChanges,
  onPendingPlanChangesChange,
}: ComposerPendingStateChromeProps) {
  if (pendingUserInputActive && activePendingQuestion) {
    return (
      <ComposerPendingUserInputPanel
        requestIndex={pendingUserInputRequestIndex}
        requestCount={pendingUserInputRequestCount}
        question={activePendingQuestion}
        questionIndex={pendingQuestionIndex}
        questionCount={pendingQuestions.length}
        selectedIndex={activePendingSelectedIndex}
        onSelectOption={onSelectPendingOption}
      />
    );
  }

  if (pendingApprovalActive && pendingApprovalRequest) {
    return <ComposerApprovalPanel request={pendingApprovalRequest} />;
  }

  if (pendingToolCallActive && pendingToolCallRequest) {
    return (
      <ComposerToolCallRequestPanel
        toolName={pendingToolCallRequest.params.tool}
        callId={pendingToolCallRequest.params.call_id}
        argumentsValue={pendingToolCallRequest.params.arguments}
        outputText={pendingToolCallOutput}
        success={pendingToolCallSuccess}
        onOutputChange={onPendingToolCallOutputChange}
        onSuccessChange={onPendingToolCallSuccessChange}
      />
    );
  }

  if (pendingPlanReviewActive && pendingPlanFollowup) {
    return (
      <ComposerPlanFollowupPanel
        artifact={pendingPlanFollowup}
        changeRequest={pendingPlanChanges}
        onChangeRequest={onPendingPlanChangesChange}
      />
    );
  }

  return null;
}

export function ComposerPendingFooterActions({
  pendingUserInputActive,
  activePendingQuestion,
  pendingQuestionIndex,
  pendingQuestions,
  onPendingPrevious,
  onPendingAdvance,
  pendingApprovalActive,
  pendingApprovalRequest,
  pendingApprovalCommandTokens,
  onPendingApprovalDecision,
  onPendingApprovalRemember,
  pendingToolCallActive,
  onPendingToolCallSubmit,
  pendingPlanReviewActive,
  pendingPlanChanges,
  onPendingPlanAccept,
  onPendingPlanSubmitChanges,
}: ComposerPendingStateChromeProps) {
  if (pendingUserInputActive && activePendingQuestion) {
    return (
      <>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onPendingPrevious}
          disabled={pendingQuestionIndex === 0}
        >
          Previous
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={onPendingAdvance}>
          {pendingQuestionIndex + 1 < pendingQuestions.length ? "Next question" : "Submit answers"}
        </Button>
      </>
    );
  }

  if (pendingApprovalActive && pendingApprovalRequest && onPendingApprovalDecision) {
    return (
      <ComposerApprovalActions
        request={pendingApprovalRequest}
        commandTokens={pendingApprovalCommandTokens}
        onDecision={onPendingApprovalDecision}
        onRemember={onPendingApprovalRemember}
      />
    );
  }

  if (pendingToolCallActive) {
    return (
      <Button type="button" variant="primary" size="sm" onClick={onPendingToolCallSubmit}>
        Submit output
      </Button>
    );
  }

  if (pendingPlanReviewActive) {
    const hasPlanChanges = pendingPlanChanges.trim().length > 0;
    return (
      <>
        <Button type="button" variant="ghost" size="sm" onClick={requestOpenPlanPanel}>
          Open plan panel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={hasPlanChanges ? onPendingPlanSubmitChanges : onPendingPlanAccept}
        >
          {hasPlanChanges ? "Refine plan" : "Implement plan"}
        </Button>
      </>
    );
  }

  return null;
}
