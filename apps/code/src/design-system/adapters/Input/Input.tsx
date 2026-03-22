import { Input as SharedInput, type InputProps as SharedInputProps } from "@ku0/design-system";
import { forwardRef } from "react";
import { Icon, type IconProps } from "../../components/Icon";

export interface InputProps extends Omit<
  SharedInputProps,
  "prefix" | "suffix" | "invalid" | "inputSize"
> {
  icon?: IconProps["icon"];
  iconPosition?: "left" | "right";
  error?: boolean;
  inputSize?: SharedInputProps["inputSize"];
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, fieldClassName, icon, iconPosition = "left", inputSize = "lg", ...props },
  ref
) {
  const iconNode = icon ? <Icon icon={icon} size="sm" /> : null;
  return (
    <SharedInput
      {...props}
      ref={ref}
      fieldClassName={fieldClassName}
      invalid={error}
      prefix={iconPosition === "left" ? iconNode : undefined}
      suffix={iconPosition === "right" ? iconNode : undefined}
      inputSize={inputSize}
    />
  );
});
