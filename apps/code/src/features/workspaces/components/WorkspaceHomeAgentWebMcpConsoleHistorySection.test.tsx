/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hydrateRuntimeOperatorTranscriptItem,
  type HydratedRuntimeOperatorTranscriptItem,
} from "../../../application/runtime/facades/runtimeOperatorTranscript";
import { WorkspaceHomeAgentWebMcpConsoleHistorySection } from "./WorkspaceHomeAgentWebMcpConsoleHistorySection";

afterEach(() => {
  cleanup();
});

const entry: HydratedRuntimeOperatorTranscriptItem = hydrateRuntimeOperatorTranscriptItem({
  id: "exec-1",
  source: "webmcp_console",
  action: "tool",
  status: "success",
  at: 1_710_000_000_000,
  durationMs: 420,
  summary: "Fetched runtime replay sample",
  result: "result payload",
  dryRun: false,
  effectiveLimits: null,
  contextAudit: {
    callerContext: {
      provider: "openai",
      modelId: "gpt-5.3-codex",
      policySource: "caller_context",
      source: "runtime_metadata",
    },
    agentMetadata: {
      provider: "openai",
      modelId: "gpt-5.3-codex",
      source: "request_context",
    },
  },
});

describe("WorkspaceHomeAgentWebMcpConsoleHistorySection", () => {
  it("keeps history load actions interactive through the app design-system button adapter", () => {
    const onLoadResult = vi.fn();

    render(
      <WorkspaceHomeAgentWebMcpConsoleHistorySection
        executionHistory={[entry]}
        filteredExecutionHistory={[entry]}
        historyActionFilter="all"
        historyStatusFilter="all"
        historyCallerSourceFilter="all"
        historyCallerProviderFilter="all"
        onHistoryActionFilterChange={vi.fn()}
        onHistoryStatusFilterChange={vi.fn()}
        onHistoryCallerSourceFilterChange={vi.fn()}
        onHistoryCallerProviderFilterChange={vi.fn()}
        onLoadResult={onLoadResult}
      />
    );

    const loadButton = screen.getByRole("button", { name: "Load" });
    expect((loadButton as HTMLButtonElement).type).toBe("button");

    fireEvent.click(loadButton);

    expect(onLoadResult).toHaveBeenCalledWith("result payload");
    expect(screen.getByText("caller source: runtime_metadata")).toBeTruthy();
    expect(screen.getByText("caller provider: openai")).toBeTruthy();
    expect(screen.getByText("caller model: gpt-5.3-codex")).toBeTruthy();
    expect(screen.getByText("policy: caller_context")).toBeTruthy();
    expect(screen.getByText("agent source: request_context")).toBeTruthy();
    expect(screen.getByText("agent provider: openai")).toBeTruthy();
    expect(screen.getByText("agent model: gpt-5.3-codex")).toBeTruthy();
  });

  it("copies a minimal audit snapshot to clipboard without exposing result payload", async () => {
    const onLoadResult = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <WorkspaceHomeAgentWebMcpConsoleHistorySection
        executionHistory={[entry]}
        filteredExecutionHistory={[entry]}
        historyActionFilter="all"
        historyStatusFilter="all"
        historyCallerSourceFilter="all"
        historyCallerProviderFilter="all"
        onHistoryActionFilterChange={vi.fn()}
        onHistoryStatusFilterChange={vi.fn()}
        onHistoryCallerSourceFilterChange={vi.fn()}
        onHistoryCallerProviderFilterChange={vi.fn()}
        onLoadResult={onLoadResult}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy audit" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(screen.getByText("audit copied")).toBeTruthy();
    });

    const payloadText = writeText.mock.calls[0]?.[0];
    expect(typeof payloadText).toBe("string");
    const payload = JSON.parse(payloadText as string) as Record<string, unknown>;
    expect(payload).toMatchObject({
      schemaVersion: 1,
      execution: {
        id: "exec-1",
        action: "tool",
        status: "success",
        dryRun: false,
      },
      callerContext: {
        source: "runtime_metadata",
        provider: "openai",
        modelId: "gpt-5.3-codex",
        policySource: "caller_context",
      },
      agentMetadata: {
        source: "request_context",
        provider: "openai",
        modelId: "gpt-5.3-codex",
      },
    });
    expect(payloadText).not.toContain("result payload");
  });
});
