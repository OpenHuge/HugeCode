import type { HTMLAttributes } from "react";
import { joinClassNames } from "../../../utils/classNames";
import type { ExecutionTone } from "./executionStatus";
import * as styles from "./ExecutionPrimitives.css";

type ExecutionStatusPillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: ExecutionTone;
  emphasis?: "subtle" | "strong";
  showDot?: boolean;
};

export function ExecutionStatusPill({
  children,
  className,
  tone = "neutral",
  emphasis = "subtle",
  showDot = false,
  ...props
}: ExecutionStatusPillProps) {
  return (
    <span
      className={joinClassNames(
        styles.statusPill,
        styles.statusPillTone[tone],
        emphasis === "strong" ? styles.statusPillStrong : null,
        className
      )}
      {...props}
    >
      {showDot ? <span className={styles.statusPillDot} aria-hidden /> : null}
      {children}
    </span>
  );
}
