import { useCallback, useEffect, useState } from "react";
import {
  readSafeLocalStorageItem,
  writeSafeLocalStorageItem,
} from "../../../utils/safeLocalStorage";

const STORAGE_KEY = "composerEditorExpanded";

export function useComposerEditorState() {
  const [isExpanded, setIsExpanded] = useState(() => {
    return readSafeLocalStorageItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    writeSafeLocalStorageItem(STORAGE_KEY, String(isExpanded));
  }, [isExpanded]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return { isExpanded, toggleExpanded };
}
