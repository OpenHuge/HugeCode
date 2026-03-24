// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  canonicalizeDesktopWorkspaceEntryRoute,
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

  it("rewrites the desktop root alias to the workspace home route", () => {
    window.history.replaceState({}, "", "/");

    expect(canonicalizeDesktopWorkspaceEntryRoute()).toBe(true);
    expect(window.location.pathname).toBe("/workspaces");
    expect(desktopWorkspaceNavigation.readRouteSelection()).toEqual({ kind: "home" });
    expect(readWorkspaceRouteSelection("/")).toEqual({ kind: "home" });
  });

  it("skips route canonicalization when the workspace home route is already active", () => {
    window.history.replaceState({}, "", "/workspaces");

    expect(canonicalizeDesktopWorkspaceEntryRoute()).toBe(false);
    expect(window.location.pathname).toBe("/workspaces");
  });

  it("does not rewrite the desktop missions route during entry canonicalization", () => {
    window.history.replaceState({}, "", "/missions");

    expect(canonicalizeDesktopWorkspaceEntryRoute()).toBe(false);
    expect(window.location.pathname).toBe("/missions");
    expect(desktopWorkspaceNavigation.readRouteSelection()).toEqual({ kind: "missions" });
  });

  it("maps the desktop mission home path to the home route selection", () => {
    window.history.replaceState({}, "", "/missions");

    expect(desktopWorkspaceNavigation.readRouteSelection()).toEqual({ kind: "missions" });
    expect(readWorkspaceRouteSelection("/missions")).toEqual({ kind: "missions" });
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

  it("navigates home through the workspace home path", () => {
    window.history.replaceState({}, "", "/workspaces/ws-1");

    desktopWorkspaceNavigation.navigateHome();

    expect(window.location.pathname).toBe("/workspaces");
    expect(desktopWorkspaceNavigation.readRouteSelection()).toEqual({ kind: "home" });
  });
});
