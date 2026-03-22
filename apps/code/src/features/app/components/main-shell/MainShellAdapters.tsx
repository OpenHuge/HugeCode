import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  HTMLAttributes,
  ReactNode,
} from "react";
import { forwardRef } from "react";
import { StatusBadge, type StatusBadgeTone } from "@ku0/design-system";
import { joinClassNames } from "../../../../utils/classNames";
import * as styles from "./MainShellAdapters.css";

type WorkspaceChromePillProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  active?: boolean;
  leading?: ReactNode;
  label: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
};

export const WorkspaceChromePill = forwardRef<HTMLButtonElement, WorkspaceChromePillProps>(
  function WorkspaceChromePill(
    { active = false, className, leading, label, meta, trailing, type = "button", ...props },
    ref
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={joinClassNames(styles.chromePill, className)}
        data-active={active ? "true" : undefined}
        data-workspace-chrome="pill"
        data-workspace-shell-pill="true"
      >
        {leading ? <span className={styles.chromePillLeading}>{leading}</span> : null}
        <span className={styles.chromePillLabel}>{label}</span>
        {meta ? <span className={styles.chromePillMeta}>{meta}</span> : null}
        {trailing ? <span className={styles.chromePillTrailing}>{trailing}</span> : null}
      </button>
    );
  }
);

type WorkspaceHeaderActionProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  active?: boolean;
  copied?: boolean;
  icon?: ReactNode;
  segment?: "single" | "leading" | "trailing" | "icon";
  children?: ReactNode;
};

export const WorkspaceHeaderAction = forwardRef<HTMLButtonElement, WorkspaceHeaderActionProps>(
  function WorkspaceHeaderAction(
    {
      active = false,
      children,
      className,
      copied = false,
      icon,
      segment = "single",
      type = "button",
      ...props
    },
    ref
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={joinClassNames(styles.headerAction, className)}
        data-active={active ? "true" : undefined}
        data-copied={copied ? "true" : undefined}
        data-icon-only={icon && !children ? "true" : undefined}
        data-segment={segment}
        data-workspace-shell-action="true"
      >
        {icon ? <span className={styles.headerActionIcon}>{icon}</span> : null}
        {children ? <span className={styles.headerActionLabel}>{children}</span> : null}
      </button>
    );
  }
);

export function WorkspaceHeaderActionCopyGlyphs({
  copied = false,
  copyIcon,
  checkIcon,
}: {
  copied?: boolean;
  copyIcon: ReactNode;
  checkIcon: ReactNode;
}) {
  return (
    <span className={styles.headerActionCopyStack} aria-hidden>
      <span
        className={joinClassNames(
          styles.headerActionCopyGlyph,
          "workspace-header-action-copy",
          copied && styles.headerActionCopyGlyphHidden
        )}
      >
        {copyIcon}
      </span>
      <span
        className={joinClassNames(
          styles.headerActionCheckGlyph,
          "workspace-header-action-check",
          copied && styles.headerActionCheckGlyphVisible
        )}
      >
        {checkIcon}
      </span>
    </span>
  );
}

type WorkspaceMenuSectionProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export function WorkspaceMenuSection({
  actions,
  children,
  className,
  description,
  label,
  ...props
}: WorkspaceMenuSectionProps) {
  return (
    <section {...props} className={joinClassNames(styles.menuSection, className)}>
      <div className={styles.menuSectionHeader}>
        <div className={styles.menuSectionHeading}>
          <span className={styles.menuSectionLabel}>{label}</span>
          {description ? (
            <span className={styles.menuSectionDescription}>{description}</span>
          ) : null}
        </div>
        {actions}
      </div>
      <div className={styles.menuSectionBody}>{children}</div>
    </section>
  );
}

type WorkspaceSupportMetaProps = Omit<ComponentPropsWithoutRef<typeof StatusBadge>, "children"> & {
  icon?: ReactNode;
  label: ReactNode;
  tone?: StatusBadgeTone;
};

export function WorkspaceSupportMeta({
  className,
  icon,
  label,
  tone = "default",
  ...props
}: WorkspaceSupportMetaProps) {
  return (
    <StatusBadge {...props} tone={tone} className={joinClassNames(styles.supportMeta, className)}>
      {icon ? <span className={styles.supportMetaIcon}>{icon}</span> : null}
      <span className={styles.supportMetaLabel}>{label}</span>
    </StatusBadge>
  );
}
