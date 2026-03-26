// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  baseSettings,
  chooseSelectOption,
  createDoctorResult,
  createUpdateResult,
  getModelListMock,
  renderSettled,
  SharedSettingsView,
  withDefaultRemoteProfile,
  workspace,
} from "./SettingsView.test.shared";
import { SettingsView } from "./SettingsView";

describe("SettingsView Codex overrides", () => {
  it("polls Orbit sign-in using deviceCode until authorized", async () => {
    cleanup();
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    const startSpy = vi.fn().mockResolvedValueOnce({
      deviceCode: "device-code-123",
      userCode: "ABCD-1234",
      verificationUri: "https://orbit.example/verify",
      verificationUriComplete: null,
      intervalSeconds: 1,
      expiresInSeconds: 30,
    });
    const pollSpy = vi
      .fn()
      .mockResolvedValueOnce({
        status: "pending",
        token: null,
        message: "Waiting for authorization.",
        intervalSeconds: 1,
      })
      .mockResolvedValueOnce({
        status: "authorized",
        token: "orbit-token-1",
        message: "Orbit sign in complete.",
        intervalSeconds: null,
      });
    const orbitServiceClient: NonNullable<
      ComponentProps<typeof SettingsView>["orbitServiceClient"]
    > = {
      orbitConnectTest: vi.fn().mockResolvedValue({
        ok: true,
        latencyMs: 12,
        message: "Connected to Orbit relay.",
      }),
      orbitSignInStart: startSpy,
      orbitSignInPoll: pollSpy,
      orbitSignOut: vi.fn().mockResolvedValue({ success: true, message: null }),
      orbitRunnerStart: vi.fn().mockResolvedValue({
        state: "running",
        pid: 123,
        startedAtMs: Date.now(),
        lastError: null,
        orbitUrl: "wss://orbit.example/ws",
      }),
      orbitRunnerStop: vi.fn().mockResolvedValue({
        state: "stopped",
        pid: null,
        startedAtMs: null,
        lastError: null,
        orbitUrl: "wss://orbit.example/ws",
      }),
      orbitRunnerStatus: vi.fn().mockResolvedValue({
        state: "stopped",
        pid: null,
        startedAtMs: null,
        lastError: null,
        orbitUrl: "wss://orbit.example/ws",
      }),
    };
    const rendered = await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={withDefaultRemoteProfile(
          {
            ...baseSettings,
            backendMode: "remote",
          },
          {
            provider: "orbit",
            host: null,
            orbitWsUrl: "wss://orbit.example/ws",
          }
        )}
        openAppIconById={{}}
        onUpdateAppSettings={onUpdateAppSettings}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
        initialSection="server"
        orbitServiceClient={orbitServiceClient}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    });
    await waitFor(
      () => {
        expect(pollSpy).toHaveBeenCalledTimes(1);
      },
      { timeout: 2500 }
    );

    rendered.rerender(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={withDefaultRemoteProfile(
          {
            ...baseSettings,
            backendMode: "remote",
            theme: "dark",
          },
          {
            provider: "orbit",
            host: null,
            orbitWsUrl: "wss://orbit.example/ws",
          }
        )}
        openAppIconById={{}}
        onUpdateAppSettings={onUpdateAppSettings}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
        initialSection="server"
        orbitServiceClient={orbitServiceClient}
      />
    );

    await waitFor(
      () => {
        expect(startSpy).toHaveBeenCalledTimes(1);
        expect(pollSpy).toHaveBeenCalledTimes(2);
        expect(pollSpy).toHaveBeenCalledWith("device-code-123");
        expect(onUpdateAppSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            theme: "dark",
            remoteBackendProfiles: expect.arrayContaining([
              expect.objectContaining({
                provider: "orbit",
                token: "orbit-token-1",
              }),
            ]),
          })
        );
        expect(screen.getByText(/Auth code:/).textContent ?? "").toContain("ABCD-1234");
        expect(screen.getByText("Orbit sign in complete.")).toBeTruthy();
      },
      { timeout: 3500 }
    );
  }, 20_000);

  it("syncs token state after Orbit sign-out", async () => {
    cleanup();
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    const orbitServiceClient: NonNullable<
      ComponentProps<typeof SettingsView>["orbitServiceClient"]
    > = {
      orbitConnectTest: vi.fn().mockResolvedValue({
        ok: true,
        latencyMs: 12,
        message: "Connected to Orbit relay.",
      }),
      orbitSignInStart: vi.fn(),
      orbitSignInPoll: vi.fn(),
      orbitSignOut: vi.fn().mockResolvedValue({ success: true, message: null }),
      orbitRunnerStart: vi.fn().mockResolvedValue({
        state: "running",
        pid: 123,
        startedAtMs: Date.now(),
        lastError: null,
        orbitUrl: "wss://orbit.example/ws",
      }),
      orbitRunnerStop: vi.fn().mockResolvedValue({
        state: "stopped",
        pid: null,
        startedAtMs: null,
        lastError: null,
        orbitUrl: "wss://orbit.example/ws",
      }),
      orbitRunnerStatus: vi.fn().mockResolvedValue({
        state: "stopped",
        pid: null,
        startedAtMs: null,
        lastError: null,
        orbitUrl: "wss://orbit.example/ws",
      }),
    };

    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={withDefaultRemoteProfile(
          {
            ...baseSettings,
            backendMode: "remote",
          },
          {
            provider: "orbit",
            host: null,
            orbitWsUrl: "wss://orbit.example/ws",
            token: "token-to-clear",
          }
        )}
        openAppIconById={{}}
        onUpdateAppSettings={onUpdateAppSettings}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
        initialSection="server"
        orbitServiceClient={orbitServiceClient}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          remoteBackendProfiles: expect.arrayContaining([
            expect.objectContaining({
              provider: "orbit",
              token: null,
            }),
          ]),
        })
      );
    });
  }, 15_000);

  it("retries Orbit token persistence after a failed save", async () => {
    cleanup();
    const onUpdateAppSettings = vi
      .fn()
      .mockRejectedValueOnce(new Error("settings write failed"))
      .mockResolvedValue(undefined);
    const orbitServiceClient: NonNullable<
      ComponentProps<typeof SettingsView>["orbitServiceClient"]
    > = {
      orbitConnectTest: vi.fn().mockResolvedValue({
        ok: true,
        latencyMs: 12,
        message: "Connected to Orbit relay.",
      }),
      orbitSignInStart: vi.fn(),
      orbitSignInPoll: vi.fn(),
      orbitSignOut: vi.fn().mockResolvedValue({ success: true, message: null }),
      orbitRunnerStart: vi.fn().mockResolvedValue({
        state: "running",
        pid: 123,
        startedAtMs: Date.now(),
        lastError: null,
        orbitUrl: "wss://orbit.example/ws",
      }),
      orbitRunnerStop: vi.fn().mockResolvedValue({
        state: "stopped",
        pid: null,
        startedAtMs: null,
        lastError: null,
        orbitUrl: "wss://orbit.example/ws",
      }),
      orbitRunnerStatus: vi.fn().mockResolvedValue({
        state: "stopped",
        pid: null,
        startedAtMs: null,
        lastError: null,
        orbitUrl: "wss://orbit.example/ws",
      }),
    };

    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={withDefaultRemoteProfile(
          {
            ...baseSettings,
            backendMode: "remote",
          },
          {
            provider: "orbit",
            host: null,
            orbitWsUrl: "wss://orbit.example/ws",
            token: "token-to-clear",
          }
        )}
        openAppIconById={{}}
        onUpdateAppSettings={onUpdateAppSettings}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
        initialSection="server"
        orbitServiceClient={orbitServiceClient}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Sign Out failed: settings write failed")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledTimes(2);
      expect(onUpdateAppSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          remoteBackendProfiles: expect.arrayContaining([
            expect.objectContaining({
              provider: "orbit",
              token: null,
            }),
          ]),
        })
      );
    });
  }, 20_000);
});

