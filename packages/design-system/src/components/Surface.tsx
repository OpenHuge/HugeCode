import { createElement, forwardRef, type HTMLAttributes } from "react";
import { cx } from "./classNames";
import * as styles from "./Surface.css";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: keyof HTMLElementTagNameMap;
  tone?: "default" | "subtle" | "elevated" | "translucent" | "ghost";
  padding?: "none" | "sm" | "md" | "lg";
  depth?: "none" | "card" | "panel" | "floating" | "overlay";
  interactive?: boolean;
}

export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(
  {
    as,
    children,
    className,
    depth,
    interactive = false,
    padding = "md",
    tone = "default",
    ...props
  },
  ref
) {
  const component = String(as ?? "div");

  return createElement(
    component,
    {
      ...props,
      className: cx(
        styles.root,
        styles.tone[tone],
        styles.padding[padding],
        interactive && styles.interactive,
        depth ? styles.depth[depth] : null,
        className
      ),
      ref,
    },
    children
  );
});
