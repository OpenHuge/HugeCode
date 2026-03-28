import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultResourceLoader } from "../src/core/resource-loader.js";
import { createPluginHost } from "../src/core/kernel/plugin-host.js";
import { createPromptAssemblyService } from "../src/core/kernel/prompt-assembly-service.js";
import { createThemeRegistry } from "../src/core/kernel/theme-registry.js";

describe("PluginHost", () => {
  let tempDir: string;
  let agentDir: string;
  let cwd: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `coding-agent-host-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    agentDir = join(tempDir, "agent");
    cwd = join(tempDir, "workspace");
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(cwd, { recursive: true });
    mkdirSync(join(agentDir, "extensions"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("loads runtime registrations from extensions and rebuilds them on reload", async () => {
    const extensionPath = join(agentDir, "extensions", "runtime.mjs");
    writeFileSync(
      extensionPath,
      [
        "export default function(api) {",
        "  api.registerCommand('hello', { description: 'first' });",
        "  api.registerTool('ping', { description: 'ping tool' });",
        "  api.registerProvider('custom', { baseUrl: 'https://provider.test' });",
        "  api.appendSystemPrompt('Use ping.');",
        "  api.registerTheme({ name: 'plugin-theme', sourcePath: 'runtime://plugin-theme', tokens: { accent: '#123456' } });",
        "}",
      ].join("\n")
    );

    const loader = new DefaultResourceLoader({ cwd, agentDir });
    const discovery = await loader.discover();
    const themeRegistry = createThemeRegistry();
    const promptAssembly = createPromptAssemblyService();
    const host = createPluginHost({ cwd, themeRegistry, promptAssembly });

    await host.reload(discovery);

    expect(host.getCommands().map((item) => item.name)).toEqual(["hello"]);
    expect(host.getTools().map((item) => item.name)).toEqual(["ping"]);
    expect(host.getProviders().map((item) => item.name)).toEqual(["custom"]);
    expect(themeRegistry.getTheme("plugin-theme")?.sourcePath).toBe("runtime://plugin-theme");
    expect(
      promptAssembly.buildSystemPrompt({ basePrompt: "base", skills: [], agentsFiles: [] })
    ).toContain("Use ping.");

    writeFileSync(
      extensionPath,
      [
        "export default function(api) {",
        "  api.registerCommand('bye', { description: api.ui.name });",
        "  api.appendSystemPrompt('Use bye.');",
        "}",
      ].join("\n")
    );

    host.setUiAdapter({ name: "rpc" });
    await host.reload(await loader.discover());

    expect(host.getCommands().map((item) => item.name)).toEqual(["bye"]);
    expect(host.getCommands()[0]?.description).toBe("rpc");
    expect(host.getTools()).toEqual([]);
    expect(host.getProviders()).toEqual([]);
    expect(themeRegistry.getTheme("plugin-theme")).toBeUndefined();
    expect(
      promptAssembly.buildSystemPrompt({ basePrompt: "base", skills: [], agentsFiles: [] })
    ).toContain("Use bye.");
  });
});
