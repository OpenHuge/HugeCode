// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  clearWorkspaceRouteRestoreSelection,
  desktopWorkspaceNavigation,
  readWorkspaceRouteSelection,
} from "./workspaceRoute";

describe("workspaceRoute", () => {
  afterEach(() => {
    clearWorkspaceRouteRestoreSelection();
    window.history.replaceState({}, "", "/");
  });

  it("keeps adapter callbacks callable after extraction", () => {
    window.history.replaceState({}, "", "/workspaces");

    const readRouteSelection = desktopWorkspaceNavigation.readRouteSelection;

    expect(readRouteSelection()).toEqual({ kind: "home" });
  });

  it("reads workspace route selections from the shared workspace base path", () => {
    expect(readWorkspaceRouteSelection("/workspaces/ws-1")).toEqual({
      kind: "workspace",
      workspaceId: "ws-1",
    });
  });

  it("reads shared shell section route selections from workspace search params", () => {
    window.history.replaceState({}, "", "/workspaces?section=missions");

    expect(desktopWorkspaceNavigation.readRouteSelection()).toEqual({
      kind: "missions",
    });
    expect(readWorkspaceRouteSelection("/workspaces?section=review")).toEqual({
      kind: "review",
    });
    expect(readWorkspaceRouteSelection("/workspaces?section=settings")).toEqual({
      kind: "settings",
    });
    expect(readWorkspaceRouteSelection("/workspaces?section=workspaces")).toEqual({
      kind: "workspaces",
    });
  });
});
