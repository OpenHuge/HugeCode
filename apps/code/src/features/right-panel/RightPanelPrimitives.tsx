import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Copy from "lucide-react/dist/esm/icons/copy";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Button, EmptyState, ReviewLoopSection, Text } from "../../design-system";
import { joinClassNames } from "../../utils/classNames";
import * as styles from "./RightPanelPrimitives.css";

export function RightPanelShell({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={joinClassNames(styles.shell, className)}>
      {children}
    </div>
  );
}

type RightPanelHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
};

export function RightPanelHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  toolbar,
}: RightPanelHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerTopRow}>
        <div className={styles.headerCopy}>
          {eyebrow ? (
            <Text
              as="span"
              className={styles.eyebrow}
              size="micro"
              tone="muted"
              weight="semibold"
              transform="uppercase"
            >
              {eyebrow}
            </Text>
          ) : null}
          <Text as="span" className={styles.title} size="meta" tone="strong" weight="semibold">
            {title}
          </Text>
          {subtitle ? (
            <Text as="span" className={styles.subtitle} size="fine" tone="muted">
              {subtitle}
            </Text>
          ) : null}
        </div>
        {actions ? <div className={styles.headerActions}>{actions}</div> : null}
      </div>
      {toolbar ? <div className={styles.toolbar}>{toolbar}</div> : null}
    </header>
  );
}

export function RightPanelBody({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={joinClassNames(styles.body, className)}>
      <div className={styles.bodyInner}>{children}</div>
    </div>
  );
}

export function RightPanelTopBar({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={joinClassNames(styles.topBar, className)}>
      {children}
    </div>
  );
}

export function RightPanelResizeHandle({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={joinClassNames(styles.resizeHandle, className)} {...props} />
  );
}

type RightPanelEmptyStateProps = {
  title: ReactNode;
  body: ReactNode;
  actions?: ReactNode;
};

export function RightPanelEmptyState({ title, body, actions }: RightPanelEmptyStateProps) {
  return (
    <EmptyState
      className={styles.emptyState}
      title={title}
      description={body}
      actions={actions ? <div className={styles.emptyStateActions}>{actions}</div> : null}
    />
  );
}

export function InspectorSection({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section {...props} className={joinClassNames(styles.section, className)}>
      {children}
    </section>
  );
}

type InspectorSectionHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export function InspectorSectionHeader({ title, subtitle, actions }: InspectorSectionHeaderProps) {
  return (
    <ReviewLoopSection
      className={styles.sectionHeader}
      framed={false}
      title={title}
      description={subtitle}
      actions={actions}
    />
  );
}

export function InspectorSectionBody({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={joinClassNames(styles.sectionBody, className)}>
      {children}
    </div>
  );
}

export function InspectorSectionGroup({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={joinClassNames(styles.sectionGroup, className)}>
      {children}
    </div>
  );
}

export function RightRailSection({
  children,
  className,
  section,
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  section: "interrupt" | "artifact" | "detail";
}) {
  return (
    <section
      {...props}
      className={joinClassNames(styles.railSection, className)}
      data-rail-section={section}
    >
      {children}
    </section>
  );
}

export function StickySectionActions({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={joinClassNames(styles.stickySectionActions, className)}>
      {children}
    </div>
  );
}

export function PropertyGrid({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={joinClassNames(styles.propertyGrid, className)}>
      {children}
    </div>
  );
}

type KeyValueRowProps = {
  label: ReactNode;
  value: ReactNode;
};

export function KeyValueRow({ label, value }: KeyValueRowProps) {
  return (
    <div className={styles.keyValueRow}>
      <Text
        as="div"
        className={styles.metadataLabel}
        size="fine"
        tone="muted"
        weight="medium"
        transform="uppercase"
      >
        {label}
      </Text>
      <Text as="div" className={styles.metadataValue} size="meta" tone="strong">
        {value}
      </Text>
    </div>
  );
}

type DetailHeroProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  metrics?: Array<{ label: ReactNode; value: ReactNode }>;
  actions?: ReactNode;
};

