import type { ReactNode } from "react";
import { joinClassNames } from "../../../utils/classNames";
import * as styles from "./ComposerResolverPanel.css";

type ComposerResolverPanelProps = {
  ariaLabel: string;
  header?: ReactNode;
  title: ReactNode;
  helper?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  helperClassName?: string;
  footerClassName?: string;
};

export function ComposerResolverPanel({
  ariaLabel,
  header,
  title,
  helper,
  children,
  footer,
  className,
  headerClassName,
  titleClassName,
  helperClassName,
  footerClassName,
}: ComposerResolverPanelProps) {
  return (
    <section className={joinClassNames(styles.panel, className)} aria-label={ariaLabel}>
      <div className={joinClassNames(styles.headerStack, headerClassName)}>
        {header}
        <div className={joinClassNames(styles.title, titleClassName)}>{title}</div>
        {helper ? (
          <div className={joinClassNames(styles.helper, helperClassName)}>{helper}</div>
        ) : null}
      </div>
      {children}
      {footer ? (
        <div className={joinClassNames(styles.footerNote, footerClassName)}>{footer}</div>
      ) : null}
    </section>
  );
}
