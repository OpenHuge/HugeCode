import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AccountChecklist } from "./AccountChecklist";

describe("AccountChecklist", () => {
  it("renders account monograms through the shared avatar family", () => {
    const markup = renderToStaticMarkup(
      <AccountChecklist
        accounts={[
          {
            accountId: "acct-1",
            provider: "codex",
            externalAccountId: "ext-1",
            email: "jane@example.com",
            displayName: "Jane Doe",
            status: "enabled",
            disabledReason: null,
            routeConfig: null,
            routingState: null,
            chatgptWorkspaces: null,
            defaultChatgptWorkspaceId: null,
            metadata: {},
            createdAt: 1,
            updatedAt: 1,
          },
        ]}
        selectedIds={[]}
        onToggle={vi.fn()}
      />
    );

    expect(markup).toContain("Jane Doe");
    expect(markup).toContain("apm-checklist-avatar");
    expect(markup).toContain('data-family="avatar"');
    expect(markup).toContain('data-size="sm"');
    expect(markup).toContain('data-shape="rounded"');
    expect(markup).toContain('data-family="text"');
    expect(markup).toContain('data-size="chrome"');
    expect(markup).toContain('data-tone="strong"');
    expect(markup).toContain('data-tone="muted"');
    expect(markup).toContain("JD");
  });
});
