import { useEffect, useMemo, useState } from "react";
import {
  bootManagedPreview,
  parsePreviewTargetCandidates,
  type PreviewBootResult,
  type PreviewTargetCandidate,
} from "../../../application/runtime/facades/runtimeBrowserWorkspacePreview";
import {
  ensureDesktopBrowserWorkspaceSession,
  listDesktopBrowserWorkspaceSessions,
  setDesktopBrowserWorkspaceAgentAttached,
  setDesktopBrowserWorkspaceDevtoolsOpen,
  setDesktopBrowserWorkspaceHost,
  setDesktopBrowserWorkspacePreviewServerStatus,
  setDesktopBrowserWorkspaceProfileMode,
} from "../../../application/runtime/ports/desktopBrowserWorkspace";
import type {
  DesktopBrowserWorkspaceSessionInfo,
  DesktopBrowserWorkspaceSessionKind,
} from "../../../application/runtime/ports/desktopHostBridge";
import { readWorkspaceFile } from "../../../application/runtime/ports/tauriWorkspaceFiles";
import {
  openRuntimeTerminalSession,
  readRuntimeTerminalSession,
  writeRuntimeTerminalSession,
} from "../../../application/runtime/ports/tauriRuntimeTerminal";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";

type WorkspaceHomeBrowserWorkspacePanelProps = {
  workspaceId: string;
};

const SESSION_KINDS: DesktopBrowserWorkspaceSessionKind[] = ["preview", "debug", "research"];

function isLoopbackPreviewTarget(url: string | null) {
  return (
    typeof url === "string" && /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(url)
  );
}

function sortSessions(sessions: DesktopBrowserWorkspaceSessionInfo[]) {
  return [...sessions].sort((left, right) => {
    const leftIndex = SESSION_KINDS.indexOf(left.kind);
    const rightIndex = SESSION_KINDS.indexOf(right.kind);
    return leftIndex - rightIndex;
  });
}

