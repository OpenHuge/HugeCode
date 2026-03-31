// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION } from "@ku0/code-platform-interfaces";
import { useSharedAppSettingsState } from "@ku0/code-workspace-client/settings-state";
import { runCodexDoctor } from "../../../application/runtime/ports/codexOperations";
import { useAppSettings } from "./useAppSettings";

vi.mock("@ku0/code-workspace-client/settings-state", () => ({
  useSharedAppSettingsState: vi.fn(() => ({
    settings: { theme: "system" },
    setSettings: vi.fn(),
    saveSettings: vi.fn(),
    isLoading: false,
  })),
}));

vi.mock("../../../application/runtime/ports/codexOperations", () => ({
  runCodexDoctor: vi.fn(),
}));

const useSharedAppSettingsStateMock = vi.mocked(useSharedAppSettingsState);
const runCodexDoctorMock = vi.mocked(runCodexDoctor);

describe("useAppSettings", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads settings through the shared settings state", () => {
    renderHook(() => useAppSettings());

    expect(useSharedAppSettingsStateMock).toHaveBeenCalledTimes(1);
    expect(useSharedAppSettingsStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        buildDefaultSettings: expect.any(Function),
        normalizeSettings: expect.any(Function),
      })
    );
  });

  it("delegates doctor checks to the codex port", async () => {
    runCodexDoctorMock.mockResolvedValue({ ok: true } as never);
    const { result } = renderHook(() => useAppSettings());

    await result.current.doctor("/bin/codex", "--profile dev");

    expect(runCodexDoctorMock).toHaveBeenCalledWith("/bin/codex", "--profile dev");
  });

  it("normalizes malformed host-backed active intent context entries out of app settings", () => {
    renderHook(() => useAppSettings());

    const normalizeSettings = useSharedAppSettingsStateMock.mock.calls[0]?.[0]?.normalizeSettings;

    expect(
      normalizeSettings?.({
        activeIntentContextByWorkspaceId: {
          "workspace-1": {
            schemaVersion: ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION,
            intent: {
              objective: "Recover persistent flow",
              constraints: "",
              successCriteria: "",
              deadline: null,
              priority: "medium",
              managerNotes: "",
            },
            focusedFiles: [{ path: "apps/code/src/types.ts", reason: "recent_change" }],
            unresolvedErrors: [],
            history: {
              latestRunId: null,
              latestRunTitle: null,
              latestReviewPackId: null,
              lastUpdatedAt: null,
              recentChangedPaths: [],
              validationSummaries: [],
            },
          },
          "workspace-2": {
            schemaVersion: "active-intent-context/v0",
          },
        },
      })
    ).toEqual(
      expect.objectContaining({
        activeIntentContextByWorkspaceId: {
          "workspace-1": {
            schemaVersion: ACTIVE_INTENT_CONTEXT_SCHEMA_VERSION,
            intent: {
              objective: "Recover persistent flow",
              constraints: "",
              successCriteria: "",
              deadline: null,
              priority: "medium",
              managerNotes: "",
            },
            focusedFiles: [{ path: "apps/code/src/types.ts", reason: "recent_change" }],
            unresolvedErrors: [],
            history: {
              latestRunId: null,
              latestRunTitle: null,
              latestReviewPackId: null,
              lastUpdatedAt: null,
              recentChangedPaths: [],
              validationSummaries: [],
            },
          },
        },
      })
    );
  });
});
