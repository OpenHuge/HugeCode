import type { ResourceDiagnostic } from "../diagnostics.js";

export interface BootstrapOrchestrator {
  bootstrap(): Promise<void>;
}

export interface KernelBuilder {
  build(): Promise<void>;
}

export interface AgentsContextFile {
  path: string;
  content: string;
}

export interface SkillResource {
  name: string;
  description: string;
  content: string;
  filePath: string;
}

export interface PromptTemplateResource {
  name: string;
  description?: string;
  content: string;
  filePath: string;
}

export interface ThemeDefinition {
  name: string;
  sourcePath: string;
  tokens: Record<string, string>;
  filePath?: string;
}

export interface ExtensionResource {
  name: string;
  filePath: string;
}

export interface ResourceDiscoveryResult {
  extensions: ExtensionResource[];
  skills: SkillResource[];
  prompts: PromptTemplateResource[];
  themes: ThemeDefinition[];
  agentsFiles: AgentsContextFile[];
  diagnostics: ResourceDiagnostic[];
}

export interface PromptAssemblyInput {
  basePrompt: string;
  agentsFiles: AgentsContextFile[];
  skills: SkillResource[];
  promptTemplates?: PromptTemplateResource[];
}

export interface PromptAssemblyService {
  setDiscoveredPromptTemplates(promptTemplates: PromptTemplateResource[]): void;
  setExtensionPromptFragments(fragments: string[]): void;
  buildSystemPrompt(input: PromptAssemblyInput): string;
}

export interface PluginCommand {
  name: string;
  description: string;
}

export interface PluginTool {
  name: string;
  description: string;
}

export interface PluginProvider {
  name: string;
  config: Record<string, unknown>;
}

export interface PluginUiAdapter {
  name: string;
}

export interface PluginHost {
  setUiAdapter(adapter: PluginUiAdapter): void;
  reload(discovery: ResourceDiscoveryResult): Promise<void>;
  getCommands(): PluginCommand[];
  getTools(): PluginTool[];
  getProviders(): PluginProvider[];
}

export interface ThemeRegistry {
  setDiscoveredThemes(themes: ThemeDefinition[]): void;
  registerRuntimeTheme(theme: ThemeDefinition): void;
  resetRuntimeThemes(): void;
  getTheme(name: string): ThemeDefinition | undefined;
  getAllThemes(): ThemeDefinition[];
  applyTheme(name: string): ThemeDefinition | undefined;
  getActiveTheme(): ThemeDefinition | undefined;
}

export interface AgentExecutionMiddleware {
  name: string;
}
