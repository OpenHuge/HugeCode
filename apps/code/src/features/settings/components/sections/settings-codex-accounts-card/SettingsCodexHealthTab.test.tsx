import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SettingsCodexHealthTab } from "./SettingsCodexHealthTab";

describe("SettingsCodexHealthTab", () => {
  it("renders provider monograms through the shared avatar family", () => {
    const markup = renderToStaticMarkup(
      <SettingsCodexHealthTab
        onRefresh={vi.fn()}
        busyAction={null}
        healthSectionRef={createRef<HTMLDivElement>()}
        providerPoolRoutingHealth={[
          {
            providerId: "codex",
            providerLabel: "Codex Cloud",
            poolRoutingReady: true,
            recommendation: null,
            accountsTotal: 4,
            enabledAccounts: 3,
            credentialReadyAccounts: 2,
            poolsTotal: 2,
            enabledPools: 1,
          },
        ]}
        routingReadyCount={1}
      />
    );

    expect(markup).toContain("Codex Cloud");
    expect(markup).toContain("apm-row-avatar");
    expect(markup).toContain('data-family="avatar"');
    expect(markup).toContain('data-size="lg"');
    expect(markup).toContain('data-shape="rounded"');
    expect(markup).toContain('data-family="text"');
    expect(markup).toContain('data-size="fine"');
    expect(markup).toContain('data-size="meta"');
    expect(markup).toContain('data-tone="strong"');
    expect(markup).toContain('data-tone="faint"');
    expect(markup).toContain('data-status-tone="success"');
    expect(markup).toContain('data-shape="chip"');
    expect(markup).toContain('data-size="md"');
    expect(markup).toContain("CC");
  });
});
