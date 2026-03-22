import type { DebugRuntimeProbeFeedbackProps } from "./DebugRuntimeProbes.types";

export function DebugRuntimeProbeFeedback({
  runtimeProbeBusyLabel,
  runtimeProbeError,
  runtimeProbeResult,
}: DebugRuntimeProbeFeedbackProps) {
  return (
    <>
      {runtimeProbeBusyLabel ? (
        <div className="debug-runtime-probe-status" data-testid="debug-runtime-probe-status">
          Running {runtimeProbeBusyLabel}...
        </div>
      ) : null}
      {runtimeProbeError ? (
        <div className="debug-runtime-probe-error" data-testid="debug-runtime-probe-error">
          {runtimeProbeError}
        </div>
      ) : null}
      {runtimeProbeResult ? (
        <pre className="debug-runtime-probe-result" data-testid="debug-runtime-probe-result">
          {runtimeProbeResult}
        </pre>
      ) : null}
    </>
  );
}
