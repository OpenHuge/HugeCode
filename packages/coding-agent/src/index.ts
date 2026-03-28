export { DefaultResourceLoader } from "./core/resource-loader.js";
export { createPluginHost } from "./core/kernel/plugin-host.js";
export { createPromptAssemblyService } from "./core/kernel/prompt-assembly-service.js";
export { createThemeRegistry } from "./core/kernel/theme-registry.js";
export type {
  AgentsContextFile,
  ExtensionResource,
  PluginCommand,
  PluginHost,
  PluginProvider,
  PluginTool,
  PluginUiAdapter,
  PromptAssemblyInput,
  PromptAssemblyService,
  PromptTemplateResource,
  ResourceDiscoveryResult,
  SkillResource,
  ThemeDefinition,
  ThemeRegistry,
} from "./core/kernel/contracts.js";
