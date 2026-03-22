import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import type { DebugEntry } from "../../../types";
import type { MissionNavigationTarget } from "../../missions/utils/missionControlPresentation";
import { useWindowFocusState } from "../../layout/hooks/useWindowFocusState";
import { useMissionControlAttentionNotifications } from "../../notifications/hooks/useMissionControlAttentionNotifications";

type Params = {
  systemNotificationsEnabled: boolean;
  missionControlProjection: HugeCodeMissionControlSnapshot | null;
  getWorkspaceName?: (workspaceId: string) => string | undefined;
  onThreadNotificationSent?: (workspaceId: string, threadId: string) => void;
  onMissionNotificationSent?: (target: MissionNavigationTarget) => void;
  onDebug?: (entry: DebugEntry) => void;
};

export function useMissionControlAttentionNotificationsController({
  systemNotificationsEnabled,
  missionControlProjection,
  getWorkspaceName,
  onThreadNotificationSent,
  onMissionNotificationSent,
  onDebug,
}: Params) {
  const isWindowFocused = useWindowFocusState();

  useMissionControlAttentionNotifications({
    enabled: systemNotificationsEnabled,
    isWindowFocused,
    missionControlProjection,
    getWorkspaceName,
    onThreadNotificationSent,
    onMissionNotificationSent,
    onDebug,
  });
}
