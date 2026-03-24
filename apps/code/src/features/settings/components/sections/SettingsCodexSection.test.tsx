// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AppSettings, ModelOption, WorkspaceInfo } from "../../../../types";

vi.mock("../../../shared/components/FileEditorCard", () => ({
  FileEditorCard: ({ title }: { title: string }) => (
    <div data-testid="file-editor-card">{title}</div>
  ),
}));

vi.mock("./SettingsCodexAccountsCard", () => ({
  SettingsCodexAccountsCard: () => <div data-testid="codex-accounts-card">Codex accounts card</div>,
}));

import { SettingsCodexSection } from "./SettingsCodexSection";

function createModelOption(overrides: Partial<ModelOption> = {}): ModelOption {
  return {
    id: "gpt-5.1",
    model: "gpt-5.1",
    displayName: "GPT-5.1",
    description: "",
    supportedReasoningEfforts: [
      { reasoningEffort: "low", description: "" },
      { reasoningEffort: "medium", description: "" },
      { reasoningEffort: "high", description: "" },
    ],
    defaultReasoningEffort: "medium",
    isDefault: false,
    ...overrides,
  };
}

function createWorkspace(overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo {
  return {
    id: "w1",
    name: "Workspace One",
    path: "/tmp/workspace-one",
    connected: true,
    codex_bin: null,
    kind: "main",
    parentId: null,
    worktree: null,
    settings: {
      sidebarCollapsed: false,
      sortOrder: null,
      groupId: null,
      gitRoot: null,
      codexHome: null,
      codexArgs: null,
      launchScript: null,
      launchScripts: null,
      worktreeSetupScript: null,
    },
    ...overrides,
  };
}

function createProps(
  overrides: Partial<ComponentProps<typeof SettingsCodexSection>> = {}
): ComponentProps<typeof SettingsCodexSection> {
  return {
    appSettings: {
      lastComposerModelId: "gpt-5.1",
      lastComposerReasoningEffort: "high",
      defaultAccessMode: "full-access",
      reviewDeliveryMode: "inline",
    } as AppSettings,
    onUpdateAppSettings: vi.fn(async () => undefined),
    defaultModels: [createModelOption()],
    defaultModelsLoading: false,
    defaultModelsError: null,
    defaultModelsConnectedWorkspaceCount: 1,
    onRefreshDefaultModels: vi.fn(),
    codexPathDraft: "codex",
    codexArgsDraft: "--profile personal",
    codexDirty: true,
    isSavingSettings: false,
    doctorState: { status: "idle", result: null },
    codexUpdateState: { status: "idle", result: null },
    globalAgentsMeta: "Updated just now",
    globalAgentsError: null,
    globalAgentsContent: "Be precise.",
    globalAgentsLoading: false,
    globalAgentsRefreshDisabled: false,
    globalAgentsSaveDisabled: false,
    globalAgentsSaveLabel: "Save",
    globalConfigMeta: "Updated just now",
    globalConfigError: null,
    globalConfigContent: 'model = "gpt-5.1"',
    globalConfigLoading: false,
    globalConfigRefreshDisabled: false,
    globalConfigSaveDisabled: false,
    globalConfigSaveLabel: "Save",
    projects: [createWorkspace()],
    codexBinOverrideDrafts: { w1: "" },
    codexHomeOverrideDrafts: { w1: "" },
    codexArgsOverrideDrafts: { w1: "" },
    onSetCodexPathDraft: vi.fn(),
    onSetCodexArgsDraft: vi.fn(),
    onSetGlobalAgentsContent: vi.fn(),
    onSetGlobalConfigContent: vi.fn(),
    onSetCodexBinOverrideDrafts: vi.fn(),
    onSetCodexHomeOverrideDrafts: vi.fn(),
    onSetCodexArgsOverrideDrafts: vi.fn(),
    onBrowseCodex: vi.fn(async () => undefined),
    onSaveCodexSettings: vi.fn(async () => undefined),
    onRunDoctor: vi.fn(async () => undefined),
    onRunCodexUpdate: vi.fn(async () => undefined),
    onRefreshGlobalAgents: vi.fn(),
    onSaveGlobalAgents: vi.fn(),
    onRefreshGlobalConfig: vi.fn(),
    onSaveGlobalConfig: vi.fn(),
    onUpdateWorkspaceCodexBin: vi.fn(async () => undefined),
    onUpdateWorkspaceSettings: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("SettingsCodexSection", () => {
  it("renders through the shared settings grammar and keeps codex actions working", () => {
    const onSaveCodexSettings = vi.fn(async () => undefined);
    const onRunDoctor = vi.fn(async () => undefined);
    const onRunCodexUpdate = vi.fn(async () => undefined);
    const onUpdateAppSettings = vi.fn(async () => undefined);

    const { container } = render(
      <SettingsCodexSection
        {...createProps({
          onSaveCodexSettings,
          onRunDoctor,
          onRunCodexUpdate,
          onUpdateAppSettings,
        })}
      />
    );

    expect(container.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
    expect(
      screen.getByText("CLI defaults", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();
    expect(
      screen.getByText("Accounts", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();
    expect(
      screen.getByText("Default parameters", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();
    expect(
      screen.getByText("Global agent files", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();
    expect(
      screen.getByText("Workspace overrides", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();

    const modelRow = screen
      .getByText("Model")
      .closest('[data-settings-field-row="toggle"]') as HTMLElement | null;
    const providerRow = screen
      .queryByText("Provider")
      ?.closest('[data-settings-field-row="toggle"]') as HTMLElement | null;
    const effortRow = screen
      .getByText("Reasoning effort")
      .closest('[data-settings-field-row="toggle"]') as HTMLElement | null;
    const accessRow = screen
      .getByText("Access mode")
      .closest('[data-settings-field-row="toggle"]') as HTMLElement | null;

    expect(providerRow).toBeUndefined();
    expect(modelRow).not.toBeNull();
    expect(effortRow).not.toBeNull();
    expect(accessRow).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Run doctor" }));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    fireEvent.click(screen.getByRole("button", { name: "Model" }));
    fireEvent.click(screen.getByRole("option", { name: "GPT-5.1" }));
    fireEvent.click(screen.getByRole("button", { name: "Access mode" }));
    fireEvent.click(screen.getByRole("option", { name: "Read only" }));

    expect(onSaveCodexSettings).toHaveBeenCalled();
    expect(onRunDoctor).toHaveBeenCalled();
    expect(onRunCodexUpdate).toHaveBeenCalled();
    expect(onUpdateAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({ lastComposerModelId: "gpt-5.1" })
    );
    expect(onUpdateAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({ defaultAccessMode: "read-only" })
    );
  });

  it("preserves route-specific model ids when duplicate model slugs are available", () => {
    const onUpdateAppSettings = vi.fn(async () => undefined);

    render(
      <SettingsCodexSection
        {...createProps({
          appSettings: {
            lastComposerModelId: "openai-primary",
            lastComposerReasoningEffort: "high",
            defaultAccessMode: "full-access",
            reviewDeliveryMode: "inline",
          } as AppSettings,
          onUpdateAppSettings,
          defaultModels: [
            createModelOption({
              id: "openai-primary",
              model: "gpt-5.1",
              displayName: "GPT-5.1",
              provider: "openai",
              pool: "codex-primary",
            }),
            createModelOption({
              id: "openai-secondary",
              model: "gpt-5.1",
              displayName: "GPT-5.1",
              provider: "openai",
              pool: "codex-secondary",
            }),
          ],
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Model" }));
    fireEvent.click(screen.getByRole("option", { name: "GPT-5.1 / codex-primary" }));

    expect(screen.getByRole("button", { name: "Model" }).textContent).toContain("GPT-5.1");
    expect(onUpdateAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({ lastComposerModelId: "openai-primary" })
    );
  });

  it("switching provider picks that provider family's recommended default model route", () => {
    const onUpdateAppSettings = vi.fn(async () => undefined);

    render(
      <SettingsCodexSection
        {...createProps({
          appSettings: {
            lastComposerModelId: "openai-primary",
            lastComposerReasoningEffort: "high",
            defaultAccessMode: "full-access",
            reviewDeliveryMode: "inline",
          } as AppSettings,
          onUpdateAppSettings,
          defaultModels: [
            createModelOption({
              id: "openai-primary",
              model: "gpt-5.1",
              displayName: "GPT-5.1",
              provider: "openai",
              pool: "codex-primary",
            }),
            createModelOption({
              id: "claude-opus",
              model: "claude-opus-4-5",
              displayName: "Claude Opus 4.5",
              provider: "claude_code_local",
              pool: "claude",
            }),
          ],
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Provider" }));
    fireEvent.click(screen.getByRole("option", { name: "Claude" }));

    expect(onUpdateAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({ lastComposerModelId: "claude-opus" })
    );
  });

  it("keeps the accounts card and file editors embedded as child surfaces", () => {
    const { container } = render(<SettingsCodexSection {...createProps()} />);

    expect(within(container).getByTestId("codex-accounts-card")).toBeTruthy();
    expect(within(container).getAllByTestId("file-editor-card")).toHaveLength(2);
    expect(within(container).getByText("Global AGENTS.md")).toBeTruthy();
    expect(within(container).getByText("Global config.toml")).toBeTruthy();
  });

  it("groups Claude routes under one provider and persists the resolved Claude Code model id", () => {
    const onUpdateAppSettings = vi.fn(async () => undefined);

    render(
      <SettingsCodexSection
        {...createProps({
          appSettings: {
            ...createProps().appSettings,
            lastComposerModelId: "openai::gpt-5.1",
          },
          onUpdateAppSettings,
          defaultModels: [
            createModelOption({
              id: "openai::gpt-5.1",
              model: "gpt-5.1",
              displayName: "GPT-5.1",
              provider: "openai",
              pool: "codex",
            }),
            createModelOption({
              id: "anthropic::claude-sonnet-4-5",
              model: "claude-sonnet-4-5",
              displayName: "Claude Sonnet 4.5",
              provider: "anthropic",
              pool: "claude",
            }),
            createModelOption({
              id: "claude_code_local::claude-sonnet-4-5",
              model: "claude-sonnet-4-5",
              displayName: "Claude Sonnet 4.5",
              provider: "claude_code_local",
              pool: "claude_code_local",
            }),
          ],
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Provider" }));
    expect(screen.getAllByRole("option", { name: "Claude" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("option", { name: "Claude" }));

    expect(onUpdateAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        lastComposerModelId: "claude_code_local::claude-sonnet-4-5",
      })
    );
  });

  it("does not render legacy section shell, toggle, or action wrappers directly", () => {
    const { container } = render(<SettingsCodexSection {...createProps()} />);

    expect(container.querySelector(".settings-section")).toBeNull();
    expect(container.querySelector(".settings-section-title")).toBeNull();
    expect(container.querySelector(".settings-section-subtitle")).toBeNull();
    expect(container.querySelector(".settings-toggle-row")).toBeNull();
    expect(container.querySelector(".settings-field-actions")).toBeNull();
  });

  it("preserves workspace override save and clear semantics", async () => {
    const onUpdateWorkspaceCodexBin = vi.fn(async () => undefined);
    const onUpdateWorkspaceSettings = vi.fn(async () => undefined);
    const onSetCodexBinOverrideDrafts = vi.fn();
    const onSetCodexHomeOverrideDrafts = vi.fn();
    const onSetCodexArgsOverrideDrafts = vi.fn();

    const { container } = render(
      <SettingsCodexSection
        {...createProps({
          onUpdateWorkspaceCodexBin,
          onUpdateWorkspaceSettings,
          onSetCodexBinOverrideDrafts,
          onSetCodexHomeOverrideDrafts,
          onSetCodexArgsOverrideDrafts,
          codexBinOverrideDrafts: { w1: "codex-nightly" },
          codexHomeOverrideDrafts: { w1: "/tmp/.codex" },
          codexArgsOverrideDrafts: { w1: "--profile team" },
        })}
      />
    );

    const workspaceOverridesTitle = within(container).getByText("Workspace overrides", {
      selector: '[data-settings-field-group-title="true"]',
    });
    const workspaceOverridesGroup = workspaceOverridesTitle.closest(
      '[data-settings-field-group="true"]'
    ) as HTMLElement | null;
    if (!workspaceOverridesGroup) {
      throw new Error("Expected workspace overrides group");
    }

    fireEvent.blur(
      within(workspaceOverridesGroup).getByLabelText("Codex binary override for Workspace One")
    );
    fireEvent.click(within(workspaceOverridesGroup).getAllByRole("button", { name: "Clear" })[0]);
    fireEvent.blur(
      within(workspaceOverridesGroup).getByLabelText("CODEX_HOME override for Workspace One")
    );
    fireEvent.click(within(workspaceOverridesGroup).getAllByRole("button", { name: "Clear" })[1]);
    fireEvent.blur(
      within(workspaceOverridesGroup).getByLabelText("Codex args override for Workspace One")
    );
    fireEvent.click(within(workspaceOverridesGroup).getAllByRole("button", { name: "Clear" })[2]);

    expect(onUpdateWorkspaceCodexBin).toHaveBeenCalledWith("w1", "codex-nightly");
    expect(onUpdateWorkspaceCodexBin).toHaveBeenCalledWith("w1", null);
    expect(onUpdateWorkspaceSettings).toHaveBeenCalledWith("w1", {
      codexHome: "/tmp/.codex",
    });
    expect(onUpdateWorkspaceSettings).toHaveBeenCalledWith("w1", {
      codexHome: null,
    });
    expect(onUpdateWorkspaceSettings).toHaveBeenCalledWith("w1", {
      codexArgs: "--profile team",
    });
    expect(onUpdateWorkspaceSettings).toHaveBeenCalledWith("w1", {
      codexArgs: null,
    });
    expect(onSetCodexBinOverrideDrafts).toHaveBeenCalled();
    expect(onSetCodexHomeOverrideDrafts).toHaveBeenCalled();
    expect(onSetCodexArgsOverrideDrafts).toHaveBeenCalled();
  });
});
