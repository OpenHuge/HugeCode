/**
 * Narrow workspace catalog adapter.
 *
 * Prefer this over the retired `tauriWorkspaces` bridge when a feature only needs to read the
 * registered workspace list.
 */
export { listWorkspaces } from "../../../services/tauriWorkspaceBridge";
