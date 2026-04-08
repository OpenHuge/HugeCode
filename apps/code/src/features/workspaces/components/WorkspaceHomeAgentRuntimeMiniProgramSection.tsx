import { useState } from "react";
import { ToolCallChip } from "../../../design-system";
import { useRuntimeMiniProgramOperator } from "../../../application/runtime/facades/runtimeMiniProgramOperator";
import { MissionControlSectionCard } from "./WorkspaceHomeMissionControlSections";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";

type WorkspaceHomeAgentRuntimeMiniProgramSectionProps = {
  workspaceId: string;
};

function supportsAction(
  status: ReturnType<typeof useRuntimeMiniProgramOperator>["status"],
  action:
    | "open_project"
    | "refresh_project"
    | "build_npm"
    | "preview"
    | "upload"
    | "reset_file_watch"
) {
  return status?.supportedActions.includes(action) ?? false;
}

function readStatusTone(status: ReturnType<typeof useRuntimeMiniProgramOperator>["status"]) {
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

function readStatusLabel(status: ReturnType<typeof useRuntimeMiniProgramOperator>["status"]) {
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

export function WorkspaceHomeAgentRuntimeMiniProgramSection({
  workspaceId,
}: WorkspaceHomeAgentRuntimeMiniProgramSectionProps) {
  const miniProgram = useRuntimeMiniProgramOperator(workspaceId);
  const status = miniProgram.status;
  const [compilePathName, setCompilePathName] = useState("");
  const [compileQuery, setCompileQuery] = useState("");
  const [compileScene, setCompileScene] = useState("1011");
  const [previewQrOutputMode, setPreviewQrOutputMode] = useState<
    "none" | "terminal" | "base64" | "image"
  >("base64");
  const [previewInfoOutputMode, setPreviewInfoOutputMode] = useState<"none" | "inline">("inline");
  const [uploadVersion, setUploadVersion] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadInfoOutputMode, setUploadInfoOutputMode] = useState<"none" | "inline">("inline");
  const projectReady = status?.project.valid ?? false;
  const canOpenProject = supportsAction(status, "open_project");
  const canRefreshProject = supportsAction(status, "refresh_project");
  const canResetFileWatch = supportsAction(status, "reset_file_watch");
  const canBuildNpm = projectReady && supportsAction(status, "build_npm");
  const canPreview = projectReady && supportsAction(status, "preview");
  const canUpload =
    projectReady && supportsAction(status, "upload") && uploadVersion.trim().length > 0;

  return (
    <MissionControlSectionCard
      title="Mini Program readiness"
      statusLabel={readStatusLabel(status)}
      statusTone={readStatusTone(status)}
      meta={
        <>
          <ToolCallChip tone="neutral">Host {status?.hostOs ?? "n/a"}</ToolCallChip>
          <ToolCallChip tone={status?.devtoolsInstalled ? "success" : "warning"}>
            DevTools {status?.devtoolsInstalled ? "installed" : "missing"}
          </ToolCallChip>
          <ToolCallChip
            tone={
              status?.serviceStatus === "running"
                ? "success"
                : status?.serviceStatus === "stopped" || status?.serviceStatus === "unavailable"
                  ? "warning"
                  : "neutral"
            }
          >
            HTTP V2 {status?.serviceStatus ?? "unknown"}
          </ToolCallChip>
          <ToolCallChip tone={status?.loginStatus === "logged_in" ? "success" : "neutral"}>
            Login {status?.loginStatus ?? "unknown"}
          </ToolCallChip>
        </>
      }
    >
      <div
        className="workspace-home-code-runtime-item"
        data-testid="workspace-runtime-mini-program"
      >
        <div className="workspace-home-code-runtime-item-main">
          <strong>
            {status?.project.valid
              ? "Workspace looks like a WeChat Mini Program project."
              : "Workspace root is not currently recognized as a valid Mini Program project."}
          </strong>
          <span>
            CLI: {status?.cliPath ?? "not found"} | HTTP port:{" "}
            {status?.httpPort ? String(status.httpPort) : "n/a"}
          </span>
          <span>
            Project config: {status?.project.projectConfigPath ?? "missing"} | appId:{" "}
            {status?.project.appId ?? "n/a"}
          </span>
          <span>
            Compile type: {status?.project.compileType ?? "unknown"} | miniprogramRoot:{" "}
            {status?.project.miniprogramRoot ?? "n/a"} | pluginRoot:{" "}
            {status?.project.pluginRoot ?? "n/a"}
          </span>
          <span>
            miniprogram-ci: {status?.miniprogramCi.available ? "available" : "not detected"} |
            version {status?.miniprogramCi.version ?? "n/a"}
          </span>
          <span>
            Supported actions:{" "}
            {status?.supportedActions.length ? status.supportedActions.join(", ") : "none"}
          </span>
        </div>
        <div className="workspace-home-code-runtime-item-actions">
          <button
            type="button"
            disabled={miniProgram.loading || miniProgram.refreshing}
            onClick={() => void miniProgram.refresh()}
          >
            {miniProgram.refreshing ? "Refreshing..." : "Refresh status"}
          </button>
        </div>
      </div>
      {miniProgram.notice ? (
        <div
          className={
            miniProgram.notice.tone === "danger"
              ? controlStyles.error
              : miniProgram.notice.tone === "warning"
                ? controlStyles.warning
                : controlStyles.sectionMeta
          }
        >
          {miniProgram.notice.message}
        </div>
      ) : null}
      <div className="workspace-home-code-runtime-item">
        <div className="workspace-home-code-runtime-item-main">
          <strong>Project window</strong>
          <span>Open or refresh the current workspace in WeChat DevTools.</span>
        </div>
        <div className="workspace-home-code-runtime-item-actions">
          <button
            type="button"
            disabled={miniProgram.runningAction !== null || !canOpenProject}
            onClick={() => void miniProgram.runAction({ action: "open_project" })}
          >
            {miniProgram.runningAction === "open_project" ? "Opening..." : "Open project"}
          </button>
          <button
            type="button"
            disabled={miniProgram.runningAction !== null || !canRefreshProject}
            onClick={() => void miniProgram.runAction({ action: "refresh_project" })}
          >
            {miniProgram.runningAction === "refresh_project" ? "Refreshing..." : "Refresh project"}
          </button>
          <button
            type="button"
            disabled={miniProgram.runningAction !== null || !canResetFileWatch}
            onClick={() => void miniProgram.runAction({ action: "reset_file_watch" })}
          >
            {miniProgram.runningAction === "reset_file_watch" ? "Resetting..." : "Reset file watch"}
          </button>
        </div>
      </div>
      <div className="workspace-home-code-runtime-item">
        <div className="workspace-home-code-runtime-item-main">
          <strong>Build npm</strong>
          <span>Run the official DevTools npm build flow for this project.</span>
        </div>
        <div className="workspace-home-code-runtime-item-actions">
          <button
            type="button"
            disabled={miniProgram.runningAction !== null || !canBuildNpm}
            onClick={() =>
              void miniProgram.runAction({
                action: "build_npm",
                compileType:
                  status?.project.compileType === "plugin"
                    ? "plugin"
                    : status?.project.compileType === "miniprogram"
                      ? "miniprogram"
                      : null,
              })
            }
          >
            {miniProgram.runningAction === "build_npm" ? "Building..." : "Build npm"}
          </button>
        </div>
      </div>
      <div className="workspace-home-code-runtime-item">
        <div className="workspace-home-code-runtime-item-main">
          <strong>Preview</strong>
          <span>Generate a preview package through WeChat DevTools.</span>
        </div>
        <div className={controlStyles.controlGrid}>
          <label className={controlStyles.field}>
            <span>Path name</span>
            <input
              className={controlStyles.fieldControl}
              type="text"
              value={compilePathName}
              onChange={(event) => setCompilePathName(event.target.value)}
              placeholder="pages/index/index"
            />
          </label>
          <label className={controlStyles.field}>
            <span>Query</span>
            <input
              className={controlStyles.fieldControl}
              type="text"
              value={compileQuery}
              onChange={(event) => setCompileQuery(event.target.value)}
              placeholder="foo=bar"
            />
          </label>
          <label className={controlStyles.field}>
            <span>Scene</span>
            <input
              className={controlStyles.fieldControl}
              type="text"
              value={compileScene}
              onChange={(event) => setCompileScene(event.target.value)}
            />
          </label>
          <label className={controlStyles.field}>
            <span>QR output</span>
            <select
              className={controlStyles.fieldControl}
              value={previewQrOutputMode}
              onChange={(event) =>
                setPreviewQrOutputMode(
                  event.target.value === "image"
                    ? "image"
                    : event.target.value === "terminal"
                      ? "terminal"
                      : event.target.value === "none"
                        ? "none"
                        : "base64"
                )
              }
            >
              <option value="base64">Base64</option>
              <option value="image">Image</option>
              <option value="terminal">Terminal</option>
              <option value="none">None</option>
            </select>
          </label>
          <label className={controlStyles.field}>
            <span>Info output</span>
            <select
              className={controlStyles.fieldControl}
              value={previewInfoOutputMode}
              onChange={(event) =>
                setPreviewInfoOutputMode(event.target.value === "none" ? "none" : "inline")
              }
            >
              <option value="inline">Inline</option>
              <option value="none">None</option>
            </select>
          </label>
        </div>
        <div className={controlStyles.actions}>
          <button
            className={controlStyles.actionButton}
            type="button"
            disabled={miniProgram.runningAction !== null || !canPreview}
            onClick={() =>
              void miniProgram.runAction({
                action: "preview",
                compileCondition: {
                  pathName: compilePathName || null,
                  query: compileQuery || null,
                  scene: Number.isFinite(Number(compileScene)) ? Number(compileScene) : null,
                },
                qrOutputMode: previewQrOutputMode,
                infoOutputMode: previewInfoOutputMode,
              })
            }
          >
            {miniProgram.runningAction === "preview" ? "Previewing..." : "Preview"}
          </button>
        </div>
      </div>
      <div className="workspace-home-code-runtime-item">
        <div className="workspace-home-code-runtime-item-main">
          <strong>Upload</strong>
          <span>Upload the project through the official DevTools upload flow.</span>
        </div>
        <div className={controlStyles.controlGrid}>
          <label className={controlStyles.field}>
            <span>Version</span>
            <input
              className={controlStyles.fieldControl}
              type="text"
              value={uploadVersion}
              onChange={(event) => setUploadVersion(event.target.value)}
              placeholder="Required, for example 1.0.0"
            />
          </label>
          <label className={controlStyles.field}>
            <span>Desc</span>
            <input
              className={controlStyles.fieldControl}
              type="text"
              value={uploadDesc}
              onChange={(event) => setUploadDesc(event.target.value)}
              placeholder="Optional upload note"
            />
          </label>
          <label className={controlStyles.field}>
            <span>Info output</span>
            <select
              className={controlStyles.fieldControl}
              value={uploadInfoOutputMode}
              onChange={(event) =>
                setUploadInfoOutputMode(event.target.value === "none" ? "none" : "inline")
              }
            >
              <option value="inline">Inline</option>
              <option value="none">None</option>
            </select>
          </label>
        </div>
        <div className={controlStyles.actions}>
          <button
            className={controlStyles.actionButton}
            type="button"
            disabled={miniProgram.runningAction !== null || !canUpload}
            onClick={() =>
              void miniProgram.runAction({
                action: "upload",
                version: uploadVersion.trim(),
                desc: uploadDesc || null,
                infoOutputMode: uploadInfoOutputMode,
              })
            }
          >
            {miniProgram.runningAction === "upload" ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
      {miniProgram.lastActionResult ? (
        <div
          className="workspace-home-code-runtime-item"
          data-testid="workspace-runtime-mini-program-last-action"
        >
          <div className="workspace-home-code-runtime-item-main">
            <strong>
              Last action: {miniProgram.lastActionResult.action} (
              {miniProgram.lastActionResult.status})
            </strong>
            <span>{miniProgram.lastActionResult.message}</span>
            <span>Exit code: {miniProgram.lastActionResult.exitCode ?? "n/a"}</span>
            {miniProgram.lastActionResult.qrCode ? (
              <span>
                QR output: {miniProgram.lastActionResult.qrCode.format}
                {miniProgram.lastActionResult.qrCode.outputPath
                  ? ` (${miniProgram.lastActionResult.qrCode.outputPath})`
                  : ""}
              </span>
            ) : null}
            {miniProgram.lastActionResult.info ? (
              <div className={controlStyles.extractionPreview}>
                {JSON.stringify(miniProgram.lastActionResult.info, null, 2)}
              </div>
            ) : null}
            {miniProgram.lastActionResult.stdout ? (
              <div className={controlStyles.extractionPreview}>
                {miniProgram.lastActionResult.stdout}
              </div>
            ) : null}
            {miniProgram.lastActionResult.stderr ? (
              <div className={controlStyles.extractionPreview}>
                {miniProgram.lastActionResult.stderr}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </MissionControlSectionCard>
  );
}
