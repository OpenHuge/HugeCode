import {
  Select as SharedSelect,
  type SelectOption as SharedSelectOption,
  type SelectProps as SharedSelectProps,
} from "@ku0/design-system";
import { type ReactNode, useState } from "react";

export type SelectOption = SharedSelectOption;

type SelectLabel = string | ReactNode;

export interface SelectProps extends Omit<
  SharedSelectProps,
  "ariaLabel" | "errorMessage" | "invalid" | "label"
> {
  ariaLabel?: string;
  defaultValue?: string;
  error?: string;
  label?: SelectLabel;
  onChange?: (value: string) => void;
}

function getResolvedAriaLabel(label: SelectLabel | undefined, ariaLabel: string | undefined) {
  if (ariaLabel) {
    return ariaLabel;
  }
  if (typeof label === "string" && label.length > 0) {
    return label;
  }
  return "Select";
}

export function Select({
  ariaLabel,
  defaultValue,
  error,
  label,
  multiple = false,
  onChange,
  onValueChange,
  placeholder = "Select",
  value,
  ...props
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? "");
  const resolvedValue = value !== undefined ? value : uncontrolledValue || null;

  return (
    <SharedSelect
      {...props}
      ariaLabel={getResolvedAriaLabel(label, ariaLabel)}
      label={label}
      multiple={multiple}
      placeholder={placeholder}
      errorMessage={error}
      invalid={Boolean(error)}
      value={multiple ? value : resolvedValue}
      onValueChange={(nextValue) => {
        if (!multiple && value === undefined) {
          setUncontrolledValue(nextValue);
        }
        onValueChange?.(nextValue);
        onChange?.(nextValue);
      }}
    />
  );
}
