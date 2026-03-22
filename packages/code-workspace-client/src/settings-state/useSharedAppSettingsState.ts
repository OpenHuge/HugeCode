import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceClientRuntimeBindings } from "../workspace/WorkspaceClientBindingsProvider";

type UseSharedAppSettingsStateOptions<TSettings extends Record<string, unknown>> = {
  buildDefaultSettings: () => TSettings;
  normalizeSettings: (settings: TSettings) => TSettings;
};

export function useSharedAppSettingsState<TSettings extends Record<string, unknown>>({
  buildDefaultSettings,
  normalizeSettings,
}: UseSharedAppSettingsStateOptions<TSettings>) {
  const runtime = useWorkspaceClientRuntimeBindings();
  const defaultSettings = useMemo(
    () => normalizeSettings(buildDefaultSettings()),
    [buildDefaultSettings, normalizeSettings]
  );
  const [settings, setSettings] = useState<TSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }
    runtime.settings.syncRuntimeGatewayProfileFromAppSettings(settings);
  }, [hasHydrated, runtime.settings, settings]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await runtime.settings.getAppSettings();
        if (active) {
          setSettings(
            normalizeSettings({
              ...defaultSettings,
              ...(response as Partial<TSettings>),
            })
          );
        }
      } catch {
        // Keep normalized defaults when loading fails.
      } finally {
        if (active) {
          setIsLoading(false);
          setHasHydrated(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [defaultSettings, normalizeSettings, runtime.settings]);

  const saveSettings = useCallback(
    async (next: TSettings) => {
      const normalized = normalizeSettings(next);
      const saved = await runtime.settings.updateAppSettings(normalized);
      const nextSettings = normalizeSettings({
        ...defaultSettings,
        ...(saved as Partial<TSettings>),
      });
      setSettings(nextSettings);
      return saved as TSettings;
    },
    [defaultSettings, normalizeSettings, runtime.settings]
  );

  return {
    settings,
    setSettings,
    saveSettings,
    isLoading,
  };
}
