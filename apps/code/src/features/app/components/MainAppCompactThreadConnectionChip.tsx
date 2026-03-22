import { StatusBadge } from "../../../design-system";
import {
  resolveThreadConnectionPresentation,
  type ThreadConnectionState,
} from "../utils/threadConnectionPresentation";

type MainAppCompactThreadConnectionChipProps = {
  show: boolean;
  hasActiveThread: boolean;
  connectionState: ThreadConnectionState;
};

export function MainAppCompactThreadConnectionChip({
  show,
  hasActiveThread,
  connectionState,
}: MainAppCompactThreadConnectionChipProps) {
  if (!show || !hasActiveThread) {
    return null;
  }

  const presentation = resolveThreadConnectionPresentation(connectionState);

  return (
    <StatusBadge
      className="workspace-thread-chip"
      data-workspace-chrome="pill"
      tone={presentation.tone}
      title={presentation.title}
    >
      {presentation.label}
    </StatusBadge>
  );
}
