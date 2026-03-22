import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import { useEffect, useMemo } from "react";
import { Button } from "../../../design-system";
import type { ApprovalRequest } from "../../../types";
import { getApprovalCommandInfo } from "../../../utils/approvalRules";
import {
  formatApprovalLabel,
  formatApprovalMethodLabel,
  getApprovalPresentationEntries,
  isApprovalHotkeyAllowed,
  renderApprovalParamValue,
} from "../utils/approvalPresentation";
import { TimelineMessageShell } from "./MessageTimelinePanels";

export function TimelineApprovalPanel({
  request,
  onDecision,
  onRemember,
  isPrimary,
  enablePrimaryHotkey = true,
  interactive = true,
}: {
  request: ApprovalRequest;
  onDecision: (request: ApprovalRequest, decision: "accept" | "decline") => void;
  onRemember?: (request: ApprovalRequest, command: string[]) => void;
  isPrimary?: boolean;
  enablePrimaryHotkey?: boolean;
  interactive?: boolean;
}) {
  const commandInfo = useMemo(() => getApprovalCommandInfo(request.params), [request.params]);
  const entries = useMemo(() => getApprovalPresentationEntries(request), [request]);

  useEffect(() => {
    if (!interactive || !isPrimary || !enablePrimaryHotkey) {
      return;
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!isApprovalHotkeyAllowed(event)) {
        return;
      }
      event.preventDefault();
      onDecision(request, "accept");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enablePrimaryHotkey, interactive, isPrimary, onDecision, request]);

  return (
    <TimelineMessageShell modifierClassName="timeline-approval-card">
      <div className="request-user-input-header">
        <div className="timeline-status-headline">
          <span className="timeline-status-icon" aria-hidden>
            <ShieldAlert size={16} />
          </span>
          <div className="timeline-status-copy">
            <div className="request-user-input-title">Approval required</div>
            <div className="request-user-input-question-text">
              {interactive
                ? commandInfo
                  ? `Agent wants to run: ${commandInfo.preview}`
                  : "The agent requested a privileged runtime action."
                : "This approval is active in the composer below."}
            </div>
          </div>
        </div>
        <div className="timeline-approval-pill">{formatApprovalMethodLabel(request.method)}</div>
      </div>
      {entries.length ? (
        <div className="timeline-approval-grid">
          {entries.map(([key, value]) => {
            const rendered = renderApprovalParamValue(key, value);
            return (
              <div key={key} className="timeline-approval-detail">
                <div className="timeline-approval-detail-label">{formatApprovalLabel(key)}</div>
                <div
                  className={
                    rendered.isCode
                      ? "timeline-approval-detail-value timeline-approval-detail-value--code"
                      : "timeline-approval-detail-value"
                  }
                >
                  {rendered.text}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {interactive ? (
        <div className="request-user-input-actions">
          {commandInfo && onRemember ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemember(request, commandInfo.tokens)}
            >
              Always allow
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onDecision(request, "decline")}
          >
            Decline
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => onDecision(request, "accept")}
          >
            Approve{isPrimary && enablePrimaryHotkey ? " (Enter)" : ""}
          </Button>
        </div>
      ) : null}
    </TimelineMessageShell>
  );
}
