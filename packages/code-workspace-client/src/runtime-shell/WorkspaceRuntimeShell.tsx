import { WorkspaceApp } from "../workspace-app/WorkspaceApp";
import {
  bootCard,
  bootDetail,
  bootEyebrow,
  bootShell,
  bootTitle,
} from "../workspace/WorkspaceClientEntry.css";
import { useWorkspaceClientBindings } from "../workspace/WorkspaceClientBindingsProvider";

export function WorkspaceRuntimeShell() {
  const bindings = useWorkspaceClientBindings();
  return bindings.platformUi.renderWorkspaceHost(<WorkspaceApp />);
}

export function WorkspaceRuntimeContentFallback() {
  return (
    <div
      aria-label="Loading workspace content"
      aria-live="polite"
      className={bootShell}
      data-app-boot="workspace-content"
      role="status"
    >
      <div className={bootCard}>
        <span className={bootEyebrow}>Workspace content</span>
        <strong className={bootTitle}>Opening workspace</strong>
        <span className={bootDetail}>
          Restoring the shared workspace surface and platform host wiring.
        </span>
      </div>
    </div>
  );
}

export default WorkspaceRuntimeShell;
