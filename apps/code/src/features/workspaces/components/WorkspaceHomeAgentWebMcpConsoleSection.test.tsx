// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RUNTIME_MESSAGE_CODES } from "../../../application/runtime/ports/runtimeMessageCodes";
import { WebMcpInputSchemaValidationError } from "../../../application/runtime/ports/webMcpInputSchemaValidationError";
import { WorkspaceHomeAgentWebMcpConsoleSection } from "./WorkspaceHomeAgentWebMcpConsoleSection";

vi.mock("../../../application/runtime/ports/webMcpBridge", () => ({
  listWebMcpCatalog: vi.fn(),
  callWebMcpTool: vi.fn(),
  createWebMcpMessage: vi.fn(),
  elicitWebMcpInput: vi.fn(),
  invalidateCachedRuntimeLiveSkills: vi.fn(),
  getWebMcpCapabilities: vi.fn(() => ({
    modelContext: true,
    tools: {
      provideContext: true,
      clearContext: true,
      registerTool: true,
      unregisterTool: true,
      listTools: true,
      callTool: true,
    },
    resources: {
      registerResource: true,
      unregisterResource: true,
      listResources: true,
      listResourceTemplates: true,
    },
    prompts: {
      registerPrompt: true,
      unregisterPrompt: true,
      listPrompts: true,
    },
    model: {
      createMessage: true,
      elicitInput: true,
    },
    supported: true,
    missingRequired: [],
  })),
}));

import {
  callWebMcpTool,
  createWebMcpMessage,
  elicitWebMcpInput,
  getWebMcpCapabilities,
  invalidateCachedRuntimeLiveSkills,
  listWebMcpCatalog,
} from "../../../application/runtime/ports/webMcpBridge";

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

beforeEach(() => {
  vi.mocked(callWebMcpTool).mockImplementation(async (request) => {
    if (request.name === "get-runtime-tool-execution-metrics") {
      return {
        ok: true,
        data: {
          metrics: {
            totals: {
              attemptedTotal: 12,
              startedTotal: 11,
              completedTotal: 10,
              successTotal: 9,
              validationFailedTotal: 0,
              runtimeFailedTotal: 1,
              timeoutTotal: 0,
              blockedTotal: 2,
            },
            byTool: {
              "runtime:execute-workspace-command": {
                toolName: "execute-workspace-command",
                scope: "runtime",
                attemptedTotal: 4,
                startedTotal: 4,
                completedTotal: 4,
                successTotal: 3,
                validationFailedTotal: 0,
                runtimeFailedTotal: 1,
                timeoutTotal: 0,
                blockedTotal: 0,
              },
            },
            recent: [],
            updatedAt: Date.now(),
            windowSize: 500,
            channelHealth: {
              status: "healthy",
              reason: null,
              lastErrorCode: null,
              updatedAt: Date.now(),
            },
            circuitBreakers: [
              {
                scope: "write",
                state: "closed",
                openedAt: null,
                updatedAt: Date.now(),
              },
              {
                scope: "runtime",
                state: "closed",
                openedAt: null,
                updatedAt: Date.now(),
              },
              {
                scope: "computer_observe",
                state: "closed",
                openedAt: null,
                updatedAt: Date.now(),
              },
            ],
          },
          guardrails: {
            windowSize: 500,
            payloadLimitBytes: 65_536,
            computerObserveRateLimitPerMinute: 12,
            circuitWindowSize: 50,
            circuitMinCompleted: 20,
            circuitOpenMs: 600_000,
            halfOpenMaxProbes: 3,
            halfOpenRequiredSuccesses: 2,
            channelHealth: {
              status: "healthy",
              reason: null,
              lastErrorCode: null,
              updatedAt: Date.now(),
            },
            circuitBreakers: [
              {
                scope: "write",
                state: "closed",
                openedAt: null,
                updatedAt: Date.now(),
              },
              {
                scope: "runtime",
                state: "closed",
                openedAt: null,
                updatedAt: Date.now(),
              },
              {
                scope: "computer_observe",
                state: "closed",
                openedAt: null,
                updatedAt: Date.now(),
              },
            ],
            updatedAt: Date.now(),
          },
          metricsSummary: {
            effectiveLimitsByProfile: {
              default: {
                payloadLimitBytes: 65_536,
                computerObserveRateLimitPerMinute: 12,
              },
              soloMax: {
                payloadLimitBytes: 262_144,
                computerObserveRateLimitPerMinute: 60,
              },
            },
          },
        },
      };
    }
    return { ok: true };
  });
});

