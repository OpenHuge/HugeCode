import { type HTMLAttributes, type ReactNode, type TableHTMLAttributes } from "react";
import { cx } from "./classNames";
import * as styles from "./RichContent.css";

export interface RichContentProps extends HTMLAttributes<HTMLDivElement> {}

type TableDataAttributes = {
  [key: `data-${string}`]: string | number | boolean | undefined;
};

export function RichContent({ className, ...props }: RichContentProps) {
  return <div {...props} className={cx(styles.root, className)} data-rich-content="true" />;
}

export interface CodeBlockSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
  actions?: ReactNode;
  bodyClassName?: string;
}

export function CodeBlockSurface({
  actions,
  bodyClassName,
  children,
  className,
  label = "Code",
  ...props
}: CodeBlockSurfaceProps) {
  return (
    <div {...props} className={cx(styles.codeBlock, className)} data-rich-code-block="true">
      <div className={styles.codeBlockHeader}>
        <span className={styles.codeBlockLabel}>{label}</span>
        {actions ? <div className={styles.codeBlockActions}>{actions}</div> : null}
      </div>
      <pre className={cx(styles.codeBlockBody, bodyClassName)}>{children}</pre>
    </div>
  );
}

export interface DataTableSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tableProps?: TableHTMLAttributes<HTMLTableElement> & TableDataAttributes;
}

export function DataTableSurface({
  children,
  className,
  tableProps,
  ...props
}: DataTableSurfaceProps) {
  const { className: tableClassName, ...resolvedTableProps } = tableProps ?? {};
  return (
    <div
      {...props}
      className={cx(styles.tableScroll, className)}
      data-markdown-table-container="true"
      data-rich-content-table="true"
    >
      <table {...resolvedTableProps} className={cx(styles.table, tableClassName)}>
        {children}
      </table>
    </div>
  );
}
