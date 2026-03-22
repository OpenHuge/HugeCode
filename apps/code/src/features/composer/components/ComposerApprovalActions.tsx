import type { ApprovalRequest } from "../../../types";
import { Button } from "../../../design-system";

type ComposerApprovalActionsProps = {
  request: ApprovalRequest;
  commandTokens: string[] | null;
  onDecision?: (request: ApprovalRequest, decision: "accept" | "decline") => void;
  onRemember?: (request: ApprovalRequest, command: string[]) => void;
};

export function ComposerApprovalActions({
  request,
  commandTokens,
  onDecision,
  onRemember,
}: ComposerApprovalActionsProps) {
  return (
    <>
      {commandTokens && onRemember ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemember(request, commandTokens)}
        >
          Always allow
        </Button>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onDecision?.(request, "decline")}
      >
        Decline
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => onDecision?.(request, "accept")}
      >
        Approve
      </Button>
    </>
  );
}
