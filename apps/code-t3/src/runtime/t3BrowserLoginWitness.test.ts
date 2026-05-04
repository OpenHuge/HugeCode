import { describe, expect, it } from "vitest";
import type { BrowserChromeSnapshot } from "./t3BrowserChromeBridge";
import {
  buildT3BrowserChatGptLoginWitness,
  buildVerifiedT3BrowserChatGptLoginWitness,
} from "./t3BrowserLoginWitness";

function snapshot(input: {
  loading?: boolean;
  securityState?: BrowserChromeSnapshot["tabs"][number]["securityState"];
  title?: string;
  url: string;
}): BrowserChromeSnapshot {
  return {
    activeTabId: "tab-1",
    tabs: [
      {
        canGoBack: false,
        canGoForward: false,
        id: "tab-1",
        loading: input.loading ?? false,
        securityState: input.securityState ?? "secure",
        title: input.title ?? "ChatGPT",
        url: input.url,
      },
    ],
  };
}

describe("t3BrowserLoginWitness", () => {
  it("blocks witness capture before account data import is ready", () => {
    expect(
      buildT3BrowserChatGptLoginWitness({
        importReady: false,
        snapshot: snapshot({ url: "https://chatgpt.com/" }),
        targetUrl: "https://chatgpt.com/",
      }).status
    ).toBe("IMPORT_NOT_READY");
  });

  it("classifies ChatGPT auth routes as a session restore failure", () => {
    const witness = buildT3BrowserChatGptLoginWitness({
      importReady: true,
      snapshot: snapshot({
        title: "Log in",
        url: "https://auth.openai.com/log-in",
      }),
      targetUrl: "https://chatgpt.com/",
    });

    expect(witness.status).toBe("SESSION_RESTORE_FAILED");
    expect(witness.evidence.activeUrl).toBe("https://auth.openai.com/log-in");
  });

  it("requires a manual witness when ChatGPT loads without a readable login proof", () => {
    expect(
      buildT3BrowserChatGptLoginWitness({
        importReady: true,
        snapshot: snapshot({ url: "https://chatgpt.com/" }),
        targetUrl: "https://chatgpt.com/",
      }).status
    ).toBe("MANUAL_WITNESS_REQUIRED");
  });

  it("records explicit manual verification as a verified witness", () => {
    expect(
      buildVerifiedT3BrowserChatGptLoginWitness({
        snapshot: snapshot({ url: "https://chatgpt.com/" }),
        targetUrl: "https://chatgpt.com/",
        verifiedAt: 1700000000000,
      })
    ).toEqual(
      expect.objectContaining({
        checkedAt: 1700000000000,
        provider: "chatgpt",
        status: "VERIFIED",
      })
    );
  });
});
