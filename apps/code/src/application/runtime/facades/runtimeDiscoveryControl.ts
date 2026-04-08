import {
  buildRuntimeDiscoveryAutomationControl,
  buildRuntimeDiscoveryBackendControl,
  buildRuntimeDiscoveryExtensionControl,
} from "./runtimeDiscoveryDomainControls";
import {
  buildRuntimeDiscoveryCatalogControl,
  buildRuntimeDiscoveryDiagnosticsControl,
  buildRuntimeDiscoveryOAuthControl,
  buildRuntimeDiscoveryOperationsControl,
  buildRuntimeDiscoveryPromptControl,
  buildRuntimeDiscoverySystemControl,
  buildRuntimeDiscoveryTerminalControl,
} from "./runtimeDiscoveryCoreControls";

export function buildRuntimeDiscoveryControl(workspaceId: string) {
  return {
    ...buildRuntimeDiscoveryAutomationControl(),
    ...buildRuntimeDiscoveryBackendControl(workspaceId),
    ...buildRuntimeDiscoveryExtensionControl(workspaceId),
    ...buildRuntimeDiscoverySystemControl(),
    ...buildRuntimeDiscoveryTerminalControl(workspaceId),
    ...buildRuntimeDiscoveryDiagnosticsControl(workspaceId),
    ...buildRuntimeDiscoveryOperationsControl(workspaceId),
    ...buildRuntimeDiscoveryPromptControl(workspaceId),
    ...buildRuntimeDiscoveryOAuthControl(),
    ...buildRuntimeDiscoveryCatalogControl(),
  };
}
