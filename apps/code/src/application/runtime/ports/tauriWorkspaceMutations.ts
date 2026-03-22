/**
 * Narrow workspace mutation adapter for catalog item lifecycle changes.
 *
 * Prefer this over the retired `tauriWorkspaces` bridge for workspace and
 * worktree mutations so features do not depend on the old aggregation layer.
 */
export { renameWorktreeUpstream } from "../../../services/tauriDesktopWorkspace";
export {
  addClone,
  addWorkspace,
  addWorktree,
  connectWorkspace,
  removeWorkspace,
  removeWorktree,
  renameWorkspace,
  renameWorktree,
  updateWorkspaceCodexBin,
  updateWorkspaceSettings,
} from "../../../services/tauriWorkspaceBridge";
