import {
  applyDesignSystemThemeRuntime as applyThemeRuntime,
  syncDesignSystemThemePreference,
  type DesignSystemThemePreference,
} from "@ku0/design-system";

export function applyDesignSystemThemeRuntime() {
  return applyThemeRuntime();
}

export function syncAppThemePreference(preference: DesignSystemThemePreference) {
  return syncDesignSystemThemePreference(preference);
}
