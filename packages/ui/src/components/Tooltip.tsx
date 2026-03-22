import { Tooltip as SharedTooltip } from "@ku0/design-system";
import { isValidElement, type ReactElement, type ReactNode } from "react";

export interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({ children, content, side = "top", className }: TooltipProps) {
  const normalizedChild = children;
  const trigger = isValidElement<{ "aria-describedby"?: string }>(normalizedChild) ? (
    normalizedChild
  ) : (
    <span tabIndex={0}>{normalizedChild}</span>
  );

  return (
    <SharedTooltip content={content} side={side} contentClassName={className}>
      {trigger as ReactElement<{ "aria-describedby"?: string }>}
    </SharedTooltip>
  );
}
