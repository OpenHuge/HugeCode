import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "./classNames";
import { EmptyState } from "./EmptyState";
import { SectionHeader } from "./SectionHeader";
import { Surface, type SurfaceProps } from "./Surface";
import { Text } from "./Text";
import * as styles from "./Shell.css";

type ShellTone = NonNullable<SurfaceProps["tone"]>;
type ShellPadding = NonNullable<SurfaceProps["padding"]>;
type ShellDepth = NonNullable<SurfaceProps["depth"]>;

export interface ShellFrameProps extends Omit<SurfaceProps, "tone" | "padding"> {
  tone?: ShellTone;
  padding?: ShellPadding;
  depth?: ShellDepth;
}

export const ShellFrame = forwardRef<HTMLElement, ShellFrameProps>(function ShellFrame(
  { className, depth, padding = "none", tone = "ghost", ...props },
  ref
) {
  return (
    <Surface
      {...props}
      ref={ref}
      className={cx(styles.frame, className)}
      depth={depth}
      padding={padding}
      tone={tone}
      data-shell-frame="true"
    />
  );
});

export interface ShellSectionProps extends Omit<HTMLAttributes<HTMLElement>, "children" | "title"> {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  tone?: ShellTone;
  padding?: ShellPadding;
  depth?: ShellDepth;
  testId?: string;
  headerClassName?: string;
  titleClassName?: string;
  bodyClassName?: string;
}

export function ShellSection({
  actions,
  bodyClassName,
  children,
  className,
  depth,
  headerClassName,
  meta,
  padding = "md",
  testId,
  title,
  titleClassName,
  tone = "translucent",
  ...props
}: ShellSectionProps) {
  return (
    <Surface
      {...props}
      className={cx(styles.section, className)}
      depth={depth}
      padding={padding}
      tone={tone}
      data-shell-section="true"
      data-testid={testId}
    >
      <div className={cx(styles.sectionHeader, headerClassName)} data-shell-slot="header">
        <SectionHeader
          title={title}
          meta={meta}
          actions={actions}
          titleClassName={titleClassName}
        />
      </div>
      <div className={cx(styles.sectionBody, bodyClassName)} data-shell-slot="body">
        {children}
      </div>
    </Surface>
  );
}

export interface ShellToolbarProps extends HTMLAttributes<HTMLDivElement> {
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function ShellToolbar({
  children,
  className,
  leading,
  trailing,
  ...props
}: ShellToolbarProps) {
  return (
    <div {...props} className={cx(styles.toolbar, className)} data-shell-toolbar="true">
      {leading ? (
        <div className={styles.toolbarLeading} data-shell-slot="leading">
          {leading}
        </div>
      ) : null}
      {children ? (
        <div className={styles.toolbarCenter} data-shell-slot="center">
          {children}
        </div>
      ) : null}
      {trailing ? (
        <div className={styles.toolbarTrailing} data-shell-slot="trailing">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

type ListRowSharedProps = {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

type ListRowButtonProps = ListRowSharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "title"> & {
    onClick: NonNullable<ButtonHTMLAttributes<HTMLButtonElement>["onClick"]>;
  };

type ListRowStaticProps = ListRowSharedProps &
  Omit<HTMLAttributes<HTMLDivElement>, "children" | "title" | "onClick"> & {
    onClick?: undefined;
    disabled?: never;
    type?: never;
  };

export type ListRowProps = ListRowButtonProps | ListRowStaticProps;

function ListRowContent({
  title,
  description,
  leading,
  trailing,
}: Omit<ListRowSharedProps, "className">) {
  return (
    <>
      {leading ? <div className={styles.listRowLeading}>{leading}</div> : null}
      <div className={styles.listRowCopy}>
        <Text as="span" className={styles.listRowTitle} size="meta" tone="strong" weight="semibold">
          {title}
        </Text>
        {description ? (
          <Text as="span" className={styles.listRowDescription} size="fine" tone="muted">
            {description}
          </Text>
        ) : null}
      </div>
      {trailing ? <div className={styles.listRowTrailing}>{trailing}</div> : null}
    </>
  );
}

export function ListRow(props: ListRowProps) {
  const { className, description, leading, title, trailing } = props;
  const content = (
    <ListRowContent title={title} description={description} leading={leading} trailing={trailing} />
  );

  if (typeof props.onClick === "function") {
    const {
      className: _className,
      description: _description,
      leading: _leading,
      onClick,
      title: _title,
      trailing: _trailing,
      type = "button",
      ...buttonProps
    } = props;
    return (
      <button
        {...buttonProps}
        type={type}
        className={cx(styles.listRowBase, styles.listRowInteractive, className)}
        data-list-row="true"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  const {
    className: _className,
    description: _description,
    leading: _leading,
    onClick: _onClick,
    title: _title,
    trailing: _trailing,
    ...divProps
  } = props;

  return (
    <div {...divProps} className={cx(styles.listRowBase, className)} data-list-row="true">
      {content}
    </div>
  );
}

export interface EmptySurfaceProps extends Omit<
  SurfaceProps,
  "children" | "tone" | "padding" | "title"
> {
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  tone?: ShellTone;
  padding?: ShellPadding;
}

export function EmptySurface({
  actions,
  body = null,
  className,
  icon,
  padding = "sm",
  title,
  tone = "subtle",
  ...props
}: EmptySurfaceProps) {
  return (
    <Surface
      {...props}
      className={cx(styles.emptySurface, className)}
      padding={padding}
      tone={tone}
      data-empty-surface="true"
    >
      <EmptyState
        className={styles.emptyState}
        title={title}
        description={body}
        actions={actions}
        icon={icon}
      />
    </Surface>
  );
}
