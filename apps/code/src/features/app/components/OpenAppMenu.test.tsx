/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpenAppMenu } from "./OpenAppMenu";

const isDesktopHostRuntimeMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("@desktop-host/core", () => ({
  isDesktopHostRuntime: () => isDesktopHostRuntimeMock(),
}));

vi.mock("@desktop-host/opener", () => ({
  revealItemInDir: vi.fn(async () => undefined),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

describe("OpenAppMenu", () => {
  it("renders on the web surface instead of returning null", () => {
    const { container } = render(
      <OpenAppMenu
        path="/workspace"
        openTargets={[
          {
            id: "vscode",
            label: "VS Code",
            kind: "command",
            command: "code",
            args: [],
          },
        ]}
        selectedOpenAppId="vscode"
        onSelectOpenAppId={vi.fn()}
      />
    );

    const openButton = screen.getByRole("button", { name: "Open in VS Code" });
    expect(openButton).toBeTruthy();
    expect((openButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Select editor" })).toBeTruthy();
    expect(container.querySelector('[data-ui-select-root="true"]')).toBeTruthy();
  });

  it("renders the antigravity launcher target on the web surface", () => {
    render(
      <OpenAppMenu
        path="/workspace"
        openTargets={[
          {
            id: "antigravity",
            label: "Antigravity",
            kind: "command",
            command: "antigravity",
            args: [],
          },
        ]}
        selectedOpenAppId="antigravity"
        onSelectOpenAppId={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Open in Antigravity" })).toBeTruthy();
  });

  it("uses the folder icon for finder targets even when the id is custom", () => {
    const { container } = render(
      <OpenAppMenu
        path="/workspace"
        openTargets={[
          {
            id: "explorer-custom",
            label: "Explorer",
            kind: "finder",
            args: [],
          },
        ]}
        selectedOpenAppId="explorer-custom"
        onSelectOpenAppId={vi.fn()}
      />
    );

    const icon = container.querySelector('[data-open-app-icon="finder"]');
    expect(icon?.tagName.toLowerCase()).toBe("svg");
    expect(container.querySelector(".open-app-icon--trigger")).toBeTruthy();
  });
});
