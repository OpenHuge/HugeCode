import { useEffect, useMemo, useState } from "react";
import type { GitLogResponse, WorkspaceSummary } from "@ku0/code-runtime-host-contract";
import type { OpenAppTarget, GitFileDiff, GitFileStatus } from "../../../types";
import { getRuntimeClient } from "../../../application/runtime/ports/runtimeClient";
import { readWorkspaceFile } from "../../../application/runtime/ports/desktopFiles";
import { getGitDiffs, getGitLog, getGitStatus } from "../../../application/runtime/ports/git";
import {
  AgentStepSummaryBlock,
  DiffSummaryBlock,
  LogSnippetBlock,
} from "../../right-panel/RightPanelBlocks";
import {
  InspectorSectionGroup,
  InspectorSectionHeader,
  RightPanelBody,
  RightPanelHeader,
  RightPanelShell,
} from "../../right-panel/RightPanelPrimitives";
import { CardDescription, CardTitle, StatusBadge, Surface } from "../../../design-system";
import { FilePreviewPopover } from "../../files/components/FilePreviewPopover";
import { GitDiffPanel } from "./GitDiffPanel";
import { joinRootAndPath, normalizeRootPath } from "./GitDiffPanel.utils";
import * as styles from "./GitInspectorDetailVisualFixture.css";

type RuntimeScene = {
  workspace: WorkspaceSummary;
  branchName: string;
  fileStatus: string;
  stagedFiles: GitFileStatus[];
  unstagedFiles: GitFileStatus[];
  totalAdditions: number;
  totalDeletions: number;
  selectedPath: string | null;
  diffByPath: Map<string, string>;
  log: GitLogResponse | null;
};

type PreviewState = {
  content: string;
  truncated: boolean;
  error: string | null;
};

const openTargets: OpenAppTarget[] = [];

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function buildFileStatusLabel(count: number) {
  if (count === 0) {
    return "No files changed";
  }
  if (count === 1) {
    return "1 file changed";
  }
  return `${count} files changed`;
}

function countDiffLines(diff: string) {
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("+")) {
      additions += 1;
      continue;
    }
    if (line.startsWith("-")) {
      deletions += 1;
    }
  }
  return { additions, deletions };
}

function withDiffCounts(files: GitFileStatus[], diffByPath: Map<string, string>) {
  return files.map((file) => {
    const diff = diffByPath.get(file.path);
    if (!diff) {
      return file;
    }
    const counts = countDiffLines(diff);
    return {
      ...file,
      additions: counts.additions,
      deletions: counts.deletions,
    };
  });
}

function resolveInitialSelectedPath(
  unstagedFiles: readonly GitFileStatus[],
  stagedFiles: readonly GitFileStatus[]
) {
  return unstagedFiles[0]?.path ?? stagedFiles[0]?.path ?? null;
}

async function waitForRuntimeGitScene(
  seedPath: string,
  displayName: string
): Promise<RuntimeScene> {
  const runtimeClient = getRuntimeClient();
  const normalizedSeedPath = normalizeRootPath(seedPath);
  if (!normalizedSeedPath) {
    throw new Error("Missing git seed path.");
  }

  const workspaces = await runtimeClient.workspaces();
  let workspace =
    workspaces.find((candidate) => normalizeRootPath(candidate.path) === normalizedSeedPath) ??
    null;
  if (!workspace) {
    workspace = await runtimeClient.workspaceCreate(normalizedSeedPath, displayName);
  }

  let attempts = 0;
  while (attempts < 20) {
    attempts += 1;
    const [status, diffs, log] = await Promise.all([
      getGitStatus(workspace.id),
      getGitDiffs(workspace.id),
      getGitLog(workspace.id, 8).catch(() => null),
    ]);

    const diffByPath = new Map<string, string>(
      diffs.map((entry: GitFileDiff) => [entry.path, entry.diff ?? ""])
    );
    const stagedFiles = withDiffCounts(status.stagedFiles, diffByPath);
    const unstagedFiles = withDiffCounts(status.unstagedFiles, diffByPath);
    const totalFiles = stagedFiles.length + unstagedFiles.length;
    if (totalFiles > 0) {
      return {
        workspace,
        branchName: status.branchName,
        fileStatus: buildFileStatusLabel(totalFiles),
        stagedFiles,
        unstagedFiles,
        totalAdditions: [...stagedFiles, ...unstagedFiles].reduce(
          (sum, file) => sum + file.additions,
          0
        ),
        totalDeletions: [...stagedFiles, ...unstagedFiles].reduce(
          (sum, file) => sum + file.deletions,
          0
        ),
        selectedPath: resolveInitialSelectedPath(unstagedFiles, stagedFiles),
        diffByPath,
        log,
      };
    }
    await delay(250);
  }

  throw new Error("Runtime git fixture did not expose any staged or unstaged changes.");
}

