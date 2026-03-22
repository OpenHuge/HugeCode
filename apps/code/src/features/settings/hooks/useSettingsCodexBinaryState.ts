import { useCallback, useEffect, useState } from "react";
import type { AppSettings } from "../../../types";

type UseSettingsCodexBinaryStateParams = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
};

export function useSettingsCodexBinaryState({
  appSettings,
  onUpdateAppSettings,
}: UseSettingsCodexBinaryStateParams) {
  const [codexPathDraft, setCodexPathDraft] = useState(appSettings.codexBin ?? "");
  const [codexArgsDraft, setCodexArgsDraft] = useState(appSettings.codexArgs ?? "");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    setCodexPathDraft(appSettings.codexBin ?? "");
  }, [appSettings.codexBin]);

  useEffect(() => {
    setCodexArgsDraft(appSettings.codexArgs ?? "");
  }, [appSettings.codexArgs]);

  const nextCodexBin = codexPathDraft.trim() ? codexPathDraft.trim() : null;
  const nextCodexArgs = codexArgsDraft.trim() ? codexArgsDraft.trim() : null;
  const codexDirty =
    nextCodexBin !== (appSettings.codexBin ?? null) ||
    nextCodexArgs !== (appSettings.codexArgs ?? null);

  const handleSaveCodexSettings = useCallback(async () => {
    setIsSavingSettings(true);
    try {
      await onUpdateAppSettings({
        ...appSettings,
        codexBin: nextCodexBin,
        codexArgs: nextCodexArgs,
      });
    } finally {
      setIsSavingSettings(false);
    }
  }, [appSettings, nextCodexArgs, nextCodexBin, onUpdateAppSettings]);

  return {
    codexPathDraft,
    setCodexPathDraft,
    codexArgsDraft,
    setCodexArgsDraft,
    isSavingSettings,
    nextCodexBin,
    nextCodexArgs,
    codexDirty,
    handleSaveCodexSettings,
  };
}
