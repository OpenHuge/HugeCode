import type { HTMLAttributes } from "react";
import type { GovernedGitHubFollowUpPreview as GovernedGitHubFollowUpPreviewModel } from "../../../application/runtime/facades/githubSourceLaunchPreview";
import { MetadataList, MetadataRow, StatusBadge, Surface, Text } from "../../../design-system";
import { joinClassNames } from "../../../utils/classNames";
import * as styles from "./GitHubFollowUpPreview.styles.css";

type GitHubFollowUpPreviewProps = HTMLAttributes<HTMLElement> & {
  preview: GovernedGitHubFollowUpPreviewModel;
};

function resolvePreviewTone(state: GovernedGitHubFollowUpPreviewModel["state"]) {
  return state === "ready" ? "success" : "warning";
}

function resolvePreviewStateLabel(state: GovernedGitHubFollowUpPreviewModel["state"]) {
  return state === "ready" ? "Ready" : "Blocked";
}

export function GitHubFollowUpPreview({
  preview,
  className,
  ...props
}: GitHubFollowUpPreviewProps) {
  return (
    <Surface
      {...props}
      className={joinClassNames(styles.root, className)}
      tone="subtle"
      depth="card"
      padding="md"
      data-preview-state={preview.state}
    >
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <Text as="div" className={styles.title} size="meta" tone="strong" weight="semibold">
            {preview.title}
          </Text>
          <Text as="div" className={styles.summary} size="fine" tone="muted">
            {preview.summary}
          </Text>
        </div>
        <StatusBadge tone={resolvePreviewTone(preview.state)}>
          {resolvePreviewStateLabel(preview.state)}
        </StatusBadge>
      </div>
      {preview.blockedReason ? (
        <Text as="div" className={styles.blockedReason} size="fine">
          {preview.blockedReason}
        </Text>
      ) : null}
      <MetadataList className={styles.fieldList}>
        {preview.fields.map((field) => (
          <div key={field.id} className={styles.field}>
            <MetadataRow label={field.label} value={field.value} />
            {field.detail ? (
              <Text as="div" className={styles.fieldDetail} size="fine" tone="muted">
                {field.detail}
              </Text>
            ) : null}
          </div>
        ))}
      </MetadataList>
    </Surface>
  );
}
