import { memo, useDeferredValue, useMemo } from "react";
import type {
  RuntimeCompositionProfile,
  RuntimeCompositionResolution,
} from "@ku0/code-runtime-host-contract";
import { ToolCallChip } from "../../../design-system";
import { useWorkspaceRuntimeControlPlaneOperatorState } from "../../../application/runtime/facades/runtimeKernelControlPlaneFacadeHooks";
import { buildRuntimeControlPlaneOperatorModel } from "../../../application/runtime/facades/runtimeKernelControlPlaneOperatorModel";
import { resolveRuntimeControlPlaneOperatorActionPresentation } from "../../../application/runtime/facades/runtimeKernelControlPlaneOperatorPresentation";
import type { RuntimeKernelPluginDescriptor } from "../../../application/runtime/kernel/runtimeKernelPluginTypes";
import { MissionControlSectionCard } from "./WorkspaceHomeMissionControlSections";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";

type WorkspaceHomeAgentRuntimePluginControlPlaneProps = {
  workspaceId: string;
  pluginControlPlaneSurface: {
    plugins: RuntimeKernelPluginDescriptor[];
    pluginsError: string | null;
    profiles: RuntimeCompositionProfile[];
    activeProfileId: string | null;
    activeProfile: RuntimeCompositionProfile | null;
    resolution: RuntimeCompositionResolution | null;
    compositionError: string | null;
    registryError: string | null;
  };
  refreshRuntimeTasks: () => Promise<void>;
  runtimeLoading: boolean;
};

