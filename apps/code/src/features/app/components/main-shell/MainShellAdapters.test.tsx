/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Check from "lucide-react/dist/esm/icons/check";
import GitFork from "lucide-react/dist/esm/icons/git-fork";
import {
  WorkspaceChromePill,
  WorkspaceHeaderAction,
  WorkspaceHeaderActionCopyGlyphs,
  WorkspaceMenuSection,
  WorkspaceSupportMeta,
} from "./MainShellAdapters";

describe("MainShellAdapters", () => {
  it("renders the workspace chrome pill contract with label and meta", () => {
    render(
      <WorkspaceChromePill
        aria-label="Branch"
        leading={<GitFork size={14} aria-hidden />}
        label="main"
        meta="+3"
      />
    );

    const pill = screen.getByRole("button", { name: "Branch" });
    expect(pill.getAttribute("data-workspace-chrome")).toBe("pill");
    expect(pill.textContent).toContain("main");
    expect(pill.textContent).toContain("+3");
  });

  it("renders segmented header actions and copied state glyphs", () => {
    const onClick = vi.fn();
    render(
      <WorkspaceHeaderAction
        aria-label="Copy thread"
        copied
        icon={
          <WorkspaceHeaderActionCopyGlyphs
            copyIcon={<GitFork size={14} aria-hidden />}
            checkIcon={<Check size={14} aria-hidden />}
          />
        }
        onClick={onClick}
        segment="icon"
      />
    );

    const action = screen.getByRole("button", { name: "Copy thread" });
    fireEvent.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(action.getAttribute("data-copied")).toBe("true");
    expect(action.getAttribute("data-segment")).toBe("icon");
  });

  it("renders menu sections and compact supporting metadata", () => {
    render(
      <WorkspaceMenuSection label="Routing" description="Shared menu section contract">
        <WorkspaceSupportMeta label="Default backend" />
      </WorkspaceMenuSection>
    );

    expect(screen.getByText("Routing")).toBeTruthy();
    expect(screen.getByText("Shared menu section contract")).toBeTruthy();
    expect(screen.getByText("Default backend")).toBeTruthy();
  });
});
