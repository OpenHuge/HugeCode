import { Badge as SharedBadge } from "@ku0/design-system";
import { forwardRef, type HTMLAttributes } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "error" | "warning" | "info" | "default";
}

const toneMap = {
  default: "neutral",
  success: "success",
  error: "danger",
  warning: "warning",
  info: "accent",
} as const;

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <SharedBadge
        {...props}
        ref={ref}
        className={className}
        tone={toneMap[variant]}
        shape="pill"
        size="sm"
      />
    );
  }
);

Badge.displayName = "Badge";
