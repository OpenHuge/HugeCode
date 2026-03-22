import { Switch } from "../../../design-system";

type SettingsToggleControlProps = {
  checked: boolean;
  ariaLabel: string;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function SettingsToggleControl({
  checked,
  ariaLabel,
  onCheckedChange,
  disabled,
}: SettingsToggleControlProps) {
  return (
    <Switch
      aria-label={ariaLabel}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
    />
  );
}
