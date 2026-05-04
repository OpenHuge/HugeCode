import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { T3CodeProviderRoute } from "@ku0/code-t3-runtime-adapter";
import { T3_P0_RUNTIME_ROLE_MODE_CARRIER } from "../runtime/t3P0RuntimeRole";
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
});

function renderSidebar(role?: "customer" | "operator" | "developer") {
  if (role) {
    window.localStorage.setItem(T3_P0_RUNTIME_ROLE_MODE_CARRIER, role);
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
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
        onOpenAssistantPage={vi.fn()}
        onOpenBrowser={vi.fn()}
        onOpenChat={vi.fn()}
        onRefreshRoutes={vi.fn()}
        onSelectProvider={vi.fn()}
      />
    );
  });
  mountedRoot = root;
  mountedContainer = container;
  return { container };
}

describe("T3WorkspaceSidebar", () => {
  it("hides the browser management bypass in default customer mode", () => {
    const { container } = renderSidebar();

    expect(container.querySelector("button[aria-label='浏览器']")).toBeNull();
  });

  it("keeps browser management available for operator handoff preparation", () => {
    const { container } = renderSidebar("operator");

    expect(container.querySelector("button[aria-label='浏览器']")).not.toBeNull();
  });
});
