import type { HTMLAttributes, ReactNode } from "react";
import { joinClassNames } from "../../../utils/classNames";
import type { ExecutionTone } from "./executionStatus";
import * as styles from "./ExecutionPrimitives.css";

type ToolCallChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: ExecutionTone;
  icon?: ReactNode;
};

export function ToolCallChip({
  children,
  className,
  tone = "neutral",
  icon,
  ...props
}: ToolCallChipProps) {
  return (
    <span
      className={joinClassNames(styles.toolCallChip, styles.toolCallChipTone[tone], className)}
      {...props}
    >
      {icon ? <span className={styles.toolCallChipIcon}>{icon}</span> : null}
      <span className={styles.toolCallChipLabel}>{children}</span>
    </span>
  );
}
