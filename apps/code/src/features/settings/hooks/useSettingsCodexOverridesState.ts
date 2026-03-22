import { useCallback, useEffect, useState } from "react";
import { getCodexConfigPath } from "../../../application/runtime/ports/tauriCodexConfig";
import { open } from "../../../application/runtime/ports/tauriDialogs";
import { revealItemInDir } from "../../../application/runtime/ports/tauriOpener";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type { WorkspaceInfo } from "../../../types";
import {
  buildWorkspaceOverrideDrafts,
  formatErrorMessage,
} from "../components/settingsViewHelpers";

type UseSettingsCodexOverridesStateParams = {
  projects: WorkspaceInfo[];
  setCodexPathDraft: React.Dispatch<React.SetStateAction<string>>;
};

export function useSettingsCodexOverridesState({
  projects,
  setCodexPathDraft,
}: UseSettingsCodexOverridesStateParams) {
  const [codexBinOverrideDrafts, setCodexBinOverrideDrafts] = useState<Record<string, string>>({});
  const [codexHomeOverrideDrafts, setCodexHomeOverrideDrafts] = useState<Record<string, string>>(
    {}
  );
  const [codexArgsOverrideDrafts, setCodexArgsOverrideDrafts] = useState<Record<string, string>>(
    {}
  );
  const [openConfigError, setOpenConfigError] = useState<string | null>(null);

  useEffect(() => {
    setCodexBinOverrideDrafts((prev) =>
      buildWorkspaceOverrideDrafts(projects, prev, (workspace) => workspace.codex_bin ?? null)
    );
    setCodexHomeOverrideDrafts((prev) =>
      buildWorkspaceOverrideDrafts(
        projects,
        prev,
        (workspace) => workspace.settings.codexHome ?? null
      )
    );
    setCodexArgsOverrideDrafts((prev) =>
      buildWorkspaceOverrideDrafts(
        projects,
        prev,
        (workspace) => workspace.settings.codexArgs ?? null
      )
    );
  }, [projects]);

  const handleOpenConfig = useCallback(async () => {
    setOpenConfigError(null);
    try {
      const configPath = await getCodexConfigPath();
      await revealItemInDir(configPath);
    } catch (error) {
      setOpenConfigError(error instanceof Error ? error.message : "Unable to open config.");
    }
  }, []);

  const handleBrowseCodex = useCallback(async () => {
    try {
      const selection = await open({ multiple: false, directory: false });
      if (!selection || Array.isArray(selection)) {
        return;
      }
      setCodexPathDraft(selection);
    } catch (error) {
      pushErrorToast({
        title: "Couldn’t browse for Codex binary",
        message: formatErrorMessage(error, "Unable to open file picker."),
      });
    }
  }, [setCodexPathDraft]);

  return {
    codexBinOverrideDrafts,
    setCodexBinOverrideDrafts,
    codexHomeOverrideDrafts,
    setCodexHomeOverrideDrafts,
    codexArgsOverrideDrafts,
    setCodexArgsOverrideDrafts,
    openConfigError,
    handleOpenConfig,
    handleBrowseCodex,
  };
}
