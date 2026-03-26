import type { SelectOption } from "../../../design-system";
import { useRef, useState } from "react";
import type {
  AccessMode,
  ComposerExecutionMode,
  ComposerModelSelectionMode,
  ThreadTokenUsage,
  WorkspaceInfo,
} from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import {
  buildModelProviderOptions,
  resolveSelectedProviderId,
} from "../../models/utils/modelProviderSelection";
import { ComposerAccessDropdown } from "./ComposerAccessDropdown";
import { ComposerMetaBarControls } from "./ComposerMetaBarControls";
import { ComposerWorkspaceBar } from "./ComposerWorkspaceBar";
import * as styles from "./ComposerSelectFixture.css";

const FIXTURE_MODELS = [
  {
    id: "openai::gpt-5.4",
    model: "gpt-5.4",
    displayName: "GPT-5.4",
    provider: "openai",
    available: true,
  },
  {
    id: "claude_code_local::claude-sonnet-4-5",
    model: "claude-sonnet-4-5",
    displayName: "Claude Sonnet 4.5",
    provider: "claude_code_local",
    available: true,
  },
];
const PROVIDER_OPTIONS = buildModelProviderOptions(FIXTURE_MODELS);

const REASONING_OPTIONS: SelectOption[] = [
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
];

const EXECUTION_OPTIONS: SelectOption[] = [
  { value: "runtime", label: "Runtime" },
  { value: "local-cli", label: "Local CLI" },
  { value: "hybrid", label: "Hybrid" },
];

const FIXTURE_WORKSPACE: WorkspaceInfo = {
  id: "fixture-workspace",
  name: "Fixture Workspace",
  path: "/tmp/fixture-workspace",
  connected: false,
  kind: "main",
  settings: {
    sidebarCollapsed: false,
  },
};

const FIXTURE_CONTEXT_USAGE: ThreadTokenUsage = {
  modelContextWindow: 32_000,
  last: {
    totalTokens: 24_000,
    inputTokens: 18_000,
    cachedInputTokens: 0,
    outputTokens: 6_000,
    reasoningOutputTokens: 0,
  },
  total: {
    totalTokens: 24_000,
    inputTokens: 18_000,
    cachedInputTokens: 0,
    outputTokens: 6_000,
    reasoningOutputTokens: 0,
  },
};

export function ComposerSelectFixture() {
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const [modelSelectionMode, setModelSelectionMode] =
    useState<ComposerModelSelectionMode>("manual");
  const [selectedModelId, setSelectedModelId] = useState<string>("openai::gpt-5.4");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(() =>
    resolveSelectedProviderId(PROVIDER_OPTIONS, selectedModelId)
  );
  const [selectedEffort, setSelectedEffort] = useState<string>("medium");
  const [selectedExecutionMode, setSelectedExecutionMode] =
    useState<ComposerExecutionMode>("runtime");
  const [accessMode, setAccessMode] = useState<AccessMode>("on-request");
  const [isPlanActive, setIsPlanActive] = useState(false);

  return (
    <main className={styles.shell} data-visual-fixture="composer-select">
      <div className={styles.frame}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Composer Fixture</span>
          <h1 className={styles.title}>Composer Select Fixture</h1>
          <p className={styles.subtitle}>
            Stable browser surface for select hit areas, anchored popovers, compact viewport guards,
            and trigger label fit without depending on live workspace data.
          </p>
        </header>

        <section className={styles.panel} aria-label="Composer select surface">
          <div className={styles.toolbar}>
            <div className={styles.controlsRow}>
              <div className={styles.accessGroupRail}>
                <span className={styles.accessGroupLead}>GPT-5.4</span>
                <span className={styles.accessGroupDivider} aria-hidden />
                <span
                  className={joinClassNames(
                    styles.accessWrap,
                    "composer-select-wrap composer-select-wrap--access"
                  )}
                  data-ui-select-anchor
                >
                  <ComposerAccessDropdown
                    accessMode={accessMode}
                    onSelectAccessMode={setAccessMode}
                    layout="grouped"
                  />
                </span>
                <span className={styles.accessGroupDivider} aria-hidden />
                <span className={styles.accessGroupTail}>Chat</span>
              </div>
            </div>
            <div className={styles.controlsRow}>
              <div
                className={joinClassNames(
                  styles.accessWrap,
                  "composer-select-wrap composer-select-wrap--access-standalone"
                )}
                data-ui-select-anchor
              >
                <ComposerAccessDropdown
                  accessMode={accessMode}
                  onSelectAccessMode={setAccessMode}
                  layout="standalone"
                />
              </div>
            </div>
            <div className={styles.controlsRow}>
              <ComposerWorkspaceBar
                controls={{
                  mode: "worktree",
                  branchLabel: "feature/free-figma",
                  currentBranch: "feature/free-figma",
                  branchTriggerLabel: "feature/free-figma",
                  repositoryWorkspace: FIXTURE_WORKSPACE,
                  activeWorkspace: FIXTURE_WORKSPACE,
                  workspaces: [FIXTURE_WORKSPACE],
                }}
                contextUsage={FIXTURE_CONTEXT_USAGE}
                accessMode={accessMode}
                onSelectAccessMode={setAccessMode}
              />
            </div>
            <div className={styles.controlsRow}>
              <ComposerMetaBarControls
                controlsRef={controlsRef}
                disabled={false}
                modelSelectionMode={modelSelectionMode}
                providerOptions={PROVIDER_OPTIONS}
                selectedProviderId={selectedProviderId}
                onSelectModelSelectionMode={setModelSelectionMode}
                onSelectProvider={setSelectedProviderId}
                selectedModelId={selectedModelId}
                onSelectModel={setSelectedModelId}
                effortSelectOptions={REASONING_OPTIONS}
                selectedEffort={selectedEffort}
                onSelectEffort={setSelectedEffort}
                reasoningSupported
                shouldShowExecutionControl
                executionSelectOptions={EXECUTION_OPTIONS}
                selectedExecutionMode={selectedExecutionMode}
                onSelectExecutionMode={setSelectedExecutionMode}
                shouldShowRemoteBackendControl={false}
                remoteBackendSelectOptions={[]}
                selectedRemoteBackendId={null}
                isPlanActive={isPlanActive}
                planModeLabel="Plan"
                planModeAvailable
                onSelectChatMode={() => setIsPlanActive(false)}
                onSelectPlanMode={() => setIsPlanActive(true)}
              />
            </div>
          </div>

          <ul className={styles.notes}>
            <li>All select controls use the real shared trigger and menu primitives.</li>
            <li>
              Model, reasoning, and execution preserve the current composer wrap-hit behavior.
            </li>
            <li>
              Workspace support chrome now includes branch selection and compact context usage in
              the same low-noise rail.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
