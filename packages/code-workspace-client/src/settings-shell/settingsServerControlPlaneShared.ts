import * as controlStyles from "./SettingsFormControls.css";
import type { SettingsServerCompactSelectProps } from "./serverControlPlaneTypes";

export const settingsServerCompactSelectProps: SettingsServerCompactSelectProps = {
  className: controlStyles.selectRoot,
  triggerClassName: controlStyles.selectTrigger,
  menuClassName: controlStyles.selectMenu,
  optionClassName: controlStyles.selectOption,
  triggerDensity: "compact",
};
