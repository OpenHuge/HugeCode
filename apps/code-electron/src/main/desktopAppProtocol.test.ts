import { describe, expect, it } from "vitest";
import {
  createDesktopAppRendererUrl,
  DESKTOP_APP_PROTOCOL_HOST,
  DESKTOP_APP_PROTOCOL_SCHEME,
  resolveDesktopAppProtocolAssetPath,
} from "./desktopAppProtocol.js";

describe("desktopAppProtocol", () => {
  it("builds the packaged renderer entry URL on the internal app protocol", () => {
    expect(createDesktopAppRendererUrl()).toBe(
      `${DESKTOP_APP_PROTOCOL_SCHEME}://${DESKTOP_APP_PROTOCOL_HOST}/index.html`
    );
    expect(createDesktopAppRendererUrl("assets/app.js")).toBe(
      `${DESKTOP_APP_PROTOCOL_SCHEME}://${DESKTOP_APP_PROTOCOL_HOST}/assets/app.js`
    );
  });

  it("resolves valid renderer asset requests under the packaged renderer root", () => {
    expect(
      resolveDesktopAppProtocolAssetPath({
        rendererRoot: "/tmp/HugeCode/renderer",
        url: `${DESKTOP_APP_PROTOCOL_SCHEME}://${DESKTOP_APP_PROTOCOL_HOST}/index.html`,
      })
    ).toBe("/tmp/HugeCode/renderer/index.html");
    expect(
      resolveDesktopAppProtocolAssetPath({
        rendererRoot: "/tmp/HugeCode/renderer",
        url: `${DESKTOP_APP_PROTOCOL_SCHEME}://${DESKTOP_APP_PROTOCOL_HOST}/assets/app.js`,
      })
    ).toBe("/tmp/HugeCode/renderer/assets/app.js");
  });

  it("rejects unknown hosts and path traversal attempts", () => {
    expect(
      resolveDesktopAppProtocolAssetPath({
        rendererRoot: "/tmp/HugeCode/renderer",
        url: `${DESKTOP_APP_PROTOCOL_SCHEME}://malicious/index.html`,
      })
    ).toBeNull();
    expect(
      resolveDesktopAppProtocolAssetPath({
        rendererRoot: "/tmp/HugeCode/renderer",
        url: `${DESKTOP_APP_PROTOCOL_SCHEME}://${DESKTOP_APP_PROTOCOL_HOST}/%2e%2e%2fsecret.txt`,
      })
    ).toBeNull();
  });
});
