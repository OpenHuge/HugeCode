import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { StatusBadge, type StatusBadgeTone, Text } from "@ku0/design-system";
import { joinClassNames } from "../../../utils/classNames";
import * as styles from "./CoreLoopAdapters.css";

type CoreLoopHeaderProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  as?: ElementType;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  signals?: ReactNode;
  actions?: ReactNode;
};

export function CoreLoopHeader({
  as: Component = "header",
  eyebrow,
  title,
  description,
  signals,
  actions,
  className,
  ...props
}: CoreLoopHeaderProps) {
  return (
    <Component
      className={joinClassNames(styles.header, className)}
      data-core-loop-header="true"
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
      {signals ? <div className={styles.headerSignals}>{signals}</div> : null}
    </Component>
  );
}

type CoreLoopSectionProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  signals?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  bodyClassName?: string;
  framed?: boolean;
};

export function CoreLoopSection({
  title,
  description,
  eyebrow,
  signals,
  actions,
  children,
  className,
  bodyClassName,
  framed = true,
  ...props
}: CoreLoopSectionProps) {
  return (
    <section
      className={joinClassNames(framed ? styles.section : styles.sectionBare, className)}
      data-core-loop-section="true"
      {...props}
    >
      <CoreLoopHeader
        as="div"
        eyebrow={eyebrow}
        title={title}
        description={description}
        signals={signals}
        actions={actions}
      />
      {children ? (
        <div className={joinClassNames(styles.sectionBody, bodyClassName)}>{children}</div>
      ) : null}
    </section>
  );
}

export function CoreLoopMetaRail({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={joinClassNames(styles.metaRail, className)}
      data-core-loop-meta-rail="true"
      {...props}
    >
      {children}
    </div>
  );
}

type CoreLoopStatePanelTone = "default" | "loading" | "warning" | "success";
type CoreLoopStatePanelStep = {
  id: string;
  label: ReactNode;
  detail?: ReactNode;
  badge?: ReactNode;
  tone?: "skills" | "commands" | "mentions" | "queue" | "images";
};

type CoreLoopStatePanelProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  steps?: CoreLoopStatePanelStep[];
  checklistTitle?: ReactNode;
  showStepNumbers?: boolean;
  status?: ReactNode;
  statusTone?: StatusBadgeTone;
  tone?: CoreLoopStatePanelTone;
  compact?: boolean;
};

export function CoreLoopStatePanel({
  eyebrow,
  title,
  description,
  steps,
  checklistTitle = "Next sequence",
  showStepNumbers = true,
  status,
  statusTone = "default",
  tone = "default",
  compact = false,
  className,
  ...props
}: CoreLoopStatePanelProps) {
  const hasAside = Array.isArray(steps) && steps.length > 0;
  const guideMode = !showStepNumbers;

  return (
    <article
      className={joinClassNames(
        styles.statePanel,
        compact ? styles.statePanelCompact : null,
        guideMode ? styles.statePanelGuideMode : null,
        styles.stateTone[tone],
        className
      )}
      data-core-loop-state-panel="true"
      data-core-loop-tone={tone}
      {...props}
    >
      <div className={styles.stateCopy}>
        <CoreLoopHeader
          as="div"
          eyebrow={eyebrow}
          title={title}
          description={description}
          signals={
            status ? (
              <div className={styles.stateStatus}>
                {typeof status === "string" || typeof status === "number" ? (
                  <StatusBadge tone={statusTone}>{status}</StatusBadge>
                ) : (
                  status
                )}
              </div>
            ) : null
          }
        />
      </div>
      {hasAside ? (
        <div
          className={joinClassNames(styles.stateAside, guideMode ? styles.stateAsideGuide : null)}
        >
          {guideMode ? null : (
            <Text as="span" className={styles.stateChecklistTitle} size="micro" tone="faint">
              {checklistTitle}
            </Text>
          )}
          <ol
            className={joinClassNames(
              styles.stateChecklist,
              guideMode ? styles.stateChecklistGuide : null
            )}
          >
            {steps.map((step, index) => (
              <li
                key={step.id}
                className={joinClassNames(
                  styles.stateChecklistItem,
                  guideMode ? styles.stateChecklistItemGuide : null
                )}
                data-step-tone={guideMode ? step.tone : undefined}
              >
                {guideMode ? null : (
                  <span className={styles.stateChecklistIndex}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                )}
                <span className={styles.stateChecklistBody}>
                  {guideMode ? (
                    <span className={styles.stateChecklistGuideChip}>
                      {step.badge ? (
                        <Text
                          as="span"
                          className={styles.stateChecklistBadge}
                          size="fine"
                          tone="strong"
                          monospace
                        >
                          {step.badge}
                        </Text>
                      ) : null}
                      <span className={styles.stateChecklistGuideChipLabel}>{step.label}</span>
                    </span>
                  ) : (
                    <span className={styles.stateChecklistLabel}>{step.label}</span>
                  )}
                  {step.detail ? (
                    <span className={styles.stateChecklistDetail}>{step.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </article>
  );
}
