export type T3CodeShellRoute =
  | {
      kind: "browser";
      browserProps: {
        initialAppId: string | null;
        initialAppKey: string | null;
        initialAppLabel: string | null;
        initialCaptureMode: "operator-delivery" | null;
        initialContinuityMode: string | null;
        initialContinuityStatus: string | null;
        initialDeviceCount: string | null;
        initialIsolationMode: string | null;
        initialChatGptAssistant: boolean;
        initialLdxpAssistant: boolean;
        initialProfileId: string;
        initialProfileLabel: string;
        initialProvider: string;
        initialTargetUrl: string;
      };
    }
  | {
      kind: "workspace";
    };

const DEFAULT_BROWSER_HOME_URL = "https://chatgpt.com/";

export function resolveT3CodeShellRoute(search: string): T3CodeShellRoute {
  const searchParams = new URLSearchParams(search);
  if (searchParams.get("hcbrowser") !== "1") {
    return { kind: "workspace" };
  }

  return {
    kind: "browser",
    browserProps: {
      initialAppId: searchParams.get("appId"),
      initialAppKey: searchParams.get("appKey"),
      initialAppLabel: searchParams.get("appLabel"),
      initialCaptureMode:
        searchParams.get("captureMode") === "operator-delivery" ? "operator-delivery" : null,
      initialContinuityMode: searchParams.get("continuityMode"),
      initialContinuityStatus: searchParams.get("continuity"),
      initialDeviceCount: searchParams.get("deviceCount"),
      initialIsolationMode: searchParams.get("isolation"),
      initialChatGptAssistant: searchParams.get("chatgptAssistant") === "1",
      initialLdxpAssistant: searchParams.get("ldxpAssistant") === "1",
      initialProfileId: searchParams.get("profileId") ?? "current-browser",
      initialProfileLabel: searchParams.get("profile") ?? "Current browser profile",
      initialProvider: searchParams.get("provider") ?? "custom",
      initialTargetUrl: searchParams.get("target") ?? DEFAULT_BROWSER_HOME_URL,
    },
  };
}

export function resolveT3CodeShellTitle(route: T3CodeShellRoute): string {
  return route.kind === "browser" ? "HugeCode Browser" : "HugeCode T3";
}
