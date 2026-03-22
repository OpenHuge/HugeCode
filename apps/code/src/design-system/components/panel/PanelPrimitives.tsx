import {
  PanelFrame as SharedPanelFrame,
  PanelHeader as SharedPanelHeader,
  PanelMeta as SharedPanelMeta,
  PanelNavItem as SharedPanelNavItem,
  PanelNavList as SharedPanelNavList,
  PanelSearchField as SharedPanelSearchField,
} from "@ku0/design-system";
import { type ComponentPropsWithoutRef } from "react";

function withAppClassName(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type PanelFrameProps = ComponentPropsWithoutRef<typeof SharedPanelFrame>;

export function PanelFrame({ className, ...props }: PanelFrameProps) {
  return <SharedPanelFrame {...props} className={withAppClassName("app-panel-frame", className)} />;
}

export type PanelHeaderProps = ComponentPropsWithoutRef<typeof SharedPanelHeader>;

export function PanelHeader({ className, ...props }: PanelHeaderProps) {
  return (
    <SharedPanelHeader {...props} className={withAppClassName("app-panel-header", className)} />
  );
}

export type PanelMetaProps = ComponentPropsWithoutRef<typeof SharedPanelMeta>;

export function PanelMeta({ className, ...props }: PanelMetaProps) {
  return <SharedPanelMeta {...props} className={withAppClassName("app-panel-meta", className)} />;
}

export type PanelSearchFieldProps = ComponentPropsWithoutRef<typeof SharedPanelSearchField>;

export function PanelSearchField({ className, inputClassName, ...props }: PanelSearchFieldProps) {
  return (
    <SharedPanelSearchField
      {...props}
      className={withAppClassName("app-panel-search", className)}
      inputClassName={withAppClassName("app-panel-search-input", inputClassName)}
    />
  );
}

export type PanelNavListProps = ComponentPropsWithoutRef<typeof SharedPanelNavList>;

export function PanelNavList({ className, ...props }: PanelNavListProps) {
  return (
    <SharedPanelNavList {...props} className={withAppClassName("app-panel-nav-list", className)} />
  );
}

export type PanelNavItemProps = ComponentPropsWithoutRef<typeof SharedPanelNavItem>;

export function PanelNavItem({ className, ...props }: PanelNavItemProps) {
  return (
    <SharedPanelNavItem {...props} className={withAppClassName("app-panel-nav-item", className)} />
  );
}
