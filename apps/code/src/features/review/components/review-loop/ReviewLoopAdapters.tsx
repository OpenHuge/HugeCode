import type { HTMLAttributes, ReactNode } from "react";
import { SectionHeader, Text } from "@ku0/design-system";
import { joinClassNames } from "../../../../utils/classNames";
import * as styles from "./ReviewLoopAdapters.css";

type ReviewLoopHeaderProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  signals?: ReactNode;
  actions?: ReactNode;
};

export function ReviewLoopHeader({
  eyebrow,
  title,
  description,
  signals,
  actions,
  className,
  ...props
}: ReviewLoopHeaderProps) {
  return (
    <header
      className={joinClassNames(styles.header, className)}
      data-review-loop-header="true"
      {...props}
    >
      <div className={styles.headerTopRow}>
        <div className={styles.headerCopy}>
          {eyebrow ? (
            <Text as="span" className={styles.headerEyebrow} size="micro" tone="faint">
              {eyebrow}
            </Text>
          ) : null}
          <Text as="h2" className={styles.headerTitle} size="title" tone="strong" weight="semibold">
            {title}
          </Text>
          {description ? (
            <Text as="p" className={styles.headerDescription} size="meta" tone="muted">
              {description}
            </Text>
          ) : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      {signals ? (
        <div className={styles.headerSignals} data-review-loop-signals="true">
          {signals}
        </div>
      ) : null}
    </header>
  );
}

type ReviewLoopSectionProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  bodyClassName?: string;
  framed?: boolean;
};

export function ReviewLoopSection({
  title,
  description,
  meta,
  actions,
  children,
  className,
  bodyClassName,
  framed = true,
  ...props
}: ReviewLoopSectionProps) {
  return (
    <section
      className={joinClassNames(framed ? styles.section : styles.sectionBare, className)}
      data-review-loop-section="true"
      {...props}
    >
      <SectionHeader className={styles.sectionHeader} title={title} meta={meta} actions={actions} />
      {description ? (
        <Text as="p" className={styles.sectionDescription} size="fine" tone="muted">
          {description}
        </Text>
      ) : null}
      {children ? (
        <div className={joinClassNames(styles.sectionBody, bodyClassName)}>{children}</div>
      ) : null}
    </section>
  );
}

export function ReviewSignalGroup({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={joinClassNames(styles.signalGroup, className)}
      data-review-loop-signals="true"
      {...props}
    >
      {children}
    </div>
  );
}

type ReviewSummaryCardTone = "default" | "attention" | "success";

type ReviewSummaryCardProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: ReviewSummaryCardTone;
};

export function ReviewSummaryCard({
  label,
  value,
  detail,
  tone = "default",
  className,
  ...props
}: ReviewSummaryCardProps) {
  return (
    <div
      className={joinClassNames(styles.summaryCard, className)}
      data-review-summary-card="true"
      data-review-summary-tone={tone}
      data-testid="review-summary-card"
      {...props}
    >
      <Text as="span" className={styles.summaryLabel} size="micro" tone="faint">
        {label}
      </Text>
      <Text as="span" className={styles.summaryValue} size="title" tone="strong" weight="semibold">
        {value}
      </Text>
      {detail ? (
        <Text as="span" className={styles.summaryDetail} size="fine" tone="muted">
          {detail}
        </Text>
      ) : null}
    </div>
  );
}

export function ReviewActionRail({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={joinClassNames(styles.actionRail, className)}
      data-review-action-rail="true"
      {...props}
    >
      {children}
    </div>
  );
}

type ReviewEvidenceListItem = {
  id: string;
  label: ReactNode;
  detail: ReactNode;
};

type ReviewEvidenceListProps = HTMLAttributes<HTMLUListElement> & {
  items: ReviewEvidenceListItem[];
};

export function ReviewEvidenceList({ items, className, ...props }: ReviewEvidenceListProps) {
  return (
    <ul
      className={joinClassNames(styles.evidenceList, className)}
      data-review-evidence-list="true"
      {...props}
    >
      {items.map((item) => (
        <li key={item.id} className={styles.evidenceItem}>
          <Text as="span" className={styles.evidenceLabel} size="fine" tone="faint">
            {item.label}
          </Text>
          <Text as="span" className={styles.evidenceDetail} size="meta" tone="strong">
            {item.detail}
          </Text>
        </li>
      ))}
    </ul>
  );
}
