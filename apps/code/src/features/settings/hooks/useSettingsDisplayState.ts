import { useCallback, useEffect, useState } from "react";
import type { AppSettings } from "../../../types";
import {
  clampCodeFontSize,
  DEFAULT_CODE_FONT_FAMILY,
  DEFAULT_UI_FONT_FAMILY,
  normalizeFontFamily,
} from "../../../utils/fonts";
import { clampUiScale } from "../../../utils/uiScale";

type UseSettingsDisplayStateParams = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
};

export function useSettingsDisplayState({
  appSettings,
  onUpdateAppSettings,
}: UseSettingsDisplayStateParams) {
  const [scaleDraft, setScaleDraft] = useState(
    `${Math.round(clampUiScale(appSettings.uiScale) * 100)}%`
  );
  const [uiFontDraft, setUiFontDraft] = useState(appSettings.uiFontFamily);
  const [codeFontDraft, setCodeFontDraft] = useState(appSettings.codeFontFamily);
  const [codeFontSizeDraft, setCodeFontSizeDraft] = useState(appSettings.codeFontSize);

  useEffect(() => {
    setScaleDraft(`${Math.round(clampUiScale(appSettings.uiScale) * 100)}%`);
  }, [appSettings.uiScale]);

  useEffect(() => {
    setUiFontDraft(appSettings.uiFontFamily);
  }, [appSettings.uiFontFamily]);

  useEffect(() => {
    setCodeFontDraft(appSettings.codeFontFamily);
  }, [appSettings.codeFontFamily]);

  useEffect(() => {
    setCodeFontSizeDraft(appSettings.codeFontSize);
  }, [appSettings.codeFontSize]);

  const handleCommitScale = useCallback(async () => {
    const trimmedScale = scaleDraft.trim();
    const parsedPercent = trimmedScale ? Number(trimmedScale.replace("%", "")) : Number.NaN;
    const parsedScale = Number.isFinite(parsedPercent) ? parsedPercent / 100 : null;
    if (parsedScale === null) {
      setScaleDraft(`${Math.round(clampUiScale(appSettings.uiScale) * 100)}%`);
      return;
    }
    const nextScale = clampUiScale(parsedScale);
    setScaleDraft(`${Math.round(nextScale * 100)}%`);
    if (nextScale === appSettings.uiScale) {
      return;
    }
    await onUpdateAppSettings({
      ...appSettings,
      uiScale: nextScale,
    });
  }, [appSettings, onUpdateAppSettings, scaleDraft]);

  const handleResetScale = useCallback(async () => {
    if (appSettings.uiScale === 1) {
      setScaleDraft("100%");
      return;
    }
    setScaleDraft("100%");
    await onUpdateAppSettings({
      ...appSettings,
      uiScale: 1,
    });
  }, [appSettings, onUpdateAppSettings]);

  const handleCommitUiFont = useCallback(async () => {
    const nextFont = normalizeFontFamily(uiFontDraft, DEFAULT_UI_FONT_FAMILY);
    setUiFontDraft(nextFont);
    if (nextFont === appSettings.uiFontFamily) {
      return;
    }
    await onUpdateAppSettings({
      ...appSettings,
      uiFontFamily: nextFont,
    });
  }, [appSettings, onUpdateAppSettings, uiFontDraft]);

  const handleCommitCodeFont = useCallback(async () => {
    const nextFont = normalizeFontFamily(codeFontDraft, DEFAULT_CODE_FONT_FAMILY);
    setCodeFontDraft(nextFont);
    if (nextFont === appSettings.codeFontFamily) {
      return;
    }
    await onUpdateAppSettings({
      ...appSettings,
      codeFontFamily: nextFont,
    });
  }, [appSettings, codeFontDraft, onUpdateAppSettings]);

  const handleCommitCodeFontSize = useCallback(
    async (nextSize: number) => {
      const clampedSize = clampCodeFontSize(nextSize);
      setCodeFontSizeDraft(clampedSize);
      if (clampedSize === appSettings.codeFontSize) {
        return;
      }
      await onUpdateAppSettings({
        ...appSettings,
        codeFontSize: clampedSize,
      });
    },
    [appSettings, onUpdateAppSettings]
  );

  return {
    scaleDraft,
    setScaleDraft,
    uiFontDraft,
    setUiFontDraft,
    codeFontDraft,
    setCodeFontDraft,
    codeFontSizeDraft,
    setCodeFontSizeDraft,
    handleCommitScale,
    handleResetScale,
    handleCommitUiFont,
    handleCommitCodeFont,
    handleCommitCodeFontSize,
  };
}
