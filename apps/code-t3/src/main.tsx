import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserLaunchPage } from "./components/BrowserLaunchPage";
import { T3WorkspaceApp } from "./components/T3WorkspaceApp";
import { createHugeCodeT3RuntimeBridge } from "./runtime/hugeCodeRuntimeBridge";
import "../node_modules/@heroui/styles/dist/heroui.min.css";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("HugeCode T3 root element is missing.");
}

const searchParams = new URLSearchParams(window.location.search);
const isBrowserWindow = searchParams.get("hcbrowser") === "1";

document.title = isBrowserWindow ? "HugeCode Browser" : "HugeCode T3";

createRoot(root).render(
  <React.StrictMode>
    {isBrowserWindow ? (
      <BrowserLaunchPage
        initialAppId={searchParams.get("appId")}
        initialAppKey={searchParams.get("appKey")}
        initialAppLabel={searchParams.get("appLabel")}
        initialContinuityMode={searchParams.get("continuityMode")}
        initialContinuityStatus={searchParams.get("continuity")}
        initialDeviceCount={searchParams.get("deviceCount")}
        initialIsolationMode={searchParams.get("isolation")}
        initialLdxpAssistant={searchParams.get("ldxpAssistant") === "1"}
        initialProfileId={searchParams.get("profileId") ?? "current-browser"}
        initialProfileLabel={searchParams.get("profile") ?? "Current browser profile"}
        initialProvider={searchParams.get("provider") ?? "custom"}
        initialTargetUrl={searchParams.get("target") ?? "https://example.com/"}
      />
    ) : (
      <T3WorkspaceApp runtimeBridge={createHugeCodeT3RuntimeBridge()} />
    )}
  </React.StrictMode>
);
