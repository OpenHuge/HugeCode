import { useCallback, useEffect, useState } from "react";
import type { AppSettings } from "../../../types";
import { DEFAULT_COMMIT_MESSAGE_PROMPT } from "../../../utils/commitMessagePrompt";

type UseSettingsGitPromptStateParams = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
};

export function useSettingsGitPromptState({
  appSettings,
  onUpdateAppSettings,
}: UseSettingsGitPromptStateParams) {
  const [commitMessagePromptDraft, setCommitMessagePromptDraft] = useState(
    appSettings.commitMessagePrompt
  );
  const [commitMessagePromptSaving, setCommitMessagePromptSaving] = useState(false);

  useEffect(() => {
    setCommitMessagePromptDraft(appSettings.commitMessagePrompt);
  }, [appSettings.commitMessagePrompt]);

  const commitMessagePromptDirty = commitMessagePromptDraft !== appSettings.commitMessagePrompt;

  const handleSaveCommitMessagePrompt = useCallback(async () => {
    if (commitMessagePromptSaving || !commitMessagePromptDirty) {
      return;
    }
    setCommitMessagePromptSaving(true);
    try {
      await onUpdateAppSettings({
        ...appSettings,
        commitMessagePrompt: commitMessagePromptDraft,
      });
    } finally {
      setCommitMessagePromptSaving(false);
    }
  }, [
    appSettings,
    commitMessagePromptDirty,
    commitMessagePromptDraft,
    commitMessagePromptSaving,
    onUpdateAppSettings,
  ]);

  const handleResetCommitMessagePrompt = useCallback(async () => {
    if (commitMessagePromptSaving) {
      return;
    }
    setCommitMessagePromptDraft(DEFAULT_COMMIT_MESSAGE_PROMPT);
    setCommitMessagePromptSaving(true);
    try {
      await onUpdateAppSettings({
        ...appSettings,
        commitMessagePrompt: DEFAULT_COMMIT_MESSAGE_PROMPT,
      });
    } finally {
      setCommitMessagePromptSaving(false);
    }
  }, [appSettings, commitMessagePromptSaving, onUpdateAppSettings]);

  return {
    commitMessagePromptDraft,
    setCommitMessagePromptDraft,
    commitMessagePromptSaving,
    commitMessagePromptDirty,
    handleSaveCommitMessagePrompt,
    handleResetCommitMessagePrompt,
  };
}
