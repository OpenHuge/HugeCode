import type { ReactNode } from "react";
import { Badge } from "../../design-system";
import { getDiffStatusBadgeTone, getDiffStatusLabel } from "../git/components/GitDiffPanel.utils";
import type { RightPanelDiffFile } from "./rightPanelModels";
import {
  CollapsibleSection,
  DetailHero,
  InspectorSectionBody,
  InspectorSectionGroup,
} from "./RightPanelPrimitives";
import * as styles from "./RightPanelPrimitives.css";

export function ArtifactSummaryBlock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <InspectorSectionGroup>
      <DetailHero title={title} subtitle={subtitle} />
      <InspectorSectionBody>{children}</InspectorSectionBody>
    </InspectorSectionGroup>
  );
}

export function DiffSummaryBlock({ files, diff }: { files: RightPanelDiffFile[]; diff: string }) {
  return (
    <CollapsibleSection
      title="Diff summary"
      subtitle={files.length > 0 ? `${files.length} changed files` : "No changed file summary"}
      defaultOpen
    >
      <div className={styles.diffList}>
        {files.map((file) => (
          <div key={`${file.status}-${file.path}`} className={styles.diffRow}>
            <Badge
              className={styles.diffStatusBadge}
              tone={getDiffStatusBadgeTone(file.status)}
              shape="chip"
              size="md"
            >
              {getDiffStatusLabel(file.status)}
            </Badge>
            <span className={styles.metadataValue}>{file.path}</span>
          </div>
        ))}
      </div>
      <pre className={styles.preformattedBlock}>{diff}</pre>
    </CollapsibleSection>
  );
}

export function LogSnippetBlock({ title, content }: { title?: string; content: string }) {
  return (
    <CollapsibleSection title={title ?? "Log snippet"} defaultOpen={false}>
      <pre className={styles.logBlock}>{content}</pre>
    </CollapsibleSection>
  );
}

export function AgentStepSummaryBlock({
  title,
  subtitle,
  metrics,
}: {
  title: string;
  subtitle?: string;
  metrics?: Array<{ label: string; value: string }>;
}) {
  return <DetailHero title={title} subtitle={subtitle} metrics={metrics} />;
}