export const WorkspaceHomeAgentRuntimePluginControlPlane = memo(
  function WorkspaceHomeAgentRuntimePluginControlPlane({
    workspaceId,
    pluginControlPlaneSurface,
    refreshRuntimeTasks,
    runtimeLoading,
  }: WorkspaceHomeAgentRuntimePluginControlPlaneProps) {
    const runtimePluginControlPlane = useWorkspaceRuntimeControlPlaneOperatorState({
      workspaceId,
      refresh: refreshRuntimeTasks,
    });
    const deferredPluginControlPlaneSurface = useDeferredValue(pluginControlPlaneSurface);
    const pluginControlPlane = useMemo(
      () =>
        buildRuntimeControlPlaneOperatorModel({
          plugins: deferredPluginControlPlaneSurface.plugins,
          profiles: deferredPluginControlPlaneSurface.profiles,
          activeProfile: deferredPluginControlPlaneSurface.activeProfile,
          activeProfileId: deferredPluginControlPlaneSurface.activeProfileId,
          resolution: deferredPluginControlPlaneSurface.resolution,
        }),
      [deferredPluginControlPlaneSurface]
    );
    const pluginControlPlaneError =
      deferredPluginControlPlaneSurface.pluginsError ??
      deferredPluginControlPlaneSurface.compositionError ??
      deferredPluginControlPlaneSurface.registryError;
    const pluginControlPlaneStatus = pluginControlPlaneError
      ? {
          label: "Attention",
          tone: "warning" as const,
        }
      : pluginControlPlane.counts.needsAction > 0
        ? {
            label: "Needs action",
            tone: "warning" as const,
          }
        : pluginControlPlane.counts.selectedNow > 0
          ? {
              label: "Selected",
              tone: "success" as const,
            }
          : {
              label: "Inventory",
              tone: "neutral" as const,
            };
    const readPluginActionPresentation = (
      action: Parameters<typeof resolveRuntimeControlPlaneOperatorActionPresentation>[0]["action"]
    ) =>
      resolveRuntimeControlPlaneOperatorActionPresentation({
        action,
        busyActionId: runtimePluginControlPlane.busyActionId,
        runtimeLoading,
      });

    return (
      <MissionControlSectionCard
        title="Plugin operator actions"
        statusLabel={pluginControlPlaneStatus.label}
        statusTone={pluginControlPlaneStatus.tone}
        meta={
          <>
            <ToolCallChip tone="neutral">
              Needs action {pluginControlPlane.counts.needsAction}
            </ToolCallChip>
            <ToolCallChip tone="neutral">
              Selected now {pluginControlPlane.counts.selectedNow}
            </ToolCallChip>
            <ToolCallChip tone="neutral">
              Inventory {pluginControlPlane.counts.inventory}
            </ToolCallChip>
            <ToolCallChip tone="neutral">
              Profiles {pluginControlPlane.counts.profiles}
            </ToolCallChip>
          </>
        }
      >
        {runtimePluginControlPlane.info ? (
          <div className={controlStyles.sectionMeta}>{runtimePluginControlPlane.info}</div>
        ) : null}
        {runtimePluginControlPlane.error ? (
          <div className={controlStyles.warning}>{runtimePluginControlPlane.error}</div>
        ) : null}
        {pluginControlPlaneError ? (
          <div className={controlStyles.warning}>{pluginControlPlaneError}</div>
        ) : null}
        <div
          className="workspace-home-code-runtime-item"
          data-testid="workspace-runtime-plugin-operator-actions"
        >
          <div className="workspace-home-code-runtime-item-main">
            <strong>Composition profiles</strong>
            <span>
              Preview a profile before switching, or apply it directly when operator action is
              allowed.
            </span>
            {pluginControlPlane.profiles.map((profile) => (
              <span key={profile.id}>
                {profile.label} ({profile.scope}
                {profile.active ? ", active" : ""}): {profile.summary}
              </span>
            ))}
          </div>
          <div className="workspace-home-code-runtime-item-actions">
            {pluginControlPlane.profiles.flatMap((profile) =>
              profile.actions.map((action) => {
                const actionPresentation = readPluginActionPresentation(action);
                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={actionPresentation.disabled}
                    onClick={() => void runtimePluginControlPlane.runAction(action)}
                    title={actionPresentation.title}
                  >
                    {actionPresentation.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="workspace-home-code-runtime-item">
          <div className="workspace-home-code-runtime-item-main">
            <strong>Needs action</strong>
            <span>
              Packages or plugins that are blocked, installable, or otherwise waiting on an operator
              decision.
            </span>
            {pluginControlPlane.needsAction.length > 0 ? (
              pluginControlPlane.needsAction.map((item) => (
                <span key={item.id}>
                  {item.label} ({item.statusLabel}, {item.source}/{item.transport})
                  {item.attentionReason ? `: ${item.attentionReason}` : ""}
                </span>
              ))
            ) : (
              <span>No plugin packages currently need action.</span>
            )}
          </div>
          <div className="workspace-home-code-runtime-item-actions">
            {pluginControlPlane.needsAction.flatMap((item) =>
              item.actions.map((action) => {
                const actionPresentation = readPluginActionPresentation(action);
                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={actionPresentation.disabled}
                    onClick={() => void runtimePluginControlPlane.runAction(action)}
                    title={actionPresentation.title}
                  >
                    {actionPresentation.busy
                      ? actionPresentation.label
                      : `${item.label}: ${action.label}`}
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="workspace-home-code-runtime-item">
          <div className="workspace-home-code-runtime-item-main">
            <strong>Selected now</strong>
            {pluginControlPlane.selectedNow.length > 0 ? (
              pluginControlPlane.selectedNow.map((item) => (
                <span key={item.id}>
                  {item.label} ({item.source}/{item.transport})
                  {item.attentionReason ? `: ${item.attentionReason}` : ""}
                </span>
              ))
            ) : (
              <span>No plugins are currently selected by the active profile.</span>
            )}
          </div>
        </div>
        <div className="workspace-home-code-runtime-item">
          <div className="workspace-home-code-runtime-item-main">
            <strong>Inventory</strong>
            {pluginControlPlane.inventory.map((item) => (
              <span key={item.id}>
                {item.label} ({item.statusLabel}, {item.source}/{item.transport})
              </span>
            ))}
          </div>
        </div>
        {runtimePluginControlPlane.previewResolution ? (
          <div className="workspace-home-code-runtime-item">
            <div className="workspace-home-code-runtime-item-main">
              <strong>
                Preview: {runtimePluginControlPlane.previewProfileId ?? "composition profile"}
              </strong>
              <span>
                Selected plugins:{" "}
                {runtimePluginControlPlane.previewResolution.selectedPlugins.length}
              </span>
              <span>
                Blocked plugins: {runtimePluginControlPlane.previewResolution.blockedPlugins.length}
              </span>
              <span>
                Route candidates:{" "}
                {runtimePluginControlPlane.previewResolution.selectedRouteCandidates.length}
              </span>
              <span>
                Backend candidates:{" "}
                {runtimePluginControlPlane.previewResolution.selectedBackendCandidates.length}
              </span>
            </div>
            <div className="workspace-home-code-runtime-item-actions">
              <button type="button" onClick={() => runtimePluginControlPlane.clearPreview()}>
                Clear preview
              </button>
            </div>
          </div>
        ) : null}
      </MissionControlSectionCard>
    );
  }
);

WorkspaceHomeAgentRuntimePluginControlPlane.displayName =
  "WorkspaceHomeAgentRuntimePluginControlPlane";