export function DetailHero({ eyebrow, title, subtitle, metrics, actions }: DetailHeroProps) {
  return (
    <div className={styles.detailHero}>
      <div className={styles.detailHeroCopy}>
        {eyebrow ? (
          <Text
            as="span"
            className={styles.eyebrow}
            size="micro"
            tone="muted"
            weight="semibold"
            transform="uppercase"
          >
            {eyebrow}
          </Text>
        ) : null}
        <div className={styles.detailHeroTitleRow}>
          <Text as="span" className={styles.detailHeroTitle} size="ui" tone="strong" weight="bold">
            {title}
          </Text>
          {actions}
        </div>
        {subtitle ? (
          <Text as="span" className={styles.detailHeroSubtitle} size="fine" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </div>
      {metrics && metrics.length > 0 ? (
        <PropertyGrid>
          {metrics.map((entry) => (
            <KeyValueRow key={String(entry.label)} label={entry.label} value={entry.value} />
          ))}
        </PropertyGrid>
      ) : null}
    </div>
  );
}

export function NarrativeBlock({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={joinClassNames(styles.narrativeBlock, className)}>
      {children}
    </div>
  );
}

export function EvidenceList({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={joinClassNames(styles.evidenceList, className)}>
      {children}
    </div>
  );
}

type EvidenceRowProps = {
  label: ReactNode;
  value: ReactNode;
  aside?: ReactNode;
};

export function EvidenceRow({ label, value, aside }: EvidenceRowProps) {
  return (
    <div className={styles.evidenceRow}>
      <div className={styles.evidenceRowHeader}>
        <Text
          as="span"
          className={styles.evidenceLabel}
          size="fine"
          tone="muted"
          weight="bold"
          transform="uppercase"
        >
          {label}
        </Text>
        {aside}
      </div>
      <Text as="div" className={styles.evidenceValue} size="meta" tone="strong">
        {value}
      </Text>
    </div>
  );
}

export function ChipList({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={joinClassNames(styles.chipList, className)}>
      {children}
    </div>
  );
}

export function Chip({ children, className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <Text
      as="span"
      {...props}
      className={joinClassNames(styles.chip, className)}
      size="fine"
      tone="strong"
    >
      {children}
    </Text>
  );
}

type CopyableFieldProps = {
  value: string;
  label?: ReactNode;
};

export function CopyableField({ value, label }: CopyableFieldProps) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
  };

  return (
    <div className={styles.copyableField}>
      <div className={styles.inlineActionCopy}>
        {label ? (
          <Text
            as="div"
            className={styles.metadataLabel}
            size="fine"
            tone="muted"
            weight="medium"
            transform="uppercase"
          >
            {label}
          </Text>
        ) : null}
        <Text as="div" className={styles.copyableValue} size="meta" tone="strong" monospace>
          {value}
        </Text>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={() => void handleCopy()}>
        <Copy size={14} aria-hidden />
        Copy
      </Button>
    </div>
  );
}

export function PanelActionBar({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={joinClassNames(styles.panelActionBar, className)}>
      {children}
    </div>
  );
}

export function PanelToolbarButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={joinClassNames(styles.toolbarButton, className)}
      {...props}
    >
      {children}
    </Button>
  );
}

type CollapsibleSectionProps = {
  storageKey?: string;
  defaultOpen?: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export function CollapsibleSection({
  storageKey,
  defaultOpen = true,
  title,
  subtitle,
  actions,
  children,
}: CollapsibleSectionProps) {
  const initialOpen = useMemo(() => {
    if (!storageKey || typeof window === "undefined") {
      return defaultOpen;
    }
    const stored = window.localStorage.getItem(storageKey);
    return stored == null ? defaultOpen : stored === "true";
  }, [defaultOpen, storageKey]);
  const [open, setOpen] = useState(initialOpen);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      if (storageKey) {
        window.localStorage.setItem(storageKey, String(next));
      }
      return next;
    });
  };

  return (
    <InspectorSectionGroup>
      <InspectorSectionHeader
        title={title}
        subtitle={subtitle}
        actions={
          <PanelActionBar>
            {actions}
            <PanelToolbarButton
              aria-expanded={open}
              aria-label={open ? "Collapse section" : "Expand section"}
              onClick={toggle}
            >
              <ChevronDown size={14} aria-hidden className={styles.toolbarButtonIcon} />
              {open ? "Hide" : "Show"}
            </PanelToolbarButton>
          </PanelActionBar>
        }
      />
      {open ? <InspectorSectionBody>{children}</InspectorSectionBody> : null}
    </InspectorSectionGroup>
  );
}
