import { useMemo } from "react";
import type { CollaborationModeOption } from "../../../types";

type UseCollaborationModeSelectionOptions = {
  selectedCollaborationMode: CollaborationModeOption | null;
  selectedCollaborationModeId: string | null;
};

export function useCollaborationModeSelection({
  selectedCollaborationMode,
  selectedCollaborationModeId,
}: UseCollaborationModeSelectionOptions) {
  const collaborationModePayload = useMemo(() => {
    if (!selectedCollaborationModeId || !selectedCollaborationMode) {
      return null;
    }

    const modeValue = selectedCollaborationMode.mode || selectedCollaborationMode.id;
    if (!modeValue) {
      return null;
    }

    const settings: Record<string, unknown> = {
      id: selectedCollaborationModeId,
    };

    return {
      mode: modeValue,
      settings,
    };
  }, [selectedCollaborationMode, selectedCollaborationModeId]);

  return { collaborationModePayload };
}
