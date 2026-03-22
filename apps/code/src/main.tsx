import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { RuntimeBootstrapEffects } from "./bootstrap/runtimeBootstrap";
import { applyDesignSystemThemeRuntime } from "./bootstrap/themeRuntime";

const rootElement = document.getElementById("root") as HTMLElement;
const root = ReactDOM.createRoot(rootElement);
async function renderEntry() {
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
