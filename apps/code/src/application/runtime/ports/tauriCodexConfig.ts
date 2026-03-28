/**
 * Codex configuration file adapter.
 *
 * These file operations now use canonical `code_*` runtime RPC commands while
 * remaining behind a dedicated adapter so UI code stays inside the approved
 * application/runtime boundary.
 */
export { getCodexConfigPath } from "../../../services/desktopHostRpc";
export {
  readGlobalAgentsMd,
  readGlobalCodexConfigToml,
  writeGlobalAgentsMd,
  writeGlobalCodexConfigToml,
} from "../../../services/tauriTextFilesBridge";
