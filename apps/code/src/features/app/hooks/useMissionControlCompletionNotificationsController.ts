import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import type { DebugEntry } from "../../../types";
import type { MissionNavigationTarget } from "../../missions/utils/missionControlPresentation";
import { useWindowFocusState } from "../../layout/hooks/useWindowFocusState";
import { useMissionControlCompletionNotifications } from "../../notifications/hooks/useMissionControlCompletionNotifications";

type Params = {
  systemNotificationsEnabled: boolean;
  missionControlProjection: HugeCodeMissionControlSnapshot | null;
  getWorkspaceName?: (workspaceId: string) => string | undefined;
  onThreadNotificationSent?: (workspaceId: string, threadId: string) => void;
  onMissionNotificationSent?: (target: MissionNavigationTarget) => void;
  onDebug?: (entry: DebugEntry) => void;
};

export function useMissionControlCompletionNotificationsController({
  systemNotificationsEnabled,
  missionControlProjection,
  getWorkspaceName,
  onThreadNotificationSent,
  onMissionNotificationSent,
  onDebug,
}: Params) {
  const isWindowFocused = useWindowFocusState();

  useMissionControlCompletionNotifications({
    enabled: systemNotificationsEnabled,
    isWindowFocused,
    missionControlProjection,
    getWorkspaceName,
    onThreadNotificationSent,
    onMissionNotificationSent,
    onDebug,
  });
}
