// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

describe("Tabs", () => {
  it("moves focus and selection together in automatic mode", () => {
    render(
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="changes">Changes</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="changes">Changes panel</TabsContent>
        <TabsContent value="history">History panel</TabsContent>
      </Tabs>
    );

    const overview = screen.getByRole("tab", { name: "Overview" });
    const changes = screen.getByRole("tab", { name: "Changes" });

    overview.focus();
    fireEvent.keyDown(overview, { key: "ArrowRight" });

    expect(document.activeElement).toBe(changes);
    expect(changes.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toContain("Changes panel");
  });

  it("keeps focus movement separate from selection in manual mode", () => {
    render(
      <Tabs defaultValue="summary" orientation="vertical" activationMode="manual">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="diff">Diff</TabsTrigger>
          <TabsTrigger value="artifacts" disabled>
            Artifacts
          </TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">Summary panel</TabsContent>
        <TabsContent value="diff">Diff panel</TabsContent>
        <TabsContent value="artifacts">Artifacts panel</TabsContent>
        <TabsContent value="logs">Logs panel</TabsContent>
      </Tabs>
    );

    const summary = screen.getByRole("tab", { name: "Summary" });
    const diff = screen.getByRole("tab", { name: "Diff" });
    const logs = screen.getByRole("tab", { name: "Logs" });

    summary.focus();
    fireEvent.keyDown(summary, { key: "ArrowDown" });

    expect(document.activeElement).toBe(diff);
    expect(summary.getAttribute("aria-selected")).toBe("true");
    expect(diff.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tabpanel").textContent).toContain("Summary panel");

    fireEvent.keyDown(diff, { key: "End" });
    expect(document.activeElement).toBe(logs);

    fireEvent.click(logs);
    expect(logs.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toContain("Logs panel");
  });
});
