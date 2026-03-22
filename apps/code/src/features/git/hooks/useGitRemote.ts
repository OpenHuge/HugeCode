import { useEffect, useRef, useState } from "react";
import { getGitRemote } from "../../../application/runtime/ports/tauriGit";
import type { WorkspaceInfo } from "../../../types";

type GitRemoteState = {
  remote: string | null;
  error: string | null;
};

const emptyState: GitRemoteState = {
  remote: null,
  error: null,
};

export function useGitRemote(activeWorkspace: WorkspaceInfo | null) {
  const [state, setState] = useState<GitRemoteState>(emptyState);
  const workspaceIdRef = useRef<string | null>(activeWorkspace?.id ?? null);

  useEffect(() => {
    const workspaceId = activeWorkspace?.id ?? null;
    if (!workspaceId) {
      setState(emptyState);
      return;
    }
    if (workspaceIdRef.current !== workspaceId) {
      workspaceIdRef.current = workspaceId;
      setState(emptyState);
    }
    let isActive = true;
    (async () => {
      try {
        const remote = await getGitRemote(workspaceId);
        if (!isActive) {
          return;
        }
        setState({ remote, error: null });
      } catch (error) {
        if (!isActive) {
          return;
        }
        setState({
          remote: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return () => {
      isActive = false;
    };
  }, [activeWorkspace?.id]);

  return state;
}
