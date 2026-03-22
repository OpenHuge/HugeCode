import { useCallback, useState } from "react";
import type { CodexDoctorResult, CodexUpdateResult } from "../../../types";

type UseSettingsCodexHealthStateParams = {
  nextCodexBin: string | null;
  nextCodexArgs: string | null;
  onRunDoctor: (codexBin: string | null, codexArgs: string | null) => Promise<CodexDoctorResult>;
  onRunCodexUpdate?: (
    codexBin: string | null,
    codexArgs: string | null
  ) => Promise<CodexUpdateResult>;
};

export function useSettingsCodexHealthState({
  nextCodexBin,
  nextCodexArgs,
  onRunDoctor,
  onRunCodexUpdate,
}: UseSettingsCodexHealthStateParams) {
  const [doctorState, setDoctorState] = useState<{
    status: "idle" | "running" | "done";
    result: CodexDoctorResult | null;
  }>({ status: "idle", result: null });

  const [codexUpdateState, setCodexUpdateState] = useState<{
    status: "idle" | "running" | "done";
    result: CodexUpdateResult | null;
  }>({ status: "idle", result: null });

  const handleRunDoctor = useCallback(async () => {
    setDoctorState({ status: "running", result: null });
    try {
      const result = await onRunDoctor(nextCodexBin, nextCodexArgs);
      setDoctorState({ status: "done", result });
    } catch (error) {
      setDoctorState({
        status: "done",
        result: {
          ok: false,
          codexBin: nextCodexBin,
          version: null,
          appServerOk: false,
          details: error instanceof Error ? error.message : String(error),
          path: null,
          nodeOk: false,
          nodeVersion: null,
          nodeDetails: null,
        },
      });
    }
  }, [nextCodexArgs, nextCodexBin, onRunDoctor]);

  const handleRunCodexUpdate = useCallback(async () => {
    setCodexUpdateState({ status: "running", result: null });
    try {
      if (!onRunCodexUpdate) {
        setCodexUpdateState({
          status: "done",
          result: {
            ok: false,
            method: "unknown",
            package: null,
            beforeVersion: null,
            afterVersion: null,
            upgraded: false,
            output: null,
            details: "Codex updates are not available in this build.",
          },
        });
        return;
      }

      const result = await onRunCodexUpdate(nextCodexBin, nextCodexArgs);
      setCodexUpdateState({ status: "done", result });
    } catch (error) {
      setCodexUpdateState({
        status: "done",
        result: {
          ok: false,
          method: "unknown",
          package: null,
          beforeVersion: null,
          afterVersion: null,
          upgraded: false,
          output: null,
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }, [nextCodexArgs, nextCodexBin, onRunCodexUpdate]);

  return {
    doctorState,
    codexUpdateState,
    handleRunDoctor,
    handleRunCodexUpdate,
  };
}
