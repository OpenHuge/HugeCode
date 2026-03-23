import { useEffect, useState } from "react";
import type { RuntimeRunGetV2Response } from "@ku0/code-runtime-host-contract";
import { getRuntimeRunV2 } from "../ports/tauriRuntimeJobs";

export type RuntimeRunRecordTruthState = {
  record: RuntimeRunGetV2Response | null;
  loading: boolean;
  error: string | null;
};

export function useRuntimeRunRecordTruth(input: {
  runId: string | null;
}): RuntimeRunRecordTruthState {
  const [record, setRecord] = useState<RuntimeRunGetV2Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!input.runId) {
      setRecord(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void getRuntimeRunV2({ runId: input.runId })
      .then((nextRecord) => {
        if (cancelled) {
          return;
        }
        setRecord(nextRecord ?? null);
        setError(null);
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }
        setRecord(null);
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [input.runId]);

  return {
    record,
    loading,
    error,
  };
}
