import { useEffect } from "react";
import type { ThemePreference } from "../../../types";
import { syncAppThemePreference } from "../../../bootstrap/themeRuntime";

export function useThemePreference(theme: ThemePreference) {
  useEffect(() => {
    syncAppThemePreference(theme);
  }, [theme]);
}
