import { useCallback, useEffect, useRef, useState } from "react";
import { getAppServerRawMethod } from "../../../utils/appServerEvents";
import type { DebugEntry, SkillOption } from "../../../types";
import { useScopedRuntimeUpdatedEvent } from "../ports/runtimeUpdatedEvents";
import { getInstructionSkill, getSkillsList } from "../ports/tauriSkills";
import type { RuntimeUpdatedEvent } from "../ports/runtimeUpdatedEvents";

type RuntimeInstructionSkillsFacadeOptions = {
  workspaceId: string | null;
  isConnected: boolean;
  onDebug?: (entry: DebugEntry) => void;
};

type RuntimeInstructionSkillsFacadeState = {
  skills: SkillOption[];
  refreshSkills: () => Promise<void>;
};

type SkillsDataBucket = {
  skills?: unknown;
};

type SkillsResultPayload = {
  data?: unknown;
  skills?: unknown;
};

type SkillsResponse = {
  data?: unknown;
  skills?: unknown;
  result?: SkillsResultPayload | null;
};

function normalizeInstructionSkillsResponse(response: SkillsResponse): SkillOption[] {
  const dataBuckets = response.result?.data ?? response.data ?? [];
  const rawSkills =
    response.result?.skills ??
    response.skills ??
    (Array.isArray(dataBuckets)
      ? dataBuckets.flatMap((bucket) => {
          const typedBucket = (bucket ?? {}) as SkillsDataBucket;
          return Array.isArray(typedBucket.skills) ? typedBucket.skills : [];
        })
      : []);

  if (!Array.isArray(rawSkills)) {
    return [];
  }

  return rawSkills.map((item) => {
    const record = (item ?? {}) as {
      name?: unknown;
      path?: unknown;
      description?: unknown;
      scope?: unknown;
      sourceFamily?: unknown;
      source_family?: unknown;
      enabled?: unknown;
      aliases?: unknown;
      shadowedBy?: unknown;
      shadowed_by?: unknown;
    };
    const aliases = Array.isArray(record.aliases)
      ? record.aliases.filter((entry): entry is string => typeof entry === "string")
      : undefined;
    const scope =
      record.scope === "workspace" || record.scope === "global" ? record.scope : undefined;
    return {
      name: String(record.name ?? ""),
      path: String(record.path ?? ""),
      description: record.description ? String(record.description) : undefined,
      ...(scope ? { scope } : {}),
      ...(record.sourceFamily || record.source_family
        ? { sourceFamily: String(record.sourceFamily ?? record.source_family) }
        : {}),
      ...(typeof record.enabled === "boolean" ? { enabled: record.enabled } : {}),
      ...(aliases && aliases.length > 0 ? { aliases } : {}),
      ...(record.shadowedBy !== undefined || record.shadowed_by !== undefined
        ? { shadowedBy: (record.shadowedBy ?? record.shadowed_by ?? null) as string | null }
        : {}),
    };
  });
}

function shouldRefreshInstructionSkills(runtimeEvent: RuntimeUpdatedEvent | null): boolean {
  if (!runtimeEvent) {
    return false;
  }
  const method = getAppServerRawMethod(runtimeEvent.event);
  if (method === "native_state_fabric_updated") {
    return runtimeEvent.scope.includes("skills");
  }
  if (method === "runtime/updated") {
    return runtimeEvent.scope.some((scope) => scope === "skills" || scope === "plugins");
  }
  return false;
}

export function listInstructionSkills(workspaceId: string) {
  return getSkillsList(workspaceId);
}

export function readInstructionSkill(workspaceId: string, skillPath: string) {
  return getInstructionSkill(workspaceId, skillPath);
}

export function useRuntimeInstructionSkillsFacade({
  workspaceId,
  isConnected,
  onDebug,
}: RuntimeInstructionSkillsFacadeOptions): RuntimeInstructionSkillsFacadeState {
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const lastFetchedWorkspaceId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const refreshQueued = useRef(false);
  const latestWorkspaceIdRef = useRef<string | null>(null);
  const refreshSkillsRef = useRef<() => Promise<void>>(async () => undefined);
  const runtimeUpdatedSnapshot = useScopedRuntimeUpdatedEvent({
    enabled: Boolean(workspaceId && isConnected),
    workspaceId,
    scopes: ["skills", "plugins"],
  });

  useEffect(() => {
    latestWorkspaceIdRef.current = workspaceId;
    if (!isConnected) {
      lastFetchedWorkspaceId.current = null;
    }
  }, [isConnected, workspaceId]);

  const refreshSkills = useCallback(async () => {
    if (!workspaceId || !isConnected) {
      return;
    }
    if (inFlight.current) {
      refreshQueued.current = true;
      return;
    }
    inFlight.current = true;
    const workspaceIdAtRequest = workspaceId;
    onDebug?.({
      id: `${Date.now()}-client-skills-list`,
      timestamp: Date.now(),
      source: "client",
      label: "skills/list",
      payload: { workspaceId },
    });
    try {
      const response = (await listInstructionSkills(workspaceId)) as SkillsResponse;
      onDebug?.({
        id: `${Date.now()}-server-skills-list`,
        timestamp: Date.now(),
        source: "server",
        label: "skills/list response",
        payload: response,
      });
      if (latestWorkspaceIdRef.current !== workspaceIdAtRequest) {
        return;
      }
      setSkills(normalizeInstructionSkillsResponse(response));
      lastFetchedWorkspaceId.current = workspaceIdAtRequest;
    } catch (error) {
      onDebug?.({
        id: `${Date.now()}-client-skills-list-error`,
        timestamp: Date.now(),
        source: "error",
        label: "skills/list error",
        payload: error instanceof Error ? error.message : String(error),
      });
    } finally {
      inFlight.current = false;
      if (refreshQueued.current) {
        refreshQueued.current = false;
        void refreshSkillsRef.current();
      }
    }
  }, [isConnected, onDebug, workspaceId]);

  useEffect(() => {
    refreshSkillsRef.current = refreshSkills;
  }, [refreshSkills]);

  useEffect(() => {
    if (!workspaceId || !isConnected) {
      return;
    }
    if (lastFetchedWorkspaceId.current === workspaceId && skills.length > 0) {
      return;
    }
    void refreshSkills();
  }, [isConnected, refreshSkills, skills.length, workspaceId]);

  useEffect(() => {
    const runtimeEvent = runtimeUpdatedSnapshot.lastEvent;
    if (!runtimeEvent || !shouldRefreshInstructionSkills(runtimeEvent)) {
      return;
    }
    onDebug?.({
      id: `${Date.now()}-server-runtime-instruction-skills-refresh`,
      timestamp: Date.now(),
      source: "server",
      label: "runtime instruction skills refresh",
      payload: runtimeEvent.event,
    });
    void refreshSkillsRef.current();
  }, [onDebug, runtimeUpdatedSnapshot]);

  return {
    skills,
    refreshSkills,
  };
}
