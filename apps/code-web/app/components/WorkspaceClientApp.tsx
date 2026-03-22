import type { WorkspaceClientBindings } from "@ku0/code-workspace-client";
import { WorkspaceClientBoot } from "@ku0/code-workspace-client/workspace";
import {
  workspaceFallbackCard,
  workspaceFallbackDetail,
  workspaceFallbackEyebrow,
  workspaceFallbackShell,
  workspaceFallbackTitle,
} from "../web.css";

export function WorkspaceBootFallback() {
  return (
    <div
      aria-label="Launching workspace"
      aria-live="polite"
      className={workspaceFallbackShell}
      data-app-boot="workspace"
      role="status"
    >
      <div className={workspaceFallbackCard}>
        <span className={workspaceFallbackEyebrow}>Open Fast</span>
        <strong className={workspaceFallbackTitle}>Launching workspace</strong>
        <span className={workspaceFallbackDetail}>
          Preparing the client-only workspace shell and runtime connection path.
        </span>
      </div>
    </div>
  );
}

export function WorkspaceClientApp({ bindings }: { bindings: WorkspaceClientBindings }) {
  return <WorkspaceClientBoot bindings={bindings} bootFallback={<WorkspaceBootFallback />} />;
}
