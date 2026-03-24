import { useEffect, useMemo, useRef, useState } from "react";
import {
  bootManagedPreview,
  parsePreviewTargetCandidates,
  type PreviewBootResult,
  type PreviewTargetCandidate,
} from "../../../application/runtime/facades/runtimeBrowserWorkspacePreview";
import {
  ensureDesktopBrowserWorkspaceSession,
  listDesktopBrowserWorkspaceSessions,
  navigateDesktopBrowserWorkspaceSession,
  reportDesktopBrowserWorkspaceVerification,
  setDesktopBrowserWorkspaceAgentAttached,
  setDesktopBrowserWorkspaceDevtoolsOpen,
  setDesktopBrowserWorkspaceHost,
  setDesktopBrowserWorkspacePaneState,
  setDesktopBrowserWorkspacePreviewServerStatus,
  setDesktopBrowserWorkspaceProfileMode,
} from "../../../application/runtime/ports/desktopBrowserWorkspace";
import { openDesktopExternalUrl } from "../../../application/runtime/ports/desktopShell";
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

function measurePaneBounds(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const width = rect.width > 0 ? rect.width : 640;
  const height = rect.height > 0 ? rect.height : 420;
  return {
    x: Math.max(0, Math.round(rect.left)),
    y: Math.max(0, Math.round(rect.top)),
    width: Math.max(320, Math.round(width)),
    height: Math.max(240, Math.round(height)),
  };
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
  const [sessionUrlDraft, setSessionUrlDraft] = useState("");
  const [candidates, setCandidates] = useState<PreviewTargetCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootResult, setBootResult] = useState<PreviewBootResult | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);

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
  const showNativePane = activeKind === "preview" && activeSession?.host === "pane";
  const activeSessionUrl = activeSession?.currentUrl ?? activeSession?.targetUrl ?? "";

  useEffect(() => {
    setSessionUrlDraft(activeSessionUrl);
  }, [activeSessionUrl, activeSession?.sessionId]);

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

  useEffect(() => {
    if (!showNativePane || !activeSession || !paneRef.current) {
      if (activeSession?.sessionId) {
        void setDesktopBrowserWorkspacePaneState({
          sessionId: activeSession.sessionId,
          visible: false,
          bounds: null,
        });
      }
      return;
    }

    const element = paneRef.current;
    const syncPane = () =>
      setDesktopBrowserWorkspacePaneState({
        sessionId: activeSession.sessionId,
        visible: true,
        bounds: measurePaneBounds(element),
      });

    void syncPane();

    if (typeof ResizeObserver === "undefined") {
      return () => {
        void setDesktopBrowserWorkspacePaneState({
          sessionId: activeSession.sessionId,
          visible: false,
          bounds: null,
        });
      };
    }

    const observer = new ResizeObserver(() => {
      void syncPane();
    });
    observer.observe(element);
    window.addEventListener("scroll", syncPane, true);
    window.addEventListener("resize", syncPane);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", syncPane, true);
      window.removeEventListener("resize", syncPane);
      void setDesktopBrowserWorkspacePaneState({
        sessionId: activeSession.sessionId,
        visible: false,
        bounds: null,
      });
    };
  }, [activeSession, showNativePane]);

  useEffect(() => {
    if (!activeSession?.sessionId || !activeSession.targetUrl) {
      return;
    }
    if (activeSession.lastVerifiedTarget === activeSession.targetUrl) {
      return;
    }
    void reportDesktopBrowserWorkspaceVerification({
      sessionId: activeSession.sessionId,
      targetUrl: activeSession.targetUrl,
    });
  }, [activeSession]);

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
        <label className={controlStyles.field}>
          <span>Session URL</span>
          <input
            className={controlStyles.fieldControl}
            value={sessionUrlDraft}
            onChange={(event) => setSessionUrlDraft(event.target.value)}
            placeholder="https://chatgpt.com/ or http://127.0.0.1:5173"
          />
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
        <button
          type="button"
          className={controlStyles.actionButton}
          onClick={() =>
            void withBusy(async () => {
              if (!activeSession) {
                throw new Error("No browser workspace session is active yet.");
              }
              const nextUrl = sessionUrlDraft.trim();
              if (!nextUrl) {
                throw new Error("Enter a browser workspace URL before navigating.");
              }
              await ensureDesktopBrowserWorkspaceSession({
                sessionId: activeSession.sessionId,
                kind: activeSession.kind,
                host: activeSession.host,
                workspaceId: activeSession.workspaceId ?? workspaceId,
                targetUrl: nextUrl,
                profileMode: activeSession.profileMode,
                canAgentAttach: activeSession.canAgentAttach,
                agentAttached: activeSession.agentAttached,
                devtoolsOpen: activeSession.devtoolsOpen,
                previewServerStatus: activeSession.previewServerStatus,
                focus: activeSession.host === "window",
              });
              await refresh();
            })
          }
          disabled={busy || !activeSession || sessionUrlDraft.trim().length === 0}
        >
          Go to URL
        </button>
        <button
          type="button"
          className={controlStyles.actionButton}
          onClick={() => setSessionUrlDraft(activeSessionUrl)}
          disabled={busy || sessionUrlDraft === activeSessionUrl}
        >
          Reset URL
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
          {activeSession.pageTitle ? (
            <div className={controlStyles.controlStatusRow}>
              <span className={controlStyles.controlStatusLabel}>Page title</span>
              <span className={controlStyles.controlStatusValue}>{activeSession.pageTitle}</span>
            </div>
          ) : null}
          <div className={controlStyles.controlStatusRow}>
            <span className={controlStyles.controlStatusLabel}>Session policy</span>
            <span className={controlStyles.controlStatusValue}>
              {activeSession.profileMode} · {activeSession.host} ·{" "}
              {activeSession.agentAttached ? "agent attached" : "agent detached"}
            </span>
          </div>
          <div className={controlStyles.controlStatusRow}>
            <span className={controlStyles.controlStatusLabel}>Browser state</span>
            <span className={controlStyles.controlStatusValue}>
              {activeSession.loadingState} · {activeSession.previewServerStatus} · crashes{" "}
              {activeSession.crashCount}
            </span>
          </div>
          {activeSession.lastVerifiedTarget ? (
            <div className={controlStyles.controlStatusRow}>
              <span className={controlStyles.controlStatusLabel}>Last verified target</span>
              <span className={controlStyles.controlStatusValue}>
                {activeSession.lastVerifiedTarget}
                {activeSession.lastVerifiedAt ? ` · ${activeSession.lastVerifiedAt}` : ""}
              </span>
            </div>
          ) : null}
          <div className={controlStyles.actions}>
            <button
              type="button"
              className={controlStyles.actionButton}
              onClick={() =>
                void withBusy(async () => {
                  await navigateDesktopBrowserWorkspaceSession({
                    sessionId: activeSession.sessionId,
                    action: "back",
                  });
                  await refresh();
                })
              }
              disabled={busy || !activeSession.canGoBack}
            >
              Back
            </button>
            <button
              type="button"
              className={controlStyles.actionButton}
              onClick={() =>
                void withBusy(async () => {
                  await navigateDesktopBrowserWorkspaceSession({
                    sessionId: activeSession.sessionId,
                    action: "forward",
                  });
                  await refresh();
                })
              }
              disabled={busy || !activeSession.canGoForward}
            >
              Forward
            </button>
            <button
              type="button"
              className={controlStyles.actionButton}
              onClick={() =>
                void withBusy(async () => {
                  await navigateDesktopBrowserWorkspaceSession({
                    sessionId: activeSession.sessionId,
                    action: "reload",
                  });
                  await refresh();
                })
              }
              disabled={busy}
            >
              Reload
            </button>
            <button
              type="button"
              className={controlStyles.actionButton}
              onClick={() =>
                void withBusy(async () => {
                  const currentUrl = activeSession.currentUrl ?? activeSession.targetUrl;
                  if (!currentUrl) {
                    throw new Error("No browser workspace URL is available to open externally.");
                  }
                  const opened = await openDesktopExternalUrl(currentUrl);
                  if (!opened) {
                    throw new Error("Unable to open the current browser workspace URL externally.");
                  }
                })
              }
              disabled={busy || !(activeSession.currentUrl ?? activeSession.targetUrl)}
            >
              Open externally
            </button>
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

      {showNativePane ? (
        <div className={controlStyles.browserWorkspaceFrame}>
          <div className={controlStyles.controlStatusRow}>
            <span className={controlStyles.controlStatusLabel}>Native preview pane</span>
            <span className={controlStyles.controlStatusValue}>
              {activeSession?.currentUrl ??
                activeSession?.targetUrl ??
                "Waiting for loopback target"}
            </span>
          </div>
          {activeSession?.lastError ? (
            <div className={controlStyles.error}>{activeSession.lastError}</div>
          ) : (
            <div className={controlStyles.emptyState}>
              Electron is hosting this preview as a native browser pane. Use detach to move it into
              a standalone window, or leave it here so agent verification can reuse the same
              session.
            </div>
          )}
          {activeSession?.consoleTail.length ? (
            <div className={controlStyles.controlStatusRow}>
              <span className={controlStyles.controlStatusLabel}>Console tail</span>
              <span className={controlStyles.controlStatusValue}>
                {activeSession.consoleTail.join(" · ")}
              </span>
            </div>
          ) : null}
          <div className={controlStyles.browserWorkspacePaneSurface} ref={paneRef} />
        </div>
      ) : null}

      {error ? <div className={controlStyles.error}>{error}</div> : null}
    </div>
  );
}