describe("SettingsView Codex defaults", () => {
  const createModelListResponse = (models: Array<Record<string, unknown>>) => ({
    result: { data: models },
  });

  it("uses the latest model and high effort by default (no Default option)", async () => {
    cleanup();
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    getModelListMock.mockResolvedValue(
      createModelListResponse([
        {
          id: "gpt-4.1",
          model: "gpt-4.1",
          displayName: "GPT-4.1",
          description: "",
          supportedReasoningEfforts: [
            { reasoningEffort: "low", description: "" },
            { reasoningEffort: "medium", description: "" },
            { reasoningEffort: "high", description: "" },
          ],
          defaultReasoningEffort: "medium",
          isDefault: false,
        },
        {
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
        },
      ])
    );

    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Ungrouped",
            workspaces: [workspace({ id: "w1", name: "Workspace", connected: true })],
          },
        ]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={onUpdateAppSettings}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onRunCodexUpdate={vi.fn().mockResolvedValue(createUpdateResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
        initialSection="codex"
      />
    );

    expect(document.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
    expect(
      screen.getByText("Default parameters", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();

    const modelSelect = screen.getByRole("button", { name: "Model" });
    const effortSelect = screen.getByRole("button", { name: "Reasoning effort" });

    await waitFor(() => {
      expect(getModelListMock).toHaveBeenCalledWith("w1");
      expect(modelSelect.textContent ?? "").toContain("GPT-5.1");
    });

    fireEvent.click(modelSelect);
    expect(screen.queryByRole("option", { name: /default/i })).toBeNull();
    fireEvent.click(modelSelect);

    fireEvent.click(effortSelect);
    expect(screen.queryByRole("option", { name: /default/i })).toBeNull();
    fireEvent.click(effortSelect);
    expect(effortSelect.textContent ?? "").toContain("high");

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          lastComposerModelId: "gpt-5.1",
          lastComposerReasoningEffort: "high",
        })
      );
    });
  });

  it("updates model and effort when the user changes the selects", async () => {
    cleanup();
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    getModelListMock.mockResolvedValue(
      createModelListResponse([
        {
          id: "gpt-4.1",
          model: "gpt-4.1",
          displayName: "GPT-4.1",
          description: "",
          supportedReasoningEfforts: [
            { reasoningEffort: "low", description: "" },
            { reasoningEffort: "medium", description: "" },
            { reasoningEffort: "high", description: "" },
          ],
          defaultReasoningEffort: "medium",
          isDefault: false,
        },
        {
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
        },
      ])
    );

    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Ungrouped",
            workspaces: [workspace({ id: "w1", name: "Workspace", connected: true })],
          },
        ]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={onUpdateAppSettings}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onRunCodexUpdate={vi.fn().mockResolvedValue(createUpdateResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
        initialSection="codex"
      />
    );

    const modelSelect = screen.getByRole("button", { name: "Model" }) as HTMLButtonElement;
    const effortSelect = screen.getByRole("button", {
      name: "Reasoning effort",
    }) as HTMLButtonElement;

    await waitFor(() => {
      expect(modelSelect.disabled).toBe(false);
      expect(modelSelect.textContent ?? "").toContain("GPT-5.1");
      expect(effortSelect.textContent ?? "").toContain("high");
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ lastComposerModelId: "gpt-5.1" })
      );
    });

    onUpdateAppSettings.mockClear();
    await act(async () => {
      fireEvent.click(modelSelect);
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole("menuitemradio", { name: "GPT-4.1" }));
    });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ lastComposerModelId: "gpt-4.1" })
      );
    });

    onUpdateAppSettings.mockClear();
    await chooseSelectOption(screen, "Reasoning effort", "medium");

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ lastComposerReasoningEffort: "medium" })
      );
    });
  }, 20_000);

  it("keeps settings stable when codex default normalization save fails", async () => {
    cleanup();
    const onUpdateAppSettings = vi.fn().mockRejectedValue(new Error("settings write failed"));
    getModelListMock.mockResolvedValue(
      createModelListResponse([
        {
          id: "gpt-4.1",
          model: "gpt-4.1",
          displayName: "GPT-4.1",
          description: "",
          supportedReasoningEfforts: [
            { reasoningEffort: "low", description: "" },
            { reasoningEffort: "medium", description: "" },
            { reasoningEffort: "high", description: "" },
          ],
          defaultReasoningEffort: "medium",
          isDefault: false,
        },
        {
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
        },
      ])
    );

    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Ungrouped",
            workspaces: [workspace({ id: "w1", name: "Workspace", connected: true })],
          },
        ]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={onUpdateAppSettings}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onRunCodexUpdate={vi.fn().mockResolvedValue(createUpdateResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
        initialSection="codex"
      />
    );

    const modelSelect = screen.getByRole("button", { name: "Model" });
    const effortSelect = screen.getByRole("button", { name: "Reasoning effort" });

    await waitFor(() => {
      expect(modelSelect.textContent ?? "").toContain("GPT-5.1");
      expect(effortSelect.textContent ?? "").toContain("high");
    });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          lastComposerModelId: "gpt-5.1",
          lastComposerReasoningEffort: "high",
        })
      );
    });
  });
});
