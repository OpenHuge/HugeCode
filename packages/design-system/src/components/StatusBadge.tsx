import type { ComponentProps } from "react";
import { Badge } from "./Badge";

export type StatusBadgeTone = "default" | "success" | "warning" | "error" | "progress";

export interface StatusBadgeProps extends Omit<
  ComponentProps<typeof Badge>,
  "tone" | "shape" | "size"
> {
  tone?: StatusBadgeTone;
}

const badgeToneByStatusTone = {
  default: "neutral",
  success: "success",
  warning: "warning",
  error: "danger",
  progress: "accent",
} as const;

export function StatusBadge({ tone = "default", ...props }: StatusBadgeProps) {
  return (
    <Badge
      {...props}
      data-status-tone={tone}
      tone={badgeToneByStatusTone[tone]}
      shape="chip"
      size="md"
    />
  );
}