export function GitInspectorRuntimeFixture() {
  const searchParams = useMemo(
    () =>
      typeof window === "undefined"
        ? new URLSearchParams()
        : new URLSearchParams(window.location.search),
    []
  );
  const seedPath = searchParams.get("git-seed-path")?.trim() ?? "";
  const seedLabel = searchParams.get("git-seed-label")?.trim() || "Git Inspector Runtime Fixture";

  const [scene, setScene] = useState<RuntimeScene | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({
    content: "",
    truncated: false,
    error: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const nextScene = await waitForRuntimeGitScene(seedPath, seedLabel);
        if (cancelled) {
          return;
        }
        setScene(nextScene);
        setSelectedPath(nextScene.selectedPath);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to seed runtime git fixture."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [seedLabel, seedPath]);

  useEffect(() => {
    let cancelled = false;

    if (!scene || !selectedPath) {
      setPreview({
        content: "",
        truncated: false,
        error: null,
      });
      return;
    }

    void (async () => {
      try {
        const nextPreview = await readWorkspaceFile(scene.workspace.id, selectedPath);
        if (cancelled) {
          return;
        }
        setPreview({
          content: nextPreview.content,
          truncated: nextPreview.truncated,
          error: null,
        });
      } catch (previewError) {
        if (cancelled) {
          return;
        }
        setPreview({
          content: scene.diffByPath.get(selectedPath) ?? "",
          truncated: false,
          error:
            previewError instanceof Error
              ? previewError.message
              : "Unable to read runtime preview content.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scene, selectedPath]);

  const selectedDiff = useMemo(() => {
    if (!scene || !selectedPath) {
      return "";
    }
    return scene.diffByPath.get(selectedPath) ?? "";
  }, [scene, selectedPath]);

  const latestCommitSummary =
    scene?.log?.entries[0]?.summary ?? "Runtime seed created for Git inspector.";
  const previewSelection =
    preview.content.length > 0
      ? {
          start: 0,
          end: Math.min(4, Math.max(0, preview.content.split("\n").length - 1)),
        }
      : null;

  return (
    <main className={styles.shell} data-visual-fixture="git-inspector-runtime">
      <div className={styles.frame}>
        <Surface className={styles.hero} padding="lg" tone="elevated">
          <span className={styles.eyebrow}>Git Inspector Runtime Fixture</span>
          <div className={styles.titleRow}>
            <CardTitle className={styles.title}>
              Runtime-backed Git inspector regression scene
            </CardTitle>
            <div className={styles.chipRow}>
              <StatusBadge tone="progress">Runtime-backed Git panel</StatusBadge>
              <StatusBadge>Shared inspector primitives</StatusBadge>
              <StatusBadge tone="warning">Fixture stand-in for plan/details</StatusBadge>
            </div>
          </div>
          <CardDescription className={styles.subtitle}>
            This scene uses a real runtime workspace created from a Playwright-seeded Git repo. The
            diff panel and preview are runtime-backed on the current head; the adjacent Details and
            Plan surfaces remain fixture stand-ins to validate density and hierarchy honestly.
          </CardDescription>
        </Surface>

        {loading ? (
          <section className={styles.hero}>
            <p className={styles.subtitle}>Loading runtime-backed Git fixture…</p>
          </section>
        ) : error || !scene ? (
          <section className={styles.hero}>
            <p className={styles.subtitle}>
              Runtime-backed Git fixture failed to load.
              <br />
              {error ?? "Unknown runtime bootstrap error."}
            </p>
          </section>
        ) : (
          <div className={styles.workspaceGrid}>
            <div className={styles.panelStack}>
              <RightPanelShell className={styles.panelShell}>
                <RightPanelHeader
                  eyebrow="Selection"
                  title="Details"
                  subtitle="Runtime-backed file selection with adjacent inspector context."
                  actions={<StatusBadge tone="progress">Live diff</StatusBadge>}
                />
                <RightPanelBody>
                  <AgentStepSummaryBlock
                    title="Review selected file"
                    subtitle="Runtime-backed Git panel selection"
                    metrics={[
                      { label: "Workspace", value: scene.workspace.displayName },
                      { label: "Branch", value: scene.branchName },
                      { label: "Path", value: selectedPath ?? "No file selected" },
                    ]}
                  />
                  <DiffSummaryBlock
                    files={[
                      ...(scene.unstagedFiles.length > 0
                        ? scene.unstagedFiles.map((file) => ({
                            path: file.path,
                            status: "modified" as const,
                          }))
                        : scene.stagedFiles.map((file) => ({
                            path: file.path,
                            status: "modified" as const,
                          }))),
                    ].slice(0, 3)}
                    diff={selectedDiff || "No diff available."}
                  />
                  <LogSnippetBlock title="Latest commit" content={latestCommitSummary} />
                </RightPanelBody>
              </RightPanelShell>

              <div data-testid="git-inspector-runtime-plan-surface">
                <RightPanelShell className={styles.planPanelShell}>
                  <RightPanelHeader
                    eyebrow="Workspace"
                    title="Plan"
                    subtitle="Fixture stand-in kept adjacent so inspector hierarchy stays testable."
                    actions={<StatusBadge tone="warning">Fixture stand-in</StatusBadge>}
                  />
                  <RightPanelBody>
                    <InspectorSectionGroup>
                      <InspectorSectionHeader
                        title="Runtime-backed evidence chain"
                        subtitle="What this fixture proves on the current head"
                        actions={<StatusBadge tone="progress">Current round</StatusBadge>}
                      />
                      <Surface className={styles.planArtifact} padding="md" tone="subtle">
                        <CardTitle className={styles.planArtifactTitle}>
                          Seeded Git repo opened through the runtime gateway
                        </CardTitle>
                        <CardDescription className={styles.planArtifactBody}>
                          Playwright seeds a real repository, the app creates or reuses a runtime
                          workspace for it, and the fixture renders the Git panel plus preview from
                          runtime data instead of hardcoded lists.
                        </CardDescription>
                      </Surface>
                      <ol className={styles.planStepList}>
                        <li className={styles.planStepRow}>
                          <span className={styles.planStepStatus}>[x]</span>
                          <span className={styles.planStepText}>
                            Runtime workspace creation is driven by the current app head.
                          </span>
                        </li>
                        <li className={styles.planStepRow}>
                          <span className={styles.planStepStatus}>[x]</span>
                          <span className={styles.planStepText}>
                            Diff and preview surfaces read real runtime-backed Git and file data.
                          </span>
                        </li>
                        <li className={styles.planStepRow}>
                          <span className={styles.planStepStatus}>[ ]</span>
                          <span className={styles.planStepText}>
                            Full thread-selected Details/Plan baseline still depends on a deeper
                            runtime thread harness.
                          </span>
                        </li>
                      </ol>
                      <p className={styles.planNote}>
                        Evidence boundary: this route proves a real runtime-backed Git panel scene.
                        It does not claim the full runtime-seeded thread-detail inspector baseline
                        is complete.
                      </p>
                    </InspectorSectionGroup>
                  </RightPanelBody>
                </RightPanelShell>
              </div>
            </div>

            <div className={styles.diffSurface} data-testid="git-inspector-runtime-diff-surface">
              <GitDiffPanel
                workspaceId={scene.workspace.id}
                workspacePath={scene.workspace.path}
                mode="diff"
                onModeChange={() => {}}
                filePanelMode="git"
                onFilePanelModeChange={() => {}}
                branchName={scene.branchName}
                totalAdditions={scene.totalAdditions}
                totalDeletions={scene.totalDeletions}
                fileStatus={scene.fileStatus}
                gitRoot={scene.workspace.path}
                logEntries={scene.log?.entries ?? []}
                stagedFiles={scene.stagedFiles}
                unstagedFiles={scene.unstagedFiles}
                selectedPath={selectedPath}
                onSelectFile={setSelectedPath}
                commitMessage="feat: keep git inspector runtime-backed"
                onCommitMessageChange={() => {}}
                onGenerateCommitMessage={() => {}}
                onStageAllChanges={() => {}}
                onStageFile={() => {}}
                onUnstageFile={() => {}}
                onRevertFile={() => {}}
              />
            </div>
          </div>
        )}
      </div>

      {scene && selectedPath ? (
        <FilePreviewPopover
          path={selectedPath}
          absolutePath={joinRootAndPath(scene.workspace.path, selectedPath)}
          content={preview.content}
          truncated={preview.truncated}
          openTargets={openTargets}
          openAppIconById={{}}
          selectedOpenAppId="vscode"
          onSelectOpenAppId={() => {}}
          selection={previewSelection}
          onSelectLine={() => {}}
          onClearSelection={() => {}}
          onAddSelection={() => {}}
          selectionHints={["Runtime file preview", "Inspector adjacency check"]}
          anchorTop={276}
          anchorLeft={1040}
          arrowTop={56}
          onClose={() => {}}
          error={preview.error}
        />
      ) : null}
    </main>
  );
}
