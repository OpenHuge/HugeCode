import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "./classNames";
import * as styles from "./Popover.css";

export interface PopoverSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  overlayKind?: "menu" | "panel";
}

export const PopoverSurface = forwardRef<HTMLDivElement, PopoverSurfaceProps>(
  function PopoverSurface({ className, overlayKind, role, ...props }, ref) {
    const overlayProps = props as unknown as Record<string, string | boolean | undefined>;
    const overlayState = overlayProps["data-overlay-state"] ?? "open";
    const resolvedOverlayKind = overlayKind ?? (role?.startsWith("menu") ? "menu" : "panel");
    const ariaModal =
      role === "dialog" && overlayProps["aria-modal"] === undefined ? false : props["aria-modal"];

    return (
      <div
        {...props}
        ref={ref}
        role={role}
        aria-modal={ariaModal}
        data-overlay-kind={resolvedOverlayKind}
        data-overlay-surface="true"
        data-overlay-state={overlayState}
        className={cx(styles.surface, "ds-popover", className)}
      />
    );
  }
);

export interface PopoverMenuItemProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  children: ReactNode;
  icon?: ReactNode;
  active?: boolean;
}

export const PopoverMenuItem = forwardRef<HTMLButtonElement, PopoverMenuItemProps>(
  function PopoverMenuItem(
    { active = false, children, className, icon, type = "button", ...props },
    ref
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        data-active={active ? "true" : "false"}
        data-overlay-item="true"
        className={cx(
          styles.menuItem,
          "ds-popover-item",
          active && styles.menuItemActive,
          active && "is-active",
          className
        )}
      >
        {icon ? (
          <span className={cx(styles.menuItemIcon, "ds-popover-item-icon")} aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className={cx(styles.menuItemLabel, "ds-popover-item-label")}>{children}</span>
      </button>
    );
  }
);
