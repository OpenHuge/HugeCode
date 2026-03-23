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
      'import { getAppSettings } from "../../../application/runtime/ports/tauriSettings";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "runtime-legacy-bridge",
      }),
    ]);
  });

  it("rejects direct tauri imports in shared workspace client files", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "packages/code-workspace-client/src/workspace/WorkspaceClientApp.tsx",
      'import { invoke } from "@tauri-apps/api/core";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "tauri-import",
      }),
    ]);
  });

  it("rejects direct tauri imports in the web workspace shell", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code-web/app/components/WorkspaceClientApp.tsx",
      'import { invoke } from "@tauri-apps/api/core";\n'
    );

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "tauri-import",
      }),
    ]);
  });

  it("rejects direct desktop host adapter port imports in product code", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/about/components/AboutView.tsx",
      'import { resolveAppVersion } from "../../../application/runtime/ports/tauriEnvironment";\n'
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

  it("rejects direct tauri skill bridge imports in production UI files", () => {
    const violations = collectUiBoundaryViolationsForSource(
      "apps/code/src/features/skills/hooks/useSkills.ts",
      'import { getSkillsList } from "../../../application/runtime/ports/tauriSkills";\n'
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
      'import { getAppSettings } from "../../../application/runtime/ports/tauriAppSettings";\n'
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
      'import { getAppSettings } from "../application/runtime/ports/tauriSettings";\n'
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
      'import type { AcpIntegrationSummary } from "../../../../../application/runtime/ports/tauriSettings";\n'
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
      'import { startRuntimeJobWithRemoteSelection } from "../../../application/runtime/facades/runtimeRemoteExecutionFacade";\n'
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
      'import { getAppSettings } from "../application/runtime/ports/tauriAppSettings";\n'
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
