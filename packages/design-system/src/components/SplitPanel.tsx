import { type HTMLAttributes, type ReactNode } from "react";
import { cx } from "./classNames";
import * as styles from "./SplitPanel.css";

export interface SplitPanelProps extends HTMLAttributes<HTMLDivElement> {
  leading: ReactNode;
  trailing: ReactNode;
}

export function SplitPanel({ className, leading, trailing, ...props }: SplitPanelProps) {
  return (
    <div {...props} className={cx(styles.root, className)} data-split-panel="true">
      <div className={styles.leading} data-split-slot="leading">
        {leading}
      </div>
      <div className={styles.trailing} data-split-slot="trailing">
        {trailing}
      </div>
    </div>
  );
}
