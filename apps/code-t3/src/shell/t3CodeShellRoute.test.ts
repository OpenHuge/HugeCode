import { describe, expect, it } from "vitest";
import { resolveT3CodeShellRoute, resolveT3CodeShellTitle } from "./t3CodeShellRoute";

describe("resolveT3CodeShellRoute", () => {
  it("defaults to the workspace shell", () => {
    const route = resolveT3CodeShellRoute("?page=chat");

    expect(route).toEqual({ kind: "workspace" });
    expect(resolveT3CodeShellTitle(route)).toBe("HugeCode T3");
  });

  it("parses hcbrowser route", () => {
    const route = resolveT3CodeShellRoute(
      "?hcbrowser=1&appId=app-1&appKey=key-1&profile=Team%20Chrome&provider=chatgpt&target=https%3A%2F%2Fchatgpt.com%2F&chatgptAssistant=1&ldxpAssistant=1"
    );

    expect(route.kind).toBe("browser");
    if (route.kind !== "browser") {
      return;
    }
    expect(resolveT3CodeShellTitle(route)).toBe("HugeCode Browser");
    expect(route.browserProps).toMatchObject({
      initialAppId: "app-1",
      initialAppKey: "key-1",
      initialCaptureMode: null,
      initialProfileLabel: "Team Chrome",
      initialProvider: "chatgpt",
      initialTargetUrl: "https://chatgpt.com/",
      initialChatGptAssistant: true,
      initialLdxpAssistant: true,
    });
  });

  it("uses ChatGPT as the browser home page when no target is provided", () => {
    const route = resolveT3CodeShellRoute("?hcbrowser=1");

    expect(route.kind).toBe("browser");
    if (route.kind !== "browser") {
      return;
    }
    expect(route.browserProps.initialTargetUrl).toBe("https://chatgpt.com/");
  });

  it("enables the ChatGPT assistant only when requested", () => {
    const route = resolveT3CodeShellRoute("?hcbrowser=1&provider=chatgpt&chatgptAssistant=1");

    expect(route.kind).toBe("browser");
    if (route.kind !== "browser") {
      return;
    }
    expect(route.browserProps.initialChatGptAssistant).toBe(true);
  });

  it("parses operator delivery capture mode for the browser shell", () => {
    const route = resolveT3CodeShellRoute(
      "?hcbrowser=1&provider=chatgpt&captureMode=operator-delivery"
    );

    expect(route.kind).toBe("browser");
    if (route.kind !== "browser") {
      return;
    }
    expect(route.browserProps.initialCaptureMode).toBe("operator-delivery");
  });
});
