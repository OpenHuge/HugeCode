export type DebugRuntimeLiveSkillFormProps = {
  isRuntimeProbeBusy: boolean;
  liveSkillId: string;
  liveSkillInput: string;
  liveSkillPath: string;
  liveSkillQuery: string;
  liveSkillMaxDepth: string;
  liveSkillMaxResults: string;
  liveSkillIncludeHidden: boolean;
  isCoreTreeSkillSelected: boolean;
  onLiveSkillIdChange: (value: string) => void;
  onLiveSkillInputChange: (value: string) => void;
  onLiveSkillPathChange: (value: string) => void;
  onLiveSkillQueryChange: (value: string) => void;
  onLiveSkillMaxDepthChange: (value: string) => void;
  onLiveSkillMaxResultsChange: (value: string) => void;
  onLiveSkillIncludeHiddenChange: (checked: boolean) => void;
  onRunLiveSkillProbe: () => void;
};

export type DebugRuntimeProbeFeedbackProps = {
  runtimeProbeBusyLabel: string | null;
  runtimeProbeError: string | null;
  runtimeProbeResult: string | null;
};

export type DebugRuntimeProbeActionsProps = {
  isRuntimeProbeBusy: boolean;
  onRunHealthProbe: () => void;
  onRunToolMetricsProbe: () => void;
  onRunRemoteStatusProbe: () => void;
  onRunTerminalStatusProbe: () => void;
  onRunSettingsProbe: () => void;
  onRunBootstrapProbe: () => void;
  onRunToolLifecycleProbe: () => void;
};

export type DebugRuntimeProbesSectionProps = DebugRuntimeLiveSkillFormProps &
  DebugRuntimeProbeFeedbackProps &
  DebugRuntimeProbeActionsProps;
