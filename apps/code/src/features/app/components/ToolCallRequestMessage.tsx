import TerminalSquare from "lucide-react/dist/esm/icons/terminal-square";
import { useEffect, useId, useMemo, useState } from "react";
import type { DynamicToolCallRequest, DynamicToolCallResponse } from "../../../types";
import { Button, Textarea } from "../../../design-system";
import { TimelineMessageShell } from "../../messages/components/MessageTimelinePanels";

type ToolCallRequestMessageProps = {
  requests: DynamicToolCallRequest[];
  activeThreadId: string | null;
  activeWorkspaceId?: string | null;
  onSubmit: (request: DynamicToolCallRequest, response: DynamicToolCallResponse) => void;
  interactive?: boolean;
};

function formatArguments(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

export function ToolCallRequestMessage({
  requests,
  activeThreadId,
  activeWorkspaceId,
  onSubmit,
  interactive = true,
}: ToolCallRequestMessageProps) {
  const activeRequests = useMemo(
    () =>
      requests.filter((request) => {
        if (!activeThreadId) {
          return false;
        }
        if (request.params.thread_id !== activeThreadId) {
          return false;
        }
        if (activeWorkspaceId && request.workspace_id !== activeWorkspaceId) {
          return false;
        }
        return true;
      }),
    [requests, activeThreadId, activeWorkspaceId]
  );
  const activeRequest = activeRequests[0];
  const [textOutput, setTextOutput] = useState("");
  const [success, setSuccess] = useState(true);
  const successInputId = useId();
  const successLabelId = `${successInputId}-label`;
  const successDescriptionId = `${successInputId}-description`;

  useEffect(() => {
    if (!activeRequest) {
      setTextOutput("");
      setSuccess(true);
      return;
    }
    setTextOutput("");
    setSuccess(true);
  }, [activeRequest]);

  if (!activeRequest) {
    return null;
  }

  const totalRequests = activeRequests.length;
  const args = formatArguments(activeRequest.params.arguments);
  const handleSubmit = () => {
    const trimmed = textOutput.trim();
    onSubmit(activeRequest, {
      contentItems: trimmed ? [{ type: "inputText", text: trimmed }] : [],
      success,
    });
  };

  return (
    <TimelineMessageShell modifierClassName="timeline-tool-call-card">
      <div className="request-user-input-header">
        <div className="timeline-status-headline">
          <span className="timeline-status-icon" aria-hidden>
            <TerminalSquare size={16} />
          </span>
          <div className="timeline-status-copy">
            <div className="request-user-input-title">Tool call requested</div>
            <div className="request-user-input-question-text">
              {interactive
                ? "Return output for this tool call, or mark it failed to stop the turn cleanly."
                : "This tool call is active in the composer below."}
            </div>
          </div>
        </div>
        <div className="timeline-approval-pill">
          {totalRequests > 1 ? `Request 1 of ${totalRequests}` : activeRequest.params.tool}
        </div>
      </div>
      <div className="request-user-input-body">
        <section className="request-user-input-question">
          <div className="timeline-approval-grid">
            <div className="timeline-approval-detail">
              <div className="timeline-approval-detail-label">Tool</div>
              <div className="timeline-approval-detail-value">{activeRequest.params.tool}</div>
            </div>
            <div className="timeline-approval-detail">
              <div className="timeline-approval-detail-label">Call ID</div>
              <div className="timeline-approval-detail-value timeline-approval-detail-value--code">
                {activeRequest.params.call_id}
              </div>
            </div>
          </div>
          <pre className="request-user-input-notes">{args}</pre>
          {interactive ? (
            <>
              <Textarea
                className="request-user-input-notes"
                aria-label="Tool call output"
                placeholder="Tool output text"
                value={textOutput}
                onChange={(event) => setTextOutput(event.target.value)}
                rows={4}
              />
              <label className="request-user-input-option">
                <input
                  id={successInputId}
                  className="request-user-input-option-control"
                  type="checkbox"
                  aria-labelledby={successLabelId}
                  aria-describedby={successDescriptionId}
                  checked={success}
                  onChange={(event) => setSuccess(event.target.checked)}
                />
                <span className="request-user-input-option-index" aria-hidden>
                  OK
                </span>
                <div className="request-user-input-option-main">
                  <div id={successLabelId} className="request-user-input-option-label">
                    Mark call successful
                  </div>
                  <div id={successDescriptionId} className="request-user-input-option-description">
                    Uncheck this if the tool failed or should return an error outcome.
                  </div>
                </div>
              </label>
            </>
          ) : null}
        </section>
      </div>
      {interactive ? (
        <div className="request-user-input-actions">
          <Button variant="primary" size="sm" onClick={handleSubmit}>
            Submit output
          </Button>
        </div>
      ) : null}
    </TimelineMessageShell>
  );
}