export function WorkspaceHomeBrowserWorkspacePanel({
  workspaceId,
}: WorkspaceHomeBrowserWorkspacePanelProps) {
  const [sessions, setSessions] = useState<DesktopBrowserWorkspaceSessionInfo[]>([]);
  const [activeKind, setActiveKind] = useState<DesktopBrowserWorkspaceSessionKind>("preview");
  const [explicitUrl, setExplicitUrl] = useState("");
  const [candidates, setCandidates] = useState<PreviewTargetCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootResult, setBootResult] = useState<PreviewBootResult | null>(null);

  const refresh = async () => {
    const nextSessions = sortSessions(await listDesktopBrowserWorkspaceSessions());
    setSessions(nextSessions);
    try {
      const packageJson = await readWorkspaceFile(workspaceId, "package.json");
      const nextCandidates = parsePreviewTargetCandidates(packageJson.content);
      setCandidates(nextCandidates);
      setSelectedCandidateId((current) => current || nextCandidates[0]?.id || "");
    } catch {
      setCandidates([]);
      setSelectedCandidateId("");
    }
  };

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.kind === activeKind) ?? null,
    [activeKind, sessions]
  );
  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [candidates, selectedCandidateId]
  );

  const withBusy = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };

  const handleEnsureSession = (kind: DesktopBrowserWorkspaceSessionKind) =>
    withBusy(async () => {
      const nextSession = await ensureDesktopBrowserWorkspaceSession({
        kind,
        host: kind === "preview" ? "pane" : "window",
        workspaceId,
      });
      setActiveKind(kind);
      if (!nextSession) {
        throw new Error("Unable to open browser workspace session.");
      }
      await refresh();
    });

  const handleBootPreview = (input?: {
    explicitUrl?: string | null;
    candidate?: PreviewTargetCandidate | null;
  }) =>
    withBusy(async () => {
      const result = await bootManagedPreview({
        workspaceId,
        explicitUrl: input?.explicitUrl ?? null,
        candidate: input?.candidate ?? null,
        deps: {
          ensurePreviewSession: async (previewInput) =>
            ensureDesktopBrowserWorkspaceSession({
              kind: "preview",
              host: "pane",
              workspaceId: previewInput.workspaceId,
              targetUrl: previewInput.targetUrl ?? null,
              previewServerStatus: previewInput.previewServerStatus,
            }),
          openRuntimeTerminalSession,
          readRuntimeTerminalSession,
          setPreviewSessionStatus: setDesktopBrowserWorkspacePreviewServerStatus,
          writeRuntimeTerminalSession,
        },
      });
      setBootResult(result);
      if (result.error) {
        setError(result.error);
      } else {
        setActiveKind("preview");
      }
      await refresh();
    });

  return (
    <div className={controlStyles.controlSection}>
      <div className={controlStyles.sectionHeader}>
        <div className={controlStyles.sectionTitle}>Browser workspace</div>
        <div className={controlStyles.sectionMeta}>
          {activeSession ? activeSession.previewServerStatus : "No active session"}
        </div>
      </div>

      <div className={controlStyles.actions}>
        {SESSION_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={controlStyles.actionButton}
            onClick={() => void handleEnsureSession(kind)}
            disabled={busy}
          >
            {kind === "preview" ? "Preview" : kind === "debug" ? "Debug" : "Research"}
          </button>
        ))}
      </div>

      <div className={controlStyles.controlGrid}>
        <label className={controlStyles.field}>
          <span>Manual loopback URL</span>
          <input
            className={controlStyles.fieldControl}
            value={explicitUrl}
            onChange={(event) => setExplicitUrl(event.target.value)}
            placeholder="http://127.0.0.1:5173"
          />
        </label>
        <label className={controlStyles.field}>
          <span>Managed preview command</span>
          <select
            className={controlStyles.fieldControl}
            value={selectedCandidateId}
            onChange={(event) => setSelectedCandidateId(event.target.value)}
          >
            <option value="">No detected preview script</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={controlStyles.actions}>
        <button
          type="button"
          className={controlStyles.actionButton}
          onClick={() => void handleBootPreview({ explicitUrl })}
          disabled={busy || explicitUrl.trim().length === 0}
        >
          Open loopback preview
        </button>
        <button
          type="button"
          className={controlStyles.actionButton}
          onClick={() => void handleBootPreview({ candidate: selectedCandidate })}
          disabled={busy || !selectedCandidate}
        >
          Start managed preview
        </button>
        <button
          type="button"
          className={controlStyles.actionButton}
          onClick={() => void refresh()}
          disabled={busy}
        >
          Refresh
        </button>
      </div>

      {activeSession ? (
        <>
          <div className={controlStyles.controlStatusRow}>
            <span className={controlStyles.controlStatusLabel}>Current URL</span>
            <span className={controlStyles.controlStatusValue}>
              {activeSession.currentUrl ?? activeSession.targetUrl ?? "Not loaded"}
            </span>
          </div>
          <div className={controlStyles.controlStatusRow}>
            <span className={controlStyles.controlStatusLabel}>Session policy</span>
            <span className={controlStyles.controlStatusValue}>
              {activeSession.profileMode} · {activeSession.host} ·{" "}
              {activeSession.agentAttached ? "agent attached" : "agent detached"}
            </span>
          </div>
          <div className={controlStyles.actions}>
            <button
              type="button"
              className={controlStyles.actionButton}
              onClick={() =>
                void withBusy(async () => {
                  await setDesktopBrowserWorkspaceHost({
                    sessionId: activeSession.sessionId,
                    host: activeSession.host === "window" ? "pane" : "window",
                    focus: true,
                  });
                  await refresh();
                })
              }
              disabled={busy}
            >
              {activeSession.host === "window" ? "Attach to pane" : "Detach to window"}
            </button>
            <button
              type="button"
              className={controlStyles.actionButton}
              onClick={() =>
                void withBusy(async () => {
                  await setDesktopBrowserWorkspaceProfileMode({
                    sessionId: activeSession.sessionId,
                    profileMode: activeSession.profileMode === "shared" ? "isolated" : "shared",
                  });
                  await refresh();
                })
              }
              disabled={busy}
            >
              {activeSession.profileMode === "shared" ? "Use isolated profile" : "Share with debug"}
            </button>
            <button
              type="button"
              className={controlStyles.actionButton}
              onClick={() =>
                void withBusy(async () => {
                  await setDesktopBrowserWorkspaceAgentAttached({
                    sessionId: activeSession.sessionId,
                    attached: !activeSession.agentAttached,
                  });
                  await refresh();
                })
              }
              disabled={busy || !activeSession.canAgentAttach}
            >
              {activeSession.agentAttached ? "Detach agent" : "Attach agent"}
            </button>
            <button
              type="button"
              className={controlStyles.actionButton}
              onClick={() =>
                void withBusy(async () => {
                  await setDesktopBrowserWorkspaceDevtoolsOpen({
                    sessionId: activeSession.sessionId,
                    open: !activeSession.devtoolsOpen,
                  });
                  await refresh();
                })
              }
              disabled={busy}
            >
              {activeSession.devtoolsOpen ? "Close DevTools" : "Open DevTools"}
            </button>
          </div>
        </>
      ) : (
        <div className={controlStyles.emptyState}>
          No browser workspace session is active yet. Open a preview, debug, or research lane to
          reuse it across agent verification and browser-debug flows.
        </div>
      )}

      {bootResult?.terminalSessionId ? (
        <div className={controlStyles.controlStatusRow}>
          <span className={controlStyles.controlStatusLabel}>Preview boot</span>
          <span className={controlStyles.controlStatusValue}>
            {bootResult.status} · terminal {bootResult.terminalSessionId}
          </span>
        </div>
      ) : null}

      {activeKind === "preview" &&
      activeSession?.host === "pane" &&
      isLoopbackPreviewTarget(activeSession.targetUrl) ? (
        <iframe
          title="Project preview"
          src={activeSession.targetUrl ?? undefined}
          className={controlStyles.browserWorkspaceFrame}
          sandbox="allow-forms allow-same-origin allow-scripts"
        />
      ) : null}

      {error ? <div className={controlStyles.error}>{error}</div> : null}
    </div>
  );
}
