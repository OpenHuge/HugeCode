import { Suspense, type ReactNode, useEffect, useState } from "react";
import type { WorkspaceClientBindings } from "./bindings";
import {
  WorkspaceClientBindingsProvider,
  useWorkspaceClientBindings,
  useWorkspaceClientRuntimeMode,
} from "./WorkspaceClientBindingsProvider";
import { WorkspaceWebUnavailable } from "./WorkspaceWebUnavailable";

type LocalDiscoveryState =
  | {
      status: "idle" | "probing" | "none";
      candidates: [];
    }
  | {
      status: "multiple";
      candidates: Awaited<
        ReturnType<WorkspaceClientBindings["runtimeGateway"]["discoverLocalRuntimeGatewayTargets"]>
      >;
    };

export type WorkspaceClientAppProps = {
  bootFallback?: ReactNode;
};

export type WorkspaceClientBootProps = WorkspaceClientAppProps & {
  bindings: WorkspaceClientBindings;
};

export function WorkspaceClientBoot({ bindings, bootFallback }: WorkspaceClientBootProps) {
  return (
    <WorkspaceClientBindingsProvider bindings={bindings}>
      <WorkspaceClientApp bootFallback={bootFallback} />
    </WorkspaceClientBindingsProvider>
  );
}

export function WorkspaceClientApp({ bootFallback }: WorkspaceClientAppProps) {
  const bindings = useWorkspaceClientBindings();
  const [discoveryState, setDiscoveryState] = useState<LocalDiscoveryState>({
    status: "idle",
    candidates: [],
  });
  const [isConnectingCandidate, setIsConnectingCandidate] = useState(false);
  const runtimeMode = useWorkspaceClientRuntimeMode();
  const RuntimeShell = bindings.platformUi.WorkspaceRuntimeShell;
  const shouldRenderWebUnavailable =
    bindings.host.platform === "web" && runtimeMode !== "connected";

  useEffect(() => {
    if (runtimeMode === "connected") {
      return;
    }

    let cancelled = false;
    setDiscoveryState({ status: "probing", candidates: [] });

    void bindings.runtimeGateway
      .discoverLocalRuntimeGatewayTargets()
      .then((candidates) => {
        if (cancelled) {
          return;
        }
        if (candidates.length === 1) {
          setIsConnectingCandidate(true);
          bindings.runtimeGateway.configureManualWebRuntimeGatewayTarget(candidates[0]);
          return;
        }
        if (candidates.length > 1) {
          setDiscoveryState({ status: "multiple", candidates });
          return;
        }
        setDiscoveryState({ status: "none", candidates: [] });
      })
      .catch(() => {
        if (!cancelled) {
          setDiscoveryState({ status: "none", candidates: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bindings.runtimeGateway, runtimeMode]);

  if (shouldRenderWebUnavailable) {
    return (
      <WorkspaceWebUnavailable
        runtimeMode={runtimeMode}
        probeState={discoveryState.status}
        localRuntimeCandidates={discoveryState.candidates}
        isConnectingCandidate={isConnectingCandidate}
        onSelectLocalRuntimeCandidate={(candidate) => {
          setIsConnectingCandidate(true);
          bindings.runtimeGateway.configureManualWebRuntimeGatewayTarget(candidate);
        }}
      />
    );
  }

  return (
    <Suspense fallback={bootFallback ?? null}>
      <RuntimeShell />
    </Suspense>
  );
}
