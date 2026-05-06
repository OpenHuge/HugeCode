import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { T3CodeProviderRoute } from "@ku0/code-t3-runtime-adapter";
import {
  T3_OPERATOR_UNLOCK_STORAGE_KEY,
  T3_P0_RUNTIME_ROLE_MODE_CARRIER,
} from "../runtime/t3P0RuntimeRole";
import { getT3WorkspaceMessages } from "./t3WorkspaceLocale";
import { T3WorkspaceSidebar } from "./T3WorkspaceSidebar";

let mountedRoot: Root | null = null;
let mountedContainer: HTMLDivElement | null = null;

const codexRoute: T3CodeProviderRoute = {
  authState: "authenticated",
  backendId: "codex-app-server-builtin",
  backendLabel: "Built-in Codex",
  capabilities: ["codex", "reasoning"],
  installed: true,
  modelId: "gpt-5.3-codex",
  models: [],
  preferredBackendIds: ["codex-app-server-builtin"],
  provider: "codex",
  providerLabel: "Codex",
  reasons: [],
  status: "ready",
  summary: "Runtime can use the built-in Codex route.",
};

afterEach(() => {
  if (mountedRoot) {
    act(() => mountedRoot?.unmount());
  }
  mountedRoot = null;
  mountedContainer?.remove();
  mountedContainer = null;
  window.localStorage.removeItem(T3_P0_RUNTIME_ROLE_MODE_CARRIER);
  window.sessionStorage.removeItem(T3_OPERATOR_UNLOCK_STORAGE_KEY);
});

function renderSidebar(role?: "customer" | "operator" | "developer") {
  if (role) {
    window.localStorage.setItem(T3_P0_RUNTIME_ROLE_MODE_CARRIER, role);
  }
  const container = document.createElement("div");
  const onOpenBrowser = vi.fn();
  const onOpenOperatorUnlock = vi.fn();
  const onLockOperatorSession = vi.fn(() => {
    window.sessionStorage.removeItem(T3_OPERATOR_UNLOCK_STORAGE_KEY);
  });
  document.body.append(container);
  const root = createRoot(container);
  const operatorSessionUnlocked =
    window.sessionStorage.getItem(T3_OPERATOR_UNLOCK_STORAGE_KEY) === "1";
  act(() => {
    root.render(
      <T3WorkspaceSidebar
        activePage="chat"
        assistantPage="home"
        loadingRoutes={false}
        locale="zh"
        providerOrder={["codex"]}
        routes={[codexRoute]}
        selectedProvider="codex"
        selectedRoute={codexRoute}
        sidebarOpen={true}
        text={getT3WorkspaceMessages("zh")}
        timeline={[]}
        workspaceId="hugecode"
        operatorSessionUnlocked={operatorSessionUnlocked}
        onLockOperatorSession={onLockOperatorSession}
        onOpenAssistantPage={vi.fn()}
        onOpenBrowser={onOpenBrowser}
        onOpenChat={vi.fn()}
        onOpenOperatorUnlock={onOpenOperatorUnlock}
        onRefreshRoutes={vi.fn()}
        onSelectProvider={vi.fn()}
      />
    );
  });
  mountedRoot = root;
  mountedContainer = container;
  return { container, onLockOperatorSession, onOpenBrowser, onOpenOperatorUnlock };
}

describe("T3WorkspaceSidebar", () => {
  it("hides production browser controls in default customer mode", () => {
    const { container } = renderSidebar();

    expect(container.querySelector("button[aria-label='浏览器']")).toBeNull();
    expect(container.querySelector("button[aria-label='生产端入口']")).not.toBeNull();
  });

  it("opens the muted production entry from the sidebar footer", () => {
    const { container, onOpenOperatorUnlock } = renderSidebar();
    const entry = container.querySelector<HTMLButtonElement>("button[aria-label='生产端入口']");

    act(() => {
      entry?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenOperatorUnlock).toHaveBeenCalledTimes(1);
  });

  it("keeps browser management available for operator handoff preparation", () => {
    const { container } = renderSidebar("operator");

    expect(container.querySelector("button[aria-label='浏览器']")).not.toBeNull();
  });

  it("keeps session-unlocked operator browser controls visible", () => {
    window.sessionStorage.setItem(T3_OPERATOR_UNLOCK_STORAGE_KEY, "1");
    const { container, onOpenBrowser } = renderSidebar();

    expect(container.querySelector("button[aria-label='浏览器']")).not.toBeNull();
    expect(container.querySelector("button[aria-label='锁定生产端']")).not.toBeNull();
    expect(container.querySelector("button[aria-label='生产端入口']")).toBeNull();
    expect(onOpenBrowser).not.toHaveBeenCalled();
  });
});
