import { Button as SharedButton, type ButtonProps as SharedButtonProps } from "@ku0/design-system";
import { forwardRef } from "react";
import { Icon, type IconProps } from "../../components/Icon";

export interface ButtonProps extends Omit<
  SharedButtonProps,
  "leadingIcon" | "trailingIcon" | "loading" | "variant"
> {
  isLoading?: boolean;
  icon?: IconProps["icon"];
  iconPosition?: "left" | "right";
  variant?:
    | "primary"
    | "secondary"
    | "subtle"
    | "ghost"
    | "danger"
    | "danger-ghost"
    | "destructive"
    | "destructive-ghost";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { icon, iconPosition = "left", isLoading, variant = "primary", ...props },
  ref
) {
  const normalizedVariant =
    variant === "destructive"
      ? "danger"
      : variant === "destructive-ghost"
        ? "dangerGhost"
        : variant === "danger-ghost"
          ? "dangerGhost"
          : variant;
  const iconNode = icon ? (
    <Icon icon={icon} size={props.size === "iconSm" ? 14 : props.size === "sm" ? "sm" : "md"} />
  ) : null;

  return (
    <SharedButton
      {...props}
      ref={ref}
      loading={isLoading}
      variant={normalizedVariant}
      leadingIcon={iconPosition === "left" ? iconNode : undefined}
      trailingIcon={iconPosition === "right" ? iconNode : undefined}
    />
  );
});
