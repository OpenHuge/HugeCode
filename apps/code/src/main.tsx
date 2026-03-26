import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { RuntimeBootstrapEffects } from "./bootstrap/runtimeBootstrap";
import { applyDesignSystemThemeRuntime } from "./bootstrap/themeRuntime";
import { canonicalizeDesktopWorkspaceEntryRoute } from "./features/workspaces/hooks/workspaceRoute";

const rootElement = document.getElementById("root") as HTMLElement;
const root = ReactDOM.createRoot(rootElement);
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
