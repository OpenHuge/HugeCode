import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { workspaceBootState } from "./appBoot";
import { RuntimeBootstrapEffects } from "./bootstrap/runtimeBootstrap";
import { applyDesignSystemThemeRuntime } from "./bootstrap/themeRuntime";
import { AppBootFallback } from "./features/app/components/AppBootFallback";
import { canonicalizeDesktopWorkspaceEntryRoute } from "./features/workspaces/hooks/workspaceRoute";

const rootElement = document.getElementById("root") as HTMLElement;
const bootSurface = rootElement.querySelector('[data-app-boot="workspace"]');
const root =
  bootSurface === null
    ? ReactDOM.createRoot(rootElement)
    : ReactDOM.hydrateRoot(rootElement, <AppBootFallback {...workspaceBootState} />);
async function renderEntry() {
  canonicalizeDesktopWorkspaceEntryRoute();
  applyDesignSystemThemeRuntime();
  await import("./styles/runtime");
  root.render(
    <React.StrictMode>
      <RuntimeBootstrapEffects />
      <App />
    </React.StrictMode>
  );
}

void renderEntry();