function createCatalog(overrides?: Partial<Awaited<ReturnType<typeof listWebMcpCatalog>>>) {
  return {
    tools: [{ name: "get-project-overview" }],
    resources: [{ uri: "hugecode://workspace/ws-1/overview" }],
    resourceTemplates: [],
    prompts: [{ name: "summarize-workspace-status" }],
    capabilities: {
      modelContext: true,
      tools: {
        provideContext: true,
        clearContext: true,
        registerTool: true,
        unregisterTool: true,
        listTools: true,
        callTool: true,
      },
      resources: {
        registerResource: true,
        unregisterResource: true,
        listResources: true,
        listResourceTemplates: true,
      },
      prompts: {
        registerPrompt: true,
        unregisterPrompt: true,
        listPrompts: true,
      },
      model: {
        createMessage: true,
        elicitInput: true,
      },
      supported: true,
      missingRequired: [],
    },
    ...overrides,
  };
}

function renderSection(
  overrides: Partial<{
    webMcpSupported: boolean;
    webMcpEnabled: boolean;
    catalogRevision: number;
    autoExecuteCalls: boolean;
    onSetAutoExecuteCalls: (value: boolean) => void;
    mode: "basic" | "advanced";
    onSetMode: (mode: "basic" | "advanced") => void;
  }> = {}
) {
  return render(
    <WorkspaceHomeAgentWebMcpConsoleSection
      webMcpSupported={overrides.webMcpSupported ?? true}
      webMcpEnabled={overrides.webMcpEnabled ?? true}
      catalogRevision={overrides.catalogRevision ?? 0}
      autoExecuteCalls={overrides.autoExecuteCalls ?? true}
      onSetAutoExecuteCalls={overrides.onSetAutoExecuteCalls ?? vi.fn()}
      mode={overrides.mode ?? "advanced"}
      onSetMode={overrides.onSetMode ?? vi.fn()}
    />
  );
}

