import { Button as SharedButton, type ButtonProps as SharedButtonProps } from "@ku0/design-system";
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "destructive"
    | "soft"
    | "outline"
    | "subtle"
    | "danger"
    | "danger-ghost"
    | "destructive-ghost";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  isLoading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
}

const variantMap = {
  primary: "primary",
  secondary: "secondary",
  ghost: "ghost",
  destructive: "danger",
  soft: "subtle",
  outline: "secondary",
  subtle: "subtle",
  danger: "danger",
  "danger-ghost": "dangerGhost",
  "destructive-ghost": "dangerGhost",
} as const satisfies Record<NonNullable<ButtonProps["variant"]>, SharedButtonProps["variant"]>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      isLoading,
      disabled,
      children,
      icon,
      iconPosition = "left",
      ...props
    },
    ref
  ) => {
    const resolvedLoading = loading ?? isLoading ?? false;

    return (
      <SharedButton
        {...props}
        ref={ref}
        className={className}
        disabled={disabled}
        loading={resolvedLoading}
        size={size}
        variant={variantMap[variant]}
        leadingIcon={iconPosition === "left" ? icon : undefined}
        trailingIcon={iconPosition === "right" ? icon : undefined}
      >
        {children}
      </SharedButton>
    );
  }
);

Button.displayName = "Button";

export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, "size">>((props, ref) => {
  return <Button ref={ref} size="icon" {...props} />;
});

IconButton.displayName = "IconButton";
