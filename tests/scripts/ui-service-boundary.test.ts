import { describe, expect, it } from "vitest";
import {
  collectUiBoundaryViolationsForSource,
  isCandidateFile,
  isUiTestFile,
  shouldRunUiServiceBoundaryGuard,
} from "../../scripts/lib/ui-service-boundary.mjs";

describe("ui service boundary guard", () => {
  it("treats guarded UI files and additional app product files as candidates", () => {
    expect(isCandidateFile("apps/code/src/features/settings/hooks/useThing.ts")).toBe(true);
    expect(isCandidateFile("apps/code/src/design-system/components/Foo.tsx")).toBe(true);
    expect(isCandidateFile("apps/code/src/hooks/useThing.ts")).toBe(true);
    expect(isCandidateFile("apps/code/src/web/WorkspaceClientEntry.tsx")).toBe(true);
    expect(isCandidateFile("apps/code/src/web/WorkspaceAppBridge.tsx")).toBe(true);
    expect(isCandidateFile("apps/code/src/utils/thing.ts")).toBe(true);
    expect(isCandidateFile("apps/code/src/application/runtime/runtimeClient.ts")).toBe(true);
  });

  it("treats shared test variants as tests so production-only legacy rules do not fire", () => {
    expect(isUiTestFile("apps/code/src/features/foo/Foo.test.tsx")).toBe(true);
    expect(isUiTestFile("apps/code/src/features/foo/Foo.test.shared.tsx")).toBe(true);
    expect(isUiTestFile("apps/code/src/features/foo/Foo.tsx")).toBe(false);
  });

  it("rejects deprecated runtime bridge imports in production UI files", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/example/hooks/useExample.ts",
      'import { getSkillsList } from "../../../application/runtime/ports/skills";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-legacy-bridge",
      }),
    ]);
  });

  it("rejects direct thread session command imports in thread and composer features", () => {
    const threadViolations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/threads/hooks/useThreadMessaging.ts",
      'import { sendUserMessage } from "../../../application/runtime/ports/threads";\n'
    );
    const composerViolations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/composer/hooks/useComposerActions.ts",
      'import { interruptTurn } from "../../../application/runtime/ports/threads";\n'
    );

    expect(threadViolations).toEqual([
      expect.objectContaining({
        rule: "runtime-thread-session-command-port",
      }),
    ]);
    expect(composerViolations).toEqual([
      expect.objectContaining({
        rule: "runtime-thread-session-command-port",
      }),
    ]);
  });

  it("rejects direct runtime session command port imports in thread and composer features", () => {
    const threadViolations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/threads/hooks/useThreadMessaging.ts",
      'import { useRuntimeSessionCommandsResolver } from "../../../application/runtime/ports/runtimeSessionCommands";\n'
    );
    const composerViolations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/composer/hooks/useComposerActions.ts",
      'import { useWorkspaceRuntimeSessionCommands } from "../../../application/runtime/ports/runtimeSessionCommands";\n'
    );

    expect(threadViolations).toEqual([
      expect.objectContaining({
        rule: "runtime-thread-session-command-facade-only",
      }),
    ]);
    expect(composerViolations).toEqual([
      expect.objectContaining({
        rule: "runtime-thread-session-command-facade-only",
      }),
    ]);
  });

  it("allows runtime session command facade hooks in thread features", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/threads/hooks/useThreadMessaging.ts",
      'import { useRuntimeSessionCommandsResolver } from "../../../application/runtime/facades/runtimeSessionCommandFacadeHooks";\n'
    );

    expect(violations).toEqual([]);
  });

  it("rejects direct chatgpt automation implementation imports in product code", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.tsx",
      'import { reviewDeactivatedChatgptWorkspaces } from "../../../../application/runtime/facades/chatgptWorkspaceAutomation";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-chatgpt-automation-facade-only",
      }),
    ]);
  });

  it("rejects direct runtime capability registry imports in UI code", () => {
    const capabilityHookViolations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/example/hooks/useExample.ts",
      'import { useWorkspaceRuntimeCapability } from "../../../application/runtime/hooks/useWorkspaceRuntimeCapability";\n'
    );
    const capabilityKeyViolations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/example/hooks/useExample.ts",
      'import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../../../application/runtime/kernel/runtimeKernelCapabilities";\n'
    );

    expect(capabilityHookViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "runtime-capability-registry-internal",
        }),
      ])
    );
    expect(capabilityKeyViolations).toEqual([
      expect.objectContaining({
        rule: "runtime-capability-registry-internal",
      }),
    ]);
  });

  it("rejects direct provider-routing compatibility imports in UI code", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/example/hooks/useExample.ts",
      'import { resolveRuntimeModelProviderRoute } from "../../../application/runtime/facades/runtimeProviderRouting";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-provider-routing-compat",
      }),
    ]);
  });

  it("allows the approved chatgpt automation facade in product code", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.tsx",
      'import { reviewDeactivatedChatgptWorkspaces } from "../../../../application/runtime/facades/chatgptWorkspaceAutomationFacade";\n'
    );

    expect(violations).toEqual([]);
  });
  it("rejects direct desktop-host package imports in shared workspace client files", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "packages/code-workspace-client/src/workspace/WorkspaceClientApp.tsx",
      'import { invoke } from "@desktop-host/core";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "desktop-host-package-import",
      }),
    ]);
  });

  it("rejects direct desktop-host package imports in the web workspace shell", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code-web/app/components/WorkspaceClientApp.tsx",
      'import { invoke } from "@desktop-host/core";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "desktop-host-package-import",
      }),
    ]);
  });

  it("rejects direct desktop host adapter port imports in product code", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/about/components/AboutView.tsx",
      'import { resolveAppVersion } from "../../../application/runtime/ports/desktopHostEnvironment";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "desktop-host-facade-only",
      }),
    ]);
  });

  it("rejects direct desktop host global access in UI code", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/example/hooks/useExample.ts",
      "export const host = window.hugeCodeDesktopHost;\n"
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "desktop-host-global-access",
      }),
    ]);
  });

  it("rejects direct electron imports in product code", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/utils/runtimeExample.ts",
      'import { ipcRenderer } from "electron";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "electron-import",
      }),
    ]);
  });

  it("rejects direct retired skill bridge imports in production UI files", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/skills/hooks/useSkills.ts",
      'import { getSkillsList } from "../../../application/runtime/ports/skills";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-legacy-bridge",
      }),
    ]);
  });

  it("rejects direct account/settings legacy runtime bridge imports in production UI files", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/settings/hooks/useAppSettings.ts",
      'import { getAppSettings } from "../../../application/runtime/ports/desktopAppSettings";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-settings-account-legacy-bridge",
      }),
    ]);
  });

  it("rejects deprecated runtime bridge imports in non-UI product files", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/utils/runtimeExample.ts",
      'import { getSkillsList } from "../application/runtime/ports/skills";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-legacy-bridge-app",
      }),
    ]);
  });

  it("rejects createServerFn inside web workspace app routes", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code-web/app/routes/app/index.tsx",
      'const loader = createServerFn({ method: "GET" });\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "web-app-server-function",
      }),
    ]);
  });

  it("rejects deprecated runtime bridge imports in the ACP backend form once the migration is complete", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/settings/components/sections/settings-backend-pool/acpBackendForm.ts",
      'import { getSkillsList } from "../../../../../application/runtime/ports/skills";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-legacy-bridge",
      }),
    ]);
  });

  it("allows application runtime facades but still rejects runtime implementation imports", () => {
    const allowed = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/workspaces/components/WorkspaceHomeAgentRuntimeOrchestration.tsx",
      'import { startRuntimeRunWithRemoteSelection } from "../../../application/runtime/facades/runtimeRemoteExecutionFacade";\n'
    );
    expect(allowed).toEqual([]);

    const rejected = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/example/hooks/useExample.ts",
      'import { hiddenThing } from "../../../application/runtime/internal/example";\n'
    );
    expect(rejected).toEqual([
      expect.objectContaining({
        rule: "runtime-implementation",
      }),
    ]);
  });

  it("rejects direct runtime tool lifecycle facade and type-layer imports in UI code", () => {
    const facadeViolations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/example/hooks/useExample.ts",
      'import { getWorkspaceRuntimeToolLifecycleSnapshot } from "../../../application/runtime/facades/runtimeToolLifecycleFacade";\n'
    );
    const presentationViolations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/example/components/Example.tsx",
      'import { describeRuntimeToolLifecycleEvent } from "../../../application/runtime/facades/runtimeToolLifecyclePresentation";\n'
    );
    const typeViolations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/example/components/Example.tsx",
      'import type { RuntimeToolLifecycleEvent } from "../../../application/runtime/types/runtimeToolLifecycle";\n'
    );

    expect(facadeViolations).toEqual([
      expect.objectContaining({
        rule: "runtime-tool-lifecycle-port-only",
      }),
    ]);
    expect(presentationViolations).toEqual([
      expect.objectContaining({
        rule: "runtime-tool-lifecycle-port-only",
      }),
    ]);
    expect(typeViolations).toEqual([
      expect.objectContaining({
        rule: "runtime-tool-lifecycle-port-only",
      }),
    ]);
  });

  it("rejects product imports of runtime tool lifecycle read primitives outside approved hooks", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/workspaces/components/WorkspaceHomeMissionControlSections.tsx",
      'import { getWorkspaceRuntimeToolLifecycleSnapshot } from "../../../application/runtime/ports/runtimeToolLifecycle";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-tool-lifecycle-read-primitives",
      }),
    ]);
  });

  it("allows runtime tool lifecycle read primitives in the shared workspace hook", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/shared/hooks/useWorkspaceRuntimeToolLifecycle.ts",
      [
        "import {",
        "  getWorkspaceRuntimeToolLifecycleSnapshot,",
        "  subscribeWorkspaceRuntimeToolLifecycleSnapshot,",
        '} from "../../../application/runtime/ports/runtimeToolLifecycle";',
      ].join("\n")
    );

    expect(violations).toEqual([]);
  });

  it("rejects product imports of lifecycle projection primitives outside the shared workspace hook", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/workspaces/components/WorkspaceHomeMissionControlSections.tsx",
      [
        "import {",
        "  buildRuntimeToolLifecyclePresentationSummary,",
        "  sortRuntimeToolLifecycleEventsByRecency,",
        '} from "../../../application/runtime/ports/runtimeToolLifecycle";',
      ].join("\n")
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-tool-lifecycle-projection-primitives",
      }),
    ]);
  });

  it("allows lifecycle projection primitives in the shared workspace hook", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/shared/hooks/useWorkspaceRuntimeToolLifecycle.ts",
      [
        "import {",
        "  buildRuntimeToolLifecyclePresentationSummary,",
        "  sortRuntimeToolLifecycleEventsByRecency,",
        "  sortRuntimeToolLifecycleHookCheckpointsByRecency,",
        '} from "../../../application/runtime/ports/runtimeToolLifecycle";',
      ].join("\n")
    );

    expect(violations).toEqual([]);
  });

  it("allows lifecycle projection primitives in test support fixtures", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/debug/test/debugPanelComponentFixtures.ts",
      [
        "import {",
        "  buildRuntimeToolLifecyclePresentationSummary,",
        '} from "../../../application/runtime/ports/runtimeToolLifecycle";',
      ].join("\n")
    );

    expect(violations).toEqual([]);
  });

  it("allows runtime tool lifecycle read primitives in debug diagnostics hooks", () => {
    const probeViolations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/debug/hooks/useDebugRuntimeProbe.ts",
      'import { getWorkspaceRuntimeToolLifecycleSnapshot } from "../../../application/runtime/ports/runtimeToolLifecycle";\n'
    );
    const exportViolations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/debug/hooks/useRuntimeDiagnosticsExport.ts",
      'import { getWorkspaceRuntimeToolLifecycleSnapshot } from "../../../application/runtime/ports/runtimeToolLifecycle";\n'
    );

    expect(probeViolations).toEqual([]);
    expect(exportViolations).toEqual([]);
  });

  it("rejects low-level runtime transport imports in non-UI product files", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/utils/runtimeExample.ts",
      'import { readRuntimeEventStabilityMetrics } from "../services/runtimeEventStabilityMetrics";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-low-level-service-app",
      }),
    ]);
  });

  it("rejects application/runtime files importing low-level runtime services outside compat shims", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/application/runtime/facades/discoverLocalRuntimeGatewayTargets.ts",
      'import { invokeWebRuntimeRawAttempt } from "../../../services/runtimeClientWebHttpTransport";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-architecture-low-level-service",
      }),
    ]);
  });

  it("rejects facade imports of runtimeClient after the kernel-only composition shift", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/application/runtime/facades/runtimeMissionControlFacade.ts",
      'import { getRuntimeClient } from "../ports/runtimeClient";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-kernel-client-port",
      }),
    ]);
  });

  it("rejects desktop workspace bindings that assemble runtime ports directly", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/web/createDesktopWorkspaceClientBindings.tsx",
      'import { getAppSettings } from "../application/runtime/ports/desktopAppSettings";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-kernel-bindings",
      }),
    ]);
  });

  it("rejects product imports of the retired runtimeOperationsFacade", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/settings/hooks/useSettingsServerState.ts",
      'import { useRuntimeOperationsFacade } from "../../../application/runtime/facades/runtimeOperationsFacade";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-operations-facade-retired",
      }),
    ]);
  });

  it("allows explicit application/runtime compatibility shims to import low-level runtime services", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/application/runtime/runtimeClient.ts",
      'export { getRuntimeClient } from "../../services/runtimeClient";\n'
    );

    expect(violations).toEqual([]);
  });

  it("rejects type-only imports from the webMcp behavior port", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/workspaces/components/WorkspaceHomeAgentRuntimeOrchestration.tsx",
      'import type { RuntimeAgentTaskSummary } from "../../../application/runtime/ports/webMcpBridge";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-webmcp-type-surface",
      }),
    ]);
  });

  it("rejects product imports of runtimeInfrastructure", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/utils/runtimeExample.ts",
      'import { runtimeInfrastructure } from "../application/runtime/ports/runtimeInfrastructure";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-infrastructure-port",
      }),
    ]);
  });

  it("rejects compat-only runtime host contract imports from the package root", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/services/runtimeClientTransport.ts",
      'import { isCodeRuntimeRpcMethodNotFoundErrorCode } from "@ku0/code-runtime-host-contract";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-host-contract-compat-subpath",
      }),
    ]);
  });

  it("rejects mixed value and type imports from the webMcp behavior port", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/workspaces/components/WorkspaceHomeAgentControlCore.tsx",
      'import { supportsWebMcp, type AgentIntentState } from "../../../application/runtime/ports/webMcpBridge";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-webmcp-type-surface",
      }),
    ]);
  });

  it("rejects multiline mixed value and type imports from the webMcp behavior port", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/workspaces/components/WorkspaceHomeAgentControlCore.tsx",
      [
        "import {",
        "  supportsWebMcp,",
        "  type AgentIntentState,",
        '} from "../../../application/runtime/ports/webMcpBridge";',
        "",
      ].join("\n")
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-webmcp-type-surface",
      }),
    ]);
  });

  it("treats app web entry files as UI boundaries for runtime implementation imports", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/web/WorkspaceClientEntry.tsx",
      'import { hiddenThing } from "../application/runtime/internal/example";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-implementation",
      }),
    ]);
  });

  it("runs for any touched guarded UI root or rule file", () => {
    expect(
      shouldRunUiServiceBoundaryGuard(["apps/code/src/design-system/components/Foo.tsx"])
    ).toBe(true);
    expect(shouldRunUiServiceBoundaryGuard(["apps/code/src/hooks/useFoo.ts"])).toBe(true);
    expect(shouldRunUiServiceBoundaryGuard(["scripts/lib/ui-service-boundary.mjs"])).toBe(true);
    expect(shouldRunUiServiceBoundaryGuard(["apps/code/src/utils/foo.ts"])).toBe(true);
  });
});
