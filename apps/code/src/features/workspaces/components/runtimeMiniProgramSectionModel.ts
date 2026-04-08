import type {
  RuntimeMiniProgramAction,
  RuntimeMiniProgramActionRunRequest,
  RuntimeMiniProgramCompileType,
  RuntimeMiniProgramInfoOutputMode,
  RuntimeMiniProgramQrOutputMode,
  RuntimeMiniProgramStatusResponse,
} from "@ku0/code-runtime-host-contract";

export type RuntimeMiniProgramPreviewDraft = {
  pathName: string;
  query: string;
  scene: string;
  qrOutputMode: RuntimeMiniProgramQrOutputMode;
  infoOutputMode: RuntimeMiniProgramInfoOutputMode;
};

export type RuntimeMiniProgramUploadDraft = {
  version: string;
  desc: string;
  infoOutputMode: RuntimeMiniProgramInfoOutputMode;
};

export type RuntimeMiniProgramActionAvailability = {
  projectReady: boolean;
  canOpenProject: boolean;
  canRefreshProject: boolean;
  canResetFileWatch: boolean;
  canBuildNpm: boolean;
  canPreview: boolean;
  canUpload: boolean;
};

function supportsAction(
  status: RuntimeMiniProgramStatusResponse | null,
  action: RuntimeMiniProgramAction
) {
  return status?.supportedActions.includes(action) ?? false;
}

function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readRuntimeMiniProgramStatusTone(status: RuntimeMiniProgramStatusResponse | null) {
  if (!status) {
    return "neutral" as const;
  }
  switch (status.status) {
    case "ready":
      return "success" as const;
    case "blocked":
    case "unavailable":
      return "danger" as const;
    default:
      return "warning" as const;
  }
}

export function readRuntimeMiniProgramStatusLabel(status: RuntimeMiniProgramStatusResponse | null) {
  if (!status) {
    return "Loading";
  }
  switch (status.status) {
    case "ready":
      return "Ready";
    case "blocked":
      return "Blocked";
    case "unavailable":
      return "Unavailable";
    default:
      return "Attention";
  }
}

export function readRuntimeMiniProgramServiceTone(
  serviceStatus: RuntimeMiniProgramStatusResponse["serviceStatus"] | null | undefined
) {
  if (serviceStatus === "running") {
    return "success" as const;
  }
  if (serviceStatus === "stopped" || serviceStatus === "unavailable") {
    return "warning" as const;
  }
  return "neutral" as const;
}

export function readRuntimeMiniProgramBuildCompileType(
  status: RuntimeMiniProgramStatusResponse | null
): Exclude<RuntimeMiniProgramCompileType, "unknown"> | null {
  if (status?.project.compileType === "plugin") {
    return "plugin";
  }
  if (status?.project.compileType === "miniprogram") {
    return "miniprogram";
  }
  return null;
}

export function buildRuntimeMiniProgramActionAvailability(input: {
  status: RuntimeMiniProgramStatusResponse | null;
  uploadVersion: string;
}): RuntimeMiniProgramActionAvailability {
  const { status, uploadVersion } = input;
  const projectReady = status?.project.valid ?? false;
  return {
    projectReady,
    canOpenProject: supportsAction(status, "open_project"),
    canRefreshProject: supportsAction(status, "refresh_project"),
    canResetFileWatch: supportsAction(status, "reset_file_watch"),
    canBuildNpm: projectReady && supportsAction(status, "build_npm"),
    canPreview: projectReady && supportsAction(status, "preview"),
    canUpload: projectReady && supportsAction(status, "upload") && uploadVersion.trim().length > 0,
  };
}

export function buildRuntimeMiniProgramPreviewRequest(
  draft: RuntimeMiniProgramPreviewDraft
): Omit<RuntimeMiniProgramActionRunRequest, "workspaceId"> {
  const scene = Number.isFinite(Number(draft.scene)) ? Number(draft.scene) : null;
  return {
    action: "preview",
    compileCondition: {
      pathName: trimOrNull(draft.pathName),
      query: trimOrNull(draft.query),
      scene,
    },
    qrOutputMode: draft.qrOutputMode,
    infoOutputMode: draft.infoOutputMode,
  };
}

export function buildRuntimeMiniProgramUploadRequest(
  draft: RuntimeMiniProgramUploadDraft
): Omit<RuntimeMiniProgramActionRunRequest, "workspaceId"> {
  return {
    action: "upload",
    version: draft.version.trim(),
    desc: trimOrNull(draft.desc),
    infoOutputMode: draft.infoOutputMode,
  };
}
