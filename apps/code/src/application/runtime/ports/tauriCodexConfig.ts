/**
 * Codex configuration file adapter.
 *
 * These file operations are still backed by legacy desktop commands rather
 * than the newer `code_*` runtime RPC surface. Keeping them in a dedicated
 * adapter makes the boundary explicit and avoids routing new settings code
 * through the retired `tauriSettings` bridge.
 */
export { getCodexConfigPath } from "../../../services/tauriDesktopRpc";
export {
  readGlobalAgentsMd,
  readGlobalCodexConfigToml,
  writeGlobalAgentsMd,
  writeGlobalCodexConfigToml,
} from "../../../services/tauriTextFilesBridge";
