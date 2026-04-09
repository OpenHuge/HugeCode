import { useCallback, useEffect, useMemo, useState } from "react";
import type { WorkspaceInfo } from "../../../types";
import { updateWorkspaceSettings } from "../../../services/workspaceBridge";
import {
  closeAiWebLabSession,
  extractAiWebLabArtifact,
  focusAiWebLabSession,
  getAiWebLabCatalog,
  getAiWebLabState,
  navigateAiWebLab,
  openAiWebLabEntrypoint,
  openAiWebLabSession,
  setAiWebLabSessionMode,
  setAiWebLabViewMode,
  type AiWebLabProviderId,
  type DesktopAiWebLabArtifact,
  type DesktopAiWebLabCatalog,
  type DesktopAiWebLabSessionMode,
  type DesktopAiWebLabState,
  type DesktopAiWebLabViewMode,
} from "../ports/aiWebLab";

type AiWebLabWorkspaceSettings = {
  autoAttachArtifact: boolean;
  autoCreateWorktree: boolean;
  defaultBaseRef: string;
  defaultProvider: AiWebLabProviderId;
  preferredSessionMode: DesktopAiWebLabSessionMode;
  preferredViewMode: DesktopAiWebLabViewMode;
  providerUrls: Record<AiWebLabProviderId, string>;
};

type UseRuntimeAiWebLabControllerOptions = {
  workspace: WorkspaceInfo;
  onApplyArtifactToDraft: (artifact: DesktopAiWebLabArtifact) => void;
};

export type RuntimeAiWebLabController = {
  applyArtifactToDraft(): void;
  canApplyArtifactToDraft: boolean;
  catalog: DesktopAiWebLabCatalog | null;
  closeSession(): Promise<void>;
  error: string | null;
  extractArtifact(): Promise<void>;
  extracting: boolean;
  focusSession(): Promise<void>;
  loading: boolean;
  note: string | null;
  openEntrypoint(providerId: AiWebLabProviderId, entrypointId: string): Promise<void>;
  openSession(): Promise<void>;
  refresh(): Promise<void>;
  saveProviderUrl(providerId: AiWebLabProviderId, value: string): Promise<void>;
  setAutoAttachArtifact(value: boolean): Promise<void>;
  setAutoCreateWorktree(value: boolean): Promise<void>;
  setDefaultBaseRef(value: string): Promise<void>;
  setDefaultProvider(value: AiWebLabProviderId): Promise<void>;
  setPreferredSessionMode(value: DesktopAiWebLabSessionMode): Promise<void>;
  setPreferredViewMode(value: DesktopAiWebLabViewMode): Promise<void>;
  settings: AiWebLabWorkspaceSettings;
  state: DesktopAiWebLabState | null;
  worktreeRecommendation: string | null;
};

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  return fallback;
}

function readWorkspaceAiWebLabSettings(workspace: WorkspaceInfo): AiWebLabWorkspaceSettings {
  return {
    autoAttachArtifact: workspace.settings.aiWebLabAutoAttachArtifact === true,
    autoCreateWorktree: workspace.settings.aiWebLabAutoCreateWorktree === true,
    defaultBaseRef: workspace.settings.aiWebLabDefaultBaseRef?.trim() || "origin/main",
    defaultProvider: workspace.settings.aiWebLabDefaultProvider ?? "chatgpt",
    preferredSessionMode: workspace.settings.aiWebLabPreferredSessionMode ?? "managed",
    preferredViewMode: workspace.settings.aiWebLabPreferredViewMode ?? "docked",
    providerUrls: {
      chatgpt: workspace.settings.aiWebLabProviderUrls?.chatgpt?.trim() || "https://chatgpt.com/",
      gemini:
        workspace.settings.aiWebLabProviderUrls?.gemini?.trim() || "https://gemini.google.com/app",
    },
  };
}

