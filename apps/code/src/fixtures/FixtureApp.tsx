import { lazy, Suspense } from "react";
import { workspaceBootState } from "../appBoot";
import { AppBootFallback } from "../features/app/components/AppBootFallback";

const ExecutionDetailVisualFixture = lazy(() =>
  import("../features/design-system/components/execution/ExecutionDetailVisualFixture").then(
    (module) => ({
      default: module.ExecutionDetailVisualFixture,
    })
  )
);
const MissionControlVisualFixture = lazy(() =>
  import("../features/design-system/components/execution/MissionControlVisualFixture").then(
    (module) => ({
      default: module.MissionControlVisualFixture,
    })
  )
);
const DesignSystemClosureFixture = lazy(() =>
  import("../features/design-system/components/DesignSystemClosureFixture").then((module) => ({
    default: module.DesignSystemClosureFixture,
  }))
);
const MainShellClosureFixture = lazy(() =>
  import("../features/design-system/components/MainShellClosureFixture").then((module) => ({
    default: module.MainShellClosureFixture,
  }))
);
const CoreLoopClosureFixture = lazy(() =>
  import("../features/core-loop/components/CoreLoopClosureFixture").then((module) => ({
    default: module.CoreLoopClosureFixture,
  }))
);
const GitInspectorDetailVisualFixture = lazy(() =>
  import("../features/git/components/GitInspectorDetailVisualFixture").then((module) => ({
    default: module.GitInspectorDetailVisualFixture,
  }))
);
const GitInspectorRuntimeFixture = lazy(() =>
  import("../features/git/components/GitInspectorRuntimeFixture").then((module) => ({
    default: module.GitInspectorRuntimeFixture,
  }))
);
const AutoDriveNavigationFixture = lazy(() =>
  import("../features/autodrive/components/AutoDriveNavigationFixture").then((module) => ({
    default: module.AutoDriveNavigationFixture,
  }))
);
const CompactMissionThreadFixture = lazy(() =>
  import("../features/layout/components/CompactMissionThreadFixture").then((module) => ({
    default: module.CompactMissionThreadFixture,
  }))
);
const ComposerSelectFixture = lazy(() =>
  import("../features/composer/components/ComposerSelectFixture").then((module) => ({
    default: module.ComposerSelectFixture,
  }))
);
const ComposerActionVisualFixture = lazy(() =>
  import("../features/composer/components/ComposerActionVisualFixture").then((module) => ({
    default: module.ComposerActionVisualFixture,
  }))
);
const ShellControlsFixture = lazy(() =>
  import("../features/layout/components/ShellControlsFixture").then((module) => ({
    default: module.ShellControlsFixture,
  }))
);
const WorkspaceHomeSubAgentObservabilityFixture = lazy(() =>
  import("../features/workspaces/components/WorkspaceHomeSubAgentObservabilityFixture").then(
    (module) => ({
      default: module.WorkspaceHomeSubAgentObservabilityFixture,
    })
  )
);
const ReviewLoopClosureFixture = lazy(() =>
  import("../features/review/components/review-loop/ReviewLoopClosureFixture").then((module) => ({
    default: module.ReviewLoopClosureFixture,
  }))
);
const HomeSidebarClosureFixture = lazy(() =>
  import("../features/home/components/HomeSidebarClosureFixture").then((module) => ({
    default: module.HomeSidebarClosureFixture,
  }))
);
const SettingsFormChromeFixture = lazy(() =>
  import("../features/settings/components/SettingsFormChromeFixture").then((module) => ({
    default: module.SettingsFormChromeFixture,
  }))
);
const RightPanelV2VisualFixture = lazy(() =>
  import("../features/right-panel/RightPanelV2VisualFixture").then((module) => ({
    default: module.RightPanelV2VisualFixture,
  }))
);

function readFixtureName(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("fixture");
}

function MissingFixtureScreen() {
  return (
    <main className="app-boot-shell">
      <div className="app-boot-card">
        <span className="app-boot-eyebrow">Fixture Host</span>
        <strong className="app-boot-title">No fixture selected</strong>
        <span className="app-boot-detail">
          Open this host with <code>?fixture=&lt;name&gt;</code> to load a dedicated visual or
          runtime harness.
        </span>
      </div>
    </main>
  );
}

function ComposerActionFixtureFallback() {
  return (
    <main className="app-boot-shell" data-visual-fixture="composer-action-stop">
      <div className="app-boot-card">
        <span className="app-boot-eyebrow">Composer Fixture</span>
        <strong className="app-boot-title">Composer Action Stop Fixture</strong>
        <span className="app-boot-detail">
          Dedicated stop-action harness for verifying the processing-state button grammar.
        </span>
        <section data-stop-state="startup">
          <h2>Starting response</h2>
          <p>The stop action stays visible while startup work is still settling.</p>
          <button type="button" aria-label="Starting response" title="Starting response" disabled>
            <span className="composer-action-stop-square" aria-hidden />
          </button>
        </section>
        <section data-stop-state="ready">
          <h2>Stop ready</h2>
          <p>The stop action is enabled and ready to interrupt the current run.</p>
          <button type="button" aria-label="Stop" title="Stop">
            <span className="composer-action-stop-square" aria-hidden />
          </button>
        </section>
      </div>
    </main>
  );
}

export function FixtureApp() {
  const fixtureName = readFixtureName();

  if (fixtureName === "execution-detail") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <ExecutionDetailVisualFixture />
      </Suspense>
    );
  }
  if (fixtureName === "mission-control") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <MissionControlVisualFixture />
      </Suspense>
    );
  }
  if (fixtureName === "design-system-closure") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <DesignSystemClosureFixture />
      </Suspense>
    );
  }
  if (fixtureName === "main-shell-closure") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <MainShellClosureFixture />
      </Suspense>
    );
  }
  if (fixtureName === "home-sidebar-closure") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <HomeSidebarClosureFixture />
      </Suspense>
    );
  }
  if (fixtureName === "core-loop-closure") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <CoreLoopClosureFixture />
      </Suspense>
    );
  }
  if (fixtureName === "git-inspector-detail") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <GitInspectorDetailVisualFixture />
      </Suspense>
    );
  }
  if (fixtureName === "git-inspector-runtime") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <GitInspectorRuntimeFixture />
      </Suspense>
    );
  }
  if (fixtureName === "autodrive-navigation") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <AutoDriveNavigationFixture />
      </Suspense>
    );
  }
  if (fixtureName === "compact-mission-thread") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <CompactMissionThreadFixture />
      </Suspense>
    );
  }
  if (fixtureName === "composer-select") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <ComposerSelectFixture />
      </Suspense>
    );
  }
  if (fixtureName === "composer-action-stop") {
    return (
      <Suspense fallback={<ComposerActionFixtureFallback />}>
        <ComposerActionVisualFixture />
      </Suspense>
    );
  }
  if (fixtureName === "shell-controls") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <ShellControlsFixture />
      </Suspense>
    );
  }
  if (fixtureName === "runtime-subagent-observability") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <WorkspaceHomeSubAgentObservabilityFixture />
      </Suspense>
    );
  }
  if (fixtureName === "review-loop-closure") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <ReviewLoopClosureFixture />
      </Suspense>
    );
  }
  if (fixtureName === "settings-form-chrome") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <SettingsFormChromeFixture />
      </Suspense>
    );
  }
  if (fixtureName === "right-panel-v2") {
    return (
      <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
        <RightPanelV2VisualFixture />
      </Suspense>
    );
  }

  return <MissingFixtureScreen />;
}
