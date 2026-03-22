import type { MessageListEntry } from "./messageRenderUtils";
import { resolveMetaNotice } from "./messageRenderUtils";
import { resolveTimelineMessageBanner } from "./timelineSurface";

export function entryContainsItemId(entry: MessageListEntry, itemId: string) {
  return entry.kind === "item"
    ? entry.item.id === itemId
    : entry.group.items.some((item) => item.id === itemId);
}

export function isNarrativeTimelineEntry(entry: MessageListEntry) {
  if (entry.kind !== "item") {
    return false;
  }
  const { item } = entry;
  if (item.kind !== "message") {
    return false;
  }
  if (resolveMetaNotice(item) || resolveTimelineMessageBanner(item)) {
    return false;
  }
  return true;
}

export function splitTimelinePresentationEntries<T extends { showTurnDivider: boolean }>(
  entries: T[]
) {
  const historyEntries: T[] = [];
  const currentTurnEntries: T[] = [];
  let currentTurnStarted = false;

  entries.forEach((entry) => {
    if (entry.showTurnDivider) {
      currentTurnStarted = true;
    }
    if (currentTurnStarted) {
      currentTurnEntries.push(entry);
      return;
    }
    historyEntries.push(entry);
  });

  return {
    historyPresentationEntries: historyEntries,
    currentTurnPresentationEntries: currentTurnEntries,
  };
}