export function useRuntimeAiWebLabController({
  workspace,
  onApplyArtifactToDraft,
}: UseRuntimeAiWebLabControllerOptions): RuntimeAiWebLabController {
  const [state, setState] = useState<DesktopAiWebLabState | null>(null);
  const [catalog, setCatalog] = useState<DesktopAiWebLabCatalog | null>(null);
  const [settings, setSettings] = useState<AiWebLabWorkspaceSettings>(() =>
    readWorkspaceAiWebLabSettings(workspace)
  );
  const [lastArtifact, setLastArtifact] = useState<DesktopAiWebLabArtifact | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setSettings(readWorkspaceAiWebLabSettings(workspace));
  }, [workspace]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextCatalog, nextState] = await Promise.all([
        getAiWebLabCatalog(),
        getAiWebLabState(),
      ]);
      setCatalog(nextCatalog);
      setState(nextState);
      if (nextState?.lastArtifact) {
        setLastArtifact(nextState.lastArtifact);
      }
      setError(null);
    } catch (nextError) {
      setNote(null);
      setError(readErrorMessage(nextError, "Unable to read AI Web Lab state."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const persistSettingsPatch = useCallback(
    async (patch: Partial<AiWebLabWorkspaceSettings>, successMessage: string) => {
      const previousSettings = settings;
      const nextSettings = { ...previousSettings, ...patch };
      setSettings(nextSettings);
      try {
        const updatedWorkspace = await updateWorkspaceSettings(workspace.id, {
          ...workspace.settings,
          aiWebLabAutoAttachArtifact: nextSettings.autoAttachArtifact,
          aiWebLabAutoCreateWorktree: nextSettings.autoCreateWorktree,
          aiWebLabDefaultBaseRef: nextSettings.defaultBaseRef,
          aiWebLabDefaultProvider: nextSettings.defaultProvider,
          aiWebLabPreferredSessionMode: nextSettings.preferredSessionMode,
          aiWebLabPreferredViewMode: nextSettings.preferredViewMode,
          aiWebLabProviderUrls: nextSettings.providerUrls,
        });
        setSettings(readWorkspaceAiWebLabSettings(updatedWorkspace));
        setNote(successMessage);
        setError(null);
        return true;
      } catch (nextError) {
        setSettings(previousSettings);
        setNote(null);
        setError(readErrorMessage(nextError, "Unable to save AI Web Lab defaults."));
        return false;
      }
    },
    [settings, workspace.id, workspace.settings]
  );

  const openSession = useCallback(async () => {
    setLoading(true);
    try {
      const nextState = await openAiWebLabSession({
        preferredSessionMode: settings.preferredSessionMode,
        preferredViewMode: settings.preferredViewMode,
        providerId: settings.defaultProvider,
        url: settings.providerUrls[settings.defaultProvider],
      });
      setState(nextState);
      setNote(nextState?.statusMessage ?? "AI Web Lab opened.");
      setError(null);
    } catch (nextError) {
      setNote(null);
      setError(readErrorMessage(nextError, "Unable to open AI Web Lab."));
    } finally {
      setLoading(false);
    }
  }, [settings]);

  const openEntrypoint = useCallback(
    async (providerId: AiWebLabProviderId, entrypointId: string) => {
      setLoading(true);
      try {
        const nextState = await openAiWebLabEntrypoint(providerId, entrypointId);
        setState(nextState);
        setNote(nextState?.statusMessage ?? "AI Web Lab entrypoint opened.");
        setError(null);
      } catch (nextError) {
        setNote(null);
        setError(readErrorMessage(nextError, "Unable to open the AI Web Lab entrypoint."));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const focusSession = useCallback(async () => {
    setLoading(true);
    try {
      const nextState = await focusAiWebLabSession();
      setState(nextState);
      setNote(nextState?.statusMessage ?? "AI Web Lab focused.");
      setError(null);
    } catch (nextError) {
      setNote(null);
      setError(readErrorMessage(nextError, "Unable to focus AI Web Lab."));
    } finally {
      setLoading(false);
    }
  }, []);

  const closeSession = useCallback(async () => {
    setLoading(true);
    try {
      const nextState = await closeAiWebLabSession();
      setState(nextState);
      setNote(nextState?.statusMessage ?? "AI Web Lab closed.");
      setError(null);
    } catch (nextError) {
      setNote(null);
      setError(readErrorMessage(nextError, "Unable to close AI Web Lab."));
    } finally {
      setLoading(false);
    }
  }, []);

  const applyArtifactToDraft = useCallback(() => {
    const artifact = lastArtifact ?? state?.lastArtifact ?? null;
    if (!artifact || artifact.status !== "succeeded" || !artifact.content) {
      return;
    }
    onApplyArtifactToDraft(artifact);
    setNote("AI Web Lab artifact attached to the mission draft as a source-linked launch.");
    setError(null);
  }, [lastArtifact, onApplyArtifactToDraft, state?.lastArtifact]);

  const extractArtifact = useCallback(async () => {
    setExtracting(true);
    try {
      const artifact = await extractAiWebLabArtifact();
      if (!artifact) {
        setNote(null);
        setError("AI Web Lab extraction is unavailable on this host.");
        return;
      }
      setLastArtifact(artifact);
      setState((current) => (current ? { ...current, lastArtifact: artifact } : current));
      setNote(
        artifact.status === "succeeded"
          ? "AI Web Lab extracted the latest artifact."
          : (artifact.errorMessage ?? "AI Web Lab could not extract the latest artifact.")
      );
      setError(artifact.status === "succeeded" ? null : (artifact.errorMessage ?? null));
      if (artifact.status === "succeeded" && settings.autoAttachArtifact) {
        onApplyArtifactToDraft(artifact);
        setNote(
          "AI Web Lab artifact extracted and attached to the mission draft as a source-linked launch."
        );
      }
    } catch (nextError) {
      setNote(null);
      setError(readErrorMessage(nextError, "Unable to extract the AI Web Lab artifact."));
    } finally {
      setExtracting(false);
    }
  }, [onApplyArtifactToDraft, settings.autoAttachArtifact]);

  const setPreferredViewMode = useCallback(
    async (value: DesktopAiWebLabViewMode) => {
      const didPersist = await persistSettingsPatch(
        { preferredViewMode: value },
        `AI Web Lab preferred view saved as ${value}.`
      );
      if (!didPersist) {
        return;
      }
      try {
        const nextState = await setAiWebLabViewMode(value);
        setState(nextState);
      } catch {}
    },
    [persistSettingsPatch]
  );

  const setPreferredSessionMode = useCallback(
    async (value: DesktopAiWebLabSessionMode) => {
      const didPersist = await persistSettingsPatch(
        { preferredSessionMode: value },
        `AI Web Lab preferred session saved as ${value}.`
      );
      if (!didPersist) {
        return;
      }
      try {
        const nextState = await setAiWebLabSessionMode(value);
        setState(nextState);
      } catch {}
    },
    [persistSettingsPatch]
  );

  const setDefaultProvider = useCallback(
    async (value: AiWebLabProviderId) => {
      const didPersist = await persistSettingsPatch(
        { defaultProvider: value },
        `AI Web Lab default provider saved as ${value}.`
      );
      if (!didPersist) {
        return;
      }
      try {
        const nextState = await navigateAiWebLab({
          providerId: value,
          url: settings.providerUrls[value],
        });
        setState(nextState);
      } catch {}
    },
    [persistSettingsPatch, settings.providerUrls]
  );

  const setAutoAttachArtifact = useCallback(
    async (value: boolean) => {
      await persistSettingsPatch(
        { autoAttachArtifact: value },
        value
          ? "AI Web Lab will auto-attach successful artifacts."
          : "AI Web Lab auto-attach disabled."
      );
    },
    [persistSettingsPatch]
  );

  const setAutoCreateWorktree = useCallback(
    async (value: boolean) => {
      await persistSettingsPatch(
        { autoCreateWorktree: value },
        value
          ? "AI Web Lab will recommend worktree-first flow."
          : "AI Web Lab worktree-first recommendation disabled."
      );
    },
    [persistSettingsPatch]
  );

  const setDefaultBaseRef = useCallback(
    async (value: string) => {
      await persistSettingsPatch(
        { defaultBaseRef: value.trim() || "origin/main" },
        "AI Web Lab default base ref saved."
      );
    },
    [persistSettingsPatch]
  );

  const saveProviderUrl = useCallback(
    async (providerId: AiWebLabProviderId, value: string) => {
      await persistSettingsPatch(
        {
          providerUrls: {
            ...settings.providerUrls,
            [providerId]: value,
          },
        },
        `AI Web Lab ${providerId} URL saved.`
      );
    },
    [persistSettingsPatch, settings.providerUrls]
  );

  const canApplyArtifactToDraft = Boolean(
    (lastArtifact ?? state?.lastArtifact)?.status === "succeeded" &&
    (lastArtifact ?? state?.lastArtifact)?.content
  );

  const worktreeRecommendation = useMemo(() => {
    if (!settings.autoCreateWorktree) {
      return null;
    }
    return `Worktree-first recommendation: create or select a worktree from ${settings.defaultBaseRef} before handing the final AI web artifact into execution.`;
  }, [settings.autoCreateWorktree, settings.defaultBaseRef]);

  return {
    applyArtifactToDraft,
    canApplyArtifactToDraft,
    catalog,
    closeSession,
    error,
    extractArtifact,
    extracting,
    focusSession,
    loading,
    note,
    openEntrypoint,
    openSession,
    refresh,
    saveProviderUrl,
    setAutoAttachArtifact,
    setAutoCreateWorktree,
    setDefaultBaseRef,
    setDefaultProvider,
    setPreferredSessionMode,
    setPreferredViewMode,
    settings,
    state,
    worktreeRecommendation,
  };
}
