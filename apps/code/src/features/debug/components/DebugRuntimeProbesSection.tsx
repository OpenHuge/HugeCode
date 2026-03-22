import { DebugRuntimeLiveSkillForm } from "./DebugRuntimeLiveSkillForm";
import { DebugRuntimeProbeActions } from "./DebugRuntimeProbeActions";
import { DebugRuntimeProbeFeedback } from "./DebugRuntimeProbeFeedback";
import type { DebugRuntimeProbesSectionProps } from "./DebugRuntimeProbes.types";

export type { DebugRuntimeProbesSectionProps } from "./DebugRuntimeProbes.types";

export function DebugRuntimeProbesSection(props: DebugRuntimeProbesSectionProps) {
  return (
    <div className="debug-runtime-probes" data-testid="debug-runtime-probes">
      <div className="debug-runtime-probes-title">Runtime probes</div>
      <DebugRuntimeProbeActions
        isRuntimeProbeBusy={props.isRuntimeProbeBusy}
        onRunHealthProbe={props.onRunHealthProbe}
        onRunRemoteStatusProbe={props.onRunRemoteStatusProbe}
        onRunTerminalStatusProbe={props.onRunTerminalStatusProbe}
        onRunSettingsProbe={props.onRunSettingsProbe}
        onRunBootstrapProbe={props.onRunBootstrapProbe}
      />
      <DebugRuntimeLiveSkillForm
        isRuntimeProbeBusy={props.isRuntimeProbeBusy}
        liveSkillId={props.liveSkillId}
        liveSkillInput={props.liveSkillInput}
        liveSkillPath={props.liveSkillPath}
        liveSkillQuery={props.liveSkillQuery}
        liveSkillMaxDepth={props.liveSkillMaxDepth}
        liveSkillMaxResults={props.liveSkillMaxResults}
        liveSkillIncludeHidden={props.liveSkillIncludeHidden}
        isCoreTreeSkillSelected={props.isCoreTreeSkillSelected}
        onLiveSkillIdChange={props.onLiveSkillIdChange}
        onLiveSkillInputChange={props.onLiveSkillInputChange}
        onLiveSkillPathChange={props.onLiveSkillPathChange}
        onLiveSkillQueryChange={props.onLiveSkillQueryChange}
        onLiveSkillMaxDepthChange={props.onLiveSkillMaxDepthChange}
        onLiveSkillMaxResultsChange={props.onLiveSkillMaxResultsChange}
        onLiveSkillIncludeHiddenChange={props.onLiveSkillIncludeHiddenChange}
        onRunLiveSkillProbe={props.onRunLiveSkillProbe}
      />
      <DebugRuntimeProbeFeedback
        runtimeProbeBusyLabel={props.runtimeProbeBusyLabel}
        runtimeProbeError={props.runtimeProbeError}
        runtimeProbeResult={props.runtimeProbeResult}
      />
    </div>
  );
}
