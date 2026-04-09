import {
  Button,
  ToastActions,
  ToastBody,
  ToastCard,
  ToastError,
  ToastHeader,
  ToastTitle,
  ToastViewport,
} from "../../../design-system";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import { useEffect, useMemo } from "react";
import type { MissionNavigationTarget } from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import { resolveMissionEntryActionLabel } from "../../missions/utils/missionNavigation";
import type { ApprovalRequest, WorkspaceInfo } from "../../../types";
import { getApprovalCommandInfo } from "../../../utils/approvalRules";
import {
  formatApprovalLabel,
  formatApprovalMethodLabel,
  getApprovalPresentationEntries,
  getApprovalRequestThreadId,
  isApprovalHotkeyAllowed,
  renderApprovalParamValue,
} from "../../messages/utils/approvalPresentation";

type ApprovalToastsProps = {
  approvals: ApprovalRequest[];
  workspaces: WorkspaceInfo[];
  onDecision: (request: ApprovalRequest, decision: "accept" | "decline") => void;
  onRemember?: (request: ApprovalRequest, command: string[]) => void;
  onOpenThread?: (threadId: string) => void;
  onOpenMissionTarget?: (target: MissionNavigationTarget) => void;
  resolveMissionTarget?: (request: ApprovalRequest) => MissionNavigationTarget | null;
  enablePrimaryHotkey?: boolean;
};

export function ApprovalToasts({
  approvals,
  workspaces,
  onDecision,
  onRemember,
  onOpenThread,
  onOpenMissionTarget,
  resolveMissionTarget,
  enablePrimaryHotkey = true,
}: ApprovalToastsProps) {
  const workspaceLabels = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace.name])),
    [workspaces]
  );
  const requestRouting = useMemo(
    () =>
      new Map(
        approvals.map((request) => {
          const threadId = getApprovalRequestThreadId(request);
          const missionTarget = resolveMissionTarget?.(request) ?? null;
          return [
            `${request.workspace_id}:${request.request_id}`,
            {
              threadId,
              missionTarget,
            },
          ];
        })
      ),
    [approvals, resolveMissionTarget]
  );

  const primaryRequest = useMemo(
    () =>
      [...approvals].reverse().find((request) => {
        const routing = requestRouting.get(`${request.workspace_id}:${request.request_id}`);
        const resolvesInActionCenter = Boolean(routing?.missionTarget && onOpenMissionTarget);
        const resolvesInThread = Boolean(
          !resolvesInActionCenter && routing?.threadId && onOpenThread
        );
        return !(resolvesInActionCenter || resolvesInThread);
      }) ?? null,
    [approvals, onOpenMissionTarget, onOpenThread, requestRouting]
  );

  useEffect(() => {
    if (!primaryRequest || !enablePrimaryHotkey) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      if (!isApprovalHotkeyAllowed(event)) {
        return;
      }
      event.preventDefault();
      onDecision(primaryRequest, "accept");
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enablePrimaryHotkey, onDecision, primaryRequest]);

  if (!approvals.length) {
    return null;
  }

  return (
    <ToastViewport className="approval-toasts" role="region" ariaLive="assertive">
      {approvals.map((request) => {
        const workspaceName = workspaceLabels.get(request.workspace_id);
        const params = request.params ?? {};
        const commandInfo = getApprovalCommandInfo(params);
        const routing = requestRouting.get(`${request.workspace_id}:${request.request_id}`);
        const threadId = routing?.threadId ?? null;
        const missionTarget = routing?.missionTarget ?? null;
        const resolveInActionCenter = Boolean(missionTarget && onOpenMissionTarget);
        const resolveInThread = Boolean(!resolveInActionCenter && threadId && onOpenThread);
        const missionActionLabel = missionTarget
          ? resolveMissionEntryActionLabel({
              operatorActionTarget: missionTarget,
            })
          : "Open action center";
        const missionSurfaceLabel = missionTarget?.kind === "review" ? "review" : "action center";
        const entries = getApprovalPresentationEntries(request);
        return (
          <ToastCard
            key={`${request.workspace_id}-${request.request_id}`}
            className="approval-toast"
            role="alert"
          >
            <ToastHeader className="approval-toast-header">
              <div className="approval-toast-headline">
                <div className="approval-toast-icon" aria-hidden>
                  <ShieldAlert size={16} />
                </div>
                <div className="approval-toast-copy">
                  <ToastTitle className="approval-toast-title">
                    {resolveInActionCenter
                      ? `Approval waiting in ${missionSurfaceLabel}`
                      : resolveInThread
                        ? "Approval waiting in thread"
                        : "Approval required"}
                  </ToastTitle>
                  <ToastBody className="approval-toast-subtitle">
                    {resolveInActionCenter
                      ? `Open ${missionSurfaceLabel} to inspect approval context, recovery options, and the next operator action in one place.`
                      : resolveInThread
                        ? "Resolve this request from the thread timeline or composer."
                        : commandInfo
                          ? `Agent wants to run: ${commandInfo.preview}`
                          : "The agent requested a privileged runtime action."}
                  </ToastBody>
                </div>
              </div>
              <div className="approval-toast-meta">
                <div className="approval-toast-method">
                  {formatApprovalMethodLabel(request.method)}
                </div>
                {workspaceName ? (
                  <div className="approval-toast-workspace">{workspaceName}</div>
                ) : null}
                {threadId ? <div className="approval-toast-thread">{threadId}</div> : null}
              </div>
            </ToastHeader>
            <div className="approval-toast-details">
              {entries.length ? (
                entries.map(([key, value]) => {
                  const rendered = renderApprovalParamValue(key, value);
                  return (
                    <div key={key} className="approval-toast-detail">
                      <div className="approval-toast-detail-label">{formatApprovalLabel(key)}</div>
                      {rendered.isCode ? (
                        <ToastError className="approval-toast-detail-code">
                          {rendered.text}
                        </ToastError>
                      ) : (
                        <ToastBody className="approval-toast-detail-value">
                          {rendered.text}
                        </ToastBody>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="approval-toast-detail approval-toast-detail-empty">
                  No extra details.
                </div>
              )}
            </div>
            <ToastActions className="approval-toast-actions">
              {resolveInActionCenter && missionTarget && onOpenMissionTarget ? (
                <Button
                  className="approval-toast-btn approval-toast-btn--open-thread"
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenMissionTarget(missionTarget)}
                >
                  {missionActionLabel}
                </Button>
              ) : null}
              {!resolveInActionCenter && threadId && onOpenThread ? (
                <Button
                  className="approval-toast-btn approval-toast-btn--open-thread"
                  type="button"
                  variant={resolveInThread ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onOpenThread(threadId)}
                >
                  Open thread
                </Button>
              ) : null}
              {!resolveInActionCenter && !resolveInThread && commandInfo && onRemember ? (
                <Button
                  className="approval-toast-btn approval-toast-btn--remember"
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemember(request, commandInfo.tokens)}
                  title={`Allow commands that start with ${commandInfo.preview}`}
                >
                  Always allow
                </Button>
              ) : null}
              {!resolveInActionCenter && !resolveInThread ? (
                <>
                  <Button
                    className="approval-toast-btn approval-toast-btn--decline"
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onDecision(request, "decline")}
                  >
                    Decline
                  </Button>
                  <Button
                    className="approval-toast-btn approval-toast-btn--approve"
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => onDecision(request, "accept")}
                  >
                    Approve{enablePrimaryHotkey && primaryRequest === request ? " (Enter)" : ""}
                  </Button>
                </>
              ) : null}
            </ToastActions>
          </ToastCard>
        );
      })}
    </ToastViewport>
  );
}
