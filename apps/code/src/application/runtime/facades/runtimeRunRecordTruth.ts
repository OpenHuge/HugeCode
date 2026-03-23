import { useRuntimeRunTruth } from "./runtimeRunTruthStore";

export type RuntimeRunRecordTruthState = {
  record: import("@ku0/code-runtime-host-contract").RuntimeRunGetV2Response | null;
  loading: boolean;
  error: string | null;
};

export function useRuntimeRunRecordTruth(input: {
  runId: string | null;
  workspaceId?: string | null;
}): RuntimeRunRecordTruthState {
  const snapshot = useRuntimeRunTruth({
    runId: input.runId,
    workspaceId: input.workspaceId,
  });

  return {
    record: snapshot.record,
    loading: snapshot.loading,
    error: snapshot.error,
  };
}
