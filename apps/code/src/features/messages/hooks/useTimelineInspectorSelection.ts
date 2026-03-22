import { useCallback } from "react";
import {
  type RightPanelSelectionKind,
  useOptionalRightPanelInspector,
} from "../../right-panel/RightPanelInspectorContext";

export function useTimelineInspectorSelection() {
  const inspector = useOptionalRightPanelInspector();

  const getSelectionProps = useCallback(
    (kind: RightPanelSelectionKind, itemId: string) => ({
      isSelected: inspector?.isSelected(itemId) ?? false,
      onSelect: inspector ? () => inspector.selectItem(kind, itemId) : undefined,
    }),
    [inspector]
  );

  return { getSelectionProps };
}
