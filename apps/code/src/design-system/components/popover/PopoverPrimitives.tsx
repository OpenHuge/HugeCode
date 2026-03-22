import {
  PopoverMenuItem as SharedPopoverMenuItem,
  type PopoverMenuItemProps as SharedPopoverMenuItemProps,
  PopoverSurface as SharedPopoverSurface,
  type PopoverSurfaceProps as SharedPopoverSurfaceProps,
} from "@ku0/design-system";
import { forwardRef } from "react";
import { joinClassNames } from "../../../utils/classNames";

export type PopoverSurfaceProps = SharedPopoverSurfaceProps;

export const PopoverSurface = forwardRef<HTMLDivElement, PopoverSurfaceProps>(
  function PopoverSurface({ className, ...props }, ref) {
    return (
      <SharedPopoverSurface
        {...props}
        ref={ref}
        className={joinClassNames("app-popover-surface", className)}
        data-app-popover-surface="true"
      />
    );
  }
);

export type PopoverMenuItemProps = SharedPopoverMenuItemProps;

export const PopoverMenuItem = forwardRef<HTMLButtonElement, PopoverMenuItemProps>(
  function PopoverMenuItem({ className, ...props }, ref) {
    return (
      <SharedPopoverMenuItem
        {...props}
        ref={ref}
        className={joinClassNames("app-popover-item", className)}
        data-app-popover-item="true"
      />
    );
  }
);
