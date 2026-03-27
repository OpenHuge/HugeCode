import { ErrorBoundary } from "@ku0/code-application";
import { lazy, Suspense } from "react";
import { RuntimePortsProvider } from "./application/runtime/ports";
import { aboutBootState, workspaceBootState } from "./appBoot";
import { AppBootFallback } from "./features/app/components/AppBootFallback";
import { useWindowLabel } from "./features/layout/hooks/useWindowLabel";

const AboutView = lazy(() =>
  import("./features/about/components/AboutView").then((module) => ({
    default: module.AboutView,
  }))
);
let workspaceClientEntryModulePromise: Promise<{
  default: typeof import("./web/WorkspaceClientEntry").default;
}> | null = null;

function loadWorkspaceClientEntryModule() {
  workspaceClientEntryModulePromise ??= import("./web/WorkspaceClientEntry").then((module) => ({
    default: module.default,
  }));
  return workspaceClientEntryModulePromise;
}

const WorkspaceClientEntry = lazy(loadWorkspaceClientEntryModule);

function App() {
  const windowLabel = useWindowLabel();
  if (windowLabel === "about") {
    return (
      <Suspense fallback={<AppBootFallback {...aboutBootState} />}>
        <AboutView />
      </Suspense>
    );
  }

  void loadWorkspaceClientEntryModule();

  return (
    <RuntimePortsProvider>
      <ErrorBoundary>
        <Suspense fallback={<AppBootFallback {...workspaceBootState} />}>
          <WorkspaceClientEntry />
        </Suspense>
      </ErrorBoundary>
    </RuntimePortsProvider>
  );
}

export default App;
