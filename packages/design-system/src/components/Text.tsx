import { createElement, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "./classNames";
import * as styles from "./Text.css";

type TextSize = keyof typeof styles.size;
type TextTone = keyof typeof styles.tone;
type TextWeight = keyof typeof styles.weight;
type TextTransform = keyof typeof styles.transform;

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children?: ReactNode;
  size?: TextSize;
  tone?: TextTone;
  weight?: TextWeight;
  transform?: TextTransform;
  monospace?: boolean;
  truncate?: boolean;
}

export function Text({
  as = "span",
  children,
  className,
  monospace = false,
  size = "fine",
  tone = "default",
  transform = "none",
  truncate = false,
  weight = "normal",
  ...props
}: TextProps) {
  return createElement(
    as,
    {
      ...props,
      "data-family": "text",
      "data-size": size,
      "data-tone": tone,
      "data-weight": weight,
      "data-transform": transform,
      "data-monospace": monospace ? "true" : "false",
      "data-truncate": truncate ? "true" : "false",
      className: cx(
        styles.root,
        styles.size[size],
        styles.tone[tone],
        styles.weight[weight],
        styles.transform[transform],
        monospace && styles.monospace,
        truncate && styles.truncate,
        className
      ),
    },
    children
  );
}
