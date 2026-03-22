import { useEffect, useMemo } from "react";
import { useRuntimeInstructionSkillsFacade } from "../../../application/runtime/facades/runtimeInstructionSkillsFacade";
import type { DebugEntry, WorkspaceInfo } from "../../../types";

type UseSkillsOptions = {
  activeWorkspace: WorkspaceInfo | null;
  onDebug?: (entry: DebugEntry) => void;
};

export function useSkills({ activeWorkspace, onDebug }: UseSkillsOptions) {
  const workspaceId = activeWorkspace?.id ?? null;
  const isConnected = Boolean(activeWorkspace?.connected);
  const { skills, refreshSkills } = useRuntimeInstructionSkillsFacade({
    workspaceId,
    isConnected,
    onDebug,
  });

  useEffect(() => {
    if (!workspaceId || !isConnected) {
      return;
    }
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshFromFocus = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        void refreshSkills();
      }, 500);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshFromFocus();
      }
    };

    window.addEventListener("focus", refreshFromFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshFromFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [isConnected, refreshSkills, workspaceId]);
  const skillOptions = useMemo(() => skills.filter((skill) => skill.name), [skills]);

  return {
    skills: skillOptions,
    refreshSkills,
  };
}
