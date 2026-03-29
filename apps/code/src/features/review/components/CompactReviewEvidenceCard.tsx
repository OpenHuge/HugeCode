import { CardDescription, CardTitle, StatusBadge } from "../../../design-system";
import { joinClassNames } from "../../../utils/classNames";
import type { CompactReviewEvidenceDescriptor } from "../utils/compactReviewEvidence";
import * as styles from "./CompactReviewEvidenceCard.css";

type CompactReviewEvidenceCardProps = {
  descriptor: CompactReviewEvidenceDescriptor;
  density?: "compact" | "full";
  testId?: string;
};

export function CompactReviewEvidenceCard({
  descriptor,
  density = "full",
  testId,
}: CompactReviewEvidenceCardProps) {
  const compact = density === "compact";

  return (
    <section
      className={joinClassNames(styles.card, compact ? styles.cardCompact : undefined)}
      data-testid={testId}
    >
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <CardTitle className={styles.title}>Quick decision evidence</CardTitle>
          <CardDescription className={styles.description}>{descriptor.summary}</CardDescription>
        </div>
        {descriptor.badges.length > 0 ? (
          <div className={styles.badgeRow}>
            {descriptor.badges.map((badge) => (
              <StatusBadge key={badge.id} tone={badge.tone}>
                {badge.label}
              </StatusBadge>
            ))}
          </div>
        ) : null}
      </div>
      <div
        className={joinClassNames(styles.fieldGrid, compact ? styles.fieldGridCompact : undefined)}
      >
        {descriptor.fields.map((field) => (
          <div key={field.id} className={styles.field}>
            <span className={styles.fieldLabel}>{field.label}</span>
            <span className={styles.fieldValue}>{field.value}</span>
            {field.detail ? <span className={styles.fieldDetail}>{field.detail}</span> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
