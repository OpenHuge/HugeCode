import { startTransition, useCallback, useEffect, useRef, useState } from "react";

const DRAFT_SYNC_DELAY_MS = 180;

export type ComposerDraftSyncMode = "deferred" | "immediate" | "skip";

type UseComposerDraftSyncArgs = {
  draftText: string;
  onDraftChange?: (text: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  historyKey?: string | null;
};

export function useComposerDraftSync({
  draftText,
  onDraftChange,
  textareaRef,
  historyKey,
}: UseComposerDraftSyncArgs) {
  const [text, setText] = useState(draftText);
  const draftSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTextRef = useRef(draftText);
  const latestDraftTextRef = useRef(draftText);

  useEffect(() => {
    latestTextRef.current = text;
  }, [text]);

  useEffect(() => {
    latestDraftTextRef.current = draftText;
    setText((prev) => (prev === draftText ? prev : draftText));
  }, [draftText]);

  const clearScheduledDraftSync = useCallback(() => {
    if (draftSyncTimeoutRef.current === null) {
      return;
    }
    clearTimeout(draftSyncTimeoutRef.current);
    draftSyncTimeoutRef.current = null;
  }, []);

  const syncDraftToParent = useCallback(
    (next: string) => {
      clearScheduledDraftSync();
      if (!onDraftChange || latestDraftTextRef.current === next) {
        return;
      }
      latestDraftTextRef.current = next;
      startTransition(() => {
        onDraftChange(next);
      });
    },
    [clearScheduledDraftSync, onDraftChange]
  );

  const flushDraftToParent = useCallback(
    (override?: string) => {
      const next = override ?? textareaRef.current?.value ?? latestTextRef.current;
      syncDraftToParent(next);
    },
    [syncDraftToParent, textareaRef]
  );

  const scheduleDraftSync = useCallback(() => {
    if (!onDraftChange) {
      return;
    }
    clearScheduledDraftSync();
    draftSyncTimeoutRef.current = setTimeout(() => {
      draftSyncTimeoutRef.current = null;
      syncDraftToParent(latestTextRef.current);
    }, DRAFT_SYNC_DELAY_MS);
  }, [clearScheduledDraftSync, onDraftChange, syncDraftToParent]);

  useEffect(() => {
    return () => {
      if (draftSyncTimeoutRef.current === null) {
        return;
      }
      flushDraftToParent();
    };
  }, [flushDraftToParent, historyKey]);

  const setComposerText = useCallback(
    (next: string, syncMode: ComposerDraftSyncMode = "deferred") => {
      latestTextRef.current = next;
      setText(next);
      if (syncMode === "skip") {
        clearScheduledDraftSync();
        return;
      }
      if (syncMode === "immediate") {
        syncDraftToParent(next);
        return;
      }
      scheduleDraftSync();
    },
    [clearScheduledDraftSync, scheduleDraftSync, syncDraftToParent]
  );

  return {
    text,
    setComposerText,
    flushDraftToParent,
  };
}
