import { useCallback, useState } from "react";
import type { ThreadListSortKey } from "../../../types";
import {
  readSafeLocalStorageItem,
  writeSafeLocalStorageItem,
} from "../../../utils/safeLocalStorage";

const THREAD_LIST_SORT_KEY_STORAGE_KEY = "codexmonitor.threadListSortKey";

function getStoredThreadListSortKey(): ThreadListSortKey {
  if (typeof window === "undefined") {
    return "updated_at";
  }
  const stored = readSafeLocalStorageItem(THREAD_LIST_SORT_KEY_STORAGE_KEY);
  if (stored === "created_at" || stored === "updated_at") {
    return stored;
  }
  return "updated_at";
}

export function useThreadListSortKey() {
  const [threadListSortKey, setThreadListSortKeyState] = useState<ThreadListSortKey>(() =>
    getStoredThreadListSortKey()
  );

  const setThreadListSortKey = useCallback((nextSortKey: ThreadListSortKey) => {
    setThreadListSortKeyState(nextSortKey);
    writeSafeLocalStorageItem(THREAD_LIST_SORT_KEY_STORAGE_KEY, nextSortKey);
  }, []);

  return {
    threadListSortKey,
    setThreadListSortKey,
  };
}
