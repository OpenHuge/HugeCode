import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { parseWebServerTimeout, resolveWebE2EPort } from "./playwright.config.shared";

const repoRoot = path.resolve(process.cwd(), "../..");
const WEB_E2E_HOST = "127.0.0.1";
const webE2EPort = resolveWebE2EPort(process.env);
const webE2EUrl = `http://${WEB_E2E_HOST}:${webE2EPort}`;
const skipManagedWebServer = process.env.PW_SKIP_WEBSERVER === "1";
const reuseExistingWebServer =
  process.env.PW_REUSE_WEBSERVER === "0"
    ? false
    : process.env.PW_REUSE_WEBSERVER === "1"
      ? true
      : !process.env.CI;
const webServerCommand = "node scripts/dev-code-runtime-gateway-web-all.mjs";
const webServerEnv = {
  ...process.env,
  WEB_E2E_HOST,
  WEB_E2E_PORT: String(webE2EPort),
};
const webServerTimeout = parseWebServerTimeout(process.env.PW_WEBSERVER_TIMEOUT_MS);

export default defineConfig({
  testDir: "./src",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  webServer: skipManagedWebServer
    ? undefined
    : {
        command: webServerCommand,
        env: webServerEnv,
        url: webE2EUrl,
        cwd: repoRoot,
        reuseExistingServer: reuseExistingWebServer,
        timeout: webServerTimeout,
      },
  use: {
    baseURL: webE2EUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
