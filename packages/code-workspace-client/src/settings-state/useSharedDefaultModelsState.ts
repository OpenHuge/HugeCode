import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceClientRuntimeBindings } from "../workspace/WorkspaceClientBindingsProvider";

export type SharedDefaultModelOption = {
  id: string;
  model: string;
  displayName: string;
  description: string;
  provider?: string | null;
  pool?: string | null;
  source?: string | null;
  available?: boolean;
  supportedReasoningEfforts: Array<{
    reasoningEffort: string;
    description: string;
  }>;
  defaultReasoningEffort: string | null;
  isDefault: boolean;
};

export type SharedDefaultModelsWorkspace = {
  id: string;
  name: string;
  connected: boolean;
};

type SharedDefaultModelsState = {
  models: SharedDefaultModelOption[];
  isLoading: boolean;
  error: string | null;
  connectedWorkspaceCount: number;
};

type UseSharedDefaultModelsStateOptions = {
  enabled?: boolean;
  parseModelListResponse: (response: unknown) => SharedDefaultModelOption[];
  mapModel: (model: SharedDefaultModelOption) => SharedDefaultModelOption;
  compareModels: (left: SharedDefaultModelOption, right: SharedDefaultModelOption) => number;
};

const EMPTY_STATE: SharedDefaultModelsState = {
  models: [],
  isLoading: false,
  error: null,
  connectedWorkspaceCount: 0,
};

export function useSharedDefaultModelsState(
  projects: SharedDefaultModelsWorkspace[],
  {
    enabled = true,
    parseModelListResponse,
    mapModel,
    compareModels,
  }: UseSharedDefaultModelsStateOptions
) {
  const runtime = useWorkspaceClientRuntimeBindings();
  const [state, setState] = useState<SharedDefaultModelsState>(EMPTY_STATE);
  const requestIdRef = useRef(0);
  const lastAutoRefreshSignatureRef = useRef<string | null>(null);
  const enabledRef = useRef(enabled);
  const connectedWorkspaces = useMemo(
    () => projects.filter((workspace) => workspace.connected),
    [projects]
  );
  const connectedWorkspaceSignature = useMemo(
    () => JSON.stringify(connectedWorkspaces.map((workspace) => [workspace.id, workspace.name])),
    [connectedWorkspaces]
  );
  const connectedWorkspacesRef = useRef(connectedWorkspaces);

  useEffect(() => {
    connectedWorkspacesRef.current = connectedWorkspaces;
  }, [connectedWorkspaces]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const refresh = useCallback(async () => {
    if (!enabledRef.current) {
      return;
    }
    const connected = connectedWorkspacesRef.current;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    if (connected.length === 0) {
      setState(EMPTY_STATE);
      return;
    }

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      connectedWorkspaceCount: connected.length,
    }));

    try {
      const representativeWorkspace = connected[0];
      const result = await runtime.models.getModelList(representativeWorkspace.id);
      if (requestId !== requestIdRef.current) {
        return;
      }
      const models = parseModelListResponse(result).map(mapModel).sort(compareModels);
      setState({
        models,
        isLoading: false,
        error: null,
        connectedWorkspaceCount: connected.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (requestId === requestIdRef.current) {
        const representativeWorkspace = connected[0];
        const workspaceName = representativeWorkspace?.name ?? "workspace";
        setState({
          models: [],
          isLoading: false,
          error: `${workspaceName}: ${message}`,
          connectedWorkspaceCount: connected.length,
        });
      }
    }
  }, [compareModels, mapModel, parseModelListResponse, runtime.models]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (lastAutoRefreshSignatureRef.current === connectedWorkspaceSignature) {
      return;
    }
    lastAutoRefreshSignatureRef.current = connectedWorkspaceSignature;
    void refresh();
  }, [connectedWorkspaceSignature, enabled, refresh]);

  return {
    ...state,
    refresh,
  };
}
