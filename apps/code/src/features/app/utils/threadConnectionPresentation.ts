import type { StatusBadgeTone } from "../../../design-system";

export type ThreadConnectionState = "live" | "syncing" | "fallback" | "offline";

type ThreadConnectionPresentation = {
  label: string;
  title: string;
  tone: StatusBadgeTone;
};

const THREAD_CONNECTION_PRESENTATION: Record<ThreadConnectionState, ThreadConnectionPresentation> =
  {
    live: {
      label: "Live",
      title: "Receiving live thread events",
      tone: "success",
    },
    syncing: {
      label: "Syncing",
      title: "Connected, syncing thread state",
      tone: "progress",
    },
    fallback: {
      label: "Fallback",
      title: "Live stream degraded, using polling fallback",
      tone: "warning",
    },
    offline: {
      label: "Offline",
      title: "Disconnected from backend",
      tone: "default",
    },
  };

export function resolveThreadConnectionPresentation(
  state: ThreadConnectionState
): ThreadConnectionPresentation {
  return THREAD_CONNECTION_PRESENTATION[state];
}
