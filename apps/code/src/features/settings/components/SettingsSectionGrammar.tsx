import type { HTMLAttributes, ReactNode } from "react";
import { ShellSection } from "../../../design-system";
import * as styles from "./SettingsSectionGrammar.css";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type SettingsSectionFrameProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

type SettingsFieldGroupProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
};

type SettingsFooterBarProps = HTMLAttributes<HTMLDivElement>;

type SettingsFieldProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  htmlFor?: string;
  help?: ReactNode;
  children: ReactNode;
};

type SettingsControlRowProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  control: ReactNode;
  rowType?: "control" | "toggle";
};

export function SettingsSectionFrame({
  actions,
  children,
  className,
  subtitle,
  title,
}: SettingsSectionFrameProps) {
  return (
    <ShellSection
      className={cx(styles.sectionFrame, className)}
      title={<div className={styles.sectionTitle}>{title}</div>}
      meta={subtitle ? <div className={styles.sectionSubtitle}>{subtitle}</div> : undefined}
      actions={actions}
      data-settings-section-frame="true"
    >
      {children}
    </ShellSection>
  );
}

export function SettingsFieldGroup({
  children,
  className,
  subtitle,
  title,
  ...props
}: SettingsFieldGroupProps) {
  return (
    <div {...props} className={cx(styles.fieldGroup, className)} data-settings-field-group="true">
      <div className={styles.fieldGroupHeader}>
        <div className={styles.fieldGroupTitle} data-settings-field-group-title="true">
          {title}
        </div>
        {subtitle ? <div className={styles.fieldGroupSubtitle}>{subtitle}</div> : null}
      </div>
      <div className={styles.fieldGroupBody}>{children}</div>
    </div>
  );
}

export function SettingsFooterBar({ children, className, ...props }: SettingsFooterBarProps) {
  return (
    <div {...props} className={cx(styles.footerBar, className)} data-settings-footer-bar="true">
      {children}
    </div>
  );
}

export function SettingsField({
  children,
  className,
  help,
  htmlFor,
  label,
  ...props
}: SettingsFieldProps) {
  const labelNode =
    typeof htmlFor === "string" ? (
      <label className={styles.fieldLabel} htmlFor={htmlFor}>
        {label}
      </label>
    ) : (
      <div className={styles.fieldLabel}>{label}</div>
    );

  return (
    <div {...props} className={cx(styles.field, className)}>
      {labelNode}
      <div className={styles.fieldControlRow}>{children}</div>
      {help ? <div className={styles.helpText}>{help}</div> : null}
    </div>
  );
}

export function SettingsControlRow({
  control,
  rowType = "toggle",
  subtitle,
  title,
}: SettingsControlRowProps) {
  return (
    <div className={styles.toggleRow} data-settings-field-row={rowType}>
      <div className={styles.toggleCopy}>
        <div className={styles.toggleTitle}>{title}</div>
        {subtitle ? <div className={styles.toggleSubtitle}>{subtitle}</div> : null}
      </div>
      {control}
    </div>
  );
}
