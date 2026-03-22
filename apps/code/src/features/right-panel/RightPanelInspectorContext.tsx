import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type RightPanelSelectionKind =
  | "message"
  | "reasoning"
  | "tool"
  | "explore"
  | "review"
  | "diff";

export type RightPanelSelection = {
  kind: RightPanelSelectionKind;
  itemId: string;
} | null;

type RightPanelInspectorContextValue = {
  selection: RightPanelSelection;
  selectItem: (kind: RightPanelSelectionKind, itemId: string) => void;
  clearSelection: () => void;
  isSelected: (itemId: string) => boolean;
};

const RightPanelInspectorContext = createContext<RightPanelInspectorContextValue | null>(null);

type RightPanelInspectorProviderProps = {
  children: ReactNode;
  scopeKey: string;
};

export function RightPanelInspectorProvider({
  children,
  scopeKey,
}: RightPanelInspectorProviderProps) {
  const [selection, setSelection] = useState<RightPanelSelection>(null);

  useEffect(() => {
    setSelection(null);
  }, [scopeKey]);

  const selectItem = useCallback((kind: RightPanelSelectionKind, itemId: string) => {
    setSelection({ kind, itemId });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  const isSelected = useCallback(
    (itemId: string) => Boolean(selection && selection.itemId === itemId),
    [selection]
  );

  const value = useMemo(
    () => ({
      selection,
      selectItem,
      clearSelection,
      isSelected,
    }),
    [clearSelection, isSelected, selectItem, selection]
  );

  return (
    <RightPanelInspectorContext.Provider value={value}>
      {children}
    </RightPanelInspectorContext.Provider>
  );
}

export function useRightPanelInspector() {
  const value = useContext(RightPanelInspectorContext);
  if (!value) {
    throw new Error("useRightPanelInspector must be used within RightPanelInspectorProvider");
  }
  return value;
}

export function useOptionalRightPanelInspector() {
  return useContext(RightPanelInspectorContext);
}
