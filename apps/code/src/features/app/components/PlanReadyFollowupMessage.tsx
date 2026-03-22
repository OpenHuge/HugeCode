import ListFilter from "lucide-react/dist/esm/icons/list-filter";
import type { ResolvedPlanArtifact } from "../../messages/utils/planArtifact";
import { Button } from "../../../design-system";
import { TimelineMessageShell } from "../../messages/components/MessageTimelinePanels";
import { requestOpenPlanPanel } from "../../plan/utils/planPanelSurface";

type PlanReadyFollowupMessageProps = {
  artifact: ResolvedPlanArtifact;
  onAccept: () => void;
  interactive?: boolean;
};

export function PlanReadyFollowupMessage({
  artifact,
  onAccept,
  interactive = true,
}: PlanReadyFollowupMessageProps) {
  return (
    <TimelineMessageShell modifierClassName="timeline-plan-card">
      <div className="request-user-input-header">
        <div className="timeline-status-headline">
          <span className="timeline-status-icon" aria-hidden>
            <ListFilter size={16} />
          </span>
          <div className="timeline-status-copy">
            <div className="request-user-input-title">{artifact.title}</div>
            <div className="request-user-input-question-text">
              {interactive
                ? "Review the plan summary here, then implement or request changes from the composer."
                : "This plan is active in the composer below."}
            </div>
          </div>
        </div>
        <div className="timeline-approval-pill">
          {artifact.awaitingFollowup ? "Next step" : "Plan ready"}
        </div>
      </div>
      <div className="request-user-input-body">
        <section className="request-user-input-question">
          <div className="request-user-input-label">Preview</div>
          <div className="request-user-input-question-text">{artifact.preview}</div>
          <div className="request-user-input-empty">
            {interactive
              ? "Use the composer below to request edits without losing your main draft."
              : "Continue in the composer below to request edits or start implementation."}
          </div>
        </section>
      </div>
      <div className="request-user-input-actions">
        <Button type="button" variant="secondary" size="sm" onClick={requestOpenPlanPanel}>
          Open plan panel
        </Button>
        {interactive ? (
          <Button variant="primary" size="sm" onClick={onAccept}>
            Implement plan
          </Button>
        ) : null}
      </div>
    </TimelineMessageShell>
  );
}
