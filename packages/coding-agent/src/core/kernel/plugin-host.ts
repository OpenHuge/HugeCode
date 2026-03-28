import { pathToFileURL } from "node:url";
import type {
  PluginCommand,
  PluginHost,
  PluginProvider,
  PluginTool,
  PluginUiAdapter,
  PromptAssemblyService,
  ResourceDiscoveryResult,
  ThemeDefinition,
  ThemeRegistry,
} from "./contracts.js";

interface PluginHostOptions {
  cwd: string;
  themeRegistry: ThemeRegistry;
  promptAssembly: PromptAssemblyService;
}

interface PluginApi {
  readonly ui: PluginUiAdapter;
  registerCommand(name: string, command: { description: string }): void;
  registerTool(name: string, tool: { description: string }): void;
  registerProvider(name: string, config: Record<string, unknown>): void;
  registerTheme(theme: ThemeDefinition): void;
  appendSystemPrompt(fragment: string): void;
}

class DefaultPluginHost implements PluginHost {
  private readonly cwd: string;
  private readonly themeRegistry: ThemeRegistry;
  private readonly promptAssembly: PromptAssemblyService;
  private uiAdapter: PluginUiAdapter = { name: "interactive" };
  private commands: PluginCommand[] = [];
  private tools: PluginTool[] = [];
  private providers: PluginProvider[] = [];
  private promptFragments: string[] = [];

  constructor(options: PluginHostOptions) {
    this.cwd = options.cwd;
    this.themeRegistry = options.themeRegistry;
    this.promptAssembly = options.promptAssembly;
  }

  setUiAdapter(adapter: PluginUiAdapter): void {
    this.uiAdapter = adapter;
  }

  async reload(discovery: ResourceDiscoveryResult): Promise<void> {
    this.commands = [];
    this.tools = [];
    this.providers = [];
    this.promptFragments = [];
    this.themeRegistry.setDiscoveredThemes(discovery.themes);
    this.themeRegistry.resetRuntimeThemes();
    this.promptAssembly.setDiscoveredPromptTemplates(discovery.prompts);

    for (const extension of discovery.extensions) {
      const extensionFactory = await this.importExtensionFactory(extension.filePath);
      const api: PluginApi = {
        get ui() {
          return thisHost.uiAdapter;
        },
        registerCommand: (name, command) => {
          this.commands.push({ name, description: command.description });
        },
        registerTool: (name, tool) => {
          this.tools.push({ name, description: tool.description });
        },
        registerProvider: (name, config) => {
          this.providers.push({ name, config });
        },
        registerTheme: (theme) => {
          this.themeRegistry.registerRuntimeTheme(theme);
        },
        appendSystemPrompt: (fragment) => {
          this.promptFragments.push(fragment);
        },
      };

      const thisHost = this;
      await extensionFactory(api, { cwd: this.cwd });
    }

    this.promptAssembly.setExtensionPromptFragments(this.promptFragments);
  }

  getCommands(): PluginCommand[] {
    return [...this.commands];
  }

  getTools(): PluginTool[] {
    return [...this.tools];
  }

  getProviders(): PluginProvider[] {
    return [...this.providers];
  }

  private async importExtensionFactory(
    filePath: string
  ): Promise<(api: PluginApi, context: { cwd: string }) => Promise<void> | void> {
    const moduleUrl = new URL(pathToFileURL(filePath).href);
    moduleUrl.searchParams.set("reload", `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const imported = (await import(moduleUrl.href)) as { default?: unknown };
    if (typeof imported.default !== "function") {
      throw new Error(`Extension at ${filePath} does not export a default function`);
    }

    return imported.default as (api: PluginApi, context: { cwd: string }) => Promise<void> | void;
  }
}

export function createPluginHost(options: PluginHostOptions): PluginHost {
  return new DefaultPluginHost(options);
}
