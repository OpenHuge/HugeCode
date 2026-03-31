/**
 * Narrow workspace mutation adapter for catalog item lifecycle changes.
 *
 * Prefer this over the retired legacy workspace bridge for workspace and
 * worktree mutations so features do not depend on the old aggregation layer.
 */
export { renameWorktreeUpstream } from "../../../services/desktopHostWorkspace";
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
} from "../../../services/workspaceBridge";
