import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY,
  hasConfiguredWebRuntimeGateway,
} from "../runtimeGatewayEnv";

describe("hasConfiguredWebRuntimeGateway", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when the gateway endpoint env is missing", () => {
    expect(hasConfiguredWebRuntimeGateway()).toBe(false);
  });

  it("returns false when the gateway endpoint env is blank", () => {
    vi.stubEnv(WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY, "   ");

    expect(hasConfiguredWebRuntimeGateway()).toBe(false);
  });

  it("returns true when the gateway endpoint env is configured", () => {
    vi.stubEnv(WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY, "http://127.0.0.1:8788/rpc");

    expect(hasConfiguredWebRuntimeGateway()).toBe(true);
  });
});