describe("WorkspaceHomeAgentWebMcpConsoleSection", () => {
  it("auto loads catalog and renders counts", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog());
    const { container } = renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
      expect(screen.getByText("tools: 1")).toBeTruthy();
      expect(screen.getByText("resources: 1")).toBeTruthy();
      expect(screen.getByText("prompts: 1")).toBeTruthy();
      expect(
        container.querySelector(
          '.workspace-home-webmcp-console-chip[data-shape="chip"][data-tone="success"]'
        )
      ).toBeTruthy();
    });
  });

  it("invalidates cached live skills before refreshing catalog", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog());
    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh catalog" }));

    await waitFor(() => {
      expect(invalidateCachedRuntimeLiveSkills).toHaveBeenCalledTimes(2);
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(2);
    });
  });

  it("refreshes catalog when the workspace catalog revision increases", async () => {
    let catalogRevision = 0;
    vi.mocked(listWebMcpCatalog)
      .mockResolvedValueOnce(createCatalog())
      .mockResolvedValueOnce(
        createCatalog({
          tools: [{ name: "get-project-overview" }, { name: "search-workspace-files" }],
        })
      );

    const { rerender } = renderSection({ catalogRevision });

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
      expect(screen.getByText("tools: 1")).toBeTruthy();
    });

    catalogRevision = 1;
    rerender(
      <WorkspaceHomeAgentWebMcpConsoleSection
        webMcpSupported
        webMcpEnabled
        catalogRevision={catalogRevision}
        autoExecuteCalls
        onSetAutoExecuteCalls={vi.fn()}
        mode="advanced"
        onSetMode={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(invalidateCachedRuntimeLiveSkills).toHaveBeenCalledTimes(2);
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(2);
      expect(screen.getByText("tools: 2")).toBeTruthy();
    });
  });

  it("renders runtime metrics summary card", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog());
    renderSection();

    await waitFor(() => {
      expect(screen.getByText("Runtime Tool Metrics")).toBeTruthy();
      expect(screen.getByText("overall success rate: 90.0%")).toBeTruthy();
      expect(screen.getByText("gate (>= 95.0%): fail")).toBeTruthy();
      expect(
        screen.getByText(
          "Inspect runtime tool metrics and recover top failed tools before launching."
        )
      ).toBeTruthy();
      expect(screen.getByText("blocked: 2")).toBeTruthy();
      expect(screen.getByText("window: 500")).toBeTruthy();
      expect(screen.getByText(/execute-workspace-command \(runtime\)/)).toBeTruthy();
      expect(screen.getByText("default limits: 65536B / 12/min")).toBeTruthy();
      expect(screen.getByText("solo-max limits: 262144B / 60/min")).toBeTruthy();
    });
  });

  it("disables run tool when runtime metrics channel is unavailable", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog({ resources: [], prompts: [] }));
    vi.mocked(callWebMcpTool).mockImplementation(async (request) => {
      if (request.name === "get-runtime-tool-execution-metrics") {
        throw {
          code: RUNTIME_MESSAGE_CODES.runtime.validation.metricsUnavailable,
        };
      }
      return { ok: true };
    });

    renderSection();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Runtime metrics channel is unavailable. Run tool is disabled until it recovers."
        )
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Run tool" }).hasAttribute("disabled")).toBe(true);
    });
  }, 10_000);

  it("disables catalog refresh when required list methods are missing", async () => {
    vi.mocked(getWebMcpCapabilities).mockReturnValue({
      ...createCatalog().capabilities,
      prompts: {
        ...createCatalog().capabilities.prompts,
        listPrompts: false,
      },
    });

    renderSection();

    await waitFor(() => {
      expect(screen.getByText("listCatalog: missing")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Refresh catalog" }).hasAttribute("disabled")).toBe(
        true
      );
    });

    expect(listWebMcpCatalog).not.toHaveBeenCalled();
  });

  it("runs callTool when auto execute is enabled", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog({ resources: [], prompts: [] }));
    vi.mocked(callWebMcpTool).mockResolvedValue({ ok: true });
    renderSection();

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "get-project-overview" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => {
      expect(callWebMcpTool).toHaveBeenCalledWith({
        name: "get-project-overview",
        arguments: {},
      });
      expect(screen.getByText(/"ok": true/)).toBeTruthy();
      expect(screen.getByText("Recent Executions")).toBeTruthy();
      const historyList = document.querySelector<HTMLElement>(
        ".workspace-home-webmcp-console-history-list"
      );
      if (!historyList) {
        throw new Error("History list not found");
      }
      expect(within(historyList).getByText("tool call")).toBeTruthy();
    });
  }, 10_000);

  it("shows execution duration in history entries", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog({ resources: [], prompts: [] }));
    vi.mocked(callWebMcpTool).mockResolvedValue({ ok: true, id: "duration-1" });

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => {
      const historySection = screen
        .getByText("Recent Executions")
        .closest<HTMLElement>(".workspace-home-webmcp-console-history");
      if (!historySection) {
        throw new Error("History section not found");
      }
      expect(within(historySection).getByText((text) => /^\d+ms$/.test(text))).toBeTruthy();
    });
  });

  it("applies schema template for selected tool", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(
      createCatalog({
        tools: [
          {
            name: "deploy",
            inputSchema: {
              type: "object",
              properties: {
                channel: { type: "string", default: "stable" },
                dryRun: { type: "boolean" },
              },
            },
          },
        ],
      })
    );

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Schema template" }));

    await waitFor(() => {
      const textarea = screen.getByLabelText("Arguments JSON") as HTMLTextAreaElement;
      expect(textarea.value).toBe('{\n  "channel": "stable",\n  "dryRun": false\n}');
    });
  });

  it("defaults dryRun to true for runtime workspace write tools", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(
      createCatalog({
        tools: [
          {
            name: "execute-workspace-command",
            inputSchema: {
              type: "object",
              properties: {
                command: { type: "string" },
                dryRun: { type: "boolean" },
              },
            },
          },
        ],
      })
    );

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Schema template" }));

    await waitFor(() => {
      const textarea = screen.getByLabelText("Arguments JSON") as HTMLTextAreaElement;
      expect(textarea.value).toBe(`{
  "command": "",
  "dryRun": true
}`);
    });
  });

  it("disables run tool when required schema fields are missing", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(
      createCatalog({
        tools: [
          {
            name: "read-workspace-file",
            inputSchema: {
              type: "object",
              properties: {
                path: { type: "string" },
              },
              required: ["path"],
            },
          },
        ],
      })
    );

    renderSection();

    await waitFor(() => {
      expect(screen.getByText("Tool arguments schema validation:")).toBeTruthy();
      expect(screen.getByText("Missing required field: path")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Run tool" }).hasAttribute("disabled")).toBe(true);
    });
  });

  it("disables run tool when schema type validation fails", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(
      createCatalog({
        tools: [
          {
            name: "execute-workspace-command",
            inputSchema: {
              type: "object",
              properties: {
                command: { type: "string" },
                timeoutMs: { type: "number" },
              },
              required: ["command"],
            },
          },
        ],
      })
    );

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("Arguments JSON"), {
      target: {
        value: '{\n  "command": "echo hello",\n  "timeoutMs": "5000"\n}',
      },
    });

    await waitFor(() => {
      expect(
        screen.getByText("Invalid field type at timeoutMs: expected number, received string.")
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Run tool" }).hasAttribute("disabled")).toBe(true);
    });
  });

  it("surfaces bridge schema validation errors after a tool run attempt", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(
      createCatalog({
        tools: [
          {
            name: "execute-workspace-command",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
        resources: [],
        prompts: [],
      })
    );
    vi.mocked(callWebMcpTool).mockRejectedValue(
      new WebMcpInputSchemaValidationError({
        toolName: "execute-workspace-command",
        scope: "write",
        validation: {
          errors: ["Missing required field: command"],
          warnings: [],
          missingRequired: ["command"],
          typeMismatches: [],
          extraFields: [],
        },
      })
    );

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Run tool" }).hasAttribute("disabled")).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => {
      expect(
        screen.getAllByText(
          "Input schema validation failed for execute-workspace-command: Missing required field: command"
        ).length
      ).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Run tool" }).hasAttribute("disabled")).toBe(true);
    });
  }, 10_000);

  it("surfaces structured schema validation payloads without message parsing", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(
      createCatalog({
        tools: [
          {
            name: "execute-workspace-command",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
        resources: [],
        prompts: [],
      })
    );
    vi.mocked(callWebMcpTool).mockRejectedValue({
      code: "INPUT_SCHEMA_VALIDATION_FAILED",
      validation: {
        errors: ["Missing required field: command"],
        warnings: [],
        missingRequired: ["command"],
        typeMismatches: [],
        extraFields: [],
      },
    });

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Run tool" }).hasAttribute("disabled")).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => {
      expect(screen.getByText("Missing required field: command")).toBeTruthy();
      expect(
        screen.getAllByText("Request failed (INPUT_SCHEMA_VALIDATION_FAILED).").length
      ).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Run tool" }).hasAttribute("disabled")).toBe(true);
    });
  }, 10_000);

  it("shows extra field warnings but allows tool execution", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(
      createCatalog({
        tools: [
          {
            name: "read-workspace-file",
            inputSchema: {
              type: "object",
              properties: {
                path: { type: "string" },
              },
              required: ["path"],
            },
          },
        ],
        resources: [],
        prompts: [],
      })
    );
    vi.mocked(callWebMcpTool).mockResolvedValue({ ok: true, result: "done" });

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("Arguments JSON"), {
      target: {
        value: '{\n  "path": "README.md",\n  "unexpected": true\n}',
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Tool arguments schema warnings:")).toBeTruthy();
      expect(screen.getByText("Unexpected field: unexpected")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Run tool" }).hasAttribute("disabled")).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => {
      expect(callWebMcpTool).toHaveBeenCalledWith({
        name: "read-workspace-file",
        arguments: {
          path: "README.md",
          unexpected: true,
        },
      });
    });
  });

  it("shows actionable fix hints for runtime path guard errors", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(
      createCatalog({
        tools: [
          {
            name: "read-workspace-file",
            inputSchema: {
              type: "object",
              properties: {
                path: { type: "string" },
              },
              required: ["path"],
            },
          },
        ],
        resources: [],
        prompts: [],
      })
    );
    vi.mocked(callWebMcpTool).mockRejectedValue({
      code: RUNTIME_MESSAGE_CODES.runtime.validation.pathOutsideWorkspace,
    });

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Run tool" }).hasAttribute("disabled")).toBe(false);
    });

    fireEvent.change(screen.getByLabelText("Arguments JSON"), {
      target: {
        value: '{\n  "path": "../secrets.txt"\n}',
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => {
      expect(
        screen.getAllByText(
          `Request failed (${RUNTIME_MESSAGE_CODES.runtime.validation.pathOutsideWorkspace}).`
        ).length
      ).toBeGreaterThan(0);
      expect(screen.getByText("Suggested fixes:")).toBeTruthy();
      expect(screen.getByText("Use workspace-relative paths like `src/index.ts`.")).toBeTruthy();
      expect(
        screen.getByText("Remove absolute prefixes and `..` segments from the path.")
      ).toBeTruthy();
    });
  }, 10_000);

  it("shows effective guardrail limit hint when payload guardrail blocks execution", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog({ resources: [], prompts: [] }));
    vi.mocked(callWebMcpTool).mockRejectedValue(
      new Error(
        "Request failed (runtime.validation.payload_too_large). Payload exceeds runtime guardrail size limit. (effective limits: payload<=65536B, computer_observe<=12/min)"
      )
    );

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Run tool" }).hasAttribute("disabled")).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => {
      expect(screen.getByText("Suggested fixes:")).toBeTruthy();
      expect(
        screen.getByText("Current effective limits: payload<=65536B, computer_observe<=12/min.")
      ).toBeTruthy();
    });
  });

  it("shows effective guardrail limits in execution history entries", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog({ resources: [], prompts: [] }));
    vi.mocked(callWebMcpTool).mockRejectedValue(
      new Error(
        "Request failed (runtime.validation.payload_too_large). Payload exceeds runtime guardrail size limit. (effective limits: payload<=65536B, computer_observe<=12/min)"
      )
    );

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Run tool" }).hasAttribute("disabled")).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => {
      const historySection = screen
        .getByText("Recent Executions")
        .closest<HTMLElement>(".workspace-home-webmcp-console-history");
      if (!historySection) {
        throw new Error("History section not found");
      }
      expect(
        within(historySection).getByText("limits payload<=65536B, observe<=12/min")
      ).toBeTruthy();
    });
  });

  it("marks dry-run tool executions in history", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(
      createCatalog({
        tools: [
          {
            name: "execute-workspace-command",
            inputSchema: {
              type: "object",
              properties: {
                command: { type: "string" },
                dryRun: { type: "boolean" },
              },
              required: ["command"],
            },
          },
        ],
      })
    );
    vi.mocked(callWebMcpTool).mockResolvedValue({
      ok: true,
      message: "Workspace command dry-run prepared.",
      data: {
        result: {
          metadata: {
            dryRun: true,
            providerDiagnostics: {
              callerProvider: "openai",
              callerModelId: "gpt-5.3-codex",
              policySource: "caller_context",
            },
          },
        },
      },
    });

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("Arguments JSON"), {
      target: {
        value:
          '{\n  "command": "pnpm test",\n  "dryRun": true,\n  "context": {\n    "provider": "openai",\n    "modelId": "gpt-5.3-codex"\n  }\n}',
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => {
      const historySection = screen
        .getByText("Recent Executions")
        .closest<HTMLElement>(".workspace-home-webmcp-console-history");
      if (!historySection) {
        throw new Error("History section not found");
      }
      expect(within(historySection).getByText("dry-run")).toBeTruthy();
      expect(within(historySection).getByText("caller source: runtime_metadata")).toBeTruthy();
      expect(within(historySection).getByText("caller provider: openai")).toBeTruthy();
      expect(within(historySection).getByText("caller model: gpt-5.3-codex")).toBeTruthy();
      expect(within(historySection).getByText("policy: caller_context")).toBeTruthy();
      expect(within(historySection).getByText("agent source: request_context")).toBeTruthy();
      expect(within(historySection).getByText("agent provider: openai")).toBeTruthy();
      expect(within(historySection).getByText("agent model: gpt-5.3-codex")).toBeTruthy();
    });
  });

  it("marks dry-run tool errors in history", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(
      createCatalog({
        tools: [
          {
            name: "execute-workspace-command",
            inputSchema: {
              type: "object",
              properties: {
                command: { type: "string" },
                dryRun: { type: "boolean" },
              },
              required: ["command"],
            },
          },
        ],
      })
    );
    vi.mocked(callWebMcpTool).mockRejectedValue(new Error("runtime failed"));

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("Arguments JSON"), {
      target: {
        value:
          '{\n  "command": "pnpm test",\n  "dryRun": true,\n  "context": {\n    "provider": "anthropic",\n    "modelId": "claude-3-7-sonnet"\n  }\n}',
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => {
      const historySection = screen
        .getByText("Recent Executions")
        .closest<HTMLElement>(".workspace-home-webmcp-console-history");
      if (!historySection) {
        throw new Error("History section not found");
      }
      expect(within(historySection).getByText("dry-run")).toBeTruthy();
      expect(within(historySection).getByText("runtime failed")).toBeTruthy();
      expect(within(historySection).getByText("caller source: request_context")).toBeTruthy();
      expect(within(historySection).getByText("caller provider: anthropic")).toBeTruthy();
      expect(within(historySection).getByText("caller model: claude-3-7-sonnet")).toBeTruthy();
      expect(within(historySection).getByText("agent source: request_context")).toBeTruthy();
      expect(within(historySection).getByText("agent provider: anthropic")).toBeTruthy();
      expect(within(historySection).getByText("agent model: claude-3-7-sonnet")).toBeTruthy();
    });
  });

  it("updates schema preview when selecting a different tool", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(
      createCatalog({
        tools: [
          {
            name: "tool-a",
            inputSchema: {
              type: "object",
              properties: {
                firstArg: { type: "string" },
              },
            },
          },
          {
            name: "tool-b",
            inputSchema: {
              type: "object",
              properties: {
                secondArg: { type: "boolean" },
              },
            },
          },
        ],
      })
    );

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
      const toolCard = screen
        .getByText("Tool Call")
        .closest<HTMLElement>(".workspace-home-webmcp-console-card");
      if (!toolCard) {
        throw new Error("Tool Call card not found");
      }
      expect(within(toolCard).getByText(/"firstArg"/)).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Tool"), {
      target: { value: "tool-b" },
    });

    await waitFor(() => {
      const toolCard = screen
        .getByText("Tool Call")
        .closest<HTMLElement>(".workspace-home-webmcp-console-card");
      if (!toolCard) {
        throw new Error("Tool Call card not found");
      }
      expect(within(toolCard).getByText(/"secondArg"/)).toBeTruthy();
    });
  });

  it("disables tool execution when callTool capability is missing", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(
      createCatalog({
        capabilities: {
          ...createCatalog().capabilities,
          tools: {
            ...createCatalog().capabilities.tools,
            callTool: false,
          },
        },
      })
    );
    vi.mocked(getWebMcpCapabilities).mockReturnValue({
      ...createCatalog().capabilities,
      tools: {
        ...createCatalog().capabilities.tools,
        callTool: false,
      },
    });

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("button", { name: "Run tool" }).hasAttribute("disabled")).toBe(true);
  });

  it("respects manual confirmation when auto execute is disabled", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog({ resources: [], prompts: [] }));
    vi.mocked(createWebMcpMessage).mockResolvedValue({ model: "stub" });
    vi.mocked(elicitWebMcpInput).mockResolvedValue({ action: "accept" });

    renderSection({
      autoExecuteCalls: false,
      mode: "advanced",
    });

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Run createMessage" }));
    fireEvent.click(screen.getByRole("button", { name: "Run elicitInput" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(createWebMcpMessage).not.toHaveBeenCalled();
      expect(elicitWebMcpInput).not.toHaveBeenCalled();
      expect(screen.getByText("Execution cancelled.")).toBeTruthy();
    });
    confirmSpy.mockRestore();
  });

  it("disables run createMessage when schema required fields are missing", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog({ resources: [], prompts: [] }));

    renderSection({
      mode: "advanced",
    });

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getAllByLabelText("Payload JSON")[0], {
      target: {
        value: '{\n  "messages": []\n}',
      },
    });

    await waitFor(() => {
      expect(screen.getByText("createMessage schema validation:")).toBeTruthy();
      expect(screen.getByText("Missing required field: maxTokens")).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Run createMessage" }).hasAttribute("disabled")
      ).toBe(true);
    });
  });

  it("disables run elicitInput when schema validation fails", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog({ resources: [], prompts: [] }));

    renderSection({
      mode: "advanced",
    });

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getAllByLabelText("Payload JSON")[1], {
      target: {
        value: '{\n  "mode": "form",\n  "message": "Need channel"\n}',
      },
    });

    await waitFor(() => {
      expect(screen.getByText("elicitInput schema validation:")).toBeTruthy();
      expect(
        screen.getByText(
          "Invalid field value at : value does not match any allowed schema variant."
        )
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Run elicitInput" }).hasAttribute("disabled")).toBe(
        true
      );
    });
  });

  it("copies last result to clipboard", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog({ resources: [], prompts: [] }));
    vi.mocked(callWebMcpTool).mockResolvedValue({ ok: true, id: "result-1" });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => {
      expect(screen.getByText(/"id": "result-1"/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('{\n  "ok": true,\n  "id": "result-1"\n}');
      expect(screen.getByText("Result copied to clipboard.")).toBeTruthy();
    });
  }, 10_000);

  it("loads a previous execution from history", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog({ resources: [], prompts: [] }));
    vi.mocked(callWebMcpTool).mockResolvedValue({ ok: true, id: "result-2" });

    renderSection();

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => {
      expect(screen.getByText(/"id": "result-2"/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("No calls executed yet.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await waitFor(() => {
      expect(screen.getByText(/"id": "result-2"/)).toBeTruthy();
    });
  }, 10_000);

  it("filters history entries by action and status", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog({ resources: [], prompts: [] }));
    vi.mocked(callWebMcpTool).mockResolvedValue({ ok: true, id: "history-tool-1" });
    vi.mocked(createWebMcpMessage).mockRejectedValue(new Error("model unavailable"));

    renderSection({
      mode: "advanced",
    });

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));
    await waitFor(() => {
      expect(callWebMcpTool).toHaveBeenCalledWith({
        name: "get-project-overview",
        arguments: {},
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Run createMessage" }));
    await waitFor(() => {
      expect(createWebMcpMessage).toHaveBeenCalledTimes(1);
    });

    const historySection = screen
      .getByText("Recent Executions")
      .closest<HTMLElement>(".workspace-home-webmcp-console-history");
    if (!historySection) {
      throw new Error("History section not found");
    }

    fireEvent.change(within(historySection).getByLabelText("History action filter"), {
      target: { value: "createMessage" },
    });
    fireEvent.change(within(historySection).getByLabelText("History status filter"), {
      target: { value: "error" },
    });

    await waitFor(() => {
      const historyList = historySection.querySelector<HTMLElement>(
        ".workspace-home-webmcp-console-history-list"
      );
      if (!historyList) {
        throw new Error("History list not found");
      }
      expect(within(historyList).getByText("createMessage")).toBeTruthy();
      expect(within(historyList).queryByText("tool call")).toBeNull();
      expect(within(historyList).getByText("model unavailable")).toBeTruthy();
    });

    fireEvent.change(within(historySection).getByLabelText("History action filter"), {
      target: { value: "elicitInput" },
    });

    await waitFor(() => {
      expect(screen.getByText("No execution history for selected filters.")).toBeTruthy();
    });
  });

  it("filters history entries by caller source and provider", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog({ resources: [], prompts: [] }));
    vi.mocked(callWebMcpTool).mockResolvedValue({
      ok: true,
      id: "history-tool-context",
      data: {
        result: {
          metadata: {
            providerDiagnostics: {
              callerProvider: "openai",
              callerModelId: "gpt-5.3-codex",
              policySource: "caller_context",
            },
          },
        },
      },
    });
    vi.mocked(createWebMcpMessage).mockRejectedValue(new Error("model unavailable"));

    renderSection({
      mode: "advanced",
    });

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));
    await waitFor(() => {
      expect(callWebMcpTool).toHaveBeenCalledWith({
        name: "get-project-overview",
        arguments: {},
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Run createMessage" }));
    await waitFor(() => {
      expect(createWebMcpMessage).toHaveBeenCalledTimes(1);
    });

    const historySection = screen
      .getByText("Recent Executions")
      .closest<HTMLElement>(".workspace-home-webmcp-console-history");
    if (!historySection) {
      throw new Error("History section not found");
    }

    fireEvent.change(within(historySection).getByLabelText("History caller source filter"), {
      target: { value: "runtime_metadata" },
    });
    fireEvent.change(within(historySection).getByLabelText("History caller provider filter"), {
      target: { value: "openai" },
    });

    await waitFor(() => {
      const historyList = historySection.querySelector<HTMLElement>(
        ".workspace-home-webmcp-console-history-list"
      );
      if (!historyList) {
        throw new Error("History list not found");
      }
      expect(within(historyList).getByText("tool call")).toBeTruthy();
      expect(within(historyList).queryByText("createMessage")).toBeNull();
      expect(within(historyList).getByText("caller source: runtime_metadata")).toBeTruthy();
      expect(within(historyList).getByText("caller provider: openai")).toBeTruthy();
    });

    fireEvent.change(within(historySection).getByLabelText("History caller source filter"), {
      target: { value: "unavailable" },
    });
    fireEvent.change(within(historySection).getByLabelText("History caller provider filter"), {
      target: { value: "n/a" },
    });

    await waitFor(() => {
      const historyList = historySection.querySelector<HTMLElement>(
        ".workspace-home-webmcp-console-history-list"
      );
      if (!historyList) {
        throw new Error("History list not found");
      }
      expect(within(historyList).getByText("createMessage")).toBeTruthy();
      expect(within(historyList).queryByText("tool call")).toBeNull();
      expect(within(historyList).getByText("model unavailable")).toBeTruthy();
    });
  });

  it("hides advanced cards in basic mode and requests mode switch", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog({ resources: [], prompts: [] }));
    const onSetMode = vi.fn();

    renderSection({
      mode: "basic",
      onSetMode,
    });

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole("button", { name: "Run createMessage" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Run elicitInput" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    expect(onSetMode).toHaveBeenCalledWith("advanced");
  });

  it("disables mode switch while a call is running", async () => {
    vi.mocked(listWebMcpCatalog).mockResolvedValue(createCatalog({ resources: [], prompts: [] }));
    let resolveCall: (value: unknown) => void = () => undefined;
    vi.mocked(callWebMcpTool).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCall = resolve;
        })
    );

    renderSection({
      mode: "advanced",
    });

    await waitFor(() => {
      expect(listWebMcpCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Basic" }).hasAttribute("disabled")).toBe(true);
      expect(screen.getByRole("button", { name: "Advanced" }).hasAttribute("disabled")).toBe(true);
    });

    resolveCall({ ok: true, id: "result-running" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Basic" }).hasAttribute("disabled")).toBe(false);
      expect(screen.getByRole("button", { name: "Advanced" }).hasAttribute("disabled")).toBe(false);
    });
  }, 10_000);
});
