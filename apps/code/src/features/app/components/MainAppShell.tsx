import type { CSSProperties, ReactNode } from "react";
import { lazy, memo, Suspense, useLayoutEffect, useRef } from "react";
import type { GitHubPanelDataProps } from "../../git/components/GitHubPanelData";
import type { MobileServerSetupWizardProps } from "../../mobile/components/MobileServerSetupWizard";
import type { AppLayoutProps } from "./AppLayout";
import { AppLayout } from "./AppLayout";
import type { AppModalsProps } from "./AppModals";

const GitHubPanelData = lazy(() =>
  import("../../git/components/GitHubPanelData").then((module) => ({
    default: module.GitHubPanelData,
  }))
);
const AppModals = lazy(() =>
  import("./AppModals").then((module) => ({
    default: module.AppModals,
  }))
);
const MobileServerSetupWizard = lazy(() =>
  import("../../mobile/components/MobileServerSetupWizard").then((module) => ({
    default: module.MobileServerSetupWizard,
  }))
);

type MainAppShellProps = {
  appClassName: string;
  appStyle: CSSProperties;
  shouldLoadGitHubPanelData: boolean;
  gitHubPanelDataProps: GitHubPanelDataProps;
  appLayoutProps: AppLayoutProps;
  appModalsProps: AppModalsProps;
  titlebarControlsNode: ReactNode;
  showMobileSetupWizard: boolean;
  mobileSetupWizardProps: MobileServerSetupWizardProps;
};

function toStylePropertyName(property: string) {
  if (property.startsWith("--")) {
    return property;
  }
  if (property.startsWith("ms")) {
    return `-${property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;
  }
  return property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function applyStyleMap(node: HTMLElement, styleMap: CSSProperties | undefined) {
  if (!styleMap) {
    return;
  }

  for (const [property, value] of Object.entries(styleMap)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    node.style.setProperty(toStylePropertyName(property), String(value));
  }
}

function clearStyleMap(node: HTMLElement, styleMap: CSSProperties | undefined) {
  if (!styleMap) {
    return;
  }

  for (const property of Object.keys(styleMap)) {
    node.style.removeProperty(toStylePropertyName(property));
  }
}

export const MainAppShell = memo(function MainAppShell({
  appClassName,
  appStyle,
  shouldLoadGitHubPanelData,
  gitHubPanelDataProps,
  appLayoutProps,
  appModalsProps,
  titlebarControlsNode,
  showMobileSetupWizard,
  mobileSetupWizardProps,
}: MainAppShellProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const previousStyleRef = useRef<CSSProperties | undefined>(undefined);
  const shouldLoadAppModals =
    appModalsProps.renamePrompt !== null ||
    appModalsProps.worktreePrompt !== null ||
    appModalsProps.clonePrompt !== null ||
    appModalsProps.branchSwitcher !== null ||
    appModalsProps.settingsOpen;

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    clearStyleMap(shell, previousStyleRef.current);
    applyStyleMap(shell, appStyle);
    previousStyleRef.current = appStyle;

    return () => {
      clearStyleMap(shell, previousStyleRef.current);
      previousStyleRef.current = undefined;
    };
  }, [appStyle]);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const rightControls = shell.querySelector<HTMLElement>('[data-titlebar-right-controls="true"]');
    if (!rightControls) {
      shell.style.removeProperty("--main-header-right-overlay-gutter");
      return;
    }

    const syncRightControlsWidth = () => {
      const nextWidth = Math.ceil(rightControls.getBoundingClientRect().width);
      shell.style.setProperty(
        "--main-header-right-overlay-gutter",
        `calc(${nextWidth}px + var(--shell-chrome-inset-x, 16px) + 12px)`
      );
    };

    syncRightControlsWidth();

    if (typeof ResizeObserver !== "function") {
      window.addEventListener("resize", syncRightControlsWidth);
      return () => {
        window.removeEventListener("resize", syncRightControlsWidth);
        shell.style.removeProperty("--main-header-right-overlay-gutter");
      };
    }

    const observer = new ResizeObserver(syncRightControlsWidth);
    observer.observe(rightControls);
    window.addEventListener("resize", syncRightControlsWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncRightControlsWidth);
      shell.style.removeProperty("--main-header-right-overlay-gutter");
    };
  }, [titlebarControlsNode]);

  return (
    <div ref={shellRef} className={appClassName}>
      <div className="drag-strip" id="titlebar" data-desktop-drag-region />
      {titlebarControlsNode}
      {shouldLoadGitHubPanelData ? (
        <Suspense fallback={null}>
          <GitHubPanelData {...gitHubPanelDataProps} />
        </Suspense>
      ) : null}
      <AppLayout {...appLayoutProps} />
      {shouldLoadAppModals ? (
        <Suspense fallback={null}>
          <AppModals {...appModalsProps} />
        </Suspense>
      ) : null}
      {showMobileSetupWizard ? (
        <Suspense fallback={null}>
          <MobileServerSetupWizard {...mobileSetupWizardProps} />
        </Suspense>
      ) : null}
    </div>
  );
});
