import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "./classNames";
import * as styles from "./Button.css";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "subtle" | "ghost" | "danger" | "dangerGhost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon" | "iconSm";
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    "aria-busy": ariaBusy,
    children,
    className,
    disabled,
    fullWidth = false,
    leadingIcon,
    loading = false,
    size = "md",
    trailingIcon,
    type = "button",
    variant = "primary",
    ...props
  },
  ref
) {
  const isIconOnly = !children && Boolean(leadingIcon || trailingIcon);
  const resolvedVariant = variant === "destructive" ? "danger" : variant;

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading ? true : ariaBusy}
      data-icon-only={isIconOnly ? "true" : undefined}
      data-loading={loading ? "true" : "false"}
      data-variant={resolvedVariant}
      data-size={size}
      data-full-width={fullWidth ? "true" : "false"}
      className={cx(
        styles.root,
        styles.variant[resolvedVariant],
        styles.size[size],
        isIconOnly && styles.iconOnly,
        fullWidth && styles.fullWidth,
        className
      )}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {!loading && leadingIcon ? <span className={styles.icon}>{leadingIcon}</span> : null}
      {children ? <span className={styles.content}>{children}</span> : null}
      {!loading && trailingIcon ? <span className={styles.icon}>{trailingIcon}</span> : null}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, "children"> {
  "aria-label": string;
  icon: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, leadingIcon, size = "icon", trailingIcon, ...props },
  ref
) {
  return (
    <Button
      {...props}
      ref={ref}
      size={size}
      leadingIcon={icon ?? leadingIcon}
      trailingIcon={trailingIcon}
    />
  );
});
