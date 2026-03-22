import type { ConversationItem } from "../../../types";

const EMPTY_VISIBLE_ACTIVE_ITEMS: ConversationItem[] = [];

type ResolveVisibleActiveItemsOptions = {
  activeItems: ConversationItem[];
  activeThreadId: string | null;
  isNewAgentDraftMode: boolean;
};

export function resolveVisibleActiveItems({
  activeItems,
  activeThreadId,
  isNewAgentDraftMode,
}: ResolveVisibleActiveItemsOptions): ConversationItem[] {
  if (isNewAgentDraftMode && !activeThreadId) {
    return EMPTY_VISIBLE_ACTIVE_ITEMS;
  }
  return activeItems;
}
