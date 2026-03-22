import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import {
  PopoverMenuItem,
  PopoverSurface,
  type PopoverMenuItemProps,
  type PopoverSurfaceProps,
} from "./Popover";

export interface DropdownMenuTriggerProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  children: ReactNode;
  open?: boolean;
}

export const DropdownMenuTrigger = forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  function DropdownMenuTrigger(
    { "aria-expanded": ariaExpanded, children, open = false, type = "button", ...props },
    ref
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        aria-haspopup="menu"
        aria-expanded={open ? true : ariaExpanded}
        data-family="dropdown-menu"
      >
        {children}
      </button>
    );
  }
);

export interface DropdownMenuContentProps extends Omit<PopoverSurfaceProps, "role"> {
  role?: HTMLAttributes<HTMLDivElement>["role"];
}

export const DropdownMenuContent = forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  function DropdownMenuContent({ role = "menu", ...props }, ref) {
    return <PopoverSurface {...props} ref={ref} role={role} data-family="dropdown-menu" />;
  }
);

export interface DropdownMenuItemProps extends Omit<PopoverMenuItemProps, "role"> {
  role?: ButtonHTMLAttributes<HTMLButtonElement>["role"];
}

export function DropdownMenuItem({ role = "menuitem", ...props }: DropdownMenuItemProps) {
  return <PopoverMenuItem {...props} role={role} data-family="dropdown-menu" />;
}
