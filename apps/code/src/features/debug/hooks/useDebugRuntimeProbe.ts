import { useCallback, useMemo, useState } from "react";
import {
  filterRuntimeToolLifecycleSnapshot,
  getRuntimeToolLifecycleSnapshot,
} from "../../../application/runtime/ports/runtimeToolLifecycle";
import {
  getRuntimeBootstrapSnapshot,
  getRuntimeHealth,
  getRuntimeRemoteStatus,
  getRuntimeSettings,
  getRuntimeTerminalStatus,
  runRuntimeLiveSkill,
} from "../../../application/runtime/ports/tauriRuntime";
import { formatDebugPayload } from "../utils/formatDebugPayload";

const CORE_TREE_SKILL_ALIASES = new Set(["core-tree", "tree", "file-tree", "file_tree", "ls"]);

type UseDebugRuntimeProbeOptions = {
  workspaceId?: string | null;
};

function parseOptionalInteger(value: string, label: string, min: number): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} must be an integer >= ${min}.`);
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < min) {
    throw new Error(`${label} must be an integer >= ${min}.`);
  }
  return parsed;
}

export function useDebugRuntimeProbe({ workspaceId = null }: UseDebugRuntimeProbeOptions = {}) {
  const [runtimeProbeBusyLabel, setRuntimeProbeBusyLabel] = useState<string | null>(null);
  const [runtimeProbeError, setRuntimeProbeError] = useState<string | null>(null);
  const [runtimeProbeResult, setRuntimeProbeResult] = useState<string | null>(null);
  const [liveSkillId, setLiveSkillId] = useState("core-bash");
  const [liveSkillInput, setLiveSkillInput] = useState("");
  const [liveSkillPath, setLiveSkillPath] = useState(".");
  const [liveSkillQuery, setLiveSkillQuery] = useState("");
  const [liveSkillMaxDepth, setLiveSkillMaxDepth] = useState("");
  const [liveSkillMaxResults, setLiveSkillMaxResults] = useState("");
  const [liveSkillIncludeHidden, setLiveSkillIncludeHidden] = useState(false);

  const runRuntimeProbe = useCallback(async (label: string, execute: () => Promise<unknown>) => {
    setRuntimeProbeBusyLabel(label);
    setRuntimeProbeError(null);
    try {
      const result = await execute();
      setRuntimeProbeResult(formatDebugPayload(result));
    } catch (error) {
      setRuntimeProbeResult(null);
      setRuntimeProbeError(error instanceof Error ? error.message : String(error));
    } finally {
      setRuntimeProbeBusyLabel(null);
    }
  }, []);

  const runHealthProbe = useCallback(
    () => runRuntimeProbe("health", getRuntimeHealth),
    [runRuntimeProbe]
  );
  const runRemoteStatusProbe = useCallback(
    () => runRuntimeProbe("remote status", getRuntimeRemoteStatus),
    [runRuntimeProbe]
  );
  const runTerminalStatusProbe = useCallback(
    () => runRuntimeProbe("terminal status", getRuntimeTerminalStatus),
    [runRuntimeProbe]
  );
  const runSettingsProbe = useCallback(
    () => runRuntimeProbe("settings", getRuntimeSettings),
    [runRuntimeProbe]
  );
  const runBootstrapProbe = useCallback(
    () => runRuntimeProbe("bootstrap", getRuntimeBootstrapSnapshot),
    [runRuntimeProbe]
  );
  const runToolLifecycleProbe = useCallback(
    () =>
      runRuntimeProbe("tool lifecycle", async () =>
        filterRuntimeToolLifecycleSnapshot(getRuntimeToolLifecycleSnapshot(), workspaceId)
      ),
    [runRuntimeProbe, workspaceId]
  );

  const isCoreTreeSkillSelected = useMemo(
    () => CORE_TREE_SKILL_ALIASES.has(liveSkillId.trim().toLowerCase()),
    [liveSkillId]
  );

  const runLiveSkillProbe = useCallback(() => {
    const normalizedSkillId = liveSkillId.trim();
    if (!normalizedSkillId) {
      setRuntimeProbeError("Live skill id is required.");
      return;
    }
    let options:
      | {
          path?: string | null;
          query?: string | null;
          maxDepth?: number | null;
          maxResults?: number | null;
          includeHidden?: boolean | null;
        }
      | undefined;

    if (CORE_TREE_SKILL_ALIASES.has(normalizedSkillId.toLowerCase())) {
      try {
        options = {
          path: liveSkillPath.trim() || null,
          query: liveSkillQuery.trim() || null,
          maxDepth: parseOptionalInteger(liveSkillMaxDepth, "max depth", 0),
          maxResults: parseOptionalInteger(liveSkillMaxResults, "max results", 1),
          includeHidden: liveSkillIncludeHidden,
        };
      } catch (error) {
        setRuntimeProbeError(error instanceof Error ? error.message : String(error));
        return;
      }
    }

    void runRuntimeProbe("live skill", () =>
      runRuntimeLiveSkill({
        skillId: normalizedSkillId,
        input: liveSkillInput,
        ...(options ? { options } : {}),
      })
    );
  }, [
    liveSkillId,
    liveSkillIncludeHidden,
    liveSkillInput,
    liveSkillMaxDepth,
    liveSkillMaxResults,
    liveSkillPath,
    liveSkillQuery,
    runRuntimeProbe,
  ]);

  return {
    runtimeProbeBusyLabel,
    runtimeProbeError,
    runtimeProbeResult,
    liveSkillId,
    setLiveSkillId,
    liveSkillInput,
    setLiveSkillInput,
    liveSkillPath,
    setLiveSkillPath,
    liveSkillQuery,
    setLiveSkillQuery,
    liveSkillMaxDepth,
    setLiveSkillMaxDepth,
    liveSkillMaxResults,
    setLiveSkillMaxResults,
    liveSkillIncludeHidden,
    setLiveSkillIncludeHidden,
    isCoreTreeSkillSelected,
    runHealthProbe,
    runRemoteStatusProbe,
    runTerminalStatusProbe,
    runSettingsProbe,
    runBootstrapProbe,
    runToolLifecycleProbe,
    runLiveSkillProbe,
    isRuntimeProbeBusy: runtimeProbeBusyLabel !== null,
  };
}
