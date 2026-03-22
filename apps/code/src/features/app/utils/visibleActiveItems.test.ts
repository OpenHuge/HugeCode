import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import { resolveVisibleActiveItems } from "./visibleActiveItems";

const items: ConversationItem[] = [
  {
    id: "user-1",
    kind: "message",
    role: "user",
    text: "Recovered pending draft",
  },
];

describe("resolveVisibleActiveItems", () => {
  it("suppresses workspace pending drafts while the user is explicitly in new-agent draft mode", () => {
    expect(
      resolveVisibleActiveItems({
        activeItems: items,
        activeThreadId: null,
        isNewAgentDraftMode: true,
      })
    ).toEqual([]);
  });

  it("preserves active thread items outside new-agent draft mode", () => {
    expect(
      resolveVisibleActiveItems({
        activeItems: items,
        activeThreadId: "thread-1",
        isNewAgentDraftMode: false,
      })
    ).toEqual(items);
  });
});
