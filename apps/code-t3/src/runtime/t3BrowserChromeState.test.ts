import { describe, expect, it } from "vitest";
import {
  closeBrowserChromeTabState,
  createBrowserChromeTabState,
  normalizeBrowserChromeNavigationInput,
  resolveBrowserChromeSecurityState,
} from "../../electron/browserChromeState";

describe("browserChromeState", () => {
  it("normalizes Chrome-style navigation input", () => {
    expect(normalizeBrowserChromeNavigationInput("github.com")).toBe("https://github.com/");
    expect(normalizeBrowserChromeNavigationInput("openai codex")).toBe(
      "https://www.google.com/search?q=openai+codex"
    );
    expect(normalizeBrowserChromeNavigationInput("localhost:5197")).toBe("https://localhost:5197/");
  });

  it("reports security state from the visible URL", () => {
    expect(resolveBrowserChromeSecurityState("")).toBe("internal");
    expect(resolveBrowserChromeSecurityState("https://chatgpt.com/")).toBe("secure");
    expect(resolveBrowserChromeSecurityState("http://localhost:5197/")).toBe("insecure");
    expect(resolveBrowserChromeSecurityState("not a url")).toBe("unknown");
  });

  it("selects a neighboring tab and creates a replacement when the last tab closes", () => {
    const firstTab = createBrowserChromeTabState({ id: "tab-1", url: "https://chatgpt.com/" });
    const secondTab = createBrowserChromeTabState({ id: "tab-2", url: "https://github.com/" });
    const replacementTab = createBrowserChromeTabState({ id: "tab-3" });

    expect(
      closeBrowserChromeTabState(
        {
          activeTabId: "tab-1",
          tabs: [firstTab, secondTab],
        },
        "tab-1",
        replacementTab
      )
    ).toMatchObject({
      activeTabId: "tab-2",
      tabs: [{ id: "tab-2" }],
    });

    expect(
      closeBrowserChromeTabState(
        {
          activeTabId: "tab-1",
          tabs: [firstTab],
        },
        "tab-1",
        replacementTab
      )
    ).toEqual({
      activeTabId: "tab-3",
      tabs: [replacementTab],
    });
  });
});
