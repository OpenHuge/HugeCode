import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./classNames";
import * as styles from "./Panel.css";

type PanelFrameProps = {
  children: ReactNode;
  className?: string;
};

export function PanelFrame({ children, className }: PanelFrameProps) {
  return <aside className={cx(styles.frame, "ds-panel", className)}>{children}</aside>;
}

type PanelHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function PanelHeader({ children, className }: PanelHeaderProps) {
  return <div className={cx(styles.header, "ds-panel-header", className)}>{children}</div>;
}

type PanelMetaProps = {
  children: ReactNode;
  className?: string;
};

export function PanelMeta({ children, className }: PanelMetaProps) {
  return <div className={cx(styles.meta, "ds-panel-meta", className)}>{children}</div>;
}

type PanelSearchFieldProps = Omit<ComponentPropsWithoutRef<"input">, "className" | "type"> & {
  className?: string;
  inputClassName?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
};

export function PanelSearchField({
  className,
  inputClassName,
  icon,
  trailing,
  ...props
}: PanelSearchFieldProps) {
  return (
    <div className={cx(styles.searchField, "ds-panel-search", className)}>
      {icon ? (
        <span className={cx(styles.searchIcon, "ds-panel-search-icon")} aria-hidden>
          {icon}
        </span>
      ) : null}
      <input
        type="search"
        className={cx(styles.searchInput, "ds-panel-search-input", inputClassName)}
        {...props}
      />
      {trailing}
    </div>
  );
}

type PanelNavListProps = {
  children: ReactNode;
  className?: string;
};

export function PanelNavList({ children, className }: PanelNavListProps) {
  return <div className={cx(styles.navList, "ds-panel-nav", className)}>{children}</div>;
}

type PanelNavItemProps = Omit<ComponentPropsWithoutRef<"button">, "children"> & {
  children: ReactNode;
  icon?: ReactNode;
  active?: boolean;
  showDisclosure?: boolean;
};

export function PanelNavItem({
  className,
  icon,
  active = false,
  showDisclosure = false,
  children,
  ...props
}: PanelNavItemProps) {
  return (
    <button
      type="button"
      className={cx(styles.navItem, "ds-panel-nav-item", active && styles.navItemActive, className)}
      {...props}
    >
      <span className={cx(styles.navItemMain, "ds-panel-nav-item-main")}>
        {icon ? (
          <span className={cx(styles.navItemIcon, "ds-panel-nav-item-icon")} aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className={cx(styles.navItemLabel, "ds-panel-nav-item-label")}>{children}</span>
      </span>
      {showDisclosure ? (
        <span className={cx(styles.navItemDisclosure, "ds-panel-nav-item-disclosure")} aria-hidden>
          &rsaquo;
        </span>
      ) : null}
    </button>
  );
}
