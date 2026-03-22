import { Button } from "../../../design-system";
import type { DebugRuntimeProbeActionsProps } from "./DebugRuntimeProbes.types";

export function DebugRuntimeProbeActions(props: DebugRuntimeProbeActionsProps) {
  return (
    <div className="debug-runtime-probe-actions">
      <Button
        variant="ghost"
        size="sm"
        onClick={props.onRunHealthProbe}
        disabled={props.isRuntimeProbeBusy}
      >
        Health
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={props.onRunRemoteStatusProbe}
        disabled={props.isRuntimeProbeBusy}
      >
        Remote
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={props.onRunTerminalStatusProbe}
        disabled={props.isRuntimeProbeBusy}
      >
        Terminal
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={props.onRunSettingsProbe}
        disabled={props.isRuntimeProbeBusy}
      >
        Settings
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={props.onRunBootstrapProbe}
        disabled={props.isRuntimeProbeBusy}
      >
        Bootstrap
      </Button>
    </div>
  );
}
