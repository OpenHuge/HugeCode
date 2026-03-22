import { runCodexUpdate } from "../../../application/runtime/ports/tauriCodexOperations";
import { useThemePreference } from "../../layout/hooks/useThemePreference";
import { useTransparencyPreference } from "../../layout/hooks/useTransparencyPreference";
import { useUiScaleShortcuts } from "../../layout/hooks/useUiScaleShortcuts";
import { useAppSettings } from "../../settings/hooks/useAppSettings";

export function useAppSettingsController() {
  const {
    settings: appSettings,
    setSettings: setAppSettings,
    saveSettings,
    doctor,
    isLoading: appSettingsLoading,
  } = useAppSettings();

  useThemePreference(appSettings.theme);
  const { reduceTransparency, setReduceTransparency } = useTransparencyPreference();

  const { uiScale, scaleShortcutTitle, scaleShortcutText, queueSaveSettings } = useUiScaleShortcuts(
    {
      settings: appSettings,
      setSettings: setAppSettings,
      saveSettings,
    }
  );

  return {
    appSettings,
    setAppSettings,
    saveSettings,
    queueSaveSettings,
    doctor,
    codexUpdate: (codexBin: string | null, codexArgs: string | null) =>
      runCodexUpdate(codexBin, codexArgs),
    appSettingsLoading,
    reduceTransparency,
    setReduceTransparency,
    uiScale,
    scaleShortcutTitle,
    scaleShortcutText,
  };
}
