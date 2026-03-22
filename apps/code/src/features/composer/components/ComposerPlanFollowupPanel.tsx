import type { ResolvedPlanArtifact } from "../../messages/utils/planArtifact";
import { ComposerResolverPanel } from "./ComposerResolverPanel";
import * as styles from "./ComposerPlanFollowupPanel.css";

type ComposerPlanFollowupPanelProps = {
  artifact: ResolvedPlanArtifact;
  changeRequest: string;
  onChangeRequest: (value: string) => void;
};

export function ComposerPlanFollowupPanel({
  artifact,
  changeRequest,
  onChangeRequest,
}: ComposerPlanFollowupPanelProps) {
  const previewLines = artifact.preview
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <ComposerResolverPanel
      ariaLabel="Pending plan follow-up"
      header={
        <div className={styles.progressRow}>
          <span className={styles.progressBadge}>Plan ready</span>
          <span className={styles.statusPill}>Next step</span>
        </div>
      }
      title={artifact.title}
      titleClassName={styles.title}
      helper="Keep plan review in the composer so the timeline and action surface stay aligned."
      helperClassName={styles.helper}
      footer="The main composer draft below stays untouched while you review the plan."
      footerClassName={styles.footerNote}
    >
      <div className={styles.preview} aria-label="Plan preview">
        {previewLines.map((line, index) => {
          const isNote = /^note:/i.test(line);
          return (
            <div
              key={`${index}-${line}`}
              className={isNote ? styles.previewNote : styles.previewLine}
              data-testid="plan-preview-line"
            >
              {line}
            </div>
          );
        })}
      </div>
      <textarea
        className={styles.textarea}
        aria-label="Plan change request"
        placeholder="Describe what you want to change in the plan..."
        value={changeRequest}
        onChange={(event) => onChangeRequest(event.target.value)}
        rows={3}
      />
    </ComposerResolverPanel>
  );
}
