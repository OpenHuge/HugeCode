export const WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY = "VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT";

export function hasConfiguredWebRuntimeGateway(): boolean {
  const env = (
    import.meta as ImportMeta & {
      env?: Record<string, string | boolean | undefined>;
    }
  ).env;
  const nodeLikeGlobal = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const raw =
    env?.[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY] ??
    nodeLikeGlobal.process?.env?.[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY];

  return typeof raw === "string" && raw.trim().length > 0;
}
