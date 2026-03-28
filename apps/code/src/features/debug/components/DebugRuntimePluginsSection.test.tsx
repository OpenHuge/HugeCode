// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DebugRuntimePluginsSection } from "./DebugRuntimePluginsSection";

describe("DebugRuntimePluginsSection", () => {
  it("renders plugin entries and projection state", () => {
    render(
      <DebugRuntimePluginsSection
        loading={false}
        error={null}
        projectionBacked
        plugins={[
          {
            id: "ext-1",
            name: "Test Plugin",
            version: "1.0.0",
            summary: null,
            source: "runtime_extension",
            transport: "runtime_extension",
            hostProfile: {
              kind: "runtime",
              executionBoundaries: ["runtime"],
            },
            workspaceId: "workspace-1",
            enabled: true,
            runtimeBacked: true,
            capabilities: [{ id: "tool:bash", enabled: true }],
            permissions: ["network"],
            resources: [],
            executionBoundaries: ["runtime"],
            binding: {
              state: "bound",
              contractFormat: "runtime_extension",
              contractBoundary: "runtime-extension-record",
              interfaceId: "ext-1",
              surfaces: [
                {
                  id: "ext-1",
                  kind: "extension",
                  direction: "export",
                  summary: "Runtime extension record exported through the kernel plugin catalog.",
                },
              ],
            },
            operations: {
              execution: {
                executable: false,
                mode: "none",
                reason:
                  "Plugin `ext-1` is bound for catalog/resource access only and does not expose an execution provider.",
              },
              resources: {
                readable: true,
                mode: "runtime_extension_resource",
                reason: null,
              },
              permissions: {
                evaluable: true,
                mode: "runtime_extension_permissions",
                reason: null,
              },
            },
            metadata: null,
            permissionDecision: null,
            health: null,
          },
        ]}
      />
    );

    expect(screen.getByTestId("debug-runtime-plugins")).toBeTruthy();
    expect(screen.getByText(/projection extensions: connected/i)).toBeTruthy();
    expect(screen.getByText(/Test Plugin \(1\.0\.0\)/)).toBeTruthy();
    expect(screen.getByText("network")).toBeTruthy();
    expect(screen.getByText("bound")).toBeTruthy();
    expect(screen.getByText("blocked")).toBeTruthy();
    expect(screen.getByText("readable")).toBeTruthy();
    expect(screen.getByText("evaluable")).toBeTruthy();
    expect(screen.getByText("export:extension:ext-1")).toBeTruthy();
    expect(
      screen.getByText(/catalog\/resource access only and does not expose an execution provider/i)
    ).toBeTruthy();
    expect(screen.getByText("runtime-extension-record")).toBeTruthy();
  });
});
