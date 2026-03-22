import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "./classNames";
import * as styles from "./Badge.css";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  shape?: "pill" | "chip";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { children, className, shape = "pill", size = "sm", tone = "neutral", ...props },
  ref
) {
  return (
    <span
      {...props}
      ref={ref}
      data-tone={tone}
      data-shape={shape}
      data-size={size}
      className={cx(
        styles.root,
        styles.shape[shape],
        styles.size[size],
        styles.tone[tone],
        className
      )}
    >
      {children}
    </span>
  );
});
